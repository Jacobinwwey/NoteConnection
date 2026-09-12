import type { RouteEntry, ServerContext } from './types';
import { CrashLogger } from '../backend/utils/CrashLogger';
import { buildCliCapabilityManifest } from '../notemd/operations/capabilityManifest';
import { buildCliInvocationContract } from '../notemd/operations/cliContracts';
import { listOperationDefinitions } from '../notemd/operations/registry';
import type { NotemdAgentManifest, NotemdAgentOperation } from '../shared/types';
import * as fs from 'fs';
import * as path from 'path';
import type * as http from 'http';
import type { NotemdSettings, ProgressEvent, ProgressReporter } from '../notemd';
import { loadAppConfigToml, saveAppConfigToml, resolveAppConfigPath } from '../notemd/AppConfigToml';
import { NOTEMD_PROVIDER_TEMPLATES, applyProviderTemplateToSettings, getNotemdProviderTemplate, mergeProviderTemplatesIntoNotemdSection } from '../notemd/providerTemplates';
type NotemdOperationState = {
    id: string;
    controller: AbortController;
    status: 'running' | 'done' | 'cancelled' | 'error';
    createdAt: number;
    updatedAt: number;
    logs: ProgressEvent[];
};
type NotemdWorkspaceState = {
    filePath: string;
    folderPath: string;
    outputFilePath: string;
    outputFolderPath: string;
};
class NotemdOperationAdmissionError extends Error {
    constructor(readonly statusCode: 400 | 409 | 429, readonly code: string) { super(code); }
}
export function registerNotemdRoutes(ctx: ServerContext): RouteEntry[] {
    const { notemdService, loadNotemdSettings, persistNotemdSettings, LOOPBACK_HOST, finalPort } = ctx;
    const { readJsonBody, writeBodyParseErrorResponse: writeIngressError, writeApiErrorResponse, resolvePathWithinKnowledgeBase, writeSseEvent, finishSseResponse, llmClient: notemdLlmClient } = ctx.notemdHttp;
    const NOTEMD_ACTIVE_OPERATIONS = new Map<string, NotemdOperationState>();
    const api = (pathname: string) => '/api/notemd' + pathname;
    const json = (res: http.ServerResponse, code: number, data: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const ok = (res: http.ServerResponse, data: unknown) => json(res, 200, { success: true, ...(data as object) });
    const writeBodyParseErrorResponse = (res: http.ServerResponse, error: unknown): boolean => {
        if (error instanceof NotemdOperationAdmissionError) {
            json(res, error.statusCode, { success: false, error: error.message, errorCode: error.code });
            return true;
        }
        if ((error as Error)?.name === 'AbortError' && !res.headersSent) {
            json(res, 499, { success: false, error: 'operation_cancelled', errorCode: 'operation_cancelled' });
            return true;
        }
        return writeIngressError(res, error);
    };
    const fail = (res: http.ServerResponse, error: unknown, label: string) => {
        if (writeBodyParseErrorResponse(res, error))
            return;
        if (isAccessDeniedError(error)) {
            json(res, 403, { success: false, error: String(error) });
            return;
        }
        console.error(error);
        CrashLogger.log(error, label);
        json(res, 500, { success: false, error: String(error) });
    };
    function isAccessDeniedError(error: unknown): boolean {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        return code === 'EACCES' || code === 'EPERM';
    }
    function isObjectRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }
    function extractNotemdWorkspaceState(settings: NotemdSettings): NotemdWorkspaceState {
        return {
            filePath: String(settings.workspaceFilePath || '').trim(),
            folderPath: String(settings.workspaceFolderPath || '').trim(),
            outputFilePath: String(settings.workspaceOutputFilePath || '').trim(),
            outputFolderPath: String(settings.workspaceOutputFolderPath || '').trim(),
        };
    }
    function normalizeWorkspaceField(source: Record<string, unknown>, keys: string[], fallback: string): string {
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(source, key)) {
                continue;
            }
            return String(source[key] || '').trim();
        }
        return fallback;
    }
    function applyWorkspacePatchToSettings(settings: NotemdSettings, workspacePatch: unknown): NotemdSettings {
        const next = { ...settings };
        if (!isObjectRecord(workspacePatch)) {
            return next;
        }
        next.workspaceFilePath = normalizeWorkspaceField(workspacePatch, ['filePath', 'file_path', 'workspaceFilePath', 'workspace_file_path'], next.workspaceFilePath);
        next.workspaceFolderPath = normalizeWorkspaceField(workspacePatch, ['folderPath', 'folder_path', 'workspaceFolderPath', 'workspace_folder_path'], next.workspaceFolderPath);
        next.workspaceOutputFilePath = normalizeWorkspaceField(workspacePatch, ['outputFilePath', 'output_file_path', 'workspaceOutputFilePath', 'workspace_output_file_path'], next.workspaceOutputFilePath);
        next.workspaceOutputFolderPath = normalizeWorkspaceField(workspacePatch, ['outputFolderPath', 'output_folder_path', 'workspaceOutputFolderPath', 'workspace_output_folder_path'], next.workspaceOutputFolderPath);
        return next;
    }
    async function persistNotemdWorkspacePatch(workspacePatch: unknown): Promise<NotemdWorkspaceState> {
        const settings = await loadNotemdSettings();
        const nextSettings = applyWorkspacePatchToSettings(settings, workspacePatch);
        const persisted = await persistNotemdSettings(nextSettings);
        return extractNotemdWorkspaceState(persisted);
    }
    async function ensureNotemdProviderTemplatesPersisted(): Promise<{
        configPath: string;
        persisted: boolean;
    }> {
        const appConfig = await loadAppConfigToml();
        const currentNotemdSection = isObjectRecord(appConfig.notemd) ? appConfig.notemd : {};
        const nextNotemdSection = mergeProviderTemplatesIntoNotemdSection(currentNotemdSection);
        const persisted = JSON.stringify(currentNotemdSection) !== JSON.stringify(nextNotemdSection);
        if (persisted) {
            await saveAppConfigToml({
                ...appConfig,
                notemd: nextNotemdSection,
            });
        }
        return {
            configPath: resolveAppConfigPath(),
            persisted,
        };
    }
    function generateNotemdOperationId(): string {
        return `notemd-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }
    function createNotemdOperation(operationIdCandidate: unknown, res: http.ServerResponse): NotemdOperationState {
        const requestedId = String(operationIdCandidate || '').trim();
        if (requestedId.length > 160)
            throw new NotemdOperationAdmissionError(400, 'invalid_operation_id');
        const operationId = requestedId || generateNotemdOperationId();
        if (NOTEMD_ACTIVE_OPERATIONS.has(operationId))
            throw new NotemdOperationAdmissionError(409, 'notemd_operation_conflict');
        if (Array.from(NOTEMD_ACTIVE_OPERATIONS.values()).filter(operation => operation.status === 'running').length >= 8) {
            throw new NotemdOperationAdmissionError(429, 'notemd_operation_capacity');
        }
        for (const [id, operation] of NOTEMD_ACTIVE_OPERATIONS) {
            if (NOTEMD_ACTIVE_OPERATIONS.size < 256)
                break;
            if (operation.status !== 'running')
                NOTEMD_ACTIVE_OPERATIONS.delete(id);
        }
        const state: NotemdOperationState = {
            id: operationId,
            controller: new AbortController(),
            status: 'running',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            logs: [],
        };
        NOTEMD_ACTIVE_OPERATIONS.set(operationId, state);
        res.once('close', () => {
            if (!res.writableFinished && state.status === 'running')
                state.controller.abort();
        });
        return state;
    }
    function finalizeNotemdOperation(state: NotemdOperationState, status: NotemdOperationState['status']): void {
        if (state.status !== 'running')
            return;
        state.status = status;
        state.updatedAt = Date.now();
        setTimeout(() => {
            const current = NOTEMD_ACTIVE_OPERATIONS.get(state.id);
            if (current === state && current.status !== 'running') {
                NOTEMD_ACTIVE_OPERATIONS.delete(state.id);
            }
        }, 60000).unref();
    }
    function createNotemdReporter(state: NotemdOperationState, res?: http.ServerResponse): ProgressReporter {
        return {
            report: (eventLike) => {
                const event: ProgressEvent = {
                    ...eventLike,
                    operationId: state.id,
                    timestamp: Date.now(),
                };
                if (state.logs.length >= 256)
                    state.logs.shift();
                state.logs.push(event);
                state.updatedAt = event.timestamp;
                if (res) {
                    writeSseEvent(res, event.type, event);
                }
            },
            isCancelled: () => state.controller.signal.aborted,
        };
    }
    function shouldStreamNotemdResponse(req: http.IncomingMessage): boolean {
        const acceptHeader = typeof req.headers.accept === 'string' ? req.headers.accept : '';
        if (acceptHeader.includes('text/event-stream')) {
            return true;
        }
        try {
            const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
            return urlObj.searchParams.get('stream') === '1';
        }
        catch (_error) {
            return false;
        }
    }
    const routes: RouteEntry[] = [
        { method: 'GET', path: '/api/notemd/settings', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const settings = await loadNotemdSettings();
                    const activeOperationCount = Array.from(NOTEMD_ACTIVE_OPERATIONS.values()).filter((operation) => operation.status === 'running').length;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        settings,
                        operationSummary: {
                            total: NOTEMD_ACTIVE_OPERATIONS.size,
                            running: activeOperationCount,
                        },
                    }));
                }
                catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/notemd/settings',
                        requestId,
                    });
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/settings', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const settingsCandidate = isObjectRecord(payload) && payload.settings !== undefined
                        ? payload.settings
                        : payload;
                    const settings = await persistNotemdSettings(settingsCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, settings }));
                }
                catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/notemd/settings',
                        requestId,
                    });
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/test-llm', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const providerName = String(payload.providerName || settings.activeProvider).trim();
                    const provider = settings.providers.find((item) => item.name === providerName);
                    if (!provider) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: `Unknown provider: ${providerName}` }));
                        return;
                    }
                    const result = await notemdLlmClient.testConnection(provider);
                    const statusCode = result.success ? 200 : 400;
                    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/test-llm');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/process-file', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId, res);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);
                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const resolvedOutputPath = payload.outputPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputPath, {
                            expectedType: 'any',
                            allowMissing: true,
                        })
                        : undefined;
                    const result = await notemdService.processFile({
                        filePath: resolvedFilePath,
                        outputPath: resolvedOutputPath,
                        createConceptNotes: payload.createConceptNotes === true,
                        dryRun: payload.dryRun === true,
                    }, settings, reporter, operation.controller.signal);
                    operation.controller.signal.throwIfAborted();
                    await persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: path.dirname(resolvedFilePath),
                        outputFilePath: resolvedOutputPath || result.outputPath || '',
                        outputFolderPath: path.dirname(resolvedOutputPath || result.outputPath || resolvedFilePath),
                    }).catch((workspaceError) => {
                        console.warn('[NoteMD] Failed to persist workspace state after process-file.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');
                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        await finishSseResponse(res);
                    }
                    else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            operationId: operation.id,
                            result,
                            logs: operation.logs,
                        }));
                    }
                }
                catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            await finishSseResponse(res);
                        }
                        else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/process-file');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        await finishSseResponse(res);
                    }
                    else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/process-folder', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId, res);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);
                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const resolvedOutputFolderPath = payload.outputFolderPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputFolderPath, {
                            expectedType: 'any',
                            allowMissing: true,
                        })
                        : undefined;
                    const result = await notemdService.processFolder({
                        folderPath: resolvedFolderPath,
                        outputFolderPath: resolvedOutputFolderPath,
                        createConceptNotes: payload.createConceptNotes === true,
                        dryRun: payload.dryRun === true,
                    }, settings, reporter, operation.controller.signal);
                    operation.controller.signal.throwIfAborted();
                    await persistNotemdWorkspacePatch({
                        folderPath: resolvedFolderPath,
                        outputFolderPath: resolvedOutputFolderPath || '',
                    }).catch((workspaceError) => {
                        console.warn('[NoteMD] Failed to persist workspace state after process-folder.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');
                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        await finishSseResponse(res);
                    }
                    else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            operationId: operation.id,
                            result,
                            logs: operation.logs,
                        }));
                    }
                }
                catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            await finishSseResponse(res);
                        }
                        else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/process-folder');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        await finishSseResponse(res);
                    }
                    else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/generate-content', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    let title = String(payload.title || '').trim();
                    const filePathCandidate = String(payload.filePath || '').trim();
                    if (!title && filePathCandidate) {
                        title = path.basename(filePathCandidate, path.extname(filePathCandidate));
                    }
                    if (!title) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing title or filePath' }));
                        return;
                    }
                    const content = await notemdService.generateContent(title, typeof payload.context === 'string' ? payload.context : undefined, settings);
                    let outputPath: string | null = null;
                    if (payload.outputPath) {
                        outputPath = await resolvePathWithinKnowledgeBase(payload.outputPath, {
                            expectedType: 'any',
                            allowMissing: true,
                        });
                    }
                    else if (filePathCandidate) {
                        outputPath = await resolvePathWithinKnowledgeBase(filePathCandidate, {
                            expectedType: 'any',
                            allowMissing: true,
                        });
                    }
                    if (outputPath) {
                        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
                        await fs.promises.writeFile(outputPath, content, 'utf8');
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        title,
                        outputPath,
                        content,
                    }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/generate-content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/translate-file', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const resolvedOutputPath = payload.outputPath
                        ? await resolvePathWithinKnowledgeBase(payload.outputPath, {
                            expectedType: 'any',
                            allowMissing: true,
                        })
                        : undefined;
                    const targetLanguage = String(payload.targetLanguage || settings.translateLanguage || settings.language).trim();
                    if (!targetLanguage) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing targetLanguage' }));
                        return;
                    }
                    const result = await notemdService.translateFile({
                        filePath: resolvedFilePath,
                        outputPath: resolvedOutputPath,
                        targetLanguage,
                    }, settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/translate-file');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/fix-mermaid', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const inPlace = payload.inPlace !== false;
                    const result = await notemdService.fixMermaid(resolvedFilePath, inPlace);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/fix-mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/fix-formulas', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const inPlace = payload.inPlace !== false;
                    const result = await notemdService.fixFormulas(resolvedFilePath, inPlace);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/fix-formulas');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/check-duplicates', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.checkDuplicates(resolvedFilePath);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/check-duplicates');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/extract-concepts', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                const streamEnabled = shouldStreamNotemdResponse(req);
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId, res);
                    const reporter = createNotemdReporter(operation, streamEnabled ? res : undefined);
                    if (streamEnabled) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        });
                        writeSseEvent(res, 'operation', {
                            operationId: operation.id,
                            status: operation.status,
                        });
                    }
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.extractConcepts(resolvedFilePath, settings, reporter, operation.controller.signal);
                    operation.controller.signal.throwIfAborted();
                    await persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: path.dirname(resolvedFilePath),
                    }).catch((workspaceError) => {
                        console.warn('[NoteMD] Failed to persist workspace state after extract-concepts.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');
                    if (streamEnabled) {
                        writeSseEvent(res, 'done', {
                            success: true,
                            operationId: operation.id,
                            result,
                        });
                        await finishSseResponse(res);
                    }
                    else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, operationId: operation.id, result, logs: operation.logs }));
                    }
                }
                catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        const statusCode = operation?.controller.signal.aborted ? 499 : 403;
                        const payload = { success: false, error: String((error as Error).message || 'Access denied') };
                        if (streamEnabled) {
                            writeSseEvent(res, 'error', payload);
                            await finishSseResponse(res);
                        }
                        else {
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(payload));
                        }
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/extract-concepts');
                    const payload = { success: false, error: String(error) };
                    if (streamEnabled) {
                        writeSseEvent(res, 'error', payload);
                        await finishSseResponse(res);
                    }
                    else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(payload));
                    }
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/cancel', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const operationId = String(payload.operationId || '').trim();
                    if (!operationId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing operationId' }));
                        return;
                    }
                    const operation = NOTEMD_ACTIVE_OPERATIONS.get(operationId);
                    if (!operation) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Operation not found' }));
                        return;
                    }
                    if (operation.status !== 'running') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            operationId,
                            status: operation.status,
                            message: 'Operation is not running.',
                        }));
                        return;
                    }
                    operation.controller.abort();
                    finalizeNotemdOperation(operation, 'cancelled');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, operationId, status: 'cancelled' }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/cancel');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        {
            method: 'POST',
            path: api('/generate-diagram'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.generateDiagram(body, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/generate-diagram');
                }
            },
        },
        {
            method: 'POST',
            path: api('/preview-diagram'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.previewDiagram(body, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/preview-diagram');
                }
            },
        },
        {
            method: 'POST',
            path: api('/export-diagram'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const request = { ...body, ...(body.outputPath ? { outputPath: await resolvePathWithinKnowledgeBase(body.outputPath, { expectedType: 'any', allowMissing: true }) } : {}) };
                    const result = await notemdService.exportDiagram(request, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/export-diagram');
                }
            },
        },
        {
            method: 'POST',
            path: api('/search'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.search(body, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/search');
                }
            },
        },
        {
            method: 'GET',
            path: api('/progress'),
            handler: async (_req, res) => {
                try {
                    const progress = await notemdService.getBatchProgress();
                    ok(res, { progress });
                }
                catch (e) {
                    fail(res, e, 'API:GET /api/notemd/progress');
                }
            },
        },
        {
            method: 'POST',
            path: api('/diagnose-llm'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.diagnoseLlmProvider(body, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/diagnose-llm');
                }
            },
        },
        {
            method: 'POST',
            path: api('/extract-original-text'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const request = {
                        ...body,
                        filePath: await resolvePathWithinKnowledgeBase(body.filePath, { expectedType: 'file' }),
                        ...(body.outputPath ? { outputPath: await resolvePathWithinKnowledgeBase(body.outputPath, { expectedType: 'any', allowMissing: true }) } : {}),
                    };
                    const result = await notemdService.extractOriginalText(request, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/extract-original-text');
                }
            },
        },
        {
            method: 'GET',
            path: api('/capability-manifest'),
            handler: async (_req, res) => {
                try {
                    const manifest = buildCliCapabilityManifest('notemd');
                    ok(res, { manifest });
                }
                catch (e) {
                    fail(res, e, 'API:GET /api/notemd/capability-manifest');
                }
            },
        },
        {
            method: 'GET',
            path: api('/invocation-contract'),
            handler: async (_req, res) => {
                try {
                    const contract = buildCliInvocationContract();
                    ok(res, { contract });
                }
                catch (e) {
                    fail(res, e, 'API:GET /api/notemd/invocation-contract');
                }
            },
        },
        {
            method: 'POST',
            path: api('/provider-diagnostic'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const result = await notemdService.diagnoseLlmProvider(body, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/provider-diagnostic');
                }
            },
        },
        { method: 'POST', path: '/api/notemd/one-click-extract', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                let operation: NotemdOperationState | null = null;
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    operation = createNotemdOperation(payload.operationId, res);
                    const reporter = createNotemdReporter(operation);
                    const resolvedFilePath = await resolvePathWithinKnowledgeBase(payload.filePath, {
                        expectedType: 'file',
                    });
                    const result = await notemdService.oneClickExtract(resolvedFilePath, settings, reporter, operation.controller.signal);
                    operation.controller.signal.throwIfAborted();
                    await persistNotemdWorkspacePatch({
                        filePath: resolvedFilePath,
                        folderPath: result.outputFolderPath,
                        outputFolderPath: result.outputFolderPath,
                    }).catch((workspaceError) => {
                        console.warn('[NoteMD] Failed to persist workspace state after one-click-extract.', workspaceError);
                    });
                    finalizeNotemdOperation(operation, 'done');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, operationId: operation.id, result, logs: operation.logs }));
                }
                catch (error) {
                    if (operation) {
                        finalizeNotemdOperation(operation, operation.controller.signal.aborted ? 'cancelled' : 'error');
                    }
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/one-click-extract');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/batch-fix-mermaid', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const result = await notemdService.batchFixMermaid(resolvedFolderPath, payload.inPlace !== false);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/batch-fix-mermaid');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        {
            method: 'POST',
            path: api('/batch-fix-formulas'),
            handler: async (req, res) => {
                try {
                    const raw = await readJsonBody(req);
                    const { folderPath, inPlace } = raw;
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(folderPath, { expectedType: 'directory' });
                    const result = await notemdService.batchFixFormulas(resolvedFolderPath, inPlace ?? true);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/batch-fix-formulas');
                }
            },
        },
        {
            method: 'POST',
            path: api('/batch-generate-content'),
            handler: async (req, res) => {
                try {
                    const raw = await readJsonBody(req);
                    const { folderPath } = raw;
                    const settings = await loadNotemdSettings();
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(folderPath, { expectedType: 'directory' });
                    const result = await notemdService.generateFolderContent(resolvedFolderPath, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/batch-generate-content');
                }
            },
        },
        {
            method: 'POST',
            path: api('/batch-progress'),
            handler: async (req, res) => {
                try {
                    const raw = await readJsonBody(req);
                    const { operationId } = raw;
                    const result = await notemdService.getBatchProgress(operationId);
                    ok(res, { progress: result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/batch-progress');
                }
            },
        },
        {
            method: 'POST',
            path: api('/workflow'),
            handler: async (req, res) => {
                try {
                    const raw = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const request = {
                        ...raw,
                        filePath: await resolvePathWithinKnowledgeBase(raw.filePath, { expectedType: 'file' }),
                        ...(raw.outputFolderPath ? { outputFolderPath: await resolvePathWithinKnowledgeBase(raw.outputFolderPath, { expectedType: 'directory', allowMissing: true }) } : {}),
                    };
                    const result = await notemdService.runWorkflow(request, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/workflow');
                }
            },
        },
        {
            method: 'POST',
            path: api('/batch-workflow'),
            handler: async (req, res) => {
                try {
                    const raw = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const request = {
                        ...raw,
                        folderPath: await resolvePathWithinKnowledgeBase(raw.folderPath, { expectedType: 'directory' }),
                        ...(raw.outputBasePath ? { outputBasePath: await resolvePathWithinKnowledgeBase(raw.outputBasePath, { expectedType: 'directory', allowMissing: true }) } : {}),
                    };
                    const result = await notemdService.runBatchWorkflow(request, settings);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/batch-workflow');
                }
            },
        },
        {
            method: 'POST',
            path: api('/provider-profiles/export'),
            handler: async (req, res) => {
                try {
                    const settings = await loadNotemdSettings();
                    const { buildProviderProfileExport } = await import('../notemd/providerProfiles');
                    const profile = buildProviderProfileExport(settings.providers);
                    ok(res, { profile });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/provider-profiles/export');
                }
            },
        },
        {
            method: 'GET',
            path: api('/agent-manifest'),
            handler: async (_req, res) => {
                try {
                    const defs = listOperationDefinitions();
                    const operations: NotemdAgentOperation[] = defs.map(def => ({
                        operationId: def.id,
                        description: def.commandBindings[0]?.commandId ?? def.id,
                        automationLevel: def.automationLevel,
                        requiredContext: def.requiredContext,
                        sideEffectClass: def.sideEffectClass,
                        agentAutoExecutable: def.automationLevel === 'safe',
                        requiredParams: def.inputSchema
                            ? (def.inputSchema as any).required ?? []
                            : [],
                    }));
                    const manifest: NotemdAgentManifest = {
                        version: 1,
                        generatedAt: new Date().toISOString(),
                        totalOperations: operations.length,
                        agentExecutableCount: operations.filter(o => o.agentAutoExecutable).length,
                        operations,
                    };
                    ok(res, { manifest });
                }
                catch (e) {
                    fail(res, e, 'API:GET /api/notemd/agent-manifest');
                }
            },
        },
        {
            method: 'POST',
            path: api('/provider-profiles/import'),
            handler: async (req, res) => {
                try {
                    const body = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const { parseProviderProfileImport } = await import('../notemd/providerProfiles');
                    const result = parseProviderProfileImport(JSON.stringify(body), settings.providers);
                    ok(res, { result });
                }
                catch (e) {
                    fail(res, e, 'API:POST /api/notemd/provider-profiles/import');
                }
            },
        },
        { method: 'GET', path: '/api/notemd/provider-templates', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const urlObj = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${finalPort}`);
                    const persistTemplates = ['1', 'true', 'yes'].includes(String(urlObj.searchParams.get('persist') || '').trim().toLowerCase());
                    let persistence = { configPath: resolveAppConfigPath(), persisted: false };
                    if (persistTemplates) {
                        persistence = await ensureNotemdProviderTemplatesPersisted();
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        templates: NOTEMD_PROVIDER_TEMPLATES,
                        configPath: persistence.configPath,
                        persisted: persistence.persisted,
                    }));
                }
                catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/notemd/provider-templates',
                        requestId,
                    });
                }
                return;
            } },
        { method: 'GET', path: '/api/notemd/workspace', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const settings = await loadNotemdSettings();
                    const workspace = extractNotemdWorkspaceState(settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        workspace,
                    }));
                }
                catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:GET /api/notemd/workspace',
                        requestId,
                    });
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/provider-templates/apply', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const rawTemplateId = isObjectRecord(payload)
                        ? String(payload.templateId || payload.template_id || '').trim()
                        : '';
                    if (!rawTemplateId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing templateId.' }));
                        return;
                    }
                    const template = getNotemdProviderTemplate(rawTemplateId);
                    if (!template) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: `Unknown provider template: ${rawTemplateId}` }));
                        return;
                    }
                    const settings = await loadNotemdSettings();
                    const updatedSettings = applyProviderTemplateToSettings(settings, rawTemplateId);
                    const persistedSettings = await persistNotemdSettings(updatedSettings);
                    const persistence = await ensureNotemdProviderTemplatesPersisted();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        template,
                        settings: persistedSettings,
                        configPath: persistence.configPath,
                        persistedTemplates: persistence.persisted,
                    }));
                }
                catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/notemd/provider-templates/apply',
                        requestId,
                    });
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/workspace', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const workspaceCandidate = isObjectRecord(payload) && payload.workspace !== undefined
                        ? payload.workspace
                        : payload;
                    const workspace = await persistNotemdWorkspacePatch(workspaceCandidate);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, workspace }));
                }
                catch (error) {
                    writeApiErrorResponse(res, error, {
                        context: 'API:POST /api/notemd/workspace',
                        requestId,
                    });
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/translate-folder', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const targetLanguage = String(payload.targetLanguage || settings.translateLanguage || settings.language).trim();
                    if (!targetLanguage) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Missing targetLanguage' }));
                        return;
                    }
                    const result = await notemdService.translateFolder(resolvedFolderPath, targetLanguage, settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/translate-folder');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } },
        { method: 'POST', path: '/api/notemd/generate-folder-content', handler: async (req, res) => {
                const requestId = String(res.getHeader('X-Request-Id') || '');
                try {
                    const payload = await readJsonBody(req);
                    const settings = await loadNotemdSettings();
                    const resolvedFolderPath = await resolvePathWithinKnowledgeBase(payload.folderPath, {
                        expectedType: 'directory',
                    });
                    const result = await notemdService.generateFolderContent(resolvedFolderPath, settings);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                }
                catch (error) {
                    if (writeBodyParseErrorResponse(res, error)) {
                        return;
                    }
                    if (isAccessDeniedError(error)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: String((error as Error).message || 'Access denied') }));
                        return;
                    }
                    console.error(error);
                    CrashLogger.log(error, 'API:POST /api/notemd/generate-folder-content');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: String(error) }));
                }
                return;
            } }
    ];
    const legacyPutAliases = new Set(["/api/notemd/settings", "/api/notemd/provider-templates/apply", "/api/notemd/workspace", "/api/notemd/cancel", "/api/notemd/test-llm", "/api/notemd/process-file", "/api/notemd/process-folder", "/api/notemd/generate-content", "/api/notemd/translate-file", "/api/notemd/translate-folder", "/api/notemd/fix-mermaid", "/api/notemd/fix-formulas", "/api/notemd/check-duplicates", "/api/notemd/extract-concepts", "/api/notemd/one-click-extract", "/api/notemd/batch-fix-mermaid", "/api/notemd/generate-folder-content"]);
    return [...routes, ...routes.filter(route => route.method === 'POST' && legacyPutAliases.has(route.path)).map(route => ({ ...route, method: 'PUT' as const }))];
}
