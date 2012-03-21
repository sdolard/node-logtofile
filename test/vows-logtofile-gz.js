var 
vows = require('vows'),
assert = require('assert'),
util = require('util'),
events = require("events"),
path = require("path"),
fs = require("fs"),
zlib = require("zlib"),

logToFile = require('../lib/logtofile'),
dataTest = [
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'&é"(§è!çà)-azertyuiop^qsdfghjklmù`xcvbn,;:='
].join(''),
testFileName = 'tmpTest-gz.txt',
testFilePath = path.normalize(__dirname + '/' + testFileName);

exports.suite1 = vows.describe('logtofile gz').addBatch({
		'When calling write method with a fileMaxSize set to data size': {
			topic: function() {
				var 
				promise = new events.EventEmitter(),
				log = logToFile.create({
						directory: __dirname,
						fileName: testFileName,
						gzipBackupFile: true,
						fileMaxSize: dataTest.length
				});
				log.on('gzipped', function (oldFilePath, newFilePath) {
						promise.emit('success', oldFilePath, newFilePath);
				});
				log.write(dataTest);
				return promise;
				
			},
			"It creates a gz file": function (log, oldFilePath, newFilePath) {
				assert.isTrue(path.existsSync(newFilePath));				
			},
			"It removes old file": function (log, oldFilePath, newFilePath) {
				assert.isFalse(path.existsSync(testFilePath));				
			}
		}
}).
addBatch({
		"When reading gz content": {
			topic: function () {
				var
				promise = new events.EventEmitter(),
				rs = fs.createReadStream(testFilePath + '.00.gz').pipe(zlib.createGunzip());
				
				rs.on('data', function (data) { 
						promise.emit('success', data.toString());
				});
				return promise;
			},
			"content is correct": function(rs, data){
				assert.strictEqual(data, dataTest);
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
		'Finnaly, we delete tmpTest-gz.txt.00.gz': {
			topic: function() {
				fs.unlink(testFilePath + '.00.gz', this.callback);
			},
			"Ok": function (err) {
				assert.isUndefined(err);
			}
		}
}).
addBatch({
		'and we delete tmpTest-gz.txt': {
			topic: function() {
				fs.unlink(testFilePath, this.callback);
			},
			"Ok": function (err) {
				assert.isUndefined(err);
			}
		}
});
