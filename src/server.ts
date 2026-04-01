#!/usr/bin/env node
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as readline from 'readline';
import { once } from 'events';
import { buildGraph } from './index';
import { CrashLogger } from './backend/utils/CrashLogger';
import { PathBridge } from './core/PathBridge';
import { GraphMetrics } from './backend/GraphMetrics';
import { LayoutEngine } from './backend/algorithms/LayoutEngine';
import { WasmParityRuntime } from './backend/algorithms/WasmParityRuntime';
import { resolveRuntimePaths } from './utils/RuntimePaths';
import { renderMathPng, renderMermaidPng } from './reader_renderer';
import { copyPngToClipboard } from './native_clipboard';
import {
    DEFAULT_SETTINGS as DEFAULT_NOTEMD_SETTINGS,
    LlmProviderClient,
    NotemdService,
    type NotemdSettings,
    type ProgressEvent,
    type ProgressReporter,
} from './notemd';
import {
    applyFrontendSettingsToAppConfig,
    applyPathModeSettingsToAppConfig,
    applyNotemdSettingsToAppConfig,
    extractFrontendSettingsFromAppConfig,
    extractPathModeSettingsFromAppConfig,
    extractNotemdSettingsFromAppConfig,
    loadAppConfigToml,
    type FrontendSettings,
    type PathModeSettings,
    saveAppConfigToml,
} from './notemd/AppConfigToml';
import {
    MarkdownGateway,
    MARKDOWN_PROTOCOL_VERSION,
    normalizeMarkdownRuntimeConfig,
} from './markdown/MarkdownGateway';
import {
    createKnowledgeLearningPlatform,
    createFileBackedKnowledgeGraphStore,
    type KnowledgeIngestRequest,
    type KnowledgeQueryRequest,
    type LearningQualityEvaluationRequest,
    type LearningPathRequest,
    type MasteryDiagnosticsRequest,
    type MemoryPolicyRequest,
    type TutorActionRequest,
} from './learning';

type WritableProcessStream = NodeJS.WriteStream & {
    __noteConnectionBrokenPipeGuardInstalled?: boolean;
};

function installBrokenPipeGuard(stream: WritableProcessStream | undefined): void {
    if (!stream || stream.__noteConnectionBrokenPipeGuardInstalled) {
        return;
    }
    stream.__noteConnectionBrokenPipeGuardInstalled = true;
    stream.on('error', (error: NodeJS.ErrnoException) => {
        if (error?.code === 'EPIPE' || error?.code === 'ERR_STREAM_DESTROYED') {
            return;
        }
        throw error;
    });
}

installBrokenPipeGuard(process.stdout as WritableProcessStream);
installBrokenPipeGuard(process.stderr as WritableProcessStream);

const IS_JEST_RUNTIME = String(process.env.JEST_WORKER_ID || '').trim().length > 0;

function logDiagnostic(...args: unknown[]): void {
    if (IS_JEST_RUNTIME) {
        return;
    }
    console.log(...args);
}

function warnDiagnostic(...args: unknown[]): void {
    if (IS_JEST_RUNTIME) {
        return;
    }
    console.warn(...args);
}

type GuardedSocketPrototype = typeof net.Socket.prototype & {
    __noteConnectionBrokenPipeGuardInstalled?: boolean;
};

function installJestSocketBrokenPipeGuard(): void {
    if (!IS_JEST_RUNTIME) {
        return;
    }
    const socketPrototype = net.Socket.prototype as GuardedSocketPrototype;
    if (socketPrototype.__noteConnectionBrokenPipeGuardInstalled) {
        return;
    }

    const originalEmit = socketPrototype.emit;
    socketPrototype.__noteConnectionBrokenPipeGuardInstalled = true;
    socketPrototype.emit = function (this: net.Socket, event: string | symbol, ...args: unknown[]): boolean {
        if (
            event === 'error'
            && CrashLogger.isIgnorableProcessWriteError(args[0])
            && (this.destroyed || this.writable === false)
        ) {
            return true;
        }
        return originalEmit.call(this, event, ...args);
    };
}

installJestSocketBrokenPipeGuard();

// Initialize Global Crash Handlers
CrashLogger.initGlobalHandlers();

const LOOPBACK_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.NOTE_CONNECTION_PORT || process.env.PORT || DEFAULT_PORT);
const PATH_BRIDGE_PORT = Number(process.env.NOTE_CONNECTION_BRIDGE_PORT || 9876);
const AUTH_TOKEN = String(process.env.NOTE_CONNECTION_AUTH_TOKEN || '').trim();
let pathBridge: PathBridge | null = null;
const MEBIBYTE_BYTES = 1024 * 1024;
const REQUEST_BODY_LIMIT_BYTES = 512 * 1024;
const REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB = {
    min: 64,
    max: 8192,
    default: 256
} as const;
const REQUEST_BODY_SPOOL_LARGE_GRAPH_KB = 1024;
const REQUEST_BODY_SPOOL_EXTREME_GRAPH_KB = 2048;
const REQUEST_BODY_LARGE_GRAPH_NODE_THRESHOLD = 5000;
const REQUEST_BODY_EXTREME_GRAPH_NODE_THRESHOLD = 20000;
const REQUEST_BODY_LARGE_GRAPH_EDGE_THRESHOLD = 500000;
const REQUEST_BODY_EXTREME_GRAPH_EDGE_THRESHOLD = 2000000;
const CLIPBOARD_BODY_LIMIT_RANGE_MB = {
    min: 1,
    max: 512,
    default: 64
} as const;
const CLIPBOARD_BODY_LIMIT_MB = resolveBoundedMegabytesFromEnv({
    envKey: 'NOTE_CONNECTION_CLIPBOARD_BODY_LIMIT_MB',
    defaultMb: CLIPBOARD_BODY_LIMIT_RANGE_MB.default,
    minMb: CLIPBOARD_BODY_LIMIT_RANGE_MB.min,
    maxMb: CLIPBOARD_BODY_LIMIT_RANGE_MB.max
});
const CLIPBOARD_BODY_LIMIT_BYTES = CLIPBOARD_BODY_LIMIT_MB * MEBIBYTE_BYTES;
const REQUEST_BODY_SPOOL_THRESHOLD_POLICY = resolveRequestBodySpoolThresholdPolicy(process.env);
const REQUEST_BODY_SPOOL_THRESHOLD_BYTES = REQUEST_BODY_SPOOL_THRESHOLD_POLICY.selectedBytes;
const ALLOWED_ORIGIN_PATTERNS = parseAllowedOrigins(
    process.env.NOTE_CONNECTION_ALLOWED_ORIGINS ||
    'tauri://localhost,http://tauri.localhost,http://localhost,http://127.0.0.1,capacitor://localhost'
);
const FORCE_FRONTEND_MERMAID_RENDER = String(process.env.NOTE_CONNECTION_READER_FRONTEND_MERMAID || '').trim() === '1';
const runtimePaths = resolveRuntimePaths(__dirname);
const FRONTEND_DIR = runtimePaths.frontendDir;
const RUNTIME_DATA_DIR = runtimePaths.runtimeDataDir;
const REQUEST_BODY_SPOOL_DIR = path.join(runtimePaths.projectRoot, 'tmp', 'request-bodies');
let KB_ROOT = runtimePaths.kbRoot;
let activeBuildKey: string | null = null;
let activeBuildPromise: Promise<void> | null = null;
let lastRestoreKey: string | null = null;
let lastRestoreTs = 0;
const SIDECAR_RUNTIME_MANIFEST = path.join(runtimePaths.projectRoot, 'tmp', 'active-sidecar-runtime.json');
const notemdService = new NotemdService();
const notemdLlmClient = new LlmProviderClient();
const KNOWLEDGE_GRAPH_STORE_PATH = path.join(RUNTIME_DATA_DIR, 'knowledge_graph_store.v1.json');
const knowledgeGraphStore = createFileBackedKnowledgeGraphStore({
    filePath: KNOWLEDGE_GRAPH_STORE_PATH,
});
const knowledgeLearningPlatform = createKnowledgeLearningPlatform({
    store: knowledgeGraphStore,
});
let cachedNotemdSettings: NotemdSettings | null = null;
let cachedPathModeSettings: PathModeSettings | null = null;
let cachedFrontendSettings: FrontendSettings | null = null;
const markdownGateway = new MarkdownGateway({
    projectRoot: runtimePaths.projectRoot,
    getKnowledgeBaseRoot: () => KB_ROOT,
    resolveMarkdownPath: async (rawPath: string) => resolvePathWithinKnowledgeBase(rawPath, {
        expectedType: 'file',
    }),
    logger: {
        info: (...args: unknown[]) => logDiagnostic(...args),
        warn: (...args: unknown[]) => warnDiagnostic(...args),
    },
});

type NotemdOperationState = {
    id: string;
    controller: AbortController;
    status: 'running' | 'done' | 'cancelled' | 'error';
    createdAt: number;
    updatedAt: number;
    logs: ProgressEvent[];
};

const NOTEMD_ACTIVE_OPERATIONS = new Map<string, NotemdOperationState>();

type MermaidRendererPreference = 'auto' | 'local' | 'frontend';

type ReadJsonBodyOptions = {
    maxBytes?: number;
    spoolThresholdBytes?: number;
};

type ReadBinaryBodyOptions = {
    maxBytes?: number;
    spoolThresholdBytes?: number;
};

function collectComputeModeSnapshot() {
    return {
        layoutEngine: LayoutEngine.getLastComputeDiagnostics(),
        graphMetrics: GraphMetrics.getLastComputeDiagnostics()
    };
}

type BoundedMegabyteEnvOptions = {
    envKey: string;
    defaultMb: number;
    minMb: number;
    maxMb: number;
};

type RequestBodySpoolThresholdPolicy = {
    selectedKiB: number;
    selectedBytes: number;
    recommendedKiB: number;
    source: 'default' | 'configured' | 'configured-strict' | 'auto-raised';
    strictMode: boolean;
    workloadHint: {
        expectedNodeCount: number;
        expectedEdgeCount: number;
        scale: 'default' | 'large' | 'xlarge' | 'huge';
    };
};

function resolveBoundedMegabytesFromEnv(options: BoundedMegabyteEnvOptions): number {
    const envKey = String(options.envKey || '').trim();
    const defaultMb = Math.max(1, Math.floor(Number(options.defaultMb) || 1));
    const minMb = Math.max(1, Math.floor(Number(options.minMb) || 1));
    const maxMb = Math.max(minMb, Math.floor(Number(options.maxMb) || minMb));
    if (!envKey) {
        return defaultMb;
    }

    const rawValue = String(process.env[envKey] || '').trim();
    if (!rawValue) {
        return defaultMb;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        warnDiagnostic(`[Config] ${envKey} is not a number ("${rawValue}"). Using default ${defaultMb} MiB.`);
        return defaultMb;
    }

    const normalizedMb = Math.floor(parsedValue);
    if (normalizedMb < minMb) {
        warnDiagnostic(`[Config] ${envKey}=${rawValue} is below minimum ${minMb} MiB. Clamping to ${minMb} MiB.`);
        return minMb;
    }
    if (normalizedMb > maxMb) {
        warnDiagnostic(`[Config] ${envKey}=${rawValue} exceeds maximum ${maxMb} MiB. Clamping to ${maxMb} MiB.`);
        return maxMb;
    }

    return normalizedMb;
}

function parsePositiveIntegerValue(rawValue: unknown): number {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return 0;
    }
    return Math.floor(numericValue);
}

function parseBooleanFlag(rawValue: unknown): boolean {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeGraphScaleHint(rawValue: unknown): 'default' | 'large' | 'xlarge' | 'huge' {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'large' || normalized === 'l') {
        return 'large';
    }
    if (normalized === 'xlarge' || normalized === 'xl') {
        return 'xlarge';
    }
    if (normalized === 'huge' || normalized === 'xxl' || normalized === 'extreme') {
        return 'huge';
    }
    return 'default';
}

function clampInteger(value: number, minValue: number, maxValue: number): number {
    return Math.min(maxValue, Math.max(minValue, Math.floor(value)));
}

