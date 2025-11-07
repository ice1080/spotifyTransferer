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
  album: Album;
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

interface TrackItem {
  track: Track;
}

interface PlaylistTrackResponse {
  items: TrackItem[];
}

interface AlbumTrackResponse {
  items: Track[];
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
    artists += `${artist.name}, `;
  });
  return artists.substring(0, artists.length - 2);
}

function getAlbumString(album: SavedAlbum): string {
  return `${album.album.name} by ${getAlbumArtists(album)} (id: ${album.album.id})`;
}

export function logPlaylist(playlistName: string, playlistId: string) {
  logger.debug(`Playlist [${playlistName}] id: [${playlistId}]`);
}

export function logAlbum(album: SavedAlbum) {
  logger.debug(`transferring: ${getAlbumString(album)}`);
}

export function logAlbumTotal(total: number) {
  logger.debug(`total albums transferred: ${total}`);
}

export function logTrackTotal(total: number) {
  logger.debug(`total tracks transferred: ${total}`);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getQueryParamsString(dataMap: Record<string, string>): string {
  let queryString = '?';
  Object.keys(dataMap).forEach(function(key: string) {
    queryString += `${key}=${dataMap[key]}&`;
  });
  return queryString;
}

export async function refreshToken(authString: string, refreshToken: string): Promise<string> {
  const data: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  const url = `${tokenUrl}${getQueryParamsString(data)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    method: 'POST',
  });
  const jsonResponse: TokenResponse = await response.json() as TokenResponse;
  const accessToken = jsonResponse.access_token;
  return accessToken;
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

export class SpotifyApiHelper {
  private access_token: string;
  private profile_id: string;

  constructor(access_token: string, profile_id: string) {
    this.access_token = access_token;
    this.profile_id = profile_id;
  }

  async getPlaylistId(playlistName: string): Promise<string> {
    const response = await fetch(`${api}users/${this.profile_id}/playlists`, {
      headers: { Authorization: `Bearer ${this.access_token}` }
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

  async getSavedAlbums(): Promise<SavedAlbum[]> {
    const response = await fetch(`${api}users/${this.profile_id}/albums`, {
      headers: { Authorization: `Bearer ${this.access_token}` }
    });
    const json: UserAlbumsResponse = await response.json() as UserAlbumsResponse;

    return json.items;
  }

  async isAlbumSaved(albumId: string): Promise<boolean> {
    // GET /users/{profile_id}/albums/contains?ids=id1,id2
    const response = await fetch(`${api}/users/{profile_id}/albums/contains?ids=${albumId}`, {
      headers: { Authorization: `Bearer ${this.access_token}` }
    });
    const json: boolean[] = await response.json() as boolean[];
    return json[0];
  }

  async addAlbumToLibrary(albumId: string): Promise<boolean> {
    // POST /users/{profile_id}/albums
    const response = await fetch(`${api}users/${this.profile_id}/albums`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.access_token}` },
      body: JSON.stringify({ ids: [albumId] })
    });
    return response.status === 200;
  }

  getAlbumId(album: SavedAlbum): string {
    return album.album.id;
  }

  getSavedAlbumTracks(album: SavedAlbum): Track[] {
    return album.album.tracks.items;
  }

  async libraryContainsTracks(trackIds: string[]): Promise<boolean> {
    // GET /users/{profile_id}/tracks/contains?ids=id1,id2
    const response = await fetch(`${api}users/${this.profile_id}/tracks/contains?ids=${trackIds.join(',')}`, {
      headers: {
        Authorization: `Bearer ${this.access_token}`,
      },
    });
    const json: boolean[] = await response.json() as boolean[];
    return json.every(contains => contains);
  }

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    // GET /playlists/{playlist_id}/tracks
    const response = await fetch(`${api}playlists/${playlistId}/tracks?limit=50`, {
      headers: { Authorization: `Bearer ${this.access_token}` }
    });
    const json: PlaylistTrackResponse = await response.json() as PlaylistTrackResponse;
    return json.items.map(item => item.track);
  }

  async getAlbumTracks(albumId: string): Promise<Track[]> {
    // GET /albums/{id}/tracks
    const response = await fetch(`${api}albums/${albumId}/tracks?limit=50`, {
      headers: { Authorization: `Bearer ${this.access_token}` }
    });
    const json: AlbumTrackResponse = await response.json() as AlbumTrackResponse;
    return json.items;
  }

  async transferTracksToPlaylist(trackList: Track[], playlistId: string): Promise<boolean> {
    // POST /playlists/{playlist_id}/tracks
    // body {"uris": ["spotifyUri1","spotifyUri2"]}
    const response = await fetch(`${api}playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({uris: trackList.map(track => track.uri)}),
    });
    return response.status === 200;
  }

  async removeAlbumTracksFromPlaylist(albumTracks: Track[], playlistId: string) {
    await this.removeTracksFromPlaylist(albumTracks.map(track => track.id), playlistId);
  }

  async removeTracksFromPlaylist(trackIds: string[], playlistId: string): Promise<boolean> {
    // DELETE /users/{profile_id}/tracks?ids=id1,id2
    const response = await fetch(`${api}playlists/${playlistId}/tracks?ids=${trackIds.join(',')}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.access_token}`
      }
    });
    return testResponse(response);
  }

  async removeTracks(tracks: Track[]): Promise<boolean> {
    const url = `${api}users/${this.profile_id}/tracks`;
    const trackIds: string[] = [];
    tracks.forEach(function(track: Track) {
      trackIds.push(track.id);
    });
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.access_token}`
      },
      body: JSON.stringify(trackIds)
    });
    return testResponse(response);
  }

  async removeAlbums(albums: SavedAlbum[]): Promise<boolean> {
    const url = `${api}users/${this.profile_id}/albums`;
    const albumIds: string[] = [];
    albums.forEach((album: SavedAlbum) => {
      albumIds.push(this.getAlbumId(album));
    });
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.access_token}`
      },
      body: JSON.stringify(albumIds)
    });
    return testResponse(response);
  }
}
