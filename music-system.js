const axios = require('axios');
const ytdl = require('ytdl-core');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, 'config');
const PLAYLISTS_FILE = path.join(CONFIG_DIR, 'playlists.json');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

class MusicSystem {
    constructor(client) {
        this.client = client;
        this.queues = new Map(); // guildId -> {queue: [], playing: bool, current: Song, player: AudioPlayer, connection: VoiceConnection}
        this.playlists = this.loadPlaylists();
    }

    // Get or create queue for guild
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                queue: [],
                playing: false,
                current: null,
                player: null,
                connection: null,
                loop: 'off', // 'off', 'one', 'all'
                volume: 1
            });
        }
        return this.queues.get(guildId);
    }

    // Search YouTube
    async searchYouTube(query) {
        try {
            const response = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
            const videoIdMatch = response.data.match(/\\"\\"\\"\""\/watch\\?v=([a-zA-Z0-9_-]{11})/);
            
            if (!videoIdMatch) return null;

            const videoId = videoIdMatch[1];
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            
            try {
                const info = await ytdl.getInfo(videoUrl);
                return {
                    source: 'youtube',
                    title: info.videoDetails.title,
                    artist: info.videoDetails.author.name,
                    url: videoUrl,
                    duration: parseInt(info.videoDetails.lengthSeconds),
                    thumbnail: info.videoDetails.thumbnail.thumbnails[0]?.url,
                    videoId: videoId
                };
            } catch (error) {
                console.error('Error getting YouTube info:', error.message);
                return null;
            }
        } catch (error) {
            console.error('YouTube search error:', error.message);
            return null;
        }
    }

    // Search both Spotify & YouTube (Hybrid)
    async searchBoth(query, spotifyClientId, spotifyClientSecret) {
        try {
            // Try Spotify first
            const spotifyResult = await this.searchSpotify(query, spotifyClientId, spotifyClientSecret);
            
            if (spotifyResult) {
                // Convert Spotify to YouTube search string
                const youtubeQuery = `${spotifyResult.title} ${spotifyResult.artist}`;
                const youtubeResult = await this.searchYouTube(youtubeQuery);
                
                if (youtubeResult) {
                    // Return combined result: YouTube audio + Spotify metadata
                    return {
                        source: 'hybrid',
                        spotifySource: 'spotify',
                        youtubeSource: 'youtube',
                        title: spotifyResult.title,
                        artist: spotifyResult.artist,
                        url: youtubeResult.url,
                        duration: youtubeResult.duration,
                        thumbnail: spotifyResult.thumbnail || youtubeResult.thumbnail,
                        videoId: youtubeResult.videoId,
                        spotifyUrl: spotifyResult.url,
                        spotifyId: spotifyResult.spotifyId,
                        hybridInfo: `🎵 Found on Spotify, streaming from YouTube`
                    };
                } else {
                    // Spotify found but no YouTube match, fallback to pure Spotify (can't stream)
                    return spotifyResult;
                }
            }
            
            // If Spotify fails or no results, search YouTube directly
            return await this.searchYouTube(query);
        } catch (error) {
            console.error('Hybrid search error:', error.message);
            return null;
        }
    }

    // Search Spotify
    async searchSpotify(query, spotifyClientId, spotifyClientSecret) {
        try {
            if (!spotifyClientId || !spotifyClientSecret) return null;

            const auth = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64');
            const tokenResponse = await axios.post('https://accounts.spotify.com/api/token',
                'grant_type=client_credentials',
                { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const accessToken = tokenResponse.data.access_token;

            const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
                params: { q: query, type: 'track', limit: 1 },
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (searchResponse.data.tracks.items.length === 0) return null;

            const track = searchResponse.data.tracks.items[0];
            const duration = track.duration_ms / 1000;

            return {
                source: 'spotify',
                title: track.name,
                artist: track.artists[0].name,
                url: track.external_urls.spotify,
                duration: Math.floor(duration),
                thumbnail: track.album.images[0]?.url,
                spotifyId: track.id
            };
        } catch (error) {
            console.error('Spotify search error:', error.message);
            return null;
        }
    }

    // Format time
    formatTime(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Add song to queue
    async addToQueue(guildId, song) {
        const queue = this.getQueue(guildId);
        queue.queue.push(song);
        return song;
    }

    // Get current playing song
    getCurrentSong(guildId) {
        const queue = this.getQueue(guildId);
        return queue.current || null;
    }

    // Get full queue
    getFullQueue(guildId) {
        const queue = this.getQueue(guildId);
        return queue.queue;
    }

    // Skip song
    async skipSong(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.queue.length === 0) return null;

        const nextSong = queue.queue.shift();
        queue.current = nextSong;

        // TODO: Play audio resource for nextSong
        return nextSong;
    }

    // Remove song from queue
    removeSongFromQueue(guildId, index) {
        const queue = this.getQueue(guildId);
        if (index < 0 || index >= queue.queue.length) return null;

        const removed = queue.queue.splice(index, 1);
        return removed[0];
    }

    // Shuffle queue
    shuffleQueue(guildId) {
        const queue = this.getQueue(guildId);
        const arr = queue.queue;

        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        queue.queue = arr;
        return queue.queue;
    }

    // Set loop mode
    setLoopMode(guildId, mode) {
        const queue = this.getQueue(guildId);
        if (!['off', 'one', 'all'].includes(mode)) return false;

        queue.loop = mode;
        return true;
    }

    // Playlist functions
    loadPlaylists() {
        try {
            if (fs.existsSync(PLAYLISTS_FILE)) {
                return JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
            }
            return {};
        } catch (error) {
            console.error('Error loading playlists:', error);
            return {};
        }
    }

    savePlaylists() {
        try {
            fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(this.playlists, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving playlists:', error);
        }
    }

    // Create playlist
    createPlaylist(userId, name) {
        const playlistId = `${userId}_${Date.now()}`;
        this.playlists[playlistId] = {
            id: playlistId,
            name: name,
            owner: userId,
            songs: [],
            createdAt: new Date().toISOString()
        };

        this.savePlaylists();
        return this.playlists[playlistId];
    }

    // Get user playlists
    getUserPlaylists(userId) {
        return Object.values(this.playlists).filter(pl => pl.owner === userId);
    }

    // Add song to playlist
    addToPlaylist(playlistId, song) {
        if (!this.playlists[playlistId]) return false;

        this.playlists[playlistId].songs.push(song);
        this.savePlaylists();
        return true;
    }

    // Remove song from playlist
    removeSongFromPlaylist(playlistId, index) {
        if (!this.playlists[playlistId]) return false;

        this.playlists[playlistId].songs.splice(index, 1);
        this.savePlaylists();
        return true;
    }

    // Delete playlist
    deletePlaylist(playlistId) {
        if (!this.playlists[playlistId]) return false;

        delete this.playlists[playlistId];
        this.savePlaylists();
        return true;
    }

    // Get playlist
    getPlaylist(playlistId) {
        return this.playlists[playlistId] || null;
    }

    // Stop playback
    stopPlayback(guildId) {
        const queue = this.getQueue(guildId);
        queue.queue = [];
        queue.current = null;
        queue.playing = false;

        if (queue.connection) {
            queue.connection.destroy();
            queue.connection = null;
        }
    }

    // Clear queue
    clearQueue(guildId) {
        const queue = this.getQueue(guildId);
        queue.queue = [];
    }

    // Pause playback
    pausePlayback(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.player) {
            queue.player.pause();
            queue.playing = false;
            return true;
        }
        return false;
    }

    // Resume playback
    resumePlayback(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.player) {
            queue.player.unpause();
            queue.playing = true;
            return true;
        }
        return false;
    }
}

module.exports = MusicSystem;
