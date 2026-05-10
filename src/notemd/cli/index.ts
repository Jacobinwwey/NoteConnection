#!/usr/bin/env node

/**
 * Notemd CLI Entry Point
 *
 * Usage: npx notemd <command> [options]
 *   or:   node src/notemd/cli/index.ts <command> [options]
 *
 * Examples:
 *   notemd process-file --path=notes/my_note.md
 *   notemd search --query="machine learning"
 *   notemd generate-diagram --path=notes/arch.md --intent=mermaid
 *   notemd translate --path=notes/doc.md --language=zh
 *   notemd manifest
 *   notemd help
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseCliArgs } from './parser';
import { findCommand, listCommands } from './commands';
import { CliExecutionContext } from './types';
import { NotemdService } from '../NotemdService';
import { dispatchCommand } from './dispatcher';

function createExecutionContext(workingDir: string): CliExecutionContext {
    return {
        workingDir,
        getSetting: async (_key: string) => undefined,
        callLlm: async (_prompt: string, _content: string) => { throw new Error('LLM not configured for CLI'); },
        readFile: async (filePath: string) => {
            const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(workingDir, filePath);
            return fs.promises.readFile(resolved, 'utf8');
        },
        writeFile: async (filePath: string, content: string) => {
            const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(workingDir, filePath);
            await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
            await fs.promises.writeFile(resolved, content, 'utf8');
        },
        fileExists: async (filePath: string) => {
            const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(workingDir, filePath);
            try { await fs.promises.access(resolved); return true; } catch { return false; }
        },
        mkdir: async (dirPath: string) => {
            const resolved = path.isAbsolute(dirPath) ? dirPath : path.resolve(workingDir, dirPath);
            await fs.promises.mkdir(resolved, { recursive: true });
        }
    };
}

function printHelp(): void {
    console.log('Notemd CLI - LLM-powered note enhancement toolkit\n');
    console.log('Usage: npx notemd <command> [options]\n');
    console.log('Commands:');
    const commands = listCommands();
    const maxLen = Math.max(...commands.map(c => c.name.length));
    for (const cmd of commands) {
        const pads = ' '.repeat(maxLen - cmd.name.length + 2);
        console.log(`  ${cmd.name}${pads}${cmd.description}`);
    }
    console.log('\nRun "npx notemd <command> --help" for detailed options.');
}

async function main(): Promise<void> {
    const cliArgs = process.argv.slice(2);

    if (cliArgs.length === 0 || cliArgs[0] === 'help' || cliArgs[0] === '--help' || cliArgs[0] === '-h') {
        printHelp();
        process.exit(0);
    }

    // Check for help on a specific command
    if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
        const cmdName = cliArgs[0];
        const cmd = findCommand(cmdName);
        if (cmd) {
            console.log(`${cmd.name} — ${cmd.description}\n`);
            console.log(`Operation: ${cmd.operationId}`);
            console.log(`Automation: ${cmd.automationLevel} | Context: ${cmd.requiredContext} | Side Effects: ${cmd.sideEffectClass}\n`);
            if (cmd.params.length > 0) {
                console.log('Parameters:');
                for (const p of cmd.params) {
                    const req = p.required ? ' (required)' : '';
                    const def = p.defaultValue ? ` [default: ${p.defaultValue}]` : '';
                    console.log(`  --${p.name}${req}${def}`);
                    console.log(`    ${p.description}`);
                }
            }
            if (cmd.flags.length > 0) {
                console.log('Flags:');
                for (const f of cmd.flags) {
                    console.log(`  --${f.name}`);
                    console.log(`    ${f.description}`);
                }
            }
        } else {
            console.log(`Unknown command: ${cmdName}`);
        }
        process.exit(0);
    }

    const workingDir = process.cwd();
    const ctx = createExecutionContext(workingDir);
    const service = new NotemdService();

    // Load settings from notemd.toml if it exists, else use defaults
    const settings: any = { providers: [], activeProvider: 'OpenAI', searchProvider: 'duckduckgo' };
    const configPath = path.resolve(workingDir, 'notemd.toml');
    try {
        await fs.promises.access(configPath);
        const configContent = await fs.promises.readFile(configPath, 'utf8');
        // Parse TOML settings (basic: just use JSON format for CLI)
        const config = JSON.parse(configContent);
        Object.assign(settings, config);
    } catch {
        // Use defaults
    }

    try {
        const result = await dispatchCommand(cliArgs, ctx, service, settings);
        if (result.success) {
            console.log(JSON.stringify(result.data, null, 2));
            process.exit(0);
        } else {
            console.error(`Error: ${result.error}`);
            process.exit(1);
        }
    } catch (error: unknown) {
        console.error('Fatal error:', error instanceof Error ? error.message : String(error));
        process.exit(2);
    }
}

main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(2);
});
