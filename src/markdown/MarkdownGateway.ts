import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export const MARKDOWN_PROTOCOL_VERSION = '1.0.0';

export type MarkdownEngine = 'legacy' | 'pulldown' | 'auto';

export interface MarkdownRuntimeConfig {
    markdownEngine: MarkdownEngine;
    chunkBlockSize: number;
    prefetchBlocks: number;
    indexCacheTtlSec: number;
    maxDocBytes: number;
}

export interface MarkdownBlockRange {
    id: number;
    type: string;
    startByte: number;
    endByte: number;
    startLine: number;
    endLine: number;
    anchorId?: string;
}

export interface MarkdownBlock extends MarkdownBlockRange {
    text?: string;
    inlines?: unknown[];
}

export interface MarkdownAnchor {
    anchorId: string;
    text: string;
    blockId: number;
    startByte: number;
    endByte: number;
    startLine: number;
    endLine: number;
}

export interface MarkdownWikiLink {
    raw: string;
    wikiTarget: string;
    fileTarget: string;
    heading: string;
    alias: string;
    blockId: number;
    startByte: number;
    startLine: number;
}

export interface MarkdownIndexResult {
    indexId: string;
    filePath: string;
    fileVersion: string;
    totalBytes: number;
    totalLines: number;
    blocksSummary: {
        totalBlocks: number;
        chunkBlockSize: number;
    };
    anchorsSummary: {
        count: number;
    };
    wikiLinksSummary: {
        count: number;
    };
    markdownProtocolVersion: string;
    engine: 'legacy' | 'pulldown';
    fallbackReason?: string;
}

export interface MarkdownChunkResult {
    blocks: MarkdownBlock[];
    nextStartBlock: number;
    hasMore: boolean;
    markdownProtocolVersion: string;
}

export interface MarkdownResolveNodeResult {
    filePath: string;
    indexId: string;
    targetBlockId: number;
    startLine: number;
    endLine: number;
    anchorId?: string;
    markdownProtocolVersion: string;
}

export type MarkdownWikiMatchType = 'exact' | 'alias' | 'heading' | 'fallback';

export interface MarkdownResolveWikiResult {
    filePath: string;
    indexId: string;
    targetBlockId?: number;
    anchorId?: string;
    matchType: MarkdownWikiMatchType;
    candidates?: string[];
    markdownProtocolVersion: string;
}

export interface MarkdownIndexRequest {
    filePath: string;
    forceRebuild?: boolean;
}

export interface MarkdownChunkRequest {
    indexId: string;
    startBlock: number;
    blockCount: number;
}

export interface MarkdownResolveNodeRequest {
    nodeId: string;
    currentFilePath?: string;
}

export interface MarkdownResolveWikiRequest {
    wikiTarget: string;
    currentFilePath: string;
}

type WorkerIndexPayload = {
    totalBytes: number;
    totalLines: number;
    blocks: MarkdownBlockRange[];
    anchors: MarkdownAnchor[];
    wikiLinks: MarkdownWikiLink[];
};

type Logger = {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
};

type MarkdownGatewayOptions = {
    projectRoot: string;
    getKnowledgeBaseRoot: () => Promise<string> | string;
    resolveMarkdownPath: (rawPath: string) => Promise<string>;
    getRendererRuntimeAvailability?: () => Promise<{ graphvizBackendPngAvailable: boolean }>;
    logger?: Logger;
};

type IndexedDocumentRecord = {
    indexId: string;
    cacheKey: string;
    filePath: string;
    fileVersion: string;
    engine: 'legacy' | 'pulldown';
    totalBytes: number;
    totalLines: number;
    blocks: MarkdownBlockRange[];
    anchors: MarkdownAnchor[];
    wikiLinks: MarkdownWikiLink[];
    createdAt: number;
    expiresAt: number;
    fallbackReason?: string;
    contentBuffer: Buffer;
};

type CachedFileCatalog = {
    files: string[];
    expiresAt: number;
};

type ParsedWikiTarget = {
    raw: string;
    fileTarget: string;
    heading: string;
    alias: string;
};

type ByteLineEntry = {
    startByte: number;
    contentEndByte: number;
    lineEndByte: number;
    text: string;
};

