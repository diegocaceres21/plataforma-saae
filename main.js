// Example: require your HTTP client for external API requests
const axios = require('axios');
// IPC handler for external API requests
ipcMain.handle('academico:fetchExternal', async (event, endpoint, params) => {
  // Replace with your actual API logic
  // Example: return await axios.get(endpoint, { params });
  return { endpoint, params, result: 'Demo API response' };
});
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const registerRoutes = require('./electron-backend/routes');
// Example: require your database library here (e.g., sqlite3, pg, etc.)
// const sqlite3 = require('sqlite3').verbose();
// let db = new sqlite3.Database('path_to_db.sqlite');
const path = require('path');

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