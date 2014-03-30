//setup:
// 1. copy config.json from config.sample.js
// 2. edit config.json to change settings for this application

//load modules
var chromecast = require('./chromecast.js')
var fs = require('fs');
var dot = require('dot');
var express = require('express');
var path = require('path')
var util = require('util')

//attempt to load config file
var config = {};
try {
 config = require('./config');
} catch(err){
	if(err.code == "MODULE_NOT_FOUND"){
		//not found, so set up the default settings
		console.log("Warning: config.js not found, using defaults.");
	} else {
		throw err;
	}
}

//set some default configurations if we didn't find them in config.
if(!config.media_folder){
	config.media_folder = "media";
}
if(!config.listenPort){
	config.listenPort = 3000;
}
console.log("HOTDOGSEAGULL config:")
console.log(util.inspect(config));

//setup server
var app = express();

dot.templateSettings.strip = false;

//declare simple templating engine using dot
app.engine('html', function(path, options, callback){
	fs.readFile(path, function(err, string){
		if (err) throw err;

		var tempFn = dot.template(string);
		options.app = app; //pass the app into the template
		options.require = require; //pass in require so we can use it in templates when we need it
		res = tempFn(options);
		callback(0, res);
	});
})

app.set('views', path.join(__dirname + '/views'))

// define custom logging format
/*express.logger.format('detailed', function (token, req, res) {                                    
    return util.inspect(req.headers);
});  */

app.use(express.logger());

app.use('/static', express.static(__dirname + '/static'));

app.use('/static_media', express.static( path.resolve(__dirname, config.media_folder) ));

app.get('/', function(req, res){
	pathResolves = fs.existsSync(path.resolve(__dirname, config.media_folder));
	if (! pathResolves){
 		 res.render('error.html', {statusCode: '404', message: 'Invalid media directory. Set "config.media_folder" var in server.js to a valid local path.'});
	}
 	else{
		chromecast.get_dir_data(config.media_folder, '/', false, function(files){
			res.render('index.html', {files: files, dir: config.media_folder})	
		});
	}
});

app.get('/queue', function(req, res){
	pathResolves = fs.existsSync(path.resolve(__dirname, media_folder));
	if (! pathResolves){
 		 res.render('error.html', {statusCode: '404', message: 'Invalid media directory. Set "media_folder" var in server.js to a valid local path.'});
	}
 	else{
		chromecast.get_dir_data(media_folder, '/', false, function(files){
			res.render('index_queue.html', {files: files, dir: media_folder})	
		});
	}
});

app.get('/viewfolder', function(req, res){
	dir = path.join('/', req.query.f)
	//res.send(dir)
	parentdir = path.join(dir, '../')
	chromecast.get_dir_data(config.media_folder, dir, false, function(files){
		res.render('index.html', {files: files, dir: dir, parentdir: parentdir})	
	})
});

app.get('/playfile', function(req, res){
	file_url = path.join('/static_media', req.query.f)
	transcode_url = path.join('/transcode?f=', req.query.f)

	chromecast.get_file_data(path.join(config.media_folder, req.query.f), function(compat, data){
        	if (data.ffprobe_data == undefined) data.ffprobe_data = {streams: []};
		res.render('playfile.html', {
			query: req.query, 
			file_url: file_url,
			transcode_url: transcode_url,
			file_dir: path.dirname(req.query.f),
			file_name: path.basename(file_url),
			compatible: compat,
			compatibility_data: data
		});
	});
});

app.get('/transcode', function(req, res) {
	// borrowed from the  ffmpeg-fluent examples
	pathToMovie = path.join(config.media_folder, req.query.f)

	options = { }
	if(req.query.audiotrack){
		options.audiotrack = req.query.audiotrack
	}
	if(req.query.videotrack){
		options.videotrack = req.query.videotrack
	}
	if(req.query.subtitles){
		options.subtitle_path = path.join(path.dirname(pathToMovie), req.query.subtitles)
	}
	if(req.query.subtitletrack){
		options.subtitletrack = req.query.subtitletrack
	}

	chromecast.transcode_stream(pathToMovie, res, options, '', function(err, ffmpeg_error_code, ffmpeg_output){
		if(err){
			console.log('transcode error:');
			console.log(ffmpeg_output);
		} else {
			console.log('transcoding finished ffmpeg_output: ');
			console.log(ffmpeg_output);
		}
	});
});

app.listen(config.listenPort);
