const controllers = require('./controllers');
const models = require('./models');

function registerRoutes(ipcMain) {
  Object.keys(models).forEach(model => {
    const table = models[model].table;
    ipcMain.handle(`${table}:getAll`, async () => await controllers.getAll(table));
    ipcMain.handle(`${table}:getById`, async (event, id) => await controllers.getById(table, id));
    ipcMain.handle(`${table}:create`, async (event, data) => await controllers.create(table, data));
    ipcMain.handle(`${table}:update`, async (event, id, data) => await controllers.update(table, id, data));
    ipcMain.handle(`${table}:remove`, async (event, id) => await controllers.remove(table, id));
  });

  // Special routes for registro_estudiante
  ipcMain.handle('registro_estudiante:createMultiple', async (event, dataArray) => {
    return await controllers.createMultiple('registro_estudiante', dataArray);
  });
  
  ipcMain.handle('registro_estudiante:getBySolicitud', async (event, id_solicitud) => {
    return await controllers.getBySolicitud(id_solicitud);
  });
}

module.exports = registerRoutes;
