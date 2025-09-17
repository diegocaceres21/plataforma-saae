const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API de impresión
  print: (htmlContent) => ipcRenderer.invoke('print:document', htmlContent),
});

contextBridge.exposeInMainWorld('academicoAPI', {
  getStudent: (studentId) => ipcRenderer.invoke('academico:getStudent', studentId),
  fetchExternal: (endpoint, params) => ipcRenderer.invoke('academico:fetchExternal', endpoint, params),

  // CRUD for gestion table
  createGestion: (data) => ipcRenderer.invoke('gestion:create', data),
  getAllGestion: () => ipcRenderer.invoke('gestion:getAll'),

  // CRUD for apoyo_familiar table
  getAllApoyoFamiliar: () => ipcRenderer.invoke('apoyo_familiar:getAll'),
  getApoyoFamiliarById: (id) => ipcRenderer.invoke('apoyo_familiar:getById', id),
  createApoyoFamiliar: (data) => ipcRenderer.invoke('apoyo_familiar:create', data),
  updateApoyoFamiliar: (id, data) => ipcRenderer.invoke('apoyo_familiar:update', id, data),
  removeApoyoFamiliar: (id) => ipcRenderer.invoke('apoyo_familiar:remove', id),

  // External API endpoints
  obtenerIDPersona: (carnet) => ipcRenderer.invoke('api:obtenerIDPersona', carnet),
  obtenerKardexEstudiante: (id_estudiante) => ipcRenderer.invoke('api:obtenerKardexEstudiante', id_estudiante),
  obtenerPagosRealizados: (id_estudiante) => ipcRenderer.invoke('api:obtenerPagosRealizados', id_estudiante),
  obtenerDetalleFactura: (numero_maestro, id_regional, orden) => ipcRenderer.invoke('api:obtenerDetalleFactura', numero_maestro, id_regional, orden),
  obtenerNombreCompleto: (id_estudiante) => ipcRenderer.invoke('api:obtenerNombreCompleto', id_estudiante),
  obtenerPersonasPorCarnet: (carnet) => ipcRenderer.invoke('api:obtenerPersonasPorCarnet', carnet),
});
