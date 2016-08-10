/**********************************************************************************
 * (c) 2015, 2016 Master Technology
 * Licensed under the MIT license or contact me for a Support or Commercial License
 *
 * I do contract work in most languages, so let me solve your problems!
 *
 * Any questions please feel free to email me or put a issue up on the github repo
 * Version 0.1.4                                      Nathan@master-technology.com
 *********************************************************************************/
"use strict";

/* jshint node: true, browser: true, unused: true, undef: true */
/* global android, com, java, javax, __clearRequireCachedItem, unescape, __runtimeVersion */

// --------------------------------------------
var fs = require("file-system");
var fsa = require("file-system/file-system-access").FileSystemAccess;
var application = require('application');
var frameCommon = require('ui/frame/frame-common');
var styleScope = require("ui/styling/style-scope");
var fileResolver = require("file-system/file-name-resolver");
var page = require('ui/page').Page;
// --------------------------------------------
var FSA = new fsa();
// --------------------------------------------

var LiveEditSingleton = null;

var LiveEdit = function() {
    if (LiveEditSingleton) {
        return LiveEditSingleton;
    }
    LiveEditSingleton = this;

    this._modelLink = {};
    this._appName = null;
    this._appVersion = null;
    this._currentVersion = null;
    this._observers = [];
    this._isDebugMode = null;
    this._updaterEnabled = true;
    this._ignoredPages = [];
    this._restartPages = ["app.js", "package.json", "restart.livesync", "restart.liveedit"];
    this._supportFiles = {};

    this._applicationResumedStatus = 0;
    this._suspendedNavigation = null;
    this._curAppPath = '';
    this._tmpWatchPath = '';

    this._startLiveEdit();

};


LiveEdit.prototype._startLiveEdit = function() {
    if (!application.android.context) {
        if (typeof __runtimeVersion === "undefined" || __runtimeVersion === "1.6.0") {
            var self = this;
            setTimeout(function () {
                self._startLiveEdit();
            }, 500);
            return;
        }
    }
    this._curAppPath = fs.knownFolders.currentApp().path + "/";

    if (this.checkForReleaseMode()) {
        // We don't do anything in a released application
        return;
    }

    // Some un-rooted Android devices have issues pushing into the /data/data folder, so use the
    // adb writable /data/local/tmp folder as a transfer mechanism.
    this._tmpWatchPath = "/data/local/tmp/" + this.getAppName();
    try {
        var javaFile = new java.io.File(this._tmpWatchPath);
        if (!javaFile.exists()) {
            javaFile.mkdirs();
            javaFile.setReadable(true, false);
            javaFile.setWritable(true, false);
            javaFile.setExecutable(true, false);
        }
    } catch (err) {
        console.log("LiveEdit: Error attempting to create tmpWatch folder", err);
    }


    this._hookFramework();
    this._startObservers();
};

/**
 * Returns debugMode status, or allows you to set it.
 * @param value - true/false or no value.
 * @returns {*} - debug mode status.
 */
LiveEdit.prototype.debugMode = function(value) {
    if (arguments.length) {
        this._isDebugMode = !!value;
    } else if (this._isDebugMode === null) {
        return this.checkForDebugMode();
    }
    return this._isDebugMode;
};

/**
 * Allow you to enable/disable the instant update support
 * @param value - true or false
 * @returns {boolean} the current enabled status
 */
LiveEdit.prototype.enabled = function(value) {
    if (arguments.length) {
        this._updaterEnabled = !!value;
    }
    return this._updaterEnabled;
};

LiveEdit.prototype.getContext = function() {
    if (application.android.context) {
        return (application.android.context);
    }
    var ctx = java.lang.Class.forName("android.app.AppGlobals").getMethod("getInitialApplication", null).invoke(null, null);
    if (ctx) return ctx;

    ctx = java.lang.Class.forName("android.app.ActivityThread").getMethod("currentApplication", null).invoke(null, null);
    return ctx;
};

/**
 * Retrieves the App name from the AndroidManifest
 * @returns {string} - Name of App
 */
LiveEdit.prototype.getAppName = function() {
    if (!this._appName) {
        this._appName = this.getContext().getPackageName();
    }
    return this._appName;
};

/**
 * Retrieves the app Version from the AndroidManifest
 * @returns App Version
 */
