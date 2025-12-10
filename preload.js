const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API de impresión
  print: (htmlContent) => ipcRenderer.invoke('print:document', htmlContent),
});

// Updater API (diagnóstico y control manual desde UI)
contextBridge.exposeInMainWorld('updater', {
  check: () => ipcRenderer.invoke('update:check'),
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  on: (channel, cb) => ipcRenderer.on(channel, (_, data) => cb?.(data)),
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb),
});

contextBridge.exposeInMainWorld('academicoAPI', {
  getStudent: (studentId) => ipcRenderer.invoke('academico:getStudent', studentId),
  fetchExternal: (endpoint, params) => ipcRenderer.invoke('academico:fetchExternal', endpoint, params),

  // CRUD for gestion table
  createGestion: (data) => ipcRenderer.invoke('gestion:create', data),
  getAllGestion: () => ipcRenderer.invoke('gestion:getAll'),
  getAllVisibleGestion: () => ipcRenderer.invoke('gestion:getAllVisible'),
  getSemesterGestion: () => ipcRenderer.invoke('gestion:getSemester'),
  getIdGestiones: () => ipcRenderer.invoke('gestion:getIdGestiones'),
  updateGestion: (id, data) => ipcRenderer.invoke('gestion:update', id, data),

  // CRUD for apoyo_familiar table
  getAllApoyoFamiliar: () => ipcRenderer.invoke('apoyo_familiar:getAll'),
  getApoyoFamiliarById: (id) => ipcRenderer.invoke('apoyo_familiar:getById', id),
  createApoyoFamiliar: (data) => ipcRenderer.invoke('apoyo_familiar:create', data),
  updateApoyoFamiliar: (id, data) => ipcRenderer.invoke('apoyo_familiar:update', id, data),
  removeApoyoFamiliar: (id) => ipcRenderer.invoke('apoyo_familiar:remove', id),

  // CRUD for tarifario table
  getAllTarifario: () => ipcRenderer.invoke('tarifario:getAll'),
  getAllVisibleTarifario: () => ipcRenderer.invoke('tarifario:getAllVisible'),
  getTarifarioById: (id) => ipcRenderer.invoke('tarifario:getById', id),
  createTarifario: (data) => ipcRenderer.invoke('tarifario:create', data),
  updateTarifario: (id, data) => ipcRenderer.invoke('tarifario:update', id, data),
  removeTarifario: (id) => ipcRenderer.invoke('tarifario:remove', id),

  //CRUD for beneficio table
  getAllBeneficio: () => ipcRenderer.invoke('beneficio:getAll'),
  getBeneficioById: (id) => ipcRenderer.invoke('beneficio:getById', id),
  createBeneficio: (data) => ipcRenderer.invoke('beneficio:create', data),
  updateBeneficio: (id, data) => ipcRenderer.invoke('beneficio:update', id, data),
  removeBeneficio: (id) => ipcRenderer.invoke('beneficio:remove', id),

  // CRUD for departamento table
  getAllDepartamento: () => ipcRenderer.invoke('departamento:getAll'),
  getDepartamentoById: (id) => ipcRenderer.invoke('departamento:getById', id),
  createDepartamento: (data) => ipcRenderer.invoke('departamento:create', data),
  updateDepartamento: (id, data) => ipcRenderer.invoke('departamento:update', id, data),
  removeDepartamento: (id) => ipcRenderer.invoke('departamento:remove', id),

  // CRUD for carrera table
  getAllCarrera: () => ipcRenderer.invoke('carrera:getAll'),
  getAllVisibleCarrera: () => ipcRenderer.invoke('carrera:getAllVisible'),
  getCarreraById: (id) => ipcRenderer.invoke('carrera:getById', id),
  createCarrera: (data) => ipcRenderer.invoke('carrera:create', data),
  updateCarrera: (id, data) => ipcRenderer.invoke('carrera:update', id, data),
  removeCarrera: (id) => ipcRenderer.invoke('carrera:remove', id),

  // CRUD for solicitud table
  getAllSolicitud: () => ipcRenderer.invoke('solicitud:getAll'),
  getAllVisibleSolicitud: () => ipcRenderer.invoke('solicitud:getAllVisible'),
  getSolicitudById: (id) => ipcRenderer.invoke('solicitud:getById', id),
  createSolicitud: (data) => ipcRenderer.invoke('solicitud:create', data),
  updateSolicitud: (id, data) => ipcRenderer.invoke('solicitud:update', id, data),
  removeSolicitud: (id) => ipcRenderer.invoke('solicitud:remove', id),

  // CRUD for registro_estudiante table
  getAllRegistroEstudianteActivos: () => ipcRenderer.invoke('registro_estudiante:getAllActivos'),
  getAllVisibleRegistroEstudiante: () => ipcRenderer.invoke('registro_estudiante:getAllVisible'),
  getRegistroEstudianteById: (id) => ipcRenderer.invoke('registro_estudiante:getById', id),
  getRegistroEstudiantesBySolicitud: (id_solicitud) => ipcRenderer.invoke('registro_estudiante:getBySolicitud', id_solicitud),
  getRegistroEstudiantesBySolicitudInactivos: (id_solicitud) => ipcRenderer.invoke('registro_estudiante:getBySolicitudInactivos', id_solicitud),
  getRegistroEstudiantesByApoyoFamiliar: () => ipcRenderer.invoke('registro_estudiante:getByApoyoFamiliar'),
  getRegistroEstudiantesByApoyoFamiliarInactivos: () => ipcRenderer.invoke('registro_estudiante:getByApoyoFamiliarInactivos'),
  checkExistingBenefit: (ci_estudiante, id_gestion) => ipcRenderer.invoke('registro_estudiante:checkExistingBenefit', ci_estudiante, id_gestion),
  checkExistingBenefitsBatch: (carnets, id_gestion) => ipcRenderer.invoke('registro_estudiante:checkExistingBenefitsBatch', carnets, id_gestion),
  createRegistroEstudiante: (data) => ipcRenderer.invoke('registro_estudiante:create', data),
  updateRegistroEstudiante: (id, data) => ipcRenderer.invoke('registro_estudiante:update', id, data),
  updateRegistroEstudianteBulk: (ids, data) => ipcRenderer.invoke('registro_estudiante:updateBulk', ids, data),
  removeRegistroEstudiante: (id) => ipcRenderer.invoke('registro_estudiante:remove', id),
  createMultipleRegistroEstudiante: (dataArray) => ipcRenderer.invoke('registro_estudiante:createMultiple', dataArray),
  createMultipleWithTransaction: (dataArray) => ipcRenderer.invoke('registro_estudiante:createMultipleWithTransaction', dataArray),
  getEstudiantesConInactivos: (filters) => ipcRenderer.invoke('registro_estudiante:getEstudiantesConInactivos', filters),

  // External API endpoints
  obtenerIDPersona: (carnet) => ipcRenderer.invoke('api:obtenerIDPersona', carnet),
  obtenerKardexEstudiante: (id_estudiante) => ipcRenderer.invoke('api:obtenerKardexEstudiante', id_estudiante),
  obtenerPagosRealizados: (id_estudiante, tamanoDePagina) => ipcRenderer.invoke('api:obtenerPagosRealizados', id_estudiante, tamanoDePagina),
  obtenerDetalleFactura: (numero_maestro, id_regional, orden, soloCabecera) => ipcRenderer.invoke('api:obtenerDetalleFactura', numero_maestro, id_regional, orden, soloCabecera),
  obtenerNombreCompleto: (id_estudiante) => ipcRenderer.invoke('api:obtenerNombreCompleto', id_estudiante),
  obtenerCarrera: (id_estudiante) => ipcRenderer.invoke('api:obtenerCarrera', id_estudiante),
  obtenerPersonasPorCarnet: (carnet) => ipcRenderer.invoke('api:obtenerPersonasPorCarnet', carnet),
  logInSiaan: (credentials) => ipcRenderer.invoke('api:logInSiaan', credentials),
  setExternalTokens: (data) => ipcRenderer.invoke('api:setExternalTokens', data),
  obtenerTiposDepartamento: (periodo) => ipcRenderer.invoke('api:obtenerTiposDepartamento', periodo),
  obtenerDepartamentos: (idTipo, periodo) => ipcRenderer.invoke('api:obtenerDepartamentos', idTipo, periodo),
  obtenerOfertaAcademica: (idCarrera, periodo) => ipcRenderer.invoke('api:obtenerOfertaAcademica', idCarrera, periodo),
  obtenerAsignaturas: () => ipcRenderer.invoke('api:obtenerAsignaturas'),
  // Reportes
  getReporteBeneficiosByGestion: (id_gestion) => ipcRenderer.invoke('reporte:getBeneficiosByGestion', id_gestion),
  getEvolucionBeneficios: () => ipcRenderer.invoke('reporte:getEvolucionBeneficios'),
});

// Auth API
contextBridge.exposeInMainWorld('authAPI', {
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  verify: (token) => ipcRenderer.invoke('auth:verify', token),
  register: (data) => ipcRenderer.invoke('auth:register', data),
});

// Expose User Management API
contextBridge.exposeInMainWorld('userAPI', {
  getAllUsers: () => ipcRenderer.invoke('user:getAll'),
  getUserById: (id) => ipcRenderer.invoke('user:getById', id),
  createUser: (data) => ipcRenderer.invoke('user:create', data),
  updateUser: (id, data) => ipcRenderer.invoke('user:update', id, data),
  changePassword: (id, newPassword) => ipcRenderer.invoke('user:changePassword', id, newPassword),
  deleteUser: (id) => ipcRenderer.invoke('user:delete', id),
});
