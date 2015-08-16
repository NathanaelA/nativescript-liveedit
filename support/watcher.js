#!/usr/bin/env node
/**********************************************************************************
 * (c) 2015, Master Technology
 * Licensed under the MIT license or contact me for a Support or Commercial License
 *
 * I do contract work in most languages, so let me solve your problems!
 *
 * Any questions please feel free to email me or put a issue up on the github repo
 * Version 0.0.8                                      Nathan@master-technology.com
 *********************************************************************************/
"use strict";

/* global escape */


// Load our Requires
var fs = require('fs');
var cp = require('child_process');
var os = require('os');
var crypto = require('crypto');


// Configuration -----------------------------
var watching = [".css", ".js", ".xml"];
// -------------------------------------------

console.log("\n------------------------------------------------------");
console.log("NativeScript LiveSync Watcher v0.08");
console.log("(c)2015, Master Technology.  www.master-technology.com");
console.log("------------------------------------------------------");


// Setup any missing Prototypes
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(searchString, position) {
        var subjectString = this.toString();
        if (position === undefined || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}


// Load the Project Information and output it
/* ---------------------------------------------------------- */
var info, projectData;
try {
    info = fs.readFileSync('package.json');
    projectData = JSON.parse(info);
}
catch (err) {
    console.log("Unable to read your package.json file, the watcher.js MUST be in your root of your application's directory.");
    process.exit(1);
    return;
}

// The default project name is "org.nativescript.<yourname>"
// however, if you know what you are doing you can replace this so in the future
// when this is no longer hard coded; I want to make sure that it accepts them.

if (!projectData || !projectData.nativescript || !projectData.nativescript.id || projectData.nativescript.id.length === 0 || projectData.nativescript.id.indexOf('.') < 3) {
    console.log("Your package.json file appears to be corrupt, the project that I am detecting is: ", projectData && projectData.nativescript && projectData.nativescript.id);
    process.exit(1);
    return;
}
console.log("Watching your project:", projectData.nativescript.id);

checkFileSha("./platforms/android/libs/x86/libNativeScript.so","f28f4f6970198e22bc432b390f4625802c8479ac");
checkFileSha("./platforms/android/libs/armeabi-v7a/libNativeScript.so","a2583bba4935bd2907cd32195d04b8724da27a67");

// We will copy ourselves to the device, if it works then we have r/w access to the machine, if it fails we will use another method
// Real non-rooted devices might have an issue with pushing to their directory; if we detect this; we will attempt to use an alternative method...
/* ---------------------------------------------------------- */
var runADB = normalRunADB;
runADB("watcher.js", true);


// Check for jsHint & xmllint support
/* ---------------------------------------------------------- */
var hasJSHint = false;
var hasXMLLint = false;
var _jshintCallback = function(error) {
    if (!error || error.code === 0) {
        hasJSHint = true;
    } else {
        console.log("JSHINT has not been detected, disabled JSHINT support. (",error,")");
        console.log("Without JSHINT support, changes to JS files might cause the phone app to crash.");
        console.log("-------------------------------------------------------------------------------");
    }
};
var _xmllintCallback = function(error,a,b) {
    if (!error && b === '') {
        hasXMLLint = true;
    } else {
        console.log("XMLLINT has not been detected, disabled XMLLINT support. (",error,")");
        console.log("Without XMLLINT support, malformed XML files will cause the phone app to crash.");
        console.log("--------------------------------------------------------------------------------");
    }
};

cp.exec("jshint watcher.js", {timeout: 3000}, _jshintCallback);
if (os.type() === 'Windows_NT') {
    cp.exec("xmllint --noout .\\platforms\\android\\AndroidManifest.xml", {timeout: 3000}, _xmllintCallback);
} else {
    cp.exec("xmllint --noout ./platforms/android/AndroidManifest.xml", {timeout: 3000}, _xmllintCallback);
}

// Globals
var timeStamps = {};
var watchingFolders = {};

// Startup the Watchers...
setupWatchers("./app");




/**
 * isWatching - will respond true if watching this file type.
 * @param fileName
 * @returns {boolean}
 */
function isWatching(fileName) {
    for (var i=0;i<watching.length;i++) {
        if (fileName.endsWith(watching[i])) {
            return true;
        }
    }
    //noinspection RedundantIfStatementJS
    if (fileName.toLowerCase().lastIndexOf("restart.livesync") === (fileName.length - 16)) {
        return true;
    }
    return false;
}

/**
 * check for any changed files on platforms (Mac's) that don't pass a filename in the callback
 * @param dir
 * @returns {*}
 */
function checkForChangedFiles(dir) {
    var fileList = fs.readdirSync(dir);
    for (var i=0;i<fileList.length;i++) {
        if (!isWatching(fileList[i])) {
            continue;
        }
        if (!fs.existsSync(dir+fileList[i])) { continue; }
        var stats;
        try {
            stats = fs.statSync(dir + fileList[i]);
        }
        catch (err) {
            // this means the file disappeared between the exists and when we tried to stat it...
            continue;
        }
        if (timeStamps[dir+fileList[i]] === undefined || timeStamps[dir+fileList[i]] < stats.mtime.getTime()) {
            timeStamps[dir+fileList[i]] = stats.mtime.getTime();
            return dir+fileList[i];
        }
    }
    return null;
}

/**
 * check for any changed folders on platforms (Mac's) that don't pass a filename in the callback
 * @param dir
 * @returns {*}
 */
function checkForChangedFolders(dir) {
    var fileList = fs.readdirSync(dir);
    for (var i = 0; i < fileList.length; i++) {
        if (!fs.existsSync(dir+fileList[i])) { continue; }
        var dirStat;
        try {
            dirStat = fs.statSync(dir + fileList[i]);
        } catch (e) {
            // This means the file disappeared between the exists and us stating the file.
            continue;
        }
        if (dirStat.isDirectory()) {
            if (!watchingFolders[dir + fileList[i]]) {
                console.log("Adding new directory to watch: ", dir + fileList[i]);
                setupWatchers(dir + fileList[i]);
            }
        }
    }
}

function backupEncode(filename) {
    var resultName = filename;
    if (resultName.indexOf('./app/') === 0) {
        resultName = resultName.substr(6);
    }

    return escape(resultName).replace(/\//g, '%2F').replace(/\./g, '%2E');
}

var hasFixedPermissions = false;
function backupRunADB(fileName) {
    var path = "/data/local/tmp/" + projectData.nativescript.id + "/" + backupEncode(fileName);
    cp.exec('adb push "'+fileName+'" ' + path, {timeout: 5000}, function(err, sout, serr) {
        if (err) {
            console.log("Failed to Push to Device: ", fileName);
            console.log(err);
            console.log(sout);
            console.log(serr);
        } else {
            console.log("Pushed to Device: ", fileName, path);
        }
        if (!hasFixedPermissions) {
            fixPermissions("/data/local/tmp/" + projectData.nativescript.id);
        }
    });
}

function fixPermissions(path) {
    hasFixedPermissions = true;
    cp.exec('adb shell chmod 777 '+path, {timeout: 5000});
}

/**
 * This runs the adb command so that we can push the file up to the emulator or device
 * @param fileName
 */
function normalRunADB(fileName, check) {
    var path = "/data/data/" + projectData.nativescript.id + "/files/" + fileName;
    cp.exec('adb push "'+fileName+'" ' + path, {timeout: 5000}, function(err, sout, serr) {
        if (err) {
            if (serr.indexOf('Permission denied') > 0) { runADB = backupRunADB; }
            if (check !== true) {
                console.log("Failed to Push to Device: ", fileName);
                console.log(err);
                console.log(sout);
                console.log(serr);
            }
        } else if (check !== true) {
            console.log("Pushed to Device: ", fileName);
        }
    });
}

/**
 * This runs the linters to verify file sanity before pushing to the device
 * @param fileName
 */
function checkParsing(fileName) {
    console.log("\nChecking updated file: ", fileName);


    var callback = function(err, stdout , stderr) {
        if (err && (err.code !== 0 || err.killed) ) {
            //console.log("Error: ", err);
            console.log("---------------------------------------------------------------------------------------");
            console.log("---- Failed Sanity Tests on", fileName);
            console.log("---------------------------------------------------------------------------------------");
            if (stdout) { console.log("STDOut", stdout); }
            if (stderr) { console.log("STDErr", stderr); }
            console.log("---------------------------------------------------------------------------------------\n");
        } else {
            runADB(fileName);
        }
    };

    if (fileName.endsWith(".js")) {
        if (hasJSHint) {
            cp.exec('jshint "' + fileName + '"', {timeout: 5000}, callback);
        } else {
            console.log("WARNING: JSHINT is not installed, no test performed on JS file.");
            callback(null, "", "");
        }
    } else if (fileName.endsWith(".xml")) {
        if (hasXMLLint) {
            cp.exec('xmllint --noout "' + fileName + '"', {timeout: 5000}, callback);
        } else {
            console.log("WARNING: XMLLINT is not installed, no test performed on XML file.");
            callback(null, "", "");
        }
    } else {
        callback(null, "", "");
    }
}

/**
 * This is the watcher callback to verify the file actually changed
 * @param dir
 * @returns {Function}
 */
function getWatcher(dir) {
    return function (event, fileName) {
        if (event === "rename") {
            verifyWatches();
            if (fileName) {
                if (!fs.existsSync(dir + fileName)) { return; }
                var dirStat;
                try {
                    dirStat = fs.statSync(dir + fileName);
                } catch (err) {
                    // This means the File disappeared out from under me...
                    return;
                }
                if (dirStat.isDirectory()) {
                    if (!watchingFolders[dir + fileName]) {
                        console.log("Adding new directory to watch: ", dir + fileName);
                        setupWatchers(dir + fileName);
                    }
                    return;
                }
            } else {
                checkForChangedFolders(dir);
            }
            return;
        }

        if (!fileName) {
            fileName = checkForChangedFiles(dir);
            if (fileName) {
                checkParsing(fileName);
            }
        }
        else {
            if (isWatching(fileName)) {
                if (!fs.existsSync(dir + fileName)) {
                    return;
                }

                var stat;
                try {
                    stat = fs.statSync(dir + fileName);
                }
                catch (e) {
                    // This means the file disappeared between exists and stat...
                    return;
                }
                if (timeStamps[dir + fileName] === undefined || timeStamps[dir + fileName] < stat.mtime.getTime()) {
                    timeStamps[dir + fileName] = stat.mtime.getTime();
                    checkParsing(dir + fileName);
                }

            }

        }
    };
}

/**
 * This setups a watcher on a directory
 * @param path
 */
function setupWatchers(path) {
    // We want to track the watchers now and return if we are already watching this folder
    if (watchingFolders[path]) { return; }

    watchingFolders[path] = fs.watch(path, getWatcher(path + "/"));
    watchingFolders[path].on('error', function() {  verifyWatches(); });
    var fileList = fs.readdirSync(path);
    var stats;
    for (var i = 0; i < fileList.length; i++) {
        try {
            stats = fs.statSync(path + "/" + fileList[i]);
        }
        catch (e) {
            continue;
        }
        if (isWatching(fileList[i])) {
            timeStamps[path + "/" + fileList[i]] = stats.mtime.getTime();
        } else {
            if (stats.isDirectory()) {
                if (fileList[i] === "node_modules") {
                    watchingFolders[path + "/" + fileList[i]] = true;
                    continue;
                }
                if (fileList[i] === "tns_modules") {
                    watchingFolders[path + "/" + fileList[i]] = true;
                    continue;
                }
                if (fileList[i] === "App_Resources") {
                    watchingFolders[path + "/" + fileList[i]] = true;
                    continue;
                }
                setupWatchers(path + "/" + fileList[i]);
            }
        }
    }
}


function checkFileSha(filename, hash) {
    var shaSum = crypto.createHash('sha1');
    var readStream = fs.createReadStream(filename);
    readStream.on('data', function(d) {
        shaSum.update(d);
    });

    readStream.on('end', function() {
        var d = shaSum.digest('hex');
        if (d !== hash) {
            console.error("\n\nYour platform does not seem to be running the correct version of the runtimes.  Please see http://github.com/NathanaelA/nativescript-livesync");
            process.exit(1);
        }
    });
}

function verifyWatches() {
    for (var key in watchingFolders) {
        if (watchingFolders.hasOwnProperty(key)) {
            if (watchingFolders[key] && !fs.existsSync(key)) {
                watchingFolders[key].close();
                watchingFolders[key] = false;
                console.log("Removing", key, "from being watched.");
            }
        }
    }
}

process.on('uncaughtException', function(err) {
    if (err.toString() === "Error: watch EPERM") {
        // Silly User decided to DELETE a watched folder....  Need to eliminate the watch so it can be watched when they re-add it again.
        verifyWatches();
    } else {
        console.error(err);
    }
});
