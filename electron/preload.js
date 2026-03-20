const { contextBridge, ipcRenderer } = require('electron');

const backendUrl = process.env.PYYOMI_BACKEND_URL;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
if (backendUrl) {
  contextBridge.exposeInMainWorld('__BACKEND_URL__', backendUrl);
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.sendSync('get-app-path'),
  restartApp: () => ipcRenderer.send('restart-app'),
  selectDownloadPath: () => ipcRenderer.invoke('select-download-path'),
  backendUrl: backendUrl || null,

  // Platform info
  platform: process.platform,

  // Version info
  getVersion: () => ipcRenderer.sendSync('get-app-version')
});
