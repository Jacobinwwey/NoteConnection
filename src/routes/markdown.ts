import * as fs from 'fs';
import * as path from 'path';
import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import { normalizeMarkdownRuntimeConfig } from '../markdown/MarkdownGateway';

interface MarkdownBlock {
    id: number;
    text: string;
    heading?: string;
    headingLevel?: number;
    startLine: number;
    endLine: number;
}

interface MarkdownIndex {
    indexId: string;
    filePath: string;
    blocks: MarkdownBlock[];
    markdownProtocolVersion: string;
    indexedAt: string;
}

const PROTOCOL_VERSION = '1.0.0';
const INDEXES = new Map<string, MarkdownIndex>();

function buildIndexId(filePath: string): string {
    return `md-idx-${Buffer.from(filePath).toString('base64').slice(0, 16)}-${Date.now()}`;
}

function indexMarkdownFile(filePath: string): MarkdownIndex {
    const resolved = path.resolve(filePath);
    const content = fs.readFileSync(resolved, 'utf8');
    const lines = content.split('\n');
    const blocks: MarkdownBlock[] = [];
    let currentBlock: string[] = [];
    let currentHeading: string | undefined;
    let currentHeadingLevel = 0;
    let blockStartLine = 0;
    let blockId = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

        if (headingMatch) {
            // Flush current block
            if (currentBlock.length > 0 || currentHeading) {
                blocks.push({
                    id: blockId++,
                    text: currentBlock.join('\n').trim(),
                    heading: currentHeading,
                    headingLevel: currentHeadingLevel,
                    startLine: blockStartLine,
                    endLine: i - 1,
                });
            }
            currentHeading = headingMatch[2].trim();
            currentHeadingLevel = headingMatch[1].length;
            currentBlock = [];
            blockStartLine = i;
        } else {
            currentBlock.push(line);
        }
    }

    // Flush final block
    if (currentBlock.length > 0 || currentHeading) {
        blocks.push({
            id: blockId,
            text: currentBlock.join('\n').trim(),
            heading: currentHeading,
            headingLevel: currentHeadingLevel,
            startLine: blockStartLine,
            endLine: lines.length - 1,
        });
    }

    // Ensure at least one block for empty files
    if (blocks.length === 0) {
        blocks.push({
            id: 0,
            text: content.trim() || '(empty)',
            heading: undefined,
            headingLevel: 0,
            startLine: 0,
            endLine: lines.length - 1,
        });
    }

    const indexId = buildIndexId(filePath);
    const index: MarkdownIndex = {
        indexId,
        filePath,
        blocks,
        markdownProtocolVersion: PROTOCOL_VERSION,
        indexedAt: new Date().toISOString(),
    };
    INDEXES.set(indexId, index);
    return index;
}

function resolveNodeFromIndex(index: MarkdownIndex, nodeId: string): { targetBlockId: number; filePath: string } | null {
    const block = index.blocks.find(b =>
        b.heading?.toLowerCase() === nodeId.toLowerCase() ||
        b.text.toLowerCase().includes(nodeId.toLowerCase())
    );
    return block ? { targetBlockId: block.id, filePath: index.filePath } : null;
}

function resolveWikiFromIndex(index: MarkdownIndex, wikiTarget: string): { matchType: string; filePath: string; targetBlockId?: number } | null {
    const clean = wikiTarget.replace(/^\[\[|\]\]$/g, '').trim();
    const exact = index.blocks.find(b => b.heading?.toLowerCase() === clean.toLowerCase());
    if (exact) return { matchType: 'exact', filePath: index.filePath, targetBlockId: exact.id };
    const partial = index.blocks.find(b =>
        b.heading?.toLowerCase().includes(clean.toLowerCase()) ||
        b.text.toLowerCase().includes(clean.toLowerCase())
    );
    if (partial) return { matchType: 'alias', filePath: index.filePath, targetBlockId: partial.id };
    return { matchType: 'fallback', filePath: index.filePath };
}

