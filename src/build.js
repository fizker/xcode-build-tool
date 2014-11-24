var Q = require('q')
var child_process = require('child_process')
var path = require('path')
var fs = require('fs')
var readdir = Q.denodeify(fs.readdir)
var through = require('through')
var format = require('util').format
var stream = require('readable-stream')
var mkdirp = Q.denodeify(require('mkdirp'))
var rimraf = Q.denodeify(require('rimraf'))

var utils = require('./utils')
var provisions = require('./provisions')

var log = console.log.bind(console)

module.exports = function build(baseDir, conf) {
	if(!conf.products) {
		conf.products = [ conf.product ]
	}

	conf.products = conf.products.map(function(product) {
		if(typeof(product) == 'string') {
			product = { target: product }
		}

		return product
	})

	process.chdir(baseDir)

	var currentTask = 0
	function log(msg) {
		msg = format.apply(null, arguments)
		var obj = {
			current: currentTask,
			total: tasks.length,
			message: msg,
		}
		result.emit('message', obj)
	}

	// The list of jobs, in the order that they execute
	var tasks = [
		parseProvisions,
		installProvisions,
		addKeychain,
		unlockKeychain,
		buildTarget,
		createIpa,
		clean,
	]
	var allTasks = Q.defer()

	tasks.reduce(function(promise, task) {
		return promise
			.then(function() {
				currentTask++
			})
			.then(task)
	}, Q().then(function() {
		result.emit('totalTasks', tasks.length)
	}))
		.then(function() {
			result.push(null)
		})
		.then(allTasks.resolve, allTasks.reject)

	var result = new stream.Readable({ objectMode: false })
	result.then = allTasks.promise.then.bind(allTasks.promise)
	result.catch = allTasks.promise.catch.bind(allTasks.promise)
	result._read = function() {}

	return result

	function parseProvisions() {
		log('Parsing provisions')

		return (conf.project.teamProvision
			? provisions.parse(conf.project.teamProvision)
			: Q()
		).then(function(teamProvision) {
			return Q.all(conf.products.map(function(product) {
				return (product.provision
					? provisions.parse(product.provision)
					: Q(teamProvision)
				).then(function(parsedProvision) {
					product.parsedProvision = parsedProvision;
				})
			}))
		})
	}

	function installProvisions() {
		log('Installing provisions')
		return Q.all(conf.products.map(function(product) {
			return provisions.install(product.parsedProvision)
				.then(function(provision) {
					product.installedProvision = provision
				})
		}))
	}

	function addKeychain() {
		log('Adding keychain: %s', path.resolve(conf.keychain.path))

		return Q.denodeify(child_process.exec)('security list-keychains -d user')
			.spread(function(stdout, stderr) {
				return stdout
					.trim()
					.split('\n')
					.map(function(line) {
						return line.trim().slice(1, -1)
					})
			})
			.then(function(keychains) {
				keychains.unshift(path.resolve(conf.keychain.path))
				keychains = keychains.filter(function uniq(obj, idx, arr) {
					return !~arr.slice(0, idx).indexOf(obj)
				})
				var args = [ 'list-keychains', '-s' ].concat(keychains)

				return exec('security', args)
			})
	}

	function unlockKeychain() {
		log('Unlocking keychain')

		return exec(
		  'security'
		, [ 'unlock-keychain'
		  , '-p'
		  , conf.keychain.password
		  , path.resolve(conf.keychain.path)
		  ]
		)
	}

	function buildTarget() {
		log('Building target')

		var targets = conf.products.slice()

		var beforeAll = rimraf(conf.build.output)
			.then(function() { return mkdirp(conf.build.output) })

		targets = targets.map(function(product) {
			return function() {
				var deferred = Q.defer()

				var args =
				[ '-configuration'
				  , product.configuration || 'Debug'
				  , 'SYMROOT=' + path.resolve(conf.build.output)
				  , product.clean ? 'clean' : 'build'
				]

				if(conf.project.path.endsWith('.xcworkspace')) {
					args.unshift('-workspace', path.basename(conf.project.path))
					args.unshift('-scheme', product.target)
				} else {
					args.unshift('-target', product.target)
				}

				setupStdout(child_process.spawn(
				  'xcodebuild'
				, args
				, { cwd: path.dirname(conf.project.path)
				  , stdio: 'pipe'
				  }
				))
					.on('error', deferred.reject)
					.on('exit', deferred.makeNodeResolver())

				return deferred.promise
			}
		})

		return targets.reduce(Q.when, beforeAll)
	}

	function createIpa() {
		log('Creating IPA files')

		return mkdirp(path.resolve(conf.deploy.output))
		.then(function() {
			return readdir(conf.build.output)
			.invoke('map', function(dir) {
				var fullPath = path.join(conf.build.output, dir)
				if(!fs.statSync(fullPath).isDirectory()) {
					return
				}

				return readdir(fullPath)
					.invoke('map', function(file) {
						return package(path.join(fullPath, file))
					})
					.all()
			})
			.all()
		})

		function package(filename) {
			if(!/\.app$/.test(filename)) {
				return Q()
			}

			var ipaName = path.basename(filename) + '.ipa'
			var output = path.join(conf.deploy.output, ipaName)

			return exec(
			  'xcrun'
			, [ '-sdk'
			  , 'iphoneos'
			  , 'PackageApplication'
			  , '-v'
			  , filename
			  , '-o'
			  , path.resolve(output)
			  ]
			)
		}
	}

	function clean() {
		log('Cleaning after ourselves')

		var promises = [ conf.project.teamProvision ]
			.concat(
				conf.products.map(function(product) {
					return product.installedProvision
				})
			)
			.filter(function(provision, idx, arr) {
				// We don't care if there are no provision
				if(!provision) return false

				// We don't care for duplicates
				if(~arr.slice(0, idx).indexOf(provision)) return false

				return true
			})
			.map(provisions.clean)

		return Q.all(promises)
	}

	function exec(command, args) {
		var deferred = Q.defer()

		setupStdout(child_process.spawn(command, args || [], { stdio: 'pipe' }))
			.on('error', deferred.reject)
			.on('exit', deferred.makeNodeResolver())

		return deferred.promise
	}

	function setupStdout(childProcess) {
		childProcess.stdout.pipe(through(function(data) {
			result.push(data)
		}))
		/*
		childProcess.stderr.pipe(through(function(data) {
			log('Error: ' + data.toString())
		}))
		*/
		return childProcess
	}

}
