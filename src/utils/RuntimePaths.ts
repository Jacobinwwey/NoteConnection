import * as fs from 'fs';
import * as path from 'path';

export interface RuntimePaths {
    projectRoot: string;
    frontendDir: string;
    kbRoot: string;
}

function isDirectory(targetPath: string): boolean {
    try {
        return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    } catch {
        return false;
    }
}

function uniqPaths(paths: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    paths.forEach((p) => {
        const normalized = path.resolve(p);
        if (!seen.has(normalized)) {
            seen.add(normalized);
            result.push(normalized);
        }
    });

    return result;
}

function pickExisting(candidates: string[]): string | null {
    for (const candidate of candidates) {
        if (isDirectory(candidate)) {
            return candidate;
        }
    }
    return null;
}

export function resolveRuntimePaths(moduleDir: string): RuntimePaths {
    const cwd = process.cwd();
    const execDir = path.dirname(process.execPath);

    const envProjectRoot = process.env.NOTE_CONNECTION_PROJECT_ROOT;
    const envFrontendDir = process.env.NOTE_CONNECTION_FRONTEND_DIR;
    const envKbRoot = process.env.NOTE_CONNECTION_KB_ROOT;

    const projectCandidates = uniqPaths(
        [
            envProjectRoot,
            path.join(cwd, '..'),
            cwd,
            path.join(execDir, '..', '..'),
            path.join(moduleDir, '..'),
            path.join(moduleDir, '..', '..')
        ].filter((v): v is string => Boolean(v))
    );

    const projectFromKnowledgeBase = projectCandidates.find((candidate) =>
        isDirectory(path.join(candidate, 'Knowledge_Base'))
    );
    const projectFromFrontend = projectCandidates.find((candidate) => {
        return (
            isDirectory(path.join(candidate, 'dist', 'src', 'frontend')) ||
            isDirectory(path.join(candidate, 'src', 'frontend'))
        );
    });

    const projectRoot = projectFromKnowledgeBase || projectFromFrontend || path.resolve(moduleDir, '..');

    const frontendCandidates = uniqPaths(
        [
            envFrontendDir,
            path.join(projectRoot, 'dist', 'src', 'frontend'),
            path.join(projectRoot, 'src', 'frontend'),
            path.join(moduleDir, 'frontend')
        ].filter((v): v is string => Boolean(v))
    );

    const frontendDir =
        pickExisting(frontendCandidates) || path.join(projectRoot, 'dist', 'src', 'frontend');

    const kbCandidates = uniqPaths(
        [
            envKbRoot,
            path.join(projectRoot, 'Knowledge_Base'),
            path.join(cwd, 'Knowledge_Base'),
            path.join(cwd, '..', 'Knowledge_Base')
        ].filter((v): v is string => Boolean(v))
    );

    const kbRoot = pickExisting(kbCandidates) || kbCandidates[0];

    return {
        projectRoot,
        frontendDir,
        kbRoot
    };
}
