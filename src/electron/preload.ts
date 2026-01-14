import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // KB management
    getKbPath: () => ipcRenderer.invoke('getKbPath'),
    getFolders: () => ipcRenderer.invoke('getFolders'),
    getContent: (filePath: string) => ipcRenderer.invoke('getContent', filePath),
    buildGraph: (options: any) => ipcRenderer.invoke('buildGraph', options),
    
    // Language management  
    getUserLanguage: () => ipcRenderer.invoke('getUserLanguage'),
    setUserLanguage: (lang: string) => ipcRenderer.invoke('setUserLanguage', lang),
    
    // Event listeners
    onKbPathChanged: (callback: () => void) => {
        ipcRenderer.on('kb-path-changed', callback);
    },
    
    on: (channel: string, func: (...args: any[]) => void) => {
        const validChannels = ['build-log', 'build-complete', 'kb-path-changed']; // Whitelist channels
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});
