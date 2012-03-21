/*
Copyright © 2012 by Sebastien Dolard (sdolard@gmail.com)


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
path = require('path'),
fs = require('fs'),
EventEmitter = require('events').EventEmitter,
util = require('util'),
zlib = require('zlib'),
DEFAULT_WRITE_DELAY = 200,
E_ERROR = 'error', // event
E_WRITTING = 'writting', // event
E_WRITTEN = 'written', // event
E_WRITE = 'write', // event
E_BACKUPED = 'backuped', // event
E_GZIPPING = 'gzipping', // event
E_GZIPPED = 'gzipped'; // event


/**
* @private
* Timer callback
* It can be called to in buffer drain context
*/
function onTimeout(logFile, origin) {
	// Two possible origin
	// - drain
	// - timeout
	if (origin === 'timeout') { 
		logFile._timeoutId = -1; 
	}
	//logFile.log('onTimeout: origin: %s ', origin);
	if (logFile._rotationPending) {
		return;
	}
	
	if (logFile._writtenSize < logFile.fileMaxSize) {
		var buffer = logFile._buffers.shift();
		if (!buffer) {
			logFile._eemit(E_WRITTEN, logFile.filePath);
			logFile._waitDrain = false; // No more buffer to write, timer can restart
			return;
		}
		
		logFile._writableStream.write(buffer.b.slice(0, buffer.usedBytes));
		if (!logFile._waitDrain) {
			// If it's first time we start to write, we emit this event
			logFile._eemit(E_WRITTING, logFile.filePath);
			logFile._waitDrain = true; // Timer has not to run
		}
		logFile._eemit(E_WRITE, logFile.filePath);
		logFile._writtenSize += buffer.usedBytes;
		return;
	} 
	if(logFile._writtenSize !== 0 && logFile._buffers.length === 0) {
		logFile._eemit(E_WRITTEN, logFile.filePath);
	}
	logFile._rotationPending = true;
	logFile._writableStream.destroySoon(); // this will flush before then close
}

/**
* @private
* Give a formated index: complete with 0
* @param {number} index value
* @param {number} length of string that represent index
* @returns {string} formated index
*/
function formatIndex(index, length) {
	index = String(index);
	while (index.length < length) {
		index = '0' + index;
	}
	return index;
}

