import fetch from 'node-fetch';
import log4js from 'log4js';

log4js.configure({
  appenders: {
    everything: { type: 'file', filename: 'transferer.log', maxLogSize: 10485760, backups: 1000, compress: true }
  },
  categories: {
    default: { appenders: [ 'everything' ], level: 'debug'}
  }
});
const logger = log4js.getLogger();
logger.level = 'debug';

const tokenUrl = 'https://accounts.spotify.com/api/token';
const api = 'https://api.spotify.com/v1/';

interface Artist {
  name: string;
}

interface Track {
  id: string;
  uri: string;
}

interface Album {
  id: string;
  name: string;
  artists: Artist[];
  tracks: {
    items: Track[];
  };
}

interface SavedAlbum {
  album: Album;
}

interface Playlist {
  id: string;
  name: string;
}

interface PlaylistResponse {
  items: Playlist[];
}

interface UserAlbumsResponse {
  items: SavedAlbum[];
}

interface TokenResponse {
  access_token: string;
}

function getAlbumArtists(album: SavedAlbum): string {
  let artists = '';
  album.album.artists.forEach(function(artist: Artist) {
    artists += artist.name + ', ';
  });
  return artists.substring(0, artists.length - 2);
}

function getAlbumString(album: SavedAlbum): string {
  return album.album.name + ' by ' + getAlbumArtists(album) + ' (id: ' + album.album.id + ')';
}

export function logPlaylist(playlistName: string, playlistId: string): void {
  logger.debug("Playlist '" + playlistName + "' id: " + playlistId);
}

export function logAlbum(album: SavedAlbum): void {
  logger.debug('transferring: ' + getAlbumString(album));
}

export function logAlbumTotal(total: number): void {
  logger.debug('total albums transferred: ' + total);
}

export function logTrackTotal(total: number): void {
  logger.debug('total tracks transferred: ' + total);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getQueryParamsString(dataMap: Record<string, string>): string {
  let queryString = '?';
  Object.keys(dataMap).forEach(function(key: string) {
    queryString += key + '=' + dataMap[key] + '&';
  });
  return queryString;
}

export async function getPlaylistId(access_token: string, profile_id: string, playlistName: string): Promise<string> {
  const response = await fetch(api + 'users/' + profile_id + '/playlists', {
    headers: { Authorization: 'Bearer ' + access_token }
  });
  const json: PlaylistResponse = await response.json() as PlaylistResponse;

  let playlistId = '';
  
  let i: string;
  for (i in json.items) {
    const item = json.items[i];
    
    if (item.name === playlistName) {
      playlistId = item.id;
    }
  }

  return playlistId;
}

export async function getSavedAlbums(access_token: string, profile_id: string): Promise<SavedAlbum[]> {
  const response = await fetch(api + 'users/' + profile_id + '/albums', {
    headers: { Authorization: 'Bearer ' + access_token }
  });
  const json: UserAlbumsResponse = await response.json() as UserAlbumsResponse;

  return json.items;
}

export async function refreshToken(authString: string, refreshToken: string): Promise<string> {
  const data: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  const url = tokenUrl + getQueryParamsString(data);

  const response = await fetch(url, {
    headers: {
      Authorization: 'Basic ' + authString,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    method: 'POST',
  });
  const jsonResponse: TokenResponse = await response.json() as TokenResponse;
  const accessToken = jsonResponse.access_token;
  return accessToken;
}

export function getAlbumId(album: SavedAlbum): string {
  return album.album.id;
}

export function getAlbumTracks(album: SavedAlbum): Track[] {
  return album.album.tracks.items;
}

export async function transferTracksToPlaylist(access_token: string, trackList: Track[], playlistId: string): Promise<boolean> {
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
  return response.status === 200;
}

export async function doesLibraryContainTrack(access_token: string, profileId: string, trackId: string): Promise<boolean> {
  // note that this function is not really necessary
  // GET /users/{profile_id}/tracks/contains?ids=id1,id2
  const response = await fetch(api + 'users/' + profileId + '/tracks/contains?ids=' + trackId, {
    headers: {
      Authorization: 'Bearer ' + access_token,
    },
  });
  const json: boolean[] = await response.json() as boolean[];
  return json[0];
}

export async function removeAlbumTracksFromLibrary(access_token: string, profileId: string, albumTracks: Track[]): Promise<void> {
  albumTracks.forEach(async function(track: Track) {
    await removeTrackFromLibrary(access_token, profileId, track.id);
  });
}

export async function removeTrackFromLibrary(access_token: string, profileId: string, trackId: string): Promise<boolean> {
  // DELETE /users/{profile_id}/tracks?ids=id1,id2
  const response = await fetch(api + 'users/' + profileId + '/tracks?ids=' + trackId, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  });
  return testResponse(response);
}

export async function removeAlbumFromLibrary(access_token: string, profileId: string, albumId: string): Promise<boolean> {
  // DELETE /users/{profile_id}/albums?ids=id1
  const response = await fetch(api + 'users/' + profileId + '/albums?ids=' + albumId, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  });
  return testResponse(response);
}

export async function removeTracks(access_token: string, profileId: string, tracks: Track[]): Promise<boolean> {
  const url = api + 'users/' + profileId + '/tracks';
  const trackIds: string[] = [];
  tracks.forEach(function(track: Track) {
    trackIds.push(track.id);
  });
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    },
    body: JSON.stringify(trackIds)
  });
  return testResponse(response);
}

export async function removeAlbums(access_token: string, profileId: string, albums: SavedAlbum[]): Promise<boolean> {
  const url = api + 'users/' + profileId + '/albums';
  const albumIds: string[] = [];
  albums.forEach(function(album: SavedAlbum) {
    albumIds.push(getAlbumId(album));
  });
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + access_token
    },
    body: JSON.stringify(albumIds)
  });
  return testResponse(response);
}

function testResponse(response: fetch.Response): boolean {
  if (response.status !== 200) {
    if (response.status === 429) {
      console.log('too many requests: ', response.headers);
    } else {
      console.log(response);
    }
  }
  return response.status === 200;
}

