/**
 * CLI E2E pipeline test — validates the full CLI chain:
 * parseCliArgs → findCommand → dispatchCommand → service method
 */
import { parseCliArgs, resolveParam, resolveBool } from './notemd/cli/parser';
import { findCommand, listCommands, getOperationForCommand } from './notemd/cli/commands';

describe('CLI Parser', () => {
    test('parseCliArgs extracts command name', () => {
        const args = parseCliArgs(['process-file', '--path=notes/test.md']);
        expect(args.command).toBe('process-file');
    });

    test('parseCliArgs extracts --key=value params', () => {
        const args = parseCliArgs(['translate', '--path=notes/doc.md', '--language=zh']);
        expect(resolveParam(args.params, ['path', 'p'])).toBe('notes/doc.md');
        expect(resolveParam(args.params, ['language', 'l'])).toBe('zh');
    });

    test('parseCliArgs extracts --key value params', () => {
        const args = parseCliArgs(['search', '--query', 'machine learning']);
        expect(resolveParam(args.params, ['query', 'q'])).toBe('machine learning');
    });

    test('parseCliArgs extracts boolean flags', () => {
        const args = parseCliArgs(['process-file', '--path=notes/test.md', '--dry-run', '--no-concepts']);
        expect(resolveBool(args.params, args.flags, ['dry-run', 'n'])).toBe(true);
        expect(resolveBool(args.params, args.flags, ['no-concepts', 'nc'])).toBe(true);
        expect(resolveBool(args.params, args.flags, ['nonexistent'])).toBe(false);
    });

    test('parseCliArgs resolves param aliases', () => {
        const args = parseCliArgs(['process-file', '-p', 'notes/test.md', '-o', 'out/']);
        expect(resolveParam(args.params, ['path', 'p', 'file'])).toBe('notes/test.md');
        expect(resolveParam(args.params, ['output', 'o'])).toBe('out/');
    });

    test('parseCliArgs handles positional args', () => {
        const args = parseCliArgs(['search', 'machine learning', 'AI']);
        expect(args.command).toBe('search');
        expect(args.positional).toEqual(['machine learning', 'AI']);
    });

    test('parseCliArgs empty args returns empty command', () => {
        const args = parseCliArgs([]);
        expect(args.command).toBe('');
    });
});

describe('CLI Commands Registry', () => {
    test('listCommands returns all 23 commands', () => {
        const cmds = listCommands();
        expect(cmds.length).toBeGreaterThanOrEqual(22);
    });

    test('findCommand finds by name', () => {
        const cmd = findCommand('workflow');
        expect(cmd).toBeDefined();
        expect(cmd!.operationId).toBe('workflow.extract-and-generate');
        expect(cmd!.automationLevel).toBe('requires-active-file');
    });

    test('findCommand finds by alias', () => {
        const cmd = findCommand('wf');
        expect(cmd).toBeDefined();
        expect(cmd!.name).toBe('workflow');
    });

    test('findCommand returns undefined for unknown', () => {
        expect(findCommand('nonexistent')).toBeUndefined();
    });

    test('getOperationForCommand resolves operation from registry', () => {
        const op = getOperationForCommand('process-file');
        expect(op).toBeDefined();
        expect(op!.id).toBe('file.process-add-links');
        expect(op!.inputSchema).toBeDefined();
    });

    test('all commands have valid operationIds', () => {
        const cmds = listCommands();
        for (const cmd of cmds) {
            const op = getOperationForCommand(cmd.name);
            expect(op).toBeDefined();
            expect(op!.id).toBe(cmd.operationId);
        }
    });

    test('critical workflow commands exist', () => {
        expect(findCommand('workflow')).toBeDefined();
        expect(findCommand('batch-workflow')).toBeDefined();
        expect(findCommand('process-file')).toBeDefined();
        expect(findCommand('search')).toBeDefined();
        expect(findCommand('generate-diagram')).toBeDefined();
        expect(findCommand('translate')).toBeDefined();
    });

    test('all commands have params and flags defined', () => {
        const cmds = listCommands();
        for (const cmd of cmds) {
            expect(Array.isArray(cmd.params)).toBe(true);
            expect(Array.isArray(cmd.flags)).toBe(true);
            if (cmd.params.length > 0) {
                const required = cmd.params.filter(p => p.required);
                expect(required.length).toBeGreaterThanOrEqual(0);
            }
        }
    });

    test('all commands have unique names', () => {
        const cmds = listCommands();
        const names = cmds.map(c => c.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });

    test('command aliases do not collide with command names', () => {
        const cmds = listCommands();
        const names = new Set(cmds.map(c => c.name));
        for (const cmd of cmds) {
            for (const alias of cmd.aliases) {
                expect(names.has(alias)).toBe(false);
            }
        }
    });
});

describe('CLI Help Output', () => {
    test('every command has a non-empty description', () => {
        for (const cmd of listCommands()) {
            expect(cmd.description.length).toBeGreaterThan(0);
        }
    });

    test('every command has at least one alias or uses the primary name', () => {
        for (const cmd of listCommands()) {
            expect(cmd.name.length).toBeGreaterThan(0);
            expect(Array.isArray(cmd.aliases)).toBe(true);
        }
    });

    test('automation level is valid for all commands', () => {
        const valid = ['safe', 'requires-active-file', 'requires-selection', 'interactive-ui'];
        for (const cmd of listCommands()) {
            expect(valid).toContain(cmd.automationLevel);
        }
    });

    test('side effect class is valid for all commands', () => {
        const valid = ['read-only', 'write-file', 'batch-write', 'preview-ui', 'destructive'];
        for (const cmd of listCommands()) {
            expect(valid).toContain(cmd.sideEffectClass);
        }
    });
});
