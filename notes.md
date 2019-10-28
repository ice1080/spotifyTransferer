

To run:
* npm start




Notes:
* Login from localhost:8888
* refresh token
* click transfer button





Todo:
* for each saved album, get album tracks
** SpotifyApiHelper.getAlbumTracks --DONE
* for each track, transfer them to the playlist
** SpotifyApiHelper.transferTracksToPlaylist
*** need to get the uris for the tracklist and then test
* then, unsave the track if it is already saved
** SpotifyApiHelper.doesLibraryContainTrack
** SpotifyApiHelper.removeTrackFromLibrary
* then unsave the album
** SpotifyApiHelper.removeAlbumFromLibrary