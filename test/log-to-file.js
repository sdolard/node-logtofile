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
util = require('util'),
fs = require('fs'),
logToFile = require('../lib/log-to-file'),
dataTest = [
	'é1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN',
	'1234567890AZERTYUIOPQSDFGHJKLMWXCVBN'
].join(''),
endData = '',
size = 0,
rs, 
log,
EEMPTYFILENAME = false,
EEMPTYDIRECTORY = false,
EDIRNOTFOUND = false,
endEvent = false,
closeEventUnlink = false,
readStreamErrorEvent = false,
writtingEvent = false,
elements = 1;


try {
	log = logToFile.create();
}
catch(exceptionFoo) {
	if (exceptionFoo.code === 'EEMPTYFILENAME') {
		EEMPTYFILENAME = true;
	}
}

try {
	log = logToFile.create({
			fileName: 'l_connection'
	});
}
catch(exceptionBar) {
	if (exceptionBar.code === 'EEMPTYDIRECTORY') {
		EEMPTYDIRECTORY = true;
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
		EDIRNOTFOUND = true;
	}
}

log = logToFile.create({
		directory: __dirname,
		fileName: 'test.txt',
		gzipBackupFile: true
});

log.on('writting', function(){
		writtingEvent = true;
});

log.on('written', function(fileName){
		var totalSize, duration;
		rs = fs.createReadStream(fileName, { 
				encoding: 'utf8'
		});
		
		rs.on('data', function (data) { 
				endData += data; 
		});
		rs.on('end', function () { 
				endEvent = true;
		});
		rs.on('error', function (exception) { 
				readStreamErrorEvent = true;
				//console.log('ReadStream exception: %s(%s)', exception.message, exception.code);
		});
		rs.on('close', function () { 
				// Clean up
				fs.unlink(fileName, function (err) {
						if (err) {
							throw err;
						}
						closeEventUnlink = true;
						
				});
				if (elements === 1) {
					assert.equal(endData, dataTest);
				}
				log.write(dataTest); // this should throw an error (file do not exists more), but no.
		});
		
});

/*log.on('backuped', function (filePath, newFilePath) {
		console.log('%s backuped to %s', filePath, newFilePath);
});
log.on('gzipping', function (filePath, newFilePath) {
		console.log('gzipping %s...', filePath);
});
log.on('gzipped', function (filePath, newFilePath) {
		console.log('%s gzipped', filePath);
});*/
for (var i = 0; i < elements; i++) {
	log.write(dataTest); 
	size += dataTest.length;
}


process.on('exit', function () {
		assert.strictEqual(EEMPTYFILENAME, true, 'EEMPTYFILENAME done');
		assert.strictEqual(EEMPTYDIRECTORY, true, 'EEMPTYDIRECTORY done');
		assert.strictEqual(EDIRNOTFOUND, true, 'EDIRNOTFOUND done');
		assert.strictEqual(writtingEvent, true, 'writtingEvent done');
		assert.strictEqual(endEvent, true, 'endEvent done');
		assert.strictEqual(closeEventUnlink, true, 'closeEventUnlink done');
		assert.strictEqual(readStreamErrorEvent, true, 'readStreamErrorEvent done');
});