const MARKDOWN_FILE_PATTERN = /\.(md|markdown)$/i;
const DEFAULT_MARKDOWN_RUNTIME: MarkdownRuntimeConfig = {
    markdownEngine: 'auto',
    chunkBlockSize: 36,
    prefetchBlocks: 8,
    indexCacheTtlSec: 1800,
    maxDocBytes: 96 * 1024 * 1024,
};
const WIKI_LINK_PATTERN = /\[\[([^\]|#]+?)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
const MARKDOWN_WORKER_TIMEOUT_MS = 45_000;
const CONTENT_CACHE_TTL_MS = 120_000;

function asObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function clampNumber(rawValue: unknown, minValue: number, maxValue: number, fallback: number): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(minValue, Math.min(maxValue, numeric));
}

function normalizeMarkdownEngine(rawValue: unknown): MarkdownEngine {
    const value = String(rawValue || '').trim().toLowerCase();
    if (value === 'legacy') {
        return 'legacy';
    }
    if (value === 'pulldown') {
        return 'pulldown';
    }
    return 'auto';
}

export function normalizeMarkdownRuntimeConfig(readingSettings: unknown): MarkdownRuntimeConfig {
    const settings = asObjectRecord(readingSettings);
    return {
        markdownEngine: normalizeMarkdownEngine(
            settings.markdownEngine ?? settings.markdown_engine ?? DEFAULT_MARKDOWN_RUNTIME.markdownEngine
        ),
        chunkBlockSize: Math.round(
            clampNumber(
                settings.chunkBlockSize ?? settings.chunk_block_size ?? DEFAULT_MARKDOWN_RUNTIME.chunkBlockSize,
                1,
                4096,
                DEFAULT_MARKDOWN_RUNTIME.chunkBlockSize
            )
        ),
        prefetchBlocks: Math.round(
            clampNumber(
                settings.prefetchBlocks ?? settings.prefetch_blocks ?? DEFAULT_MARKDOWN_RUNTIME.prefetchBlocks,
                0,
                1024,
                DEFAULT_MARKDOWN_RUNTIME.prefetchBlocks
            )
        ),
        indexCacheTtlSec: Math.round(
            clampNumber(
                settings.indexCacheTtlSec ?? settings.index_cache_ttl_sec ?? DEFAULT_MARKDOWN_RUNTIME.indexCacheTtlSec,
                5,
                86_400,
                DEFAULT_MARKDOWN_RUNTIME.indexCacheTtlSec
            )
        ),
        maxDocBytes: Math.round(
            clampNumber(
                settings.maxDocBytes ?? settings.max_doc_bytes ?? DEFAULT_MARKDOWN_RUNTIME.maxDocBytes,
                256 * 1024,
                2 * 1024 * 1024 * 1024,
                DEFAULT_MARKDOWN_RUNTIME.maxDocBytes
            )
        ),
    };
}

function slugifyHeading(value: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[`~!@#$%^&*()+={}\[\]|\\:;"'<>,.?/]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeLookupKey(value: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\.(md|markdown)$/i, '')
        .replace(/[_\-\s]+/g, '');
}

function parseWikiTarget(rawValue: string): ParsedWikiTarget {
    let raw = String(rawValue || '').trim();
    if (raw.startsWith('[[') && raw.endsWith(']]')) {
        raw = raw.slice(2, -2).trim();
    }

    let target = raw;
    let alias = '';
    const pipeIndex = raw.indexOf('|');
    if (pipeIndex >= 0) {
        target = raw.slice(0, pipeIndex).trim();
        alias = raw.slice(pipeIndex + 1).trim();
    }

    let fileTarget = target;
    let heading = '';
    const hashIndex = target.indexOf('#');
    if (hashIndex >= 0) {
        fileTarget = target.slice(0, hashIndex).trim();
        heading = target.slice(hashIndex + 1).trim();
    }

    return {
        raw,
        fileTarget,
        heading,
        alias,
    };
}

function computeFileVersionHash(filePath: string, stat: fs.Stats, contentBuffer: Buffer): string {
    const hash = crypto.createHash('sha1');
    hash.update(filePath);
    hash.update('|');
    hash.update(String(stat.size));
    hash.update('|');
    hash.update(String(stat.mtimeMs));
    hash.update('|');
    hash.update(contentBuffer);
    return hash.digest('hex');
}

function makeCacheKey(filePath: string, fileVersion: string, engine: string): string {
    return `${filePath}|${fileVersion}|${engine}`;
}

function makeIndexId(cacheKey: string): string {
    return crypto.createHash('sha1').update(cacheKey).digest('hex').slice(0, 16);
}

function parseLinesFromBuffer(contentBuffer: Buffer): ByteLineEntry[] {
    const lines: ByteLineEntry[] = [];
    let cursor = 0;
    while (cursor <= contentBuffer.length) {
        const nextNewline = contentBuffer.indexOf(0x0a, cursor);
        const hasNewline = nextNewline >= 0;
        const lineEnd = hasNewline ? nextNewline : contentBuffer.length;
        let contentEnd = lineEnd;
        if (contentEnd > cursor && contentBuffer[contentEnd - 1] === 0x0d) {
            contentEnd -= 1;
        }
        const text = contentBuffer.subarray(cursor, contentEnd).toString('utf8');
        const lineEndByte = hasNewline ? lineEnd + 1 : lineEnd;
        lines.push({
            startByte: cursor,
            contentEndByte: contentEnd,
            lineEndByte,
            text,
        });
        if (!hasNewline) {
            break;
        }
        cursor = lineEnd + 1;
        if (cursor === contentBuffer.length) {
            lines.push({
                startByte: cursor,
                contentEndByte: cursor,
                lineEndByte: cursor,
                text: '',
            });
            break;
        }
    }
    return lines;
}

function buildLegacyIndexPayload(contentBuffer: Buffer): WorkerIndexPayload {
    const lines = parseLinesFromBuffer(contentBuffer);
    const blocks: MarkdownBlockRange[] = [];
    let blockId = 0;
    let lineIndex = 0;

    const pushBlock = (
        type: string,
        startLineIndex: number,
        endLineIndex: number,
        anchorId?: string
    ): void => {
        if (startLineIndex < 0 || endLineIndex < startLineIndex || startLineIndex >= lines.length) {
            return;
        }
        const safeEndLineIndex = Math.min(endLineIndex, lines.length - 1);
        const startByte = lines[startLineIndex].startByte;
        const endByte = lines[safeEndLineIndex].lineEndByte;
        if (endByte < startByte) {
            return;
        }
        blocks.push({
            id: blockId,
            type,
            startByte,
            endByte,
            startLine: startLineIndex + 1,
            endLine: safeEndLineIndex + 1,
            ...(anchorId ? { anchorId } : {}),
        });
        blockId += 1;
    };

    while (lineIndex < lines.length) {
        const entry = lines[lineIndex];
        const trimmed = entry.text.trim();
        if (!trimmed) {
            lineIndex += 1;
            continue;
        }

        if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
            const marker = trimmed.startsWith('```') ? '```' : '~~~';
            const start = lineIndex;
            lineIndex += 1;
            while (lineIndex < lines.length) {
                const candidate = lines[lineIndex].text.trim();
                if (candidate.startsWith(marker)) {
                    lineIndex += 1;
                    break;
                }
                lineIndex += 1;
            }
            pushBlock('code', start, Math.max(start, lineIndex - 1));
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const headingText = headingMatch[2].trim();
            const anchorId = slugifyHeading(headingText);
            pushBlock('heading', lineIndex, lineIndex, anchorId || undefined);
            lineIndex += 1;
            continue;
        }

        if (/^([-*_])\1{2,}$/.test(trimmed)) {
            pushBlock('rule', lineIndex, lineIndex);
            lineIndex += 1;
            continue;
        }

        if (/^\s*(?:[-*+]|\d+\.)\s+/.test(entry.text)) {
            const start = lineIndex;
            lineIndex += 1;
            while (lineIndex < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[lineIndex].text)) {
                lineIndex += 1;
            }
            pushBlock('list', start, Math.max(start, lineIndex - 1));
            continue;
        }

        if (trimmed.startsWith('>')) {
            const start = lineIndex;
            lineIndex += 1;
            while (lineIndex < lines.length && lines[lineIndex].text.trim().startsWith('>')) {
                lineIndex += 1;
            }
            pushBlock('blockquote', start, Math.max(start, lineIndex - 1));
            continue;
        }

        const paragraphStart = lineIndex;
        lineIndex += 1;
        while (lineIndex < lines.length) {
            const nextTrimmed = lines[lineIndex].text.trim();
            if (!nextTrimmed) {
                break;
            }
            if (
                nextTrimmed.startsWith('```')
                || nextTrimmed.startsWith('~~~')
                || nextTrimmed.startsWith('>')
                || /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[lineIndex].text)
                || /^(#{1,6})\s+(.+)$/.test(nextTrimmed)
                || /^([-*_])\1{2,}$/.test(nextTrimmed)
            ) {
                break;
            }
            lineIndex += 1;
        }
        pushBlock('paragraph', paragraphStart, Math.max(paragraphStart, lineIndex - 1));
    }

    const anchors: MarkdownAnchor[] = [];
    const wikiLinks: MarkdownWikiLink[] = [];
    for (const block of blocks) {
        const blockBuffer = contentBuffer.subarray(block.startByte, block.endByte);
        const blockText = blockBuffer.toString('utf8');
        const lineOffset = block.startLine - 1;

        if (block.type === 'heading') {
            const headingText = blockText.replace(/^\s*#{1,6}\s+/, '').trim();
            const anchorId = block.anchorId || slugifyHeading(headingText);
            if (anchorId) {
                anchors.push({
                    anchorId,
                    text: headingText,
                    blockId: block.id,
                    startByte: block.startByte,
                    endByte: block.endByte,
                    startLine: block.startLine,
                    endLine: block.endLine,
                });
                block.anchorId = anchorId;
            }
        }

        for (const match of blockText.matchAll(WIKI_LINK_PATTERN)) {
            const raw = String(match[0] || '').trim();
            const fileTarget = String(match[1] || '').trim();
            const heading = String(match[2] || '').trim();
            const alias = String(match[3] || '').trim();
            if (!raw || !fileTarget) {
                continue;
            }

            const matchStartInBlock = Number(match.index || 0);
            const beforeBytes = Buffer.byteLength(blockText.slice(0, matchStartInBlock), 'utf8');
            const startByte = block.startByte + beforeBytes;
            const beforeLines = blockText.slice(0, matchStartInBlock).split(/\r?\n/).length - 1;
            const startLine = lineOffset + beforeLines + 1;
            wikiLinks.push({
                raw,
                wikiTarget: raw,
                fileTarget,
                heading,
                alias,
                blockId: block.id,
                startByte,
                startLine,
            });
        }
    }

    return {
        totalBytes: contentBuffer.length,
        totalLines: lines.length,
        blocks,
        anchors,
        wikiLinks,
    };
}

function getHostWorkerBinaryName(): string | null {
    if (process.platform === 'win32' && process.arch === 'x64') {
        return 'markdown-worker-x86_64-pc-windows-msvc.exe';
    }
    if (process.platform === 'linux' && process.arch === 'x64') {
        return 'markdown-worker-x86_64-unknown-linux-gnu';
    }
    if (process.platform === 'darwin' && process.arch === 'arm64') {
        return 'markdown-worker-aarch64-apple-darwin';
    }
    if (process.platform === 'darwin' && process.arch === 'x64') {
        return 'markdown-worker-x86_64-apple-darwin';
    }
    return null;
}

function sanitizeWorkerJson(rawOutput: string): string {
    const output = String(rawOutput || '').trim();
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd >= jsonStart) {
        return output.slice(jsonStart, jsonEnd + 1);
    }
    return output;
}

