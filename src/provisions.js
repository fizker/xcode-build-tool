module.exports =
{ parse: parse
, clean: clean
, install: install
}

var exec = require('child_process').execFile
var Q = require('q')
var unlink = Q.denodeify(require('fs').unlink)
var path = require('path')
var utils = require('./utils')

function parse(provision, complete) {
	var deferred = Q.defer()

	var arr = []

	exec(
	  'mobileprovisionParser'
	, [ '-f', provision, '-o', 'uuid' ]
	)
		.on('error', deferred.reject)
		.stdout.on('data', function(data) {
			data =
			{ path: provision
			, uuid: data.toString().trim()
			}
			deferred.resolve(data)
		})

	return deferred.promise
}

function clean(provision) {
	return unlink(provision.installedPath)
		.catch(function(err) {
			// We don't care how the file disappeared, just that it is no longer there
			if(err.message.indexOf('no such file or directory')) {
				return
			}
			throw err
		})
}

function install(provision) {
	var installPath = path.join(
	      process.env.HOME
	    , 'Library/MobileDevice/Provisioning Profiles'
	    )
	utils.recurMkdirSync(installPath)
	provision.installedPath = path.join(
	  installPath
	, provision.uuid + path.extname(provision.path)
	)
	utils.copy(provision.path, provision.installedPath)
	return provision
}
