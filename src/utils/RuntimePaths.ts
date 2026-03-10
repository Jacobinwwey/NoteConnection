import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface RuntimePaths {
    projectRoot: string;
    frontendDir: string;
    runtimeDataDir: string;
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

function resolveAppDataRoot(cwd: string): string {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA;
    if (localAppData) {
        return path.join(localAppData, 'NoteConnection');
    }

    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) {
        return path.join(home, '.noteconnection');
    }

    return path.join(cwd, '.noteconnection');
}

function ensureWritableDirectory(targetPath: string): boolean {
    try {
        fs.mkdirSync(targetPath, { recursive: true });
        const probe = path.join(targetPath, '.nc_write_probe');
        fs.writeFileSync(probe, 'ok');
        fs.unlinkSync(probe);
        return true;
    } catch {
        return false;
    }
}

function normalizeKnowledgeBaseRoot(targetPath: string): string {
    const resolved = path.resolve(targetPath);
    if (!isDirectory(resolved)) {
        return resolved;
    }

    let cursor = resolved;
    while (true) {
        if (path.basename(cursor).toLowerCase() === 'knowledge_base') {
            return cursor;
        }

        const parent = path.dirname(cursor);
        if (parent === cursor) {
            break;
        }
        cursor = parent;
    }

    const nestedKnowledgeBase = path.join(resolved, 'Knowledge_Base');
    if (isDirectory(nestedKnowledgeBase)) {
        return path.resolve(nestedKnowledgeBase);
    }

    return resolved;
}

export function resolveRuntimePaths(moduleDir: string): RuntimePaths {
    const cwd = process.cwd();
    const execDir = path.dirname(process.execPath);

    const envProjectRoot = process.env.NOTE_CONNECTION_PROJECT_ROOT;
    const envFrontendDir = process.env.NOTE_CONNECTION_FRONTEND_DIR;
    const envRuntimeDataDir = process.env.NOTE_CONNECTION_RUNTIME_DATA_DIR;
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

    const runtimeDataCandidates = uniqPaths(
        [
            envRuntimeDataDir,
            path.join(resolveAppDataRoot(cwd), 'runtime_data'),
            path.join(projectRoot, 'runtime_data'),
            path.join(cwd, 'runtime_data'),
            path.join(os.tmpdir(), 'noteconnection', 'runtime_data')
        ].filter((v): v is string => Boolean(v))
    );

    const runtimeDataDirCandidate = runtimeDataCandidates.find((candidate) => ensureWritableDirectory(candidate))
        || path.join(resolveAppDataRoot(cwd), 'runtime_data');
    if (!ensureWritableDirectory(runtimeDataDirCandidate)) {
        throw new Error(`Unable to provision writable runtime data directory: ${runtimeDataDirCandidate}`);
    }
    const runtimeDataDir = path.resolve(runtimeDataDirCandidate);

    const kbCandidates = uniqPaths(
        [
            envKbRoot,
            path.join(projectRoot, 'Knowledge_Base'),
            path.join(cwd, 'Knowledge_Base'),
            path.join(cwd, '..', 'Knowledge_Base')
        ].filter((v): v is string => Boolean(v))
    );

    const kbRootCandidate =
        pickExisting(kbCandidates) || kbCandidates[0] || path.join(projectRoot, 'Knowledge_Base');
    const kbRoot = normalizeKnowledgeBaseRoot(kbRootCandidate);

    return {
        projectRoot,
        frontendDir,
        runtimeDataDir,
        kbRoot
    };
}
