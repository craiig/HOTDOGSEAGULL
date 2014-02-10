// functions to help determine which files are compatible with the chromecast
// uses ffprobe to read media files

//todo:
//test on large libraries for any timeout issues

// Chromecast Media Player officially supports:
// Video codecs: H.264 High Profile Level 4.1, 4.2 and 5, VP8
// Audio decoding: HE-AAC, LC-AAC, CELT/Opus, MP3, Vorbis
// Image formats: BMP, GIF, JPEG, PNG, WEBP
// Containers: MP4, WebM
//
// Unofficial support:
// Video: h264 level 3.1
// Containers: MKV (presented as mp4)

var probe = require('node-ffprobe');
var path = require('path');
var fs = require('fs');

//cache the responses from reading ff-probe
//based on the mtime of the file 
var probe_cache = {}

//function to cache the results of probe
var probe_check_cache = function(file, callback){
	var stats = fs.statSync(file);

	var append_probe_cache = function(err, probeData){
				if(probeData){
					probe_cache[file] = {}
					probe_cache[file].stats = stats;
					probe_cache[file].probeData = probeData;
				}
				callback(err, probeData)
			}

	if(file in probe_cache){
		if(probe_cache[file].stats.mtime.valueOf() != stats.mtime.valueOf()){
			probe(file, append_probe_cache);
		} else {
			callback(0, probe_cache[file].probeData)
		}
	} else {
		probe(file, append_probe_cache);
	}
}

var is_compatibile = function(file, callback){
	//callback is: function(compatibility, data)
	//where data gives specifics about what is and isn't compatible
	//includes the output from ffprobe under ffprobe_data

	probe_check_cache(file, function(err, probeData) {
		var obj = {
			audio: 0,
			video: 0,
			container: 0,
			ffprobe_data: undefined
		}

		if(probeData == undefined){
			callback(0, obj);
			return
		}
		obj.ffprobe_data = probeData;

		/*console.log("--")
		console.log(probeData)
		console.log("--")*/
		for(i in probeData.streams){
			stream = probeData.streams[i]
			if(stream.codec_type == 'video'
				&& stream.codec_name == 'h264' 
				&& stream.profile == 'High'
				&& (stream.level == 31 || stream.level == 41 || stream.level == 42 || stream.level == 5 || stream.level == 50)
				){
					obj.video = 1;
			}

			if(stream.codec_type == 'audio'
				&& (stream.codec_name == 'aac' || stream.codec_name == 'mp3' || stream.codec_name == 'vorbis' || stream.codec_name == 'opus')
				){
				obj.audio = 1
			}
		}

		//ffprobe returns a list of formats that the container might be classified as
		// i.e. for mp4/mov/etc we'll get a string that looks like: 'mov,mp4,m4a,3gp,3g2,mj2'
		if(  probeData.format.format_name.split(",").indexOf("mp4") > -1 || probeData.format.format_name.split(",").indexOf("webm") > -1){
			obj.container = 1;
		}

		compat = 0
		if(obj.audio == 1 && obj.video==1 && obj.container == 1){
			compat = 1;
		}
		callback(compat, obj)
	});	
}

var read_dir = function(basedir, dir, callback){
	//calls callback with an array of files
	//containing the stats of the file as well as the chromecast compatibility
	var response_obj = {}
	var to_check = [];

	real_dir = path.join(basedir, dir)
	files = fs.readdirSync(real_dir);
	files.forEach(function(f){
		var file = path.join(dir, f);
		var file_loc = path.join(basedir, file);

		//fill in information about the file in this dir
		stats = fs.statSync(file_loc);
		response_obj[file] = {
				compatibility_data: undefined,
				compatible: 0,
				is_dir: 0,
				stats: stats
			};

		if(stats && stats.isFile()){
			to_check.push(file);
		} else if ( stats && stats.isDirectory()){
			response_obj[file].is_dir = 1;
		}
	});

	var append_compat = function(file){
			console.log("checking compatbility: basedir: "+basedir+" file: "+file)
			is_compatibile(path.join(basedir, file), function(compat, data){
				response_obj[file].compatibility_data = data;
				response_obj[file].compatible = compat;

				if(to_check.length > 0){
					append_compat(to_check.pop());
				} else {
					callback(response_obj);
				}
			});
		};

	if(to_check.length > 0){
		append_compat(to_check.pop());
	} else {
		callback(response_obj);
	}
}

/*var transcode_recommendation = function(file, callback){
	//calls callback with (suggested_ffmpeg_command, data)
	//where suggested_ffmpeg_command is the suggested command to do the conversion to a CC supported format
	//it's smart enough to not transcode streams that already work
	//where data contains the response from is_compatible

	is_compatible(file, function(compat, ffprobe_data){
		command = "do nothing"
		if(compat == 0){
			command = "ffmpeg " + file
		}
		callback(command, ffprobe_data)
	})
}*/

module.exports = {
  is_compatibile: is_compatibile,
  read_dir: read_dir,
  //transcode_recommendation: transcode_recommendation
}