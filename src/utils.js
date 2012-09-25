module.exports =
{ copy: copy
, recurMkdirSync: recurMkdirSync
}

var fs = require('fs')
  , path = require('path')

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
