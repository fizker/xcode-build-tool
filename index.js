#!/usr/bin/env node

var exec = require('child_process').spawn
  , path = require('path')
  , fs = require('fs')
  , fasync = require('fasync')

  , utils = require('./src/utils')
  , provisions = require('./src/provisions')

  , baseDir

  , confPath = process.argv[2]
  , conf

  , log = console.log.bind(console)

if(!confPath) {
	var executable = process.env.BUILD_EXEC || path.basename(process.argv[1])
	console.log('Use as: %s path/to/config.json', executable)
	process.exit(1)
}

conf = require(path.relative(__dirname, confPath))

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
	if(err) {
		if(typeof(err) == 'number') {
			process.exit(err)
		}
		log(jobs[nextJob-1].name)
		throw err
	}

	if(jobs.length > nextJob) {
		jobs[nextJob++](executeNextJob)
	}
}

function parseProvisions(done) {
	log('Parsing provisions')
	provisions.parse(conf.provisions, function(err, parsedProvisions) {
		conf.parsedProvisions = parsedProvisions
		done(err)
	})
}

function installProvisions(done) {
	log('Installing provisions')
	conf.installedProvisions = provisions.install(conf.parsedProvisions)
	done()
}

function addKeychain(done) {
	log('Adding keychain: %s', path.resolve(conf.keychain.path))
	exec(
	  'security'
	, [ 'list-keychains'
	  , '-s'
	  , path.resolve(conf.keychain.path)
	  ]
	, { stdio: 'inherit'
	  }
	)
		.on('exit', done)
}

function unlockKeychain(done) {
	log('Unlocking keychain')
	exec(
	  'security'
	, [ 'unlock-keychain'
	  , '-p'
	  , conf.keychain.password
	  , path.resolve(conf.keychain.path)
	  ]
	, { stdio: 'inherit'
	  }
	)
		.on('exit', done)
}

function buildTarget(done) {
	log('Building target')
	utils.recurMkdirSync(conf.build.output)
	exec(
	  'xcodebuild'
	, [ '-target'
	  , conf.build.target
	  , '-configuration'
	  , conf.build.configuration
	  , 'SYMROOT=' + path.resolve(conf.build.output)
	  , 'clean'
	  , 'build'
	  ]
	, { cwd: path.dirname(conf.project.path)
	  , stdio: 'inherit'
	  }
	)
		.on('exit', done)
}

function createIpa(done) {
	var pool = fasync.pool()
	  , appDirectory =
	    path.join(
	      conf.build.output
	    , conf.build.configuration + '-iphoneos'
	    )
	pool.on('empty', done)

	log('Creating IPA files')

	utils.recurMkdirSync(path.resolve(conf.deploy.output))

	fs.readdir(appDirectory, function(err, files) { files.forEach(package) })

	function package(filename) {
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
		  , path.join(appDirectory, filename)
		  , '-o'
		  , path.resolve(output)
		  ]
		, { stdio: 'inherit'
		  }
		)
			.on('exit', done)
	}
}

function deploy(done) {
	log('Calling deploy script')
	exec(
	  conf.deploy.script
	, [
	  ]
	, { stdio: 'inherit'
	  }
	)
		.on('exit', done)
}

function clean(done) {
	log('Cleaning after ourselves')
	provisions.clean(conf.installedProvisions)
	done()
}
