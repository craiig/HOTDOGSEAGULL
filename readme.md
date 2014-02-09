
# HOTDOGSEAGULL #
This is a server built in node.js that lets you browse your media using a browser and push it up to a chromecast. Should be suitable for running on a home server.

This is intended as a starting point for UNIX inclined people to set up local media servers for the chromecast. The UI intentionally looks bad because I want to leave the UI to others while I focus on the technical aspects. If you make any improvements to this code, feel free to send a pull request. See below for more details on future development 

Tested on OS X but should work on anything that can run node and ffmpeg.

## Features ##
 * Uses the default media player app on the Chromecast - no need to get a developer ID or publish an app.
 * Detects which of your local files are playable by the chromecast using ffmpeg - no need to guess.
 * Extremely basic UI. Uses templates so adding skins and customizing should be easier.
 * Lets you try files anyways just in case detection got it wrong. (Let me know when if the detection was wrong).

## Installation ##
Depends on ffprobe that's provided by ffmpeg. You can install this using Homebrew or whatever package manager you have on your system.

Depends on node packages: express, dot, node-ffprobe

```
brew install ffmpeg
npm install express dot node-ffprobe

git clone ...
edit 'media_folder' variable in server.js to point to your media directory
node server.js
Visit http://<local_ip>:3000 in a web browser.
```
NOTE: You need to use an ip that the chromecast can access. I.e. use 192.168.1.X and don't use localhost.

## Warranty & Support ##
This server might be very insecure and may leak all your files. Security audits/fixes are more than welcome. For the love of god put this behind a firewall.

Make posts in the github forum if you have problems.

## Upcoming features & Contribute ##
To contribute, just send a pull request on github and I'll look at it. Bugs, new features, better UI, it's all welcome but I don't guarantee I'll accept everything.

Here are some features that would be good to add:
 * Better basic layout
 * Read thumbnail from the video using ffmpeg
 * Skin & config system so you can switch between skins, etc.
 * UI & support for mobile browsers
 * Packaging this up for less technical users on other systems.

Here's what I'm working on:
 * Improving the player interaction with the chromecast
 * Offline/batch transcoding support using ffmpeg (and then maybe online transcoding)

## License ##
I used some code from Google's CastHelloVideo-chrome which are under the Apache 2.0 License. https://github.com/googlecast/CastHelloVideo-chrome

You should consider my code to be under the Apache 2.0 license but with an ADDED REQUIREMENT THAT YOU MUST REFERENCE MY RIDICULOUS PROJECT NAME 