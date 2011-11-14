# node-log-to-file
A simple log writer for node js. 
Rotation and compression (gzip) are supported.


* http://nodejs.org

## Installation with npm 
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
```
This will create log files following this naming convention:
	original:    fileName [+ '.' +  fileExt]
	rotation:    filename [+ '.' +  fileExt] + '.' + fileIndex 
	compression: filename [+ '.' +  fileExt] + '.' + fileIndex + '.gz'

Older files have got bigger index:
-rw-r--r--   1 sebastiend  staff  1769472 14 nov 15:38 benchtest.txt
-rw-r--r--   1 sebastiend  staff  5242880 14 nov 15:39 benchtest.txt.0
-rw-r--r--   1 sebastiend  staff  5242880 14 nov 15:40 benchtest.txt.1
-rw-r--r--   1 sebastiend  staff  5242880 14 nov 15:41 benchtest.txt.2
-rw-r--r--   1 sebastiend  staff  5242880 14 nov 15:42 benchtest.txt.3
-rw-r--r--   1 sebastiend  staff  5242880 14 nov 15:43 benchtest.txt.4

Older files have got bigger index, with gzip enabled
-rw-r--r--   1 sebastiend  staff  5242880 14 nov 15:40 benchtest.txt
-rw-r--r--   1 sebastiend  staff     5129 14 nov 15:41 benchtest.txt.0.gz
-rw-r--r--   1 sebastiend  staff     5129 14 nov 15:42 benchtest.txt.1.gz
-rw-r--r--   1 sebastiend  staff     5129 14 nov 15:43 benchtest.txt.2.gz
-rw-r--r--   1 sebastiend  staff     5129 14 nov 15:44 benchtest.txt.3.gz
-rw-r--r--   1 sebastiend  staff     5129 14 nov 15:45 benchtest.txt.4.gz

```

## Exports 
### 'create'
Returns a LogToFile instance.

```
/**
* @class LogToFile
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

```
Bench on my MacBook Pro 10.6.8, 2.53GHz Intel Core 2 Duo, 7200 HDD) with node 0.6.0:
Running bench 0. fileMaxSize: 5.00MB, maxBackupFileNumber: 0, gzipBackupFile: 0
................Total:1.00GB in 14224ms: 71.99MB/s
Running bench 1. fileMaxSize: 5.00MB, maxBackupFileNumber: 0, gzipBackupFile: 1
................Total:1.00GB in 14026ms: 73.01MB/s
Running bench 2. fileMaxSize: 5.00MB, maxBackupFileNumber: 5, gzipBackupFile: 0
................Total:1.00GB in 11164ms: 91.72MB/s
Running bench 3. fileMaxSize: 5.00MB, maxBackupFileNumber: 10, gzipBackupFile: 0
................Total:1.00GB in 10869ms: 94.21MB/s
Running bench 4. fileMaxSize: 10.00MB, maxBackupFileNumber: 10, gzipBackupFile: 0
................Total:1.00GB in 11778ms: 86.94MB/s
Running bench 5. fileMaxSize: 5.00MB, maxBackupFileNumber: 5, gzipBackupFile: 1
................Total:1.00GB in 25461ms: 40.22MB/s
Running bench 6. fileMaxSize: 5.00MB, maxBackupFileNumber: 10, gzipBackupFile: 1
................Total:1.00GB in 34820ms: 29.41MB/s
Running bench 7. fileMaxSize: 10.00MB, maxBackupFileNumber: 10, gzipBackupFile: 1
................Total:1.00GB in 42160ms: 24.29MB/s
All done
```

## License
node-log-to-file is licensed under the MIT license.