export class MarkdownGateway {
    private readonly options: MarkdownGatewayOptions;

    private readonly indexById = new Map<string, IndexedDocumentRecord>();

    private readonly indexIdByCacheKey = new Map<string, string>();

    private fileCatalogCache: CachedFileCatalog | null = null;

    private readonly contentBufferCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

    constructor(options: MarkdownGatewayOptions) {
        this.options = options;
    }

    async buildIndex(request: MarkdownIndexRequest, runtimeLike: unknown): Promise<MarkdownIndexResult> {
        const runtime = normalizeMarkdownRuntimeConfig(runtimeLike);
        const forceRebuild = request.forceRebuild === true;
        const filePath = await this.options.resolveMarkdownPath(String(request.filePath || ''));
        const fileStat = await fs.promises.stat(filePath);
        if (!fileStat.isFile()) {
            throw new Error('Requested Markdown path is not a file.');
        }
        if (!MARKDOWN_FILE_PATTERN.test(filePath)) {
            throw new Error('Only Markdown files (.md/.markdown) are supported by the markdown index API.');
        }
        if (fileStat.size > runtime.maxDocBytes) {
            throw new Error(
                `Document exceeds configured max_doc_bytes (${fileStat.size} > ${runtime.maxDocBytes}).`
            );
        }

        this.evictExpiredCaches();
        const contentBuffer = await fs.promises.readFile(filePath);
        const fileVersion = computeFileVersionHash(filePath, fileStat, contentBuffer);
        const preferredEngine: 'legacy' | 'pulldown' =
            runtime.markdownEngine === 'legacy' ? 'legacy' : 'pulldown';
        const preferredCacheKey = makeCacheKey(filePath, fileVersion, preferredEngine);

        if (!forceRebuild) {
            const cachedPreferred = this.indexIdByCacheKey.get(preferredCacheKey);
            if (cachedPreferred) {
                const cachedRecord = this.indexById.get(cachedPreferred);
                if (cachedRecord && cachedRecord.expiresAt >= Date.now()) {
                    return this.toIndexResult(cachedRecord, runtime.chunkBlockSize);
                }
            }

            if (runtime.markdownEngine === 'auto') {
                const legacyKey = makeCacheKey(filePath, fileVersion, 'legacy');
                const cachedLegacyId = this.indexIdByCacheKey.get(legacyKey);
                if (cachedLegacyId) {
                    const cachedLegacy = this.indexById.get(cachedLegacyId);
                    if (cachedLegacy && cachedLegacy.expiresAt >= Date.now()) {
                        return this.toIndexResult(cachedLegacy, runtime.chunkBlockSize);
                    }
                }
            }
        }

        let fallbackReason = '';
        let engineUsed: 'legacy' | 'pulldown' = preferredEngine;
        let payload: WorkerIndexPayload;
        try {
            if (preferredEngine === 'pulldown') {
                payload = await this.buildPulldownIndexPayload(filePath, contentBuffer);
            } else {
                payload = buildLegacyIndexPayload(contentBuffer);
            }
        } catch (error) {
            if (preferredEngine === 'pulldown') {
                fallbackReason = String((error as Error)?.message || 'pulldown worker failed');
                this.options.logger?.warn?.(
                    '[MarkdownGateway] Pulldown worker failed. Falling back to legacy parser.',
                    fallbackReason
                );
                payload = buildLegacyIndexPayload(contentBuffer);
                engineUsed = 'legacy';
            } else {
                throw error;
            }
        }

        const cacheKey = makeCacheKey(filePath, fileVersion, engineUsed);
        const indexId = makeIndexId(cacheKey);
        const expiresAt = Date.now() + (runtime.indexCacheTtlSec * 1000);
        const record: IndexedDocumentRecord = {
            indexId,
            cacheKey,
            filePath,
            fileVersion,
            engine: engineUsed,
            totalBytes: payload.totalBytes,
            totalLines: payload.totalLines,
            blocks: payload.blocks,
            anchors: payload.anchors,
            wikiLinks: payload.wikiLinks,
            createdAt: Date.now(),
            expiresAt,
            ...(fallbackReason ? { fallbackReason } : {}),
            contentBuffer,
        };

        this.indexById.set(indexId, record);
        this.indexIdByCacheKey.set(cacheKey, indexId);
        if (engineUsed === 'legacy' && runtime.markdownEngine === 'auto') {
            const preferredPulldownKey = makeCacheKey(filePath, fileVersion, 'pulldown');
            this.indexIdByCacheKey.set(preferredPulldownKey, indexId);
        }
        this.contentBufferCache.set(
            `${filePath}|${fileVersion}`,
            {
                buffer: contentBuffer,
                expiresAt: Date.now() + CONTENT_CACHE_TTL_MS,
            }
        );

        return this.toIndexResult(record, runtime.chunkBlockSize);
    }

