  function setTranscodeDirectUrl(){
    document.getElementById("transcodeurl").innerHTML = getTranscodeUrl();
    document.getElementById("transcodeurl").href = getTranscodeUrl();
  }

  function getTranscodeUrl(base_url){
    var transcode = document.location.origin + base_url;
    transcode += "&audiotrack=" + document.getElementById("audiotrack").value;
    transcode += "&videotrack=" + document.getElementById("videotrack").value;
    transcode += "&subtitles=" + document.getElementById("subtitles").value;
    transcode += "&subtitletrack=" + document.getElementById("subtitletrack").value;

    return transcode;
  }

  function checkThumbnail (img, src, vid, rep) {
    var gen_wait = 250; // ms to wait before checking again
    var max_reps = 8; // max reps before giveup timeout error
    var rep = rep || 1;

    $.get('/thumbgen?t=' + src + '&v=' + vid, function(data) {
      if (data.thumb_src) {
        img.className = 'thumb';
        img.src = data.thumb_src;
      }
      else if (data.message == 'generating' && rep < max_reps) {
        setTimeout(checkThumbnail(img, src, vid, ++rep), gen_wait);
      }
      else {
        //console.log(data);
        img.className = 'thumb error';
        img.src = '';
      }
    });
  }

  $(function() {
	$('img.generating').each(function(i) {
		checkThumbnail(this, this.dataset.targetsrc, this.dataset.videosrc);
    });
  });
