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

  // CRUD for tarifario table
  getAllTarifario: () => ipcRenderer.invoke('tarifario:getAll'),
  getTarifarioById: (id) => ipcRenderer.invoke('tarifario:getById', id),
  createTarifario: (data) => ipcRenderer.invoke('tarifario:create', data),
  updateTarifario: (id, data) => ipcRenderer.invoke('tarifario:update', id, data),
  removeTarifario: (id) => ipcRenderer.invoke('tarifario:remove', id),

  // CRUD for departamento table
  getAllDepartamento: () => ipcRenderer.invoke('departamento:getAll'),
  getDepartamentoById: (id) => ipcRenderer.invoke('departamento:getById', id),
  createDepartamento: (data) => ipcRenderer.invoke('departamento:create', data),
  updateDepartamento: (id, data) => ipcRenderer.invoke('departamento:update', id, data),
  removeDepartamento: (id) => ipcRenderer.invoke('departamento:remove', id),

  // CRUD for carrera table
  getAllCarrera: () => ipcRenderer.invoke('carrera:getAll'),
  getCarreraById: (id) => ipcRenderer.invoke('carrera:getById', id),
  createCarrera: (data) => ipcRenderer.invoke('carrera:create', data),
  updateCarrera: (id, data) => ipcRenderer.invoke('carrera:update', id, data),
  removeCarrera: (id) => ipcRenderer.invoke('carrera:remove', id),

  // External API endpoints
  obtenerIDPersona: (carnet) => ipcRenderer.invoke('api:obtenerIDPersona', carnet),
  obtenerKardexEstudiante: (id_estudiante) => ipcRenderer.invoke('api:obtenerKardexEstudiante', id_estudiante),
  obtenerPagosRealizados: (id_estudiante) => ipcRenderer.invoke('api:obtenerPagosRealizados', id_estudiante),
  obtenerDetalleFactura: (numero_maestro, id_regional, orden) => ipcRenderer.invoke('api:obtenerDetalleFactura', numero_maestro, id_regional, orden),
  obtenerNombreCompleto: (id_estudiante) => ipcRenderer.invoke('api:obtenerNombreCompleto', id_estudiante),
  obtenerPersonasPorCarnet: (carnet) => ipcRenderer.invoke('api:obtenerPersonasPorCarnet', carnet),
});
