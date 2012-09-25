Xcode build tool
================

This is a command-line tool for executing a build of an Xcode project.

It is made with iOS development in mind, and have not been tested with Mac apps.


Required
--------

-   A Mac (nothing else can run Xcode anyway).
-   Xcode (tested against Xcode 4.5 only).
-   [Node.js](https://nodejs.org): The scripting-environment that the advances
    stuff is done in.
-   [mobileprovisionParser](https://github.com/sharpland/mobileprovisionParser):
    Used for parsing mobile-provisions for essential data. It should be
    installed in the path.


Why use Node.js and not bash?
-----------------------------

I did the original test in bash only, but stopped when I wanted it to be an
external project. Since many of the values used is dependent on the current
version of the code, it would be prudent to keep this in the repository along
with the code.

A bash-script that calls the build-script could do this as well, of course, but
I like a static configuration-file more than a collection of scripts.

Oh, and I am much more confident in javascript than bash-scripting, which is an
even better reason :).


Credits
-------

-   [mobileprovisionParser](https://github.com/sharpland/mobileprovisionParser):
    The original test-version relies on this project. It should be installed in
    the path.
