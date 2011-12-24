# node-logtofile
A simple log writer for node js. 
Rotation and compression (gzip) are supported.


* http://nodejs.org

## Installation with npm 
### Installing npm (node package manager: http://npmjs.org/)

```
curl http://npmjs.org/install.sh || sh	
```

### Installing logtofile

```
[sudo] npm install [-g] logtofile
```


## Usage
### Basic 
```javascript
log = logToFile.create({
		directory: __dirname,
		fileName: 'log.txt'
});

log.on('error', function(err){
		console.log("Error: ", err);
});

log.on('writting', function(){
		// starting to write buffered data
});

log.on('write', function(){
		// something was juste written
});

log.on('written', function(filePath){
		// every buffered data have been written		
});

log.on('backuped', function (filePath, newFilePath) {
		// filePath was renamed to newFilePath
});

log.on('gzipping', function (filePath, newFilePath) {
		// starting to gzip filePath to gzippedFilePath
});

log.on('gzipped', function (filePath, newFilePath) {
		// filePath was gzipped to gzippedFilePath
});

log.write("hello world");

```


```
### Generated files
logtofile will create log files following this naming convention:
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
* @event written({string} filePath): when every buffered data  have been written
* @event backuped({string} filePath, {string} newFilePath): when filePath was renamed to newFilePath
* @event gzipping({string} filePath, {string} gzippedFilePath): when starting to gzip filePath to gzippedFilePath
* @event gzipped({string} filePath, {string} gzippedFilePath): when filePath was gzipped to gzippedFilePath
*
* @throws EEMPTYFILENAME: when config.filename is not set
* @throws EEMPTYDIRECTORY: when config.directory is not set
* @throws EDIRNOTFOUND: when config.directory does not exist
*/

```


## Known issues


## Test
Just run test/run_test.js

## Bench
Just run test/logtofile-bench.js

```
Bench on my MacBook Pro OS X 10.6.8, 2.53GHz Intel Core 2 Duo (P8700), 7200 HDD with node 0.6.1:
Running bench 0. fileMaxSize: 5.00MB, maxBackupFileNumber: 0, gzipBackupFile: 0
................Total:1.00GB in 22237ms: 46.05MB/s
Running bench 1. fileMaxSize: 5.00MB, maxBackupFileNumber: 1, gzipBackupFile: 0
................Total:1.00GB in 20359ms: 50.30MB/s
Running bench 2. fileMaxSize: 5.00MB, maxBackupFileNumber: 1, gzipBackupFile: 1
................Total:1.00GB in 26732ms: 38.31MB/s
Running bench 3. fileMaxSize: 5.00MB, maxBackupFileNumber: 5, gzipBackupFile: 0
................Total:1.00GB in 19261ms: 53.16MB/s
Running bench 4. fileMaxSize: 5.00MB, maxBackupFileNumber: 5, gzipBackupFile: 1
................Total:1.00GB in 27426ms: 37.34MB/s
Running bench 5. fileMaxSize: 5.00MB, maxBackupFileNumber: 10, gzipBackupFile: 0
................Total:1.00GB in 19366ms: 52.88MB/s
Running bench 6. fileMaxSize: 5.00MB, maxBackupFileNumber: 10, gzipBackupFile: 1
................Total:1.00GB in 30814ms: 33.23MB/s
Running bench 7. fileMaxSize: 10.00MB, maxBackupFileNumber: 10, gzipBackupFile: 0
................Total:1.00GB in 19676ms: 52.04MB/s
Running bench 8. fileMaxSize: 10.00MB, maxBackupFileNumber: 10, gzipBackupFile: 1
................Total:1.00GB in 33875ms: 30.23MB/s

All done

```

```
Bench on my Ubuntu 11.10 desktop, 3GHz Intel Core 2 Duo CPU (E8400), 7200 HDD with node 0.6.1:
Running bench 0. fileMaxSize: 5.00MB, maxBackupFileNumber: 0, gzipBackupFile: 0
................Total:1.00GB in 2447ms: 418.47MB/s
Running bench 1. fileMaxSize: 5.00MB, maxBackupFileNumber: 0, gzipBackupFile: 1
................Total:1.00GB in 2453ms: 417.45MB/s
Running bench 2. fileMaxSize: 5.00MB, maxBackupFileNumber: 5, gzipBackupFile: 0
................Total:1.00GB in 2578ms: 397.21MB/s
Running bench 3. fileMaxSize: 5.00MB, maxBackupFileNumber: 5, gzipBackupFile: 1
................Total:1.00GB in 9936ms: 103.06MB/s
Running bench 4. fileMaxSize: 5.00MB, maxBackupFileNumber: 10, gzipBackupFile: 0
................Total:1.00GB in 13173ms: 77.73MB/s
Running bench 5. fileMaxSize: 5.00MB, maxBackupFileNumber: 10, gzipBackupFile: 1
................Total:1.00GB in 9564ms: 107.07MB/s
Running bench 6. fileMaxSize: 10.00MB, maxBackupFileNumber: 10, gzipBackupFile: 0
................Total:1.00GB in 13550ms: 75.57MB/s
Running bench 7. fileMaxSize: 10.00MB, maxBackupFileNumber: 10, gzipBackupFile: 1
................Total:1.00GB in 9151ms: 111.90MB/s
All done

```


## License
node-logtofile is licensed under the MIT license.