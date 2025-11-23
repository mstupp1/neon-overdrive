/**
 * AUDIO SYSTEM
 */

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (gameState === 'DEMO') return; // Muted in demo
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

const musicTracks = [
    'src/audio/music/Space Crossfire 1 - AI Music.mp3',
    'src/audio/music/Space Crossfire 2 - AI Music.mp3',
    'src/audio/music/Cosmic Waves 1 - AI Music.mp3',
    'src/audio/music/Cosmic Waves 2 - AI Music.mp3',
    'src/audio/music/Galactic Frenzy 1 - AI Music.mp3',
    'src/audio/music/Galactic Frenzy 2 - AI Music.mp3',
    'src/audio/music/Galactic Showdown 1 - AI Music.mp3',
    'src/audio/music/Galactic Showdown 2 - AI Music.mp3',
    'src/audio/music/Starfire Rumble 1 - AI Music.mp3',
    'src/audio/music/Starfire Rumble 2 - AI Music.mp3'
];

const MusicPlayer = {
    playlist: [],
    currentTrackIndex: -1,
    audio: new Audio(),
    isPlaying: false,
    lastPlayedTrack: null,

    init() {
        this.audio.addEventListener('ended', () => {
            this.playNext();
        });
    },

    shufflePlaylist() {
        // Create a copy of tracks
        let tracks = [...musicTracks];

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
    }
};

MusicPlayer.init();