    async getChunk(request: MarkdownChunkRequest): Promise<MarkdownChunkResult> {
        this.evictExpiredCaches();
        const indexId = String(request.indexId || '').trim();
        if (!indexId) {
            throw new Error('indexId is required.');
        }
        const record = this.indexById.get(indexId);
        if (!record || record.expiresAt < Date.now()) {
            throw new Error('Markdown index is missing or expired. Rebuild index before requesting chunks.');
        }

        const startBlock = Math.max(0, Number(request.startBlock) || 0);
        const blockCount = Math.max(1, Math.min(4096, Number(request.blockCount) || 1));
        const selected = record.blocks.slice(startBlock, startBlock + blockCount);
        const contentBuffer = await this.loadContentBuffer(record.filePath, record.fileVersion, record.contentBuffer);

        const blocks: MarkdownBlock[] = selected.map((block) => {
            const safeStart = Math.max(0, Math.min(contentBuffer.length, block.startByte));
            const safeEnd = Math.max(safeStart, Math.min(contentBuffer.length, block.endByte));
            const text = contentBuffer.subarray(safeStart, safeEnd).toString('utf8');
            return {
                ...block,
                text,
                inlines: [],
            };
        });

        const nextStartBlock = startBlock + blocks.length;
        return {
            blocks,
            nextStartBlock,
            hasMore: nextStartBlock < record.blocks.length,
            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
        };
    }

