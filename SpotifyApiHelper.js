
var fetch = require('node-fetch');

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

  console.log(json);
  console.log('next');
  console.log(json.items);
};

export async function refreshToken(authString, refreshToken) {
  const response = await fetch(acctsUrl, {
    headers: { Authorization: 'Basic ' + authString },
    method: 'POST',
    form: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }
  });
  console.log(response);
  const json = await response.json();
  console.log(json);
};
