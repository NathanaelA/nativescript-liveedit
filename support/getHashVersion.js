#!/usr/bin/env node
/**********************************************************************************
 * (c) 2015, Master Technology
 * Licensed under the MIT license or contact me for a Support or Commercial License
 *
 * I do contract work in most languages, so let me solve your problems!
 *
 * Any questions please feel free to email me or put a issue up on the github repo
 * Version 0.0.1                                      Nathan@master-technology.com
 *********************************************************************************/
"use strict";

var os = require('os');
var crypto = require('crypto');
var fs = require('fs');


if (process.argv.length <= 2) {
    console.log("Need to pass the file to HASH");
    process.exit(0);
}

getFileSha(process.argv[2], checkHash);


function checkHash(v) {
    console.log("Hash is: ", v);

}


function getFileSha(filename, callback) {
    var shaSum = crypto.createHash('sha1');
    if (!fs.existsSync(filename)) {
        console.log("Missing File:", filename);
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

