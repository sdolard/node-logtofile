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
path = require('path'),
EventEmitter = require('events').EventEmitter,
util = require('util'),
cp = require('child_process'),
logToFile = require(__dirname + '/log-to-file.js');

function mergeObjects(){
    var 
    i = 0,
    prop,
    out = {};
    for(i = 0; i < arguments.length; ++i) {
    	for (prop in arguments[i]) { 
    		out[prop] = arguments[i][prop]; 
    	}
    	
    }
    return out;
}

/**
* @class LogToFileForker
* @param {object} config
* @param {function} callback: called after instanciation
*/
var LogToFileForker = function (config, callback){ // ctor
	EventEmitter.call(this);	
	var 
	me = this;
	
	
	if(callback) {
		this.once(logToFile.FE_CTOR, callback);
	}
	
	this.verbose = config.verbose || false;
	this._fileHandle = -1; 
	this._fork = cp.fork(__dirname + '/log-to-file.js');
	
	this._fork.on('message', function(m) {
			me.log('Parent receive message: ', m);
			
			switch(m._event) {
			case logToFile.FE_TERMINATE: 
				break;
				
			case logToFile.FE_CTOR:
				me._fileHandle = m._handle;
				me.emit(m._event, m);
				break;
				
			case logToFile.FE_DTOR:
				if (me._fileHandle === m._handle) {
					me._fileHandle = -1;
				}
				break;
				
			case logToFile.E_ERROR: 
				me.emit(m._event, m);
				break;
			
			case logToFile.E_WRITTING: 
			case logToFile.E_WRITE:
			case logToFile.E_WRITTEN:
				me.emit(m._event, m.filePath);
				break;
				
			case logToFile.E_BACKUPED: 
				me.emit(m._event, m.oldFilePath, ms.filePath);
				break;
					
			case logToFile.E_GZIPPING: 
			case logToFile.E_GZIPPED: 
				me.emit(m._event, m.filePath, m.gzipFilePath);
				break;
			default:
				throw new Error('Parent receive an unknown message:' + m._event);
			}
	});
	
	this._fork.on('exit', function (code, signal) {
			if (code === 0) {
				return;
			}
			me.log('child process terminated (code: %d; signal: %s)', code, signal);
	});
	
	
	this.log('Parent send event: ', logToFile.FE_CTOR);
	this._fork.send(mergeObjects({
			_event: logToFile.FE_CTOR
	}, config));
	
};
util.inherits(LogToFileForker, EventEmitter);


/** 
* Log only if verbose is positive
* @public
* @method
*/
LogToFileForker.prototype.log = function() {
	if (!this.verbose) {
		return;
	}
	var 
	args = arguments,
	v = parseInt((new Date()).getTime(), 10) + ' verbose LogToFileForker# ';
	args[0] = args[0].replace('\n', '\n' + v);
	args[0] = v.concat(args[0]);
	console.error.apply(console, args);
};

/**
* @public
* @param {string} string
*/
LogToFileForker.prototype.write = function(string) {
	this.log('Parent send event: ', logToFile.E_WRITE);
	// TODO: a test to check if process is alive?
	this._fork.send({
			_event: logToFile.E_WRITE,
			_handle: this._fileHandle,
			string: string
	});
};

/**
* @public
*/
LogToFileForker.prototype.terminate = function() {
	this.log('Parent send event: ', logToFile.FE_TERMINATE);
	// TODO: a test to check if process is alive?
	this._fork.send({
			_event: logToFile.FE_TERMINATE,
			_handle: this._fileHandle
	});
};


/*******************************************************************************
* Exports
*******************************************************************************/
exports.create = function(config, callback) { return new LogToFileForker(config, callback); };

