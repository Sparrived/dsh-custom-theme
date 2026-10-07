const { contextBridge, ipcRenderer } = require('electron')
if (process.isMainFrame && location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('trayPopup', {
    snapshot: () => ipcRenderer.invoke('dct-tray:popup:snapshot'),
    ready: () => ipcRenderer.invoke('dct-tray:popup:ready'),
    resize: (height) => ipcRenderer.invoke('dct-tray:popup:resize', height),
    run: (action) => ipcRenderer.invoke('dct-tray:popup:run', action),
    hide: () => ipcRenderer.send('dct-tray:popup:hide'),
    subscribe: (callback) => {
      const listener = (_event, snapshot) => callback(snapshot)
      ipcRenderer.on('dct-tray:popup:snapshot', listener)
      return () => ipcRenderer.removeListener('dct-tray:popup:snapshot', listener)
    },
  })
}
