/** This file was borrowed from Google's examples: helloVideos.js
It provides a pretty straightforward set of APIS to start media playing on the chromecast,
https://github.com/googlecast/CastHelloVideo-chrome

I modified this file to remove video-app specific code but kept most of the boilerplate chrome initialization

The google example code is licensed under the Apache 2.0 license.



*/

/**
 * global variables
 */
var currentMediaSession = null;
var currentVolume = 0.5;
var progressFlag = 1;
var mediaCurrentTime = 0;
var session = null;
var mediaURLs = [
           'http://192.168.1.92:8080/torrents/Almost.Human.S01E09.HDTV.x264-LOL.mp4',
           'http://commondatastorage.googleapis.com/gtv-videos-bucket/ED_1280.mp4',
           'http://commondatastorage.googleapis.com/gtv-videos-bucket/tears_of_steel_1080p.mov',
           'http://commondatastorage.googleapis.com/gtv-videos-bucket/reel_2012_1280x720.mp4',
           'http://commondatastorage.googleapis.com/gtv-videos-bucket/Google%20IO%202011%2045%20Min%20Walk%20Out.mp3'];
var mediaTitles = [
           'Big Buck Bunny',
           'Elephant Dream',
           'Tears of Steel',
           'Reel 2012',
           'Google I/O 2011 Audio'];

var mediaThumbs = [
           'images/bunny.jpg',
           'images/ed.jpg',
           'images/Tears.jpg',
           'images/reel.jpg',
           'images/google-io-2011.jpg'];
var currentMediaURL = mediaURLs[0];


/**
 * Call initialization
 */
if (!chrome.cast || !chrome.cast.isAvailable) {
  setTimeout(initializeCastApi, 1000);
}

/**
 * initialization
 */
function initializeCastApi() {
  // default app ID to the default media receiver app
  // optional: you may change it to your own app ID/receiver
  var applicationID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
  var sessionRequest = new chrome.cast.SessionRequest(applicationID);
  var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
    sessionListener,
    receiverListener);

  chrome.cast.initialize(apiConfig, onInitSuccess, onError);
};

/**
 * initialization success callback
 */
function onInitSuccess() {
  appendMessage("init success");
}

/**
 * initialization error callback
 */
function onError() {
  console.log("error");
  appendMessage("error");
}

/**
 * generic success callback
 */
function onSuccess(message) {
  console.log(message);
}

/**
 * callback on success for stopping app
 */
function onStopAppSuccess() {
  console.log('Session stopped');
  appendMessage('Session stopped');
  document.getElementById("casticon").src = 'images/cast_icon_idle.png'; 
}

/**
 * session listener during initialization
 */
function sessionListener(e) {
  console.log('New session ID: ' + e.sessionId);
  appendMessage('New session ID:' + e.sessionId);
  session = e;
  if (session.media.length != 0) {
    appendMessage(
        'Found ' + session.media.length + ' existing media sessions.');
    onMediaDiscovered('onRequestSessionSuccess_', session.media[0]);
  }
  session.addMediaListener(
      onMediaDiscovered.bind(this, 'addMediaListener'));
  session.addUpdateListener(sessionUpdateListener.bind(this));  
}

/**
 * session update listener 
 */
function sessionUpdateListener(isAlive) {
  var message = isAlive ? 'Session Updated' : 'Session Removed';
  message += ': ' + session.sessionId;
  appendMessage(message);
  if (!isAlive) {
    session = null;
  }
};

/**
 * receiver listener during initialization
 */
function receiverListener(e) {
  if( e === 'available' ) {
    console.log("receiver found");
    appendMessage("receiver found");
  }
  else {
    console.log("receiver list empty");
    appendMessage("receiver list empty");
  }
}

/**
 * select a media URL 
 * @param {string} m An index for media URL
 */
function selectMedia(url) {
  console.log("media selected" + url);
  appendMessage("media selected" + url);
  currentMediaURL = url; 
  var playpauseresume = document.getElementById("playpauseresume");
}

/**
 * launch app and request session
 */
function launchApp() {
  console.log("launching app...");
  appendMessage("launching app...");
  chrome.cast.requestSession(onRequestSessionSuccess, onLaunchError);
}

/**
 * callback on success for requestSession call  
 * @param {Object} e A non-null new session.
 */
function onRequestSessionSuccess(e) {
  console.log("session success: " + e.sessionId);
  appendMessage("session success: " + e.sessionId);
  session = e;
  document.getElementById("casticon").src = 'images/cast_icon_active.png'; 
}

/**
 * callback on launch error
 */
function onLaunchError() {
  console.log("launch error");
  appendMessage("launch error");
}

/**
 * stop app/session
 */
function stopApp() {
  session.stop(onStopAppSuccess, onError);
}

/**
 * load media
 * @param {string} i An index for media
 */
function loadMedia(url) {
  if (!session) {
    console.log("no session");
    appendMessage("no session");
    return;
  }
  console.log("loading..." + currentMediaURL);
  appendMessage("loading..." + currentMediaURL);
  var mediaInfo = new chrome.cast.media.MediaInfo(currentMediaURL);
  mediaInfo.contentType = 'video/mp4';
  var request = new chrome.cast.media.LoadRequest(mediaInfo);
  request.autoplay = false;
  request.currentTime = 0;
  
  var payload = {
    "title:" : url,
    //"thumb" : mediaThumbs[i] //todo; add thumbs to hdsg
  };

  var json = {
    "payload" : payload
  };

  request.customData = json;

  session.loadMedia(request,
    onMediaDiscovered.bind(this, 'loadMedia'),
    onMediaError);

}

