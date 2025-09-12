
require('dotenv').config();

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const registerRoutes = require('./electron-backend/routes');
const externalApi = require('./electron-backend/externalApi');
const path = require('path');
// Example: require your HTTP client for external API requests
//const axios = require('axios');

// IPC handler for external API requests
ipcMain.handle('academico:fetchExternal', async (event, endpoint, params) => {
  return { endpoint, params, result: 'Demo API response' };
});

// IPC handler for obtenerIDPersona
ipcMain.handle('api:obtenerIDPersona', async (event, carnet) => {
  try {
    return await externalApi.personas.obtenerIDPersona(carnet);
  } catch (error) {
    throw error;
  }
});

// IPC handler for obtenerKardexEstudiante
ipcMain.handle('api:obtenerKardexEstudiante', async (event, id_estudiante) => {
  try {
    return await externalApi.personas.obtenerKardexEstudiante(id_estudiante);
  } catch (error) {
    throw error;
  }
});

// IPC handler for obtenerPagosRealizados
ipcMain.handle('api:obtenerPagosRealizados', async (event, id_estudiante) => {
  try {
    return await externalApi.personas.obtenerPagosRealizados(id_estudiante);
  } catch (error) {
    throw error;
  }
});

// IPC handler for obtenerDetalleFactura
ipcMain.handle('api:obtenerDetalleFactura', async (event, numero_maestro, id_regional, orden) => {
  try {
    return await externalApi.personas.obtenerDetalleFactura(numero_maestro, id_regional, orden);
  } catch (error) {
    throw error;
  }
});

// IPC handler for obtenerNombreCompleto
ipcMain.handle('api:obtenerNombreCompleto', async (event, id_estudiante) => {
  try {
    return await externalApi.personas.obtenerNombreCompleto(id_estudiante);
  } catch (error) {
    throw error;
  }
});

function createWindow() {
  const size = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();
  } else {
    // Prod build
    const indexPath = path.join(__dirname, 'dist', 'electron-app', 'browser', 'index.html');
    console.log('File loaded: ', indexPath);  // For debugging
    win.loadFile(indexPath);

    // If the download fails, try again or switch to a local file
    win.webContents.on('did-fail-load', () => {
      win.loadFile(indexPath);  // Try to load file again
    });
  }
}


// Example IPC handler for database/API integration
ipcMain.handle('academico:getStudent', async (event, studentId) => {
  // Replace with your database/API logic
  // Example: return await db.get('SELECT * FROM students WHERE id = ?', [studentId]);
  return { id: studentId, name: 'Demo Student' };
});

app.whenReady().then(() => {
  registerRoutes(ipcMain);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});