module.exports = {
	copy: copy,
	recurMkdir: recurMkdir,
}

var Q = require('q')
var fs = require('fs')
var path = require('path')

function copy(from, to) {
	var deferred = Q.defer()
	fs.createReadStream(from).pipe(fs.createWriteStream(to))
		.on('close', deferred.resolve)
		.on('error', deferred.reject)

	return deferred.promise
		.catch(function(error) {
			return Q.nfcall(fs.unlink, to)
				.thenReject(error)
		})
}

function recurMkdir(p, mode) {
	var folders = getFolders(p)
	return folders.reduce(function(promise, folder) {
		return promise
			// create folder
			.then(function() {
				return Q.nfcall(fs.mkdir, folder, mode)
			})
			.catch(function(error) {
				// it fails if it already exists. this is ok
				if(error.code == 'EEXIST') return
				if(error.code == 'EISDIR') return
				// Cascade all other errors
				throw error
			})
	}, Q())
}

function getFolders(p) {
	return p
		.split(path.sep)
		.reduce(function(arr, p) {
			if(arr.length == 0) {
				return [p]
			}
			p = path.join(arr[arr.length-1], p);
			arr.push(p)
			return arr
		}, ['/'])
}
