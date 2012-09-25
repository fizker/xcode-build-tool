module.exports =
{ parse: parse
, clean: clean
, install: install
}

var exec = require('child_process').execFile
  , fasync = require('fasync')
  , fs = require('fs')
  , path = require('path')

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
	recurMkdirSync(installPath)
	return provisions.map(function(p) {
		p.installedPath = path.join(
		    installPath
		  , p.uuid + path.extname(p.path)
		  )
		copy(p.path, p.installedPath)
		return p
	})
}

function copy(from, to) {
	fs.writeFileSync(to, fs.readFileSync(from))
}
function recurMkdirSync(p, mode) {
	p
		.split(path.sep)
		.reduce(function(arr, p) {
			if(arr.length == 0) {
				return [p]
			}
			p = path.join(arr[arr.length-1], p);
			arr.push(p)
			return arr
		}, ['/'])
		.filter(function(p) {
			return p && !fs.existsSync(p)
		})
		.forEach(function(p) {
			fs.mkdirSync(p)
		})
}
