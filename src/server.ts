#!/usr/bin/env node
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { buildGraph } from './index';
import { CrashLogger } from './backend/utils/CrashLogger';
import { PathBridge } from './core/PathBridge';
import { resolveRuntimePaths } from './utils/RuntimePaths';

// Initialize Global Crash Handlers
CrashLogger.initGlobalHandlers();

const PORT = 3000;
const runtimePaths = resolveRuntimePaths(__dirname);
const FRONTEND_DIR = runtimePaths.frontendDir;
const RUNTIME_DATA_DIR = runtimePaths.runtimeDataDir;
let KB_ROOT = runtimePaths.kbRoot;
let activeBuildKey: string | null = null;
let activeBuildPromise: Promise<void> | null = null;
let lastRestoreKey: string | null = null;
let lastRestoreTs = 0;

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

function resolveGeneratedAssetForRead(filename: string): string | null {
    const runtimeFile = path.join(RUNTIME_DATA_DIR, filename);
    if (fs.existsSync(runtimeFile) && fs.statSync(runtimeFile).isFile()) {
        return runtimeFile;
    }

    const bundledFile = path.join(FRONTEND_DIR, filename);
    if (fs.existsSync(bundledFile) && fs.statSync(bundledFile).isFile()) {
        return bundledFile;
    }

    return null;
}

