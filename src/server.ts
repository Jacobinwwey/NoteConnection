#!/usr/bin/env node
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { buildGraph } from './index';
import { CrashLogger } from './backend/utils/CrashLogger';

// Initialize Global Crash Handlers
CrashLogger.initGlobalHandlers();

const PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');
const KB_ROOT = path.join(process.cwd(), 'Knowledge_Base');

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
    if (fs.existsSync(FRONTEND_DIR)) {
        const files = fs.readdirSync(FRONTEND_DIR);
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
        
        if (fs.existsSync(FRONTEND_DIR)) {
            const files = fs.readdirSync(FRONTEND_DIR);
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
                        fs.mkdirSync(KB_ROOT, { recursive: true });
                    }
                    const entries = fs.readdirSync(KB_ROOT, { withFileTypes: true });
                    // Filter directories
                    const folders = entries
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name);
                    
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
    
            if (req.url?.startsWith('/api/content')) {
                try {
                    const urlObj = new URL(req.url, `http://${req.headers.host}`);
                    const requestedPath = urlObj.searchParams.get('path');
                    
                    if (!requestedPath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing path parameter' }));
                        return;
                    }
    
                    // Security: Ensure path is within allowed directories
                    
                    const filePath = path.resolve(decodeURIComponent(requestedPath));
                    
                    // Allow if it exists and is a file
                    // In Electron/Desktop mode, user trusts the local app, so stricter strict sandbox is less critical than web,
                    // but we still check existence to avoid crashes.
                    
                    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File not found' }));
                        return;
                    }
    
                    const content = fs.readFileSync(filePath, 'utf-8');
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
    
            // Serve Static Files
            let urlPath = req.url === '/' ? 'index.html' : req.url!;
            
            // CLI Mode: Serve the specific CLI data file instead of the default data.js
            // This ensures the frontend loads the data calculated from the CLI parameters
            // without modifying the original data.js file.
            if (urlPath === '/data.js' && hasCliBuild && cliOptions.outputPrefix) {
                urlPath = `/data_cli_${cliOptions.outputPrefix}.js`;
                console.log(`[Server] CLI Mode: Serving ${urlPath} instead of /data.js`);
            }
            if (urlPath === '/graph_data.json' && hasCliBuild && cliOptions.outputPrefix) {
                urlPath = `/graph_data_cli_${cliOptions.outputPrefix}.json`;
                console.log(`[Server] CLI Mode: Serving ${urlPath} instead of /graph_data.json`);
            }
    
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
                        
                        const buildTarget = target === 'ALL_FOLDERS' ? '' : target;
                        
                        await buildGraph({
                            targetPath: buildTarget,
                            maxWorkers,
                            enableGPU,
                            enableGPULayout,
                            memorySavingMode,
                            deepDebug
                        });
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (error) {
                        console.error(error);
                        CrashLogger.log(error, 'API:POST /api/build');
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String(error) }));
                    }
                });
            }
        }
    });
    
    return new Promise<http.Server>((resolve) => {
        server.listen(finalPort, async () => {
            console.log(`Server running at http://localhost:${finalPort}/`);
            console.log(`Knowledge Base Root: ${KB_ROOT}`);
            
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
