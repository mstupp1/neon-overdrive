---
name: music-pipeline
description: >-
  Pipeline for processing and integrating new music into NEON OVERDRIVE.
  Converts .m4a / Suno audio in 'src/New music/' to 192kbps MP3s in 'src/audio/music/',
  updates playlists in 'src/core/audio.js', regenerates beat maps in 'src/audio/beatmap.js',
  and validates game audio playback. Use whenever music files are added, replaced, or updated.
---

# NEON OVERDRIVE Soundtrack & Beatmap Pipeline

This skill defines the canonical workflow for adding, converting, and integrating music tracks into the game.

---

## 1. Automated Workflow (One-Step)

When new tracks (.m4a / Suno downloads / .opus / .mp3) are dropped into `src/New music/`:

```bash
python3 tools/update_soundtrack.py
```

This automated runner:
1. Detects Suno pairs (`<Title>.m4a` and `<Title> (1).m4a`) and maps them to `<Title> 1.mp3` and `<Title> 2.mp3`.
2. Encodes single tracks to `<Title>.mp3`.
3. Converts Opus/m4a to 192kbps MP3 via `ffmpeg` (required for Safari/iOS compatibility).
4. Moves outputs into `src/audio/music/` and deletes `src/New music/`.
5. Updates the `NORMAL` playlist in [`src/core/audio.js`](../../src/core/audio.js).
6. Runs [`tools/beatmap.py`](../../tools/beatmap.py) using `librosa` to regenerate [`src/audio/beatmap.js`](../../src/audio/beatmap.js).
7. Validates JavaScript syntax with `node -c`.

---

## 2. Manual Step-by-Step Procedure

If performing or verifying steps individually:

### Step 1: Transcode Audio to MP3
Safari and mobile iOS do not reliably stream Opus inside `.m4a` containers via HTML5 `<audio>`. All tracks must be standard MP3:

```bash
ffmpeg -y -i "src/New music/<track>.m4a" -b:a 192k "src/audio/music/<track>.mp3" -loglevel error
```

### Step 2: Configure Playlists in `src/core/audio.js`
- **`NORMAL`**: Shuffled sector rotation. Add all exploration tracks.
- **`LATE`**: Loudest, highest-tempo tracks (level >= 7 or deep runs).
- **`BOSS`**: 4 tracks mapped to Warden, Hydra, Omega, and Eclipse.

### Step 3: Rebuild Beat Map
Visual effects (floor grid pulse, horizon swell, bloom punch, overworld grid) dynamically follow the audio's beat and RMS kick onset via [`src/core/beat.js`](../../src/core/beat.js):

```bash
python3 tools/beatmap.py > src/audio/beatmap.js
```
*Note: Requires `librosa` (`python3 -m pip install librosa`).*

### Step 4: Verification
Verify JavaScript syntax:
```bash
node -c src/core/audio.js
node -c src/audio/beatmap.js
```
Test in browser or sandbox runner (`window.NEON.startRun('vector')` or `NEON.simulate(60)`).