function generatedAssetWritePath(filename: string): string {
    ensureRuntimeDataDir();
    return path.join(RUNTIME_DATA_DIR, filename);
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

function collectAvailableTargetsFromPath(kbRoot: string): string[] {
    const targets = new Set<string>();

    if (fs.existsSync(kbRoot)) {
        const entries = fs.readdirSync(kbRoot, { withFileTypes: true });
        entries
            .filter((entry) => entry.isDirectory())
            .forEach((entry) => targets.add(entry.name));
    }

    [RUNTIME_DATA_DIR, FRONTEND_DIR].forEach((dir) => {
        if (!fs.existsSync(dir)) {
            return;
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach((entry) => {
            if (!entry.isFile()) {
                return;
            }
            const parsed = parseCachedTargetFromFileName(entry.name);
            if (parsed) {
                targets.add(parsed);
            }
        });
    });

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

    if (path.isAbsolute(normalizedCandidate) && fs.existsSync(normalizedCandidate)) {
        return normalizedCandidate;
    }

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
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
    
        if (req.method === 'GET') {
            if (req.url === '/api/folders') {
                try {
                    // Use configured path or default
                    // Note: KB_ROOT is currently module-level constant. We should probably make it dynamic?
                    // For now, if we pass targetPath, we might be focusing on THAT path.
                    // But /api/folders lists "Knowledge_Base" by default.
                    
                    if (!fs.existsSync(KB_ROOT)) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ folders: [] }));
                        return;
                    }
                    const entries = fs.readdirSync(KB_ROOT, { withFileTypes: true });
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
                    const targets = collectAvailableTargetsFromPath(KB_ROOT);
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
                    const urlObj = new URL(req.url, `http://${req.headers.host}`);
                    const requestedPath = urlObj.searchParams.get('path');
                    
                    if (!requestedPath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing path parameter' }));
                        return;
                    }

                    const decodedPath = decodeURIComponent(requestedPath);
                    const kbRootCanonical = fs.realpathSync(KB_ROOT);
                    const candidatePath = resolveContentCandidatePath(kbRootCanonical, decodedPath);

                    if (!fs.existsSync(candidatePath)) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File not found' }));
                        return;
                    }

                    const filePathCanonical = fs.realpathSync(candidatePath);
                    if (!isPathInsideRoot(filePathCanonical, kbRootCanonical)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Requested file is outside configured knowledge base' }));
                        return;
                    }

                    if (!fs.statSync(filePathCanonical).isFile()) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File not found' }));
                        return;
                    }

                    const content = fs.readFileSync(filePathCanonical, 'utf-8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ content }));
    
                } catch (error) {
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
                const assetUrlObj = new URL(req.url, `http://${req.headers.host}`);
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
                        ? resolveGeneratedAssetForRead(filename)
                        : null;
                    const bundledPath = path.join(FRONTEND_DIR, filename);
                    const filePath = generatedPath || (fs.existsSync(bundledPath) ? bundledPath : null);

                    if (filePath && fs.statSync(filePath).isFile()) {
                        const ext = path.extname(filename);
                        const contentType = ext === '.json' ? 'application/json' : 'application/javascript';
                        
                        try {
                            const content = fs.readFileSync(filePath);
                            res.writeHead(200, { 'Content-Type': contentType });
                            res.end(content);
                            return;
                        } catch (err) {
                            res.writeHead(500, { 'Content-Type': contentType });
                            res.end(`console.error('Failed to load asset: ${String(err)}');`);
                            return;
                        }
                    }
                }
                // Let it fall through to static serving/404 if not found.
            }

            // GET /api/kb-path — Return current Knowledge Base root path
            // Legacy parity mapping: replaced historical desktop IPC getter.
            // 返回当前知识库根路径（历史 IPC getter 的桥接替代实现）。
            if (req.url === '/api/kb-path') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ kbPath: KB_ROOT }));
                return;
            }

            // GET /api/check-cache?target=financial — Check if cached graph exists
            // Legacy parity mapping for previous desktop cache-check flow.
            // 检查指定目标的图谱缓存是否存在（历史桌面缓存检查链路的桥接实现）。
            if (req.url?.startsWith('/api/check-cache')) {
                try {
                    const urlObj = new URL(req.url, `http://${req.headers.host}`);
                    const target = urlObj.searchParams.get('target');
                    
                    if (!target) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(null));
                        return;
                    }

                    if (target === 'ALL_FOLDERS') {
                        const activeJsPath = resolveGeneratedAssetForRead('data.js');
                        if (activeJsPath) {
                            const stats = fs.statSync(activeJsPath);
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
                    const cachePath = resolveGeneratedAssetForRead(`data_${targetName}.js`);
                    
                    if (cachePath) {
                        const stats = fs.statSync(cachePath);
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

            // GET /api/restore-cache?target=financial — Restore cached graph as active data
            // Legacy parity mapping for previous desktop cache-restore flow.
            // Copies data_{target}.js → data.js and graph_data_{target}.json → graph_data.json
            // 从缓存恢复图谱数据（历史桌面 restoreCache 链路的桥接实现）。
            if (req.url?.startsWith('/api/restore-cache')) {
                try {
                    const urlObj = new URL(req.url, `http://${req.headers.host}`);
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
                        const activeJsPath = resolveGeneratedAssetForRead('data.js');
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
                    
                    const cacheJs = resolveGeneratedAssetForRead(`data_${targetName}.js`);
                    const targetJs = generatedAssetWritePath('data.js');
                    const cacheJson = resolveGeneratedAssetForRead(`graph_data_${targetName}.json`);
                    const targetJson = generatedAssetWritePath('graph_data.json');
                    
                    if (cacheJs) {
                        fs.copyFileSync(cacheJs, targetJs);
                        if (cacheJson) {
                            fs.copyFileSync(cacheJson, targetJson);
                        }
                        console.log(`[Cache] Restored cache for ${target} -> data.js`);
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
    
            // Serve Static Files
            // v0.9.83 Fix: Strip query parameters (e.g. ?v=123) to verify file existence on disk
            const urlObj = new URL(req.url!, `http://${req.headers.host}`);
            let urlPath = urlObj.pathname === '/' ? 'index.html' : urlObj.pathname;
    
            // Security check: prevent traversing up
            const safeSuffix = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
            let filePath = path.join(FRONTEND_DIR, safeSuffix);
            
            const extname = path.extname(filePath);
            let contentType = 'text/html';
            
            switch (extname) {
                case '.js': contentType = 'text/javascript'; break;
                case '.css': contentType = 'text/css'; break;
                case '.json': contentType = 'application/json'; break;
                case '.png': contentType = 'image/png'; break;
                case '.jpg': contentType = 'image/jpeg'; break;
                case '.svg': contentType = 'image/svg+xml'; break;
                case '.ico': contentType = 'image/x-icon'; break;
            }
    
            fs.readFile(filePath, (error, content) => {
                if (error) {
                    if(error.code == 'ENOENT') {
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        CrashLogger.log(error, `StaticFile: ${safeSuffix}`);
                        res.writeHead(500);
                        res.end('Server Error: '+error.code);
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        } else if (req.method === 'POST') {
            if (req.url === '/api/build') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', async () => {
                    try {
                        const { target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug } = JSON.parse(body);
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
                                res.end(JSON.stringify({ success: true, deduped: true }));
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
                        // 将相对路径解析为绝对路径，对齐历史桌面运行时语义。
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
                        res.end(JSON.stringify({ success: true }));
                    } catch (error) {
                        console.error(error);
                        CrashLogger.log(error, 'API:POST /api/build');
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String(error) }));
                    }
                });
            } else if (req.url === '/api/kb-path') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const { kbPath } = JSON.parse(body);
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
                        console.error(error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String(error) }));
                    }
                });
            }
        }
    });
    
    return new Promise<http.Server>((resolve) => {
        server.listen(finalPort, async () => {
            ensureRuntimeDataDir();
            console.log(`Server running at http://localhost:${finalPort}/`);
            console.log(`Knowledge Base Root: ${KB_ROOT}`);
            console.log(`Frontend Root: ${FRONTEND_DIR}`);
            console.log(`Runtime Data Root: ${RUNTIME_DATA_DIR}`);
            
            // Initialize PathBridge
            try {
                new PathBridge(9876);
                console.log('[Sidecar] PathBridge initialized on port 9876');
            } catch (e) {
                console.error(`[Sidecar] Failed to initialize PathBridge:`, e);
            }
            
            if (hasCliBuild) {
                 console.log('[CLI] Ready.');
            }
            resolve(server);
        });
    });
};

// Only run if called directly
if (require.main === module) {
    startServer();
}
