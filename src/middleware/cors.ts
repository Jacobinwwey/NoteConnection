import type * as http from 'http';

const ALLOWED_ORIGINS = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'tauri://localhost',
    'https://tauri.localhost',
]);
const ALLOWED_HEADER_NAMES = [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-NoteConnection-Token',
    'X-Agent-Conversation-Turn-Id',
    'X-Agent-Conversation-Resume-Turn-Id',
];
const EXPOSED_HEADER_NAMES = [
    'X-Request-Id',
    'X-Error-Code',
    'X-Agent-Conversation-Turn-Id',
    'X-Agent-Conversation-Replay',
];

export function applyCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const origin = req.headers.origin;
    if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADER_NAMES.join(', '));
        res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADER_NAMES.join(', '));
        return true;
    }

    if (ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADER_NAMES.join(', '));
        res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADER_NAMES.join(', '));
        res.setHeader('Vary', 'Origin');
        return true;
    }

    return false;
}
