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
util = require('util'),
zlib = require('zlib'),
DEFAULT_WRITE_DELAY = 200,
E_ERROR = 'error', // event
E_WRITTING = 'writting', // event
E_WRITTEN = 'written', // event
E_WRITE = 'write', // event
E_BACKUPED = 'backuped', // event
E_GZIPPING = 'gzipping', // event
E_GZIPPED = 'gzipped', // event
FE_TERMINATE = 'f_terminate', // fork only event
FE_CTOR = 'f_ctor', // fork only event
FE_DTOR = 'f_dtor', // fork only event
forkList = [];

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
			logFile._eemit.call(logFile, E_WRITTEN, logFile.filePath);
			logFile._waitDrain = false; // No more buffer to write, timer can restart
			return;
		}
		
		logFile._writableStream.write(buffer.b.slice(0, buffer.usedBytes));
		if (!logFile._waitDrain) {
			// If it's first time we start to write, we emit this event
			logFile._eemit.call(logFile, E_WRITTING, logFile.filePath);
			logFile._waitDrain = true; // Timer has not to run
		}
		logFile._eemit.call(logFile, E_WRITE, logFile.filePath);
		logFile._writtenSize += buffer.usedBytes;
		return;
	} 
	if(logFile._writtenSize !== 0 && logFile._buffers.length === 0) {
		logFile._eemit.call(logFile, E_WRITTEN, logFile.filePath);
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
* @class LogToFile
* @params config.fileName {string} 
* @params config.directory {string} 
* @params [config.writeDelay] {number} Buffer flushed timming (default 200ms)
* @params [config.bufferSize] {number} Buffer blocks size (default 65536o) 
* @params [config.fileMaxSize] {number} Max file size (default 5MB) 
* @params [config.maxBackupFileNumber] {number} Max backup file number (default 10) 
* @params [config.gzipBackupFile] {boolean} gzip backup files (default false) 
* @params [config.compressionLevel] {number} [1-9] 1: BEST_SPEED, 9: BEST_COMPRESSION, default to 1
* @event error({object} exception)
* @event writting({string} filePath): starting to write everything
* @event written({string} filePath): everything is written
* @event backuped({string} filePath, {string} newFilePath): filePath was renamed to newFilePath
* @event gzipping({string} filePath, {string} gzippedFilePath): starting to gzip filePath to gzippedFilePath
* @event gzipped({string} filePath, {string} gzippedFilePath): filePath was gzipped to gzippedFilePath
* @error EEMPTYFILENAME
* @error EDIRNOTFOUND
* @error EEMPTYDIRECTORY
*/
var LogToFile = function (config){ // ctor
	EventEmitter.call(this);
	var 
	me = this;	
	
	config = config || {};
	
	//MUST BE SET FIRST
	this._forkHandle = -1; // Not a fork
	
	// Config
	this.fileName = config.fileName || '';
	if (this.fileName === '') {
		this._eexception({
				code: 'EEMPTYFILENAME',
				message: 'fileName config is not set'
		},'ctor');
		return;
	}
	
	this.directory = config.directory || '';
	if (this.directory === '') {
		this._eexception({
				code: 'EEMPTYDIRECTORY',
				message: 'directory config is not set'
		},'ctor');
		return;
	}
	this.directory = path.resolve(config.directory);	
	// Directory sync test
	if (!path.existsSync(this.directory)) {
		this._eexception({
				code: 'EDIRNOTFOUND',
				message: 'Directory not found: "' + this.directory + '"'
		}, 'ctor');
		return;
	}
	this.filePath = path.normalize(this.directory + '/' + this.fileName);
	this.writeDelay = Math.max(config.writeDelay || DEFAULT_WRITE_DELAY, 10); // Buffer is flushed every 200 ms, min 10
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
			me._writableStream.on('error', function(err, fd) {
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
* @param {string} string
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
				me._eexception.call(me, err, "_doFileRotation fs.readdir");
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
				me._eemit.call(me, E_GZIPPING, filePath, gzippedFilePath);
				me.log('gzipping %s...', filePath);
				compressReadStream = fs.createReadStream(filePath);
				compressWriteStream = fs.createWriteStream(gzippedFilePath);
				compressWriteStream.on('close', function() {
						me._eemit.call(me, E_GZIPPED, filePath, gzippedFilePath);
						me.log('"%s" compression done.', filePath);
						fs.unlink(filePath, function() {
								me.log("me._createWriteStream.call(me, 1);");	
								
								// create new stream and write now.
								me._createWriteStream.call(me, 1);
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
								me._eexception.call(me, err, "_doFileRotation fs.unlink");
								return;
							}
							// create new stream and write now.
							me._createWriteStream.call(me, 1);							
					});
				} else {
					fs.rename(me.filePath, filePath, function(err) {
							if (err) {
								me._eexception.call(me, err, "_doFileRotation fs.rename");
								return;
							}
							me._eemit.call(me, E_BACKUPED, oldFilePath, filePath);
							if (me.gzipBackupFile) {
								compressFile(filePath);
							} else {
								// create new stream and write now.
								me._createWriteStream.call(me, 1);
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
LogToFile.prototype._eexception = function(exception, more) {
	var 
	error;
	
	this.log('%s: "%s" (%s)', exception.code, exception.message, more);
	
	if (this._forkHandle === -1) {
		error = new Error(exception.message);
		error.code = exception.code;
		this.emit(E_ERROR, error);
	} else {
		process.send({
				_event: E_ERROR,
				_handle: this._forkHandle,
				code: exception.code, 
				message: exception.message
		});
		throw new Error();
	}
};

/**
*@private
*/
LogToFile.prototype._eemit = function(event){
	if (this._forkHandle === -1) {
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
		
	} else {
		this.log('Child send event: ', arguments);
		switch(arguments[0])
		{
		case E_WRITTING:
		case E_WRITE:
		case E_WRITTEN:
			process.send({
					_event: arguments[0],
					_handle: this._forkHandle,
					filePath: arguments[1]
			});
			break;
			
		case E_BACKUPED:
			process.send({
					_event: arguments[0],
					_handle: this._forkHandle,
					oldFilePath: arguments[1],
					filePath: arguments[2]
			});
			break;
			
		case E_GZIPPING:
		case E_GZIPPED:
			process.send({
					_event: arguments[0],
					_handle: this._forkHandle,
					filePath: arguments[1],
					gzipFilePath: arguments[2]
			});
			break;
		default:
			throw new Error('LogToFile.prototype._eemit: event no managed (' + arguments[0] + ')');
		}
	}
};


function getForkListMaxWriteDelay()
{
	var 
	i, 
	result = DEFAULT_WRITE_DELAY + 1;
	
	for(i = 0; i < forkList.length; ++i) {
		result = Math.max(forkList[i].writeDelay + 1, result);
	}
	return result;
}



// Fork interface
process.on('message', function(m) {
		var 
		forkHandle,
		verbose = m.verbose || false;
		
		if (verbose) {
			console.log('Child (%d) receive %s event', process.pid, m._event);
		}
		switch(m._event) {
		case FE_TERMINATE:
			setTimeout(function () {
					process.exit(0);
			}, getForkListMaxWriteDelay());
			break;
			
			
		case FE_CTOR: 
			forkHandle = forkList.length;
			try {
				forkList.push(new LogToFile(m));
				forkList[forkHandle]._forkHandle = forkHandle;
				process.send({
						_event: FE_CTOR,
						_handle: forkHandle,
						fileName: m.fileName,
						directory: m.directory,
						writeDelay: m.writeDelay,
						bufferSize: m.bufferSize,
						fileMaxSize:  m.fileMaxSize,
						maxBackupFileNumber: m.maxBackupFileNumber,
						gzipBackupFile: m.gzipBackupFile,
						compressionLevel: m.compressionLevel
				});
			}catch(err) {
				if (verbose) {
					console.log('Child (%d) FE_CTOR exception: ', process.pid, err);
				}
				process.send({
						_event: E_ERROR,
						code: err.code, 
						message: err.message
				});
				process.exit(1);
			}
			break;
			
		case FE_DTOR: 
			setTimeout(function () {
					if (forkList.hasOwnProperty(m._handle)) {
						forkList.splice(m._handle, 1);
						process.send({
								_event: FE_DTOR,
								_handle: m._handle
						});
					}
			}, getForkListMaxWriteDelay());
			break;
			
		case E_WRITE:
			forkList[m._handle].write(m.string);
			break;
			
		default:
			throw new Error('(child) process.on("message": unmanaged event(' + m._event + ')');
		}
});


/*******************************************************************************
* Exports
*******************************************************************************/
exports.create = function(config) { return new LogToFile(config); };
exports.FE_TERMINATE = FE_TERMINATE;
exports.FE_CTOR = FE_CTOR;
exports.FE_DTOR = FE_DTOR;
exports.E_ERROR = E_ERROR;
exports.E_WRITTING = E_WRITTING;
exports.E_WRITE = E_WRITE;
exports.E_WRITTEN = E_WRITTEN;
exports.E_BACKUPED = E_BACKUPED;
exports.E_GZIPPING = E_GZIPPING;
exports.E_GZIPPED = E_GZIPPED;

