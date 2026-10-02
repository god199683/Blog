const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  getAutoLaunch: () => ipcRenderer.invoke("desktop:auto-launch:get"),
  setAutoLaunch: (enabled) => ipcRenderer.invoke("desktop:auto-launch:set", Boolean(enabled)),
});
