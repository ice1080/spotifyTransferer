/**
 * This is a simple node.js script that transfers songs from saved albums
 * into a playlist of choice, and then unsaves the albums and songs.
 * 
 * To use, run the app with `npm start`, navigate to http://localhost:8888/,
 * and click Make Transfer. It only does 20 albums at a time, so has to be 
 * clicked a bunch. Logs are stored in "transferer.log".
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var fs = require('fs');
import {
  logPlaylist,
  logAlbum,
  logAlbumTotal,
  logTrackTotal,
  getQueryParamsString,
  getPlaylistId,
  getSavedAlbums,
  refreshToken,
  getAlbumId,
  getAlbumTracks,
  transferTracksToPlaylist,
  doesLibraryContainTrack,
  removeAlbumFromLibrary,
  removeTrackFromLibrary,
  removeAlbumTracksFromLibrary,
  removeTracks,
  removeAlbums,
  sleep,
} from './SpotifyApiHelper';

var client_id = 'NOT_SET';
var client_secret = 'NOT_SET';
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

function readSecretsFile(fileName) {
  let content = '';
  try {
    content = fs.readFileSync(fileName, 'utf8').replace('\n', '');
  } catch(e) {
    console.error('Error:', e.stack);
  }
  return content;
}

client_id = readSecretsFile('clientId.txt');
client_secret = readSecretsFile('clientSecret.txt');

function getAuthString() {
  return new Buffer(client_id + ':' + client_secret).toString('base64');
}

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-modify user-library-modify user-library-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (getAuthString())
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        
        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        // todo what is this for?
        request.get(options, function(error, response, body) {
          // console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authString = getAuthString();
  
  var refreshOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + authString },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(refreshOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});



app.get('/make_transfer', async function(req, res) {
  var access_token = req.query.access_token;
  var refresh_token = req.query.refresh_token;
  var profileId = req.query.profile_id;

  // todo change this to an input variable on the screen
  var preferred_playlist_name = 'Collection3';

  // refresh the token
  // todo perhaps remove this, could be what's slowing everything down
  access_token = await refreshToken(getAuthString(), refresh_token);
  
  var playlistId = await getPlaylistId(access_token, profileId, preferred_playlist_name);

  logPlaylist(preferred_playlist_name, playlistId);

  var savedAlbums = await getSavedAlbums(access_token, profileId);

  var trackTotal = 0;
  savedAlbums.forEach(async function(album) {
    logAlbum(album);
    var albumId = getAlbumId(album);
    var albumTracks = getAlbumTracks(album);
    await transferTracksToPlaylist(access_token, albumTracks, playlistId);

    await removeTracks(access_token, profileId, albumTracks);
    trackTotal += albumTracks.length;
    logTrackTotal(trackTotal);
  });

  await sleep(1000);
  await removeAlbums(access_token, profileId, savedAlbums);
  logAlbumTotal(savedAlbums.length);
  
});


console.log('Listening on 8888');
app.listen(8888);
