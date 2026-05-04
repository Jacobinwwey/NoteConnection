import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';

export function registerDiagnosticsRoutes(ctx: ServerContext): RouteEntry[] {
    const { finalPort, LOOPBACK_HOST } = ctx;

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

    return [
        {
            method: 'GET',
            path: '/api/runtime-request-trace',
            handler: async (req, res) => {
                try {
                    const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                    const exactRequestId = urlObj.searchParams.get('requestId') || undefined;
                    ok(res, { trace: `request trace output for ${exactRequestId || 'recent'}` });
                } catch (e) { fail(res, e, 'API:GET /api/runtime-request-trace'); }
            },
        },
        {
            method: 'GET',
            path: '/api/runtime-diagnostics',
            handler: async (_req, res) => {
                try {
                    ok(res, {
                        uptime: process.uptime(),
                        memoryUsage: process.memoryUsage(),
                        nodeVersion: process.version,
                        platform: process.platform,
                        arch: process.arch,
                    });
                } catch (e) { fail(res, e, 'API:GET /api/runtime-diagnostics'); }
            },
        },
    ];
}
