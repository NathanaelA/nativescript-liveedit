# NativeScript Real Time LiveEdit Ability

A NativeScript module providing real time development for Android.   This version is for v1.7.x of the Android Runtimes.
Please note this project USED to be called NativeScript-LiveSync, but to eliminate the confusion between the Telerik LiveSync and my LiveSync, I decided to rename my project.

## License

All this code is (c)2015-2016 Master Technology.   This is released under the MIT License, meaning you are free to include this in any type of program -- However for entities that need a support, changes, enhancements and/or a commercial license please contact me (nathan@master-technology.com).

I do contract work; so if you have a module you want built for NativeScript (or pretty much any other language) feel free to contact me.

## Differences between Telerik LiveSync & Master Technology LiveEdit

Master Technology released the LiveEdit project in v1.00 of NativeScript; In the version v1.2.0 of the NativeScript command line tools; Telerik has now released a *limited* LiveSync (or what I consider a DeadSync command. :grinning: ).  The differences from my LiveEdit and Telerik's LiveSync is substantial enough that I will continue to use and maintain my version for the foreseeable future.
The good news is they are catching up, they have fixed several major issues in each release and as they release newer versions they get a lot closer in feature parity.

#### Pros of Telerik's LiveSync:
* No extra code added to your application!
* Works on iOS Devices & iOS Simulator 

#### Cons of Telerik's LiveSync:
* Not really Live.  It syncs the files; but then has to restart the application from scratch when changing anything but a CSS or XML file.
* Delays while it detects any changes and then deploys the changes.  
* Delays while it is re-launching Application.
* Loss of all application state since it reloads the app on every change.  
* If you navigated three screens deep, and make a JS file change; you will need to re-navigate to that screen again to see it.
* Incredibly slow LiveSync startup time. 
* Reset of the Application even if you change a file that isn't even being used.
* Easy to crash your application as the JavaScript and XML are not checked before being sent to the application.
* Doesn't apparently work on some Android devices...

#### Con's of Master Technology's LiveEdit:
* Until Telerik accepts the patch; you have to use the included patched runtime.  (Please vote up the [issue](https://github.com/NativeScript/android-runtime/pull/92))
* Small amount of JavaScript added code to your project.
* Only works on the Android platform, no iOS support. 

#### Pro's of Master Technology's LiveEdit:
* Live, You see the app change almost exactly when your editor saves the files.
* New files are detected and synced instantly.
* Application state is almost always fully maintained.  
* The screen you are working on only reloads ONLY if it is the code you just changed.
* Built in ability to detect errors in XML and JS before pushing to device to eliminate crashing the app on the device.
* Ability to only reload application on files that are singletons or other files that you would rather have the app reloaded for.
* Ability to restart application by touching or creating a "restart.livesync" or "restart.liveedit" file.
* Ability to sync fonts from the app/fonts folder
* Ability to sync standalone images png/jpg files
* Ability to run Tests instantly!
* Ability to auto-launch application if it crashed and is no longer running on device/emulator.

The iOS side is currently just a simple DUMMY WRAPPER so that any usage you use on the Android side will not cause any issues when you deploy to your iOS devices/emulator. 

## Real Time LiveEdit Demo

[![1st Video Showing off Real Time LiveEdit Development Ability](http://img.youtube.com/vi/cCiyJZexSOQ/0.jpg)](http://www.youtube.com/watch?v=cCiyJZexSOQ)
[![2nd Video Showing off Real Time LiveEdit Development Ability](http://img.youtube.com/vi/1p_4n9xBWZ0/0.jpg)](http://www.youtube.com/watch?v=1p_4n9xBWZ0)



## VERY IMPORTANT NOTES

This plugin includes the latest release runtimes WITH the liveedit patch included into it.  

If you want to compile the runtimes your self; you can clone the latest runtime; switch to the release branch, and then manually patch it with my above patch (pull request 92), and then install the runtime following the latest documentation. [http://docs.nativescript.org/running-latest](http://docs.nativescript.org/running-latest)

You can also run the latest nightly runtimes from [http://nativescript.rocks](http://nativescript.rocks), and the LiveEdit patch is auto-applied to the nightly master before it builds it.

Please note the watcher specifically does NOT watch the **App_Resources** folders, mainly because this folder must be built, as these are compiled resources.     
In addition the device code itself does not have any code to start watching any new folders when they are added; restarting the app will allow it to start watching it.  I have a billion other things on my list that affects me more.  So this is a very low priority to actually code it up, I would gladly take pull requests that fixes this, if you find this oversight too annoying.

I realize XMLLint is a pain to install on windows, so I have included all the needed files on the NativeScript.rocks site.
            
## Installation

### If Upgrading from a really old version
Delete the old app\node_modules\nativescript-livesync folder, as the new node_modules plugin folder is now located in the root folder.

### Upgrading from the prior versions
You need to de-install the prior version, then install the new version.
Run `tns plugin remove nativescript-livesync` then run `tns plugin add nativescript-liveedit`

### Prerequisites: 
Run `npm install jshint -g`

If you don't have xmllint already on your machine; you will need to install it. (Windows users: http://xmlsoft.org/sources/win32/)

### Installation NativeScript Command line Version 1.1.3+
Run `tns plugin add nativescript-liveedit`

## Usage & Running

On your development machine you need to open a command prompt to your main application folder; and type **node watcher** which will start the utility that handles verification and pushing new files to the devices or emulators.

To use the liveedit module you must first `require()` it in your application.

```js
var liveedit = require("nativescript-liveedit" );
```

You should as a minimum put this in your **app.js** like so:
```js
var application = require("application");

// ---- ADD THIS LINE ----
require('nativescript-liveedit');
// -----------------------

application.start({ moduleName: "main-page" });
```

Then this will activate at the start of the application and work for the entire time, also notice the removal of the "./" in the cssFile.   I'm not sure why Telerik put a ./ for the app.css as it is unneeded.

## Magic Restart Files
Changes in these files will automatically cause the application to restart on the device or emulator.
* app.js
* restart.livesync
* restart.liveedit
* Any other file you add via the **restartFile** command described below.


## Get the LiveEdit object
```var liveedit = require('nativescript-liveedit');```

### Methods

#### addModelPageLink(Page, Model)
##### Parameters
* Page - this is the page that the model is related too.
* Model - this is the model that relates to the page

#### ignoreFile(Page)
##### Parameters
* Page - this is the file to totally ignored for sending as updates.
You can call this multiple times and it will just add it to a list of files to ignore.

#### restartFile(Page)
##### Parameters
* Page - this is the file to cause the app on the client to restart.    
You can call this multiple times and it will just add it to a list of files to restart on.
By default, app.js, restart.liveedit and restart.livesync are in this list.

#### enabled(value) 
##### Parameters
* (no parameter) will return if it is enabled
* (value) - set it to be enabled (true) or disabled (false)

#### debugMode(value)
##### Parameters 
* (no Parameter) will return if it is running in debugMode 
* (value) - set it to be forced into or out of debugMode, rather than letting it use the detection method.

#### getAppName()
This will return the package name in the from the AndroidManifest

#### getAppVersion()
This will return the VersionName from inside the AndroidManifest

#### restart()
This will fully restart the application -

#### checkForEmulator()
This will check to see if the app is running on a emulator

#### checkForDebugMode()
This will check to see if the app was signed with a debug key (i.e. debug mode)

#### reloadPage()
This will reload the current page

#### isSuspended()
This will tell you if the application is suspended.  (i.e. some other app has focus)

#### currentAppPath()
This will return the current application path.