/**
* @public
* @class LogToFile
*
* @params {string} config.fileName
* @params {string} config.directory
* @params {number} [config.writeDelay] Buffer flushed timming (default 200ms)
* @params {number} [config.bufferSize] Buffer blocks size (default 65536o) 
* @params {number} [config.fileMaxSize] Max file size in octet (default 5MB) 
* @params {number} [config.maxBackupFileNumber] Max backup file number (default 10) 
* @params {boolean} [config.gzipBackupFile] gzip backup files (default false) 
* @params {number} [config.compressionLevel] [1-9] 1: BEST_SPEED, 9: BEST_COMPRESSION, default to 1
* @params {boolean} [config.verbose] enable verbose mode, default to false
*
* @event error({object} exception): when an async exception occured
* @event writting({string} filePath): when starting to write buffered data
* @event write(): when something was juste write
* @event written({string} filePath): when every buffered data have been written
* @event backuped({string} filePath, {string} newFilePath): when filePath was renamed to newFilePath
* @event gzipping({string} filePath, {string} gzippedFilePath): when starting to gzip filePath to gzippedFilePath
* @event gzipped({string} filePath, {string} gzippedFilePath): when filePath was gzipped to gzippedFilePath
*
* @throws EEMPTYFILENAME: when config.filename is not set
* @throws EEMPTYDIRECTORY: when config.directory is not set
* @throws EDIRNOTFOUND: when config.directory does not exist
*/
var LogToFile = function (config){ // ctor
	EventEmitter.call(this);
	var 
	me = this;	
	
	config = config || {};
	
	// Config
	this.fileName = config.fileName || '';
	if (this.fileName === '') {
		this._eexception({
				code: 'EEMPTYFILENAME',
				message: 'fileName config is not set'
		});
		return;
	}
	
	this.directory = config.directory || '';
	if (this.directory === '') {
		this._eexception({
				code: 'EEMPTYDIRECTORY',
				message: 'directory config is not set'
		});
		return;
	}
	this.directory = path.resolve(config.directory);	
	// Directory sync test
	if (!path.existsSync(this.directory)) {
		this._eexception({
				code: 'EDIRNOTFOUND',
				message: 'Directory not found: "' + this.directory + '"'
		});
		return;
	}
	this.filePath = path.normalize(this.directory + '/' + this.fileName);

	this.writeDelay = config.writeDelay === undefined ? DEFAULT_WRITE_DELAY : config.writeDelay;
	this.writeDelay = Math.max(this.writeDelay, 10); // Buffer is flushed every 200 ms, min 10
	
	this.bufferSize = Math.max(config.bufferSize || 65536, 4096); // Buffer blocks size, min 4096o
	this.fileMaxSize = config.fileMaxSize || 1024 * 1024 * 5;
	//this.fileMaxSize = Math.max(config.fileMaxSize || 1024 * 1024 * 5, 1024 * 1024); // 5MB, min 1MB
	this.maxBackupFileNumber = config.maxBackupFileNumber; // Min 0
	if (this.maxBackupFileNumber === undefined) {
		this.maxBackupFileNumber = 10;
	}else { 
		if (this.maxBackupFileNumber < 0) {
			this.maxBackupFileNumber = 0;
		}
	}
	this.gzipBackupFile = config.gzipBackupFile || false;
	this.compressionLevel = config.compressionLevel || 1;
	if (this.compressionLevel < 1 || this.compressionLevel > 9){
		this.compressionLevel = 1;
	}
	this.verbose = config.verbose || false;
	
	this._buffers = []; // Array of buffer to write 
	this._timeoutId = -1; // write timer
	this._waitDrain = false; // Drain flag
	this._writtenSize = 0; // Quantity of data written. Initialized in _createWriteStream
	this._rotationPending = false; // File rotation flag
	this._maxBackupFileNumberLength = String(this.maxBackupFileNumber).length;
	
	this._createWriteStream(); // We create first stream
	
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
				me._eexception(err);
				return;
			}
			me._writtenSize = stats ? stats.size : 0;
			me._rotationPending = false;
			me._waitDrain = false;
			
			// Writable stream
			me._writableStream = fs.createWriteStream(me.filePath, {
					flags: 'a'
			}); 
			me._writableStream.on('error', function(err, fd) {
					me._eexception(err);
			});
			
			// Emitted when the underlying file descriptor has been closed.	
			me._writableStream.on('close', function() {
					if (me._rotationPending) {
						delete me._writableStream;
						me._doFileRotation();
					}
			});
			
			// Emitted after a write() method was called that returned false to indicate that it is safe to write again.
			me._writableStream.on('drain', function() {
					onTimeout(me, 'drain'); // we write next buffer, if there is
			});
			
			me.log('me._restartTimeout(delay): %d', delay);
			me._restartTimeout(delay);
	});
};

/**
* @private
*/
function write(logFile, string) {
	var 
	stringLength = Buffer.byteLength(string),
	buffer = logFile._getBuffer();
	
	// Enought place in current buffer?
	if (buffer.usedBytes + stringLength > logFile.bufferSize) { 
		buffer = logFile._addBuffer();
	}
	
	buffer.b.write(string, buffer.usedBytes);
	buffer.usedBytes += stringLength;
	
	logFile._restartTimeout();
}

