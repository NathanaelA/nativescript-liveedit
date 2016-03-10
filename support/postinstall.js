#!/usr/bin/env node
/**********************************************************************************
 * (c) 2015, 2016 Master Technology
 * Licensed under the MIT license or contact me for a Support or Commercial License
 *
 * I do contract work in most languages, so let me solve your problems!
 *
 * Any questions please feel free to email me or put a issue up on the github repo
 * Version 0.0.7                                       Nathan@master-technology.com
 *********************************************************************************/
"use strict";

var os = require('os');
var crypto = require('crypto');
var fs = require('fs');

var x86FileHashes = {
    // These are the original NativeScript versions
    "d940a07169e73b593962b11f14c8513d220e7cbf": {version: "0.9.0", liveSync: false, upgrade: true},
    "f475ef124706a29fb597d855b4df536c5ae35730": {version: "1.0.0", liveSync: false, upgrade: true},
    "c7635ac8a9bd5a1ea8ab32ad2ec555f47625caaf": {version: "1.1.0", liveSync: false, upgrade: true},
	"7b4506c52b1f190b1d2c638dec30c54399ee61ff": {version: "1.2.0", liveSync: false, upgrade: true},
	"3d3fa7f7b7c56f0ecc92f06ff00c2755c946b309": {version: "1.2.1", liveSync: false, upgrade: true},
    "ba68d998e58c22d26baf6ae2b89236bad4f8fee1": {version: "1.3.0", liveSync: false, upgrade: true},
    "426e23d44e05ece7eb2b3585988aeb2f7f05dab0": {version: "1.4.0", liveSync: false, upgrade: true},
	"518424b4606617c1ec72e690b354ec36b40e0378": {version: "1.5.0", liveSync: false, upgrade: true},
    "9c8d4277ed27aa18651c120fc51ca21f536214bc": {version: "1.5.1", liveSync: false, upgrade: true},
    "8626559f5b1b041f428e074356c99d34c6bcfd01": {version: "1.6.0", liveSync: false, upgrade: true},
    "699f3a586beda68f47974802462373d6efb32b37": {version: "1.6.1", liveSync: false, upgrade: true},
    "097c0a2b0e311791a769264eed1a99c87fd4444b": {version: "1.6.2", liveSync: false, upgrade: true},
    "fbc0d79f972113fd91c36b7945cd759dc8c2fc58": {version: "1.6.3", liveSync: false, convert: true},
    

    // These are my Compiled versions
    "7323199e7b6475bd2c4dd2691857752b170fd2a6": {version: "1.0.0", liveSync: true, upgrade: true},
    "60607640311349f9899c50115abf9c25e0c0c9be": {version: "1.1.0", liveSync: true, upgrade: true},
	"405170e1b37558bd87ab37274e623a195391ac7f": {version: "1.2.0", liveSync: true, upgrade: true},
	"f28f4f6970198e22bc432b390f4625802c8479ac": {version: "1.2.1", liveSync: true, upgrade: true},
    "02b68ec7fd65ae6c3f2b7cff30219b271865fb20": {version: "1.3.0", liveSync: true, upgrade: true},
    "71fc37158ca8b1c928cc0fd4875906a75a75529c": {version: "1.4.0", liveSync: true, upgrade: true},
	"26c43529813f7edbfcb25fed948436945fb13f1c": {version: "1.5.0", liveSync: true, upgrade: true},
    "e3e1201f8dd720d985faa80a937f0a728bfd1f6a": {version: "1.5.1", liveSync: true, upgrade: true},
    "71ecdb85f9b5e4b74ed32d773c8a65dc2ad084d7": {version: "1.6.0", liveSync: true, upgrade: true},
    // There is no replacement 1.61 -- the changes were in a support file
    "32b60b901c9e9f4c4d9c198d6c5a249f55843d9e": {version: "1.6.2", liveSync: true}
    // There is no replacement 1.63 -- the changes were in tooling

};

