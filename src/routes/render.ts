/**
 * Render routes: Math, Mermaid, Graphviz and clipboard operations.
 * Uses dynamic import() to avoid tsc resolution issues with jsdom-dependent modules.
 */
import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';

export function registerRenderRoutes(_ctx: ServerContext): RouteEntry[] {
    const json = (res: any, code: number, data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

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
            path: '/api/render/math',
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const { expression } = JSON.parse(body);
                    const { renderMathPng } = await import('../reader_renderer');
                    const result = await renderMathPng(expression || '', {});
                    json(res, 200, { success: true, pngBase64: result.pngBase64 });
                } catch (e) { fail(res, e, 'POST /api/render/math'); }
            },
        },
        {
            method: 'POST',
            path: '/api/render/mermaid',
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const { diagram } = JSON.parse(body);
                    const { renderMermaidPng } = await import('../reader_renderer');
                    const result = await renderMermaidPng(diagram || '', {});
                    json(res, 200, { success: true, pngBase64: result.pngBase64 });
                } catch (e) { fail(res, e, 'POST /api/render/mermaid'); }
            },
        },
        {
            method: 'POST',
            path: '/api/render/graphviz',
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    json(res, 200, { success: true, message: 'graphviz render route' });
                } catch (e) { fail(res, e, 'POST /api/render/graphviz'); }
            },
        },
        {
            method: 'POST',
            path: '/api/clipboard/image',
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const { pngBase64 } = JSON.parse(body);
                    const { copyPngToClipboard } = await import('../native_clipboard');
                    await copyPngToClipboard(Buffer.from(pngBase64 || '', 'base64'));
                    json(res, 200, { success: true });
                } catch (e) { fail(res, e, 'POST /api/clipboard/image'); }
            },
        },
        {
            method: 'POST',
            path: '/api/clipboard/image-binary',
            handler: async (req, res) => {
                try {
                    const chunks: Buffer[] = [];
                    req.on('data', (c: Buffer) => chunks.push(c));
                    await new Promise<void>((resolve, reject) => {
                        req.on('end', resolve);
                        req.on('error', reject);
                    });
                    const { copyPngToClipboard } = await import('../native_clipboard');
                    await copyPngToClipboard(Buffer.concat(chunks));
                    json(res, 200, { success: true });
                } catch (e) { fail(res, e, 'POST /api/clipboard/image-binary'); }
            },
        },
    ];
}
