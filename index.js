#!/usr/bin/env node

var exec = require('child_process').execFile
  , path = require('path')
  , fs = require('fs')

  , provisions = require('./src/provisions')

  , baseDir

  , conf

if(!process.argv[2]) {
	var executable = process.env.BUILD_EXEC || path.basename(process.argv[1])
	console.log('Use as: %s path/to/config.json', executable)
	process.exit(1)
}
conf = require(process.argv[2])

baseDir = path.dirname(conf.project.path)
process.chdir(baseDir)

var jobs =
    [ parseProvisions
    , installProvisions
    , addKeychain
    , unlockKeychain
    , buildTarget
    , clean
    ]
  , nextJob = 0

executeNextJob()

function executeNextJob(err) {
	if(jobs.length > nextJob) {
		jobs[nextJob++](executeNextJob)
	}
}

function parseProvisions(done) {
	provisions.parse(conf.provisions, function(err, parsedProvisions) {
		conf.parsedProvisions = parsedProvisions
		done()
	})
}

function installProvisions(done) {
	conf.installedProvisions = provisions.install(conf.parsedProvisions)
	done()
}

function addKeychain(done) {
	exec(
	  'security'
	, [ 'default-keychain'
	  , '-s'
	  , conf.keychain.path
	  ]
	, done
	)
}

function unlockKeychain(done) {
	exec(
	  'security'
	, [ 'unlock-keychain'
	  , '-p'
	  , conf.keychain.password
	  , conf.keychain.path
	  ]
	, done
	)
}

function buildTarget(done) {
	utils.recurMkdirSync(conf.build.output)
	exec(
	  'xcodebuild'
	, [ '-target'
	  , conf.build.target
	  , '-configuration'
	  , conf.build.configuration
	  , 'SYMROOT'
	  , conf.build.output
	  , 'clean'
	  , 'build'
	  ]
	, done
	)
}

function clean(done) {
	provisions.clean(conf.installedProvisions)
	done()
}