LiveEdit.prototype.getAppVersion = function() {
    if (!this._appVersion) {
        var packageManager = this.getContext().getPackageManager();
        //noinspection JSUnresolvedVariable
        this._appVersion = packageManager.getPackageInfo(this.getContext().getPackageName(), 0).versionName;
    }
    return this._appVersion;
};

/**
 * Restart the application
 */
LiveEdit.prototype.restart = function() {
    var mStartActivity = new android.content.Intent(this.getContext(), com.tns.NativeScriptActivity.class);
    var mPendingIntentId = parseInt(Math.random()*100000,10);
    var mPendingIntent = android.app.PendingIntent.getActivity(this.getContext(), mPendingIntentId, mStartActivity, android.app.PendingIntent.FLAG_CANCEL_CURRENT);
    var mgr = this.getContext().getSystemService(android.content.Context.ALARM_SERVICE);
    mgr.set(android.app.AlarmManager.RTC, java.lang.System.currentTimeMillis() + 100, mPendingIntent);
    android.os.Process.killProcess(android.os.Process.myPid());
};

/**
 * Returns true if the application is running on a emulator
 * @returns {boolean}
 */
LiveEdit.prototype.checkForEmulator = function() {
    var res = android.os.Build.FINGERPRINT;
    return res.indexOf("generic") !== -1;
};

/**
 * Returns a list of application signatures
 * @returns {Array} - signature array
 */
LiveEdit.prototype.getAppSignatures = function() {
    try {
        var packageManager = this.getContext().getPackageManager();

        // GET_SIGNATURES = 64
        return packageManager.getPackageInfo(this.getContext().getPackageName(), 64).signatures;
    } catch (err) {
        return [];
    }
};

/**
 * Returns true if the application was signed with a DebugKey meaning the app is in debug mode
 * @returns {boolean} - false if it is in release mode
 */
LiveEdit.prototype.checkForDebugMode = function() {
    var DEBUG_PRINCIPAL = new javax.security.auth.x500.X500Principal("CN=Android Debug,O=Android,C=US");
    try
    {
        var signatures = this.getAppSignatures();
        var cf = java.security.cert.CertificateFactory.getInstance("X.509");
        for ( var i = 0; i < signatures.length;i++)
        {
            // Convert back into a Certificate
            var stream = new java.io.ByteArrayInputStream(signatures[i].toByteArray());
            var cert = cf.generateCertificate(stream);

            // Get the Principal for the signing Signature
            var SigningPrincipal = cert.getSubjectX500Principal();
            if (SigningPrincipal.equals(DEBUG_PRINCIPAL)) {
                this._isDebugMode = true;
                return true;
            }
        }
        this._isDebugMode = false;
    }
    catch (err)
    {
    }
    return false;
};

/**
 * Returns true if this application is signed by a release key
 * @returns {boolean} - false if the app is in debug mode
 */
LiveEdit.prototype.checkForReleaseMode = function() {
    return !this.checkForDebugMode();
};

/**
 * Reload the current page
 * @param p - optional page name to reload
 */
LiveEdit.prototype.reloadPage = function(p) {
    reloadPage(p);
};

/**
 * Is the application suspended
 * @returns {boolean} - true/false
 */
LiveEdit.prototype.isSuspended = function() {
    return this._applicationResumedStatus === 0;
};

/**
 * This allows you to link a type of file to a page; to force it to reload if the support file changes...
 * @param page
 * @param fileName
 */
LiveEdit.prototype.addSupportReloads = function(page, fileName) {
    if (fileName === undefined || fileName === null || fileName.length === 0) { return; }
    if (fileName[0] === '*' && fileName[1] === '.') {
        fileName = fileName.substr(1);
    }

    if (page.endsWith('.js')) {
        page = page.substring(0, page.length-3);
    }

    // We only allow a file or and extension to be assigned to ONE page
    this._supportFiles[fileName] = page;
};
/**
 * This allows you to link model(s) to a specific page
 * @param page  - the page that uses this model
 * @param model - the model that is linked to the page
 */
