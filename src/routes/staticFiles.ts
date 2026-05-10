/**
 * Static file serving utilities.
 * Extracted from server.ts inline chain for reuse and testability.
 */
import * as fs from 'fs';
import * as path from 'path';

export function getStaticContentType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
        case '.html': return 'text/html';
        case '.js':   return 'text/javascript';
        case '.css':  return 'text/css';
        case '.json': return 'application/json';
        case '.png':  return 'image/png';
        case '.jpg': case '.jpeg': return 'image/jpeg';
        case '.svg':  return 'image/svg+xml';
        case '.ico':  return 'image/x-icon';
        case '.woff': return 'font/woff';
        case '.woff2': return 'font/woff2';
        case '.ttf':  return 'font/ttf';
        default:      return 'application/octet-stream';
    }
}

export function isPathInsideRoot(target: string, root: string): boolean {
    const resolved = path.resolve(target);
    const rootResolved = path.resolve(root) + path.sep;
    return resolved.startsWith(rootResolved) || resolved === path.resolve(root);
}

export function resolveFrontendStaticPath(
    rawUrl: string,
    frontendDir: string
): string | null {
    const normalized = String(rawUrl || '').replace(/^\/+/, '');
    const sanitized = normalized
        .split('/')
        .filter(segment => segment && segment !== '..')
        .join('/');

    if (!sanitized) return null;

    const resolved = path.resolve(frontendDir, sanitized);
    if (!isPathInsideRoot(resolved, frontendDir)) return null;

    return resolved;
}

export async function tryServeStaticFile(
    filePath: string,
    res: any
): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) return false;
        const content = await fs.promises.readFile(filePath);
        res.writeHead(200, { 'Content-Type': getStaticContentType(filePath) });
        res.end(content);
        return true;
    } catch {
        return false;
    }
}
