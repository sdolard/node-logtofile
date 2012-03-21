var 
vows = require('vows'),
assert = require('assert'),
util = require('util'),
events = require("events"),
path = require("path"),
fs = require("fs"),

logToFile = require('../lib/logtofile'),
dataTest = [
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'&é"(§è!çà)-azertyuiop^qsdfghjklmù`xcvbn,;:='
].join(''),
testFileName = 'tmpTest.txt',
testInvalidFileName = ' /tmpTest.txt',
testFilePath = __dirname + '/' + testFileName;
testInvalidFilePath = __dirname + '/' + testInvalidFileName;

exports.suite1 = vows.describe('logtofile').addBatch({
		'When creating a logtofile instance without any config': {
			topic: function() {
				return logToFile.create();
			},
			'It throw an exception (Error)': function (err) {
				assert.isTrue(err instanceof Error);
			},
			'Exception code is "EEMPTYFILENAME"': function (err) {
				assert.strictEqual(err.code, 'EEMPTYFILENAME');
			},
			'Stack is attached to this exception': function (err) {
				assert.isTrue(err.hasOwnProperty('stack'));
			}
		},
		'When creating a logtofile instance without only a fileName config property': {
			topic: function() {
				return logToFile.create({
						fileName: testFileName
				});
			},
			'It throw an exception (Error)': function (err) {
				assert.isTrue(err instanceof Error);
			},
			'Exception code is "EEMPTYDIRECTORY"': function (err) {
				assert.strictEqual(err.code, 'EEMPTYDIRECTORY');
			}
		},
		'When try to write in an invalid directory': {
			topic: function() {
				return logToFile.create({
						directory: '•ë“‘',
						fileName: testFileName
				});
			},
			'It throw an exception (Error)': function (err) {
				assert.isTrue(err instanceof Error);
			},
			'Exception code is "EDIRNOTFOUND"': function (err) {
				assert.strictEqual(err.code, 'EDIRNOTFOUND');
			}
		},
		'When try to write in an invalid filename (" /" in fileName)': {
			topic: function() {
				var 
				promise = new events.EventEmitter(),
				log = logToFile.create({
						directory: __dirname,
						fileName: testInvalidFileName
				});
				log.on('error', function (err) {
						promise.emit('error', err);
				});
				return promise;
			},
			"It throw(emit) an exception": function (err, log) {
				assert.isTrue(err instanceof Error);
				
			},
			'Exception code is "ENOENT"': function (err, log) {
				assert.strictEqual(err.code, 'ENOENT');
				
			}
		},
		'When calling write method with a valid config': {
			topic: function() {
				var 
				promise = new events.EventEmitter(),
				log = logToFile.create({
						directory: __dirname,
						fileName: testFileName,
						gzipBackupFile: false
				});
				log.on('written', function (p) {
						promise.emit('success', p);
				});
				log.write(dataTest);
				return promise;
			},
			"It writes in a new file": function (p) {
				assert.strictEqual(p, testFilePath);
				assert.isFalse(p instanceof Error);				
			},
			"Written data are correct": function (p) {
				assert.strictEqual(fs.readFileSync(p, 'utf8'), dataTest);			
			}
		}
}).
addBatch({
		'When calling write method with a valid config': {
			topic: function() {
				var 
				promise = new events.EventEmitter(),
				log = logToFile.create({
						directory: __dirname,
						fileName: testFileName,
						gzipBackupFile: false
				});
				log.on('writting', function () {
						promise.emit('success');
				});
				log.write(dataTest);
				return promise;
			},
			"Writting event is called": function () {
				assert.isTrue(true);				
			}
		}
}).
addBatch({
		'When calling write method with a valid config': {
			topic: function() {
				var 
				promise = new events.EventEmitter(),
				log = logToFile.create({
						directory: __dirname,
						fileName: testFileName,
						gzipBackupFile: false
				});
				log.on('write', function () {
						promise.emit('success');
				});
				log.write(dataTest);
				return promise;
			},
			"write event is called": function () {
				assert.isTrue(true);				
			}
		}
}).
addBatch({
		'Finnaly, we clean up test dir': {
			topic: function() {
				fs.unlink(testFilePath, this.callback);
			},
			"Ok": function (err) {
				assert.isUndefined(err);
			}
		}
});
/*.
addBatch({
'We cleanup previous test': {
topic: function() {
var log = logToFile.create();
return log;
},
'It throw an exception (Error)': function (r) {
assert.isTrue(r instanceof Error);
},
'Exception code is "EEMPTYFILENAME"': function (r) {
assert.strictEqual(r.code, 'EEMPTYFILENAME');
},
'Stack is attached to this exception': function (r) {
assert.isTrue(r.hasOwnProperty('stack'));
}
}
});*/

/*
exports.suite1 = vows.describe('ping').addBatch({
'When we ping localhost': {
topic: function() {
var promise = new events.EventEmitter();

ping.check({
host: 'localhost'
}, function (err, r) {
if (err) { 
promise.emit('error', err, r); 
} else { 
promise.emit('success', r); 
}
});
return promise;
},
'It succeed': function (r) {
assert.equal(r.host, 'localhost');
assert.equal(r.exitCode, 0);
}
},
'When we ping nohost': {
topic: function() {
var promise = new events.EventEmitter();

ping.check({
host: 'nohost'
}, function (err, r) {
if (err) { 
promise.emit('error', err, r); 
} else { 
promise.emit('success', r); 
}
});
return promise;
},
'It failed': function (err, r) {
//console.log(util.inspect(r));
assert.equal(err.code, 'EPINGFAILED');
assert.notEqual(r.exitCode, 0);
}
},
'When we ping ::1': {
topic: function() {
var promise = new events.EventEmitter();

ping.check({
host: '::1',
ipV6: true
}, function (err, r) {
if (err) { 
promise.emit('error', err, r); 
} else { 
promise.emit('success', r); 
}
});
return promise;
},
'It succeed': function (r) {
assert.equal(r.host, '::1');
assert.equal(r.exitCode, 0);

}
},
'When we ping 1.1.1.1 with timeout set to 1s': {
topic: function() {
var  
promise = new events.EventEmitter();
start = new Date();

ping.check({
host: '1.1.1.1',
timeout: 1
}, function (err, r) {
end = new Date();
if (err) { 
promise.emit('error', err, r); 
} else { 
promise.emit('success', r); 
}

});
return promise;
},
'It takes 1s to return': function (r) {
assert.equal(r.host, '1.1.1.1');
assert.notEqual(r.exitCode, 0);
assert.equal(end.getTime() - start.getTime() >= 1000, true);
}
}
});

*/