LiveEdit.prototype.addModelPageLink = function(page, model) {
    if (!model.endsWith('.js')) {
        model = model + ".js";
    }
    if (page.endsWith('.js')) {
        page = page.substring(0, page.length-3);
    }
    if (typeof this._modelLink[model] === "undefined") {
        this._modelLink[model] = page;
        return;
    } else if (!Array.isArray(this._modelLink[model])) {
        if (this._modelLink[model] === page) {
            return;
        }
        // Convert to an array if it is already assigned a page
        this._modelLink[model] = [this._modelLink[model]];
    }

    var found = false;
    for (var i=0;i<this._modelLink[model].length;i++) {
        if (this._modelLink[model][i] === page) {
            found = true; break;
        }
    }
    if (!found) {
        this._modelLink[model].push(page);
    }
};

/**
 * Ignores files from being updated
 * @param page
 */
LiveEdit.prototype.ignoreFile = LiveEdit.prototype.addIgnoreFile = function(page) {
    this._ignoredPages.push(page);
};

/**
 * These files cause the whole application to restart
 * @param page
 */
LiveEdit.prototype.restartFile = LiveEdit.prototype.addRestartFile = function(page) {
    this._restartPages.push(page);
};


/**
 * Returns the current Application Running path
 * @returns {string}
 */
LiveEdit.prototype.currentAppPath = function() {
    return this._curAppPath;
};



/**********************************/
/******  Internal Functions  ******/
/**********************************/
// We need to track the Modal Information
var modalInfo = {liveClose: false, params: null, pageName: ''};

/**
 * Used to hook into the framework functions
 * @private
 */
LiveEdit.prototype._hookFramework = function() {
    // Have to hook into the framework so that we can return our values if need be.
    if (!global.__clearRequireCachedItem) {
        this._updaterEnabled = false;
        global.__clearRequireCachedItem = function () {
            console.error("************************************************************************************************");
            console.error("****************** You need to be running a patched version of the android runtime, restarting!");
            console.error("************************************************************************************************");
            LiveEditSingleton.restart();
        };
        console.error("*****************************************************************************************************");
        console.error("*********** You need to be running a patched version of the android runtime, we will restart instead!");
        console.error("*****************************************************************************************************");

    }

    //noinspection JSValidateTypes
    //application.loadCss = loadCss;


    // We need to hook the Resume/Suspend Application events because attempting to navigate while suspended will crash
    application.on(application.suspendEvent, function () {
        LiveEditSingleton._applicationSuspended();
    });

    application.on(application.resumeEvent, function () {
        LiveEditSingleton._applicationResumed();
    });

    page.prototype.__showModal = page.prototype.showModal;
    page.prototype.showModal = function(pageName) {
        var args = Array.prototype.slice.call(arguments);
        if (args.length >= 3) {
            var callback = arguments[2];
            args[2] = function() {
                if (!callback) { return; }
                if (!modalInfo.liveClose) {
                    callback.apply(undefined,arguments);
                }
            };
        }
        this.__showModal.apply(this, args);
        if (!pageName && frameCommon.topmost().currentEntry) {
            pageName = frameCommon.topmost().currentEntry.entry.moduleName;
        }
        modalInfo.pageName = pageName;
        modalInfo.params = Array.prototype.slice.call(arguments);
        modalInfo.liveClose = false;


    };

    // TODO: This doesn't work properly in v1.10 and before -- test to see if this will work in v1.20 of runtimes;
    // TODO: If this still doesn't work in v1.20 we might need to make a patch.  :-)
    /*    application.on(application.uncaughtErrorEvent, function (args) {
     if (args.android) {
     // For Android applications, args.android is an NativeScriptError.
     console.log("!------------- NativeScriptError: " + args.android);
     } else if (args.ios) {
     // For iOS applications, args.ios is NativeScriptError.
     console.log("NativeScriptError: " + args.ios);
     }
     else {
     console.log("!------------- NSE:", args);
     }
     }); */


};

/**
 * Used to track any pages for navigation while the app is suspended
 * @param value - page name
 * @returns {string} - page name
 * @private
 */
LiveEdit.prototype._suspendedNavigate = function(value, isModal) {
    if (arguments.length) {
        this._suspendedNavigation = [value, isModal];
    }
    return this._suspendedNavigation;
};

/**
 * Used to track if the app is suspended
 * @private
 */
LiveEdit.prototype._applicationSuspended = function() {
    this._applicationResumedStatus--;
};

