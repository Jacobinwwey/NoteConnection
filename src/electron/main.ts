import { app, BrowserWindow, Menu, dialog, shell, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { NoteController } from '../backend/controller';

let mainWindow: BrowserWindow | null = null;

// Knowledge Base Path Management
const DEFAULT_KB_PATH = path.join(process.cwd(), 'Knowledge_Base');
let currentKbRoot = DEFAULT_KB_PATH;

// Persistent storage for user preferences
// Using a simple JSON file approach (can be upgraded to electron-store if needed)
import * as fs from 'fs';

const logPath = path.join(app.getPath('userData'), 'debug_log.txt');
const configPath = path.join(app.getPath('userData'), 'kb_config.json');

const log = (msg: string) => {
    try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {
        // ignore
    }
};

// Load saved knowledge base path
function loadKbPath(): string {
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.knowledgeBasePath && fs.existsSync(config.knowledgeBasePath)) {
                log(`Loaded KB path from config: ${config.knowledgeBasePath}`);
                return config.knowledgeBasePath;
            }
        }
    } catch (e) {
        log(`Failed to load KB config: ${e}`);
    }
    return DEFAULT_KB_PATH;
}

// Save knowledge base path
function saveKbPath(kbPath: string): void {
    try {
        const config = { knowledgeBasePath: kbPath };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        log(`Saved KB path to config: ${kbPath}`);
    } catch (e) {
        log(`Failed to save KB config: ${e}`);
    }
}

// Show first-run setup dialog if no configuration exists
async function showFirstRunSetup(): Promise<string | null> {
    const response = await dialog.showMessageBox({
        type: 'question',
        title: 'Welcome to NoteConnection',
        message: 'Knowledge Base Setup',
        detail: `Would you like to select your knowledge base folder?\n\nDefault: ${DEFAULT_KB_PATH}`,
        buttons: ['Select Folder', 'Use Default', 'Cancel'],
        defaultId: 0,
        cancelId: 2
    });

    if (response.response === 0) {
        // Select Folder
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select Knowledge Base Folder',
            defaultPath: DEFAULT_KB_PATH,
            buttonLabel: 'Select'
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
    } else if (response.response === 1) {
        // Use Default
        return DEFAULT_KB_PATH;
    }
    
    return null; // Cancelled
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  log('Squirrel startup detected, quitting...');
  app.quit();
}

// Force GPU Acceleration (CRITICAL for performance)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-gpu-vsync'); // Reduce input latency
app.commandLine.appendSwitch('use-angle', 'default'); // Use ANGLE for better WebGL
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas'); // Canvas 2D GPU acceleration
app.commandLine.appendSwitch('num-raster-threads', '4'); // Multi-threaded rasterization

// Register Custom Protocol 'app://'
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// Update menu with current KB path
function updateMenu() {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Change Knowledge Base...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
             const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory', 'createDirectory'],
                title: 'Select Knowledge Base Folder',
                defaultPath: currentKbRoot,
                buttonLabel: 'Select'
             });
             if (!result.canceled && result.filePaths.length > 0) {
                 currentKbRoot = result.filePaths[0];
                 saveKbPath(currentKbRoot);
                 log(`Changed Knowledge Base to: ${currentKbRoot}`);
                 
                 // Show confirmation and reload
                 dialog.showMessageBox(mainWindow!, {
                     type: 'info',
                     title: 'Knowledge Base Changed',
                     message: `Knowledge Base updated to:\n${currentKbRoot}`,
                     detail: 'The application will reload to apply changes.',
                     buttons: ['OK']
                 }).then(() => {
                     mainWindow?.reload();
                 });
             }
          }
        },
        {
          label: 'Reset to Default Location',
          click: async () => {
              const response = await dialog.showMessageBox(mainWindow!, {
                  type: 'question',
                  title: 'Reset Knowledge Base',
                  message: 'Reset to default knowledge base location?',
                  detail: `Default: ${DEFAULT_KB_PATH}`,
                  buttons: ['Reset', 'Cancel'],
                  defaultId: 0,
                  cancelId: 1
              });
              
              if (response.response === 0) {
                  currentKbRoot = DEFAULT_KB_PATH;
                  saveKbPath(currentKbRoot);
                  log(`Reset Knowledge Base to default: ${DEFAULT_KB_PATH}`);
                  mainWindow?.reload();
              }
          }
        },
        { type: 'separator' },
        {
          label: `Current: ${path.basename(currentKbRoot)}`,
          enabled: false,
          sublabel: currentKbRoot
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
                    helpWindow.loadURL('app://./manual.html');
                }
            },
            { type: 'separator' },
            {
                label: 'About',
                click: async () => {
                    dialog.showMessageBox(mainWindow!, {
                        type: 'info',
                        title: 'About NoteConnection',
                        message: 'NoteConnection v1.0.0',
                        detail: `Knowledge Base: ${currentKbRoot}\n\nDeveloped by Jacob\nGitHub: https://github.com/Jacobinwwey`,
                        buttons: ['OK']
                    });
                }
            }
        ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

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
      webgl: true, // Enable WebGL
    },
    backgroundColor: '#1a1a1a', 
    show: true // Force show to debug
  });

 mainWindow.webContents.openDevTools();

  // Setup Menu with current KB path
  updateMenu();

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
    
    // Load saved knowledge base path or show first-run setup
    currentKbRoot = loadKbPath();
    
    // Check if this is first run (no config exists)
    if (!fs.existsSync(configPath)) {
        log('First run detected - showing setup dialog');
        const selectedPath = await showFirstRunSetup();
        if (selectedPath) {
            currentKbRoot = selectedPath;
            saveKbPath(currentKbRoot);
            log(`First-run setup complete: ${currentKbRoot}`);
        } else {
            // User cancelled - use default
            log('User cancelled first-run setup, using default');
            saveKbPath(DEFAULT_KB_PATH);
        }
    }
    
    log(`Knowledge Base Root: ${currentKbRoot}`);
    
    // Protocol Handler
    protocol.handle('app', (request) => {
        const reqUrl = request.url;
        log(`[Protocol] Request: ${reqUrl}`);
        const parsedUrl = url.parse(reqUrl);
        
        let normalizedPath = parsedUrl.pathname ? path.normalize(parsedUrl.pathname).replace(/^(\\|\/)/,  '') : '';
        
        // Map to frontend directory
        // __dirname is 'dist/src/electron'
        const baseDir = path.join(__dirname, '../frontend');
        const filePath = path.join(baseDir, normalizedPath || 'index.html');
        console.log(`[Protocol] Serving: ${filePath}`);

        return net.fetch(url.pathToFileURL(filePath).toString());
    });

    // IPC Handlers
    ipcMain.handle('getKbPath', async () => {
        return currentKbRoot;
    });
    
    ipcMain.handle('getFolders', async () => {
        return NoteController.getFolders(currentKbRoot);
    });

    ipcMain.handle('getContent', async (event, targetPath) => {
        return NoteController.getContent(targetPath, currentKbRoot);
    });

    ipcMain.handle('buildGraph', async (event, options) => {
        // Merge with current KB root
        const buildOpts = { 
            ...options, 
            targetPath: currentKbRoot,
            onLog: (msg: string) => {
                event.sender.send('build-log', msg);
            }
        };
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
