# node-log-to-file

A simple and fast log writer. Rotation is supported.

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

### Examples

## Exports 

## Known issues

## Test
Just run test/run_test.js


## License
node-log-to-file is licensed under the MIT license.