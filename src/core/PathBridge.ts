import { WebSocketServer, WebSocket } from 'ws';
import { BrowserWindow } from 'electron';

export class PathBridge {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private port: number;
    private currentPath: any = null;
    private mainWindow: BrowserWindow | null = null;

    constructor(port: number = 9876) {
        this.port = port;
        this.wss = new WebSocketServer({ port });
        
        console.log(`[PathBridge] WebSocket Server started on port ${port}`);

        this.wss.on('connection', (ws) => {
            console.log('[PathBridge] Client connected');
            this.clients.add(ws);

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(data, ws);
                } catch (e) {
                    console.error('[PathBridge] Message error:', e);
                }
            });

            ws.on('close', () => {
                console.log('[PathBridge] Client disconnected');
                this.clients.delete(ws);
            });
        });
    }

    /**
     * Set the main BrowserWindow for IPC communication
     */
    public setMainWindow(win: BrowserWindow | null) {
        this.mainWindow = win;
    }

    private handleMessage(data: any, sender: WebSocket) {
        console.log(`[PathBridge] Received: ${data.type}`);
        
        switch (data.type) {
            case 'nodeClick':
                console.log(`[PathBridge] Godot clicked node: ${data.payload?.nodeId}`);
                this.broadcast('nodeClick', data.payload);
                break;

            case 'requestPath':
                console.log('[PathBridge] Godot requested path data');
                // Broadcast request to Frontend so it can respond with real data
                this.broadcast('requestPath', {});
                break;

            case 'pathResult':
                // Received from Frontend (or elsewhere), broadcast to Godot
                console.log('[PathBridge] Relaying pathResult');
                this.broadcast('pathResult', data.payload);
                break;

            case 'markComplete':
                console.log(`[PathBridge] Node marked complete: ${data.payload?.nodeId}`);
                this.broadcast('markComplete', data.payload);
                break;

            case 'switchCenter':
                console.log(`[PathBridge] Switch center to: ${data.payload?.newCenterId}`);
                // Broadcast to Frontend to trigger path recalculation
                this.broadcast('switchCenter', data.payload);
                break;

            case 'openReader':
                const nodeId = data.payload?.nodeId || data.payload;
                console.log(`[PathBridge] Open reader for: ${nodeId}`);
                this.broadcast('openReader', data.payload);
                // Send IPC to Electron renderer to open content panel
                this.triggerOpenReader(nodeId);
                break;

            case 'unmarkComplete':
                console.log(`[PathBridge] Node unmarked: ${data.payload?.nodeId}`);
                this.broadcast('unmarkComplete', data.payload);
                break;

            case 'completionSync':
                console.log(`[PathBridge] Completion sync, ${data.payload?.completedIds?.length || 0} nodes`);
                this.broadcast('completionSync', data.payload);
                break;

            case 'toggleCollapse':
                console.log(`[PathBridge] Toggle collapse: ${data.payload?.nodeId}`);
                this.broadcast('toggleCollapse', data.payload);
                break;

            case 'expandPrereqs':
                console.log(`[PathBridge] Expand prereqs: ${data.payload?.nodeId}`);
                this.broadcast('expandPrereqs', data.payload);
                break;

            default:
                console.log(`[PathBridge] Unknown message type: ${data.type}`);
        }
    }

    /**
     * Trigger Electron renderer to open the content reader
     */
    private triggerOpenReader(nodeId: string) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('path-open-reader', { nodeId });
            // Ensure window comes to front
            if (this.mainWindow.isMinimized()) this.mainWindow.restore();
            this.mainWindow.focus();
            console.log(`[PathBridge] Sent IPC path-open-reader for: ${nodeId} (Focused Window)`);
        }
    }

    /**
     * Broadcast message to all connected clients
     */
    public broadcast(type: string, payload: any) {
        const msg = JSON.stringify({ type, payload });
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    }

    public setCurrentPath(pathData: any) {
        this.currentPath = pathData;
        this.broadcast('pathResult', pathData);
    }

    public close() {
        this.wss.close();
    }
}


