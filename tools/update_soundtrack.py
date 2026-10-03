#!/usr/bin/env python3
"""
Automated soundtrack update pipeline for NEON OVERDRIVE.
Processes newly added tracks in 'src/New music/' (Suno .m4a exports or .mp3),
converts them to 192kbps MP3 in 'src/audio/music/', updates 'src/core/audio.js',
and regenerates 'src/audio/beatmap.js' via tools/beatmap.py.
"""
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
NEW_MUSIC_DIR = os.path.join(ROOT, 'src', 'New music')
MUSIC_DIR = os.path.join(ROOT, 'src', 'audio', 'music')
AUDIO_JS = os.path.join(ROOT, 'src', 'core', 'audio.js')
BEATMAP_PY = os.path.join(ROOT, 'tools', 'beatmap.py')
BEATMAP_JS = os.path.join(ROOT, 'src', 'audio', 'beatmap.js')


def find_ffmpeg():
    for candidate in ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg']:
        try:
            res = subprocess.run([candidate, '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if res.returncode == 0:
                return candidate
        except FileNotFoundError:
            continue
    return None


def resolve_output_name(filename):
    base, _ = os.path.splitext(filename)
    # Check for duplicate indicator '(1)'
    m = re.match(r'^(.*?)\s*\(1\)$', base)
    if m:
        return f"{m.group(1)} 2.mp3"
    # Check if a paired '(1)' file exists in the directory
    pair_path = os.path.join(NEW_MUSIC_DIR, f"{base} (1).m4a")
    if os.path.exists(pair_path):
        return f"{base} 1.mp3"
    pair_path_mp3 = os.path.join(NEW_MUSIC_DIR, f"{base} (1).mp3")
    if os.path.exists(pair_path_mp3):
        return f"{base} 1.mp3"
    return f"{base}.mp3"


def convert_new_tracks():
    if not os.path.isdir(NEW_MUSIC_DIR):
        print("No 'src/New music/' directory found.")
        return 0

    files = [f for f in sorted(os.listdir(NEW_MUSIC_DIR)) if f.lower().endswith(('.m4a', '.mp3', '.opus', '.wav'))]
    if not files:
        print("No new music files found in 'src/New music/'.")
        return 0

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        sys.exit("Error: ffmpeg is required for audio conversion but was not found.")

    os.makedirs(MUSIC_DIR, exist_ok=True)
    count = 0
    for filename in files:
        src_path = os.path.join(NEW_MUSIC_DIR, filename)
        out_name = resolve_output_name(filename)
        dest_path = os.path.join(MUSIC_DIR, out_name)

        print(f"Converting '{filename}' -> '{out_name}'...")
        cmd = [ffmpeg, '-y', '-i', src_path, '-b:a', '192k', dest_path, '-loglevel', 'error']
        subprocess.check_call(cmd)
        count += 1

    # Clean up processed files
    for filename in files:
        os.remove(os.path.join(NEW_MUSIC_DIR, filename))
    try:
        os.rmdir(NEW_MUSIC_DIR)
    except OSError:
        pass

    print(f"Converted and imported {count} tracks.")
    return count


def update_audio_js():
    tracks = sorted([os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(MUSIC_DIR, '*.mp3'))])
    if not tracks:
        print("No mp3 tracks found in music directory.")
        return

    with open(AUDIO_JS, 'r', encoding='utf-8') as f:
        content = f.read()

    # Format tracks list cleanly with indentation
    lines = ['const NORMAL = [']
    # Group in pairs if possible
    i = 0
    while i < len(tracks):
        if i + 1 < len(tracks) and tracks[i].rsplit(' ', 1)[0] == tracks[i + 1].rsplit(' ', 1)[0]:
            lines.append(f"  {repr(tracks[i])}, {repr(tracks[i+1])},")
            i += 2
        else:
            lines.append(f"  {repr(tracks[i])},")
            i += 1
    lines.append('];')
    new_normal = '\n'.join(lines)

    content = re.sub(r'const NORMAL = \[[^\]]*\];', new_normal, content, flags=re.DOTALL)
    with open(AUDIO_JS, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated NORMAL playlist in src/core/audio.js ({len(tracks)} tracks).")


def regenerate_beatmap():
    print("Regenerating beat map with tools/beatmap.py...")
    cmd = [sys.executable, BEATMAP_PY]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    with open(BEATMAP_JS, 'w', encoding='utf-8') as f:
        f.write(res.stdout)
    print("Beat map generated at src/audio/beatmap.js.")


def validate():
    for js in [AUDIO_JS, BEATMAP_JS]:
        subprocess.run(['node', '-c', js], check=True)
    print("JavaScript syntax validation passed.")


if __name__ == '__main__':
    convert_new_tracks()
    update_audio_js()
    regenerate_beatmap()
    validate()
    print("Done! Soundtrack update complete.")
