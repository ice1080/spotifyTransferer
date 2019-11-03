var fetch = require('node-fetch');
var FormData = require('form-data');
var log4js = require('log4js');

log4js.configure({
  appenders: {
    everything: { type: 'file', filename: 'transferer.log', maxLogSize: 10485760, backups: 1000, compress: true }
  },
  categories: {
    default: { appenders: [ 'everything' ], level: 'debug'}
  }
});
var logger = log4js.getLogger();
logger.level = 'debug';

const tokenUrl = 'https://accounts.spotify.com/api/token';
const api = 'https://api.spotify.com/v1/';

function getAlbumArtists(album) {
  var artists = '';
  album.album.artists.forEach(function(artist) {
    artists += artist.name + ', ';
  });
  return artists.substring(0, artists.length - 2);
};

function getAlbumString(album) {
  return album.album.name + ' by ' + getAlbumArtists(album) + ' (id: ' + album.album.id + ')';
};

export function logPlaylist(playlistName, playlistId) {
  logger.debug("Playlist '" + playlistName + "' id: " + playlistId);
};

export function logAlbum(album) {
  logger.debug('transferring: ' + getAlbumString(album));
};

export function logAlbumTotal(total) {
  logger.debug('total albums transferred: ' + total);
};

export function logTrackTotal(total) {
  logger.debug('total tracks transferred: ' + total);
};

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};


export function getQueryParamsString(dataMap) {
  var queryString = '?';
  Object.keys(dataMap).forEach(function(key) {
    queryString += key + '=' + dataMap[key] + '&';
  });
  return queryString;
};

export async function getPlaylistId(access_token, profile_id, playlistName) {

  const response = await fetch(api + 'users/' + profile_id + '/playlists', {
    headers: { Authorization: 'Bearer ' + access_token }
  });
  const json = await response.json();

  var playlistId = '';
  
  var i;
  for (i in json.items) {
    var item = json.items[i];
    
    if (item.name == playlistName) {
      playlistId = item.id;
    }
  }

  return playlistId;

};

export async function getSavedAlbums(access_token, profile_id) {
  const response = await fetch(api + 'users/' + profile_id + '/albums', {
    headers: { Authorization: 'Bearer ' + access_token }
  });
  const json = await response.json();

  return json.items;
};

export async function refreshToken(authString, refreshToken) {
  var data = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  var url = tokenUrl + getQueryParamsString(data);

  var response = await fetch(url, {
    headers: {
      Authorization: 'Basic ' + authString,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    method: 'POST',
  });
  var jsonResponse = await response.json();
  var accessToken = jsonResponse.access_token;
  return accessToken;
};

export function getAlbumId(album) {
  return album.album.id;
};

export function getAlbumTracks(album) {
  return album.album.tracks.items;
};

export async function transferTracksToPlaylist(access_token, trackList, playlistId) {
  // POST /playlists/{playlist_id}/tracks
  // body {"uris": ["spotifyUri1","spotifyUri2"]}
  const response = await fetch(api + 'playlists/' + playlistId + '/tracks', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({uris: trackList.map(track => track.uri)}),
  });
  return response.status == 200;
};

export async function doesLibraryContainTrack(access_token, profileId, trackId) {
  // note that this function is not really necessary
  // GET /users/{profile_id}/tracks/contains?ids=id1,id2
  const response = await fetch(api + 'users/' + profileId + '/tracks/contains?ids=' + trackId, {
    headers: {
      Authorization: 'Bearer ' + access_token,
    },
  });
  const json = await response.json();
  return json[0];
};

export async function removeAlbumTracksFromLibrary(access_token, profileId, albumTracks) {
  albumTracks.forEach(async function(track) {
    await removeTrackFromLibrary(access_token, profileId, track.id);
  });
};

export async function removeTrackFromLibrary(access_token, profileId, trackId) {
  // DELETE /users/{profile_id}/tracks?ids=id1,id2
  const response = await fetch(api + 'users/' + profileId + '/tracks?ids=' + trackId, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  });
  return testResponse(response);
};

export async function removeAlbumFromLibrary(access_token, profileId, albumId) {
  // DELETE /users/{profile_id}/albums?ids=id1
  const response = await fetch(api + 'users/' + profileId + '/albums?ids=' + albumId, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  });
  return testResponse(response);
};

export async function removeTracks(access_token, profileId, tracks) {
  var url = api + 'users/' + profileId + '/tracks';
  var trackIds = [];
  tracks.forEach(function(track) {
    trackIds.push(track.id);
  });
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    },
    body: JSON.stringify(trackIds)
  });
};

export async function removeAlbums(access_token, profileId, albums) {
  var url = api + 'users/' + profileId + '/albums';
  var albumIds = [];
  albums.forEach(function(album) {
    albumIds.push(getAlbumId(album));
  });
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    },
    body: JSON.stringify(albumIds)
  });
};

function testResponse(response) {
  if (response.status !== 200) {
    if (response.status === 429) {
      console.log('too many requests: ', response.headers);
    } else {
      console.log(response);
    }
  }
  return response.status == 200;
};