function resolveRequestBodySpoolRecommendedKiB(workloadHint: RequestBodySpoolThresholdPolicy['workloadHint']): number {
    let recommendedKiB: number = REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.default;

    if (workloadHint.scale === 'large' || workloadHint.scale === 'xlarge') {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_LARGE_GRAPH_KB);
    } else if (workloadHint.scale === 'huge') {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_EXTREME_GRAPH_KB);
    }

    if (
        workloadHint.expectedNodeCount >= REQUEST_BODY_LARGE_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= REQUEST_BODY_LARGE_GRAPH_EDGE_THRESHOLD
    ) {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_LARGE_GRAPH_KB);
    }

    if (
        workloadHint.expectedNodeCount >= REQUEST_BODY_EXTREME_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= REQUEST_BODY_EXTREME_GRAPH_EDGE_THRESHOLD
    ) {
        recommendedKiB = Math.max(recommendedKiB, REQUEST_BODY_SPOOL_EXTREME_GRAPH_KB);
    }

    return clampInteger(
        recommendedKiB,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.min,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.max
    );
}

function resolveRequestBodySpoolThresholdPolicy(env: NodeJS.ProcessEnv): RequestBodySpoolThresholdPolicy {
    const workloadHint = {
        expectedNodeCount: parsePositiveIntegerValue(env.NOTE_CONNECTION_EXPECTED_NODE_COUNT),
        expectedEdgeCount: parsePositiveIntegerValue(env.NOTE_CONNECTION_EXPECTED_EDGE_COUNT),
        scale: normalizeGraphScaleHint(env.NOTE_CONNECTION_GRAPH_SCALE)
    } as const;
    const recommendedKiB = resolveRequestBodySpoolRecommendedKiB(workloadHint);
    const strictMode = parseBooleanFlag(env.NOTE_CONNECTION_REQUEST_BODY_SPOOL_STRICT);
    const configuredKiB = parsePositiveIntegerValue(env.NOTE_CONNECTION_REQUEST_BODY_SPOOL_THRESHOLD_KB);

    if (configuredKiB <= 0) {
        return {
            selectedKiB: recommendedKiB,
            selectedBytes: recommendedKiB * 1024,
            recommendedKiB,
            source: recommendedKiB > REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.default ? 'auto-raised' : 'default',
            strictMode,
            workloadHint
        };
    }

    const boundedConfiguredKiB = clampInteger(
        configuredKiB,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.min,
        REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.max
    );

    if (strictMode) {
        return {
            selectedKiB: boundedConfiguredKiB,
            selectedBytes: boundedConfiguredKiB * 1024,
            recommendedKiB,
            source: 'configured-strict',
            strictMode,
            workloadHint
        };
    }

    const selectedKiB = Math.max(boundedConfiguredKiB, recommendedKiB);
    return {
        selectedKiB,
        selectedBytes: selectedKiB * 1024,
        recommendedKiB,
        source: selectedKiB > boundedConfiguredKiB ? 'auto-raised' : 'configured',
        strictMode,
        workloadHint
    };
}

function parseAllowedOrigins(rawValue: string): string[] {
    return rawValue
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function matchesAllowedOrigin(origin: URL, pattern: string): boolean {
    try {
        const allowed = new URL(pattern);
        if (allowed.protocol !== origin.protocol || allowed.hostname !== origin.hostname) {
            return false;
        }
        if (allowed.port && allowed.port !== origin.port) {
            return false;
        }
        return true;
    } catch (_error) {
        return false;
    }
}

function isAllowedOrigin(originHeader: string | undefined): boolean {
    if (!originHeader || !originHeader.trim()) {
        return true;
    }

    try {
        const origin = new URL(originHeader);
        return ALLOWED_ORIGIN_PATTERNS.some((pattern) => matchesAllowedOrigin(origin, pattern));
    } catch (_error) {
        return false;
    }
}

function applyCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-NoteConnection-Token');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (!originHeader) {
        return true;
    }

    if (!isAllowedOrigin(originHeader)) {
        return false;
    }

    res.setHeader('Access-Control-Allow-Origin', originHeader);
    return true;
}

function getRequestPathname(req: http.IncomingMessage): string {
    try {
        const parsed = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${PORT}`);
        return parsed.pathname || '/';
    } catch (_error) {
        return '/';
    }
}

function getRequestContentType(req: http.IncomingMessage): string {
    return typeof req.headers['content-type'] === 'string'
        ? req.headers['content-type'].split(';', 1)[0].trim().toLowerCase()
        : '';
}

function getRawRequestPathname(rawUrl: string | undefined): string {
    const requestTarget = String(rawUrl || '/');
    const queryStart = requestTarget.indexOf('?');
    if (queryStart >= 0) {
        return requestTarget.slice(0, queryStart) || '/';
    }
    return requestTarget || '/';
}

function extractRequestToken(req: http.IncomingMessage): string {
    const headerToken = typeof req.headers['x-noteconnection-token'] === 'string'
        ? req.headers['x-noteconnection-token'].trim()
        : '';
    if (headerToken) {
        return headerToken;
    }

    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    return '';
}

function isProtectedRequest(req: http.IncomingMessage): boolean {
    const pathname = getRequestPathname(req);
    if (pathname.startsWith('/api/')) {
        return true;
    }

    const filename = path.basename(pathname);
    return isGeneratedGraphAsset(filename);
}

function isAuthorizedRequest(req: http.IncomingMessage): boolean {
    if (!AUTH_TOKEN || !isProtectedRequest(req)) {
        return true;
    }

    return extractRequestToken(req) === AUTH_TOKEN;
}

function isGeneratedGraphAsset(filename: string): boolean {
    return (
        filename === 'data.js' ||
        filename === 'graph_data.json' ||
        (/^data_[a-z0-9_\-]+\.js$/i).test(filename) ||
        (/^graph_data_[a-z0-9_\-]+\.json$/i).test(filename) ||
        (/^data_cli_[a-z0-9_\-]+\.js$/i).test(filename) ||
        (/^graph_data_cli_[a-z0-9_\-]+\.json$/i).test(filename)
    );
}

async function ensureRuntimeDataDir(): Promise<void> {
    await fs.promises.mkdir(RUNTIME_DATA_DIR, { recursive: true });
}

async function ensureRequestBodySpoolDir(): Promise<void> {
    await fs.promises.mkdir(REQUEST_BODY_SPOOL_DIR, { recursive: true });
}

function isFsNotFoundError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}

function isAccessDeniedError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'EACCES' || code === 'EPERM';
}

function makeAccessDeniedError(message: string): NodeJS.ErrnoException {
    const error = new Error(message) as NodeJS.ErrnoException;
    error.code = 'EACCES';
    return error;
}

function isRequestBodyTooLargeError(error: unknown): boolean {
    return error instanceof Error && error.message === 'Request body is too large.';
}

function makeRequestBodyTooLargeError(): Error {
    return new Error('Request body is too large.');
}

function generatedAssetWritePath(filename: string): string {
    return path.join(RUNTIME_DATA_DIR, filename);
}

async function isRegularFile(candidate: string): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(candidate);
        return stat.isFile();
    } catch (error) {
        if (isFsNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}

async function resolveGeneratedAssetForReadAsync(filename: string): Promise<string | null> {
    const runtimeFile = path.join(RUNTIME_DATA_DIR, filename);
    if (await isRegularFile(runtimeFile)) {
        return runtimeFile;
    }

    const bundledFile = path.join(FRONTEND_DIR, filename);
    if (await isRegularFile(bundledFile)) {
        return bundledFile;
    }

    return null;
}

async function safeUnlink(filePath: string): Promise<void> {
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (!isFsNotFoundError(error)) {
            warnDiagnostic('[Sidecar] Failed to clean up temporary request body file:', error);
        }
    }
}

function isJsonLikeContentType(req: http.IncomingMessage): boolean {
    const contentType = getRequestContentType(req);
    return !contentType || contentType === 'application/json' || contentType.endsWith('+json');
}

function isClipboardBinaryContentType(req: http.IncomingMessage): boolean {
    const contentType = getRequestContentType(req);
    return !contentType || contentType === 'application/octet-stream' || contentType === 'image/png';
}

function isPngBuffer(buffer: Buffer): boolean {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
        return false;
    }
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < pngSignature.length; i += 1) {
        if (buffer[i] !== pngSignature[i]) {
            return false;
        }
    }
    return true;
}

async function readJsonBody(req: http.IncomingMessage, options: ReadJsonBodyOptions = {}): Promise<any> {
    const maxBytes = options.maxBytes ?? REQUEST_BODY_LIMIT_BYTES;
    const spoolThresholdBytes = Math.max(
        64 * 1024,
        Math.min(options.spoolThresholdBytes ?? REQUEST_BODY_SPOOL_THRESHOLD_BYTES, maxBytes)
    );

    if (!isJsonLikeContentType(req)) {
        throw new Error('Unsupported Content-Type. Expected application/json.');
    }

    const declaredLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw makeRequestBodyTooLargeError();
    }

    let totalBytes = 0;
    const chunks: Buffer[] = [];
    let spoolPath: string | null = null;
    let spoolStream: fs.WriteStream | null = null;

    try {
        for await (const rawChunk of req) {
            const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
                const tooLargeError = makeRequestBodyTooLargeError();
                req.destroy(tooLargeError);
                throw tooLargeError;
            }

            if (!spoolStream && totalBytes > spoolThresholdBytes) {
                await ensureRequestBodySpoolDir();
                spoolPath = path.join(
                    REQUEST_BODY_SPOOL_DIR,
                    `body-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
                );
                spoolStream = fs.createWriteStream(spoolPath, { flags: 'wx' });
                for (const buffered of chunks) {
                    if (!spoolStream.write(buffered)) {
                        await once(spoolStream, 'drain');
                    }
                }
                chunks.length = 0;
            }

            if (spoolStream) {
                if (!spoolStream.write(chunk)) {
                    await once(spoolStream, 'drain');
                }
            } else {
                chunks.push(chunk);
            }
        }

        if (spoolStream) {
            await new Promise<void>((resolve, reject) => {
                if (!spoolStream) {
                    resolve();
                    return;
                }
                spoolStream.once('error', reject);
                spoolStream.end(() => resolve());
            });
        }

        const body = spoolPath
            ? await fs.promises.readFile(spoolPath, 'utf8')
            : Buffer.concat(chunks).toString('utf8');

        if (!body.trim()) {
            return {};
        }

        return JSON.parse(body);
    } finally {
        if (spoolStream && !spoolStream.closed) {
            spoolStream.destroy();
        }
        if (spoolPath) {
            await safeUnlink(spoolPath);
        }
    }
}

async function readBinaryBody(req: http.IncomingMessage, options: ReadBinaryBodyOptions = {}): Promise<Buffer> {
    const maxBytes = options.maxBytes ?? REQUEST_BODY_LIMIT_BYTES;
    const spoolThresholdBytes = Math.max(
        64 * 1024,
        Math.min(options.spoolThresholdBytes ?? REQUEST_BODY_SPOOL_THRESHOLD_BYTES, maxBytes)
    );

    if (!isClipboardBinaryContentType(req)) {
        throw new Error('Unsupported Content-Type. Expected image/png or application/octet-stream.');
    }

    const declaredLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw makeRequestBodyTooLargeError();
    }

    let totalBytes = 0;
    const chunks: Buffer[] = [];
    let spoolPath: string | null = null;
    let spoolStream: fs.WriteStream | null = null;

    try {
        for await (const rawChunk of req) {
            const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
                const tooLargeError = makeRequestBodyTooLargeError();
                req.destroy(tooLargeError);
                throw tooLargeError;
            }

            if (!spoolStream && totalBytes > spoolThresholdBytes) {
                await ensureRequestBodySpoolDir();
                spoolPath = path.join(
                    REQUEST_BODY_SPOOL_DIR,
                    `body-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`
                );
                spoolStream = fs.createWriteStream(spoolPath, { flags: 'wx' });
                for (const buffered of chunks) {
                    if (!spoolStream.write(buffered)) {
                        await once(spoolStream, 'drain');
                    }
                }
                chunks.length = 0;
            }

            if (spoolStream) {
                if (!spoolStream.write(chunk)) {
                    await once(spoolStream, 'drain');
                }
            } else {
                chunks.push(chunk);
            }
        }

        if (spoolStream) {
            await new Promise<void>((resolve, reject) => {
                if (!spoolStream) {
                    resolve();
                    return;
                }
                spoolStream.once('error', reject);
                spoolStream.end(() => resolve());
            });
        }

        return spoolPath
            ? await fs.promises.readFile(spoolPath)
            : Buffer.concat(chunks);
    } finally {
        if (spoolStream && !spoolStream.closed) {
            spoolStream.destroy();
        }
        if (spoolPath) {
            await safeUnlink(spoolPath);
        }
    }
}

