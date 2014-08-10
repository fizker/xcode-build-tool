Xcode build tool
================

This is a command-line tool for executing a build of an Xcode project.

It is made with iOS development in mind, and have not been tested with Mac apps.


Required
--------

-   A Mac (nothing else can run Xcode anyway).
-   Xcode (I use this project myself against the newest stable Xcode. It might
    work against other versions as well).
-   [Node.js](https://nodejs.org): The scripting-environment that the advances
    stuff is done in.


How to use in node.js
---------------------

Start by installing it:

    npm install xcode-build-tool

Then add the following code:

    var xcode = require('xcode-build-tool')
    var buildResults = xcode.build(codeDir, config)

The `buildResults` object is a combination of a stream and a promise.

This means that you can interact with it in several ways. It emits several
events:

-   totalTasks: The number of tasks. This will be the same number as the
    `total` parameter of the message. This will be sent before the first
    task starts.
-   message: A high-level message sent when the next internal task is started.

    The message is an object of the following structure:

        { current: 5 // The current task number
        , total: 7 // The total number of tasks
        , message: 'Building target' // A line describing what is happening
        }

-   end: Sent when everything is completed.
-   data: Sent whenever something happens on one of the underlying stdout
    streams.

Being a `stream`, it also have a pipe-method. This is hooked up to the stdout of
the underlying processes like `xcodebuild`.

It also have a `.then` and `.catch` method so it is compatible with the
`Promise` spec. The `promise` is resolved slightly after the `end` event is
emitted.

See [index.js](https://github.com/fizker/xcode-build-tool/blob/master/index.js)
for an example of how to interact with the result object.


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

-   [mobileprovision-read](https://github.com/0xc010d/mobileprovision-read):
    The current version relies on this project. It has been bundled with this
    project for ease of installation.
