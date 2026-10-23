// NEON OVERDRIVE desktop shell. The game itself is the unchanged web build (index.html + src/), served from a
// private app:// origin so ES modules and fetch() work and localStorage saves live under a stable origin.
const { app, BrowserWindow, protocol, net, ipcMain, Menu, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'neon-overdrive';
// Packaged: resources/game (extraResources). Dev (`npm start` in desktop/): the repo root.
const GAME_DIR = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// One copy at a time: a second launch focuses the running window instead.
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function serveGame() {
  protocol.handle(SCHEME, (req) => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(GAME_DIR, rel));
    if (!file.startsWith(GAME_DIR + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    fullscreen: !process.env.NEON_WINDOWED,
    backgroundColor: '#05010d',
    title: 'Neon Overdrive',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  // External links (if any) open in the system browser, never inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}/`)) e.preventDefault();
  });
  // F11 toggles fullscreen like a browser would (there is no menu bar to hold the shortcut).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  win.loadURL(`${SCHEME}://${HOST}/index.html`);
}

function startUpdater() {
  // Updates come from GitHub Releases (published by .github/workflows/release.yml). They download in the background
  // and install when the game quits; the game shows a toast when one is ready. Unsigned macOS builds can't
  // self-update, so any updater error is logged and ignored.
  if (!app.isPackaged || process.env.NEON_NO_UPDATE) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', (info) => win?.webContents.send('desktop:update-ready', info.version));
  autoUpdater.on('error', (err) => console.warn('[updater]', err?.message || err));
  autoUpdater.checkForUpdates().catch((err) => console.warn('[updater]', err?.message || err));
}

ipcMain.handle('desktop:info', () => ({ version: app.getVersion(), platform: process.platform }));
ipcMain.on('desktop:quit', () => app.quit());
ipcMain.on('desktop:toggle-fullscreen', () => win?.setFullScreen(!win.isFullScreen()));
ipcMain.on('desktop:restart', () => {
  if (!app.isPackaged) return;
  require('electron-updater').autoUpdater.quitAndInstall();
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serveGame();
  createWindow();
  startUpdater();
});

app.on('window-all-closed', () => app.quit());
