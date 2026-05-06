/**
 * Shared types contract test — validates shared type module integrity.
 */
import * as path from 'path';
import * as fs from 'fs';

describe('shared types module', () => {
    const sharedDir = path.resolve(__dirname);
    const typesFile = path.join(sharedDir, 'types.ts');

    test('shared types file exists on disk', () => {
        expect(fs.existsSync(typesFile)).toBe(true);
    });

    test('shared types file is under 200 lines (contract boundary discipline)', () => {
        const source = fs.readFileSync(typesFile, 'utf8');
        const lines = source.split('\n').length;
        expect(lines).toBeLessThan(200);
    });

    test('shared types file contains canonical contract documentation', () => {
        const source = fs.readFileSync(typesFile, 'utf8');
        expect(source).toContain('Shared contract types');
        expect(source).toContain('single source of truth');
        expect(source).toContain('API contract boundary');
    });

    test('shared types re-exports from learning/types', () => {
        const source = fs.readFileSync(typesFile, 'utf8');
        expect(source).toContain("from '../learning/types'");
        // Verify key contract types are re-exported
        expect(source).toContain('KnowledgeAtom');
        expect(source).toContain('KnowledgeQueryRequest');
        expect(source).toContain('KnowledgeQueryResponse');
        expect(source).toContain('AgentConversationRequest');
        expect(source).toContain('AgentConversationResponse');
    });

    test('shared types defines RuntimeCapabilityContract', () => {
        const source = fs.readFileSync(typesFile, 'utf8');
        expect(source).toContain('RuntimeCapabilityContract');
        expect(source).toContain('capabilityId');
        expect(source).toContain('status');
    });

    test('shared types defines AgentWorkspaceContract', () => {
        const source = fs.readFileSync(typesFile, 'utf8');
        expect(source).toContain('AgentWorkspaceContract');
        expect(source).toContain('conversationId');
        expect(source).toContain('activePaneId');
    });
});
