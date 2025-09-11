const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('academicoAPI', {
  getStudent: (studentId) => ipcRenderer.invoke('academico:getStudent', studentId),
  // Add more database-related IPC calls here

  // Example: call external API via main process
  fetchExternal: (endpoint, params) => ipcRenderer.invoke('academico:fetchExternal', endpoint, params)
});
