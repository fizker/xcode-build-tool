var Q = require('q')
var child_process = require('child_process')
var path = require('path')
var fs = require('fs')
var readdir = Q.denodeify(fs.readdir)

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

	// The list of jobs, in the order that they execute
	return [ parseProvisions
		, installProvisions
		, addKeychain
		, unlockKeychain
		, buildTarget
		, createIpa
		, deploy
		, clean
		]
		.reduce(Q.when, Q())

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
		conf.products.forEach(function(product) {
			product.installedProvision = provisions.install(product.parsedProvision)
		})
		return Q()
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

	function getAllConfigurations() {
		return Object.keys(conf.products.reduce(function(confs, product) {
			confs[product.configuration || 'Debug'] = true
			return confs
		}, {}))
	}

	function buildTarget() {
		log('Building target')

		var targets = conf.products.slice()
		var configurations = getAllConfigurations()

		configurations.forEach(function(conf) {
			targets.unshift({ configuration: conf, clean: true })
		})

		targets = targets.map(function(product) {
			return function(done) {
				var deferred = Q.defer()

				utils.recurMkdirSync(conf.build.output)
				var args =
				[ '-configuration'
				  , product.configuration || 'Debug'
				  , 'SYMROOT=' + path.resolve(conf.build.output)
				  , product.clean ? 'clean' : 'build'
				]
				if(product.target) {
					args.unshift('-target', product.target)
				}

				child_process.spawn(
				  'xcodebuild'
				, args
				, { cwd: path.dirname(conf.project.path)
				  , stdio: 'inherit'
				  }
				)
					.on('error', deferred.reject)
					.on('exit', deferred.makeNodeResolver())

				return deferred.promise
			}
		})

		return targets.reduce(Q.when, Q())
	}

	function createIpa() {
		log('Creating IPA files')

		utils.recurMkdirSync(path.resolve(conf.deploy.output))

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

	function deploy() {
		log('Calling deploy script')

		return exec(conf.deploy.script)
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

		child_process.spawn(command, args || [], { stdio: 'inherit' })
			.on('error', deferred.reject)
			.on('exit', deferred.makeNodeResolver())

		return deferred.promise
	}

}
