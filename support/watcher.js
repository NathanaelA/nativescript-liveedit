#!/usr/bin/env node
/**********************************************************************************
 * (c) 2015, 2016 Master Technology
 * Licensed under the MIT license or contact me for a Support or Commercial License
 *
 * I do contract work in most languages, so let me solve your problems!
 *
 * Any questions please feel free to email me or put a issue up on the github repo
 * Version 0.1.5                                      Nathan@master-technology.com
 *********************************************************************************/
"use strict";

/* global escape */

// What is the current Test Mode allowed
var TM_AUTO = 0;    // Automatically switch between Test most and normal mode depending on file saved
var TM_ALWAYS = 1;  // Always stay in Test mode
var TM_NEVER = 2;   // Never go into Test mode

// What is the current set Test Mode
var CM_UNKNOWN = 0;
var CM_NO_DEVICE = 1;
var CM_NORMAL = 2;
var CM_TESTMODE = 3;

// App Mode Constants
var APPMODE_NORMAL = "app.js";
var APPMODE_TEST = "./tns_modules/nativescript-unit-test-runner/app.js";
var appProjectData = null;

// Load our Requires
var fs = require('fs');
var cp = require('child_process');
var os = require('os');

// Configuration ----------------------------------------------
var watching = [".css", ".js", ".xml", ".ttf", ".png", ".jpg"];
// ------------------------------------------------------------

console.log("\n------------------------------------------------------------");
console.log("NativeScript LiveEdit Watcher v0.15");
console.log("(c)2015, 2016, Master Technology.  www.master-technology.com");
console.log("------------------------------------------------------------");


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
var info, projectData = {nativescript: {id: ""}}, commandLine = {testMode: TM_AUTO}, currentMode;
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

// Set the Global wide
setupErrorCatching();

console.log("Watching your project:", projectData.nativescript.id);

// We will copy ourselves to the device, if it works then we have r/w access to the machine, if it fails we will use another method
// Real non-rooted devices might have an issue with pushing to their directory; if we detect this; we will use an alternative method...
/* ---------------------------------------------------------- */
var pushADB = normalPushADB;
pushADB("watcher.js", {check: true});


// Check for jsHint & xmllint support
/* ---------------------------------------------------------- */
var hasTSLint = false;
var hasJSHint = false;
var hasXMLLint = false;
var _tsLintCallback = function(error) {
    if (!error || error.code === 0) {
        hasTSLint = true;
    } else {
        console.log("TSLINT has not been detected, disabled TSLINT support. (",error,")");
        console.log("Without TSLINT support, changes to TS files might cause the phone app to crash.");
        console.log("To install, type 'npm install -g tslint'");
        console.log("-------------------------------------------------------------------------------");
    }
};

var _jshintCallback = function(error) {
    if (!error || error.code === 0) {
        hasJSHint = true;
    } else {
        console.log("JSHINT has not been detected, disabled JSHINT support. (",error,")");
        console.log("Without JSHINT support, changes to JS files might cause the phone app to crash.");
        console.log("To install, type 'npm install -g jshint'");
        console.log("-------------------------------------------------------------------------------");
    }
};
var _xmllintCallback = function(error,a,b) {
    if (!error && b === '') {
        hasXMLLint = true;
    } else {
        console.log("XMLLINT has not been detected, disabled XMLLINT support. (",error,")");
        console.log("Without XMLLINT support, malformed XML files will cause the phone app to crash.");
        if (os.type() === "Windows_NT") {
            console.log("You can download XMLLINT for windows from http://nativescript.rocks");
        }
        console.log("--------------------------------------------------------------------------------");
    }
};

cp.exec("jshint watcher.js", {timeout: 3000}, _jshintCallback);
cp.exec("tslint --version" , {timeout: 3000}, _tsLintCallback);
if (os.type() === 'Windows_NT') {
    cp.exec("xmllint --noout .\\platforms\\android\\src\\main\\AndroidManifest.xml", {timeout: 3000}, _xmllintCallback);
} else {
    cp.exec("xmllint --noout ./platforms/android/src/main/AndroidManifest.xml", {timeout: 3000}, _xmllintCallback);
}

// Globals
var timeStamps = {};
var watchingFolders = {};

// Startup the Watchers...
setupWatchers("./app");

handleCommandLine();
currentMode = getAppMode();

