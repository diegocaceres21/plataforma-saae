
require('dotenv').config();

const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
let autoUpdater;
try {
  // Lazy require so development without dependency still works until build
  ({ autoUpdater } = require('electron-updater'));
} catch (e) {
  console.warn('[AutoUpdate] electron-updater not available in dev environment');
}
const registerRoutes = require('./electron-backend/routes');
const externalApi = require('./electron-backend/externalApi');
const { setExternalTokens } = require('./electron-backend/tokenStore');
const path = require('path');
// Example: require your HTTP client for external API requests
//const axios = require('axios');

// IPC handler for printing
ipcMain.handle('print:document', async (event, htmlContent) => {
  console.log('[Electron] Received print request.');
  let printWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Start hidden
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    // Load the HTML content into the hidden window
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    console.log('[Electron] Print content loaded.');

    // Wait for the content to be fully rendered
    await new Promise(resolve => printWindow.webContents.once('did-finish-load', resolve));
    console.log('[Electron] Web contents finished loading.');

    // Show the window but don't focus it, then print
    printWindow.showInactive();
    console.log('[Electron] Print window shown inactively.');

    const printSuccessful = await printWindow.webContents.print({
      silent: false,
      printBackground: true,
    });

    console.log(`[Electron] Print dialog closed. Success: ${printSuccessful}`);
    return { success: printSuccessful };

  } catch (error) {
    console.error(`[Electron] Error during printing: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) {
      console.log('[Electron] Destroying print window.');
      printWindow.destroy();
    }
  }
});
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

// IPC handler for obtenerPersonasPorCarnet
ipcMain.handle('api:obtenerPersonasPorCarnet', async (event, carnet) => {
  try {
    return await externalApi.personas.obtenerPersonasPorCarnet(carnet);
  } catch (error) {
    throw error;
  }
});

// IPC handler for logInSiaan (external auth)
ipcMain.handle('api:logInSiaan', async (event, credentials) => {
  try {
    return await externalApi.auth.logInSiaan(credentials);
  } catch (error) {
    return { error: error.message };
  }
});

// IPC handler to set external tokens (from renderer after login SIAAN)
ipcMain.handle('api:setExternalTokens', async (event, data) => {
  try {
    setExternalTokens(data || {});
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
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
    // Production: Angular outputs to dist/plataforma-saae/browser
    const indexPath = path.join(__dirname, 'dist', 'plataforma-saae', 'browser', 'index.html');
    console.log('[Electron] Loading production file:', indexPath);
    win.loadFile(indexPath);
    win.webContents.on('did-fail-load', () => {
      console.warn('[Electron] Failed to load index.html first attempt, retrying');
      win.loadFile(indexPath);
    });
  }
  return win;
}


// Example IPC handler for database/API integration
ipcMain.handle('academico:getStudent', async (event, studentId) => {
  // Replace with your database/API logic
  // Example: return await db.get('SELECT * FROM students WHERE id = ?', [studentId]);
  return { id: studentId, name: 'Demo Student' };
});

// --- Auto Update Integration ---
function setupAutoUpdater(win) {
  if (!app.isPackaged || !autoUpdater) {
    return;
  }

  autoUpdater.autoDownload = true; // Manual trigger to control UX

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdate] Error:', error == null ? 'unknown' : (error.stack || error).toString());
    win.webContents.send('update:error', { message: error.message || String(error) });
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdate] Checking for update...');
    win.webContents.send('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdate] Update available', info.version);
    win.webContents.send('update:available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdate] No update available');
    win.webContents.send('update:not-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('update:download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdate] Update downloaded, prompting for restart');
    win.webContents.send('update:downloaded', info);
    // Optionally auto install after short delay:
    // setTimeout(()=> autoUpdater.quitAndInstall(), 3000);
  });

  // Trigger initial check (non-blocking)
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates();
    } catch(err) {
      console.warn('[AutoUpdate] Initial check failed:', err.message);
    }
  }, 3000);
}

// IPC for manual update control from renderer (optional UI integration)
ipcMain.handle('update:check', async () => {
  if (!autoUpdater || !app.isPackaged) return { skipped: true };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { result };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('update:download', async () => {
  if (!autoUpdater || !app.isPackaged) return { skipped: true };
  try {
    await autoUpdater.downloadUpdate();
    return { started: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('update:install', async () => {
  if (!autoUpdater || !app.isPackaged) return { skipped: true };
  try {
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { quitting: true };
  } catch (err) {
    return { error: err.message };
  }
});

app.whenReady().then(() => {
  registerRoutes(ipcMain);
  const win = createWindow();
  setupAutoUpdater(win);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});