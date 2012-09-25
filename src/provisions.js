module.exports =
{ parse: parse
, clean: clean
, install: install
}

var exec = require('child_process').execFile
  , fasync = require('fasync')
  , fs = require('fs')
  , path = require('path')
  , utils = require('./utils')

function parse(provisions, complete) {
	var arr = []
	  , done = fasync.pool()

	done.on('empty', function() {
		complete(null, arr)
	})
	done.on('error', complete)

	provisions.forEach(function(provision, index) {
		exec(
		    'mobileprovisionParser'
		  , [ '-f', provision, '-o', 'uuid' ]
		  , done.register()
		)
			.stdout.on('data', function(data) {
				arr[index] =
				{ path: provision
				, uuid: data.toString().trim()
				}
			})
	})
}

function clean(provisions) {
	provisions.forEach(function(provision) {
		fs.unlinkSync(provision.installedPath)
	})
}

function install(provisions) {
	var installPath = path.join(
	      process.env.HOME
	    , 'Library/MobileDevice/Provisioning Profiles'
	    )
	utils.recurMkdirSync(installPath)
	return provisions.map(function(p) {
		p.installedPath = path.join(
		    installPath
		  , p.uuid + path.extname(p.path)
		  )
		utils.copy(p.path, p.installedPath)
		return p
	})
}
