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
elements = 1, // 1, 1000000,
elementsIO = parseInt(elements, 10) + '-elements-io',
elementsLoop = parseInt(elements, 10) + '-elements-Loop',
start, end, mem, writtingEventCount = 0;


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
		writeDelay: 1,
		verbose: true,
		fileMaxSize: 1024 * 1024 * 10
});
log.on('writting', function(fileName){
		
		if (elements > 1 && writtingEventCount === 0) {
			console.time(elementsIO);
			start = Date.now();
		}
		writtingEventCount ++; 
});

log.on('written', function(fileName){
		var totalSize, duration;
		if (size > 1024 * 1024 ) {
			console.timeEnd(elementsIO);
			end = Date.now();
			totalSize = size / 1024 / 1024;
			duration = end - start;
			console.log('Total:%dMB in %d ms > %dMB/s', totalSize, duration, totalSize * 1000 / duration);
		}
		if (elements === 1) {
			rs = fs.createReadStream(fileName, { 
					encoding: 'utf8'
			});
			
			rs.on('data', function (data) { 
					if (elements === 1) {
						endData += data; 
					}
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
		}
		
});

log.on('renamed', function (oldFilePath, newFilePath) {
		console.log('%s renamed to %s', oldFilePath, newFilePath);
});

if (elements > 1 ) {
	console.time(elementsLoop);
}
for (var i = 0; i < elements; i++) {
	log.write(dataTest); 
	size += dataTest.length;
}
if (elements > 1 ) {
	console.timeEnd(elementsLoop);
}
if (size > 1024 * 1024) {
	mem = process.memoryUsage();
	console.log('rss: %dMB',  mem.rss / 1024 / 1024);
	console.log('vsize: %dMB',  mem.vsize / 1024 / 1024);
	console.log('heapTotal: %dMB',  mem.heapTotal / 1024 / 1024);
	console.log('heapUsed: %dMB',  mem.heapUsed / 1024 / 1024);
}

process.on('exit', function () {
		assert.strictEqual(EEMPTYFILENAME, true, 'EEMPTYFILENAME done');
		assert.strictEqual(EEMPTYDIRECTORY, true, 'EEMPTYDIRECTORY done');
		assert.strictEqual(EDIRNOTFOUND, true, 'EDIRNOTFOUND done');
		
		if (elements === 1) {
			assert.strictEqual(endEvent, true, 'endEvent done');
			assert.strictEqual(closeEventUnlink, true, 'closeEventUnlink done');
			
			assert.strictEqual(readStreamErrorEvent, true, 'readStreamErrorEvent done');
		}		
});

/*
log.write
-------------
1000000-elements-Loop: 986ms
rss: 191.20703125MB
vsize: 3129.06640625MB
heapTotal: 182.4703369140625MB
heapUsed: 156.18316650390625MB
1000000-elements-io: 8497ms
50.39422950057741MB/s


log.writeSync > removed
-------------
1000000-elements-Loop: 8220ms
rss: 456.97265625MB
vsize: 3406.1640625MB
heapTotal: 23.1846923828125MB
heapUsed: 6.935150146484375MB
1000000-elements-io: 8508ms
50.329074760978635MB/s
*/

/**
log.write, buffer size 4096
-------------
1000000-elements-Loop: 1098ms
rss: 191.20703125MB
vsize: 3129.06640625MB
heapTotal: 182.4703369140625MB
heapUsed: 156.18377685546875MB
1000000-elements-io: 33809ms
12.665259784862204MB/s


log.write, buffer size 16384
-------------
rss: 191.22265625MB
vsize: 3121.09765625MB
heapTotal: 182.5015869140625MB
heapUsed: 156.18750762939453MB
1000000-elements-io: 9676ms
44.25379992418419MB/s


log.write, buffer size 32768
-------------
1000000-elements-Loop: 948ms
rss: 191.2109375MB
vsize: 3121.08203125MB
heapTotal: 182.4859619140625MB
heapUsed: 156.1850128173828MB
1000000-elements-io: 8217ms
52.111447981794605MB/s


log.write, buffer size 65536
-------------
1000000-elements-Loop: 974ms
rss: 191.22265625MB
vsize: 3121.09765625MB
heapTotal: 182.5015869140625MB
heapUsed: 156.18667602539062MB
1000000-elements-io: 7909ms
54.14082286842916MB/s


log.write, buffer size 132072
-------------
1000000-elements-Loop: 986ms
rss: 191.22265625MB
vsize: 3121.09765625MB
heapTotal: 182.5015869140625MB
heapUsed: 156.1884536743164MB
1000000-elements-io: 8048ms
53.205736588768175MB/s

*/