function writeBodyParseErrorResponse(res: http.ServerResponse, error: unknown): boolean {
    if (isRequestBodyTooLargeError(error)) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body is too large.' }));
        return true;
    }

    if (error instanceof SyntaxError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
        return true;
    }

    if (error instanceof Error && error.message.startsWith('Unsupported Content-Type')) {
        res.writeHead(415, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return true;
    }

    return false;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneNotemdSettings(settings: NotemdSettings): NotemdSettings {
    return JSON.parse(JSON.stringify(settings)) as NotemdSettings;
}

function clampNotemdInteger(value: unknown, fallback: number, minValue: number, maxValue: number): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }
    return Math.max(minValue, Math.min(maxValue, Math.floor(numericValue)));
}

function normalizeNotemdSettings(rawValue: unknown): NotemdSettings {
    const defaults = cloneNotemdSettings(DEFAULT_NOTEMD_SETTINGS);
    if (!isObjectRecord(rawValue)) {
        return defaults;
    }

    const raw = rawValue as Partial<NotemdSettings> & Record<string, unknown>;
    const merged = {
        ...defaults,
        ...raw,
    } as NotemdSettings;

    if (Array.isArray(raw.providers)) {
        merged.providers = raw.providers
            .map((providerCandidate) => {
                if (!isObjectRecord(providerCandidate)) {
                    return null;
                }
                const providerName = String(providerCandidate.name || '').trim();
                const fallbackProvider = defaults.providers.find((provider) => provider.name === providerName);
                if (!fallbackProvider) {
                    return null;
                }
                return {
                    ...fallbackProvider,
                    ...providerCandidate,
                    name: fallbackProvider.name,
                    apiKey: String(providerCandidate.apiKey || '').trim(),
                    baseUrl: String(providerCandidate.baseUrl || fallbackProvider.baseUrl).trim(),
                    model: String(providerCandidate.model || fallbackProvider.model).trim(),
                    temperature: Number.isFinite(Number(providerCandidate.temperature))
                        ? Number(providerCandidate.temperature)
                        : fallbackProvider.temperature,
                };
            })
            .filter((provider): provider is NotemdSettings['providers'][number] => provider !== null);
    } else {
        merged.providers = defaults.providers;
    }

    const activeProviderExists = merged.providers.some((provider) => provider.name === merged.activeProvider);
    if (!activeProviderExists) {
        merged.activeProvider = defaults.activeProvider;
    }

    merged.chunkWordCount = clampNotemdInteger(raw.chunkWordCount, defaults.chunkWordCount, 300, 20000);
    merged.maxTokens = clampNotemdInteger(raw.maxTokens, defaults.maxTokens, 128, 64000);
    merged.batchConcurrency = clampNotemdInteger(raw.batchConcurrency, defaults.batchConcurrency, 1, 20);
    merged.batchSize = clampNotemdInteger(raw.batchSize, defaults.batchSize, 1, 200);
    merged.batchInterDelayMs = clampNotemdInteger(raw.batchInterDelayMs, defaults.batchInterDelayMs, 0, 600000);
    merged.apiCallIntervalMs = clampNotemdInteger(raw.apiCallIntervalMs, defaults.apiCallIntervalMs, 0, 120000);
    merged.maxRetries = clampNotemdInteger(raw.maxRetries, defaults.maxRetries, 0, 10);
    merged.retryDelayMs = clampNotemdInteger(raw.retryDelayMs, defaults.retryDelayMs, 0, 600000);

    merged.useCustomConceptNoteFolder = raw.useCustomConceptNoteFolder === true;
    merged.useCustomProcessedFileFolder = raw.useCustomProcessedFileFolder === true;
    merged.enableDuplicateDetection = raw.enableDuplicateDetection !== false;
    merged.moveOriginalFileOnProcess = raw.moveOriginalFileOnProcess === true;
    merged.enableBatchParallelism = raw.enableBatchParallelism !== false;
    merged.autoMermaidFixAfterGenerate = raw.autoMermaidFixAfterGenerate === true;
    merged.enableGlobalCustomPrompts = raw.enableGlobalCustomPrompts === true;
    merged.enableFocusedLearning = raw.enableFocusedLearning === true;
    merged.useMultiModelSettings = raw.useMultiModelSettings === true;
    merged.useCustomAddLinksSuffix = raw.useCustomAddLinksSuffix === true;
    merged.useCustomTranslationSuffix = raw.useCustomTranslationSuffix === true;
    merged.useCustomTranslationSavePath = raw.useCustomTranslationSavePath === true;
    merged.useCustomGenerateTitleOutputFolder = raw.useCustomGenerateTitleOutputFolder === true;
    merged.useDifferentLanguagesForTasks = raw.useDifferentLanguagesForTasks === true;
    merged.disableAutoTranslation = raw.disableAutoTranslation === true;
    merged.enableResearchInGenerateContent = raw.enableResearchInGenerateContent === true;
    merged.developerMode = raw.developerMode === true;

    merged.conceptNoteFolder = String(raw.conceptNoteFolder || defaults.conceptNoteFolder).trim();
    merged.processedFileFolder = String(raw.processedFileFolder || defaults.processedFileFolder).trim();
    merged.workspaceFilePath = String(raw.workspaceFilePath || defaults.workspaceFilePath).trim();
    merged.workspaceFolderPath = String(raw.workspaceFolderPath || defaults.workspaceFolderPath).trim();
    merged.workspaceOutputFilePath = String(raw.workspaceOutputFilePath || defaults.workspaceOutputFilePath).trim();
    merged.workspaceOutputFolderPath = String(raw.workspaceOutputFolderPath || defaults.workspaceOutputFolderPath).trim();
    merged.translationCustomSuffix = String(raw.translationCustomSuffix || defaults.translationCustomSuffix).trim();
    merged.translationSavePath = String(raw.translationSavePath || defaults.translationSavePath).trim();
    merged.addLinksCustomSuffix = String(raw.addLinksCustomSuffix || defaults.addLinksCustomSuffix).trim();
    merged.generateTitleOutputFolderName = String(
        raw.generateTitleOutputFolderName || defaults.generateTitleOutputFolderName
    ).trim();
    merged.focusedLearningDomain = String(raw.focusedLearningDomain || defaults.focusedLearningDomain).trim();

    if (Array.isArray(raw.availableLanguages)) {
        merged.availableLanguages = raw.availableLanguages
            .map((languageCandidate) => {
                if (!isObjectRecord(languageCandidate)) {
                    return null;
                }
                const code = String(languageCandidate.code || '').trim();
                const name = String(languageCandidate.name || '').trim();
                if (!code || !name) {
                    return null;
                }
                return { code, name };
            })
            .filter((language): language is NotemdSettings['availableLanguages'][number] => language !== null);
    } else {
        merged.availableLanguages = defaults.availableLanguages;
    }
    if (merged.availableLanguages.length === 0) {
        merged.availableLanguages = defaults.availableLanguages;
    }

    merged.language = String(raw.language || defaults.language).trim() || defaults.language;
    merged.generateTitleLanguage = String(raw.generateTitleLanguage || merged.language).trim() || merged.language;
    merged.researchSummarizeLanguage = String(raw.researchSummarizeLanguage || merged.language).trim() || merged.language;
    merged.addLinksLanguage = String(raw.addLinksLanguage || merged.language).trim() || merged.language;
    merged.summarizeToMermaidLanguage = String(raw.summarizeToMermaidLanguage || merged.language).trim() || merged.language;
    merged.extractConceptsLanguage = String(raw.extractConceptsLanguage || merged.language).trim() || merged.language;
    merged.translateLanguage = String(raw.translateLanguage || merged.language).trim() || merged.language;

    merged.addLinksModel = String(raw.addLinksModel || '').trim();
    merged.researchModel = String(raw.researchModel || '').trim();
    merged.generateTitleModel = String(raw.generateTitleModel || '').trim();
    merged.translateModel = String(raw.translateModel || '').trim();
    merged.summarizeToMermaidModel = String(raw.summarizeToMermaidModel || '').trim();
    merged.extractConceptsModel = String(raw.extractConceptsModel || '').trim();
    merged.extractOriginalTextModel = String(raw.extractOriginalTextModel || '').trim();

    if (!isObjectRecord(raw.customPrompts)) {
        merged.customPrompts = {};
    } else {
        const customPrompts = raw.customPrompts as Record<string, unknown>;
        merged.customPrompts = {};
        Object.keys(customPrompts).forEach((key) => {
            const text = String(customPrompts[key] || '').trim();
            if (text) {
                (merged.customPrompts as Record<string, string>)[key] = text;
            }
        });
    }

    return merged;
}

async function loadNotemdSettings(): Promise<NotemdSettings> {
    if (cachedNotemdSettings) {
        return cloneNotemdSettings(cachedNotemdSettings);
    }

    try {
        const appConfig = await loadAppConfigToml();
        const parsedSettings = extractNotemdSettingsFromAppConfig(appConfig);
        cachedNotemdSettings = normalizeNotemdSettings(parsedSettings);
    } catch (error) {
        warnDiagnostic('[NoteMD] Failed to read settings from TOML, using defaults:', error);
        cachedNotemdSettings = normalizeNotemdSettings(DEFAULT_NOTEMD_SETTINGS);
    }

    return cloneNotemdSettings(cachedNotemdSettings);
}

async function persistNotemdSettings(settingsLike: unknown): Promise<NotemdSettings> {
    const normalized = normalizeNotemdSettings(settingsLike);
    const appConfig = await loadAppConfigToml();
    const nextAppConfig = applyNotemdSettingsToAppConfig(appConfig, normalized);
    await saveAppConfigToml(nextAppConfig);
    cachedNotemdSettings = cloneNotemdSettings(normalized);
    return cloneNotemdSettings(normalized);
}

type NotemdWorkspaceState = {
    filePath: string;
    folderPath: string;
    outputFilePath: string;
    outputFolderPath: string;
};

function extractNotemdWorkspaceState(settings: NotemdSettings): NotemdWorkspaceState {
    return {
        filePath: String(settings.workspaceFilePath || '').trim(),
        folderPath: String(settings.workspaceFolderPath || '').trim(),
        outputFilePath: String(settings.workspaceOutputFilePath || '').trim(),
        outputFolderPath: String(settings.workspaceOutputFolderPath || '').trim(),
    };
}

function normalizeWorkspaceField(
    source: Record<string, unknown>,
    keys: string[],
    fallback: string
): string {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) {
            continue;
        }
        return String(source[key] || '').trim();
    }
    return fallback;
}

function applyWorkspacePatchToSettings(
    settings: NotemdSettings,
    workspacePatch: unknown
): NotemdSettings {
    const next = cloneNotemdSettings(settings);
    if (!isObjectRecord(workspacePatch)) {
        return next;
    }

    next.workspaceFilePath = normalizeWorkspaceField(
        workspacePatch,
        ['filePath', 'file_path', 'workspaceFilePath', 'workspace_file_path'],
        next.workspaceFilePath
    );
    next.workspaceFolderPath = normalizeWorkspaceField(
        workspacePatch,
        ['folderPath', 'folder_path', 'workspaceFolderPath', 'workspace_folder_path'],
        next.workspaceFolderPath
    );
    next.workspaceOutputFilePath = normalizeWorkspaceField(
        workspacePatch,
        ['outputFilePath', 'output_file_path', 'workspaceOutputFilePath', 'workspace_output_file_path'],
        next.workspaceOutputFilePath
    );
    next.workspaceOutputFolderPath = normalizeWorkspaceField(
        workspacePatch,
        ['outputFolderPath', 'output_folder_path', 'workspaceOutputFolderPath', 'workspace_output_folder_path'],
        next.workspaceOutputFolderPath
    );

    return next;
}

async function persistNotemdWorkspacePatch(workspacePatch: unknown): Promise<NotemdWorkspaceState> {
    const settings = await loadNotemdSettings();
    const nextSettings = applyWorkspacePatchToSettings(settings, workspacePatch);
    const persisted = await persistNotemdSettings(nextSettings);
    return extractNotemdWorkspaceState(persisted);
}

