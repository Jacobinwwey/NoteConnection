#!/usr/bin/env node
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from './index';

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
                    const { target } = JSON.parse(body);
                    console.log('Received build request for:', target);
                    
                    // If target is "ALL_FOLDERS", pass empty string or specific flag to buildGraph?
                    // buildGraph handles empty/undefined as "Knowledge_Base" root scan (recursive).
                    // So if target is "", it scans everything under Knowledge_Base.
                    
                    const buildTarget = target === 'ALL_FOLDERS' ? '' : target;
                    
                    await buildGraph(buildTarget);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    console.error(error);
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
