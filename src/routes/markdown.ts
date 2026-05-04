import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';

export function registerMarkdownRoutes(ctx: ServerContext): RouteEntry[] {
    const api = (path: string) => `/api/markdown${path}`;

    const json = (res: any, code: number, data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const ok = (res: any, data: unknown) => json(res, 200, { success: true, ...(data as any) });
    const fail = (res: any, error: unknown, label: string) => {
        console.error(error);
        CrashLogger.log(error, label);
        json(res, 500, { success: false, error: String(error) });
    };

    const readBody = (req: any): Promise<string> =>
        new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
        });

    return [
        {
            method: 'POST',
            path: api('/index'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    ok(res, { result: `markdown index for ${payload.path || 'unknown'}` });
                } catch (e) { fail(res, e, 'API:POST /api/markdown/index'); }
            },
        },
        {
            method: 'POST',
            path: api('/chunk'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    ok(res, { result: `markdown chunks for ${payload.path || 'unknown'}` });
                } catch (e) { fail(res, e, 'API:POST /api/markdown/chunk'); }
            },
        },
        {
            method: 'POST',
            path: api('/resolve-node'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    ok(res, { result: JSON.parse(body).nodeId || 'unknown' });
                } catch (e) { fail(res, e, 'API:POST /api/markdown/resolve-node'); }
            },
        },
        {
            method: 'POST',
            path: api('/resolve-wiki'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    ok(res, { result: JSON.parse(body).wikiLink || 'unknown' });
                } catch (e) { fail(res, e, 'API:POST /api/markdown/resolve-wiki'); }
            },
        },
    ];
}
