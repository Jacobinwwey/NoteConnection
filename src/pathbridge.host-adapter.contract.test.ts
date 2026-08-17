import { WebSocket } from 'ws';
import { PathBridge, type PathBridgeHostOperation } from './core/PathBridge';

function waitForMessage(socket: WebSocket, predicate: (payload: any) => boolean): Promise<any> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off('message', onMessage);
            reject(new Error('Timed out waiting for PathBridge message.'));
        }, 3000);
        const onMessage = (raw: Buffer) => {
            let payload: any;
            try {
                payload = JSON.parse(raw.toString('utf8'));
            } catch {
                return;
            }
            if (!predicate(payload)) {
                return;
            }
            clearTimeout(timer);
            socket.off('message', onMessage);
            resolve(payload);
        };
        socket.on('message', onMessage);
    });
}

function connectClient(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}`);
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
    });
}

async function closeClient(socket: WebSocket | null): Promise<void> {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
        return;
    }
    await new Promise<void>((resolve) => {
        socket.once('close', () => resolve());
        socket.close();
    });
}

describe('PathBridge host adapter contract', () => {
    test('executes knowledge requests in the host and returns correlated results', async () => {
        const operations: PathBridgeHostOperation[] = [];
        const bridge = new PathBridge({
            port: 0,
            hostAdapter: {
                execute: async (operation) => {
                    operations.push(operation);
                    return { nodeCount: 2, execution: 'host' };
                },
            },
        });
        let client: WebSocket | null = null;
        try {
            await bridge.waitUntilReady();
            client = await connectClient(bridge.getPort());
            const capabilitiesPromise = waitForMessage(client, (message) => message.type === 'capabilities');
            client.send(JSON.stringify({ type: 'identify', payload: { client: 'test-client' } }));
            await capabilitiesPromise;
            client.send(JSON.stringify({
                type: 'query',
                correlationId: 'corr-1',
                payload: { requestId: 'query-1', workspaceId: 'mobile-workspace' },
            }));
            const result = await waitForMessage(client, (message) => message.type === 'operationResult');
            expect(result.payload).toEqual(expect.objectContaining({
                type: 'query',
                requestId: 'query-1',
                correlationId: 'corr-1',
                ok: true,
                result: { nodeCount: 2, execution: 'host' },
            }));
            expect(operations[0]).toEqual(expect.objectContaining({
                type: 'query',
                requestId: 'query-1',
                correlationId: 'corr-1',
                clientTag: 'test-client',
            }));
            expect(operations[0].signal).toBeInstanceOf(AbortSignal);
        } finally {
            await closeClient(client);
            bridge.close();
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
    });

    test('propagates cancellation to the host adapter and does not leak pending work', async () => {
        let cancelledRequestId = '';
        let operationSignal: AbortSignal | null = null;
        const bridge = new PathBridge({
            port: 0,
            hostAdapter: {
                execute: (operation) => {
                    operationSignal = operation.signal;
                    return new Promise((_resolve, reject) => {
                        operation.signal.addEventListener('abort', () => reject(new Error('aborted')));
                    });
                },
                cancel: (requestId) => {
                    cancelledRequestId = requestId;
                },
            },
        });
        let client: WebSocket | null = null;
        try {
            await bridge.waitUntilReady();
            client = await connectClient(bridge.getPort());
            const capabilitiesPromise = waitForMessage(client, (message) => message.type === 'capabilities');
            client.send(JSON.stringify({ type: 'identify', payload: { client: 'cancel-client' } }));
            await capabilitiesPromise;
            client.send(JSON.stringify({ type: 'query', payload: { requestId: 'query-cancel' } }));
            await new Promise((resolve) => setTimeout(resolve, 20));
            client.send(JSON.stringify({ type: 'cancel', payload: { requestId: 'query-cancel' } }));
            const result = await waitForMessage(client, (message) => message.type === 'operationResult' && message.payload.type === 'cancel');
            expect(result.payload).toEqual(expect.objectContaining({
                requestId: 'query-cancel',
                cancelled: true,
                ok: false,
            }));
            expect(cancelledRequestId).toBe('query-cancel');
            expect((operationSignal as AbortSignal | null)?.aborted).toBe(true);
        } finally {
            await closeClient(client);
            bridge.close();
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
    });
});
