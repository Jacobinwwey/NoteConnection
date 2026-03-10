#!/usr/bin/env node
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
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

// Initialize Global Crash Handlers
CrashLogger.initGlobalHandlers();

const LOOPBACK_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.NOTE_CONNECTION_PORT || process.env.PORT || DEFAULT_PORT);
const PATH_BRIDGE_PORT = Number(process.env.NOTE_CONNECTION_BRIDGE_PORT || 9876);
const AUTH_TOKEN = String(process.env.NOTE_CONNECTION_AUTH_TOKEN || '').trim();
let pathBridge: PathBridge | null = null;
const REQUEST_BODY_LIMIT_BYTES = 512 * 1024;
const CLIPBOARD_BODY_LIMIT_BYTES = 8 * 1024 * 1024;
const REQUEST_BODY_SPOOL_THRESHOLD_BYTES = 256 * 1024;
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

type MermaidRendererPreference = 'auto' | 'local' | 'frontend';

type ReadJsonBodyOptions = {
    maxBytes?: number;
    spoolThresholdBytes?: number;
};

function collectComputeModeSnapshot() {
    return {
        layoutEngine: LayoutEngine.getLastComputeDiagnostics(),
        graphMetrics: GraphMetrics.getLastComputeDiagnostics()
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

function ensureRuntimeDataDir(): void {
    if (!fs.existsSync(RUNTIME_DATA_DIR)) {
        fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
    }
}

function ensureRequestBodySpoolDir(): void {
    if (!fs.existsSync(REQUEST_BODY_SPOOL_DIR)) {
        fs.mkdirSync(REQUEST_BODY_SPOOL_DIR, { recursive: true });
    }
}

function isFsNotFoundError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}

function isRequestBodyTooLargeError(error: unknown): boolean {
    return error instanceof Error && error.message === 'Request body is too large.';
}

function makeRequestBodyTooLargeError(): Error {
    return new Error('Request body is too large.');
}

function generatedAssetWritePath(filename: string): string {
    ensureRuntimeDataDir();
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
            console.warn('[Sidecar] Failed to clean up temporary request body file:', error);
        }
    }
}

