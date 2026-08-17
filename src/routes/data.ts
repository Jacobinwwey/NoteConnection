/** Data-serving routes — extracted from server.ts inline chain. */
import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from '../index';
import { FileLoader } from '../backend/FileLoader';
import type { RelationRecomputeMode } from '../learning/types';

type RouteRelationRecomputeMode = Exclude<RelationRecomputeMode, 'auto'>;

const ROUTE_RELATION_RECOMPUTE_MODES: readonly RouteRelationRecomputeMode[] = [
    'none',
    'incremental',
    'full',
];

function parseRouteRelationRecomputeMode(rawValue: unknown): RouteRelationRecomputeMode | undefined {
    const normalized = String(rawValue ?? '').trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if ((ROUTE_RELATION_RECOMPUTE_MODES as readonly string[]).includes(normalized)) {
        return normalized as RouteRelationRecomputeMode;
    }
    return undefined;
}

export function registerDataRoutes(ctx: ServerContext): RouteEntry[] {
    const { LOOPBACK_HOST, finalPort, kbRoot, runtimeDataDir, knowledgeLearningPlatform } = ctx;

    const json = (res: any, code: number, data: unknown) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };
    const ok = (res: any, data: unknown) => json(res, 200, { success: true, ...(data as any) });
    const fail = (res: any, error: unknown, label: string) => { console.error(error); CrashLogger.log(error, label); json(res, 500, { success: false, error: String(error) }); };
    const readBody = (req: any): Promise<string> => new Promise((resolve, reject) => { const chunks: Buffer[] = []; req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); });
    const sanitizeTargetName = (target: string) => String(target || '').replace(/[^a-z0-9_\-]/gi, '_');
    const generatedAssetPath = (filename: string) => path.join(runtimeDataDir, filename);
    const readGeneratedAssetIfExists = async (filename: string): Promise<string | null> => {
        const candidate = generatedAssetPath(filename);
        try {
            await fs.promises.access(candidate, fs.constants.F_OK);
            return candidate;
        } catch {
            return null;
        }
    };
    const buildKnowledgeDocumentPayloads = async (target: string) => {
        const normalizedTarget = String(target || '').trim();
        const targetPath = normalizedTarget && normalizedTarget !== 'ALL_FOLDERS'
            ? path.join(kbRoot, normalizedTarget)
            : kbRoot;
        const files = await FileLoader.loadFiles(targetPath, ['.md'], kbRoot);
        return files.map((file) => {
            const relativePath = path.relative(kbRoot, file.filepath).replace(/\\/g, '/');
            return {
                sourcePath: `Knowledge_Base/${relativePath}`.replace(/\/{2,}/g, '/'),
                sourceUri: file.sourceUri,
                revision: file.revision,
                identityAliases: file.identityAliases,
                content: file.content,
                language: /[\u4e00-\u9fff]/.test(file.content) ? 'zh' : 'en',
            };
        });
    };
    const syncKnowledgeWorkspaceForTarget = async (
        target: string,
        reason: string,
        relationRecomputeMode: RouteRelationRecomputeMode = 'incremental',
    ) => {
        const documents = await buildKnowledgeDocumentPayloads(target);
        const result = await knowledgeLearningPlatform.ingestKnowledge({
            incremental: true,
            documents,
            ingestedAt: new Date().toISOString(),
            relationRecomputeMode,
        });
        return {
            target,
            reason,
            documentCount: documents.length,
            summary: result.summary,
        };
    };

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
                const target = urlObj.searchParams.get('target');
                if (!target) { json(res, 200, null); return; }
                if (target === 'ALL_FOLDERS') {
                    const activeJsPath = await readGeneratedAssetIfExists('data.js');
                    if (!activeJsPath) { json(res, 200, null); return; }
                    const stat = await fs.promises.stat(activeJsPath);
                    json(res, 200, { date: stat.mtime.toLocaleString(), size: stat.size, source: 'active' });
                    return;
                }
                const targetFile = await readGeneratedAssetIfExists(`data_${sanitizeTargetName(target)}.js`);
                if (!targetFile) { json(res, 200, null); return; }
                const stat = await fs.promises.stat(targetFile);
                json(res, 200, { date: stat.mtime.toLocaleString(), size: stat.size });
            } catch (e) { fail(res, e, 'GET /api/check-cache'); }
        }},
        { method: 'GET', path: '/api/restore-cache', handler: async (req, res) => {
            try {
                const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                const target = urlObj.searchParams.get('target');
                const requestedMode = urlObj.searchParams.get('relationRecomputeMode');
                const relationRecomputeMode = parseRouteRelationRecomputeMode(requestedMode);
                if (requestedMode && !relationRecomputeMode) {
                    json(res, 400, {
                        success: false,
                        error: 'relationRecomputeMode must be one of: none, incremental, full',
                    });
                    return;
                }
                if (!target) { json(res, 400, { success: false, error: 'Missing target' }); return; }
                if (target === 'ALL_FOLDERS') {
                    const activeJsPath = await readGeneratedAssetIfExists('data.js');
                    if (!activeJsPath) { json(res, 200, { success: false, error: 'No active cache found' }); return; }
                    const sync = await syncKnowledgeWorkspaceForTarget(
                        'ALL_FOLDERS',
                        'restore_cache',
                        relationRecomputeMode || 'incremental',
                    );
                    json(res, 200, { success: true, sync });
                    return;
                }
                const targetName = sanitizeTargetName(target);
                const cacheJs = await readGeneratedAssetIfExists(`data_${targetName}.js`);
                const cacheJson = await readGeneratedAssetIfExists(`graph_data_${targetName}.json`);
                if (!cacheJs) { json(res, 404, { restored: false, error: `No cache found for target: ${target}` }); return; }
                await fs.promises.mkdir(runtimeDataDir, { recursive: true });
                await fs.promises.copyFile(cacheJs, generatedAssetPath('data.js'));
                if (cacheJson) {
                    await fs.promises.copyFile(cacheJson, generatedAssetPath('graph_data.json'));
                }
                const sync = await syncKnowledgeWorkspaceForTarget(
                    target,
                    'restore_cache',
                    relationRecomputeMode || 'incremental',
                );
                json(res, 200, { success: true, sync });
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
                const target = String(payload?.target || 'ALL_FOLDERS').trim() || 'ALL_FOLDERS';
                const requestedMode = payload?.relationRecomputeMode;
                const relationRecomputeMode = parseRouteRelationRecomputeMode(requestedMode);
                if (requestedMode !== undefined && !relationRecomputeMode) {
                    json(res, 400, {
                        success: false,
                        error: 'relationRecomputeMode must be one of: none, incremental, full',
                    });
                    return;
                }
                const targetPath = target !== 'ALL_FOLDERS'
                    ? path.join(kbRoot, target)
                    : kbRoot;
                await buildGraph({
                    targetPath,
                    maxWorkers: payload?.maxWorkers,
                    enableGPU: payload?.enableGPU,
                    enableGPULayout: payload?.enableGPULayout,
                    memorySavingMode: payload?.memorySavingMode,
                    deepDebug: payload?.deepDebug,
                });
                const sync = await syncKnowledgeWorkspaceForTarget(
                    target,
                    'build_graph',
                    relationRecomputeMode || 'incremental',
                );
                json(res, 200, { success: true, target, requestedAt: new Date().toISOString(), sync });
            } catch (e) { fail(res, e, 'POST /api/build'); }
        }},
    ];
}
