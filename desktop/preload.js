// The only bridge between the game page and the desktop shell. The web build checks `window.desktop` to show
// desktop-only controls (Quit, native fullscreen, update toast); in a browser it is simply undefined.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.invoke('desktop:info'),
  quit: () => ipcRenderer.send('desktop:quit'),
  toggleFullscreen: () => ipcRenderer.send('desktop:toggle-fullscreen'),
  restartToUpdate: () => ipcRenderer.send('desktop:restart'),
  onUpdateReady: (cb) => ipcRenderer.on('desktop:update-ready', (_e, version) => cb(version)),
});
