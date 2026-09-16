const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waterBuddy', {
  // config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),

  // overlay / reminder actions
  onReminderShow: (cb) =>
    ipcRenderer.on('reminder:show', (_e, payload) => cb(payload)),
  drank: () => ipcRenderer.send('reminder:drank'),
  snooze: () => ipcRenderer.send('reminder:snooze'),
  dismiss: () => ipcRenderer.send('reminder:dismiss'),
  // Toggle whether the (otherwise click-through) overlay captures the mouse,
  // so only the buddy card is interactive and the rest of the screen isn't.
  setInteractive: (on) => ipcRenderer.send('overlay:interactive', !!on),
});
