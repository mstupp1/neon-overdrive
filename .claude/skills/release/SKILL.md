---
name: release
description: Ship a Neon Overdrive desktop version (Windows/macOS/Linux) from a v* tag, check the build, and record it. Use when asked to publish, release, tag or version the game, or about the desktop app's updates.
---

# Releasing Neon Overdrive

The web build is the source of truth. Merging to `main` puts it live on GitHub Pages (a branch deploy; there is no Pages
workflow). A desktop release is a snapshot of `main` that players install and that auto-updates.

## How it fits together

- `desktop/` is an Electron shell. It serves `index.html` + `src/` unchanged from `app://neon-overdrive`. Desktop saves
  live there, separate from browser saves. It starts fullscreen, and QUIT shows on the title menu only when
  `window.desktop` exists (`desktop/preload.js`).
- `.github/workflows/release.yml`:
  - **Tag push `v*`:** creates a draft GitHub Release, builds Windows (NSIS .exe), macOS (universal .dmg + .zip,
    unsigned) and Linux (.AppImage, also for Steam Deck), uploads them with the `latest*.yml` update manifests, then
    publishes the release once all three succeed. If any build fails, the release stays a draft and nobody gets it.
  - **Manual run (Actions → Desktop release → Run workflow):** builds all three as downloadable run artifacts (kept
    14 days) and publishes nothing. Use it to test a build first.
- Installed apps check GitHub Releases on launch (electron-updater), download in the background, toast "UPDATE READY"
  and install on quit. Unsigned macOS builds cannot self-update. Mac players re-download until there is an Apple
  Developer ID.
- The app version comes from the tag. CI runs `npm version` on `desktop/package.json`, so the repo's `"version"`
  field doesn't need bumping and only matters for local builds.

## Shipping a version

1. **Confirm with Myles first.** A tag push ships to every installed copy and can't be pulled back, only superseded.
2. Make sure `main` is what you want to ship: merged, playtested, no console errors.
3. Pick the version. Releases are `0.MINOR.PATCH` until 1.0: PATCH for fixes and balance, MINOR for new features or
   content. Never reuse a version: installed apps only update to a higher one. Check the log below for the last one.
4. Tag `main` and push the tag:
   ```sh
   git fetch origin main && git tag vX.Y.Z origin/main && git push origin vX.Y.Z
   ```
   If the cloud session's git proxy refuses the tag push, give Myles the two commands to run locally instead.
5. Watch the run (GitHub MCP `actions_list` → `list_workflow_runs` for `release.yml`). A full run takes about 4 minutes.
   On success the release shows at https://github.com/mstupp1/neon-overdrive/releases.
6. Add a row to the release log below in the same PR as any other change, or in a small PR of its own.

## When something goes wrong

- **A build failed:** the release is still a draft, so no player got it. Fix on `main`, then ship the next PATCH
  version. Delete the stale draft and tag on GitHub; don't re-push the same tag.
- **A bad version went out:** ship a fixed higher version. There is no rollback, because the updater only moves forward.
- **"existing release published more than 2 hours ago" in the log:** electron-builder won't upload into an old
  published release. Use a new version.
- **Save format changes** reach desktop players automatically on update, so keep `src/core/storage.js` migrations
  working (AGENTS.md). A broken migration on desktop can't be fixed by reloading the page.

## Testing the app locally

```sh
cd desktop && npm install
npm start                                  # dev: runs the repo's current files (NEON_WINDOWED=1 for a window)
npx electron-builder --linux dir           # packaged build in desktop/dist/linux-unpacked/
```
In a headless container, drive the packaged binary with Playwright's `_electron.launch({ executablePath, args:
['--no-sandbox'] })` under `xvfb-run -a`, with `NEON_NO_UPDATE=1` so it skips the updater.

## Release log

Newest first. One line per published version.

| Version | Date | Highlights |
|---|---|---|
| _none yet_ | | First tag will be `v0.1.0`. |