    async resolveNode(request: MarkdownResolveNodeRequest, runtimeLike: unknown): Promise<MarkdownResolveNodeResult> {
        const runtime = normalizeMarkdownRuntimeConfig(runtimeLike);
        const nodeId = String(request.nodeId || '').trim();
        if (!nodeId) {
            throw new Error('nodeId is required.');
        }

        let currentFilePath = '';
        if (request.currentFilePath) {
            try {
                currentFilePath = await this.options.resolveMarkdownPath(String(request.currentFilePath));
            } catch (_error) {
                currentFilePath = '';
            }
        }

        if (currentFilePath) {
            const currentIndex = await this.buildIndex({ filePath: currentFilePath }, runtime);
            const currentRecord = this.indexById.get(currentIndex.indexId);
            if (currentRecord) {
                const currentAnchor = this.findAnchorInRecord(currentRecord, nodeId);
                if (currentAnchor) {
                    return {
                        filePath: currentRecord.filePath,
                        indexId: currentRecord.indexId,
                        targetBlockId: currentAnchor.blockId,
                        startLine: currentAnchor.startLine,
                        endLine: currentAnchor.endLine,
                        anchorId: currentAnchor.anchorId,
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    };
                }
            }
        }

        const explicitPathCandidate = await this.tryResolveNodePathCandidate(nodeId, currentFilePath);
        const discoveredPath = explicitPathCandidate || await this.findMarkdownFileByNodeId(nodeId);
        const fallbackPath = discoveredPath || currentFilePath;
        if (!fallbackPath) {
            throw new Error(`Unable to resolve node '${nodeId}' to a markdown document.`);
        }

        const indexResult = await this.buildIndex({ filePath: fallbackPath }, runtime);
        const record = this.indexById.get(indexResult.indexId);
        if (!record || record.blocks.length === 0) {
            throw new Error('Resolved document has no readable markdown blocks.');
        }

        const directAnchor = this.findAnchorInRecord(record, nodeId);
        const targetAnchor = directAnchor || record.anchors[0] || null;
        const targetBlock = targetAnchor
            ? record.blocks.find((block) => block.id === targetAnchor.blockId) || record.blocks[0]
            : record.blocks[0];

        return {
            filePath: record.filePath,
            indexId: record.indexId,
            targetBlockId: targetBlock.id,
            startLine: targetBlock.startLine,
            endLine: targetBlock.endLine,
            ...(targetAnchor ? { anchorId: targetAnchor.anchorId } : {}),
            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
        };
    }

