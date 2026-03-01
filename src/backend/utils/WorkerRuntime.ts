import * as fs from 'fs';
import * as path from 'path';

export interface WorkerRuntimeResolution {
    workerPath: string | null;
    isTsNode: boolean;
    candidates: string[];
}

function isFile(filePath: string): boolean {
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function uniq(paths: string[]): string[] {
    const set = new Set<string>();
    const result: string[] = [];
    paths.forEach((p) => {
        const normalized = path.resolve(p);
        if (!set.has(normalized)) {
            set.add(normalized);
            result.push(normalized);
        }
    });
    return result;
}

export function resolveWorkerRuntimePath(baseDir: string, relativeTsPath: string): WorkerRuntimeResolution {
    const isTsNode = path.extname(__filename) === '.ts' || process.argv.some((arg) => arg.includes('ts-node'));
    const relativeJsPath = relativeTsPath.replace(/\.ts$/, '.js');
    const workerFileName = path.basename(relativeJsPath);
    const isPkgRuntime = Boolean((process as any).pkg);
    const execDir = path.dirname(process.execPath);

    const candidates = uniq(
        [
            isTsNode ? path.resolve(baseDir, relativeTsPath) : '',
            path.resolve(baseDir, relativeJsPath),
            isPkgRuntime ? path.resolve(process.cwd(), 'dist', 'src', 'backend', 'workers', workerFileName) : '',
            isPkgRuntime ? path.resolve(process.cwd(), '..', 'dist', 'src', 'backend', 'workers', workerFileName) : '',
            isPkgRuntime ? path.resolve(execDir, 'workers', workerFileName) : '',
            isPkgRuntime ? path.resolve(execDir, '..', 'workers', workerFileName) : '',
            isPkgRuntime ? path.resolve(execDir, '..', '..', 'dist', 'src', 'backend', 'workers', workerFileName) : ''
        ].filter(Boolean)
    );

    const workerPath = candidates.find((candidate) => isFile(candidate)) || null;

    return {
        workerPath,
        isTsNode,
        candidates
    };
}