function isJsonLikeContentType(req: http.IncomingMessage): boolean {
    const contentType = typeof req.headers['content-type'] === 'string'
        ? req.headers['content-type'].split(';', 1)[0].trim().toLowerCase()
        : '';
    return !contentType || contentType === 'application/json' || contentType.endsWith('+json');
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
                ensureRequestBodySpoolDir();
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

function writeSidecarRuntimeManifest(finalPort: number): void {
    try {
        const manifestDir = path.dirname(SIDECAR_RUNTIME_MANIFEST);
        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(
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
        console.warn('[Sidecar] Failed to write runtime manifest:', error);
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
            console.warn('[Reader] Frontend Mermaid render unavailable, falling back to local resvg:', error);
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
    const normalized = rawFilePath.replace(/\\/g, '/');
    const normalizedCandidate = path.normalize(normalized);

    const relativeFromKb = extractRelativePathFromKbMarker(rawFilePath);
    if (relativeFromKb) {
        return path.join(kbRoot, path.normalize(relativeFromKb));
    }

    if (path.isAbsolute(normalizedCandidate)) {
        return normalizedCandidate;
    }

    return path.join(kbRoot, normalizedCandidate);
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
    const rootResolved = path.resolve(rootPath);
    const candidateResolved = path.resolve(candidatePath);
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
    console.log('[CLI] Static mode requested (via env).');
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
        console.log('[CLI] Static mode requested (Frontend auto-detects large graphs).');
    } else if (arg === '--workers' && args[i+1]) {
        cliOptions.maxWorkers = parseInt(args[++i]);
    }
    // Heuristic for Positional Args (if flags were stripped)
    // If not a flag (doesn't start with -) and looks like a path (contains / or \)
    else if (!arg.startsWith('-') && (arg.includes('/') || arg.includes('\\') || fs.existsSync(path.resolve(KB_ROOT, arg)))) {
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

// FIX: If targetPath is 'true' (from bad npm config parsing), try to fix it using heuristic or fail gracefully.
if (cliOptions.targetPath === 'true') {
    // If we have a positional argument that looks like a path, use it instead.
    // The previous loop might have missed it if we prioritized env vars blindly.
    // Let's re-scan args for a non-flag string that isn't 'true'.
    const fallbackPath = args.find(a => !a.startsWith('-') && a !== 'true' && (a.includes('/') || a.includes('\\') || fs.existsSync(path.resolve(KB_ROOT, a))));
    if (fallbackPath) {
        cliOptions.targetPath = fallbackPath;
    } else {
        // If still 'true', we have a problem.
        console.warn("[CLI] Warning: targetPath detected as 'true'. This usually means npm consumed the flag incorrectly. Please check your command syntax.");
    }
}

console.log('[CLI] Parsed Options:', cliOptions);

// Generate timestamp for CLI output if CLI args are used
if (hasCliBuild) {
    // Determine Knowledge Base Name
    const kbName = path.basename(cliOptions.targetPath || 'knowledge_base');
    
    // Check for existing CLI builds for this KB
    let existingFile: string | null = null;
    if (fs.existsSync(RUNTIME_DATA_DIR)) {
        const files = fs.readdirSync(RUNTIME_DATA_DIR);
        // Look for data_cli_{kbName}_{time}.js
        // Pattern: data_cli_KB_TIME.js
        const prefix = `data_cli_${kbName}_`;
        const matches = files
            .filter(f => f.startsWith(prefix) && f.endsWith('.js'))
            .sort()
            .reverse(); // Newest first

        if (matches.length > 0) {
            existingFile = matches[0]; // Latest
        }
    }

    // Wrap async prompt logic in an IIFE or handle before server start
    // Since top-level await is not always available depending on config, we'll handle this in server.listen callback or separate async function.
    // However, server.listen is async. We can move this logic into `startServer` function.
}

export const startServer = async (options: { port?: number, targetPath?: string } = {}) => {
    // If options are provided, override CLI/Env defaults or merge them
    if (options.targetPath) {
        cliOptions.targetPath = options.targetPath;
        hasCliBuild = true; // Assume explicit path implies specific build intent or context
    }
    const finalPort = options.port || PORT;

    if (hasCliBuild) {
        const kbName = path.basename(cliOptions.targetPath || 'knowledge_base');
        let useExisting = false;
        
        // Only do interactive prompt if we are in a TTY and effectively running standalone
        // For Electron auto-start, we might want to skip this or handle it differently.
        // For now, if passed via options, we assume 'Regenerate' or 'Load' should be automatic or decided by caller?
        // Let's keep existing logic but realize it might block if no TTY.
        // CHECK: If options.targetPath is passed, do we skip the prompt? 
        // If we are required to not block, we should probably default to "Load" if exists, or "Gen" if not.
        
        if (fs.existsSync(RUNTIME_DATA_DIR)) {
            const files = fs.readdirSync(RUNTIME_DATA_DIR);
            const prefix = `data_cli_${kbName}_`;
            const matches = files
                .filter(f => f.startsWith(prefix) && f.endsWith('.js'))
                .sort()
                .reverse();

            if (matches.length > 0) {
                const latest = matches[0];
                console.log(`\n[CLI] Found existing build for '${kbName}': ${latest}`);
                
                // If specific options passed (embedded mode), default to Load to avoid blocking
                // Otherwise use interactive prompt
                if (options.targetPath) {
                     useExisting = true;
                     const suffix = latest.replace('data_cli_', '').replace('.js', '');
                     cliOptions.outputPrefix = suffix;
                     console.log(`[CLI] Auto-Loading existing data: ${latest}`);
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
                        console.log(`[CLI] Loading existing data: ${latest}`);
                    }
                }
            }
        }

        if (!useExisting) {
            const now = new Date();
            const timeStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
            cliOptions.outputPrefix = `${kbName}_${timeStr}`;
            
            console.log(`[CLI] Generating new knowledge graph for: ${cliOptions.targetPath}`);
            try {
                await buildGraph(cliOptions);
                console.log('[CLI] Generation complete.');
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
                            port: finalPort,
                            bridgePort: PATH_BRIDGE_PORT,
                            kbRoot: KB_ROOT,
                            frontendDir: FRONTEND_DIR,
                            runtimeDataDir: RUNTIME_DATA_DIR,
                            authRequired: AUTH_TOKEN.length > 0
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
                        console.log(`[Cache] Duplicate restore suppressed for ${target}`);
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
        } else if (req.method === 'POST') {
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
                        spoolThresholdBytes: 128 * 1024,
                    });
                    const pngBase64 = typeof payload.pngBase64 === 'string' ? payload.pngBase64.trim() : '';
                    if (!pngBase64) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing pngBase64' }));
                        return;
                    }

                    const pngBuffer = Buffer.from(pngBase64, 'base64');
                    if (!pngBuffer.length) {
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
            } else if (req.url === '/api/build') {
                try {
                    const payload = await readJsonBody(req);
                    const { target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug } = payload;
                    console.log('Received build request for:', target, 'maxWorkers:', maxWorkers, 'enableGPU:', enableGPU, 'enableGPULayout:', enableGPULayout, 'memorySavingMode:', memorySavingMode, 'deepDebug:', deepDebug);
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
                            console.log('[Build] Duplicate request detected. Waiting for in-flight build.');
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
                        KB_ROOT = path.resolve(kbPath);
                        console.log(`[API] Knowledge Base Root updated to: ${KB_ROOT}`);
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
        const hasExplicitPortSetting =
            typeof options.port === 'number' ||
            String(process.env.NOTE_CONNECTION_PORT || '').trim().length > 0 ||
            String(process.env.PORT || '').trim().length > 0;
        const allowEphemeralFallback = !hasExplicitPortSetting;

        const initializeRuntime = (resolvedPort: number): void => {
            ensureRuntimeDataDir();
            writeSidecarRuntimeManifest(resolvedPort);
            console.log(`[Sidecar] Runtime Manifest: ${SIDECAR_RUNTIME_MANIFEST}`);
            console.log(`Server running at http://${LOOPBACK_HOST}:${resolvedPort}/`);
            console.log(`Knowledge Base Root: ${KB_ROOT}`);
            console.log(`Frontend Root: ${FRONTEND_DIR}`);
            console.log(`Runtime Data Root: ${RUNTIME_DATA_DIR}`);

            // Initialize PathBridge
            try {
                pathBridge = new PathBridge({
                    port: PATH_BRIDGE_PORT,
                    host: LOOPBACK_HOST,
                    authToken: AUTH_TOKEN,
                });
                console.log(`[Sidecar] PathBridge initialized on ws://${LOOPBACK_HOST}:${PATH_BRIDGE_PORT}`);
            } catch (e) {
                console.error(`[Sidecar] Failed to initialize PathBridge:`, e);
            }

            if (hasCliBuild) {
                console.log('[CLI] Ready.');
            }
        };

        const attachListenHandlers = (targetPort: number): void => {
            const onError = (error: NodeJS.ErrnoException): void => {
                server.off('listening', onListening);
                if (error?.code === 'EADDRINUSE' && allowEphemeralFallback && targetPort === finalPort) {
                    console.warn(
                        `[Sidecar] Port ${finalPort} is already in use. Retrying with an ephemeral loopback port.`
                    );
                    attachListenHandlers(0);
                    return;
                }
                reject(error);
            };

            const onListening = (): void => {
                server.off('error', onError);
                const address = server.address();
                const resolvedPort = (address && typeof address === 'object') ? address.port : targetPort;
                try {
                    initializeRuntime(resolvedPort);
                    resolve(server);
                } catch (error) {
                    reject(error as Error);
                }
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
    startServer();
}