// Start Karma if need be
if (commandLine.testMode !== TM_NEVER) {
    if (fs.existsSync("./app/tests") && fs.existsSync("./node_modules/karma")) {
        launchKarma();
    }
}





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
    //noinspection RedundantIfStatementJS
    if (fileName.toLowerCase().lastIndexOf("restart.liveedit") === (fileName.length - 16)) {
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
        if (timeStamps[dir+fileList[i]] === undefined || timeStamps[dir+fileList[i]] !== stats.mtime.getTime()) {
            //console.log("Found 1: ", dir+fileList[i], timeStamps[dir+fileList[i]], stats.mtime.getTime());

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
function backupPushADB(fileName, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = null;
    }

    var srcFile = fileName;
    if (options && typeof options.srcFile === "string") {
        srcFile = options.srcFile;
    }

    var path = "/data/local/tmp/" + projectData.nativescript.id + "/" + backupEncode(fileName);
    cp.exec('adb push "'+srcFile+'" ' + path, {timeout: 10000}, function(err, sout, serr) {
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
        if (callback) {
            callback(err);
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
 * @param options
 * @param callback
 */
function normalPushADB(fileName, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = null;
    }
    var srcFile = fileName;
    if (options && typeof options.srcFile === "string") {
        srcFile = options.srcFile;
    }

    var check = false;
    if (options && options.check) {
        check = true;
    }
    var quiet = false;
    if (options && options.quiet) {
        quiet = true;
    }

    var path = "/data/data/" + projectData.nativescript.id + "/files/" + fileName;
    cp.exec('adb push "'+srcFile+'" "' + path + '"', {timeout: 10000}, function(err, sout, serr) {
        if (err) {

            if (sout.indexOf('Permission denied') > 0) { pushADB = backupPushADB; console.log("Using backup method for updates!"); }
            if (serr.indexOf('Permission denied') > 0) { pushADB = backupPushADB; console.log("Using backup method for updates!"); }
            if (check !== true) {
                console.log("Failed to Push to Device: ", fileName);
                console.log(err);
                //console.log(sout);
                //console.log(serr);
            }
        } else if (check !== true && quiet === false ) {
            console.log("Pushed to Device: ", fileName);
        }
        if (callback) {
            callback(err);
        }
    });
}

function pullADB(fileName, options) {
    var destFile = fileName;
    if (options && typeof options.destFile === "string") {
        destFile = options.destFile;
    }

    var quiet = false;
    if (options && options.quiet) {
        quiet = true;
    }

    var path = "/data/data/" + projectData.nativescript.id + "/files/" + fileName;
    try {
        var buffer = cp.execSync('adb pull "' + path + '" "' + destFile + '"', {timeout: 5000});
    } catch (err) {
        if (err && err.stderr) {
            if (err.stderr.toString().indexOf("error: device not found") === 0) { return false;}
            console.log("Error:", err.stderr.toString(), err.stderr.length);
        }
    }
    return true;
}

function isTestFile(filename) {
    //console.log("Checking mode/name:",filename, currentMode);
    if (currentMode === CM_UNKNOWN) { return; }
    if (currentMode === CM_NO_DEVICE) {
        currentMode = getAppMode();
        if (currentMode <= CM_NO_DEVICE) { return; }
    }

    if (filename.indexOf('./app/tests/') === 0) {
        if (currentMode === CM_NORMAL) {
            if (commandLine.testMode !== TM_NEVER) {
                setAppMode(CM_TESTMODE);
                launchApp({force: true});
            }
        } else {
            launchApp({force: false});
        }
    } else {
        if (currentMode === CM_TESTMODE) {
            if (commandLine.testMode !== TM_ALWAYS) {
                setAppMode(CM_NORMAL);
                launchApp({force: false});
            }
        } else {
            launchApp();
        }
    }
}

var isKarmaRunning = false;
function launchKarma() {
    if (isKarmaRunning) { return; }
    isKarmaRunning = true;
    var KarmaServer = require('./node_modules/karma/lib/server');

    var karmaConfig = {
        browsers: [],
        singleRun: false,
        frameworks: ['mocha', 'chai'],
        basePath: '',
        files: [ './app/tests/*.js' ],
        exclude: [],
        preprocessors: { },
        port: 9876,
        colors: true,
        autoWatch: true,
        reporters: ['progress']

    };

    // Launch Karama
    console.log("Starting Karma...");
    new KarmaServer(karmaConfig).start();
}

var isLaunchScheduled = false;
function futureAppLaunch() {
    if (isLaunchScheduled) {
        return;
    }
    isLaunchScheduled = setTimeout(function() {
        isLaunchScheduled = false;
        checkAppIsRunning();
    }, 1000);
}

function restartApplication() {
    var cmd = "adb shell am force-stop "+projectData.nativescript.id;
    cp.exec(cmd, function(err, stdout) {
        doLaunch();
    });
}

function checkCrashedApp(autoStart) {
    var cmd = "adb shell dumpsys activity activities | grep cmp="+projectData.nativescript.id+"/com.tns.ErrorReportActivity";
    if (os.type() === "Windows_NT") {
        cmd = "adb shell dumpsys activity activities ^| grep cmp="+projectData.nativescript.id+"/com.tns.ErrorReportActivity";
    }

    cp.exec(cmd, function(err, stdout) {
        // Check to see if running
        if (stdout.length === 0) {
            if (autoStart === false) { return; }
            futureAppLaunch();
        } else {
            restartApplication();
        }
    });
}

function checkAppIsRunning(autoStart) {
    var cmd = 'adb shell ps | grep '+projectData.nativescript.id;
    if (os.type() === "Windows_NT") {
        cmd = 'adb shell ps ^| grep ' + projectData.nativescript.id;
    }

    cp.exec(cmd, function(err, stdout) {
        // Check to see if running
        if (stdout.length === 0) {
            doLaunch();
        } else {
            checkCrashedApp(autoStart);
        }
    });
}

function doLaunch() {
    if (isLaunchScheduled) {
        clearTimeout(isLaunchScheduled);
        isLaunchScheduled = false;
    }
    console.log("Starting application...");
    var child = cp.spawn('adb',['shell','am', 'start', '-S', projectData.nativescript.id + "/com.tns.NativeScriptActivity"], {stdio: "ignore", detached: true});
    child.unref();
}

function launchApp(params) {
    if (params && params.force) {
        doLaunch();
        return;
    }
    if (!params) {
        checkAppIsRunning(false);
    } else {
        checkAppIsRunning();
    }
}

/**
 * This runs the linters to verify file sanity before pushing to the device
 * @param fileName
 */
var lastFileName, lastFileStamp;
function checkParsing(fileName) {
    console.log("\nChecking updated file: ", fileName);

    var callback = function(err, stdout , stderr) {
        if (err && (err.code !== 0 || err.killed) ) {
            //console.log("Error: ", err);
            console.log("---------------------------------------------------------------------------------------");
            console.log("---- Failed Sanity Tests on", fileName);
            console.log("---------------------------------------------------------------------------------------");
            if (stdout) { console.log("STDOut:", stdout); }
            if (stderr) { console.log("STDErr:", stderr); }
            console.log("---------------------------------------------------------------------------------------\n");
        } else {
            pushADB(fileName, function(err) {
                if (!err) {
                    isTestFile(fileName);
                }
            } );
        }
    };

    if (fileName.endsWith(".js")) {
        // If this is from a TS File, just continue, since it is compiled
        if (fs.existsSync(fileName.substr(0,fileName.length-2)+"ts")) {
            callback(null, "", "");
            return;
        }
        if (hasJSHint) {
            cp.exec('jshint "' + fileName + '"', {timeout: 5000}, callback);
        } else {
            console.log("WARNING: JSHINT is not installed, no test performed on JS files.");
            callback(null, "", "");
        }
    } else if (fileName.endsWith(".ts")) {
        if (hasTSLint) {
            cp.exec('tslint "' + fileName + '"', {timeout: 5000}, callback);
        } else {
            console.log("WARNING: TSLINT is not installed, no test performed on TS files.");
            callback(null, "", "");
        }
    } else if (fileName.endsWith(".xml")) {
        if (hasXMLLint) {
            if (os.type() === 'Windows_NT') {
                cp.exec('type watcher.entities "' + fileName.replace(/\//g, '\\') + '" | xmllint --noout -', {timeout: 5000}, callback);
            } else {
                cp.exec('cat watcher.entities "' + fileName + '" | xmllint --noout -', {timeout: 5000}, callback);
            }
        } else {
            console.log("WARNING: XMLLINT is not installed, no test performed on XML files.");
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
                if (stat.size === 0) return;
                if (timeStamps[dir + fileName] === undefined || timeStamps[dir + fileName] !== stat.mtime.getTime()) {
                    //console.log("Found 2: ", event, dir+fileName, stat.mtime.getTime(), stat.mtime, stat.ctime.getTime(), stat.size);
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

/*
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
 */

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

function processYesNoAllow(value) {
    if (value) {
        value = value.toLowerCase();
        if (value === "always" || value === "yes" || value === "true" || value === "t" || value === "y" || value === "a" || value === "1") {
            return true;
        }
        if (value === "never" || value === "no" || value === "false" || value === "f" || value === "n" || value === "0") {
            return false;
        }
    }
    return false;
}

function handleCommandLine() {
    var commandModeVar;
    for (var i=1;i<process.argv.length;i++) {
        var lowArgv = process.argv[i].toLowerCase();
        if (lowArgv.indexOf('test') === 1) {
            if (process.argv[i].length === 5) {
                commandModeVar = process.argv[++i];
            } else {
                commandModeVar = process.argv[i].substr(6);
            }
            if (processYesNoAllow(commandModeVar)) {
                commandLine.testMode = TM_ALWAYS;
            } else {
                commandLine.testMode = TM_NEVER;
            }
        }
        if (lowArgv.indexOf('watch') === 1) {
            if (process.argv[i].length === 6) {
                commandModeVar = process.argv[++i];
            } else {
                commandModeVar = process.argv[i].substr(7);
            }
            if (commandModeVar) {
                if (commandModeVar[0] === '*') {
                    commandModeVar = commandModeVar.substr(1);
                }
                watching.push(commandModeVar);
            }
        }
    }
}

function getAppMode() {
    var info;

    // Get the current value
    var found = pullADB("./app/package.json", {quiet: true, destFile: "./watcher.package.json"});
    if (!found) { return CM_NO_DEVICE; }

    if (!fs.existsSync('./watcher.package.json')) {
        fs.writeFileSync('./watcher.package.json', fs.readFileSync('./app/package.json'));
    }
    try {
        info = fs.readFileSync('./watcher.package.json');
        appProjectData = JSON.parse(info);
    }
    catch (err) {
        console.log("Unable to read your app/tests/package.json file, the watcher.js MUST be in your root of your application's directory.");
        process.exit(1);
        return;
    }

    if (!fs.existsSync('./app/tests')) {
        commandLine.testMode = TM_NEVER;
        return CM_NORMAL;
    }


    var mode = CM_UNKNOWN;
    if (appProjectData.main === APPMODE_NORMAL) { mode = CM_NORMAL; }
    else if (appProjectData.main === APPMODE_TEST) { mode = CM_TESTMODE; }

    if (mode !== CM_UNKNOWN) {
        updateTelerikTestApp();
        //setAppMode(mode, true);
    }

    return mode;
}

function setAppMode(appMode, force) {
    if (appMode === CM_NORMAL) {
        if (appProjectData.main === APPMODE_NORMAL && force !== true) { return; }
        appProjectData.main = APPMODE_NORMAL;
    } else if (appMode === CM_TESTMODE) {
        if (appProjectData.main === APPMODE_TEST && force !== true) { return; }
        appProjectData.main = APPMODE_TEST;
    } else {
        return;
    }
    console.log("Setting App Mode:", appMode === CM_NORMAL ? "Normal" : "Test");
    fs.writeFileSync('./watcher.package.json', JSON.stringify(appProjectData));
    pushADB("./app/package.json", {quiet: true, srcFile: "./watcher.package.json"});
    currentMode = appMode;
}

function updateTelerikTestApp() {
    pushADB("./app/tns_modules/nativescript-unit-test-runner/app.js", {quiet: true, srcFile: "./node_modules/nativescript-liveedit/support/testFramework.app.js"});
}

/***
 * Catch the global errors
 */
function setupErrorCatching() {
    process.on('uncaughtException', function (err) {
        if (err.toString() === "Error: watch EPERM") {
            // Silly User decided to DELETE a watched folder....  Need to eliminate the watch so it can be watched when they re-add it again.
            verifyWatches();
        } else {
            console.error(err);
        }
    });
}

/*
 // TODO: see if we can get access before retry
 process.stdin.on('readable', function() {
 var chunk = process.stdin.read();
 if (chunk !== null) {
 process.stdout.write('data: ' + chunk);
 }
 });

 process.stdin.on('end', function() {
 process.stdout.write('end');
 });
 process.stdin.resume();

 */