    async resolveWiki(request: MarkdownResolveWikiRequest, runtimeLike: unknown): Promise<MarkdownResolveWikiResult> {
        const runtime = normalizeMarkdownRuntimeConfig(runtimeLike);
        const parsedTarget = parseWikiTarget(request.wikiTarget);
        const currentFilePath = await this.options.resolveMarkdownPath(String(request.currentFilePath || ''));
        const currentIndex = await this.buildIndex({ filePath: currentFilePath }, runtime);
        const currentRecord = this.indexById.get(currentIndex.indexId);

        let matchType: MarkdownWikiMatchType = 'fallback';
        let targetPath = '';
        let candidates: string[] = [];

        if (parsedTarget.fileTarget) {
            const exactPath = await this.tryResolveNodePathCandidate(parsedTarget.fileTarget, currentFilePath);
            if (exactPath) {
                matchType = 'exact';
                targetPath = exactPath;
            }
        }

        if (!targetPath && parsedTarget.fileTarget && currentRecord) {
            const aliasMatches = currentRecord.wikiLinks
                .filter((item) => normalizeLookupKey(item.alias) === normalizeLookupKey(parsedTarget.fileTarget))
                .map((item) => item.fileTarget);
            for (const aliasTarget of aliasMatches) {
                const aliasPath = await this.tryResolveNodePathCandidate(aliasTarget, currentFilePath);
                if (aliasPath) {
                    matchType = 'alias';
                    targetPath = aliasPath;
                    break;
                }
            }
        }

        if (!targetPath && !parsedTarget.fileTarget && parsedTarget.heading) {
            matchType = 'heading';
            targetPath = currentFilePath;
        }

        if (!targetPath && parsedTarget.fileTarget) {
            const discovered = await this.findMarkdownFilesByFuzzyKey(parsedTarget.fileTarget);
            if (discovered.length > 0) {
                targetPath = discovered[0];
                matchType = 'fallback';
                candidates = discovered.slice(0, 10);
            }
        }

        if (!targetPath) {
            targetPath = currentFilePath;
            matchType = parsedTarget.heading ? 'heading' : 'fallback';
        }

        const indexResult = await this.buildIndex({ filePath: targetPath }, runtime);
        const record = this.indexById.get(indexResult.indexId);
        if (!record || record.blocks.length === 0) {
            throw new Error('Resolved wiki target has no readable markdown blocks.');
        }

        let anchor: MarkdownAnchor | undefined;
        if (parsedTarget.heading) {
            anchor = this.findAnchorInRecord(record, parsedTarget.heading) || undefined;
            if (anchor && matchType === 'fallback') {
                matchType = 'heading';
            }
        }

        const targetBlock = anchor
            ? (record.blocks.find((item) => item.id === anchor!.blockId) || record.blocks[0])
            : record.blocks[0];

        return {
            filePath: record.filePath,
            indexId: record.indexId,
            targetBlockId: targetBlock?.id,
            anchorId: anchor?.anchorId,
            matchType,
            ...(candidates.length > 0 ? { candidates } : {}),
            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
        };
    }

    private toIndexResult(record: IndexedDocumentRecord, chunkBlockSize: number): MarkdownIndexResult {
        return {
            indexId: record.indexId,
            filePath: record.filePath,
            fileVersion: record.fileVersion,
            totalBytes: record.totalBytes,
            totalLines: record.totalLines,
            blocksSummary: {
                totalBlocks: record.blocks.length,
                chunkBlockSize,
            },
            anchorsSummary: {
                count: record.anchors.length,
            },
            wikiLinksSummary: {
                count: record.wikiLinks.length,
            },
            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
            engine: record.engine,
            ...(record.fallbackReason ? { fallbackReason: record.fallbackReason } : {}),
        };
    }

    private findAnchorInRecord(record: IndexedDocumentRecord, target: string): MarkdownAnchor | null {
        const slugCandidate = slugifyHeading(target);
        const normalizedTarget = normalizeLookupKey(target);
        for (const anchor of record.anchors) {
            if (slugCandidate && anchor.anchorId === slugCandidate) {
                return anchor;
            }
            if (normalizeLookupKey(anchor.text) === normalizedTarget) {
                return anchor;
            }
        }
        return null;
    }

