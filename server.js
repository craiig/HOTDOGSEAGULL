var chromecast = require('./chromecast.js');
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
config.listen_port  = config.listen_port || 3000; // set to 80 for "normal" server
config.media_folder = config.media_folder || 'media';     // symlink local "media" dir to your media root
config.thumb_prefix = config.thumb_prefix || '';          // set to '/.thumbs' style uri for top level cache
config.thumb_suffix = config.thumb_suffix || '/.thumbs/'; // set to '/' if using top level cache (can NOT be empty string)

// global option arrays (should be communal for the most part; not config-specific)
var imageTypes = ['jpg','jpeg','png','webp','bmp','gif']; // displayed nativey rather than thru ffmpeg
var ignoredFiles = ['.DS_Store','.lock','.md5','.localized','.thumbs']; // not even displayed

// types not to try and generate thumbnails for (use default unknown-file image)
var ignoredTypes = ['nfo','txt','md5','exe','bat','sh','js','xml','json','php',
		    'dat','tmp','plist','pdf','doc','docx','zip','.rar'];

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
});

app.set('views', path.join(__dirname + '/views'));

// define custom logging format
/*express.logger.format('detailed', function (token, req, res) {                                    
    return util.inspect(req.headers);
});  */

app.use(express.logger());

app.use('/thumb', express.static( path.resolve(__dirname, config.media_folder) ));
app.use('/static', express.static(__dirname + '/static'));
app.use('/static_media', express.static( path.resolve(__dirname, config.media_folder) ));

// Renders list of all files in requested media dir, with thumbnail src and other details as available
directoryList = function(req, res) {
	dir = (req.query.f) ? path.join('/', req.query.f) : '/';
	dir_handle = fs.openSync(config.media_folder + dir, 'r');

	if (! dir_handle) {
 		res.render('error.html', {statusCode: '403', message: 'Cannot read media directory <b>' + config.media_folder + dir + '</b>. Ensure "media_folder" var in server.js refers to a valid local path, and check read permissions on this subdirectory.', error: err});
		return;
	}

	parentdir = (dir == '/') ? false : path.join(dir, '../');

	// verify or create thumbnail path recursively, within root thumb_prefix folder
	var thumb_dir = path.join(config.media_folder, config.thumb_prefix, dir, config.thumb_suffix);
	if (! fs.existsSync(thumb_dir)) {
		var newdir = mkdirp.sync(thumb_dir, '0755', function(err) { console.log('Could not create thumbs subdirectory: ' + err); });
	}

	chromecast.get_dir_data(config.media_folder, dir, false, function(files) {
		var generated_thumbs = 0;
		var default_thumb = '/static/thumb_generating.gif';

		for (var file in files) {
			file_basename = path.basename(file);
			files[file].url_name = encodeURIComponent(file);
			files[file].static_url = path.join('/static_media', files[file].url_name);
			files[file].transcode_url = path.join('/transcode?f=', files[file].url_name);

			if (!files[file].is_dir && ignoredTypes.indexOf(file_basename.split('.').pop()) < 0
                         && ignoredFiles.indexOf(file_basename) < 0 && ignoredFiles.indexOf(path.basename(dir)) < 0) {
				options = {
				 'video_path': config.media_folder + file,
				 'thumb_path': thumb_dir,
				 'thumb_name': path.basename(file) + '.thumb'
				};

				if (! fs.existsSync(options.thumb_path + options.thumb_name + '.jpg')) {
					if (imageTypes.indexOf(file_basename.split('.').pop()) < 0) {
						files[file].thumb_generating = encodeURIComponent(options.thumb_name) + '.jpg';
						files[file].thumb_dir = config.thumb_prefix + escape(dir) + config.thumb_suffix;
						files[file].thumb_src = default_thumb;
						files[file].thumb_width = '160';
						files[file].thumb_height = '90';
						++generated_thumbs;
					}
					else {
						// display native imageTypes directly
						files[file].thumb_src = '/thumb' + escape(file);
						files[file].thumb_width = '120';
					}
				}
				else {
					stats = fs.statSync(options.thumb_path + options.thumb_name + '.jpg');
					if (stats && stats.size) {
						// found a valid cached thumbnail, sweet
						files[file].thumb_src = '/thumb' + config.thumb_prefix + escape(dir) + config.thumb_suffix + encodeURIComponent(options.thumb_name) + '.jpg';
						files[file].thumb_width = '160';
						files[file].thumb_height = '90';
					}
				}
			}
		}
		if (generated_thumbs) console.log('Generating ' + generated_thumbs + ' new thumbnails to ' + config.thumb_prefix + dir + config.thumb_suffix);

		res.render('index.html', {files: files, dir: dir, parentdir: parentdir});
	});
};