/**
* @public
* @param {string} string
*/
LogToFile.prototype.write = function(string) {
	var 
	me = this;
	process.nextTick(function(){
			write(me, string);
	});
	return this;
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
	!this._writableStream || // there is still no write stream
	this._buffers.length === 0) { // there is nothing to write
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
	basename = path.basename(this.filePath),
	filePath = path.normalize(dirname + '/' + basename + "."+ formatIndex(0, me._maxBackupFileNumberLength));
	
	fs.readdir(dirname, function(err, files) {
			if (err) {
				me._eexception(err);
				return;
			}
			var 
			i,
			results = [], 
			fileIndex,
			newFileIndex,
			re = new RegExp('(^' + basename + ').(\\d+)(\\.gz)?'), 
			compressReadStream,
			compressWriteStream,
			gzip, gzipExt = '',
			compressFile = function(filePath) {
				var 
				gzippedFilePath = filePath + '.gz';
				me._eemit(E_GZIPPING, filePath, gzippedFilePath);
				me.log('gzipping %s...', filePath);
				compressReadStream = fs.createReadStream(filePath);
				compressWriteStream = fs.createWriteStream(gzippedFilePath);
				compressWriteStream.on('close', function() {
						me._eemit(E_GZIPPED, filePath, gzippedFilePath);
						me.log('"%s" compression done.', filePath);
						fs.unlink(filePath, function() {
								me.log("me._createWriteStream(1);");	
								
								// create new stream and write now.
								me._createWriteStream(1);
						});
				});
				gzip = zlib.createGzip({
						chunkSize: me.bufferSize,
						level: me.compressionLevel
				});
				compressReadStream.pipe(gzip).pipe(compressWriteStream);
			},
			renameCurrent = function() {
				if (me.maxBackupFileNumber === 0) {
					fs.unlink(me.filePath, function(err) {
							if (err) {
								me._eexception(err);
								return;
							}
							// create new stream and write now.
							me._createWriteStream(1);							
					});
				} else {
					fs.rename(me.filePath, filePath, function(err) {
							if (err) {
								me._eexception(err);
								return;
							}
							me._eemit(E_BACKUPED, oldFilePath, filePath);
							if (me.gzipBackupFile) {
								compressFile(filePath);
							} else {
								// create new stream and write now.
								me._createWriteStream(1);
							}
							
					});
				}
				
			},
			renameOld = function() {
				file = results[i];
				i++;
				if(file.fileIndex >= me.maxBackupFileNumber) {
					fs.unlink(file.oldFileName, function(err) {
							if (err) {
								me._eexception(err);
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
								me._eexception(err);
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
					fileIndex = parseInt(matches[2], 10);
					newFileIndex = ++fileIndex;
					gzipExt = matches[3] === undefined ? '' : matches[3];
					
					results.push({
							fileIndex: fileIndex,
							oldFileName: path.normalize(dirname + '/' + matches[0]),
							newFileName: path.normalize(dirname + '/' + basename + '.' + formatIndex(newFileIndex, me._maxBackupFileNumberLength) + gzipExt)
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
LogToFile.prototype._eexception = function(exception) {
	var error;
	if (exception instanceof Error) {
		error = exception;
	} else {
		error = new Error(exception.message);
		Error.captureStackTrace(error, LogToFile.prototype._eexception); // we do not trace this function
		error.code = exception.code;
	}
	
	this.emit(E_ERROR, error);
	if (this.verbose) {
		console.log(error.stack);
	}
};

/**
*@private
*/
LogToFile.prototype._eemit = function(event){
	switch(arguments.length) {
	case 2:
		this.emit(arguments[0], arguments[1]);
		break;
	case 3:
		this.emit(arguments[0], arguments[1], arguments[2]);
		break;
	default:
		throw new Error('LogToFile.prototype._eemit: argument(s) missing');
	}	
};



/*******************************************************************************
* Exports
*******************************************************************************/
exports.create = function(config) { return new LogToFile(config); };
exports.E_ERROR = E_ERROR;
exports.E_WRITTING = E_WRITTING;
exports.E_WRITE = E_WRITE;
exports.E_WRITTEN = E_WRITTEN;
exports.E_BACKUPED = E_BACKUPED;
exports.E_GZIPPING = E_GZIPPING;
exports.E_GZIPPED = E_GZIPPED;

