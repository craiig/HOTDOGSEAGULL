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

  function checkThumbnail (img, src) {
    var thumb_wait = 500; // ms
    $.get('/thumbgen?f=' + src, function(data) {
      if (data.thumb_src) {
        setTimeout(function() { img.className = 'thumb'; img.src = data.thumb_src; }, thumb_wait);
      }
      else if (data.message == 'generating') {
        setTimeout(checkThumbnail(img, src), thumb_wait);
      }
      //else console.log(data);
    });
  }

  $(function() {
    $('img.generating').each(function(i) {
       checkThumbnail(this, this.dataset.targetsrc);
    });
  });
