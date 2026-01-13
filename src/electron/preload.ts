import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getFolders: () => ipcRenderer.invoke('getFolders'),
    getContent: (filePath: string) => ipcRenderer.invoke('getContent', filePath),
    buildGraph: (options: any) => ipcRenderer.invoke('buildGraph', options),
    on: (channel: string, func: (...args: any[]) => void) => {
        const validChannels = ['build-log', 'build-complete']; // Whitelist channels
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});