/**
 * Used to track when the app is resumed
 * @private
 */
LiveEdit.prototype._applicationResumed = function() {
    this._applicationResumedStatus++;
    if (this._suspendedNavigation) {
        reloadPage(this._suspendedNavigation[0], this._suspendedNavigation[1]);
        this._suspendedNavigation = null;
    }
};

/**
 * Checks if the modified file is related to the currently loaded page
 * @param v
 * @private
 */
LiveEdit.prototype._checkCurrentPage = function(v) {
    var f = frameCommon.topmost(), i;
    var CE, CEjs, CExml, CEcss, isModal=false;
    if (f.currentEntry) {
        if (f.currentEntry.moduleName) {
            CE = f.currentEntry.moduleName;
        } else if (f.currentEntry.entry) {
            CE = f.currentEntry.entry.moduleName;
        }
    }


    for (i=0;i<this._restartPages.length;i++) {
        if (v === this._restartPages[i]) {
            this.restart();
            return;
        }
    }

    if (!CE) {
        return;
    }

    for (i=0;i<this._ignoredPages.length;i++) {
        if (v === this._ignoredPages[i]) {
            return;
        }
    }

    if (frameCommon.topmost().currentPage.modal) {
        isModal = true;
        CE = modalInfo.pageName;
    }

    if (!CE) {
        return;
    }


    if (CE.toLowerCase().endsWith('.js') || CE.toLowerCase().endsWith('.xml')) {
        CE = CE.substr(0, CE.lastIndexOf('.'));
    }
    CEjs = CE + '.js';
    CExml = CE + '.xml';
    CEcss = CE + '.css';
    // console.log("******************* Checking ", v, "against:", CEjs, CExml, CEcss);

    if (v === CEjs || v === CExml) {
        reloadPage(CE, isModal);
    } else if (v === application.cssFile || "./"+v === application.cssFile) {
        loadCss();
    } else if (v === CEcss) {
        loadPageCss(CEcss);
    } else {
        if (v.endsWith('.js')) {
            __clearRequireCachedItem(this._curAppPath + v);
            if (fileResolver.clearCache) {
                fileResolver.clearCache();
            }
            for (var key in this._modelLink) {
                if (this._modelLink.hasOwnProperty(key)) {
                    if (key === v) {
                        if (Array.isArray(this._modelLink[key])) {
                            for (var j = 0; j < this._modelLink[key].length; j++) {
                                if (this._modelLink[key][j] === CE) {
                                    reloadPage(CE);
                                    return;
                                }
                            }
                        } else if (this._modelLink[key] === CE) {
                            reloadPage(CE);
                        }
                        return;
                    }
                }
            }
        } else {
            if (this._supportFiles[v] === CE) {
                reloadPage(CE);
            } else {
                var idx = v.lastIndexOf('.');
                if (idx >= 0) {
                    if (this._supportFiles[v.substr(idx)] === CE) {
                        reloadPage(CE);
                    }
                }
            }
        }
    }
};




/**
 * This Starts the Observers for the Update Folders
 * @private
 */
LiveEdit.prototype._startObservers = function() {
    var self = this;
    var FO = android.os.FileObserver.extend({
        FOPath: "",
        LastPage: "",
        LastTime: 0,
        onEvent: function (event, path) {
            var curTime = Date.now();
            if (this.LastPage === path) {
                if (this.LastTime + 500 > curTime) {
                    this.LastTime = curTime;
                    return;
                }
            }
            this.LastPage = path;
            this.LastTime = curTime;

            if (self._updaterEnabled) {
                var curFile;
                if (this.FOPath.indexOf("/data/local/tmp/") === 0) {
                    curFile = new java.io.File(this.FOPath + path);
                } else {
                    curFile = new java.io.File(self._curAppPath + this.FOPath + path);
                }
                var curLength = curFile.length();
                //console.log("!----- Event", event, this.FOPath + path, curFile.exists());
                var selfFO = this;

                var checkFunction = function() {
                    setTimeout(function () {
                        var newLength = curFile.length();
                        if (newLength !== curLength) {
                            curLength = newLength;
                            checkFunction();
                            return;
                        }
                        if (selfFO.FOPath.indexOf("/data/local/tmp/") === 0) {
                            self._moveSecondaryFile(selfFO.FOPath, path);
                            return;
                        }

                        self._checkCurrentPage(selfFO.FOPath + path);
                    }, 250);
                };
                checkFunction();
            }
        }
    });

    this._startDirectoryObservers(this._curAppPath, "", FO);
    this._startDirectoryObservers("", this._tmpWatchPath + "/", FO);
};

