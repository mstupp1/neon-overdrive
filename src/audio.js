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
    if (typeof AmbientPlayer !== 'undefined') {
        AmbientPlayer.updateMute();
    }
    return sfxMuted;
}

const musicTracks = [
    'src/audio/music/Pulse Collider 1.mp3',
    'src/audio/music/Pulse Collider 2.mp3',
    'src/audio/music/Laser Beam 1.mp3',
    'src/audio/music/Laser Beam 2.mp3',
    'src/audio/music/Heavy Gravity 1.mp3',
    'src/audio/music/Heavy Gravity 2.mp3',
    'src/audio/music/Nebula Ghosts 1.mp3',
    'src/audio/music/Nebula Ghosts 2.mp3',
    'src/audio/music/Rocket Jungle 1.mp3',
    'src/audio/music/Rocket Jungle 2.mp3',
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
    isPaused: false,
    lastPlayedTrack: null,
    isLateGame: false, // Track if we're playing late-game music
    isFading: false, // Track if we're currently fading
    savedVolume: 0.3, // Track saved volume for restoration
    fadeInterval: null,
    invincibilityPaused: false,
    invincibilitySavedTime: 0,
    invincibilitySavedVolume: 0.3,

    init() {
        this.audio.addEventListener('ended', () => {
            this.playNext();
        });
    },

    fadeVolumeTo(targetVolume, duration = 500) {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }

        const startVolume = this.audio.volume;
        const startTime = Date.now();
        const diff = targetVolume - startVolume;

        return new Promise((resolve) => {
            this.fadeInterval = setInterval(() => {
                const progress = Math.min((Date.now() - startTime) / duration, 1);
                this.audio.volume = Math.max(0, startVolume + diff * progress);
                if (progress >= 1) {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    resolve();
                }
            }, 50);
        });
    },

    pauseForInvincibility() {
        if (this.invincibilityPaused) return;
        if (!this.audio || !this.audio.src) return;
        this.invincibilityPaused = true;
        this.invincibilitySavedTime = this.audio.currentTime;
        this.invincibilitySavedVolume = this.audio.volume || 0.3;
        this.fadeVolumeTo(0, 400).then(() => {
            if (!this.invincibilityPaused) return;
            this.audio.pause();
        });
    },

    resumeFromInvincibility() {
        if (!this.invincibilityPaused) return;
        this.invincibilityPaused = false;
        try {
            this.audio.currentTime = this.invincibilitySavedTime || 0;
        } catch (e) {
            /* Some browsers may block setting currentTime; ignore */
        }
        const playPromise = this.audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((e) => console.warn('Music resume failed:', e));
        }
        this.fadeVolumeTo(this.invincibilitySavedVolume || 0.3, 400);
    },

    clearInvincibilityPause() {
        this.invincibilityPaused = false;
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
        this.isPaused = false;
        this.audio.play().catch(e => console.warn("Audio play failed:", e));

        // Extract song name from path (e.g., "src/audio/music/Song Name.mp3" -> "Song Name")
        const songName = track.split('/').pop().replace(/\.[^/.]+$/, "");
        if (typeof showSongToast === 'function') {
            showSongToast(songName);
        }
    },

    playPrevious() {
        // Can't go before the start of the playlist
        if (this.currentTrackIndex <= 0) {
            // Restart current track if at the beginning
            this.audio.currentTime = 0;
            return;
        }

        this.currentTrackIndex--;
        const track = this.playlist[this.currentTrackIndex];
        this.lastPlayedTrack = track;

        this.audio.src = track;
        this.audio.volume = 0.3;
        this.isPaused = false;
        this.audio.play().catch(e => console.warn("Audio play failed:", e));

        // Extract song name from path
        const songName = track.split('/').pop().replace(/\.[^/.]+$/, "");
        if (typeof showSongToast === 'function') {
            showSongToast(songName);
        }
    },

    togglePlayPause() {
        if (!this.audio.src) return false;

        if (this.isPaused || this.audio.paused) {
            // Resume playback
            this.audio.play().catch(e => console.warn("Audio play failed:", e));
            this.isPaused = false;
            return false; // Not paused
        } else {
            // Pause playback
            this.audio.pause();
            this.isPaused = true;
            return true; // Is paused
        }
    },

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.isPaused = false;
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
            InvincibilityPlayer.setMuted(false);
            return false;
        } else {
            this.audio.muted = true;
            InvincibilityPlayer.setMuted(true);
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

    playBossMusic(trackUrl) {
        if (this.isBossMusic) return; // Already playing boss music

        this.fadeOut(2000).then(() => {
            this.isBossMusic = true;
            this.audio.loop = true; // Loop boss music
            this.audio.src = trackUrl;
            this.audio.play().catch(e => console.warn("Boss music play failed:", e));

            // Start at 0 volume for fade in
            this.audio.volume = 0;
            this.fadeIn(2000, 0.3);

            // Extract song name from path
            const songName = trackUrl.split('/').pop().replace(/\.[^/.]+$/, "");
            if (typeof showSongToast === 'function') {
                showSongToast(songName);
            }
        });
    },

    resumeNormalMusic() {
        if (!this.isBossMusic) return;

        this.fadeOut(2000).then(() => {
            this.isBossMusic = false;
            this.audio.loop = false; // Turn off loop

            // Shuffle if playlist ended, or just play next/resume
            // playNext() increments index, so we might want to be careful if we want to "resume" 
            // exactly where we were, but shuffling/playing next is usually fine for games.
            this.playNext();

            this.audio.volume = 0;
            this.fadeIn(2000, 0.3);
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

const InvincibilityPlayer = {
    audio: new Audio('src/audio/music/Invincibility.mp3'),
    isPlaying: false,

    play() {
        this.stop();
        this.audio.currentTime = 0;
        this.audio.loop = true;
        this.audio.volume = 0.25;
        this.audio.muted = MusicPlayer.audio?.muted ?? false;
        this.audio.play().catch((e) => console.warn('Invincibility track failed to play:', e));
        this.isPlaying = true;
    },

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
    },

    setMuted(isMuted) {
        this.audio.muted = isMuted;
    },
};

const AmbientPlayer = {
    buffer: null,
    sources: [],
    gainNode: null,
    isPlaying: false,
    url: 'src/audio/sfx/space_vessel_bg.mp3',
    crossfadeDuration: 3.0, // Seconds
    volume: 0.02,
    nextStartTime: 0,
    isLoaded: false,

    init() {
        this.gainNode = audioCtx.createGain();
        this.gainNode.connect(audioCtx.destination);
        this.gainNode.gain.value = sfxMuted ? 0 : this.volume;
        this.load();
    },

    async load() {
        try {
            console.log("Loading ambient sound from:", this.url);
            const response = await fetch(this.url);
            const arrayBuffer = await response.arrayBuffer();
            this.buffer = await audioCtx.decodeAudioData(arrayBuffer);
            this.isLoaded = true;
            console.log("Ambient sound loaded successfully. Duration:", this.buffer.duration);
            if (this.isPlaying) {
                this.startPlayback();
            }
        } catch (e) {
            console.warn("Failed to load ambient sound:", e);
        }
    },

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.gainNode.gain.value = sfxMuted ? 0 : this.volume;

        if (audioCtx.state === 'suspended') audioCtx.resume();

        if (this.isLoaded) {
            this.startPlayback();
        }
    },

    stop() {
        this.isPlaying = false;
        this.sources.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        this.sources = [];
        if (this.schedulerTimer) {
            clearTimeout(this.schedulerTimer);
            this.schedulerTimer = null;
        }
    },

    updateMute() {
        if (this.gainNode) {
            // Smoothly transition volume
            const target = sfxMuted ? 0 : this.volume;
            this.gainNode.gain.setTargetAtTime(target, audioCtx.currentTime, 0.1);
        }
    },

    startPlayback() {
        if (!this.buffer || !this.isPlaying) return;

        // Start the first source immediately
        this.playSegment(audioCtx.currentTime);
    },

    playSegment(time) {
        if (!this.isPlaying) return;

        const source = audioCtx.createBufferSource();
        source.buffer = this.buffer;

        // Create a local gain for crossfading this specific segment
        const segmentGain = audioCtx.createGain();
        source.connect(segmentGain);
        segmentGain.connect(this.gainNode);

        // Fade in
        segmentGain.gain.setValueAtTime(0, time);
        segmentGain.gain.linearRampToValueAtTime(1, time + this.crossfadeDuration);

        // Play
        source.start(time);

        // Schedule fade out and stop
        const duration = this.buffer.duration;
        // Ensure crossfade isn't too long for the file
        const actualCrossfade = Math.min(this.crossfadeDuration, duration / 2);

        const endTime = time + duration;
        const fadeOutStart = endTime - actualCrossfade;

        segmentGain.gain.setValueAtTime(1, fadeOutStart);
        segmentGain.gain.linearRampToValueAtTime(0, endTime);

        source.stop(endTime);

        // Keep track of source
        this.sources.push(source);
        // Cleanup old sources
        this.sources = this.sources.filter(s => {
            // Simple cleanup: remove if it would have stopped by now (plus a buffer)
            // We can't easily check .state on created sources in all browsers, so time-based is safer
            return true;
        });

        // Schedule next segment
        // The next segment should start when the fade out begins (overlap)
        const nextTime = fadeOutStart;
        const timeUntilNext = (nextTime - audioCtx.currentTime) * 1000;

        this.schedulerTimer = setTimeout(() => {
            this.playSegment(nextTime);
        }, timeUntilNext);
    }
};

MusicPlayer.init();
AmbientPlayer.init();
