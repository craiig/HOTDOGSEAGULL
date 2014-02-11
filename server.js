var media_folder = "media"
var chromecast = require('./chromecast.js')

var fs = require('fs');
var dot = require('dot');
var express = require('express');
var path = require('path')
var ffmpeg = require('fluent-ffmpeg');

var app = express();

//declare simple templating engine using dot
app.engine('html', function(path, options, callback){
	fs.readFile(path, function(err, string){
		if (err) throw err;

		var tempFn = dot.template(string);
		options.app = app; //pass the app into the template
		options.require = require; //pass in require so we can use it in templates when we need it
		res = tempFn(options)
		callback(0, res)
	});
})

app.use(express.logger());

app.use('/static', express.static(__dirname + '/static'));

app.use('/static_media', express.static( path.resolve(__dirname, media_folder) ));

app.get('/', function(req, res){
	chromecast.read_dir(media_folder, "/", function(files){
		res.render('index.html', {files: files, dir: media_folder})	
	})
});

app.get('/viewfolder', function(req, res){
	dir = path.join("/", req.query.f)
	//res.send(dir)
	parentdir = path.join(dir, "../")
	chromecast.read_dir(media_folder, dir, function(files){
		res.render('index.html', {files: files, dir: dir, parentdir: parentdir})	
	})
});

app.get('/playfile', function(req, res){
	file_url = path.join("/static_media", req.query.f)
	transcode_url = path.join("/transcode?f=", req.query.f)

	chromecast.is_compatibile(path.join(media_folder, req.query.f), function(compat, data){
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
	res.contentType('video/mp4');

	// borrowed from the  ffmpeg-fluent examples
	pathToMovie = path.join(media_folder, req.query.f)

	chromecast.is_compatibile(pathToMovie, function(compat, data){

		console.log("calling transcode with options: "+[data.audio_transcode, data.video_transcode])
		var proc = new ffmpeg({ source: pathToMovie, nolog: true, timeout: 0 })
		// use the 'flashvideo' preset (located in /lib/presets/flashvideo.js)
		//.usingPreset('flashvideo')
		.toFormat('matroska')
		.addOptions( [data.audio_transcode, data.video_transcode] )
		//.withVideoCodec('copy')
		//.withAudioCodec('copy')
		// save to stream
		.writeToStream(res, function(retcode, error){
		console.log('transcoding finished: '+retcode+" error: "+error);
		});

	});
 
});

app.listen(3000);