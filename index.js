#!/usr/bin/env node

var exec = require('child_process').execFile
  , path = require('path')
  , fs = require('fs')

  , provisions = require('./src/provisions')

  , baseDir

  , confPath = process.argv[2]
  , conf

if(!confPath) {
	var executable = process.env.BUILD_EXEC || path.basename(process.argv[1])
	console.log('Use as: %s path/to/config.json', executable)
	process.exit(1)
}
conf = require(confPath)

baseDir = path.dirname(confPath)
process.chdir(baseDir)

// The list of jobs, in the order that they execute
var jobs =
    [ parseProvisions
    , installProvisions
    , addKeychain
    , unlockKeychain
    , buildTarget
    , createIpa
    , deploy
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

function createIpa(done) {
	var pool = fasync.pool()
	pool.on('empty', done)

	utils.recurMkdirSync(conf.deploy.output)

	fs.readDir(
	  path.join(
	    conf.build.output
	  , conf.build.configuration + '-iphoneos'
	, package
	)

	function package(err, filename) {
		if(!/\.app$/.test(filename)) {
			return
		}
		var ipaName = path.basename(filename) + '.ipa'
		  , output = path.join(conf.deploy.output, ipaName)

		exec(
		  'xcrun'
		, [ '-sdk'
		  , 'iphoneos'
		  , 'PackageApplication'
		  , '-v'
		  , path.join(baseDir, conf.build.output, filename)
		  , '-o'
		  , output
		  ]
		  , pool.register()
		)
	}
}

function deploy(done) {
	exec(conf.deploy.script, done)
}

function clean(done) {
	provisions.clean(conf.installedProvisions)
	done()
}
