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



/**
*Known issues:
*	- When writting, deleting log file do not throw any error.
*/
var 
path = require('path'),
fs = require('fs'),
EventEmitter = require('events').EventEmitter,
util = require('util');


function onTimeout(logFile, origin) {
	// Two possible origin
	// - drain
	// - timeout
	if (origin === 'timeout') { 
		logFile._timeoutId = -1; 
	}
	logFile.log('onTimeout: origin: %s ', origin);
	if (logFile._rotationPending) {
		return;
	}

	if (logFile._writtenSize < logFile.fileMaxSize) {
		var buffer = logFile._buffers.shift();
		if (!buffer) {
			logFile.emit('written', logFile.filePath);
			logFile._waitDrain = false; // No more buffer to write, timer can restart
			return;
		}
		
		logFile._writableStream.write(buffer.b.slice(0, buffer.usedBytes));
		if (!logFile._waitDrain) {
			// If it's first time we start to write, we emit this event
			logFile.emit('writting', logFile.filePath);
			logFile._waitDrain = true; // Timer has not to run
		} else {
			logFile.emit('write', logFile.filePath);
		}
		
		logFile._writtenSize += buffer.usedBytes;
		return;
	} 
	logFile._rotationPending = true;
	logFile._writableStream.destroySoon(); // this will flush before then close
}

function formatIndex(index, length) {
	index = String(index);
	while (index.length < length) {
		index = '0' + index;
	}
	return index;
}

/**
* @class
* @params config.fileName {string} 
* @params config.directory {string} 
* @params [config.verbose {boolean}]
* @event error({object} exception)
* @event writting({string} filePath)
* @event written({string} filePath)
* @throw EEMPTYFILENAME
* @throw EDIRNOTFOUND
*/
var LogToFile = function (config){ // ctor
	var 
	me = this;	
	
	config = config || {};
	
	// Config
	this.fileName = config.fileName || '';
	if (this.fileName === '') {
		throw {
			code: 'EEMPTYFILENAME',
			message: 'fileName config must be set'
		};
	}
	
	this.directory = config.directory || '';
	if (this.directory === '') {
		throw {
			code: 'EEMPTYDIRECTORY',
			message: 'directory config must be set'
		};
	}
	this.directory = path.resolve(config.directory);	
	// Directory sync test
	if (!path.existsSync(this.directory)) {
		throw {
			code: 'EDIRNOTFOUND',
			message: 'Directory not found: "' + this.directory + '"'
		};
	}
	this.filePath = this.directory + '/' + this.fileName;
	this.writeDelay = config.writeDelay || 200; // Buffer is flush every 200 ms
	// TODO: check value
	this.bufferSize = config.bufferSize || 65536; // Buffer blocks size
	// TODO: check value
	this.fileMaxSize = config.fileMaxSize || 1024 * 1024 * 5; // 5MB
	this.verbose = config.verbose || false;
	// TODO: check value (at least > 0...)
	this.maxBackupFileNumber = config.maxBackupFileNumber || 10; 
	this.compressBackupFile = config.compressBackupFile || false; // TODO
	
	this._buffers = []; // Array of buffer to write 
	this._timeoutId = -1; // write timer
	this._waitDrain = false; // Drain flag
	this._writtenSize = 0; // Quantity of data written. Initialized in _createWriteStream
	this._rotationPending = false; // File rotation flag
	this._maxBackupFileNumberLength = String(this.maxBackupFileNumber).length;
	
	this._createWriteStream(); // We create first stream
	
	EventEmitter.call(this); 
};
util.inherits(LogToFile, EventEmitter);


/**
* @private
*/
LogToFile.prototype._createWriteStream = function(delay) {
	var 
	me = this,
	stats;
	delay = delay || this.writeDelay;
	this.log('LogToFile.prototype._createWriteStream.delay: %d', delay);
	if (this._writableStream) {
		return;
	}
	
	this.log('Log will be written in "%s"', this.filePath);
	
	fs.stat(this.filePath, function(err, stats) {	
			if (err && err.code !== 'ENOENT') {	
				me._eexception.call(me, err, '_createWriteStream fs.stat');
				return;
			}
			me._writtenSize = stats ? stats.size : 0;
			me._rotationPending = false;
			me._waitDrain = false;
			
			//Writable stream
			me._writableStream = fs.createWriteStream(me.filePath, {
					flags: 'a'
			}); 
			me._writableStream.on('error', function(err) {
					me._eexception.call(me, err, '_createWriteStream _writableStream on error');
			});
			
			// Emitted when the underlying file descriptor has been closed.	
			me._writableStream.on('close', function() {
					if (me._rotationPending) {
						delete me._writableStream;
						me._doFileRotation.call(me);
					}
			});
			
			// Emitted after a write() method was called that returned false to indicate that it is safe to write again.
			me._writableStream.on('drain', function() {
					onTimeout(me, 'drain'); // we write next buffer, if there is
			});
			
			me.log('me._restartTimeout.call(me, delay): %d', delay);
			me._restartTimeout.call(me, delay);
	});
};

