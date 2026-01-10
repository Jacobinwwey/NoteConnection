#!/usr/bin/env node
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from './index';
import { CrashLogger } from './backend/utils/CrashLogger';

// Initialize Global Crash Handlers
CrashLogger.initGlobalHandlers();

const PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');
const KB_ROOT = path.join(process.cwd(), 'Knowledge_Base');

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
                // We allow access if it's within KB_ROOT or if it was explicitly loaded (we trust metadata.filepath from build)
                // However, for safety in this server, we should probably check if it exists and is a file.
                // Ideally, we verify it is within project root or KB root.
                // Let's rely on checking if it exists for now, but to prevent arbitrary system read, enforce some bounds?
                // The user is local, but good practice.
                // For now, let's allow if it exists and is a file.
                
                const filePath = path.resolve(decodeURIComponent(requestedPath));
                
                // Simple security check: Must be inside project root
                const projectRoot = process.cwd();
                if (!filePath.startsWith(projectRoot)) {
                     // Warn but maybe allow if it's a test case outside? 
                     // Stricter: Must be inside Knowledge_Base? 
                     // The user said "E:\Knowledge_project\NoteConnection_app\Knowledge_Base\..."
                     // So strict check on KB_ROOT is safer.
                     if (!filePath.startsWith(KB_ROOT)) {
                         // Double check if it matches target passed in build? 
                         // We don't know the build target here easily.
                         // Let's allow but log warning? Or just block.
                         // Block is safer.
                         res.writeHead(403, { 'Content-Type': 'application/json' });
                         res.end(JSON.stringify({ error: 'Access denied: Path outside Knowledge Base' }));
                         return;
                     }
                }

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
                    
                    // If target is "ALL_FOLDERS", pass empty string or specific flag to buildGraph?
                    // buildGraph handles empty/undefined as "Knowledge_Base" root scan (recursive).
                    // So if target is "", it scans everything under Knowledge_Base.
                    
                    const buildTarget = target === 'ALL_FOLDERS' ? '' : target;
                    
                    await buildGraph(buildTarget, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug);
                    
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

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Knowledge Base Root: ${KB_ROOT}`);
});
