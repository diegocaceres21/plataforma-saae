const controllers = require('./controllers');
const models = require('./models');

function registerRoutes(ipcMain) {
  Object.keys(models).forEach(model => {
    const table = models[model].table;
    ipcMain.handle(`${table}:getAll`, async () => await controllers.getAll(table));
    ipcMain.handle(`${table}:getAllVisible`, async () => await controllers.getAllVisible(table));
    ipcMain.handle(`${table}:getById`, async (event, id) => await controllers.getById(table, id));
    ipcMain.handle(`${table}:create`, async (event, data) => await controllers.create(table, data));
    ipcMain.handle(`${table}:update`, async (event, id, data) => await controllers.update(table, id, data));
    ipcMain.handle(`${table}:remove`, async (event, id) => await controllers.remove(table, id));
  });

  // Special routes for registro_estudiante
  ipcMain.handle('registro_estudiante:createMultiple', async (event, dataArray) => {
    return await controllers.createMultiple('registro_estudiante', dataArray);
  });

  ipcMain.handle('registro_estudiante:getAllActivos', async () => {
    return await controllers.getAllActivos('registro_estudiante');
  });
  
  ipcMain.handle('registro_estudiante:getBySolicitud', async (event, id_solicitud) => {
    return await controllers.getBySolicitud(id_solicitud);
  });

  ipcMain.handle('registro_estudiante:getBySolicitudInactivos', async (event, id_solicitud) => {
    return await controllers.getBySolicitudInactivos(id_solicitud);
  });

  ipcMain.handle('registro_estudiante:getByApoyoFamiliar', async (event) => {
    return await controllers.getByApoyoFamiliar();
  });

  ipcMain.handle('registro_estudiante:getByApoyoFamiliarInactivos', async (event) => {
    return await controllers.getByApoyoFamiliarInactivos();
  });

  ipcMain.handle('registro_estudiante:checkExistingBenefit', async (event, ci_estudiante, id_gestion) => {
    return await controllers.checkExistingBenefit(ci_estudiante, id_gestion);
  });

  ipcMain.handle('registro_estudiante:checkExistingBenefitsBatch', async (event, carnets, id_gestion) => {
    return await controllers.checkExistingBenefitsBatch(carnets, id_gestion);
  });

  ipcMain.handle('registro_estudiante:createMultipleWithTransaction', async (event, dataArray) => {
    return await controllers.createMultipleWithTransaction('registro_estudiante', dataArray);
  });

  // Special route for gestion - get semester gestiones only
  ipcMain.handle('gestion:getSemester', async () => {
    return await controllers.getSemesterGestiones();
  });

  // Special route for reportes - get beneficios data by gestion
  ipcMain.handle('reporte:getBeneficiosByGestion', async (event, id_gestion) => {
    return await controllers.getReporteBeneficiosByGestion(id_gestion);
  });

  // Special route for reportes - get evolucion beneficios (all gestiones)
  ipcMain.handle('reporte:getEvolucionBeneficios', async () => {
    return await controllers.getEvolucionBeneficios();
  });

  // Autenticación
  ipcMain.handle('auth:login', async (event, username, password) => {
    try {
      return await controllers.authenticateUser(username, password);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('auth:verify', async (event, token) => {
    return await controllers.verifyToken(token);
  });

  ipcMain.handle('auth:register', async (event, data) => {
    try {
      return await controllers.registerUser(data);
    } catch (err) {
      return { error: err.message };
    }
  });

  // Gestión de usuarios
  ipcMain.handle('user:getAll', async () => {
    try {
      return await controllers.getAllUsers();
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('user:getById', async (event, id) => {
    try {
      return await controllers.getUserById(id);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('user:create', async (event, data) => {
    try {
      return await controllers.createUser(data);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('user:update', async (event, id, data) => {
    try {
      return await controllers.updateUser(id, data);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('user:changePassword', async (event, id, newPassword) => {
    try {
      return await controllers.changeUserPassword(id, newPassword);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('user:delete', async (event, id) => {
    try {
      return await controllers.deleteUser(id);
    } catch (err) {
      return { error: err.message };
    }
  });
}

module.exports = registerRoutes;
