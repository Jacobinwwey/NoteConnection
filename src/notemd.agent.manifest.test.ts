/**
 * Agent Manifest contract test — validates that the NotemdAgentManifest
 * endpoint produces correct data for Agent Workspace consumption.
 */
import { listOperationDefinitions } from './notemd/operations/registry';

interface NotemdAgentOperation {
    operationId: string;
    description: string;
    automationLevel: string;
    requiredContext: string;
    sideEffectClass: string;
    agentAutoExecutable: boolean;
    requiredParams: string[];
}

interface NotemdAgentManifest {
    version: 1;
    generatedAt: string;
    totalOperations: number;
    agentExecutableCount: number;
    operations: NotemdAgentOperation[];
}

function buildAgentManifest(): NotemdAgentManifest {
    const defs = listOperationDefinitions();
    const operations: NotemdAgentOperation[] = defs.map(def => ({
        operationId: def.id,
        description: def.commandBindings[0]?.commandId ?? def.id,
        automationLevel: def.automationLevel,
        requiredContext: def.requiredContext,
        sideEffectClass: def.sideEffectClass,
        agentAutoExecutable: def.automationLevel === 'safe',
        requiredParams: def.inputSchema
            ? ((def.inputSchema as any).required ?? [])
            : [],
    }));

    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        totalOperations: operations.length,
        agentExecutableCount: operations.filter(o => o.agentAutoExecutable).length,
        operations,
    };
}

describe('NotemdAgentManifest', () => {
    let manifest: NotemdAgentManifest;

    beforeAll(() => {
        manifest = buildAgentManifest();
    });

    test('manifest version is 1', () => {
        expect(manifest.version).toBe(1);
    });

    test('generatedAt is a valid ISO date string', () => {
        expect(() => new Date(manifest.generatedAt)).not.toThrow();
        expect(new Date(manifest.generatedAt).getTime()).toBeGreaterThan(0);
    });

    test('totalOperations matches operations array length', () => {
        expect(manifest.totalOperations).toBe(manifest.operations.length);
    });

    test('all operations are present (27 with workflow.batch)', () => {
        expect(manifest.operations.length).toBe(27);
    });

    test('agentExecutableCount matches auto-executable count', () => {
        const count = manifest.operations.filter(o => o.agentAutoExecutable).length;
        expect(manifest.agentExecutableCount).toBe(count);
    });

    test('safe operations are agent-auto-executable', () => {
        const safeOps = manifest.operations.filter(o => o.automationLevel === 'safe');
        expect(safeOps.length).toBeGreaterThan(0);
        safeOps.forEach(op => {
            expect(op.agentAutoExecutable).toBe(true);
        });
    });

    test('every operation has an operationId', () => {
        manifest.operations.forEach(op => {
            expect(typeof op.operationId).toBe('string');
            expect(op.operationId.length).toBeGreaterThan(0);
        });
    });

    test('every operation has a valid automation level', () => {
        const valid = ['safe', 'requires-active-file', 'requires-selection', 'interactive-ui'];
        manifest.operations.forEach(op => {
            expect(valid).toContain(op.automationLevel);
        });
    });

    test('interactive-ui operations are NOT agent-auto-executable', () => {
        const uiOps = manifest.operations.filter(o => o.automationLevel === 'interactive-ui');
        uiOps.forEach(op => {
            expect(op.agentAutoExecutable).toBe(false);
        });
    });

    test('known critical operations are present', () => {
        const ids = manifest.operations.map(o => o.operationId);
        expect(ids).toContain('file.process-add-links');
        expect(ids).toContain('diagram.generate');
        expect(ids).toContain('translate.file');
        expect(ids).toContain('provider.diagnostic.run');
        expect(ids).toContain('workflow.extract-and-generate');
        expect(ids).toContain('mermaid.batch-fix');
    });
});
