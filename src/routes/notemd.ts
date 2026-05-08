import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import { buildCliCapabilityManifest } from '../notemd/operations/capabilityManifest';
import { buildCliInvocationContract } from '../notemd/operations/cliContracts';

export function registerNotemdRoutes(ctx: ServerContext): RouteEntry[] {
    const { notemdService, loadNotemdSettings } = ctx;

    const api = (path: string) => `/api/notemd${path}`;

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
            method: 'GET',
            path: api('/settings'),
            handler: async (_req, res) => {
                try {
                    const settings = await loadNotemdSettings();
                    ok(res, { settings });
                } catch (e) { fail(res, e, 'API:GET /api/notemd/settings'); }
            },
        },
        {
            method: 'POST',
            path: api('/settings'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    const result = await notemdService.updateSettings(payload);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/settings'); }
            },
        },
        {
            method: 'POST',
            path: api('/test-llm'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.testLlmConnection(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/test-llm'); }
            },
        },
        {
            method: 'POST',
            path: api('/process-file'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.processFile(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/process-file'); }
            },
        },
        {
            method: 'POST',
            path: api('/process-folder'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.processFolder(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/process-folder'); }
            },
        },
        {
            method: 'POST',
            path: api('/generate-content'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.generateContent(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/generate-content'); }
            },
        },
        {
            method: 'POST',
            path: api('/translate-file'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.translateFile(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/translate-file'); }
            },
        },
        {
            method: 'POST',
            path: api('/fix-mermaid'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const { filePath, inPlace } = JSON.parse(raw);
                    const result = await notemdService.fixMermaid(filePath, inPlace);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/fix-mermaid'); }
            },
        },
        {
            method: 'POST',
            path: api('/fix-formulas'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const { filePath, inPlace } = JSON.parse(raw);
                    const result = await notemdService.fixFormulas(filePath, inPlace);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/fix-formulas'); }
            },
        },
        {
            method: 'POST',
            path: api('/check-duplicates'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const { filePath } = JSON.parse(raw);
                    const result = await notemdService.checkDuplicates(filePath);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/check-duplicates'); }
            },
        },
        {
            method: 'POST',
            path: api('/extract-concepts'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const { filePath } = JSON.parse(raw);
                    const result = await notemdService.extractConcepts(filePath, settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/extract-concepts'); }
            },
        },
        {
            method: 'POST',
            path: api('/cancel'),
            handler: async (_req, res) => {
                try {
                    notemdService.cancelCurrentOperation();
                    ok(res, { cancelled: true });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/cancel'); }
            },
        },
        // ── Diagram generation (obsidian-notemd v1.8.4) ──
        {
            method: 'POST',
            path: api('/generate-diagram'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.generateDiagram(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/generate-diagram'); }
            },
        },
        {
            method: 'POST',
            path: api('/preview-diagram'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.previewDiagram(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/preview-diagram'); }
            },
        },
        {
            method: 'POST',
            path: api('/export-diagram'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.exportDiagram(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/export-diagram'); }
            },
        },
        // ── Web search (obsidian-notemd v1.8.4) ──
        {
            method: 'POST',
            path: api('/search'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.search(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/search'); }
            },
        },
        // ── Batch progress query (obsidian-notemd v1.8.4) ──
        {
            method: 'GET',
            path: api('/progress'),
            handler: async (_req, res) => {
                try {
                    const progress = await notemdService.getBatchProgress();
                    ok(res, { progress });
                } catch (e) { fail(res, e, 'API:GET /api/notemd/progress'); }
            },
        },
        // ── LLM provider diagnostics (obsidian-notemd v1.8.4) ──
        {
            method: 'POST',
            path: api('/diagnose-llm'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const result = await notemdService.diagnoseLlmProvider(JSON.parse(body));
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/diagnose-llm'); }
            },
        },
        // ── Extract original text (obsidian-notemd v1.8.4) ──
        {
            method: 'POST',
            path: api('/extract-original-text'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.extractOriginalText(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/extract-original-text'); }
            },
        },
        // ── CLI operations registry ──
        {
            method: 'GET',
            path: api('/capability-manifest'),
            handler: async (_req, res) => {
                try {
                    const manifest = buildCliCapabilityManifest('notemd');
                    ok(res, { manifest });
                } catch (e) { fail(res, e, 'API:GET /api/notemd/capability-manifest'); }
            },
        },
        {
            method: 'GET',
            path: api('/invocation-contract'),
            handler: async (_req, res) => {
                try {
                    const contract = buildCliInvocationContract();
                    ok(res, { contract });
                } catch (e) { fail(res, e, 'API:GET /api/notemd/invocation-contract'); }
            },
        },
        {
            method: 'POST',
            path: api('/provider-diagnostic'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.diagnoseLlmProvider(JSON.parse(body), settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/provider-diagnostic'); }
            },
        },
        {
            method: 'POST',
            path: api('/one-click-extract'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.oneClickExtract(JSON.parse(body).filePath, settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/one-click-extract'); }
            },
        },
        {
            method: 'POST',
            path: api('/batch-fix-mermaid'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const { folderPath, inPlace } = JSON.parse(raw);
                    const result = await notemdService.batchFixMermaid(folderPath, inPlace ?? true);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/batch-fix-mermaid'); }
            },
        },
        {
            method: 'POST',
            path: api('/batch-fix-formulas'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const { folderPath, inPlace } = JSON.parse(raw);
                    const result = await notemdService.batchFixFormulas(folderPath, inPlace ?? true);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/batch-fix-formulas'); }
            },
        },
        {
            method: 'POST',
            path: api('/batch-generate-content'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const { folderPath } = JSON.parse(raw);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.generateFolderContent(folderPath, settings);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/batch-generate-content'); }
            },
        },
        {
            method: 'POST',
            path: api('/batch-progress'),
            handler: async (req, res) => {
                try {
                    const raw = await readBody(req);
                    const { operationId } = JSON.parse(raw);
                    const result = await notemdService.getBatchProgress(operationId);
                    ok(res, { progress: result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/batch-progress'); }
            },
        },
        {
            method: 'POST',
            path: api('/provider-profiles/export'),
            handler: async (req, res) => {
                try {
                    const settings = await loadNotemdSettings();
                    const { buildProviderProfileExport } = await import('../notemd/providerProfiles');
                    const profile = buildProviderProfileExport(settings.providers);
                    ok(res, { profile });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/provider-profiles/export'); }
            },
        },
        {
            method: 'POST',
            path: api('/provider-profiles/import'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const settings = await loadNotemdSettings();
                    const { parseProviderProfileImport } = await import('../notemd/providerProfiles');
                    const result = parseProviderProfileImport(body, settings.providers);
                    ok(res, { result });
                } catch (e) { fail(res, e, 'API:POST /api/notemd/provider-profiles/import'); }
            },
        },
    ];
}