app.get('/', directoryList);

app.get('/thumbgen', function(req, res) {
	if (req.query.t && req.query.v) { // t = target thumbnail path, v = src video path
		dir_parts = req.query.v.split('/').filter(function(e){return e;});
        dir_parts.pop();
        thumb_name = path.basename(req.query.t);
        thumb_base = thumb_name.substr(0, thumb_name.lastIndexOf('.'));
        thumb_ext = thumb_name.split('.').pop();
        
        // only attempt to generate thumbs for known image type requests
        if (imageTypes.indexOf(thumb_ext) >= 0) {
			options = {
			 'dir': dir_parts.join('/'),
			 'video_path': path.join(config.media_folder, req.query.v),
			 'thumb_path': path.join(config.media_folder, config.thumb_prefix, dir_parts.join('/'), config.thumb_suffix),
			 'thumb_name': thumb_base,
			 'thumb_url': path.join('/thumb', config.thumb_prefix, dir_parts.join('/'), config.thumb_suffix, thumb_name)
			};
			
			// thumb doesn't yet exist; generate it
			if (! fs.existsSync(config.media_folder + options.thumb_path + options.thumb_name + '.jpg')) {
				chromecast.generate_thumb(req.query.v, options, function(data) {
					if (data.error || !data.success_path) res.json({message: 'Error: ' + data.error});
					else res.json({thumb_src: data.thumb_url});
				});
			}
			else { // thumb exists, but is it complete? ffmpeg creates 0 byte file immediately, then fills on completion
				stats = fs.statSync(config.media_folder + options.thumb_path + options.thumb_name + '.jpg');
				if (stats && stats.size) res.json({thumb_src: data.thumb_url}); // first thumbgen finished!
				else res.json({message: 'generating'}); // already a thumbgen running for this thumb, just wait
			}
		}
		else res.json({message: '400 bad request: not a known image type.'});
	}
	else res.json({message: '400 bad request: no t or v param present (both are required).'});
});

app.get('/playfile', function(req, res) {
	file_url = path.join('/static_media', req.query.f);
	transcode_url = path.join('/transcode?f=', req.query.f);
	dirs = req.query.f.split('/').filter(function(e){return e;});
	dirs.pop();

	thumb_dir = config.media_folder + config.thumb_prefix + path.join('/', dirs.join('/')) + config.thumb_suffix;
	thumb_name = path.basename(req.query.f) + '.thumb.jpg';
	thumb_url = escape(path.join('/thumb/', config.thumb_prefix, dirs.join('/'), config.thumb_suffix)) + encodeURIComponent(thumb_name);
	
	chromecast.get_file_data(path.join(config.media_folder, req.query.f), function(compat, data) {
		// if ffprobe failed, set empty streams array so render loop doesn't fail
        	if (data.ffprobe_data == undefined) data.ffprobe_data = {streams: []};

		if (fs.existsSync(thumb_dir + thumb_name)) {
			thumb_src = thumb_url;
		}
		else {
			console.log('No thumb for ' + path.join(thumb_dir, thumb_name));
			thumb_src = false;
		}

		res.render('playfile.html', {
			query: req.query, 
			file_url: file_url.replace('#','%23'),
			transcode_url: transcode_url.replace('#','%23'),
			file_dir: path.dirname(req.query.f).replace('#','%23'),
			file_name: path.basename(file_url),
			compatible: compat,
			compatibility_data: data,
			thumb_src: thumb_src
		});
	});
});

app.get('/transcode', function(req, res) {
	// borrowed from the  ffmpeg-fluent examples
	pathToMovie = path.join(config.media_folder, req.query.f);

	options = {};
	if(req.query.audiotrack) {
		options.audiotrack = req.query.audiotrack;
	}
	if(req.query.videotrack) {
		options.videotrack = req.query.videotrack;
	}
	if(req.query.subtitles) {
		options.subtitle_path = path.join(path.dirname(pathToMovie), req.query.subtitles);
	}
	if(req.query.subtitletrack) {
		options.subtitletrack = req.query.subtitletrack;
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
