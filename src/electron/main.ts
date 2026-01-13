import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import * as path from 'path';
import * as http from 'http';
import { startServer } from '../server';

let mainWindow: BrowserWindow | null = null;
let serverInstance: http.Server | null = null;
let currentPort = 3000;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = async () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Security: Keep true isolation
      contextIsolation: true,
      // preload: path.join(__dirname, 'preload.js'), // Add if needed later
    },
    backgroundColor: '#1a1a1a', 
    show: false // Don't show until loaded
  });

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
                 const newPath = result.filePaths[0];
                 await restartServer(newPath);
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
                    await shell.openExternal('https://github.com/Jacobinwwey/NoteConnection');
                }
            }
        ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load the index.html from the local server
  const startUrl = `http://localhost:${currentPort}`;
  
  mainWindow.loadURL(startUrl).catch(e => {
      console.error('Failed to load URL:', e);
      // Retry or show error
  });

  mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const restartServer = async (targetPath: string) => {
    if (serverInstance) {
        console.log('Stopping current server...');
        serverInstance.close();
        serverInstance = null;
    }
    
    console.log(`Starting server for path: ${targetPath}`);
    // You might want to find a free port dynamically here if 3000 is taken,
    // but for now we stick to one.
    
    serverInstance = await startServer({ port: currentPort, targetPath });
    
    // Reload window
    if (mainWindow) {
        mainWindow.loadURL(`http://localhost:${currentPort}`);
    }
};

app.whenReady().then(async () => {
    // Start default server (empty targetPath -> uses default logic handled in server.ts, probably process.cwd() or embedded)
    // For standalone, maybe we prompt? Or default to an internal "Data" folder?
    // Let's start with no specific target, relying on server default (which creates/uses 'Knowledge_Base' in CWD).
    // In Electron compiled app, CWD might be the executable dir.
    
    // Better: pass a user-data path?
    // For first iteration: Let it use default.
    
    serverInstance = await startServer({ port: currentPort });
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

app.on('will-quit', () => {
    if (serverInstance) {
        serverInstance.close();
    }
});
