// module that allows you to determine if a file is natively supported by the chromecast
// also supports transcoding of a file

// Chromecast Media Player officially supports:
// Video codecs: H.264 High Profile Level 4.1, 4.2 and 5, VP8
// Audio decoding: HE-AAC, LC-AAC, CELT/Opus, MP3, Vorbis
// Image formats: BMP, GIF, JPEG, PNG, WEBP
// Containers: MP4, WebM
//
// Unofficial support discovered via testing: 
// Video: h264 level 3.1, 5.1
// Containers: MKV (present as webm)

var probe = require('node-ffprobe');
var ffmpeg = require('fluent-ffmpeg');
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

var get_video_encode = function(){
	//returns the default video encoding format for the chromecast
	return '-vcodec libx264 -profile:v high -level 5.0';
}

var get_audio_encode = function(){
	//returns the default audio encoding format for the chromecast
	return '-acodec aac -q:a 100';
}

var get_file_data = function(file, callback){
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

		//error check and abort
		if(probeData == undefined){
			callback(0, obj);
			return
		}
		obj.ffprobe_data = probeData;

		//check for subtitles file
		//add it to the file info
		subtitle_extensions = ['.srt', '.ass']
		for (i in subtitle_extensions){
			var ext = subtitle_extensions[i];
			subtitle_file = path.join(path.dirname(file), path.basename(file, path.extname(file)) + ext)
			if(fs.existsSync(subtitle_file)){
				obj.subtitle_file = path.basename(subtitle_file);
				break;
			}
		}

		/*console.log('--')
		console.log(probeData)
		console.log('--')*/

		//Examine streams and recommend transcoding if needed
		track_audio = 0;
		track_video = 0;
		for(i in probeData.streams){
			stream = probeData.streams[i]
			if(stream.codec_type == 'video'){
				if(stream.codec_name == 'h264' 
					&& (stream.profile == 'High' || stream.profile == 'Main')
					&& (stream.level == 31 || stream.level == 40 || stream.level == 41 || stream.level == 42 || stream.level == 5 || stream.level == 50 || stream.level == 51)
					){
						obj.video = 1;
						stream.chromecast_compat = 1;
						stream.video_transcode = '-vcodec copy';
				} else if(stream.codec_name == 'vp8'){
					obj.video = 1;
					stream.chromecast_compat = 1;
					stream.video_transcode = '-vcodec copy';
				} else {
					stream.chromecast_compat = 0;
					stream.video_transcode = get_video_encode(); //get default encoding for chromecast
				}
				stream.transcode_track_id = track_video++;

				if(obj.video_transcode == undefined) obj.video_transcode = stream.video_transcode
			}

			if(stream.codec_type == 'audio'){
				if( (stream.codec_name == 'aac' || stream.codec_name == 'mp3' || stream.codec_name == 'vorbis' || stream.codec_name == 'opus') ){
					obj.audio = 1;
					stream.chromecast_compat = 1;
					stream.audio_transcode = '-acodec copy';
				} else {
					stream.chromecast_compat = 0;
					stream.audio_transcode = get_audio_encode(); //get default encoding for chromecast
				}
				stream.transcode_track_id = track_audio++;

				if(obj.audio_transcode == undefined) obj.audio_transcode = stream.audio_transcode
			}
		}

		//generate a recommended transcode command
		var output_file = '"' + path.basename(file, path.extname(file)) + '.mp4"'
		obj.transcode_cmd = 'ffmpeg -i "' + path.basename(file) +'" -strict -2 ' + obj.video_transcode + ' ' + obj.audio_transcode +' '+ output_file

		//ffprobe returns a list of formats that the container might be classified as
		// i.e. for mp4/mov/etc we'll get a string that looks like: 'mov,mp4,m4a,3gp,3g2,mj2'
		if(  probeData.format.format_name.split(',').indexOf('mp4') > -1 || probeData.format.format_name.split(',').indexOf('webm') > -1){
			obj.container = 1;
		}

		//return full compatibility
		compat = 0;
		if(obj.audio == 1 && obj.video==1 && obj.container == 1){
			compat = 1;
		}
		callback(compat, obj);
	});	
}

var get_dir_data = function(basedir, dir, return_compat, callback){
	//reads a directory
	//calls callback( files ) with an associative array of files
	//if return_compat is true, it also returns results of get_file_info()
	var response_obj = {};
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
			console.log('checking compatbility: basedir: '+basedir+' file: '+file)
			get_file_data(path.join(basedir, file), function(compat, data){
				response_obj[file].compatibility_data = data;
				response_obj[file].compatible = compat;

				if(to_check.length > 0){
					append_compat(to_check.pop());
				} else {
					callback(response_obj);
				}
			});
		};

	if(return_compat && to_check.length > 0){
			append_compat(to_check.pop());
	} else {
		callback(response_obj);
	}
}