var armFileHashes = {
    // These are the Original NativeScript Versions
    "d494826d6fb9aa96b93ea35a0471f75555c2c922": {version: "0.9.0", liveSync: false, upgrade: true },
    "5b4e521c8845aeeb63597f204c2fc5eed35023ff": {version: "1.0.0", liveSync: false, upgrade: true },
    "c2624393dbc4abedb97b04dfea30011dcc05f107": {version: "1.1.0", liveSync: false, upgrade: true },
	"d49323c3174a3f427474f57e9374b9ddad28a351": {version: "1.2.0", liveSync: false, upgrade: true },
	"dc0dd83e74fcf69b88728c702503b27b9f224271": {version: "1.2.1", liveSync: false, upgrade: true },
    "27e981ddb192a80d14e5721cbcfbff3a554a0dc4": {version: "1.3.0", liveSync: false, upgrade: true },
    "27c9d88460221247a14deb2537ec8b86d57a6697": {version: "1.4.0", liveSync: false, upgrade: true },
	"ff47458b14f904f085f8bf997433080bca5cdc0b": {version: "1.5.0", liveSync: false, upgrade: true },
    "d82cdcc1e3ab855d29f7982a86013dd5b5b7cae7": {version: "1.5.1", liveSync: false, upgrade: true },
    "9206130af063a096896ff16c583b140596ec48d0": {version: "1.6.0", liveSync: false, upgrade: true },
    "aeb7578f73417e09e07801055750638d44b318e5": {version: "1.6.1", liveSync: false, upgrade: true },
    "f19f9a079223fdab11859ed66fc6685086ae6db5": {version: "1.6.2", liveSync: false, upgrade: true },
    "70397add62eec836063339799851758d488428a5": {version: "1.6.3", liveSync: false, convert: true },

    // These are my Compiled Versions
    "13b37548e2680afc12665c4771cc1d0489f9c513": {version: "1.0.0", liveSync: true, upgrade: true },
    "f942519dec81124584d418d40eaefbb3860c2912": {version: "1.1.0", liveSync: true, upgrade: true },
	"9b42b4c7c8d891f344b83d4e1c44db6d43bff60b": {version: "1.2.0", liveSync: true, upgrade: true },
	"a2583bba4935bd2907cd32195d04b8724da27a67": {version: "1.2.1", liveSync: true, upgrade: true },
    "86e531fea63ceba8ca00e54934dcb03c9f91ec65": {version: "1.3.0", liveSync: true, upgrade: true },
    "979c32c71b21b07cf5a1b89d0facecb4a145bc70": {version: "1.4.0", liveSync: true, upgrade: true },
	"b4efc6afc73563ac5c203460d5fe5f353232a029": {version: "1.5.0", liveSync: true, upgrade: true },
    "2061ca1d607ea48b0430f8f0df2f754023176ba5": {version: "1.5.1", liveSync: true, upgrade: true },
    "0701ca963300d7c19591bb57ddb87c204a306fef": {version: "1.6.0", liveSync: true, upgrade: true },
    // There is no replacement 1.61 -- the changes were in a support file
    "b6030211a332585f7bf46ea148f24c63cad76026": {version: "1.6.2", liveSync: true }
    // There is no replacement 1.63 -- the changes were in tooling
};


var arm64FileHashes = {
    // These are the Original NativeScript Versions
    "613712082511cc5878858e327591a98e4c0a1c0a": {version: "1.6.0", liveSync: false, upgrade: true },
    "9325bd7aaaeaf402b734e9153e7491afff75f435": {version: "1.6.1", liveSync: false, upgrade: true },
    "7e46a5d9193a0ae70af3c62015e0b71b791704a7": {version: "1.6.2", liveSync: false, upgrade: true },
    "512e30be635732d5c502c92dfc3b7216fb6430e2": {version: "1.6.3", liveSync: false, convert: true },


    // These are my Compiled Versions
    "f89871f49ac56247cfba82017686297840723138": {version: "1.6.0", liveSync: true, upgrade: true },
    // There is no replacement 1.61 -- the changes were in a support file
    "995403ae1df0982a23395e0b43d70dce8941304b": {version: "1.6.2", liveSync: true }
    // There is no replacement 1.63 -- the changes were in tooling

};

function getVersion() {
    var key, version="0.0.0";
    for (key in x86FileHashes) {
        if (x86FileHashes.hasOwnProperty(key)) {
            if (version <  x86FileHashes[key].version) {
                version = x86FileHashes[key].version;
            }
        }
    }
    for (key in armFileHashes) {
        if (armFileHashes.hasOwnProperty(key)) {
            if (version <  armFileHashes[key].version) {
                version = armFileHashes[key].version;
            }
        }
    }

    for (key in arm64FileHashes) {
        if (arm64FileHashes.hasOwnProperty(key)) {
            if (version <  arm64FileHashes[key].version) {
                version = arm64FileHashes[key].version;
            }
        }
    }

    return version;
}

var currentVersion = getVersion();

