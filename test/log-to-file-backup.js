/*
Copyright © 2011 by Sebastien Dolard (sdolard@gmail.com)


Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*/

var
assert = require('assert'),
path = require('path'),
util = require('util'),
fs = require('fs'),
logToFile = require('../lib/log-to-file'),
dataTest = [
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'&é"(§è!çà)-azertyuiop^qsdfghjklmù`xcvbn,;:='
].join(''),
endData = '',
rs, 
log,
endEvent = 0,
closeEventUnlink = 0,
readStreamErrorEvent = 0,
errorEvent = 0,
writtingEvent = 0,
writeEvent = 0,
writtenEvent = 0, 
backupedEvent = 0,
gzippingEvent = 0, 
gzippedEvent = 0;


log = logToFile.create({
		directory: __dirname,
		fileName: path.basename(__filename) + '.test.txt',
		gzipBackupFile: false,
		fileMaxSize: dataTest.length
});

log.on('error', function(err){
		errorEvent++;
		console.log("Error: ", err);
});

log.on('writting', function(){
		writtingEvent++;
});

log.on('write', function(){
		writeEvent++;
});

log.on('written', function(fileName){
		writtenEvent++;	
});

log.on('backuped', function (filePath, newFilePath) {
		backupedEvent++;
		rs = fs.createReadStream(filePath + '.00', { 
				encoding: 'utf8'
		});
		
		rs.on('data', function (data) { 
				endData += data; 
		});
		rs.on('end', function () { 
				endEvent++;
		});
		rs.on('error', function (exception) { 
				readStreamErrorEvent++;
		});
		rs.on('close', function () { 
				// Clean up
				fs.unlink(filePath, function (err) {
						if (err) {
							throw err;
						}
						closeEventUnlink++;
						
				});
				// Clean up
				fs.unlink(filePath + '.00', function (err) {
						if (err) {
							throw err;
						}
						closeEventUnlink++;
						
				});
				assert.equal(endData, dataTest);				
		});
});

log.on('gzipping', function (filePath, newFilePath) {
		gzippingEvent++;
});

log.on('gzipped', function (filePath, newFilePath) {
		gzippedEvent++;
});

log.write(dataTest); 


process.on('uncaughtException', function (err) {
		console.log('Caught exception: ' + err);
});

process.on('exit', function () {
		// Event
		assert.strictEqual(errorEvent, 0, 'errorEvent');
		assert.strictEqual(writtingEvent, 1, 'writtingEvent');
		assert.strictEqual(writeEvent, 1, 'writeEvent');
		assert.strictEqual(writtenEvent, 1, 'writtenEvent');
		assert.strictEqual(backupedEvent, 1, 'backupedEvent');
		assert.strictEqual(gzippingEvent, 0, 'gzippingEvent');
		assert.strictEqual(gzippedEvent, 0, 'gzippedEvent');
		
		// Cleanup
		assert.strictEqual(endEvent, 1, 'endEvent');
		assert.strictEqual(closeEventUnlink, 2, 'closeEventUnlink ');
});




