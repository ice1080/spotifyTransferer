var fetch = require('node-fetch');
var FormData = require('form-data');

const tokenUrl = 'https://accounts.spotify.com/api/token';
const api = 'https://api.spotify.com/v1/';

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

  // console.log(json);
  
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

export function getAlbumTracks(album) {
  return album.album.tracks.items;
};

export async function transferTracksToPlaylist(access_token, trackList, playlistId) {
  // POST /playlists/{playlist_id}/tracks
  // uris=spotifyUri1,spotifyUri2
  // OR
  // body {"uris": ["spotifyUri1","spotifyUri2"]}
  const response = await fetch(api + 'playlists/' + playlistId + '/tracks', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({uris: trackList.map(track => track.uri)}),
  });
  console.log('transferTracksToPlaylist response', response);
  const json = await response.json();
  console.log('transferTracksToPlaylist json', json);
};

export async function doesLibraryContainTrack(profileId, trackId) {
  // GET /users/{profile_id}/tracks/contains?ids=id1,id2
  const response = await fetch(api + 'users/' + profileId + '/tracks/contains?' + trackId, {
    headers: {
      Authorization: 'Bearer ' + access_token,
    },
  });
  console.log('doesLibraryContainTrack response', response);
};

export function removeTrackFromLibrary(trackId) {
  // DELETE /users/{profile_id}/tracks
  // ids=id1,id2
  // OR
  // body ["id1", "id2"]
};

export function removeAlbumFromLibrary(albumId) {
  // DELETE /users/{profile_id}/albums
  // ids=id1,id2
  // OR
  // body ["id1", "id2"]
};
