import { WebSocketServer, WebSocket } from 'ws';

export class PathBridge {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private port: number;

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

    private handleMessage(data: any, sender: WebSocket) {
        // Handle messages from Godot (e.g., node clicks)
        if (data.type === 'nodeClick') {
            console.log(`[PathBridge] Godot clicked node: ${data.payload}`);
            // Broadcast to all clients (including Frontend)
            this.broadcast('nodeClick', data.payload);
        }
    }

    public broadcast(type: string, payload: any) {
        const msg = JSON.stringify({ type, payload });
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    }

    public close() {
        this.wss.close();
    }
}
