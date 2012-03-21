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
testFileName = 'tmpTest-backup.txt',
testFilePath = path.normalize(__dirname + '/' + testFileName);

exports.suite1 = vows.describe('logtofile backup').addBatch({
		'When calling write method with a fileMaxSize set to data size': {
			topic: function() {
				var 
				promise = new events.EventEmitter(),
				log = logToFile.create({
						directory: __dirname,
						fileName: testFileName,
						gzipBackupFile: false,
						fileMaxSize: dataTest.length
				});
				log.on('backuped', function (oldFilePath, newFilePath) {
						promise.emit('success', oldFilePath, newFilePath);
				});
				log.write(dataTest);
				return promise;
				
			},
			"It creates a backup file": function (log, oldFilePath, newFilePath) {
				assert.isTrue(path.existsSync(newFilePath));				
			},
			"Backup content is correct": function (log, oldFilePath, newFilePath) {
				assert.strictEqual(fs.readFileSync(newFilePath, 'utf8'), dataTest);
			},
			"It removes old file": function (log, oldFilePath, newFilePath) {
				assert.isFalse(path.existsSync(oldFilePath));				
			}
		}
}).
addBatch({
		'Then': {
			topic: function() {
				setTimeout(this.callback, 100); // must be async
			},
			"it creates a new empty file": function () {
				assert.isTrue(path.existsSync(testFilePath));
			}
		}
}).
addBatch({
		'Finnaly, we delete tmpTest-backup.txt.00': {
			topic: function() {
				fs.unlink(testFilePath+'.00', this.callback);
			},
			"Ok": function (err) {
				assert.isUndefined(err);
			}
		}
}).
addBatch({
		'and we delete tmpTest-backup.txt': {
			topic: function() {
				fs.unlink(testFilePath, this.callback);
			},
			"Ok": function (err) {
				assert.isUndefined(err);
			}
		}
});
