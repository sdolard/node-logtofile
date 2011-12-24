var
path = require('path'),
util = require('util'),
fs = require('fs'),
logToFile = require('../lib/logtofile'),
dataTest = '0',
ONE_K = 1024,
ONE_M = ONE_K * 1024,
ONE_G = ONE_M * 1024,
ONE_T = ONE_G * 1024,
i, tmp = '',
benchParams = [
	{
		//verbose: true,
		fileMaxSize:  ONE_M * 5,
		maxBackupFileNumber: 0
	},
	{
		fileMaxSize:  ONE_M * 5,
		maxBackupFileNumber: 1
	},
	{
		fileMaxSize:  ONE_M * 5,
		maxBackupFileNumber: 1,
		gzipBackupFile: true,
		compressionLevel: 1
	},
	{
		fileMaxSize:  ONE_M * 5,
		maxBackupFileNumber: 1,
		gzipBackupFile: true,
		compressionLevel: 9
	},
	{ 
		fileMaxSize: ONE_M * 5,
		maxBackupFileNumber: 5
	},
	{ 
		fileMaxSize: ONE_M * 5,
		maxBackupFileNumber: 5,
		gzipBackupFile: true,
		compressionLevel: 1
	},
	{ 
		fileMaxSize: ONE_M * 5,
		maxBackupFileNumber: 5,
		gzipBackupFile: true,
		compressionLevel: 9
	},
	{ 
		fileMaxSize: ONE_M * 5,
		maxBackupFileNumber: 10
	},
	{ 
		fileMaxSize: ONE_M * 5,
		maxBackupFileNumber: 10,
		gzipBackupFile: true
	},
	{
		fileMaxSize:  ONE_M * 10,
		maxBackupFileNumber: 10
	},
	{
		fileMaxSize:  ONE_M * 10,
		maxBackupFileNumber: 10,
		gzipBackupFile: true,
		compressionLevel: 1
	},
	{
		fileMaxSize:  ONE_M * 10,
		maxBackupFileNumber: 10,
		gzipBackupFile: true,
		compressionLevel: 9
}], bi = 0;

for ( i = 0; i < 1024; ++i) {
	tmp += dataTest; // 1Ko
}
dataTest = tmp;

function octetToHuman(o) {
	if (o < ONE_K) {
		return String(o) + 'O';
	}
	if (o < ONE_M) {
		return (o / ONE_K).toFixed(2) + 'K';
	}
	if (o < ONE_G) {
		return (o / ONE_M).toFixed(2) + 'MB';
	}
	if (o < ONE_T) {
		return (o / ONE_G).toFixed(2) + 'GB';
	}
	
	return (o / ONE_T).toFixed(2) + 'TB';
}


function cleanup() {
	dirs  = fs.readdirSync(__dirname);
	RE = /benchtest.txt.*/i;
	for (i = 0; i < dirs.length; i++)
	{
		if (!RE.test(dirs[i])){
			continue;
		}
		fs.unlinkSync(path.normalize(__dirname + '/' + dirs[i]));	
	}
}

function runTest() {
	
	var 
	size = 0,
	log,
	elements = 1024 * 1024, 
	start, end, writtingEventCount = 0,
	wcount=0,
	config = benchParams[bi];
	
	if (benchParams.length === bi) {
		bi = 0;
		//setTimeout(runTestFork, 10);
		return;
	}
	if (bi === 0) {
		console.log('---------------------------------------------------------');
		console.log('Starting standard benchs');
		console.log('---------------------------------------------------------');
	}
	
	log = logToFile.create({
			directory: __dirname,
			fileName: 'benchtest.txt',
			fileMaxSize: config.fileMaxSize,
			maxBackupFileNumber: config.maxBackupFileNumber,
			gzipBackupFile: config.gzipBackupFile || false,
			compressionLevel: config.compressionLevel || 1,
			verbose: config.verbose || false
	});
	console.log('Running bench %d. fileMaxSize: %s, maxBackupFileNumber: %d, gzipBackupFile: %d(%s)', bi, 
		octetToHuman(log.fileMaxSize), 
		log.maxBackupFileNumber,
		log.gzipBackupFile,
		log.gzipBackupFile ? String(log.compressionLevel) : '-');
	bi++;
	log.on('writting', function(fileName){
			writtingEventCount ++; 
	});
	
	log.on('write', function(fileName){
			if (wcount % 1024 === 0) {
				util.print(".");
			}
			wcount++;
	});
	
	log.on('written', function(fileName){
			var duration;
			end = Date.now();
			duration = end - start;
			console.log('Total:%s in %dms: %s/s', 
				octetToHuman(size), 
				duration, 
				octetToHuman(size * 1000 / duration));
			
			setTimeout(cleanup, 10);
			setTimeout(runTest, 10);			
	});
	log.on('error', function(err){
			console.log(err);
	});
	
	for (i = 0; i < elements; i++) {
		log.write(dataTest); 
		size += dataTest.length;
	}
	start = Date.now();
}


cleanup();
runTest();