    private async loadContentBuffer(filePath: string, fileVersion: string, fallbackBuffer: Buffer): Promise<Buffer> {
        const key = `${filePath}|${fileVersion}`;
        const cached = this.contentBufferCache.get(key);
        if (cached && cached.expiresAt >= Date.now()) {
            return cached.buffer;
        }
        try {
            const buffer = await fs.promises.readFile(filePath);
            this.contentBufferCache.set(key, {
                buffer,
                expiresAt: Date.now() + CONTENT_CACHE_TTL_MS,
            });
            return buffer;
        } catch (_error) {
            return fallbackBuffer;
        }
    }

    private evictExpiredCaches(): void {
        const now = Date.now();
        for (const [indexId, record] of this.indexById.entries()) {
            if (record.expiresAt < now) {
                this.indexById.delete(indexId);
                this.indexIdByCacheKey.delete(record.cacheKey);
            }
        }
        for (const [cacheKey, item] of this.contentBufferCache.entries()) {
            if (item.expiresAt < now) {
                this.contentBufferCache.delete(cacheKey);
            }
        }
        if (this.fileCatalogCache && this.fileCatalogCache.expiresAt < now) {
            this.fileCatalogCache = null;
        }
    }

    private resolveWorkerPath(): string | null {
        const explicitPath = String(process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH || '').trim();
        const binaryName = getHostWorkerBinaryName();
        const candidates: string[] = [];
        if (explicitPath) {
            candidates.push(path.resolve(explicitPath));
        }
        if (binaryName) {
            candidates.push(path.join(this.options.projectRoot, 'src-tauri', 'bin', binaryName));
            candidates.push(path.join(path.dirname(process.execPath), binaryName));
            candidates.push(path.join(path.dirname(process.execPath), '..', 'Resources', binaryName));
        }

        for (const candidate of candidates) {
            try {
                if (!candidate) {
                    continue;
                }
                const stat = fs.statSync(candidate);
                if (stat.isFile() && stat.size > 0) {
                    return candidate;
                }
            } catch (_error) {
                // Try next candidate.
            }
        }

        return null;
    }

