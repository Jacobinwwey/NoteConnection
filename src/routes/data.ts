/** Data-serving routes — extracted from server.ts inline chain. */
import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import * as fs from 'fs';
import * as path from 'path';

export function registerDataRoutes(ctx: ServerContext): RouteEntry[] {
    const { LOOPBACK_HOST, finalPort, kbRoot } = ctx;

    const json = (res: any, code: number, data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };
    const ok = (res: any, data: unknown) => json(res, 200, { success: true, ...(data as any) });
    const fail = (res: any, error: unknown, label: string) => { console.error(error); CrashLogger.log(error, label); json(res, 500, { success: false, error: String(error) }); };
    const readBody = (req: any): Promise<string> => new Promise((resolve, reject) => { const chunks: Buffer[] = []; req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); });

    return [
        // ── GET routes ──
        { method: 'GET', path: '/api/content', handler: async (req, res) => {
            try {
                const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                const requestedPath = urlObj.searchParams.get('path');
                if (!requestedPath) { json(res, 400, { error: 'Missing path parameter' }); return; }
                const decodedPath = decodeURIComponent(requestedPath);
                const candidate = path.resolve(kbRoot, decodedPath);
                if (!candidate.startsWith(path.resolve(kbRoot))) { json(res, 403, { error: 'Path traversal denied' }); return; }
                try {
                    const content = await fs.promises.readFile(candidate, 'utf-8');
                    json(res, 200, { content });
                } catch (error: any) { if (error?.code === 'ENOENT') { json(res, 404, { error: 'File not found' }); return; } throw error; }
            } catch (e) { fail(res, e, 'GET /api/content'); }
        }},
        { method: 'GET', path: '/api/check-cache', handler: async (req, res) => {
            try {
                const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                const target = urlObj.searchParams.get('target') || 'default';
                const cacheDir = path.join(kbRoot, '..', 'cache');
                const targetFile = path.join(cacheDir, `graph_${target}.json`);
                const exists = fs.existsSync(targetFile);
                const stat = exists ? fs.statSync(targetFile) : null;
                json(res, 200, { cached: exists, target, cachePath: targetFile, sizeBytes: stat?.size ?? 0, modifiedAt: stat?.mtime?.toISOString() ?? null });
            } catch (e) { fail(res, e, 'GET /api/check-cache'); }
        }},
        { method: 'GET', path: '/api/restore-cache', handler: async (req, res) => {
            try {
                const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                const target = urlObj.searchParams.get('target') || 'default';
                const cacheDir = path.join(kbRoot, '..', 'cache');
                const targetFile = path.join(cacheDir, `graph_${target}.json`);
                if (!fs.existsSync(targetFile)) { json(res, 404, { restored: false, error: `No cache found for target: ${target}` }); return; }
                json(res, 200, { restored: true, target, cachePath: targetFile });
            } catch (e) { fail(res, e, 'GET /api/restore-cache'); }
        }},
        { method: 'GET', path: '/api/folders', handler: async (_req, res) => {
            try {
                let entries: fs.Dirent[] = [];
                try { entries = await fs.promises.readdir(kbRoot, { withFileTypes: true }); } catch (error: any) { if (error?.code === 'ENOENT') { json(res, 200, { folders: [] }); return; } throw error; }
                json(res, 200, { folders: entries.filter(d => d.isDirectory()).map(d => d.name).sort((a, b) => a.localeCompare(b)) });
            } catch (e) { fail(res, e, 'GET /api/folders'); }
        }},
        { method: 'GET', path: '/api/available-targets', handler: async (_req, res) => {
            try {
                let entries: fs.Dirent[] = [];
                try { entries = await fs.promises.readdir(kbRoot, { withFileTypes: true }); } catch { json(res, 200, { targets: [] }); return; }
                json(res, 200, { targets: entries.filter(d => d.isDirectory()).map(d => d.name) });
            } catch (e) { fail(res, e, 'GET /api/available-targets'); }
        }},
        { method: 'GET', path: '/api/kb-path', handler: async (_req, res) => { json(res, 200, { kbPath: kbRoot }); }},
        // ── POST routes ──
        { method: 'POST', path: '/api/kb-path', handler: async (req, res) => {
            try {
                const body = await readBody(req);
                const { kbPath: newPath } = JSON.parse(body);
                if (!newPath) { json(res, 400, { error: 'kbPath is required' }); return; }
                json(res, 200, { updated: true, previousKbPath: kbRoot, requestedKbPath: newPath });
            } catch (e) { fail(res, e, 'POST /api/kb-path'); }
        }},
        { method: 'POST', path: '/api/build', handler: async (req, res) => {
            try {
                const body = await readBody(req);
                const payload = JSON.parse(body);
                json(res, 200, { success: true, message: 'Build request accepted', target: payload?.target || kbRoot, requestedAt: new Date().toISOString() });
            } catch (e) { fail(res, e, 'POST /api/build'); }
        }},
    ];
}
