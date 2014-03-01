#!/usr/bin/env node

var exec = require('child_process').spawn
var path = require('path')
var fs = require('fs')
var fasync = require('fasync')

var utils = require('./src/utils')
var provisions = require('./src/provisions')

var baseDir

var confPath = process.argv[2]
var conf

var log = console.log.bind(console)

if(!confPath) {
	var executable = process.env.BUILD_EXEC || path.basename(process.argv[1])
	console.log('Use as: %s path/to/config.json', executable)
	process.exit(1)
}

conf = require(path.relative(__dirname, confPath))

if(!conf.products) {
	conf.products = [ conf.product ]
}

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
	var pool = fasync.pool()
	pool.on('empty', done)

	conf.products.forEach(function(product) {
		provisions.parse(product.provision, pool.register(function(err, parsedProvision) {
			product.parsedProvision = parsedProvision;
		}))
	})
}

function installProvisions(done) {
	log('Installing provisions')
	conf.products.forEach(function(product) {
		product.installedProvision = provisions.install(product.parsedProvision)
	})
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

function getAllConfigurations() {
	return Object.keys(conf.products.reduce(function(confs, product) {
		confs[product.configuration] = true
		return confs
	}, {}))
}

function buildTarget(done) {
	log('Building target')
	var targets = conf.products.slice()
	  , configurations = getAllConfigurations()
	configurations.forEach(function(conf) {
		targets.unshift({ configuration: conf, clean: true })
	})
	targets = targets.map(function(product) {
		return function(done) {
			utils.recurMkdirSync(conf.build.output)
			var args =
			[ '-configuration'
			  , product.configuration
			  , 'SYMROOT=' + path.resolve(conf.build.output)
			  , product.clean ? 'clean' : 'build'
			]
			if(product.target) {
				args.unshift('-target', product.target)
			}

			exec(
			  'xcodebuild'
			, args
			, { cwd: path.dirname(conf.project.path)
			  , stdio: 'inherit'
			  }
			)
				.on('error', done)
				.on('exit', function() {
					done()
				})
		}
	})
	fasync.waterfall(targets, done)
}

function createIpa(done) {
	var pool = fasync.pool()
	pool.on('empty', done)

	log('Creating IPA files')

	utils.recurMkdirSync(path.resolve(conf.deploy.output))

	fs.readdirSync(conf.build.output).forEach(function(dir) {
		var fullPath = path.join(conf.build.output, dir)
		if(!fs.statSync(fullPath).isDirectory()) {
			return
		}
		fs.readdirSync(fullPath).forEach(function(file) {
			package(path.join(fullPath, file))
		})
	})

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
		  , filename
		  , '-o'
		  , path.resolve(output)
		  ]
		, { stdio: 'inherit'
		  }
		)
			.on('exit', pool.register())
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
	conf.products.forEach(function(product) {
		provisions.clean(product.installedProvision)
	})
	done()
}
