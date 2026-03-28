const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');
const { loadOrCreateIdentity } = require('./crypto/identity');
const { setupIpcHandlers } = require('./ipc/handlers');
const { initStores } = require('./storage/store');
const { ConnectionManager } = require('./network/connection-manager');
const { PwaServer } = require('./network/pwa-server');

let mainWindow = null;
let identity = null;
let connectionManager = null;
let pwaServer = null;

// Force dark mode
nativeTheme.themeSource = 'dark';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#00FF41',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    frame: true,
  });

  // Graceful show after content loads
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Start networking after window is ready
    startNetworking();
  });

  // Load from Vite dev server or built files
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    // Open DevTools in dev mode
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startNetworking() {
  if (!connectionManager && mainWindow) {
    connectionManager = new ConnectionManager(identity, mainWindow);
    try {
      await connectionManager.start();
      console.log('[Main] 🌐 Network services operational');
    } catch (err) {
      console.error('[Main] ⚠️ Network startup error:', err.message);
    }
  }

  // Start PWA server for mobile devices
  if (!pwaServer) {
    pwaServer = new PwaServer();
    try {
      const addresses = await pwaServer.start();
      console.log('[Main] 📱 Mobile PWA ready — open on Android:');
      addresses.forEach(addr => console.log(`  → http://${addr}:3849`));
    } catch (err) {
      console.error('[Main] ⚠️ PWA server error:', err.message);
    }
  }
}

app.whenReady().then(() => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║         ⚡ G H O S T W I R E ⚡       ║');
  console.log('  ║   Communication beyond the grid      ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');

  // Initialize storage
  initStores();

  // Load or create device identity
  identity = loadOrCreateIdentity();
  console.log(`[Main] Device fingerprint: ${identity.fingerprint}`);

  // Set up IPC handlers (pass getter for connectionManager since it starts later)
  setupIpcHandlers(identity, () => connectionManager);

  // Create the window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (connectionManager) {
    connectionManager.stop();
  }
  if (pwaServer) {
    pwaServer.stop();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
