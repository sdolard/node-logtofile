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
testFilePath = path.normalize(__dirname + '/' + testFileName),
testInvalidFilePath = path.normalize(__dirname + '/' + testInvalidFileName);

exports.suite1 = vows.describe('logtofile basic').addBatch({
		'When creating a logtofile instance without any config': {
			topic: function() {
				return logToFile.create();
			},
			'It throws an exception (Error)': function (err) {
				assert.instanceOf(err,  Error);
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
			'It throws an exception (Error)': function (err) {
				assert.instanceOf(err, Error);
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
			'It throws an exception (Error)': function (err) {
				assert.instanceOf(err, Error);
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
			"It throws(emit) an exception": function (err, log) {
				assert.instanceOf(err, Error);
				
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
				assert.isTrue(path.existsSync(p));
				
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
		'Finnaly, we remove tmpTest.txt': {
			topic: function() {
				fs.unlink(testFilePath, this.callback);
			},
			"Ok": function (err) {
				assert.isUndefined(err);
			}
		}
});