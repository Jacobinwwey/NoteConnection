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

// Save knowledge base path and language
function saveKbPath(kbPath: string, language?: string): void {
    try {
        // Load existing config to preserve language if not updating
        let existingConfig: any = {};
        if (fs.existsSync(configPath)) {
            existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        const config = {
            knowledgeBasePath: kbPath,
            userLanguage: language !== undefined ? language : existingConfig.userLanguage
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        log(`Saved KB path to config: ${kbPath}`);
    } catch (e) {
        log(`Failed to save KB config: ${e}`);
    }
}

// Save user language preference
function saveLanguage(language: string): void {
    try {
        let config: any = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        config.userLanguage = language;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        log( `Saved user language: ${language}`);
    } catch (e) {
        log(`Failed to save language: ${e}`);
    }
}

// Load user language preference
function loadLanguage(): string | null {
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return config.userLanguage || null;
        }
    } catch (e) {
        log(`Failed to load language: ${e}`);
    }
    return null;
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

// Menu Localization
const menuTranslations: { [key: string]: any } = {
    'en': {
        'file': 'File',
        'changeKB': 'Change Knowledge Base...',
        'resetKB': 'Reset to Default Location',
        'quit': 'Quit',
        'edit': 'Edit',
        'view': 'View',
        'window': 'Window',
        'help': 'Help',
        'documentation': 'Documentation',
        'about': 'About'
    },
    'zh': {
        'file': '文件',
        'changeKB': '更改知识库...',
        'resetKB': '重置为默认位置',
        'quit': '退出',
        'edit': '编辑',
        'view': '视图',
        'window': '窗口',
        'help': '帮助',
        'documentation': '文档',
        'about': '关于'
    }
};

// Update menu with current KB path and Language
function updateMenu(language: string = 'en') {
  const t = menuTranslations[language] || menuTranslations['en'];
  
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: t['file'],
      submenu: [
        {
          label: t['changeKB'],
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
             const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory', 'createDirectory'],
                title: t['changeKB'],
                defaultPath: currentKbRoot,
                buttonLabel: 'Select'
             });
             if (!result.canceled && result.filePaths.length > 0) {
                 currentKbRoot = result.filePaths[0];
                 saveKbPath(currentKbRoot);
                 log(`Changed Knowledge Base to: ${currentKbRoot}`);
                 
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
          label: t['resetKB'],
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
        { role: 'quit', label: t['quit'] }
      ]
    },
    { role: 'editMenu', label: t['edit'] },
    { role: 'viewMenu', label: t['view'] },
    { role: 'windowMenu', label: t['window'] },
    {
        role: 'help',
        label: t['help'],
        submenu: [
            {
                label: t['documentation'],
                click: async () => {
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
                label: t['about'],
                click: async () => {
                    dialog.showMessageBox(mainWindow!, {
                        type: 'info',
                        title: 'About NoteConnection',
                        message: 'NoteConnection v1.0.1',
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

    // Setup Menu with current KB path and Language
  const lang = loadLanguage() || 'en';
  updateMenu(lang);

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
    
    // Suppress security warnings in dev mode (unsafe-eval is required for GPU.js)
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    
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
        // Determine correct target path based on user selection
        // options.target comes from frontend (folder name or 'ALL_FOLDERS')
        let targetToBuild = currentKbRoot;
        
        if (options.target && options.target !== 'ALL_FOLDERS') {
            targetToBuild = path.join(currentKbRoot, options.target);
        }

        // Merge with current KB root context
        const buildOpts = { 
            ...options, 
            targetPath: targetToBuild,
            // Override projectRoot to ensure backend resolves relative paths correctly if needed
            // But NoteConnection uses targetPath as absolute if provided.
            onLog: (msg: string) => {
                event.sender.send('build-log', msg);
            }
        };
        return await NoteController.triggerBuild(buildOpts);
    });

    // Language management IPC handlers
    ipcMain.handle('getUserLanguage', async () => {
        return loadLanguage();
    });

    ipcMain.handle('setUserLanguage', async (event, language: string) => {
        saveLanguage(language);
        updateMenu(language); // Immediately update menu
        log(`Menu language updated to: ${language}`);
        return language;
    });

    // Caching Handlers
    ipcMain.handle('checkCache', async (event, target) => {
        if (!target || target === 'ALL_FOLDERS') return null;
        try {
            const targetName = target.replace(/[^a-z0-9_\-]/gi, '_');
            const frontendDir = path.join(__dirname, '../frontend');
            const cachePath = path.join(frontendDir, `data_${targetName}.js`);
            
            if (fs.existsSync(cachePath)) {
                const stats = fs.statSync(cachePath);
                return {
                    date: stats.mtime.toLocaleString(),
                    size: stats.size
                };
            }
        } catch (e) {
            log(`CheckCache error: ${e}`);
        }
        return null;
    });

    ipcMain.handle('restoreCache', async (event, target) => {
        if (!target) return false;
        try {
            const targetName = target.replace(/[^a-z0-9_\-]/gi, '_');
            const frontendDir = path.join(__dirname, '../frontend');
            
            const cacheJs = path.join(frontendDir, `data_${targetName}.js`);
            const targetJs = path.join(frontendDir, 'data.js');
            
            const cacheJson = path.join(frontendDir, `graph_data_${targetName}.json`);
            const targetJson = path.join(frontendDir, 'graph_data.json');
            
            if (fs.existsSync(cacheJs)) {
                fs.copyFileSync(cacheJs, targetJs);
                // Also copy JSON if it exists
                if (fs.existsSync(cacheJson)) {
                    fs.copyFileSync(cacheJson, targetJson);
                }
                log(`Restored cache for ${target} -> data.js`);
                return true;
            }
        } catch (e) {
            log(`Error restoring cache: ${e}`);
        }
        return false;
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