function clonePathModeSettings(settings: PathModeSettings): PathModeSettings {
    return JSON.parse(JSON.stringify(settings)) as PathModeSettings;
}

function cloneFrontendSettings(settings: FrontendSettings): FrontendSettings {
    return JSON.parse(JSON.stringify(settings)) as FrontendSettings;
}

async function loadPathModeSettings(): Promise<PathModeSettings> {
    if (cachedPathModeSettings) {
        return clonePathModeSettings(cachedPathModeSettings);
    }

    try {
        const appConfig = await loadAppConfigToml();
        cachedPathModeSettings = extractPathModeSettingsFromAppConfig(appConfig);
    } catch (error) {
        warnDiagnostic('[PathMode] Failed to read TOML settings. Falling back to defaults.', error);
        cachedPathModeSettings = extractPathModeSettingsFromAppConfig({});
    }

    return clonePathModeSettings(cachedPathModeSettings);
}

async function persistPathModeSettings(settingsLike: unknown): Promise<PathModeSettings> {
    const appConfig = await loadAppConfigToml();
    const nextAppConfig = applyPathModeSettingsToAppConfig(appConfig, settingsLike);
    await saveAppConfigToml(nextAppConfig);
    const persisted = extractPathModeSettingsFromAppConfig(nextAppConfig);
    cachedPathModeSettings = clonePathModeSettings(persisted);
    return clonePathModeSettings(persisted);
}

async function loadFrontendSettings(): Promise<FrontendSettings> {
    if (cachedFrontendSettings) {
        return cloneFrontendSettings(cachedFrontendSettings);
    }

    try {
        const appConfig = await loadAppConfigToml();
        cachedFrontendSettings = extractFrontendSettingsFromAppConfig(appConfig);
    } catch (error) {
        warnDiagnostic('[Frontend] Failed to read TOML settings. Falling back to defaults.', error);
        cachedFrontendSettings = extractFrontendSettingsFromAppConfig({});
    }

    return cloneFrontendSettings(cachedFrontendSettings);
}

async function persistFrontendSettings(settingsLike: unknown): Promise<FrontendSettings> {
    const appConfig = await loadAppConfigToml();
    const nextAppConfig = applyFrontendSettingsToAppConfig(appConfig, settingsLike);
    await saveAppConfigToml(nextAppConfig);
    const persisted = extractFrontendSettingsFromAppConfig(nextAppConfig);
    cachedFrontendSettings = cloneFrontendSettings(persisted);
    return cloneFrontendSettings(persisted);
}

function generateNotemdOperationId(): string {
    return `notemd-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createNotemdOperation(operationIdCandidate?: unknown): NotemdOperationState {
    const requestedId = String(operationIdCandidate || '').trim();
    const operationId = requestedId || generateNotemdOperationId();
    const state: NotemdOperationState = {
        id: operationId,
        controller: new AbortController(),
        status: 'running',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        logs: [],
    };
    NOTEMD_ACTIVE_OPERATIONS.set(operationId, state);
    return state;
}

function finalizeNotemdOperation(state: NotemdOperationState, status: NotemdOperationState['status']): void {
    state.status = status;
    state.updatedAt = Date.now();
    setTimeout(() => {
        const current = NOTEMD_ACTIVE_OPERATIONS.get(state.id);
        if (current === state && current.status !== 'running') {
            NOTEMD_ACTIVE_OPERATIONS.delete(state.id);
        }
    }, 60000);
}

function writeSseEvent(res: http.ServerResponse, eventType: string, payload: unknown): void {
    if (res.writableEnded) {
        return;
    }
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createNotemdReporter(state: NotemdOperationState, res?: http.ServerResponse): ProgressReporter {
    return {
        report: (eventLike) => {
            const event: ProgressEvent = {
                ...eventLike,
                operationId: state.id,
                timestamp: Date.now(),
            };
            state.logs.push(event);
            state.updatedAt = event.timestamp;
            if (res) {
                writeSseEvent(res, event.type, event);
            }
        },
        isCancelled: () => state.controller.signal.aborted,
    };
}

function shouldStreamNotemdResponse(req: http.IncomingMessage): boolean {
    const acceptHeader = typeof req.headers.accept === 'string' ? req.headers.accept : '';
    if (acceptHeader.includes('text/event-stream')) {
        return true;
    }
    try {
        const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${PORT}`);
        return urlObj.searchParams.get('stream') === '1';
    } catch (_error) {
        return false;
    }
}

async function resolveNearestExistingAncestor(candidatePath: string): Promise<string | null> {
    let current = path.resolve(candidatePath);
    for (;;) {
        try {
            return await fs.promises.realpath(current);
        } catch (error) {
            if (!isFsNotFoundError(error)) {
                throw error;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                return null;
            }
            current = parent;
        }
    }
}

async function resolvePathWithinKnowledgeBase(
    rawPath: unknown,
    options: { expectedType?: 'file' | 'directory' | 'any'; allowMissing?: boolean } = {}
): Promise<string> {
    const requestedPath = String(rawPath || '').trim();
    if (!requestedPath) {
        throw makeAccessDeniedError('Missing path.');
    }

    const kbRootCanonical = await fs.promises.realpath(KB_ROOT);
    const candidate = path.isAbsolute(requestedPath)
        ? path.resolve(requestedPath)
        : path.resolve(kbRootCanonical, requestedPath);

    if ((process as NodeJS.Process & { pkg?: unknown }).pkg && isPkgSnapshotPath(candidate)) {
        throw makeAccessDeniedError('pkg snapshot paths are not allowed.');
    }

    if (options.allowMissing) {
        const ancestor = await resolveNearestExistingAncestor(candidate);
        if (!ancestor || !isPathInsideRoot(ancestor, kbRootCanonical)) {
            throw makeAccessDeniedError('Path is outside configured knowledge base.');
        }
        return candidate;
    }

    const candidateCanonical = await fs.promises.realpath(candidate);
    if (!isPathInsideRoot(candidateCanonical, kbRootCanonical)) {
        throw makeAccessDeniedError('Path is outside configured knowledge base.');
    }

    const stat = await fs.promises.stat(candidateCanonical);
    if (options.expectedType === 'file' && !stat.isFile()) {
        throw makeAccessDeniedError('Expected a file path.');
    }
    if (options.expectedType === 'directory' && !stat.isDirectory()) {
        throw makeAccessDeniedError('Expected a directory path.');
    }
    return candidateCanonical;
}

function parseOptionalPositiveDimension(value: unknown): number | undefined {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return undefined;
    }
    return Math.floor(numericValue);
}

function parseOptionalPositiveScale(value: unknown): number | undefined {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return undefined;
    }
    return Math.min(4, numericValue);
}


function parseOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
            return true;
        }
        if (normalized === 'false' || normalized === '0' || normalized === 'no') {
            return false;
        }
    }
    return undefined;
}

function normalizeMermaidRendererPreference(value: unknown): MermaidRendererPreference {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'local') {
        return 'local';
    }
    if (normalized === 'frontend' || normalized === 'bridge') {
        return 'frontend';
    }
    return FORCE_FRONTEND_MERMAID_RENDER ? 'frontend' : 'auto';
}

async function writeSidecarRuntimeManifest(finalPort: number): Promise<void> {
    try {
        const manifestDir = path.dirname(SIDECAR_RUNTIME_MANIFEST);
        await fs.promises.mkdir(manifestDir, { recursive: true });
        await fs.promises.writeFile(
            SIDECAR_RUNTIME_MANIFEST,
            JSON.stringify({
                host: LOOPBACK_HOST,
                port: finalPort,
                baseUrl: `http://${LOOPBACK_HOST}:${finalPort}`,
                bridgePort: PATH_BRIDGE_PORT,
                bridgeWsUrl: `ws://${LOOPBACK_HOST}:${PATH_BRIDGE_PORT}`,
                authToken: AUTH_TOKEN,
                projectRoot: runtimePaths.projectRoot,
                runtimeDataDir: RUNTIME_DATA_DIR,
                generatedAt: new Date().toISOString(),
                pid: process.pid,
            }, null, 2),
            'utf8'
        );
    } catch (error) {
        warnDiagnostic('[Sidecar] Failed to write runtime manifest:', error);
    }
}
async function renderMermaidWithPreference(
    source: string,
    options: {
        maxWidth?: number;
        maxHeight?: number;
        renderScale?: number;
        includeStages?: boolean;
        includeSvg?: boolean;
        rendererPreference: MermaidRendererPreference;
    }
): Promise<Record<string, unknown>> {
    const includeSvg = options.includeStages === true || options.includeSvg === true;
    const frontendPayload = {
        source,
        theme: 'dark' as const,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        renderScale: options.renderScale,
        includeStages: options.includeStages === true,
        includeSvg,
    };

    if (options.rendererPreference !== 'local' && pathBridge) {
        try {
            const frontendRendered = await pathBridge.requestFrontendMermaidRender(frontendPayload);
            const frontendResult: Record<string, unknown> = {
                pngBase64: frontendRendered.pngBase64,
                width: frontendRendered.width,
                height: frontendRendered.height,
                renderer: frontendRendered.renderer || 'frontend-bridge',
                stages: frontendRendered.stages,
            };
            if (includeSvg && typeof frontendRendered.svg === 'string' && frontendRendered.svg.trim()) {
                frontendResult.svg = frontendRendered.svg;
            }
            return frontendResult;
        } catch (error) {
            if (options.rendererPreference === 'frontend') {
                throw error;
            }
            warnDiagnostic('[Reader] Frontend Mermaid render unavailable, falling back to local resvg:', error);
        }
    }

    const localRendered = await renderMermaidPng(source, {
        theme: 'dark',
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        renderScale: options.renderScale,
    });
    const localResult: Record<string, unknown> = {
        pngBase64: localRendered.pngBase64,
        width: localRendered.width,
        height: localRendered.height,
        renderer: 'local-resvg',
    };
    if (includeSvg && typeof localRendered.svg === 'string' && localRendered.svg.trim()) {
        localResult.svg = localRendered.svg;
    }
    return localResult;
}
function parseCachedTargetFromFileName(filename: string): string | null {
    if (filename.startsWith('data_cli_') || filename.startsWith('graph_data_cli_')) {
        return null;
    }

    const dataMatch = /^data_([a-z0-9_\-]+)\.js$/i.exec(filename);
    if (dataMatch && dataMatch[1]) {
        return dataMatch[1];
    }

    const graphMatch = /^graph_data_([a-z0-9_\-]+)\.json$/i.exec(filename);
    if (graphMatch && graphMatch[1]) {
        return graphMatch[1];
    }

    return null;
}

async function readDirEntriesSafe(dirPath: string): Promise<fs.Dirent[]> {
    try {
        return await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
        if (isFsNotFoundError(error)) {
            return [];
        }
        throw error;
    }
}

async function collectAvailableTargetsFromPath(kbRoot: string): Promise<string[]> {
    const targets = new Set<string>();

    const kbEntries = await readDirEntriesSafe(kbRoot);
    kbEntries
        .filter((entry) => entry.isDirectory())
        .forEach((entry) => targets.add(entry.name));

    for (const dir of [RUNTIME_DATA_DIR, FRONTEND_DIR]) {
        const entries = await readDirEntriesSafe(dir);
        entries.forEach((entry) => {
            if (!entry.isFile()) {
                return;
            }
            const parsed = parseCachedTargetFromFileName(entry.name);
            if (parsed) {
                targets.add(parsed);
            }
        });
    }

    return Array.from(targets).sort((a, b) => a.localeCompare(b));
}

