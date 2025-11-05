/**
 * This is a simple node.js script that transfers songs from saved albums
 * into a playlist of choice, and then unsaves the albums and songs.
 * 
 * To use, run the app with `npm start`, navigate to http://localhost:8888/,
 * and click Make Transfer. It only does 20 albums at a time, so has to be 
 * clicked a bunch. Logs are stored in "transferer.log".
 */

import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import querystring from 'querystring';
import cookieParser from 'cookie-parser';
import {
  getAlbumId,
  getAlbumTracks,
  getPlaylistId,
  getSavedAlbums,
  logAlbum,
  logAlbumTotal,
  logPlaylist,
  logTrackTotal,
  refreshToken,
  removeAlbums,
  removeTracks,
  sleep,
  transferTracksToPlaylist
} from './SpotifyApiHelper';
import path from 'path';

const client_id: string = process.env.SPOTIFY_TRANSFER_CLIENT_ID || 'NOT_SET';
const client_secret: string = process.env.SPOTIFY_TRANSFER_CLIENT_SECRET || 'NOT_SET';
const redirect_uri: string = 'http://localhost:8888/callback';

function getAuthString(): string {
  return Buffer.from(client_id + ':' + client_secret).toString('base64');
}

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
function generateRandomString(length: number): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

const stateKey = 'spotify_auth_state';

const app = express();

app.use(express.static(path.join(__dirname, 'public')))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req: Request, res: Response) {

  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope = 'user-read-private user-read-email playlist-modify user-library-modify user-library-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', async function(req: Request, res: Response) {
  const code = req.query.code as string || null;
  const state = req.query.state as string || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
    return;
  }

  res.clearCookie(stateKey);

  try {
    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      code: code!,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code'
    });

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + getAuthString(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      console.log('invalid token', tokenResponse.status, await tokenResponse.text());
      res.redirect('/#' +
        querystring.stringify({
          error: 'invalid_token'
        }));
      return;
    }

    const tokenData = await tokenResponse.json() as { access_token: string; refresh_token: string };
    const access_token = tokenData.access_token;
    const refresh_token = tokenData.refresh_token;

    // Fetch user profile (optional, not used but kept for compatibility)
    try {
      await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': 'Bearer ' + access_token }
      });
    } catch (error) {
      // Silently ignore profile fetch errors
    }

    // Redirect to browser with tokens
    res.redirect('/#' +
      querystring.stringify({
        access_token: access_token,
        refresh_token: refresh_token
      }));
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect('/#' +
      querystring.stringify({
        error: 'invalid_token'
      }));
  }
});

app.get('/refresh_token', async function(req: Request, res: Response) {
  const refresh_token = req.query.refresh_token as string;
  const authString = getAuthString();
  
  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + authString,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    });

    if (!response.ok) {
      console.error('Failed to refresh token:', response.status, await response.text());
      res.status(response.status).send({ error: 'Failed to refresh token' });
      return;
    }

    const body = await response.json() as { access_token: string };
    res.send({
      'access_token': body.access_token
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});



app.get('/make_transfer', async function(req: Request, res: Response) {
  const access_token = req.query.access_token as string;
  const refresh_token = req.query.refresh_token as string;
  const profileId = req.query.profile_id as string;

  // todo change this to an input variable on the screen
  const preferred_playlist_name = 'Collection3';

  // refresh the token
  // todo perhaps remove this, could be what's slowing everything down
  const refreshed_access_token = await refreshToken(getAuthString(), refresh_token);
  
  const playlistId = await getPlaylistId(refreshed_access_token, profileId, preferred_playlist_name);

  logPlaylist(preferred_playlist_name, playlistId);

  const savedAlbums = await getSavedAlbums(refreshed_access_token, profileId);

  let trackTotal = 0;
  for (const album of savedAlbums) {
    logAlbum(album);
    const albumId = getAlbumId(album);
    const albumTracks = getAlbumTracks(album);
    await transferTracksToPlaylist(refreshed_access_token, albumTracks, playlistId);

    await removeTracks(refreshed_access_token, profileId, albumTracks);
    trackTotal += albumTracks.length;
    logTrackTotal(trackTotal);
  }

  await sleep(1000);
  await removeAlbums(refreshed_access_token, profileId, savedAlbums);
  logAlbumTotal(savedAlbums.length);
  
  res.send({ status: 'completed' });
});


console.log('Listening on 8888');
app.listen(8888);