LiveEdit.prototype._moveFile = function(src, dest) {

    var path = dest.substr(0, dest.lastIndexOf('/') + 1);
    var javaFile;

    try {
        javaFile = new java.io.File(path);
        if (!javaFile.exists()) {
            javaFile.mkdirs();
            javaFile.setReadable(true);
            javaFile.setWritable(true);
        }
    }
    catch (err) {
        console.info("LiveEdit - MoveFile - Creating File Folder Error", err);
    }

    var srcFile = new java.io.File(src);
    var destFile = new java.io.File(dest);
    if (srcFile.renameTo(destFile)) {
        // Move was successful
        return true;
    }


    var myInput = new java.io.FileInputStream(src);
    var myOutput = new java.io.FileOutputStream(dest);


    var success = true;
    try {
        //transfer bytes from the inputfile to the outputfile
        var buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.class.getField("TYPE").get(null), 1024);
        var length;
        while ((length = myInput.read(buffer)) > 0) {
            myOutput.write(buffer, 0, length);
        }
    }
    catch (err) {
        success = false;
    }

    //Close the streams
    myOutput.flush();
    myOutput.close();
    myOutput = null;
    myInput.close();
    myInput = null;

    if (srcFile.exists()) {
        srcFile.delete();
    }
    return success;
};

LiveEdit.prototype._moveSecondaryFile = function(srcPath, filePath) {
    var newFile = unescape(filePath);
    var javaFile = new java.io.File(srcPath+filePath);
    if (!javaFile.exists()) {
        return;
    }
    if (newFile.endsWith(".css") || newFile.endsWith(".js") || newFile.endsWith(".xml") || newFile.endsWith(".ttf") || newFile.endsWith(".livesync") || newFile.endsWith('.json') || newFile.endsWith('.png') || newFile.endsWith('.jpg') || newFile.endsWith(".liveedit")) {
        this._moveFile(srcPath+filePath, this._curAppPath+newFile);
    } else {
        // We don't keep any tmp/ non related files.
        javaFile.delete();
    }
};

/**
 * Since the Android Observer is broken, we have to traverse each folder ourselves and setup its own Observer
 * @param basePath
 * @param relPath
 * @param FileObserver
 * @private
 */
LiveEdit.prototype._startDirectoryObservers = function(basePath, relPath, FileObserver) {

    var fullPath = basePath + relPath;

    var flags = 386 + 8;      // CREATE = 256, MODIFY = 2, MOVED_TO = 128 = (256 | 2 | 128) = 386
    var observer = new FileObserver(fullPath, flags);
    observer.FOPath = relPath;
    observer.startWatching();
    this._observers.push(observer);

    var javaFile = new java.io.File(fullPath);

    if (!javaFile.canRead()) { // Security issue
        return;
    }

    var filesList = javaFile.listFiles();
    if (!filesList || !filesList.length || basePath.length === 0) {  // Probably Security Issue, but lets not crash if we don't get a filesList
        return;
    }

    for (var i=0;i<filesList.length;i++) {
        if (filesList[i].isDirectory()) {
            var curName = filesList[i].getName();
            // Skip node_modules & tns_module folders as we don't need to monitor them
            if (curName === "node_modules" || curName === "tns_modules") { continue; }
            var dir = relPath + curName + "/";
            this._startDirectoryObservers(basePath, dir, FileObserver);
        }
    }
};


// ---------------------------------------------------------------
// Create our UpdaterSingleton and assign it to the export
// ---------------------------------------------------------------
LiveEditSingleton = new LiveEdit();
module.exports = LiveEditSingleton;

/**
 * This is the loadCss helper function to replace the one on Application
 */
