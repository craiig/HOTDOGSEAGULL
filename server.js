var chromecast = require('./chromecast.js')
var fs = require('fs');
var dot = require('dot');
var express = require('express');
var path = require('path');
var util = require('util');
var mkdirp = require('mkdirp');

// read config.json vars, otherwise use frameowrk defaults
var config = require(__dirname + '/config.json');

// change per-installation in git-ignored config.json; or, override here like a n00b
config.name = config.name || 'HOTDOGSEAGULL';   // ridiculous; awesome;
config.listen_port  = config.listen_port || 30; // set to 80 for "normal" server
config.media_folder = config.media_folder || 'media';     // symlink local "media" dir to your media root
config.thumb_prefix = config.thumb_prefix || '';          // set to '/.thumbs' style uri for top level cache
config.thumb_suffix = config.thumb_suffix || '/.thumbs/'; // set to '/' if using top level cache (can NOT be empty string)
config.max_thumb_wait = config.max_thumb_wait || 4000; // wait for this many ms before just listing dir without all thumbs

// set global option arrays (these should be communal for the most part, not config-specific
var imageTypes = ['jpg','jpeg','png','webp','bmp','gif'];
var ignoredFiles = ['.DS_Store','.localized','.thumbs'];

// setup core frameworks
var app = express();
dot.templateSettings.strip = false;

// declare simple templating engine using dot
app.engine('html', function(path, options, callback) {
	fs.readFile(path, function(err, string) {
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

app.use('/thumb', express.static( path.resolve(__dirname, config.media_folder) ));
app.use('/static', express.static(__dirname + '/static'));
app.use('/static_media', express.static( path.resolve(__dirname, config.media_folder) ));

app.get('/', function(req, res) {
	pathResolves = fs.existsSync(path.resolve(__dirname, config.media_folder));
	if (! pathResolves) {
 		res.render('error.html', {statusCode: '404', message: 'Invalid media directory. Set "media_folder" var in server.js to a valid local path.'});
	}
 	else {
		chromecast.get_dir_data(config.media_folder, '/', false, function(files) {
			for (var file in files) {
				file_basename = path.basename(file);
                        	files[file].url_name = encodeURIComponent(file);
			}
			res.render('index.html', {files: files, dir: '/'})
		});
	}
});

app.get('/viewfolder', function(req, res) {
	dir = path.join('/', req.query.f);
	pathResolves = fs.existsSync(config.media_folder + dir);
	if (! pathResolves) {
 		res.render('error.html', {statusCode: '403', message: 'Invalid directory <b>' + config.media_folder + dir + '</b>. Ensure "media_folder" var in server.js refers to a valid local path, and check read permissions on this subdirectory.'});
		return;
	}

	//res.send(dir)
	parentdir = path.join(dir, '../')

	var thumb_dir = config.media_folder + config.thumb_prefix + dir + config.thumb_suffix;
	if (! fs.existsSync(thumb_dir)) {
		var newdir = mkdirp.sync(thumb_dir, '0755', function(err) { console.log('Could not create thumbs subdirectory: ' + err); });
	}

	chromecast.get_dir_data(config.media_folder, dir, false, function(files) {
		var generated_thumbs = 0;
		var speedo = 250; // wait in ms per generated thumb; default allows a fast system to display most initially, but won't slow down initial directory listing significantly when tons of new files found

		for (var file in files) {
			file_basename = path.basename(file);
                        files[file].url_name = encodeURIComponent(file);
			if (!files[file].is_dir && ignoredFiles.indexOf(file_basename) < 0 && ignoredFiles.indexOf(path.basename(dir)) < 0) {
				options = {
				 'video_path': config.media_folder + file,
				 'thumb_path': thumb_dir,
				 'thumb_name': path.basename(file) + '.thumb'
				};

				if (! fs.existsSync(options.thumb_path + options.thumb_name + '.jpg')) {
					if (imageTypes.indexOf(file_basename.split('.').pop()) < 0) {
						chromecast.generate_thumb(files[file], options, function(err, ffmpeg_error_code, ffmpeg_output) { console.log(err); });
						files[file].thumb_src = '/thumb' + config.thumb_prefix + escape(dir) + config.thumb_suffix + encodeURIComponent(options.thumb_name) + '.jpg';
						files[file].thumb_width = '160';
						files[file].thumb_height = '90';
						++generated_thumbs;
					}
					else {
						files[file].thumb_src = '/thumb' + escape(file);
						files[file].thumb_width = '120';
					}
				}
				else { // found a cached thumbnail, sweet
					files[file].thumb_src = '/thumb' + config.thumb_prefix + escape(dir) + config.thumb_suffix + encodeURIComponent(options.thumb_name) + '.jpg';
					files[file].thumb_width = '160';
					files[file].thumb_height = '90';
				}
			}
		}

		if (generated_thumbs) {
			console.log('Waiting ' + (generated_thumbs * speedo) +  ' ms for thumbnail generation...');
			setTimeout(function() { res.render('index.html', {files: files, dir: dir, parentdir: parentdir}) }, Math.min((generated_thumbs * speedo), config.max_thumb_wait));
		}
		else res.render('index.html', {files: files, dir: dir, parentdir: parentdir});
	})
});

app.get('/playfile', function(req, res) {
	file_url = path.join('/static_media', req.query.f)
	transcode_url = path.join('/transcode?f=', req.query.f)

	chromecast.get_file_data(path.join(config.media_folder, req.query.f), function(compat, data) {
		// if ffprobe failed, set empty streams array so render loop doesn't fail
        	if (data.ffprobe_data == undefined) data.ffprobe_data = {streams: []};

		res.render('playfile.html', {
			query: req.query, 
			file_url: file_url.replace('#','%23'),
			transcode_url: transcode_url.replace('#','%23'),
			file_dir: path.dirname(req.query.f).replace('#','%23'),
			file_name: path.basename(file_url),
			compatible: compat,
			compatibility_data: data
		});
	});
});

app.get('/transcode', function(req, res) {
	// borrowed from the  ffmpeg-fluent examples
	pathToMovie = path.join(config.media_folder, req.query.f)

	options = {};
	if(req.query.audiotrack) {
		options.audiotrack = req.query.audiotrack
	}
	if(req.query.videotrack) {
		options.videotrack = req.query.videotrack
	}
	if(req.query.subtitles) {
		options.subtitle_path = path.join(path.dirname(pathToMovie), req.query.subtitles)
	}
	if(req.query.subtitletrack) {
		options.subtitletrack = req.query.subtitletrack
	}

	chromecast.transcode_stream(pathToMovie, res, options, '', function(err, ffmpeg_error_code, ffmpeg_output) {
		if(err) {
			console.log('transcode error:');
			console.log(ffmpeg_output);
		} else {
			console.log('transcoding finished ffmpeg_output: ');
			console.log(ffmpeg_output);
		}
	});
 
});

app.listen(config.listen_port);
