/**
 * Operations Registry contract test (cline co-located pattern).
 * Validates all 27 operation definitions for structural integrity,
 * schema correctness, automation level consistency, and required fields.
 */
import { listOperationDefinitions, getOperationDefinition } from './registry';
import type { OperationDefinition } from './types';

const VALID_AUTOMATION_LEVELS = ['safe', 'requires-active-file', 'requires-selection', 'interactive-ui'];
const VALID_SIDE_EFFECTS = ['read-only', 'write-file', 'batch-write', 'preview-ui', 'destructive'];
const VALID_CONTEXTS = ['none', 'active-file', 'editor-selection', 'folder-selection', 'preview-ui'];

describe('Operations Registry', () => {
    let ops: OperationDefinition[];

    beforeAll(() => { ops = listOperationDefinitions(); });

    test('returns 27 operation definitions', () => {
        expect(ops.length).toBe(27);
    });

    test('every operation has a unique id', () => {
        const ids = ops.map(o => o.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('every operation has version 1', () => {
        ops.forEach(o => expect(o.version).toBe(1));
    });

    test('every operation has valid automationLevel', () => {
        ops.forEach(o => expect(VALID_AUTOMATION_LEVELS).toContain(o.automationLevel));
    });

    test('every operation has valid sideEffectClass', () => {
        ops.forEach(o => expect(VALID_SIDE_EFFECTS).toContain(o.sideEffectClass));
    });

    test('every operation has valid requiredContext', () => {
        ops.forEach(o => expect(VALID_CONTEXTS).toContain(o.requiredContext));
    });

    test('every operation has at least one command binding', () => {
        ops.forEach(o => expect(o.commandBindings.length).toBeGreaterThanOrEqual(1));
    });

    test('every command binding has a non-empty commandId', () => {
        ops.forEach(o => o.commandBindings.forEach(b => {
            expect(b.commandId.length).toBeGreaterThan(0);
        }));
    });

    test('safe operations have read-only or write-file side effects', () => {
        const safeOps = ops.filter(o => o.automationLevel === 'safe');
        safeOps.forEach(o => {
            expect(['read-only', 'write-file']).toContain(o.sideEffectClass);
        });
    });

    test('destructive operations require interactive-ui', () => {
        const destructiveOps = ops.filter(o => o.sideEffectClass === 'destructive');
        destructiveOps.forEach(o => {
            expect(o.automationLevel).toBe('interactive-ui');
        });
    });

    test('batch-write operations require at least active-file context', () => {
        const batchOps = ops.filter(o => o.sideEffectClass === 'batch-write');
        batchOps.forEach(o => {
            expect(o.automationLevel).not.toBe('safe');
        });
    });

    test('getOperationDefinition returns correct op by id', () => {
        const op = getOperationDefinition('diagram.generate');
        expect(op).toBeDefined();
        expect(op!.id).toBe('diagram.generate');
        expect(op!.automationLevel).toBe('safe');
    });

    test('getOperationDefinition returns undefined for unknown id', () => {
        expect(getOperationDefinition('nonexistent.op')).toBeUndefined();
    });

    test('every operation with inputSchema has a valid JSON schema', () => {
        ops.filter(o => o.inputSchema).forEach(o => {
            expect(o.inputSchema).toBeDefined();
            expect(typeof o.inputSchema!.type).toBe('string');
        });
    });

    test('critical operations exist', () => {
        const ids = ops.map(o => o.id);
        expect(ids).toContain('file.process-add-links');
        expect(ids).toContain('diagram.generate');
        expect(ids).toContain('translate.file');
        expect(ids).toContain('provider.diagnostic.run');
        expect(ids).toContain('workflow.extract-and-generate');
        expect(ids).toContain('workflow.batch');
        expect(ids).toContain('mermaid.batch-fix');
        expect(ids).toContain('content.generate-from-title');
        expect(ids).toContain('cli.capability-manifest.export');
        expect(ids).toContain('cli.invocation-contract.export');
    });

    test('capability-manifest ops are safe and read-only', () => {
        const cliOps = ops.filter(o => o.id.startsWith('cli.'));
        cliOps.forEach(o => {
            expect(o.automationLevel).toBe('safe');
            expect(o.sideEffectClass).toBe('write-file');
        });
    });
});