async function pathExists(candidatePath: string): Promise<boolean> {
    try {
        await fs.promises.access(candidatePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        if (isFsNotFoundError(error)) {
            return false;
        }
        throw error;
    }
}

async function resolveCliPathFallback(argsList: string[]): Promise<string | null> {
    for (const arg of argsList) {
        if (arg.startsWith('-') || arg === 'true') {
            continue;
        }
        if (arg.includes('/') || arg.includes('\\')) {
            return arg;
        }
        const resolved = path.resolve(KB_ROOT, arg);
        if (await pathExists(resolved)) {
            return arg;
        }
    }
    return null;
}

async function findLatestCliBuildForKb(kbName: string): Promise<string | null> {
    const files = (await readDirEntriesSafe(RUNTIME_DATA_DIR))
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    const prefix = `data_cli_${kbName}_`;
    const matches = files
        .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.js'))
        .sort()
        .reverse();
    return matches.length > 0 ? matches[0] : null;
}

function extractRelativePathFromKbMarker(rawFilePath: string): string | null {
    const normalized = rawFilePath.replace(/\\/g, '/');
    const lowered = normalized.toLowerCase();
    const marker = '/knowledge_base/';
    const markerNoPrefix = 'knowledge_base/';

    const markerIndex = lowered.indexOf(marker);
    if (markerIndex >= 0) {
        const relative = normalized.slice(markerIndex + marker.length);
        return relative.length > 0 ? relative : null;
    }

    if (lowered.startsWith(markerNoPrefix)) {
        const relative = normalized.slice(markerNoPrefix.length);
        return relative.length > 0 ? relative : null;
    }

    return null;
}

function resolveContentCandidatePath(kbRoot: string, rawFilePath: string): string {
    const requestedPath = String(rawFilePath || '').trim();
    if (!requestedPath) {
        throw makeAccessDeniedError('Missing content path.');
    }
    if (requestedPath.includes('\0')) {
        throw makeAccessDeniedError('Invalid content path.');
    }

    const normalized = requestedPath.replace(/\\/g, '/');
    const normalizedCandidate = path.normalize(normalized);

    const relativeFromKb = extractRelativePathFromKbMarker(rawFilePath);
    if (relativeFromKb) {
        const markerScopedPath = path.resolve(kbRoot, path.normalize(relativeFromKb));
        if (!isPathInsideRoot(markerScopedPath, kbRoot)) {
            throw makeAccessDeniedError('Requested file is outside configured knowledge base.');
        }
        return markerScopedPath;
    }

    if (path.isAbsolute(normalizedCandidate)) {
        const absoluteCandidate = path.resolve(normalizedCandidate);
        if ((process as NodeJS.Process & { pkg?: unknown }).pkg && isPkgSnapshotPath(absoluteCandidate)) {
            throw makeAccessDeniedError('Absolute pkg snapshot content paths are not allowed.');
        }
        if (!isPathInsideRoot(absoluteCandidate, kbRoot)) {
            throw makeAccessDeniedError('Requested file is outside configured knowledge base.');
        }
        return absoluteCandidate;
    }

    const resolvedCandidate = path.resolve(kbRoot, normalizedCandidate);
    if (!isPathInsideRoot(resolvedCandidate, kbRoot)) {
        throw makeAccessDeniedError('Requested file is outside configured knowledge base.');
    }
    return resolvedCandidate;
}

function normalizePathForComparison(candidatePath: string): string {
    const resolved = path.resolve(candidatePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isPkgSnapshotPath(candidatePath: string): boolean {
    const normalized = normalizePathForComparison(candidatePath).replace(/\\/g, '/');
    return normalized.includes('/snapshot/');
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
    const rootResolved = normalizePathForComparison(rootPath);
    const candidateResolved = normalizePathForComparison(candidatePath);
    const relative = path.relative(rootResolved, candidateResolved);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function hasPathTraversalSegment(rawPathname: string): boolean {
    const normalized = String(rawPathname || '').replace(/\\/g, '/');
    return normalized.split('/').some((segment) => segment === '..');
}

function resolveFrontendStaticPath(rawPathname: string): string | null {
    let decodedPathname = '/';
    try {
        decodedPathname = decodeURIComponent(rawPathname || '/');
    } catch (_error) {
        return null;
    }

    if (decodedPathname.includes('\0')) {
        return null;
    }
    if (hasPathTraversalSegment(decodedPathname)) {
        return null;
    }

    const normalizedPathname = path.posix.normalize(
        decodedPathname === '/' ? '/index.html' : decodedPathname.replace(/\\/g, '/')
    );
    const prefixedPathname = normalizedPathname.startsWith('/') ? normalizedPathname : `/${normalizedPathname}`;
    const resolved = path.resolve(FRONTEND_DIR, `.${prefixedPathname}`);
    if (!isPathInsideRoot(resolved, FRONTEND_DIR)) {
        return null;
    }

    return resolved;
}

function getStaticContentType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
        case '.html':
            return 'text/html';
        case '.js':
            return 'text/javascript';
        case '.css':
            return 'text/css';
        case '.json':
            return 'application/json';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.svg':
            return 'image/svg+xml';
        case '.ico':
            return 'image/x-icon';
        default:
            return 'application/octet-stream';
    }
}

// CLI Argument Parsing (v0.9.71 Fix)
const args = process.argv.slice(2);
let cliOptions: any = {};
let hasCliBuild = false;

// Helper: Check npm config env vars (npm often passes flags as env vars)
// e.g. npm start -- --gpu -> npm_config_gpu=true
if (process.env.npm_config_path) {
    cliOptions.targetPath = process.env.npm_config_path;
    hasCliBuild = true;
}
if (process.env.npm_config_gpu === 'true' || process.env.npm_config_gpu === '') {
    cliOptions.enableGPU = true;
    cliOptions.enableGPULayout = true;
}
if (process.env.NOTE_CONNECTION_GPU === 'true' || process.env.NOTE_CONNECTION_GPU === '1') {
    cliOptions.enableGPU = true;
    cliOptions.enableGPULayout = true;
}
if (process.env.npm_config_static === 'true' || process.env.npm_config_static === '') {
    logDiagnostic('[CLI] Static mode requested (via env).');
}
if (process.env.npm_config_workers) {
    cliOptions.maxWorkers = parseInt(process.env.npm_config_workers);
}

// Fallback: Check manual args loop (in case direct node execution or npm passed them through)
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--path' && args[i+1]) {
        cliOptions.targetPath = args[++i];
        hasCliBuild = true;
    } else if (arg === '--gpu') {
        cliOptions.enableGPU = true;
        cliOptions.enableGPULayout = true; 
    } else if (arg === '--no-gpu') {
        cliOptions.enableGPU = false;
        cliOptions.enableGPULayout = false;
    } else if (arg === '--static') {
        logDiagnostic('[CLI] Static mode requested (Frontend auto-detects large graphs).');
    } else if (arg === '--workers' && args[i+1]) {
        cliOptions.maxWorkers = parseInt(args[++i]);
    }
    // Heuristic for Positional Args (if flags were stripped)
    // If not a flag (doesn't start with -) and looks like a path (contains / or \)
    else if (!arg.startsWith('-') && (arg.includes('/') || arg.includes('\\'))) {
        // Assume it's the path if we haven't found one yet
        if (!cliOptions.targetPath) {
            cliOptions.targetPath = arg;
            hasCliBuild = true;
        }
    }
    // If number, assume workers
    else if (!arg.startsWith('-') && !isNaN(parseInt(arg)) && parseInt(arg) < 128) {
        if (!cliOptions.maxWorkers) {
            cliOptions.maxWorkers = parseInt(arg);
        }
    }
}

logDiagnostic('[CLI] Parsed Options:', cliOptions);

function getCliFlagValue(argsList: string[], flagName: string): string | undefined {
    const index = argsList.indexOf(flagName);
    if (index < 0 || index + 1 >= argsList.length) {
        return undefined;
    }
    return String(argsList[index + 1] || '').trim() || undefined;
}

export async function executeNotemdCliCommand(subArgs: string[]): Promise<Record<string, unknown>> {
    const command = String(subArgs[0] || '').trim().toLowerCase();
    const action = String(subArgs[1] || '').trim().toLowerCase();

    if (!command) {
        throw new Error('Missing NoteMD CLI command.');
    }

    if (command === 'settings' && action === 'show') {
        return {
            command: 'settings.show',
            settings: await loadNotemdSettings(),
        };
    }

    if (command === 'settings' && action === 'set-api') {
        const settings = await loadNotemdSettings();
        const providerName = getCliFlagValue(subArgs, '--provider');
        if (!providerName) {
            throw new Error('Missing --provider for settings set-api.');
        }
        const provider = settings.providers.find((item) => item.name === providerName);
        if (!provider) {
            throw new Error(`Unknown provider: ${providerName}`);
        }

        const nextSettings = cloneNotemdSettings(settings);
        nextSettings.activeProvider = provider.name;
        nextSettings.providers = nextSettings.providers.map((item) => {
            if (item.name !== provider.name) {
                return item;
            }
            return {
                ...item,
                baseUrl: getCliFlagValue(subArgs, '--base-url') || item.baseUrl,
                model: getCliFlagValue(subArgs, '--model') || item.model,
                apiKey: getCliFlagValue(subArgs, '--api-key') || item.apiKey,
                apiVersion: getCliFlagValue(subArgs, '--api-version') || item.apiVersion,
                temperature: Number.isFinite(Number(getCliFlagValue(subArgs, '--temperature')))
                    ? Number(getCliFlagValue(subArgs, '--temperature'))
                    : item.temperature,
            };
        });

        return {
            command: 'settings.set-api',
            settings: await persistNotemdSettings(nextSettings),
        };
    }

    const settings = await loadNotemdSettings();
    if (command === 'one-click-extract') {
        const filePath = getCliFlagValue(subArgs, '--file');
        if (!filePath) {
            throw new Error('Missing --file for one-click-extract.');
        }
        const resolvedFilePath = await resolvePathWithinKnowledgeBase(filePath, { expectedType: 'file' });
        return {
            command: 'one-click-extract',
            result: await notemdService.oneClickExtract(resolvedFilePath, settings),
        };
    }

    if (command === 'extract-concepts') {
        const filePath = getCliFlagValue(subArgs, '--file');
        if (!filePath) {
            throw new Error('Missing --file for extract-concepts.');
        }
        const resolvedFilePath = await resolvePathWithinKnowledgeBase(filePath, { expectedType: 'file' });
        return {
            command: 'extract-concepts',
            result: await notemdService.extractConcepts(resolvedFilePath, settings),
        };
    }

    if (command === 'batch-generate') {
        const folderPath = getCliFlagValue(subArgs, '--folder');
        if (!folderPath) {
            throw new Error('Missing --folder for batch-generate.');
        }
        const resolvedFolderPath = await resolvePathWithinKnowledgeBase(folderPath, { expectedType: 'directory' });
        return {
            command: 'batch-generate',
            result: await notemdService.generateFolderContent(resolvedFolderPath, settings),
        };
    }

    if (command === 'batch-mermaid-fix') {
        const folderPath = getCliFlagValue(subArgs, '--folder');
        if (!folderPath) {
            throw new Error('Missing --folder for batch-mermaid-fix.');
        }
        const resolvedFolderPath = await resolvePathWithinKnowledgeBase(folderPath, { expectedType: 'directory' });
        return {
            command: 'batch-mermaid-fix',
            result: await notemdService.batchFixMermaid(resolvedFolderPath, true),
        };
    }

    if (command === 'fix-mermaid') {
        const filePath = getCliFlagValue(subArgs, '--file');
        if (!filePath) {
            throw new Error('Missing --file for fix-mermaid.');
        }
        const resolvedFilePath = await resolvePathWithinKnowledgeBase(filePath, { expectedType: 'file' });
        return {
            command: 'fix-mermaid',
            result: await notemdService.fixMermaid(resolvedFilePath, true),
        };
    }

    throw new Error(`Unsupported NoteMD CLI command: ${[command, action].filter(Boolean).join(' ')}`);
}

