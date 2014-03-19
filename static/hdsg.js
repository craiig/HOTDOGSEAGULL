  function setTranscodeDirectUrl(){
    document.getElementById("transcodeurl").innerHTML = getTranscodeUrl();
    document.getElementById("transcodeurl").href = getTranscodeUrl();
  }

  function getTranscodeUrl(){
    var transcode = document.location.origin + '{{= it.transcode_url.replace("'", "\\'") }}';
    transcode += "&audiotrack=" + document.getElementById("audiotrack").value;
    transcode += "&videotrack=" + document.getElementById("videotrack").value;
    transcode += "&subtitles=" + document.getElementById("subtitles").value;
    transcode += "&subtitletrack=" + document.getElementById("subtitletrack").value;

    return transcode;
  }
