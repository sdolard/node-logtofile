var 
fs = require('fs'),
path = require("path"),
RE_JS_FILE=/.*\.js$/i;

fs.readdir(__dirname, function (err, files) {
		var 
		i, 
		failures = 0, 
		file;
		
		for(i = 0; i < files.length; i++) {
			file = files[i];
			
			if (!RE_JS_FILE.test(file)) {
				continue;
			}	
			if (file === "run_test.js") {
				continue;
			}
			
			try {
				require(path.resolve(__dirname, file));
				console.log("OK - %s ", file);
			} catch (e) {
				console.log("KO - %s ", file, e);
				failures++;
			}
			
		}
		if (!failures) {
			return console.log("#all pass");
		}
		
		console.error("%d %s", failures, "failure" + (failures > 1 ? "s" : ""));
});