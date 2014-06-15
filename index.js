#!/usr/bin/env node

var Q = require('q')
var child_process = require('child_process')
var path = require('path')

var log = console.log.bind(console)

var build = require('./src/build')

if(require.main !== module) {
	module.exports = {
		build: build,
	}
	return
}

var confPath = process.argv[2]

if(!confPath) {
	var executable = process.env.BUILD_EXEC || path.basename(process.argv[1])
	log('Use as: %s path/to/config.json', executable)
	process.exit(1)
}

var baseDir = path.dirname(confPath)

var conf = require(path.relative(__dirname, confPath))

var result = build(baseDir, conf)

// Setting up the stdout pipe for detailed text
result.pipe(process.stdout)

// Outputting the messages when they arrive
result.on('message', function(msg) {
	console.log('%s/%s: %s', msg.current, msg.total, msg.message)
})

// Hooking up to the promise for finishing up and catching errors
Q(result)
	.then(function() {
		// Execute the install script
		var deferred = Q.defer()

		child_process.spawn(conf.deploy.script, [], { stdio: 'inherit' })
			.on('error', deferred.reject)
			.on('exit', deferred.makeNodeResolver())

		return deferred.promise
	})
	.catch(function(err) {
		if(typeof(err) == 'number') {
			process.exit(err)
		}
		throw err
	})
	.done()
