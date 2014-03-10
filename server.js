// change these per-installation
var media_folder = '/Volumes/Terratron/Movies';
var listenPort = 3000;

var chromecast = require('./chromecast.js')
var fs = require('fs');
var dot = require('dot');
var express = require('express');
var path = require('path')
var util = require('util')

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

app.use('/thumb', express.static( path.resolve(__dirname, media_folder) ));
app.use('/static', express.static(__dirname + '/static'));
app.use('/static_media', express.static( path.resolve(__dirname, media_folder) ));

app.get('/', function(req, res){
	pathResolves = fs.existsSync(path.resolve(__dirname, media_folder));
	if (! pathResolves){
 		 res.render('error.html', {statusCode: '404', message: 'Invalid media directory. Set "media_folder" var in server.js to a valid local path.'});
	}
 	else{
		chromecast.get_dir_data(media_folder, '/', false, function(files){
			res.render('index.html', {files: files, dir: media_folder})	
		});
	}
});

app.get('/viewfolder', function(req, res){
	var ignoredFiles = ['.DS_Store','.localized','.thumbs'];
	dir = path.join('/', req.query.f)
	//res.send(dir)
	parentdir = path.join(dir, '../')
	chromecast.get_dir_data(media_folder, dir, false, function(files){
		for (var file in files) {
			file_basename = path.basename(file);
			if (!files[file].is_dir && ignoredFiles.indexOf(file_basename) < 0 && ignoredFiles.indexOf(path.basename(dir)) < 0) {
				options = {
				 'video_path': media_folder + file,
				 'thumbnail_path': media_folder + dir + '/.thumbs/',
				 'thumbnail_name': path.basename(file) + '.thumb'
				};
				if (! fs.existsSync(options.thumbnail_path)){
					fs.mkdirSync(options.thumbnail_path, 0755, function(err){ console.log('Could not create .thumbs subdirectory: ' + err); });
				}
				if (! fs.existsSync(options.thumbnail_path + options.thumbnail_name + '.jpg')){
					chromecast.generate_thumbnail(files[file], options, function(err, ffmpeg_error_code, ffmpeg_output){ console.log(err); });
				}
				if (fs.existsSync(options.thumbnail_path + options.thumbnail_name + '.jpg')){
					files[file].thumbnail_src = '/thumb/' + dir + '/.thumbs/' + options.thumbnail_name + '.jpg';
					files[file].thumbnail_width = '160';
					files[file].thumbnail_height = '90';
				}
			}
		} res.render('index.html', {files: files, dir: dir, parentdir: parentdir})	
	})
});

app.get('/playfile', function(req, res){
	file_url = path.join('/static_media', req.query.f)
	transcode_url = path.join('/transcode?f=', req.query.f)

	chromecast.get_file_data(path.join(media_folder, req.query.f), function(compat, data){
		// if ffprobe failed, set empty streams array so render loop doesn't fail
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
	pathToMovie = path.join(media_folder, req.query.f)

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

app.listen(listenPort);
