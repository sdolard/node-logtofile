# node-log-to-file
A simple and fast log writer for node js. 
Rotation and compression (gzip) are supported.

* http://nodejs.org

## Installation with npm > TODO
### Installing npm (node package manager: http://npmjs.org/)

```
curl http://npmjs.org/install.sh || sh	
```

### Installing log-to-file

```
[sudo] npm install [-g] log-to-file
```


## Usage
### Basic 
```javascript
logToFile = require('log-to-file'),
log = logToFile.create({
		directory: __dirname/log,
		fileName: 'log.txt'
});
log.write('hello world');
		
```


## Exports 
```javascript
/**
* @class
* @params config.fileName {string} 
* @params config.directory {string} 
* @params [config.writeDelay] {number} Buffer flushed timming (default 200ms)
* @params [config.bufferSize] {number} Buffer blocks size (default 65536o) 
* @params [config.fileMaxSize] {number} Max file size (default 5MB) 
* @params [config.maxBackupFileNumber] {number} Max backup file number (default 10) 
* @params [config.gzipBackupFile] {boolean} gzip backup files (default false) 
* @event error({object} exception)
* @event writting({string} filePath): starting to write everything
* @event written({string} filePath): everything is written
* @event backuped({string} filePath, {string} newFilePath): filePath was renamed to newFilePath
* @event gzipping({string} filePath, {string} gzippedFilePath): starting to gzip filePath to gzippedFilePath
* @event gzipped({string} filePath, {string} gzippedFilePath): filePath was gzipped to gzippedFilePath
* @throw EEMPTYFILENAME
* @throw EDIRNOTFOUND
* @throw EEMPTYDIRECTORY
*/
```

## Known issues

## Test
Just run test/run_test.js

## Bench
Just run test/log-to-file-bench.js

## License
node-log-to-file is licensed under the MIT license.