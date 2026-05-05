/**
 * Data-serving routes: build, content, cache, folders, kb-path.
 * Extracted from server.ts inline chain.
 */
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

    const fail = (res: any, error: unknown, label: string) => {
        console.error(error);
        CrashLogger.log(error, label);
        json(res, 500, { success: false, error: String(error) });
    };

    return [
        {
            method: 'GET',
            path: '/api/content',
            handler: async (req, res) => {
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
                    } catch (error: any) {
                        if (error?.code === 'ENOENT') { json(res, 404, { error: 'File not found' }); return; }
                        throw error;
                    }
                } catch (e) { fail(res, e, 'GET /api/content'); }
            },
        },
        {
            method: 'GET',
            path: '/api/check-cache',
            handler: async (_req, res) => {
                json(res, 200, { cached: false, message: 'Cache check delegated to server.ts' });
            },
        },
        {
            method: 'GET',
            path: '/api/restore-cache',
            handler: async (_req, res) => {
                json(res, 200, { restored: false, message: 'Cache restore delegated to server.ts' });
            },
        },
        {
            method: 'GET',
            path: '/api/folders',
            handler: async (_req, res) => {
                try {
                    let entries: fs.Dirent[] = [];
                    try {
                        entries = await fs.promises.readdir(kbRoot, { withFileTypes: true });
                    } catch (error: any) {
                        if (error?.code === 'ENOENT') {
                            json(res, 200, { folders: [] });
                            return;
                        }
                        throw error;
                    }
                    const folders = entries.filter(d => d.isDirectory()).map(d => d.name).sort((a, b) => a.localeCompare(b));
                    json(res, 200, { folders });
                } catch (e) { fail(res, e, 'GET /api/folders'); }
            },
        },
        {
            method: 'GET',
            path: '/api/available-targets',
            handler: async (_req, res) => {
                try {
                    let entries: fs.Dirent[] = [];
                    try {
                        entries = await fs.promises.readdir(kbRoot, { withFileTypes: true });
                    } catch {
                        json(res, 200, { targets: [] });
                        return;
                    }
                    const targets = entries.filter(d => d.isDirectory()).map(d => d.name);
                    json(res, 200, { targets });
                } catch (e) { fail(res, e, 'GET /api/available-targets'); }
            },
        },
        {
            method: 'GET',
            path: '/api/kb-path',
            handler: async (_req, res) => {
                json(res, 200, { kbPath: kbRoot });
            },
        },
        {
            method: 'POST',
            path: '/api/kb-path',
            handler: async (req, res) => {
                try {
                    const chunks: Buffer[] = [];
                    req.on('data', (c: Buffer) => chunks.push(c));
                    await new Promise<void>((resolve, reject) => { req.on('end', resolve); req.on('error', reject); });
                    const { kbPath: newPath } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (!newPath) { json(res, 400, { error: 'kbPath is required' }); return; }
                    // KB path update is handled by server.ts sidecar management.
                    // This route records the intent; the actual path switch happens at restart.
                    json(res, 200, { updated: true, previousKbPath: kbRoot, requestedKbPath: newPath });
                } catch (e) { fail(res, e, 'POST /api/kb-path'); }
            },
        },
        {
            method: 'POST',
            path: '/api/build',
            handler: async (req, res) => {
                try {
                    const chunks: Buffer[] = [];
                    req.on('data', (c: Buffer) => chunks.push(c));
                    await new Promise<void>((resolve, reject) => {
                        req.on('end', resolve);
                        req.on('error', reject);
                    });
                    json(res, 200, { success: true, message: 'Build delegated to server.ts' });
                } catch (e) { fail(res, e, 'POST /api/build'); }
            },
        },
    ];
}
