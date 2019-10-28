
var fetch = require('node-fetch');
var FormData = require('form-data');
const acctsUrl = 'https://accounts.spotify.com/api/token';
const api = 'https://api.spotify.com/v1/';

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
  // var authOptions = {
  //   url: acctsUrl,
  //   headers: { 'Authorization': 'Basic ' + authString }
  // };
  const formData = new FormData();
  formData.append('grant_type', 'refresh_token');
  formData.append('refresh_token', refreshToken);
  const response = await fetch(acctsUrl, {
    headers: {
      Authorization: 'Basic ' + authString,
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: formData,
    json: true
  });
  console.log('refreshToken response', response);
  const json = await response.json();
  console.log('new auth token received: ' + json);
  return json;
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
    body: JSON.stringify(trackList.map(track => track.uri)),
  });
  console.log('transferTracksToPlaylist response', response);
  const json = await response.json();
  console.log('transferTracksToPlaylist json', json);
};

export async function doesLibraryContainTrack(profileId, trackId) {
  // GET /users/{profile_id}/tracks/contains?ids=id1,id2
  const response = await fetch(api + 'users/' + profileId + '/tracks/contains?' + trackId, {
    
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
