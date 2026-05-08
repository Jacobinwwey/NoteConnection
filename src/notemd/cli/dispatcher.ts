import { CliArgs, parseCliArgs, resolveParam, resolveBool } from './parser';
import { findCommand, listCommands } from './commands';
import { CliCommandDef } from './types';
import { CliExecutionContext } from './types';
import { NotemdService } from '../NotemdService';
import { NotemdSettings } from '../types';
import { buildCliCapabilityManifest } from '../operations/capabilityManifest';
import { buildCliInvocationContract } from '../operations/cliContracts';
import { SearchManager } from '../search/SearchManager';

export interface DispatchResult {
    success: boolean;
    data?: unknown;
    error?: string;
    operationId?: string;
}

export async function dispatchCommand(
    args: string[],
    ctx: CliExecutionContext,
    service: NotemdService,
    settings: NotemdSettings
): Promise<DispatchResult> {
    const parsed = parseCliArgs(args);
    const cmd = findCommand(parsed.command);

    if (!cmd) {
        return {
            success: false,
            error: `Unknown command: ${parsed.command}. Available commands:\n${listCommands().map(c => `  ${c.name} - ${c.description}`).join('\n')}`
        };
    }

    try {
        const result = await executeCommand(cmd, parsed, ctx, service, settings);
        return { success: true, data: result, operationId: cmd.operationId };
    } catch (error: unknown) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            operationId: cmd.operationId
        };
    }
}

async function executeCommand(
    cmd: CliCommandDef,
    args: CliArgs,
    ctx: CliExecutionContext,
    service: NotemdService,
    settings: NotemdSettings
): Promise<unknown> {
    const { params, flags } = args;

    switch (cmd.operationId) {
        case 'file.process-add-links': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            return service.processFile({ filePath, createConceptNotes: !flags.has('no-concepts') }, settings);
        }

        case 'file.process-folder-add-links': {
            const folderPath = resolveParam(params, ['path', 'p', 'folder']);
            if (!folderPath) throw new Error('Missing required param: --path');
            return service.processFolder({ folderPath }, settings);
        }

        case 'content.generate-from-title': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            const source = await ctx.readFile(filePath);
            const title = source.split('\n')[0]?.replace(/^#\s*/, '').trim() || 'Untitled';
            return service.generateContent(title, flags.has('research') ? source : undefined, settings);
        }

        case 'content.batch-generate-from-titles': {
            const folderPath = resolveParam(params, ['path', 'p', 'folder']);
            if (!folderPath) throw new Error('Missing required param: --path');
            return service.generateFolderContent(folderPath, settings);
        }

        case 'translate.file': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            const language = resolveParam(params, ['language', 'l', 'lang']);
            if (!filePath) throw new Error('Missing required param: --path');
            if (!language) throw new Error('Missing required param: --language');
            return service.translateFile({ filePath, targetLanguage: language }, settings);
        }

        case 'research.summarize-topic': {
            const query = resolveParam(params, ['query', 'q']);
            if (!query) throw new Error('Missing required param: --query');
            const provider = resolveParam(params, ['provider', 'prov']) as 'tavily' | 'duckduckgo' | undefined;
            return service.search({ query, provider }, settings);
        }

        case 'diagram.generate': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            const content = await ctx.readFile(filePath);
            const intent = resolveParam(params, ['intent', 'i']) as any;
            const mode = (resolveParam(params, ['mode', 'm']) || 'best-fit') as 'best-fit' | 'legacy-mermaid';
            return service.generateDiagram({
                content,
                intent,
                compatibilityMode: mode,
                title: filePath
            }, settings);
        }

        case 'mermaid.batch-fix': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            const inPlace = resolveBool(params, flags, ['in-place', 'i']);
            return service.batchFixMermaid(filePath, inPlace);
        }

        case 'formula.fix-file': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            const inPlace = resolveBool(params, flags, ['in-place', 'i']);
            return service.fixFormulas(filePath, inPlace);
        }

        case 'duplicate.check-file': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            return service.checkDuplicates(filePath);
        }

        case 'concept.extract-file': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            return service.extractConcepts(filePath, settings);
        }

        case 'workflow.extract-and-generate': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            const output = resolveParam(params, ['output', 'o']);
            const language = resolveParam(params, ['language', 'l', 'lang']);
            return service.runWorkflow({
                filePath,
                outputFolderPath: output,
                language,
                skipGenerate: flags.has('no-generate'),
                skipMermaidFix: flags.has('no-mermaid')
            }, settings);
        }

        case 'content.extract-original-text': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            return service.extractOriginalText({
                filePath,
                mergedMode: flags.has('merged')
            }, settings);
        }

        case 'cli.capability-manifest.export':
            return buildCliCapabilityManifest('notemd');

        case 'cli.invocation-contract.export':
            return buildCliInvocationContract();

        case 'provider.diagnostic.run': {
            const provider = resolveParam(params, ['provider', 'p', 'prov']);
            return service.diagnoseLlmProvider({ provider }, settings);
        }

        case 'provider.connection.test': {
            const provider = resolveParam(params, ['provider', 'p', 'prov']);
            return { provider: provider || settings.activeProvider, status: 'not-implemented' };
        }

        case 'concept.dedupe': {
            const folderPath = resolveParam(params, ['path', 'p', 'folder']);
            if (!folderPath) throw new Error('Missing required param: --path');
            return { folderPath, dedupeStatus: 'not-implemented' };
        }

        case 'workflow.batch': {
            const folderPath = resolveParam(params, ['path', 'p', 'folder']);
            if (!folderPath) throw new Error('Missing required param: --path');
            const output = resolveParam(params, ['output', 'o']);
            const pattern = resolveParam(params, ['pattern', 'filter', 'regex']);
            const extensions = resolveParam(params, ['ext', 'extensions']);
            const maxFiles = resolveParam(params, ['max', 'max-files']);
            return service.runBatchWorkflow({
                folderPath,
                outputBasePath: output,
                filePattern: pattern,
                fileExtensions: extensions?.split(',').map(e => e.trim()),
                skipGenerate: flags.has('no-generate'),
                skipMermaidFix: flags.has('no-mermaid'),
                maxFiles: maxFiles ? parseInt(maxFiles, 10) : undefined
            }, settings);
        }

        case 'provider.profile.export': {
            const { buildProviderProfileExport } = await import('../providerProfiles');
            return buildProviderProfileExport(settings.providers);
        }

        case 'provider.profile.import': {
            const filePath = resolveParam(params, ['path', 'p', 'file']);
            if (!filePath) throw new Error('Missing required param: --path');
            const jsonData = await ctx.readFile(filePath);
            const { parseProviderProfileImport } = await import('../providerProfiles');
            return parseProviderProfileImport(jsonData, settings.providers);
        }

        default:
            throw new Error(`Operation ${cmd.operationId} not yet implemented in CLI dispatcher.`);
    }
}
