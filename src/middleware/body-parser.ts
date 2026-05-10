import type * as http from 'http';

const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB

export async function readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let totalSize = 0;

        req.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;
            if (totalSize > MAX_BODY_SIZE) {
                req.destroy();
                reject(new Error('Request body exceeds maximum size'));
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });

        req.on('error', reject);
    });
}

export async function parseJsonBody(req: http.IncomingMessage): Promise<any> {
    const raw = await readRequestBody(req);
    if (!raw.trim()) return {};
    return JSON.parse(raw);
}

export function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

export function sendError(
    res: http.ServerResponse,
    statusCode: number,
    error: unknown,
    errorCode?: string
): void {
    if (errorCode) {
        res.setHeader('x-nc-error-code', errorCode);
    }
    sendJson(res, statusCode, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
    });
}
