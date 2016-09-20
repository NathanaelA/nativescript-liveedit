#!/usr/bin/env node
/**********************************************************************************
 * (c) 2015, 2016 Master Technology
 * Licensed under the MIT license or contact me for a Support or Commercial License
 *
 * I do contract work in most languages, so let me solve your problems!
 *
 * Any questions please feel free to email me or put a issue up on the github repo
 * Version 0.1.3                                       Nathan@master-technology.com
 *********************************************************************************/
"use strict";

var os = require('os');
var crypto = require('crypto');
var fs = require('fs');


var aarFileHashes = {
    // These are the Original NativeScript Versions
    "3f241535c547b017c8b187bc56ff81f7021626df": {version: "2.1.0", liveSync: false, upgrade: true},
    "b2b2a6c9e0b535aa7bd00a042c2ac4af810282fa": {version: "2.1.1", liveSync: false, upgrade: true},
    "3c1f676fa42dda8f09a1f92602dd58acce2ca58b": {version: "2.2.0", liveSync: false, upgrade: true},
    "67bbcc79d0dcbf42860ee1d81ab5ce4314e996c0": {version: "2.3.0", liveSync: false, convert: true},

    // These are my Compiled versions
    // I never made a 2.1.0 version
    "6bf96a0e5856e26d91606934ed989cee66e5348a": {version: "2.1.1", liveSync: true, upgrade: true},
    "3ca1e9080a41dd9f9fa7b66c5c0ae56071e8e05d": {version: "2.2.0", liveSync: true, upgrade: true},
    "9b2cbc06ade5d0bbd5a8b03e7275b9d39181c135": {version: "2.3.0", liveSync: true}

};


function getVersion() {
    var key, version="0.0.0";
    for (key in aarFileHashes) {
        if (aarFileHashes.hasOwnProperty(key)) {
            if (version < aarFileHashes[key].version) {
                version = aarFileHashes[key].version;
            }
        }
    }

    return version;
}

var currentVersion = getVersion();

if (fs.existsSync("../../platforms/android/libs/x86/libNativeScript.so") || fs.existsSync("../../platforms/android/libs/jni/x86/libNativeScript.so")) {
    console.log("You are running a old version of the runtimes.  You need to upgrade your NativeScript platform to v2.10 or later.");
    cleanupFiles();
    process.exit(0);
} else {
    getFileSha("../../platforms/android/libs/runtime-libs/nativescript.aar", checkHash);
}

function displayUpgrade(version) {
    console.error("---------------------------------------------------------------------------------------------------\n",
        "Your version (", version, ") of the Platform Android runtimes are outdated!\n The current version is: ",currentVersion,"  Please upgrade your runtimes by doing a:\n   >tns platform update android\n Then you need to redo the installation of this plugin\n   >tns plugin add nativescript-liveedit",
		"If upgrading is not a options, download this plugin tagged to your current runtimes. using the tag @ns" + version + "  to specify the specific version.",
        "\n---------------------------------------------------------------------------------------------------\n");
    cleanupFiles();
    process.exit(0);
}

var cnt = 0;
function checkHash(v) {
    cnt++;

    if (!aarFileHashes[v]) {
        console.error("---------------------------------------------------------------------------------------------------\n",
            "This version of LiveEdit does not support the version of the Android runtimes you have.\n This is probably because you have updated to a newer version of the NativeScript Android runtimes.\n","A new version of NativeScript-LiveEdit should be released shortly.",
            "\n---------------------------------------------------------------------------------------------------\n");
        cleanupFiles();
        process.exit(0);
    }
    var convert = false, liveSync = false;
    if (aarFileHashes[v]) {
        if (aarFileHashes[v].upgrade) {
            displayUpgrade(aarFileHashes[v].version);
        }
        convert = !!aarFileHashes[v].convert;
        liveSync = !!aarFileHashes[v].liveSync;
    }

    if (cnt >= 1) {
        if (liveSync) {
            console.error("---------------------------------------------------------------------------------------------------\n",
                "You are already running the current LiveEdit runtimes.  Updating just the LiveEdit Javascript...",
                "\n---------------------------------------------------------------------------------------------------\n");
        } else if (convert) {
            console.error("---------------------------------------------------------------------------------------------------\n",
                "Installing the LiveEdit version of the runtimes....",
                "\n---------------------------------------------------------------------------------------------------\n");
        }

        copyFiles(convert);
    }
}

function copyFile(src, dest, forceOverWrite) {
    if (!forceOverWrite && fs.existsSync(dest)) return;
    var buffer = fs.readFileSync(src);
    fs.writeFileSync(dest, buffer);
}

function copyFiles(convert) {
    copyFile("./support/watcher.js","../../watcher.js", true);
    copyFile("./support/watcher.entities","../../watcher.entities", false);
    copyFile("./support/.jshintrc","../../.jshintrc", false);
    copyFile("./support/tslint.json", "../../tslint.json", false);
    if (convert) {
        copyFile("./platforms/android/nativescript.aar", "../../platforms/android/libs/runtime-libs/nativescript.aar", true);
    }
    cleanupFiles();

    process.exit(0);
}

function cleanupFiles() {
    // Delete these files so that they don't end up in the compiled project,
    // the tns plugin command is simple stupid in that it copies everything to the platforms/.../tns_modules/nativescript-liveedit folder
    // However, later it cleans up after itself; but this is more of a precaution so that they files never end up in that folder.
    // In addition this eliminates TNS from attempting to make a include.gradle file automatically for no reason
    fs.unlinkSync("./platforms/android/nativescript.aar");
    fs.unlinkSync("./support/watcher.entities");
    fs.unlinkSync("./support/watcher.js");
    fs.unlinkSync("./support/.jshintrc");
    fs.unlinkSync("./support/tslint.json");
    fs.unlinkSync("./support/postinstall.js");
    fs.rmdirSync("./platforms/android");
    fs.rmdirSync("./platforms");
}


function getFileSha(filename, callback) {
    var shaSum = crypto.createHash('sha1');
    if (!fs.existsSync(filename)) {
        console.error("---------------------------------------------------------------------------------------------------\n",
            "Unable to find the Android Runtimes.  Please make sure that you have done a\n   >tns platform add android\n","Then re-run the adding of this plugin.",
            "\n---------------------------------------------------------------------------------------------------\n");
        cleanupFiles();
        process.exit(0);
    }
    var readStream = fs.createReadStream(filename);
    readStream.on('data', function(d) {
        shaSum.update(d);
    });

    readStream.on('end', function() {
        var d = shaSum.digest('hex');
        callback(d);
    });
}