/**
* @private
*/
function write(logFile, string) {
	var 
	stringLength = Buffer.byteLength(string),
	buffer = logFile._getBuffer.call(logFile);
	
	// Enought place in current buffer?
	if (buffer.usedBytes + stringLength > logFile.bufferSize) { 
		buffer = logFile._addBuffer.call(logFile);
	}
	
	buffer.b.write(string, buffer.usedBytes);
	buffer.usedBytes += stringLength;
	
	logFile._restartTimeout.call(logFile);
}

/**
* @public
*/
LogToFile.prototype.write = function(string) {
	var 
	me = this;
	process.nextTick(function(){
			write(me, string);
	});
};


/**
* @private
*/
LogToFile.prototype._getBuffer = function() {
	if (this._buffers.length === 0) {
		return this._addBuffer();
	}
	return this._buffers[this._buffers.length - 1];
};



/**
* @private
*/
LogToFile.prototype._addBuffer = function() {
	var b = {
		b: new Buffer(this.bufferSize),
		usedBytes: 0
	};
	this._buffers.push(b);
	return b;
};

/**
*
*/
LogToFile.prototype._restartTimeout = function(delay) {
	if (this._waitDrain || // waiting for write buffer to be empty
		this._timeoutId !== -1 || // timer is already running
	this._rotationPending || // a file rotation is pending
	!this._writableStream) { // there is still no write stream
	return;
	}
	delay = delay || this.writeDelay;
	clearTimeout(this._timeoutId);
	this._timeoutId = setTimeout(onTimeout, delay, this, 'timeout');
};


/**
*
*/
LogToFile.prototype._doFileRotation = function() {
	/*
	File format
	original:   fileName [+ '.' +  fileExt]
	rotation:   filename [+ '.' +  fileExt] + '.' + fileIndex 
	compression filename [+ '.' +  fileExt] + '.' + fileIndex + '.gz'
	*/
	
	var
	me = this,
	oldFilePath = this.filePath,
	dirname = path.dirname(this.filePath),
	basename = path.basename(this.filePath);
	filePath = dirname + '/' + basename + "."+ formatIndex(0, me._maxBackupFileNumberLength);
	
	fs.readdir(dirname, function(err, files) {
			if (err) {
				me._eexception.call(me, err, "_doFileRotation fs.readdir");
				return;
			}
			var 
			i,
			results = [], 
			fileIndex,
			newFileIndex,
			re = new RegExp('(^' + basename + ').(\\d+)'), 
			renameCurrent = function() {
				fs.rename(me.filePath, filePath, function(err) {
						if (err) {
							me._eexception.call(me, err, "_doFileRotation fs.rename");
							return;
						}
						me.emit('renamed', oldFilePath, filePath);
						
						me.log("me._createWriteStream.call(me, 1);");
						// new stream	
						me._createWriteStream.call(me, 1);
				});
			},
			renameOld = function() {
				file = results[i];
				i++;
				if(file.fileIndex >= me.maxBackupFileNumber) {
					fs.unlink(file.oldFileName, function(err) {
							if (err) {
								me._eexception.call(me, err, "_doFileRotation fs.ulink");
								return;
							}
							if (i < results.length) {
								renameOld();
							}else {
								renameCurrent();
							}
					});
					
				} else {
					fs.rename(file.oldFileName, file.newFileName, function(err) {
							if (err) {
								me._eexception.call(me, err, "_doFileRotation fs.rename");
								return;
							}
							if (i < results.length) {
								renameOld();
							}else {
								renameCurrent();
							}
					});
				}
			};
			
			for (i = 0; i < files.length; i++) {
				file = files[i];
				matches = file.match(re);
				if (matches) {
					//me.log('files: ', files);
					//me.log('matches: ', matches);
					fileIndex = parseInt(matches[2], 10);
					newFileIndex = ++fileIndex;
					results.push({
							fileIndex: fileIndex,
							oldFileName: dirname + '/' + matches[0],
							newFileName: dirname + '/' + basename + '.' + formatIndex(newFileIndex, me._maxBackupFileNumberLength)	
					});
				}	
			}
			if (results.length > 0) {
				results.sort(function(a, b) {
						return b.fileIndex - a.fileIndex; 
				});
				i = 0;
				renameOld();
			} else {
				renameCurrent();
			}
	});
};



/** 
* Log only if verbose is positive
* @public
* @method
*/
LogToFile.prototype.log = function() {
	if (!this.verbose) {
		return;
	}
	var 
	args = arguments,
	v = parseInt((new Date()).getTime(), 10) + ' verbose LogToFile ' + path.basename(this.filePath) +'# ';
	args[0] = args[0].replace('\n', '\n' + v);
	args[0] = v.concat(args[0]);
	console.error.apply(console, args);
};


/**
* @private
*/
LogToFile.prototype._eexception = function(exception, more) {
	this.log('%s: "%s" (%s)', exception.code, exception.message, more);
	this.emit('error', exception);
};

/*******************************************************************************
* Exports
*******************************************************************************/
exports.create = function(config) { return new LogToFile(config); };

