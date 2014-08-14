module.exports = {
	parse: parse,
	clean: clean,
	install: install,
}

var exec = require('child_process').execFile
var Q = require('q')
var unlink = Q.denodeify(require('fs').unlink)
var path = require('path')
var mkdirp = Q.denodeify(require('mkdirp'))
var utils = require('./utils')

function parse(provision, complete) {
	var deferred = Q.defer()

	var arr = []

	var cmd = path.join(__dirname, '../mobileprovision-read')
	var args = [ '-f', provision, '-o', 'UUID' ]

	var child = exec(cmd, args, deferred.makeNodeResolver())
		.on('error', deferred.reject)

	return deferred.promise
		.spread(function(data, stderr) {
			data =
			{ path: provision
			, uuid: data.toString().trim()
			}
			return data
		})

	return deferred.promise
}

function clean(provision) {
	if(!provision.installedPath) {
		return
	}
	return unlink(provision.installedPath)
		.catch(function(err) {
			// We don't care how the file disappeared, just that it is no longer there
			if(err.code == 'ENOENT') return
			if(err.message.indexOf('no such file or directory')) {
				return
			}
			throw err
		})
}

function install(provision) {
	var installPath = path.join(process.env.HOME,
		'Library/MobileDevice/Provisioning Profiles')

	return mkdirp(installPath)
		.then(function() {
			provision.installedPath = path.join(installPath,
				provision.uuid + path.extname(provision.path))
			return utils.copy(provision.path, provision.installedPath)
		})
		.thenResolve(provision)
}
