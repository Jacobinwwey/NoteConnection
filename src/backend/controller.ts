import * as fs from 'fs';
import * as path from 'path';
import { buildGraph } from '../index';

function normalizePathForComparison(candidatePath: string): string {
    const resolved = path.resolve(candidatePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
    const rootResolved = normalizePathForComparison(rootPath);
    const candidateResolved = normalizePathForComparison(candidatePath);
    const relative = path.relative(rootResolved, candidateResolved);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isPkgSnapshotPath(candidatePath: string): boolean {
    const normalized = normalizePathForComparison(candidatePath).replace(/\\/g, '/');
    return normalized.includes('/snapshot/');
}

function tryRealpath(targetPath: string): string {
    try {
        return fs.realpathSync(targetPath);
    } catch {
        return path.resolve(targetPath);
    }
}

export class NoteController {
    static getFolders(kbRoot: string): string[] {
        if (!fs.existsSync(kbRoot)) {
            console.warn(`[Controller] KB root does not exist: ${kbRoot}`);
            return [];
        }

        try {
            const subdirs = fs.readdirSync(kbRoot).filter((file) => {
                const fullPath = path.join(kbRoot, file);
                try {
                    return fs.statSync(fullPath).isDirectory();
                } catch (err) {
                    console.warn(`[Controller] Cannot access ${fullPath}:`, err);
                    return false;
                }
            });

            console.log(`[Controller] Found ${subdirs.length} subdirectories in KB root`);
            return subdirs;
        } catch (err) {
            console.error(`[Controller] Error reading KB root:`, err);
            return [];
        }
    }

    static getContent(targetPath: string, kbRoot: string): string {
        const resolvedPath = path.resolve(targetPath);
        const resolvedRoot = path.resolve(kbRoot);

        if ((process as NodeJS.Process & { pkg?: unknown }).pkg && isPkgSnapshotPath(resolvedPath)) {
            throw new Error('Access denied: pkg snapshot path is not allowed.');
        }

        if (!isPathInsideRoot(resolvedPath, resolvedRoot)) {
            throw new Error('Access denied: path outside Knowledge Base.');
        }

        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
            return '';
        }

        const canonicalRoot = tryRealpath(resolvedRoot);
        const canonicalPath = tryRealpath(resolvedPath);
        if (!isPathInsideRoot(canonicalPath, canonicalRoot)) {
            throw new Error('Access denied: canonical path outside Knowledge Base.');
        }

        return fs.readFileSync(canonicalPath, 'utf-8');
    }

    static async triggerBuild(options: any) {
        return await buildGraph(options);
    }
}
