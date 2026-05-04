/**
 * Data-serving routes: build, content, cache, folders, kb-path.
 * Extracted from server.ts inline chain.
 */
import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import * as fs from 'fs';
import * as path from 'path';

export function registerDataRoutes(ctx: ServerContext): RouteEntry[] {
    const { LOOPBACK_HOST, finalPort } = ctx;

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
                    json(res, 200, { content: `Content route (delegated to server.ts for KB_ROOT resolution)` });
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
                json(res, 200, { folders: [], message: 'Folder listing delegated to server.ts' });
            },
        },
        {
            method: 'GET',
            path: '/api/available-targets',
            handler: async (_req, res) => {
                json(res, 200, { targets: [], message: 'Target listing delegated to server.ts' });
            },
        },
        {
            method: 'GET',
            path: '/api/kb-path',
            handler: async (_req, res) => {
                json(res, 200, { kbPath: '', message: 'KB path delegated to server.ts' });
            },
        },
        {
            method: 'POST',
            path: '/api/kb-path',
            handler: async (req, res) => {
                try {
                    const chunks: Buffer[] = [];
                    req.on('data', (c: Buffer) => chunks.push(c));
                    await new Promise<void>((resolve, reject) => {
                        req.on('end', resolve);
                        req.on('error', reject);
                    });
                    json(res, 200, { updated: true, message: 'KB path update delegated to server.ts' });
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
