//var media_folder = "media"
//var media_folder = "media/"
var media_folder = "/Users/craig/Documents/Code/Chromecast/mediaserver/media"
var chromecast = require('./chromecast.js')

var fs = require('fs');
var dot = require('dot');
var express = require('express');
var path = require('path')

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

	chromecast.is_compatibile(path.join(media_folder, req.query.f), function(compat, data){
		res.render('playfile.html', {
			query: req.query, 
			file_url: file_url,
			file_dir: path.dirname(req.query.f),
			file_name: path.basename(file_url),
			compatible: compat,
			compatibility_data: data
		});
	});
});

/*app.get('/transcode', function(req, res){
	//file_url = path.join("/static_media", req.query.f)
	chromecast.is_compatibile(path.join(media_folder, req.query.f), function(compat, data){
		res.render('playfile.html', {
			query: req.query, 
			file_url: file_url,
			file_dir: path.dirname(req.query.f),
			file_name: path.basename(file_url),
			compatible: compat,
			compatibility_data: data
		});
	});
});*/

app.listen(3000);