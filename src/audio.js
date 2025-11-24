/**
 * AUDIO SYSTEM
 */

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (gameState === 'DEMO') return; // Muted in demo
    if (sfxMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'bomb') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 1.0);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start(now); osc.stop(now + 1.0);
    } else if (type === 'shieldBreak') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(0, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'powerup') {
        // Added missing powerup sound based on usage in game.js
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    }
}

let sfxMuted = false;
function toggleSfxMute() {
    sfxMuted = !sfxMuted;
    return sfxMuted;
}

const musicTracks = [
    'src/audio/music/Nebula Ghosts 1.mp3',
    'src/audio/music/Nebula Ghosts 2.mp3',
    'src/audio/music/Galactic Shadows 1.mp3',
    'src/audio/music/Galactic Shadows 2.mp3',
    'src/audio/music/Neon Horizons 1.mp3',
    'src/audio/music/Neon Horizons 2.mp3',
    'src/audio/music/Neon Shadows 1.mp3',
    'src/audio/music/Neon Shadows 2.mp3',
    'src/audio/music/Photon Drift 1.mp3',
    'src/audio/music/Photon Drift 2.mp3',
    'src/audio/music/Star Echoes 1.mp3',
    'src/audio/music/Star Echoes 2.mp3',
    'src/audio/music/Space Crossfire 1.mp3',
    'src/audio/music/Space Crossfire 2.mp3',
    'src/audio/music/Cosmic Waves 1.mp3',
    'src/audio/music/Cosmic Waves 2.mp3',
    'src/audio/music/Galactic Frenzy 1.mp3',
    'src/audio/music/Galactic Frenzy 2.mp3',
    'src/audio/music/Galactic Showdown 1.mp3',
    'src/audio/music/Galactic Showdown 2.mp3',
    'src/audio/music/Starfire Rumble 1.mp3',
    'src/audio/music/Starfire Rumble 2.mp3'
];

// Late-game music for stage 7+
const lateGameMusicTracks = [
    'src/audio/music/The Tyrant\'s March.mp3',
    'src/audio/music/The Final Shadow.mp3'
];

const MusicPlayer = {
    playlist: [],
    currentTrackIndex: -1,
    audio: new Audio(),
    isPlaying: false,
    lastPlayedTrack: null,
    isLateGame: false, // Track if we're playing late-game music
    isFading: false, // Track if we're currently fading
    savedVolume: 0.3, // Track saved volume for restoration
    fadeInterval: null,

    init() {
        this.audio.addEventListener('ended', () => {
            this.playNext();
        });
    },

    shufflePlaylist() {
        // Use late-game tracks if we're in late-game mode, otherwise use normal tracks
        const sourceList = this.isLateGame ? lateGameMusicTracks : musicTracks;

        // Create a copy of tracks
        let tracks = [...sourceList];

        // Fisher-Yates shuffle
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }

        // Ensure the first song of the new playlist isn't the same as the last song played
        // Only if we have more than 1 track
        if (this.lastPlayedTrack && tracks.length > 1) {
            if (tracks[0] === this.lastPlayedTrack) {
                // Swap first with last to avoid repeat
                [tracks[0], tracks[tracks.length - 1]] = [tracks[tracks.length - 1], tracks[0]];
            }
        }

        this.playlist = tracks;
        this.currentTrackIndex = -1;
    },

    playNext() {
        if (this.playlist.length === 0 || this.currentTrackIndex >= this.playlist.length - 1) {
            this.shufflePlaylist();
        }

        this.currentTrackIndex++;
        const track = this.playlist[this.currentTrackIndex];
        this.lastPlayedTrack = track;

        this.audio.src = track;
        this.audio.volume = 0.3; // Background music volume
        this.audio.play().catch(e => console.warn("Audio play failed:", e));

        // Extract song name from path (e.g., "src/audio/music/Song Name.mp3" -> "Song Name")
        const songName = track.split('/').pop().replace(/\.[^/.]+$/, "");
        if (typeof showSongToast === 'function') {
            showSongToast(songName);
        }
    },

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.playNext();
    },

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
    },

    toggleMute() {
        if (this.audio.muted) {
            this.audio.muted = false;
            return false;
        } else {
            this.audio.muted = true;
            return true;
        }
    },

    cancelFade() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        this.isFading = false;
    },

    fadeOut(duration = 2000, pauseAfterFade = true) {
        this.cancelFade();
        this.isFading = true;

        return new Promise((resolve) => {
            const startVolume = this.audio.volume;
            const startTime = Date.now();

            this.fadeInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Linear fade out
                this.audio.volume = startVolume * (1 - progress);

                if (progress >= 1) {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    if (pauseAfterFade) {
                        this.audio.pause();
                        this.audio.currentTime = 0;
                    }
                    this.isFading = false;
                    resolve();
                }
            }, 50);
        });
    },

    switchToLateGameMusic() {
        if (this.isLateGame) return; // Already in late-game mode

        this.fadeOut(2000).then(() => {
            this.isLateGame = true;
            this.shufflePlaylist();
            this.playNext();
        });
    },

    fadeIn(duration = 2000, targetVolume = null) {
        this.cancelFade();
        this.isFading = true;

        return new Promise((resolve) => {
            const finalVolume = targetVolume ?? this.savedVolume;
            const startTime = Date.now();

            this.fadeInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Linear fade in
                this.audio.volume = finalVolume * progress;

                if (progress >= 1) {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    this.isFading = false;
                    resolve();
                }
            }, 50);
        });
    },

    fadeOutForPassiveSelect(duration = 3000) {
        // Fade to very quiet (not completely silent) without pausing
        this.savedVolume = this.audio.volume;
        return this.fadeOut(duration, false);
    },

    fadeInAfterPassiveSelect(duration = 3000) {
        // Restore to saved volume
        return this.fadeIn(duration, this.savedVolume);
    },

    restartMusic() {
        // Fade out, reset to early game music, and fade in
        this.fadeOut(1000).then(() => {
            this.stop();
            this.isLateGame = false;
            this.shufflePlaylist();
            this.playNext();
            // Start at 0 volume for fade in (playNext sets it to 0.3)
            this.audio.volume = 0;
            this.fadeIn(2000, 0.3);
        });
    },

    switchToNormalMusic() {
        if (!this.isLateGame) return; // Already in normal mode

        this.fadeOut(2000).then(() => {
            this.isLateGame = false;
            this.shufflePlaylist();
            this.playNext();
        });
    }
};

MusicPlayer.init();