var extract_subs = function(data, options, callback){
	//extract subtitles
	if(options.subtitletrack){
		var substream = data.ffprobe_data.streams[options.subtitletrack];
		var subexts = { //map between 'codec_name' and subtitle extension
			'ass' : 'ass',
			'subrip' : 'srt',
		}
		subext = subexts[substream.codec_name];
		if(subext){
			//extract subtitle stream and pass the file to the subtitle path
			var subfile = 'extracted_subs_' + Date.now() + '.' +subext
			var subextract = new ffmpeg({ source: pathToMovie, nolog: true, timeout: 0 })
			.toFormat(subext)
			.saveToFile(subfile, function(){
				console.log('sub extraction done');

				//call transcoder
				options.extracted_subs_file = subfile
				options.subtitle_path = subfile
				callback(options);
			})
		} else {
			callback(options);
		}
	} else {
		callback(options);
	}
}

var cleanup_subs = function(options){
	if(options.extracted_subs_file){
		//clean up the extracted file
		fs.unlinkSync(options.extracted_subs_file);
		console.log('deleting subs file '+options.extracted_subs_file);
	}
}

var transcode_stream = function(file, res, options, ffmpeg_options, callback){
	/* runs transcoding on file, streaming it out via the res object
	  options provides some functionality:
	  ffmpeg_options should be a string that will get passed directly to ffmpeg (see below)
	  callback(err, ffmpeg_exit_code, ffmpeg_output);will be called when transcode is finished, 
	  	err will be True if there was an error, and error_string will contain whatever ffmpeg complained about

	  supported options:
	  		{
	  			'audiotrack' : 0 // number corresponding to the 'transcode_track_id' member from get_file_data()
	  			'videotrack' : 0 //same as audiotrack
	  			//coming soon: 
				'subtitle_path' : 'something.srt' //optional, specifies file to read subs from
				'subtitletrack' : 0 //optional, stream number of subtitles track
	  		}
	*/
	res.contentType('video/mp4');

	console.log('Invoking transcode with options: ' + options);

	get_file_data(pathToMovie, function(compat, data){

		//figure out if a track has been selected from the options
		if(options.audiotrack == undefined)
			options.audiotrack = 0;

		if(options.videotrack == undefined)
			options.videotrack = 0;

		var opts = ['-strict experimental'];

		//handle subtitles
		var subtitle_arg = '';
		var subtitle_opt = '';

		//check for and extract subs (if needed)
		extract_subs(data, options, function(options){

			//build the transcoding parameters for ffmpeg
			//file based subtitles
			if(options.subtitle_path){
				//todo: need to check if this version of ffmpeg supports subs before enabling
				escaped_subs = options.subtitle_path;
				subtitle_arg = '-vf';
				subtitle_opt = 'subtitles=' + escaped_subs;
			}

			//scan the streams to find the selected ones
			for(var i in data.ffprobe_data.streams){
				var stream = data.ffprobe_data.streams[i];

				if(stream.codec_type == 'audio' && stream.transcode_track_id == options.audiotrack){
							opts.push('-map a:' + stream.transcode_track_id);
							opts.push(stream.audio_transcode);
				}
				else if(stream.codec_type == 'video' && stream.transcode_track_id == options.videotrack){
							opts.push('-map v:' + stream.transcode_track_id);

							if(options.subtitle_path){
								//need to use full video encoding with subtitles
								opts.push( get_video_encode() );
							} else {
								opts.push(stream.video_transcode);
							}
				}
			}
			//todo: error if any selected stream number is not valid

			console.log('calling transcode with options: '+opts)
			var proc = new ffmpeg({ source: pathToMovie, nolog: true, timeout: 0 })
			.toFormat('matroska')
			.addOptions( opts )
			//.withVideoCodec('copy')
			//.withAudioCodec('copy')
			// save to stream
			/*.onProgress(function(progress) {
			    console.log(progress);
			  })*/
			
			//add subtitles options
			if(subtitle_arg != ''){
				proc.addOption( subtitle_arg, subtitle_opt ) //have to add subtitle arg separately to deal with spaces
			}

			proc.writeToStream(res, function(retcode, ffmpeg_output){
				//console.log('transcoding finished: '+retcode); //+' error: '+error);

				err = 0;
				if(retcode == 255){ 
					//retcode seems like transcoding was terminated early by node, which is fine
				} else if (retcode == 1){
					//genuine error
					err = 1;
				}

				cleanup_subs(options);
				callback(err, retcode, ffmpeg_output);
			}); 
		}); //extract_subs
	}); //get_file_data
}

var check_dependencies = function(callback){
	//check that ffmpeg is available by seeing if we can parse the available codecs
	var f = new ffmpeg({source: ""})
	f.getAvailableCodecs(function(err, data){
		callback(err);
	});
}

module.exports = {
  get_file_data: get_file_data,
  get_dir_data: get_dir_data,
  transcode_stream: transcode_stream,
  check_dependencies: check_dependencies,
}