    private async buildPulldownIndexPayload(filePath: string, contentBuffer: Buffer): Promise<WorkerIndexPayload> {
        const workerPath = this.resolveWorkerPath();
        if (!workerPath) {
            throw new Error('Pulldown markdown worker binary is unavailable.');
        }

        const requestPayload = JSON.stringify({
            kind: 'build_index',
            filePath,
        });

        const timeoutMs = Math.max(
            5_000,
            Number(process.env.NOTE_CONNECTION_MARKDOWN_WORKER_TIMEOUT_MS || MARKDOWN_WORKER_TIMEOUT_MS)
        );

        const result = await new Promise<{
            code: number | null;
            stdout: string;
            stderr: string;
        }>((resolve, reject) => {
            const child = spawn(workerPath, [], {
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error(`Pulldown worker timed out after ${timeoutMs}ms.`));
            }, timeoutMs);

            child.stdout.on('data', (chunk) => {
                stdout += String(chunk || '');
            });
            child.stderr.on('data', (chunk) => {
                stderr += String(chunk || '');
            });
            child.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ code, stdout, stderr });
            });

            child.stdin.write(requestPayload);
            child.stdin.end();
        });

        const parsedOutputText = sanitizeWorkerJson(result.stdout);
        let parsedOutput: any = null;
        if (parsedOutputText) {
            try {
                parsedOutput = JSON.parse(parsedOutputText);
            } catch (error) {
                throw new Error(
                    `Failed to parse pulldown worker response: ${String((error as Error)?.message || error)}`
                );
            }
        }

        if (!parsedOutput || parsedOutput.ok !== true) {
            const workerError = parsedOutput?.error || result.stderr || `Worker exited with code ${result.code}`;
            throw new Error(String(workerError));
        }

        const indexPayload = parsedOutput.index || {};
        const blocks = Array.isArray(indexPayload.blocks) ? indexPayload.blocks : [];
        const anchors = Array.isArray(indexPayload.anchors) ? indexPayload.anchors : [];
        const wikiLinks = Array.isArray(indexPayload.wikiLinks) ? indexPayload.wikiLinks : [];

        const normalizedPayload: WorkerIndexPayload = {
            totalBytes: Number(indexPayload.totalBytes) || contentBuffer.length,
            totalLines: Number(indexPayload.totalLines) || contentBuffer.toString('utf8').split(/\r?\n/).length,
            blocks: blocks
                .map((block: any, idx: number) => {
                    const startByte = Math.max(0, Number(block.startByte) || 0);
                    const endByte = Math.max(startByte, Number(block.endByte) || startByte);
                    return {
                        id: Number.isFinite(Number(block.id)) ? Number(block.id) : idx,
                        type: String(block.type || 'paragraph'),
                        startByte,
                        endByte,
                        startLine: Math.max(1, Number(block.startLine) || 1),
                        endLine: Math.max(1, Number(block.endLine) || Number(block.startLine) || 1),
                        ...(String(block.anchorId || '').trim()
                            ? { anchorId: String(block.anchorId || '').trim() }
                            : {}),
                    } as MarkdownBlockRange;
                })
                .filter((block: MarkdownBlockRange) => block.endByte >= block.startByte),
            anchors: anchors
                .map((anchor: any) => ({
                    anchorId: String(anchor.anchorId || '').trim(),
                    text: String(anchor.text || '').trim(),
                    blockId: Math.max(0, Number(anchor.blockId) || 0),
                    startByte: Math.max(0, Number(anchor.startByte) || 0),
                    endByte: Math.max(0, Number(anchor.endByte) || 0),
                    startLine: Math.max(1, Number(anchor.startLine) || 1),
                    endLine: Math.max(1, Number(anchor.endLine) || 1),
                }))
                .filter((anchor: MarkdownAnchor) => !!anchor.anchorId),
            wikiLinks: wikiLinks
                .map((wikiLink: any) => ({
                    raw: String(wikiLink.raw || '').trim(),
                    wikiTarget: String(wikiLink.wikiTarget || '').trim(),
                    fileTarget: String(wikiLink.fileTarget || '').trim(),
                    heading: String(wikiLink.heading || '').trim(),
                    alias: String(wikiLink.alias || '').trim(),
                    blockId: Math.max(0, Number(wikiLink.blockId) || 0),
                    startByte: Math.max(0, Number(wikiLink.startByte) || 0),
                    startLine: Math.max(1, Number(wikiLink.startLine) || 1),
                }))
                .filter((wikiLink: MarkdownWikiLink) => !!wikiLink.raw && !!wikiLink.fileTarget),
        };

        if (normalizedPayload.blocks.length === 0) {
            return buildLegacyIndexPayload(contentBuffer);
        }

        return normalizedPayload;
    }

    private async getMarkdownFileCatalog(): Promise<string[]> {
        this.evictExpiredCaches();
        const now = Date.now();
        if (this.fileCatalogCache && this.fileCatalogCache.expiresAt >= now) {
            return [...this.fileCatalogCache.files];
        }

        const kbRoot = await Promise.resolve(this.options.getKnowledgeBaseRoot());
        const stack = [kbRoot];
        const files: string[] = [];
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) {
                continue;
            }
            let entries: fs.Dirent[] = [];
            try {
                entries = await fs.promises.readdir(current, { withFileTypes: true });
            } catch (_error) {
                continue;
            }
            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                    continue;
                }
                if (!entry.isFile()) {
                    continue;
                }
                if (MARKDOWN_FILE_PATTERN.test(entry.name)) {
                    files.push(fullPath);
                }
            }
        }

        files.sort((left, right) => left.localeCompare(right));
        this.fileCatalogCache = {
            files,
            expiresAt: now + 60_000,
        };
        return [...files];
    }

    private async findMarkdownFilesByFuzzyKey(rawValue: string): Promise<string[]> {
        const normalized = normalizeLookupKey(rawValue);
        if (!normalized) {
            return [];
        }
        const files = await this.getMarkdownFileCatalog();
        const exact: string[] = [];
        const fuzzy: string[] = [];
        for (const filePath of files) {
            const basename = path.basename(filePath, path.extname(filePath));
            const basenameKey = normalizeLookupKey(basename);
            if (basenameKey === normalized) {
                exact.push(filePath);
                continue;
            }
            if (basenameKey.includes(normalized) || normalized.includes(basenameKey)) {
                fuzzy.push(filePath);
            }
        }
        return [...exact, ...fuzzy];
    }

    private async findMarkdownFileByNodeId(nodeId: string): Promise<string> {
        const candidates = await this.findMarkdownFilesByFuzzyKey(nodeId);
        return candidates[0] || '';
    }

    private async tryResolveNodePathCandidate(rawCandidate: string, currentFilePath: string): Promise<string> {
        const candidate = String(rawCandidate || '').trim();
        if (!candidate) {
            return '';
        }

        const candidateVariants = new Set<string>();
        candidateVariants.add(candidate);
        if (!MARKDOWN_FILE_PATTERN.test(candidate)) {
            candidateVariants.add(`${candidate}.md`);
            candidateVariants.add(`${candidate}.markdown`);
        }

        if (currentFilePath) {
            const currentDir = path.dirname(currentFilePath);
            candidateVariants.add(path.resolve(currentDir, candidate));
            if (!MARKDOWN_FILE_PATTERN.test(candidate)) {
                candidateVariants.add(path.resolve(currentDir, `${candidate}.md`));
                candidateVariants.add(path.resolve(currentDir, `${candidate}.markdown`));
            }
        }

        for (const variant of candidateVariants) {
            try {
                const resolved = await this.options.resolveMarkdownPath(variant);
                if (MARKDOWN_FILE_PATTERN.test(resolved)) {
                    return resolved;
                }
            } catch (_error) {
                // Try next variant.
            }
        }
        return '';
    }
}
