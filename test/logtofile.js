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
logToFile = require('../lib/logtofile'),
dataTest = [
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'&é"(§è!çà)-azertyuiop^qsdfghjklmù`xcvbn,;:='
].join(''),
endData = '',
rs, 
log,
EEMPTYFILENAME = 0,
EEMPTYDIRECTORY = 0,
EDIRNOTFOUND = 0,
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


try {
	log = logToFile.create();
}
catch(exceptionFoo) {
	if (exceptionFoo.code === 'EEMPTYFILENAME') {
		EEMPTYFILENAME++;
	}
}

try {
	log = logToFile.create({
			fileName: 'l_connection'
	});
}
catch(exceptionBar) {
	if (exceptionBar.code === 'EEMPTYDIRECTORY') {
		EEMPTYDIRECTORY++;
	}
}

try {
	log = logToFile.create({
			directory: '•ë“‘',
			fileName: 'l_connection'
	});
}
catch(exceptionBaz) {
	if (exceptionBaz.code === 'EDIRNOTFOUND') {
		EDIRNOTFOUND++;
	}
}

log = logToFile.create({
		directory: __dirname,
		fileName: path.basename(__filename) + '.test.txt',
		gzipBackupFile: false
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

log.on('written', function(filePath){
		writtenEvent++;
		rs = fs.createReadStream(filePath, { 
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
				//console.log('ReadStream exception: %s(%s)', exception.message, exception.code);
		});
		rs.on('close', function () { 
				// Clean up
				fs.unlink(filePath, function (err) {
						if (err) {
							throw err;
						}
						closeEventUnlink++;
						
				});
				assert.equal(endData, dataTest);
				log.write(dataTest); // this should throw an error (file do not exists more)
		});
		
});

log.on('backuped', function (filePath, newFilePath) {
		backupedEvent++;
});

log.on('gzipping', function (filePath, newFilePath) {
		gzippingEvent++;
});

log.on('gzipped', function (filePath, newFilePath) {
		gzippedEvent++;
});

log.write(dataTest); 

process.on('exit', function () {
		// Exception
		assert.strictEqual(EEMPTYFILENAME, 1, 'EEMPTYFILENAME');
		assert.strictEqual(EEMPTYDIRECTORY, 1, 'EEMPTYDIRECTORY');
		assert.strictEqual(EDIRNOTFOUND, 1, 'EDIRNOTFOUND');
		
		// Event
		assert.strictEqual(errorEvent, 0, 'errorEvent');
		assert.strictEqual(writtingEvent, 2, 'writtingEvent');
		assert.strictEqual(writeEvent, 2, 'writeEvent');
		assert.strictEqual(writtenEvent, 2, 'writtenEvent');
		assert.strictEqual(backupedEvent, 0, 'backupedEvent');
		assert.strictEqual(gzippingEvent, 0, 'gzippingEvent');
		assert.strictEqual(gzippedEvent, 0, 'gzippedEvent');
		
		// Cleanup
		assert.strictEqual(endEvent, 1, 'endEvent');
		assert.strictEqual(closeEventUnlink, 1, 'closeEventUnlink');
		assert.strictEqual(readStreamErrorEvent, 1, 'readStreamErrorEvent');
});




