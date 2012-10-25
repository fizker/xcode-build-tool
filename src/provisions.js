module.exports =
{ parse: parse
, clean: clean
, install: install
}

var exec = require('child_process').execFile
  , fs = require('fs')
  , path = require('path')
  , utils = require('./utils')

function parse(provision, complete) {
	var arr = []

	exec(
	  'mobileprovisionParser'
	, [ '-f', provision, '-o', 'uuid' ]
	)
		.on('error', complete)
		.stdout.on('data', function(data) {
			data =
			{ path: provision
			, uuid: data.toString().trim()
			}
			complete(null, data)
		})
}

function clean(provision) {
	fs.unlinkSync(provision.installedPath)
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