if (fs.existsSync("../../platforms/android/libs/x86/libNativeScript.so") && !fs.existsSync("../../platforms/android/libs/jni/x86/libNativeScript.so")) {
    console.log("You are running a old version of the runtimes.  You need to upgrade your NativeScript platform to v1.30 or later.");
    process.exit(0);
} else {
    getFileSha("../../platforms/android/libs/jni/x86/libNativeScript.so", checkHash);
    getFileSha("../../platforms/android/libs/jni/armeabi-v7a/libNativeScript.so", checkHash);
    getFileSha("../../platforms/android/libs/jni/arm64-v8a/libNativeScript.so", checkHash);
}

function displayUpgrade(version) {
    console.error("---------------------------------------------------------------------------------------------------\n",
        "Your version (", version, ") of the Platform Android runtimes are outdated!\n The current version is: ",currentVersion,"  Please upgrade your runtimes by doing a:\n   >tns platform update android\n Then you need to redo the installation of this plugin\n   >tns plugin add nativescript-liveedit",
		"If upgrading is not a options, download this plugin tagged to your current runtimes. using the tag @ns" + version + "  to specify the specific version.",
        "\n---------------------------------------------------------------------------------------------------\n");
    process.exit(0);
}

var cnt = 0;
function checkHash(v) {
    cnt++;

    if (!armFileHashes[v] && !x86FileHashes[v] && !arm64FileHashes[v]) {
        console.error("---------------------------------------------------------------------------------------------------\n",
            "This version of LiveEdit does not support the version of the Android runtimes you have.\n This is probably because you have updated to a newer version of the NativeScript Android runtimes.\n","A new version of NativeScript-LiveEdit should be released shortly.",
            "\n---------------------------------------------------------------------------------------------------\n");
        process.exit(0);
    }
    var convert = false, liveSync = false;
    if (armFileHashes[v]) {
        if (armFileHashes[v].upgrade) {
            displayUpgrade(armFileHashes[v].version);
        }
        convert = !!armFileHashes[v].convert;
        liveSync = !!armFileHashes[v].liveSync;
    } else if (x86FileHashes[v]) {
        if (x86FileHashes[v].upgrade) {
            displayUpgrade(x86FileHashes[v].version);
        }
        convert = !!x86FileHashes[v].convert;
        liveSync = !!x86FileHashes[v].liveSync;
    } else {
        if (arm64FileHashes[v].upgrade) {
            displayUpgrade(arm64FileHashes[v].version);
        }
        convert = !!arm64FileHashes[v].convert;
        liveSync = !!arm64FileHashes[v].liveSync;
    }

    if (cnt >= 3) {
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
    if (convert) {
        copyFile("./platforms/android/libs/armeabi-v7a/libNativeScript.so", "../../platforms/android/libs/jni/armeabi-v7a/libNativeScript.so", true);
        copyFile("./platforms/android/libs/arm64-v8a/libNativeScript.so", "../../platforms/android/libs/jni/arm64-v8a/libNativeScript.so", true);
        copyFile("./platforms/android/libs/x86/libNativeScript.so", "../../platforms/android/libs/jni/x86/libNativeScript.so", true);
    }

    // Delete these files so that they don't end up in the compiled project,
    // the tns plugin command is simple stupid in that it copies everything to the platforms/.../tns_modules/nativescript-liveedit folder
    // However, later it cleans up after itself; but this is more of a precaution so that they files never end up in that folder.
    // In addition this eliminates TNS from attempting to make a include.gradle file automatically for no reason
    fs.unlinkSync("./platforms/android/libs/armeabi-v7a/libNativeScript.so");
    fs.unlinkSync("./platforms/android/libs/x86/libNativeScript.so");
    fs.unlinkSync("./platforms/android/libs/arm64-v8a/libNativeScript.so");
    fs.unlinkSync("./support/watcher.entities");
    fs.unlinkSync("./support/watcher.js");
    fs.unlinkSync("./support/.jshintrc");
    fs.unlinkSync("./support/postinstall.js");
    fs.rmdirSync("./platforms/android/libs/armeabi-v7a");
    fs.rmdirSync("./platforms/android/libs/x86");
    fs.rmdirSync("./platforms/android/libs/arm64-v8a");
    fs.rmdirSync("./platforms/android/libs");
    fs.rmdirSync("./platforms/android");
    fs.rmdirSync("./platforms");



    process.exit(0);
}


function getFileSha(filename, callback) {
    var shaSum = crypto.createHash('sha1');
    if (!fs.existsSync(filename)) {
        console.error("---------------------------------------------------------------------------------------------------\n",
            "Unable to find the Android Runtimes.  Please make sure that you have done a\n   >tns platform add android\n","Then re-run the adding of this plugin.",
            "\n---------------------------------------------------------------------------------------------------\n");
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