function loadCss() {
    var cssFileName = fs.path.join(fs.knownFolders.currentApp().path, application.cssFile);

    var applicationCss;
    if (FSA.fileExists(cssFileName)) {
        applicationCss = FSA.readText(cssFileName);
        //noinspection JSUnusedAssignment
        application.cssSelectorsCache = styleScope.StyleScope.createSelectorsFromCss(applicationCss, cssFileName);

        // Add New CSS to Current Page
        var f = frameCommon.topmost();
        if (f && f.currentPage) {
            f.currentPage._resetCssValues();
            f.currentPage._styleScope = new styleScope.StyleScope();
            //noinspection JSUnusedAssignment
            f.currentPage._addCssInternal(applicationCss, cssFileName);
            f.currentPage._refreshCss();
        }
    }
}

/**
 * Override a single page's css
 * @param cssFile
 */
function loadPageCss(cssFile) {
    var cssFileName;

    // Eliminate the ./ on the file if present so that we can add the full path
    if (cssFile.startsWith("./")) {
        cssFile = cssFile.substring(2);
    }

    if (cssFile.startsWith(LiveEditSingleton.currentAppPath())) {
        cssFileName = cssFile;
    } else {
        cssFileName = fs.path.join(LiveEditSingleton.currentAppPath(), cssFile);
    }

    var applicationCss;
    if (FSA.fileExists(cssFileName)) {
        applicationCss = FSA.readText(cssFileName);

        // Add New CSS to Current Page
        var f = frameCommon.topmost();
        if (f && f.currentPage) {
            f.currentPage._resetCssValues();
            f.currentPage._styleScope = new styleScope.StyleScope();
            //noinspection JSUnusedAssignment
            f.currentPage._addCssInternal(applicationCss, cssFileName);
            f.currentPage._refreshCss();
        }
    }
}

function reloadModal(page) {
    var ext = "";
    if (!page.endsWith(".xml") && !page.endsWith(".js")) {
        ext = ".js";
    }

    __clearRequireCachedItem(LiveEditSingleton.currentAppPath() + page + ext);
    if (fileResolver.clearCache) {
        fileResolver.clearCache();
    }

    var curPage = frameCommon.topmost().currentPage;
    var curModal = curPage.modal;
    modalInfo.liveClose = true;
    curModal.closeModal();
    curPage.showModal.apply(curPage, modalInfo.params);
}


/**
 * This is a helper function to reload the current page
 * @param page
 */
function reloadPage(page, isModal) {

    if (!LiveEditSingleton.enabled()) {
        return;
    }

    var t = frameCommon.topmost();
    if (!t) {
        return;
    }

    if (!page) {
        if (!t.currentEntry || !t.currentEntry.entry) {
            return;
        }
        page = t.currentEntry.entry.moduleName;
        if (!page) {
            return;
        }
    }

    if (LiveEditSingleton.isSuspended()) {
        LiveEditSingleton._suspendedNavigate(page, isModal);
        return;
    }

    if (isModal) {
        reloadModal(page);
        return;
    }

    var ext = "";
    if (!page.endsWith(".js") && !page.endsWith(".xml")) {
        ext = ".js";
    }

    var nextPage;
    if (t._currentEntry && t._currentEntry.entry) {
        nextPage = t._currentEntry.entry;
        nextPage.animated = false;
    } else {
        nextPage = {moduleName: page, animated: false};
    }
    if (!nextPage.context) {
        nextPage.context = {};
    }

    if (t._currentEntry && t._currentEntry.create) {
        nextPage.create = t._currentEntry.create;
    }
    nextPage.context.liveSync = true;
    nextPage.context.liveEdit = true;

    // Disable it in the backstack
    //nextPage.backstackVisible = false;

    // Attempt to Go back, so that this is the one left in the queue
    if (t.canGoBack()) {
        //t._popFromFrameStack();
        t.goBack();
    } else {
        nextPage.clearHistory = true;
    }



    // This should be before we navigate so that it is removed from the cache just before
    // In case the goBack goes to the same page; we want it to return to the prior version in the cache; then
    // we clear it so that we go to a new version.

    __clearRequireCachedItem(LiveEditSingleton.currentAppPath() + page + ext);
    __clearRequireCachedItem(LiveEditSingleton.currentAppPath() + "*" + LiveEditSingleton.currentAppPath() + page);

    if (fileResolver.clearCache) {
        fileResolver.clearCache();
    }

    // Navigate back to this page
    try {
        t.navigate(nextPage);
    }
    catch (err) {
        console.log(err);
    }
}