export function registerMarkdownRoutes(_ctx: ServerContext): RouteEntry[] {
    const ctx = _ctx;
    const api = (p: string) => `/api/markdown${p}`;

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

    const resolveRuntimeConfig = async () => {
        if (ctx.loadFrontendSettings) {
            const frontendSettings = await ctx.loadFrontendSettings();
            return normalizeMarkdownRuntimeConfig(frontendSettings?.reading);
        }
        return normalizeMarkdownRuntimeConfig({});
    };

    return [
        {
            method: 'POST',
            path: api('/index'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    const filePath = payload.filePath || payload.path || '';
                    if (!filePath) {
                        json(res, 400, {
                            success: false,
                            error: 'Missing filePath for /api/markdown/index',
                            markdownProtocolVersion: PROTOCOL_VERSION,
                        });
                        return;
                    }
                    if (ctx.markdownGateway) {
                        const runtimeConfig = await resolveRuntimeConfig();
                        const result = await ctx.markdownGateway.buildIndex(
                            {
                                filePath,
                                forceRebuild: payload.forceRebuild === true,
                            },
                            runtimeConfig
                        );
                        ok(res, result);
                        return;
                    }
                    if (!filePath || !fs.existsSync(filePath)) {
                        return fail(res, new Error('File not found: ' + filePath), 'API:POST /api/markdown/index');
                    }
                    const index = indexMarkdownFile(filePath);
                    ok(res, {
                        indexId: index.indexId,
                        filePath: index.filePath,
                        blocksSummary: { totalBlocks: index.blocks.length },
                        markdownProtocolVersion: index.markdownProtocolVersion,
                    });
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
                    if (ctx.markdownGateway) {
                        const result = await ctx.markdownGateway.getChunk({
                            indexId: String(payload.indexId || ''),
                            startBlock: Number(payload.startBlock) || 0,
                            blockCount: Number(payload.blockCount) || 1,
                        });
                        ok(res, result);
                        return;
                    }
                    const index = INDEXES.get(payload.indexId || '');
                    if (!index) return fail(res, new Error('Index not found'), 'API:POST /api/markdown/chunk');
                    const start = payload.startBlock || 0;
                    const count = payload.blockCount || index.blocks.length;
                    const blocks = index.blocks.slice(start, start + count).map(b => ({
                        blockId: b.id,
                        text: b.text,
                        heading: b.heading,
                        headingLevel: b.headingLevel,
                    }));
                    ok(res, { blocks });
                } catch (e) { fail(res, e, 'API:POST /api/markdown/chunk'); }
            },
        },
        {
            method: 'POST',
            path: api('/resolve-node'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    if (ctx.markdownGateway) {
                        const runtimeConfig = await resolveRuntimeConfig();
                        const result = await ctx.markdownGateway.resolveNode(
                            {
                                nodeId: String(payload.nodeId || ''),
                                currentFilePath: String(payload.currentFilePath || '').trim() || undefined,
                            },
                            runtimeConfig
                        );
                        ok(res, result);
                        return;
                    }
                    const index = INDEXES.get(payload.indexId || '');
                    // Fallback: search all indexes
                    const searchIndex = index || [...INDEXES.values()].find(i => i.filePath === payload.currentFilePath);
                    if (!searchIndex && INDEXES.size > 0) {
                        return ok(res, { filePath: payload.currentFilePath || '', targetBlockId: 0 });
                    }
                    if (!searchIndex) return fail(res, new Error('No index available'), 'API:POST /api/markdown/resolve-node');
                    const result = resolveNodeFromIndex(searchIndex, payload.nodeId || '');
                    ok(res, result || { filePath: searchIndex.filePath, targetBlockId: 0 });
                } catch (e) { fail(res, e, 'API:POST /api/markdown/resolve-node'); }
            },
        },
        {
            method: 'POST',
            path: api('/resolve-wiki'),
            handler: async (req, res) => {
                try {
                    const body = await readBody(req);
                    const payload = JSON.parse(body);
                    if (ctx.markdownGateway) {
                        const runtimeConfig = await resolveRuntimeConfig();
                        const result = await ctx.markdownGateway.resolveWiki(
                            {
                                wikiTarget: String(payload.wikiTarget || ''),
                                currentFilePath: String(payload.currentFilePath || ''),
                            },
                            runtimeConfig
                        );
                        ok(res, result);
                        return;
                    }
                    const index = INDEXES.get(payload.indexId || '');
                    const searchIndex = index || [...INDEXES.values()].find(i => i.filePath === payload.currentFilePath);
                    if (!searchIndex && INDEXES.size > 0) {
                        return ok(res, { filePath: payload.currentFilePath || '', matchType: 'fallback' });
                    }
                    if (!searchIndex) return fail(res, new Error('No index available'), 'API:POST /api/markdown/resolve-wiki');
                    const result = resolveWikiFromIndex(searchIndex, payload.wikiTarget || '');
                    ok(res, result || { filePath: searchIndex.filePath, matchType: 'fallback' });
                } catch (e) { fail(res, e, 'API:POST /api/markdown/resolve-wiki'); }
            },
        },
    ];
}