/**
 * callback on success for loading media
 * @param {Object} e A non-null media object
 */
function onMediaDiscovered(how, mediaSession) {
  console.log("new media session ID:" + mediaSession.mediaSessionId);
  appendMessage("new media session ID:" + mediaSession.mediaSessionId + ' (' + how + ')');
  currentMediaSession = mediaSession;
  mediaSession.addUpdateListener(onMediaStatusUpdate);
  mediaCurrentTime = currentMediaSession.currentTime;
  playpauseresume.innerHTML = 'Play';
  document.getElementById("casticon").src = 'images/cast_icon_active.png'; 
}

/**
 * callback on media loading error
 * @param {Object} e A non-null media object
 */
function onMediaError(e) {
  console.log("media error: "+e.code+" "+e.description);
  appendMessage("media error: "+e.code+" "+e.description);
  document.getElementById("casticon").src = 'images/cast_icon_warning.png'; 
}

/**
 * callback for media status event
 * @param {Object} e A non-null media object
 */
function onMediaStatusUpdate(isAlive) {
  if( progressFlag ) {
    document.getElementById("progress").value = parseInt(100 * currentMediaSession.currentTime / currentMediaSession.media.duration);
  }
  document.getElementById("playerstate").innerHTML = currentMediaSession.playerState;
}

/**
 * play media
 */
function playMedia() {
  if( !currentMediaSession ) 
    return;

  var playpauseresume = document.getElementById("playpauseresume");
  if( playpauseresume.innerHTML == 'Play' ) {
    currentMediaSession.play(null,
      mediaCommandSuccessCallback.bind(this,"playing started for " + currentMediaSession.sessionId),
      onError);
      playpauseresume.innerHTML = 'Pause';
      //currentMediaSession.addListener(onMediaStatusUpdate);
      appendMessage("play started");
  }
  else {
    if( playpauseresume.innerHTML == 'Pause' ) {
      currentMediaSession.pause(null,
        mediaCommandSuccessCallback.bind(this,"paused " + currentMediaSession.sessionId),
        onError);
      playpauseresume.innerHTML = 'Resume';
      appendMessage("paused");
    }
    else {
      if( playpauseresume.innerHTML == 'Resume' ) {
        currentMediaSession.play(null,
          mediaCommandSuccessCallback.bind(this,"resumed " + currentMediaSession.sessionId),
          onError);
        playpauseresume.innerHTML = 'Pause';
        appendMessage("resumed");
      }
    }
  }
}

/**
 * stop media
 */
function stopMedia() {
  if( !currentMediaSession ) 
    return;

  currentMediaSession.stop(null,
    mediaCommandSuccessCallback.bind(this,"stopped " + currentMediaSession.sessionId),
    onError);
  var playpauseresume = document.getElementById("playpauseresume");
  playpauseresume.innerHTML = 'Play';
  appendMessage("media stopped");
}

/**
 * set media volume
 * @param {Number} level A number for volume level
 * @param {Boolean} mute A true/false for mute/unmute 
 */
function setMediaVolume(level, mute) {
  if( !currentMediaSession ) 
    return;

  var volume = new chrome.cast.Volume();
  volume.level = level;
  currentVolume = volume.level;
  volume.muted = mute;
  var request = new chrome.cast.media.VolumeRequest();
  request.volume = volume;
  currentMediaSession.setVolume(request,
    mediaCommandSuccessCallback.bind(this, 'media set-volume done'),
    onError);
}

/**
 * mute media
 * @param {DOM Object} cb A checkbox element
 */
function muteMedia(cb) {
  if( cb.checked == true ) {
    document.getElementById('muteText').innerHTML = 'Unmute media';
    setMediaVolume(currentVolume, true);
    appendMessage("media muted");
  }
  else {
    document.getElementById('muteText').innerHTML = 'Mute media';
    setMediaVolume(currentVolume, false);
    appendMessage("media unmuted");
  } 
}

/**
 * seek media position
 * @param {Number} pos A number to indicate percent
 */
function seekMedia(pos) {
  console.log('Seeking ' + currentMediaSession.sessionId + ':' +
    currentMediaSession.mediaSessionId + ' to ' + pos + "%");
  progressFlag = 0;
  var request = new chrome.cast.media.SeekRequest();
  request.currentTime = pos * currentMediaSession.media.duration / 100;
  currentMediaSession.seek(request,
    onSeekSuccess.bind(this, 'media seek done'),
    onError);
}

/**
 * callback on success for media commands
 * @param {string} info A message string
 * @param {Object} e A non-null media object
 */
function onSeekSuccess(info) {
  console.log(info);
  appendMessage(info);
  setTimeout(function(){progressFlag = 1},1500);
}

/**
 * callback on success for media commands
 * @param {string} info A message string
 * @param {Object} e A non-null media object
 */
function mediaCommandSuccessCallback(info) {
  console.log(info);
  appendMessage(info);
}


/**
 * append message to debug message window
 * @param {string} message A message string
 */
function appendMessage(message) {
  var dw = document.getElementById("debugmessage");
  dw.innerHTML += '\n' + JSON.stringify(message);
};


