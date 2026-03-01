import { WebSocketServer, WebSocket } from 'ws';

export class PathBridge {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private clientMeta: Map<WebSocket, { id: number; tag: string; address: string }> = new Map();
    private nextClientId = 1;
    private port: number;
    private currentPath: any = null;

    constructor(port: number = 9876) {
        this.port = port;
        this.wss = new WebSocketServer({ port });
        
        console.log(`[PathBridge] WebSocket Server started on port ${port}`);

        this.wss.on('connection', (ws, request) => {
            const clientId = this.nextClientId++;
            const clientTag = this.resolveClientTag(request.url || '');
            const clientAddress = request.socket.remoteAddress || 'unknown';

            this.clientMeta.set(ws, { id: clientId, tag: clientTag, address: clientAddress });
            this.clients.add(ws);
            console.log(
                `[PathBridge] Client connected #${clientId} (${clientTag}) from ${clientAddress}. Total clients: ${this.clients.size}`
            );

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(data, ws);
                } catch (e) {
                    console.error('[PathBridge] Message error:', e);
                }
            });

            ws.on('close', (code, reasonBuffer) => {
                const meta = this.clientMeta.get(ws);
                const reason = reasonBuffer?.toString() || '';
                this.clients.delete(ws);
                this.clientMeta.delete(ws);
                console.log(
                    `[PathBridge] Client disconnected #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}) code=${code} reason='${reason}'. Total clients: ${this.clients.size}`
                );
            });

            ws.on('error', (error) => {
                const meta = this.clientMeta.get(ws);
                console.error(
                    `[PathBridge] Client error #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}):`,
                    error
                );
            });
        });
    }

    private resolveClientTag(rawUrl: string): string {
        if (!rawUrl) return 'unknown';
        try {
            const parsed = new URL(rawUrl, `ws://127.0.0.1:${this.port}`);
            const client = (parsed.searchParams.get('client') || '').trim();
            return client || 'unknown';
        } catch (_e) {
            return 'unknown';
        }
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

            case 'collapsePrereqs':
                console.log(`[PathBridge] Collapse prereqs: ${data.payload?.nodeId}`);
                this.broadcast('collapsePrereqs', data.payload);
                break;

            case 'collapseAll':
                console.log(`[PathBridge] Collapse ALL requested`);
                this.broadcast('collapseAll', data.payload);
                break;

            case 'configure':
                 console.log(`[PathBridge] Configuration update`);
                 this.broadcast('configure', data.payload);
                 break;

            case 'exitPathMode':
                console.log('[PathBridge] Exit Path Mode requested');
                this.broadcast('exitPathMode', data.payload || {});
                break;

            default:
                console.log(`[PathBridge] Unknown message type: ${data.type}`);
        }
    }



    /**
     * Broadcast message to all connected clients
     */
    public broadcast(type: string, payload: any) {
        const msg = JSON.stringify({ type, payload });
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(msg);
                } catch (e) {
                    const meta = this.clientMeta.get(client);
                    console.error(
                        `[PathBridge] Broadcast error to #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}):`,
                        e
                    );
                }
            }
        });
    }

    public setCurrentPath(pathData: any) {
        this.currentPath = pathData;
        this.broadcast('pathResult', pathData);
    }

    public close() {
        this.wss.close();
        this.clients.clear();
        this.clientMeta.clear();
    }
}


