module.exports = {
	copy: copy,
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
