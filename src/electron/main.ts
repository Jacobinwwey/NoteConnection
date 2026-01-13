import { app, BrowserWindow, Menu, dialog, shell, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { NoteController } from '../backend/controller';

let mainWindow: BrowserWindow | null = null;
let currentKbRoot = path.join(process.cwd(), 'Knowledge_Base'); // Default

import * as fs from 'fs';

const logPath = path.join(app.getPath('userData'), 'debug_log.txt');
const log = (msg: string) => {
    try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {
        // ignore
    }
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  log('Squirrel startup detected, quitting...');
  app.quit();
}

// Register Custom Protocol 'app://'
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

const createWindow = async () => {
  log('Creating Browser Window...');
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), 
    },
    backgroundColor: '#1a1a1a', 
    show: true // Force show to debug
  });

  mainWindow.webContents.openDevTools();

  // Native Menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Knowledge Base...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
             const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory'],
                title: 'Select Knowledge Base Folder'
             });
             if (!result.canceled && result.filePaths.length > 0) {
                 currentKbRoot = result.filePaths[0];
                 console.log(`Switched Knowledge Base to: ${currentKbRoot}`);
                 mainWindow?.reload();
             }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
        role: 'help',
        submenu: [
            {
                label: 'Documentation',
                click: async () => {
                    // Open offline documentation
                    const helpWindow = new BrowserWindow({
                        width: 1000,
                        height: 800,
                        title: 'NoteConnection Documentation',
                        webPreferences: {
                            nodeIntegration: false,
                            contextIsolation: true,
                        },
                        autoHideMenuBar: true
                    });
                    helpWindow.loadURL('app://./help.html');
                }
            }
        ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load via Custom Protocol
  const startUrl = 'app://./index.html';
  log(`Loading URL: ${startUrl}`);
  
  mainWindow.loadURL(startUrl)
      .then(() => log('URL loaded successfully'))
      .catch(e => log(`Failed to load app: ${e}`));

  mainWindow.once('ready-to-show', () => {
      log('Window ready to show');
      mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(async () => {
    log('App Ready');
    // Protocol Handler
    protocol.handle('app', (request) => {
        const reqUrl = request.url;
        log(`[Protocol] Request: ${reqUrl}`);
        const parsedUrl = url.parse(reqUrl);
        
        let normalizedPath = parsedUrl.pathname ? path.normalize(parsedUrl.pathname).replace(/^(\\|\/)/, '') : '';
        
        // Map to frontend directory
        // __dirname is 'dist/src/electron'
        const baseDir = path.join(__dirname, '../frontend');
        const filePath = path.join(baseDir, normalizedPath || 'index.html');
        console.log(`[Protocol] Serving: ${filePath}`);

        return net.fetch(url.pathToFileURL(filePath).toString());
    });

    // IPC Handlers
    ipcMain.handle('getFolders', async () => {
        return NoteController.getFolders(currentKbRoot);
    });

    ipcMain.handle('getContent', async (event, targetPath) => {
        return NoteController.getContent(targetPath, currentKbRoot);
    });

    ipcMain.handle('buildGraph', async (event, options) => {
        // Merge with current KB root
        const buildOpts = { ...options, targetPath: currentKbRoot };
        return await NoteController.triggerBuild(buildOpts);
    });

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
