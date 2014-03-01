#!/usr/bin/env node

var path = require('path')

var log = console.log.bind(console)

var confPath = process.argv[2]

if(!confPath) {
	var executable = process.env.BUILD_EXEC || path.basename(process.argv[1])
	log('Use as: %s path/to/config.json', executable)
	process.exit(1)
}

var baseDir = path.dirname(confPath)

var conf = require(path.relative(__dirname, confPath))

var build = require('./src/build')

build(baseDir, conf)
	.catch(function(err) {
		if(typeof(err) == 'number') {
			process.exit(err)
		}
		throw err
	})
	.done()