export const startServer = async (options: { port?: number, targetPath?: string } = {}) => {
    // If options are provided, override CLI/Env defaults or merge them
    if (options.targetPath) {
        cliOptions.targetPath = options.targetPath;
        hasCliBuild = true; // Assume explicit path implies specific build intent or context
    }
    if (cliOptions.targetPath === 'true') {
        const fallbackPath = await resolveCliPathFallback(args);
        if (fallbackPath) {
            cliOptions.targetPath = fallbackPath;
            hasCliBuild = true;
        } else {
            warnDiagnostic("[CLI] Warning: targetPath detected as 'true'. This usually means npm consumed the flag incorrectly. Please check your command syntax.");
            delete cliOptions.targetPath;
            hasCliBuild = false;
        }
    } else if (!cliOptions.targetPath) {
        const fallbackPath = await resolveCliPathFallback(args);
        if (fallbackPath) {
            cliOptions.targetPath = fallbackPath;
            hasCliBuild = true;
        }
    }
    const finalPort = typeof options.port === 'number' ? options.port : PORT;
    let runtimePort = finalPort;

    if (hasCliBuild) {
        const kbName = path.basename(cliOptions.targetPath || 'knowledge_base');
        let useExisting = false;
        
        // Only do interactive prompt if we are in a TTY and effectively running standalone
        // For Electron auto-start, we might want to skip this or handle it differently.
        // For now, if passed via options, we assume 'Regenerate' or 'Load' should be automatic or decided by caller?
        // Let's keep existing logic but realize it might block if no TTY.
        // CHECK: If options.targetPath is passed, do we skip the prompt? 
        // If we are required to not block, we should probably default to "Load" if exists, or "Gen" if not.
        
        const latest = await findLatestCliBuildForKb(kbName);
        if (latest) {
            logDiagnostic(`\n[CLI] Found existing build for '${kbName}': ${latest}`);

            // If specific options passed (embedded mode), default to Load to avoid blocking
            // Otherwise use interactive prompt
            if (options.targetPath) {
                useExisting = true;
                const suffix = latest.replace('data_cli_', '').replace('.js', '');
                cliOptions.outputPrefix = suffix;
                logDiagnostic(`[CLI] Auto-Loading existing data: ${latest}`);
            } else {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise<string>(resolve => {
                    rl.question('[CLI] Do you want to (L)oad existing or (R)egenerate? [L/r]: ', (ans) => {
                        rl.close();
                        resolve(ans.trim().toLowerCase());
                    });
                });

                if (answer === '' || answer === 'l') {
                    useExisting = true;
                    // Extract suffix: data_cli_{suffix}.js
                    // suffix = kbName_time
                    const suffix = latest.replace('data_cli_', '').replace('.js', '');
                    cliOptions.outputPrefix = suffix;
                    logDiagnostic(`[CLI] Loading existing data: ${latest}`);
                }
            }
        }

        if (!useExisting) {
            const now = new Date();
            const timeStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
            cliOptions.outputPrefix = `${kbName}_${timeStr}`;
            
            logDiagnostic(`[CLI] Generating new knowledge graph for: ${cliOptions.targetPath}`);
            try {
                await buildGraph(cliOptions);
                logDiagnostic('[CLI] Generation complete.');
            } catch (e) {
                console.error('[CLI] Build failed:', e);
                process.exit(1);
            }
        }
    }

    const server = http.createServer(async (req, res) => {
        if (!applyCorsHeaders(req, res)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Origin is not allowed.' }));
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (!isAuthorizedRequest(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized sidecar request.' }));
            return;
        }

        if (req.method === 'GET') {
            const getPathname = getRawRequestPathname(req.url);

            if (getPathname === '/api/knowledge/state') {
                try {
                    await knowledgeLearningPlatform.ensureReady();
                    const state = knowledgeLearningPlatform.getKnowledgeState();
                    const store = await knowledgeLearningPlatform.getStoreDiagnostics();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            state,
                            store,
                        })
                    );
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/knowledge/state');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (getPathname === '/api/knowledge/store-diagnostics') {
                try {
                    const store = await knowledgeLearningPlatform.getStoreDiagnostics();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            store,
                        })
                    );
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/knowledge/store-diagnostics');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (getPathname === '/api/notemd/settings') {
                try {
                    const settings = await loadNotemdSettings();
                    const activeOperationCount = Array.from(NOTEMD_ACTIVE_OPERATIONS.values()).filter(
                        (operation) => operation.status === 'running'
                    ).length;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            settings,
                            operationSummary: {
                                total: NOTEMD_ACTIVE_OPERATIONS.size,
                                running: activeOperationCount,
                            },
                        })
                    );
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/notemd/settings');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (getPathname === '/api/notemd/workspace') {
                try {
                    const settings = await loadNotemdSettings();
                    const workspace = extractNotemdWorkspaceState(settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            workspace,
                        })
                    );
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/notemd/workspace');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (getPathname === '/api/path-mode/settings') {
                try {
                    const settings = await loadPathModeSettings();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            settings,
                        })
                    );
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/path-mode/settings');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (getPathname === '/api/frontend/settings') {
                try {
                    const settings = await loadFrontendSettings();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            settings,
                        })
                    );
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/frontend/settings');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (req.url === '/api/runtime-diagnostics') {
                try {
                    const bridgeSummary = pathBridge && typeof (pathBridge as any).getClientSummary === 'function'
                        ? (pathBridge as any).getClientSummary()
                        : null;
                    const bridgeStatus = pathBridge && typeof (pathBridge as any).getStatus === 'function'
                        ? (pathBridge as any).getStatus()
                        : null;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        runtime: {
                            host: LOOPBACK_HOST,
                            port: runtimePort,
                            bridgePort: PATH_BRIDGE_PORT,
                            kbRoot: KB_ROOT,
                            frontendDir: FRONTEND_DIR,
                            runtimeDataDir: RUNTIME_DATA_DIR,
                            authRequired: AUTH_TOKEN.length > 0
                        },
                        ingress: {
                            jsonBodyLimitBytes: REQUEST_BODY_LIMIT_BYTES,
                            requestBodySpoolThresholdBytes: REQUEST_BODY_SPOOL_THRESHOLD_BYTES,
                            requestBodySpoolThresholdKb: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.selectedKiB,
                            requestBodySpoolThresholdSource: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.source,
                            requestBodySpoolThresholdRecommendedKb: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.recommendedKiB,
                            requestBodySpoolThresholdStrictMode: REQUEST_BODY_SPOOL_THRESHOLD_POLICY.strictMode,
                            requestBodySpoolThresholdRangeKb: {
                                min: REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.min,
                                max: REQUEST_BODY_SPOOL_THRESHOLD_RANGE_KB.max
                            },
                            clipboardBodyLimitBytes: CLIPBOARD_BODY_LIMIT_BYTES,
                            clipboardBodyLimitMb: CLIPBOARD_BODY_LIMIT_MB,
                            clipboardBodyLimitRangeMb: {
                                min: CLIPBOARD_BODY_LIMIT_RANGE_MB.min,
                                max: CLIPBOARD_BODY_LIMIT_RANGE_MB.max
                            }
                        },
                        wasmParity: WasmParityRuntime.getDiagnostics(),
                        computeModes: collectComputeModeSnapshot(),
                        pathBridge: {
                            summary: bridgeSummary,
                            status: bridgeStatus
                        }
                    }));
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/runtime-diagnostics');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            if (req.url === '/api/folders') {
                try {
                    // Use configured path or default
                    // Note: KB_ROOT is currently module-level constant. We should probably make it dynamic?
                    // For now, if we pass targetPath, we might be focusing on THAT path.
                    // But /api/folders lists "Knowledge_Base" by default.
                    let entries: fs.Dirent[] = [];
                    try {
                        entries = await fs.promises.readdir(KB_ROOT, { withFileTypes: true });
                    } catch (error) {
                        if (isFsNotFoundError(error)) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ folders: [] }));
                            return;
                        }
                        throw error;
                    }

                    if (!entries.length) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ folders: [] }));
                        return;
                    }

                    // Filter directories
                    const folders = entries
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name)
                        .sort((a, b) => a.localeCompare(b));
                    
                    // Also enable "All" option effectively by logic, but here we just list folders.
                    // The frontend can add an "All" option.
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ folders }));
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/folders');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            if (req.url === '/api/available-targets') {
                try {
                    const targets = await collectAvailableTargetsFromPath(KB_ROOT);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ targets }));
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/available-targets');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }
    
            if (req.url?.startsWith('/api/content')) {
                try {
                    const urlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                    const requestedPath = urlObj.searchParams.get('path');
                    
                    if (!requestedPath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing path parameter' }));
                        return;
                    }

                    const decodedPath = decodeURIComponent(requestedPath);
                    const kbRootCanonical = await fs.promises.realpath(KB_ROOT);
                    const candidatePath = resolveContentCandidatePath(kbRootCanonical, decodedPath);
                    const filePathCanonical = await fs.promises.realpath(candidatePath);
                    if (!isPathInsideRoot(filePathCanonical, kbRootCanonical)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Requested file is outside configured knowledge base' }));
                        return;
                    }

                    const fileStat = await fs.promises.stat(filePathCanonical);
                    if (!fileStat.isFile()) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File not found' }));
                        return;
                    }

                    const content = await fs.promises.readFile(filePathCanonical, 'utf-8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ content }));
    
                } catch (error) {
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File not found' }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            // GET any generated graph assets (e.g. data_cli.js, data.js, graph_data.json)
            // Must parse pathname so cache-busting query strings (`?v=...`) still route correctly.
            if (req.url && !req.url.startsWith('/api/')) {
                const assetUrlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                const assetPathname = decodeURIComponent(assetUrlObj.pathname);
                if (assetPathname.endsWith('.js') || assetPathname.endsWith('.json')) {
                    let filename = path.basename(assetPathname);

                    if (hasCliBuild && cliOptions.outputPrefix) {
                        if (filename === 'data.js') {
                            filename = `data_cli_${cliOptions.outputPrefix}.js`;
                        } else if (filename === 'graph_data.json') {
                            filename = `graph_data_cli_${cliOptions.outputPrefix}.json`;
                        }
                    }

                    const generatedPath = isGeneratedGraphAsset(filename)
                        ? await resolveGeneratedAssetForReadAsync(filename)
                        : null;
                    const bundledPath = path.join(FRONTEND_DIR, filename);
                    const filePath = generatedPath || (await isRegularFile(bundledPath) ? bundledPath : null);

                    if (filePath) {
                        const ext = path.extname(filename);
                        const contentType = ext === '.json' ? 'application/json' : 'application/javascript';
                        
                        try {
                            const content = await fs.promises.readFile(filePath);
                            res.writeHead(200, { 'Content-Type': contentType });
                            res.end(content);
                            return;
                        } catch (err) {
                            CrashLogger.log(err, `AssetRead:${filename}`);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: `Failed to load asset: ${String(err)}` }));
                            return;
                        }
                    }
                }
                // Let it fall through to static serving/404 if not found.
            }

            // GET /api/kb-path â€” Return current Knowledge Base root path
            // Legacy parity mapping: replaced historical desktop IPC getter.
            // è¿”å›žå½“å‰çŸ¥è¯†åº“æ ¹è·¯å¾„ï¼ˆåŽ†å² IPC getter çš„æ¡¥æŽ¥æ›¿ä»£å®žçŽ°ï¼‰ã€‚
            if (req.url === '/api/kb-path') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ kbPath: KB_ROOT }));
                return;
            }

            // GET /api/check-cache?target=financial â€” Check if cached graph exists
            // Legacy parity mapping for previous desktop cache-check flow.
            // æ£€æŸ¥æŒ‡å®šç›®æ ‡çš„å›¾è°±ç¼“å­˜æ˜¯å¦å­˜åœ¨ï¼ˆåŽ†å²æ¡Œé¢ç¼“å­˜æ£€æŸ¥é“¾è·¯çš„æ¡¥æŽ¥å®žçŽ°ï¼‰ã€‚
            if (req.url?.startsWith('/api/check-cache')) {
                try {
                    const urlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                    const target = urlObj.searchParams.get('target');
                    
                    if (!target) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(null));
                        return;
                    }

                    if (target === 'ALL_FOLDERS') {
                        const activeJsPath = await resolveGeneratedAssetForReadAsync('data.js');
                        if (activeJsPath) {
                            const stats = await fs.promises.stat(activeJsPath);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                date: stats.mtime.toLocaleString(),
                                size: stats.size,
                                source: 'active'
                            }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(null));
                        }
                        return;
                    }
                    
                    const targetName = target.replace(/[^a-z0-9_\-]/gi, '_');
                    const cachePath = await resolveGeneratedAssetForReadAsync(`data_${targetName}.js`);
                    
                    if (cachePath) {
                        const stats = await fs.promises.stat(cachePath);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            date: stats.mtime.toLocaleString(),
                            size: stats.size
                        }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(null));
                    }
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/check-cache');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            }

            // GET /api/restore-cache?target=financial â€” Restore cached graph as active data
            // Legacy parity mapping for previous desktop cache-restore flow.
            // Copies data_{target}.js â†’ data.js and graph_data_{target}.json â†’ graph_data.json
            // ä»Žç¼“å­˜æ¢å¤å›¾è°±æ•°æ®ï¼ˆåŽ†å²æ¡Œé¢ restoreCache é“¾è·¯çš„æ¡¥æŽ¥å®žçŽ°ï¼‰ã€‚
            if (req.url?.startsWith('/api/restore-cache')) {
                try {
                    const urlObj = new URL(req.url, `http://${LOOPBACK_HOST}:${finalPort}`);
                    const target = urlObj.searchParams.get('target');
                    
                    if (!target) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing target' }));
                        return;
                    }

                    const restoreKey = `restore:${target}`;
                    const now = Date.now();
                    if (lastRestoreKey === restoreKey && (now - lastRestoreTs) < 3000) {
                        logDiagnostic(`[Cache] Duplicate restore suppressed for ${target}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, deduped: true }));
                        return;
                    }
                    lastRestoreKey = restoreKey;
                    lastRestoreTs = now;

                    if (target === 'ALL_FOLDERS') {
                        const activeJsPath = await resolveGeneratedAssetForReadAsync('data.js');
                        if (activeJsPath) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'No active cache found' }));
                        }
                        return;
                    }

                    const targetName = target.replace(/[^a-z0-9_\-]/gi, '_');
                    
                    const cacheJs = await resolveGeneratedAssetForReadAsync(`data_${targetName}.js`);
                    await ensureRuntimeDataDir();
                    const targetJs = generatedAssetWritePath('data.js');
                    const cacheJson = await resolveGeneratedAssetForReadAsync(`graph_data_${targetName}.json`);
                    const targetJson = generatedAssetWritePath('graph_data.json');
                    
                    if (cacheJs) {
                        await fs.promises.copyFile(cacheJs, targetJs);
                        if (cacheJson) {
                            await fs.promises.copyFile(cacheJson, targetJson);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Cache not found' }));
                    }
                } catch (error) {
                    console.error(error);
                    CrashLogger.log(error, 'API:GET /api/restore-cache');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            // Serve static frontend files (query-string safe + traversal-safe).
            const staticFilePath = resolveFrontendStaticPath(getRawRequestPathname(req.url));
            if (!staticFilePath) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid static file path' }));
                return;
            }

            try {
                const fileStat = await fs.promises.stat(staticFilePath);
                if (!fileStat.isFile()) {
                    res.writeHead(404);
                    res.end('File not found');
                    return;
                }

                const content = await fs.promises.readFile(staticFilePath);
                res.writeHead(200, { 'Content-Type': getStaticContentType(staticFilePath) });
                res.end(content);
            } catch (error) {
                if (isFsNotFoundError(error)) {
                    res.writeHead(404);
                    res.end('File not found');
                    return;
                }
                CrashLogger.log(error, `StaticFile:${staticFilePath}`);
                res.writeHead(500);
                res.end(`Server Error: ${(error as NodeJS.ErrnoException | undefined)?.code || 'UNKNOWN'}`);
            }
        } else if (req.method === 'POST' || req.method === 'PUT') {
            const postPathname = getRawRequestPathname(req.url);

            if (postPathname === '/api/knowledge/store/reload') {
                try {
                    const restored = await knowledgeLearningPlatform.reloadFromStore();
                    const state = knowledgeLearningPlatform.getKnowledgeState();
                    const store = await knowledgeLearningPlatform.getStoreDiagnostics();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, restored, state, store }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/knowledge/store/reload');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/knowledge/ingest' || postPathname === '/api/knowledge/ingest-diff') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = payload as KnowledgeIngestRequest;
                    const result = await knowledgeLearningPlatform.ingestKnowledge(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, `API:POST ${postPathname}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/knowledge/query') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = payload as KnowledgeQueryRequest;
                    const result = await knowledgeLearningPlatform.queryKnowledge(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/knowledge/query');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/knowledge/mastery/diagnose') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = payload as MasteryDiagnosticsRequest;
                    const result = await knowledgeLearningPlatform.diagnoseMastery(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/knowledge/mastery/diagnose');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/knowledge/path') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = payload as LearningPathRequest;
                    const result = await knowledgeLearningPlatform.buildLearningPath(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/knowledge/path');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/knowledge/quality/evaluate') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = payload as LearningQualityEvaluationRequest;
                    const result = await knowledgeLearningPlatform.evaluateLearningQuality(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/knowledge/quality/evaluate');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/knowledge/tutor/action') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = payload as TutorActionRequest;
                    const result = await knowledgeLearningPlatform.executeTutorAction(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/knowledge/tutor/action');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/knowledge/memory/policy') {
                try {
                    const payload = await readJsonBody(req);
                    const requestPayload = payload as MemoryPolicyRequest;
                    const result = await knowledgeLearningPlatform.applyMemoryPolicy(requestPayload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/knowledge/memory/policy');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/settings') {
                try {
                    const payload = await readJsonBody(req);
                    const settingsCandidate = isObjectRecord(payload) && payload.settings !== undefined
                        ? payload.settings
                        : payload;
                    const settings = await persistNotemdSettings(settingsCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, settings }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/settings');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/workspace') {
                try {
                    const payload = await readJsonBody(req);
                    const workspaceCandidate = isObjectRecord(payload) && payload.workspace !== undefined
                        ? payload.workspace
                        : payload;
                    const workspace = await persistNotemdWorkspacePatch(workspaceCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, workspace }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/workspace');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/path-mode/settings') {
                try {
                    const payload = await readJsonBody(req);
                    const settingsCandidate = isObjectRecord(payload) && payload.settings !== undefined
                        ? payload.settings
                        : payload;
                    const settings = await persistPathModeSettings(settingsCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, settings }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/path-mode/settings');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/frontend/settings') {
                try {
                    const payload = await readJsonBody(req);
                    const settingsCandidate = isObjectRecord(payload) && payload.settings !== undefined
                        ? payload.settings
                        : payload;
                    const settings = await persistFrontendSettings(settingsCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, settings }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/frontend/settings');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/markdown/index') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const filePath = String(requestBody.filePath || '').trim();
                    if (!filePath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing filePath for /api/markdown/index',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const frontendSettings = await loadFrontendSettings();
                    const readingConfig = normalizeMarkdownRuntimeConfig(frontendSettings.reading);
                    const result = await markdownGateway.buildIndex(
                        {
                            filePath,
                            forceRebuild: requestBody.forceRebuild === true,
                        },
                        readingConfig
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: String((error as Error).message || 'Access denied'),
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Markdown file not found',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/index');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/markdown/chunk') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const indexId = String(requestBody.indexId || '').trim();
                    if (!indexId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing indexId for /api/markdown/chunk',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const result = await markdownGateway.getChunk({
                        indexId,
                        startBlock: Number(requestBody.startBlock) || 0,
                        blockCount: Number(requestBody.blockCount) || 1,
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/chunk');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/markdown/resolve-node') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const nodeId = String(requestBody.nodeId || '').trim();
                    if (!nodeId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing nodeId for /api/markdown/resolve-node',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const frontendSettings = await loadFrontendSettings();
                    const readingConfig = normalizeMarkdownRuntimeConfig(frontendSettings.reading);
                    const result = await markdownGateway.resolveNode(
                        {
                            nodeId,
                            currentFilePath: String(requestBody.currentFilePath || '').trim() || undefined,
                        },
                        readingConfig
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: String((error as Error).message || 'Access denied'),
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Markdown file not found',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/resolve-node');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/markdown/resolve-wiki') {
                try {
                    const payload = await readJsonBody(req);
                    const requestBody = isObjectRecord(payload) ? payload : {};
                    const wikiTarget = String(requestBody.wikiTarget || '').trim();
                    const currentFilePath = String(requestBody.currentFilePath || '').trim();
                    if (!wikiTarget || !currentFilePath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing wikiTarget or currentFilePath for /api/markdown/resolve-wiki',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }

                    const frontendSettings = await loadFrontendSettings();
                    const readingConfig = normalizeMarkdownRuntimeConfig(frontendSettings.reading);
                    const result = await markdownGateway.resolveWiki(
                        {
                            wikiTarget,
                            currentFilePath,
                        },
                        readingConfig
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: String((error as Error).message || 'Access denied'),
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    if (isFsNotFoundError(error)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Markdown file not found',
                            markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                        }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/markdown/resolve-wiki');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        markdownProtocolVersion: MARKDOWN_PROTOCOL_VERSION,
                    }));
                }
                return;
            }

            if (postPathname === '/api/notemd/cancel') {
                try {
                    const payload = await readJsonBody(req);
                    const operationId = String(payload.operationId || '').trim();
                    if (!operationId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing operationId' }));
                        return;
                    }

                    const operation = NOTEMD_ACTIVE_OPERATIONS.get(operationId);
                    if (!operation) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Operation not found' }));
                        return;
                    }

                    if (operation.status !== 'running') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(
                            JSON.stringify({
                                success: false,
                                operationId,
                                status: operation.status,
                                message: 'Operation is not running.',
                            })
                        );
                        return;
                    }

                    operation.controller.abort();
                    finalizeNotemdOperation(operation, 'cancelled');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, operationId, status: 'cancelled' }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/cancel');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/test-llm') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();

                    const providerName = String(payload.providerName || settings.activeProvider).trim();
                    const provider = settings.providers.find((item) => item.name === providerName);
                    if (!provider) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: `Unknown provider: ${providerName}` }));
                        return;
                    }

                    const result = await notemdLlmClient.testConnection(provider);
                    const statusCode = result.success ? 200 : 400;
                    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/test-llm');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/process-file') {
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);

                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }

                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const resolvedOutputPath = payload.outputPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputPath, {
                              expectedType: 'any',
                              allowMissing: true,
                          })
                        : undefined;

                    const result = await notemdService.processFile(
                        {
                            filePath: resolvedFilePath,
                            outputPath: resolvedOutputPath,
                            createConceptNotes: payload.createConceptNotes === true,
                            dryRun: payload.dryRun === true,
                        },
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: path.dirname(resolvedFilePath),
                        outputFilePath: resolvedOutputPath || result.outputPath || '',
                        outputFolderPath: path.dirname(resolvedOutputPath || result.outputPath || resolvedFilePath),
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after process-file.', workspaceError);
                    });

                    finalizeNotemdOperation(operation, 'done');
                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(
                            JSON.stringify({
                                success: true,
                                operationId: operation.id,
                                result,
                                logs: operation.logs,
                            })
                        );
                    }
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            res.end();
                        } else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/process-file');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        res.end();
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            }

            if (postPathname === '/api/notemd/process-folder') {
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);

                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }

                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const resolvedOutputFolderPath = payload.outputFolderPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputFolderPath, {
                              expectedType: 'any',
                              allowMissing: true,
                          })
                        : undefined;

                    const result = await notemdService.processFolder(
                        {
                            folderPath: resolvedFolderPath,
                            outputFolderPath: resolvedOutputFolderPath,
                            createConceptNotes: payload.createConceptNotes === true,
                            dryRun: payload.dryRun === true,
                        },
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        folderPath: resolvedFolderPath,
                        outputFolderPath: resolvedOutputFolderPath || '',
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after process-folder.', workspaceError);
                    });

                    finalizeNotemdOperation(operation, 'done');
                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(
                            JSON.stringify({
                                success: true,
                                operationId: operation.id,
                                result,
                                logs: operation.logs,
                            })
                        );
                    }
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            res.end();
                        } else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/process-folder');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        res.end();
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            }

            if (postPathname === '/api/notemd/generate-content') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    let title = String(payload.title || '').trim();
                    const filePathCandidate = String(payload.filePath || '').trim();
                    if (!title && filePathCandidate) {
                        title = path.basename(filePathCandidate, path.extname(filePathCandidate));
                    }
                    if (!title) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing title or filePath' }));
                        return;
                    }

                    const content = await notemdService.generateContent(
                        title,
                        typeof payload.context === 'string' ? payload.context : undefined,
                        settings
                    );

                    let outputPath: string | null = null;
                    if (payload.outputPath) {
                        outputPath = await resolvePathWithinKnowledgeBase(payload.outputPath, {
                            expectedType: 'any',
                            allowMissing: true,
                        });
                    } else if (filePathCandidate) {
                        outputPath = await resolvePathWithinKnowledgeBase(filePathCandidate, {
                            expectedType: 'any',
                            allowMissing: true,
                        });
                    }
                    if (outputPath) {
                        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
                        await fs.promises.writeFile(outputPath, content, 'utf8');
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                        JSON.stringify({
                            success: true,
                            title,
                            outputPath,
                            content,
                        })
                    );
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/generate-content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/translate-file') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const resolvedOutputPath = payload.outputPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputPath, {
                              expectedType: 'any',
                              allowMissing: true,
                          })
                        : undefined;
                    const targetLanguage = String(payload.targetLanguage || settings.translateLanguage || settings.language).trim();
                    if (!targetLanguage) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing targetLanguage' }));
                        return;
                    }

                    const result = await notemdService.translateFile(
                        {
                            filePath: resolvedFilePath,
                            outputPath: resolvedOutputPath,
                            targetLanguage,
                        },
                        settings
                    );

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/translate-file');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/translate-folder') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const targetLanguage = String(payload.targetLanguage || settings.translateLanguage || settings.language).trim();
                    if (!targetLanguage) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing targetLanguage' }));
                        return;
                    }

                    const result = await notemdService.translateFolder(
                        resolvedFolderPath,
                        targetLanguage,
                        settings
                    );

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/translate-folder');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/fix-mermaid') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const inPlace = payload.inPlace !== false;
                    const result = await notemdService.fixMermaid(resolvedFilePath, inPlace);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/fix-mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/fix-formulas') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const inPlace = payload.inPlace !== false;
                    const result = await notemdService.fixFormulas(resolvedFilePath, inPlace);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/fix-formulas');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/check-duplicates') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.checkDuplicates(resolvedFilePath);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/check-duplicates');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/extract-concepts') {
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);

                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }

                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.extractConcepts(
                        resolvedFilePath,
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: path.dirname(resolvedFilePath),
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after extract-concepts.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');

                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        res.end();
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, operationId: operation.id, result, logs: operation.logs }));
                    }
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            res.end();
                        } else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/extract-concepts');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        res.end();
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            }

            if (postPathname === '/api/notemd/one-click-extract') {
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId);
                    const reporter = createNotemdReporter(operation);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.oneClickExtract(
                        resolvedFilePath,
                        settings,
                        reporter,
                        operation.controller.signal
                    );
                    void persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: result.outputFolderPath,
                        outputFolderPath: result.outputFolderPath,
                    }).catch((workspaceError) => {
                        warnDiagnostic('[NoteMD] Failed to persist workspace state after one-click-extract.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, operationId: operation.id, result, logs: operation.logs }));
                } catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/one-click-extract');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/batch-fix-mermaid') {
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const result = await notemdService.batchFixMermaid(resolvedFolderPath, payload.inPlace !== false);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/batch-fix-mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (postPathname === '/api/notemd/generate-folder-content') {
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const result = await notemdService.generateFolderContent(resolvedFolderPath, settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/generate-folder-content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }

            if (req.url === '/api/render/math') {
                try {
                    const payload = await readJsonBody(req);
                    const source = typeof payload.source === 'string' ? payload.source : '';
                    const displayMode = payload.displayMode !== false;
                    const maxWidth = parseOptionalPositiveDimension(payload.maxWidth);
                    const maxHeight = parseOptionalPositiveDimension(payload.maxHeight);
                    const renderScale = parseOptionalPositiveScale(payload.renderScale);

                    if (!source.trim()) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing source' }));
                        return;
                    }

                    const rendered = await renderMathPng(source, { displayMode, maxWidth, maxHeight, renderScale });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(rendered));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/render/math');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/render/mermaid') {
                try {
                    const payload = await readJsonBody(req);
                    const source = typeof payload.source === 'string' ? payload.source : '';
                    const maxWidth = parseOptionalPositiveDimension(payload.maxWidth);
                    const maxHeight = parseOptionalPositiveDimension(payload.maxHeight);
                    const renderScale = parseOptionalPositiveScale(payload.renderScale);
                    const includeStages = parseOptionalBoolean(payload.includeStages) === true;
                    const includeSvg = parseOptionalBoolean(payload.includeSvg) === true;
                    const rendererPreference = normalizeMermaidRendererPreference(payload.renderer);

                    if (!source.trim()) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing source' }));
                        return;
                    }

                    const rendered = await renderMermaidWithPreference(source, {
                        maxWidth,
                        maxHeight,
                        renderScale,
                        includeStages,
                        includeSvg,
                        rendererPreference,
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(rendered));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/render/mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/clipboard/image') {
                try {
                    const payload = await readJsonBody(req, {
                        maxBytes: CLIPBOARD_BODY_LIMIT_BYTES,
                        spoolThresholdBytes: REQUEST_BODY_SPOOL_THRESHOLD_BYTES,
                    });
                    const pngBase64 = typeof payload.pngBase64 === 'string' ? payload.pngBase64.trim() : '';
                    if (!pngBase64) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing pngBase64' }));
                        return;
                    }

                    const pngBuffer = Buffer.from(pngBase64, 'base64');
                    if (!pngBuffer.length || !isPngBuffer(pngBuffer)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid PNG payload' }));
                        return;
                    }

                    try {
                        await copyPngToClipboard(pngBuffer);
                    } finally {
                        pngBuffer.fill(0);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/clipboard/image');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/clipboard/image-binary') {
                try {
                    const pngBuffer = await readBinaryBody(req, {
                        maxBytes: CLIPBOARD_BODY_LIMIT_BYTES,
                        spoolThresholdBytes: REQUEST_BODY_SPOOL_THRESHOLD_BYTES,
                    });
                    if (!pngBuffer.length || !isPngBuffer(pngBuffer)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid PNG payload' }));
                        return;
                    }

                    try {
                        await copyPngToClipboard(pngBuffer);
                    } finally {
                        pngBuffer.fill(0);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, transport: 'binary' }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/clipboard/image-binary');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(error) }));
                }
                return;
            } else if (req.url === '/api/build') {
                try {
                    const payload = await readJsonBody(req);
                    const { target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug } = payload;
                    logDiagnostic('Received build request for:', target, 'maxWorkers:', maxWorkers, 'enableGPU:', enableGPU, 'enableGPULayout:', enableGPULayout, 'memorySavingMode:', memorySavingMode, 'deepDebug:', deepDebug);
                    const buildKey = JSON.stringify({
                        target,
                        maxWorkers,
                        enableGPU,
                        enableGPULayout,
                        memorySavingMode,
                        deepDebug
                    });

                    // De-duplicate accidental double-submit from frontend.
                    if (activeBuildPromise) {
                        if (activeBuildKey === buildKey) {
                            logDiagnostic('[Build] Duplicate request detected. Waiting for in-flight build.');
                            await activeBuildPromise;
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: true,
                                deduped: true,
                                computeModes: collectComputeModeSnapshot()
                            }));
                            return;
                        }

                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Another build is in progress' }));
                        return;
                    }
                    
                    const buildTarget = target === 'ALL_FOLDERS' ? '' : target;
                    
                    // Resolve to ABSOLUTE path, matching legacy desktop runtime behavior.
                    // NoteConnection.ts uses targetPath directly if absolute, skipping kbRoot fallback.
                    // Without this, the relative path "financial" would be resolved against
                    // dist/Knowledge_Base/ (via __dirname) which does not exist.
                    // å°†ç›¸å¯¹è·¯å¾„è§£æžä¸ºç»å¯¹è·¯å¾„ï¼Œå¯¹é½åŽ†å²æ¡Œé¢è¿è¡Œæ—¶è¯­ä¹‰ã€‚
                    let targetToBuild: string | undefined;
                    if (buildTarget) {
                        targetToBuild = path.join(KB_ROOT, buildTarget);
                    } else {
                        targetToBuild = KB_ROOT;
                    }
                    
                    const buildPromise = buildGraph({
                        targetPath: targetToBuild,
                        maxWorkers,
                        enableGPU,
                        enableGPULayout,
                        memorySavingMode,
                        deepDebug
                    }).then(() => undefined);
                    activeBuildKey = buildKey;
                    activeBuildPromise = buildPromise;

                    try {
                        await buildPromise;
                    } finally {
                        if (activeBuildPromise === buildPromise) {
                            activeBuildPromise = null;
                            activeBuildKey = null;
                        }
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        computeModes: collectComputeModeSnapshot()
                    }));
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/build');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } else if (req.url === '/api/kb-path') {
                try {
                    const payload = await readJsonBody(req);
                    const kbPath = typeof payload.kbPath === 'string' ? payload.kbPath.trim() : '';
                    if (kbPath) {
                        const resolvedKbPath = path.resolve(kbPath);
                        if ((process as NodeJS.Process & { pkg?: unknown }).pkg && isPkgSnapshotPath(resolvedKbPath)) {
                            res.writeHead(403, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: false,
                                error: 'pkg snapshot paths are not allowed as Knowledge Base roots'
                            }));
                            return;
                        }
                        KB_ROOT = resolvedKbPath;
                        logDiagnostic(`[API] Knowledge Base Root updated to: ${KB_ROOT}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, kbPath: KB_ROOT }));
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing kbPath' }));
                    }
                } catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            }
        }
    });
    
    return new Promise<http.Server>((resolve, reject) => {
        const explicitEphemeralFallback = parseBooleanFlag(
            process.env.NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK
        );
        const hasExplicitPortSetting =
            typeof options.port === 'number' ||
            String(process.env.NOTE_CONNECTION_PORT || '').trim().length > 0 ||
            String(process.env.PORT || '').trim().length > 0;
        const allowEphemeralFallback = explicitEphemeralFallback;

        const initializeRuntime = async (resolvedPort: number): Promise<void> => {
            runtimePort = resolvedPort;
            await ensureRuntimeDataDir();
            await writeSidecarRuntimeManifest(resolvedPort);
            logDiagnostic(`[Sidecar] Runtime Manifest: ${SIDECAR_RUNTIME_MANIFEST}`);
            logDiagnostic(`Server running at http://${LOOPBACK_HOST}:${resolvedPort}/`);
            logDiagnostic(`Knowledge Base Root: ${KB_ROOT}`);
            logDiagnostic(`Frontend Root: ${FRONTEND_DIR}`);
            logDiagnostic(`Runtime Data Root: ${RUNTIME_DATA_DIR}`);

            // Initialize PathBridge
            try {
                pathBridge = new PathBridge({
                    port: PATH_BRIDGE_PORT,
                    host: LOOPBACK_HOST,
                    authToken: AUTH_TOKEN,
                });
                logDiagnostic(`[Sidecar] PathBridge initialized on ws://${LOOPBACK_HOST}:${PATH_BRIDGE_PORT}`);
            } catch (e) {
                console.error(`[Sidecar] Failed to initialize PathBridge:`, e);
            }

            if (hasCliBuild) {
                    logDiagnostic('[CLI] Ready.');
            }
        };

        const attachListenHandlers = (targetPort: number): void => {
            const onError = (error: NodeJS.ErrnoException): void => {
                server.off('listening', onListening);
                if (error?.code === 'EADDRINUSE' && allowEphemeralFallback && targetPort === finalPort) {
                    warnDiagnostic(
                        `[Sidecar] Port ${finalPort} is already in use. Retrying with an ephemeral loopback port.`
                    );
                    attachListenHandlers(0);
                    return;
                }
                if (error?.code === 'EADDRINUSE' && targetPort === finalPort && !allowEphemeralFallback) {
                    const guidanceError = new Error(
                        `[Sidecar] Port ${finalPort} is already in use. ` +
                        'Ephemeral port fallback is disabled by default to keep origin policy deterministic. ' +
                        'Set NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK=1 to opt in explicitly.'
                    ) as NodeJS.ErrnoException;
                    guidanceError.code = 'EADDRINUSE';
                    reject(guidanceError);
                    return;
                }
                reject(error);
            };

            const onListening = (): void => {
                server.off('error', onError);
                const address = server.address();
                const resolvedPort = (address && typeof address === 'object') ? address.port : targetPort;
                void (async () => {
                    try {
                        await initializeRuntime(resolvedPort);
                        resolve(server);
                    } catch (error) {
                        reject(error as Error);
                    }
                })();
            };

            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(targetPort, LOOPBACK_HOST);
        };

        attachListenHandlers(finalPort);
    });
};

// Only run if called directly
if (require.main === module) {
    if (args[0] === 'notemd') {
        executeNotemdCliCommand(args.slice(1))
            .then((result) => {
                console.log(JSON.stringify(result, null, 2));
                process.exit(0);
            })
            .catch((error) => {
                console.error(`[NoteMD CLI] ${error instanceof Error ? error.message : String(error)}`);
                process.exit(1);
            });
    } else {
        startServer();
    }
}
