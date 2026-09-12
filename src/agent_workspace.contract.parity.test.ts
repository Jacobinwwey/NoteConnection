import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { KnowledgeLearningPlatform } from './learning/KnowledgeLearningPlatform';
import { AGENT_WORKSPACE_OPERATION_IDS, AGENT_WORKSPACE_RESULT_PRESENTATIONS, AGENT_WORKSPACE_EXECUTION_KINDS } from './learning/agentWorkspaceCapabilityContracts';
import type { AgentWorkspaceCapability } from './learning/agentWorkspaceCapabilityContracts';

describe('agent workspace capability runtime parity', () => {
    let diagnostics: any;
    let capabilities: AgentWorkspaceCapability[];
    let workspace: any;
    let fetch: jest.Mock;

    beforeAll(async () => {
        const window: any = {};
        fetch = jest.fn();
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'frontend', 'agent_workspace.js'), 'utf8'), {
            window, document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
            console, Set, Map, fetch,
        });
        workspace = window.NoteConnectionAgentWorkspace;
        diagnostics = workspace.getCapabilityRegistryDiagnostics();
        const platform = new KnowledgeLearningPlatform({ autoPersist: false });
        await platform.ingestKnowledge({ documents: [{ documentId: 'contract', sourcePath: 'contracts/graph.md', content: '# Graph\n\nGraph theory studies nodes and edges.' }] });
        const response = await platform.agentConversation({ message: 'Graph theory', persistMemory: false });
        expect(response.knowledgePoints.length).toBeGreaterThan(0);
        capabilities = response.knowledgePoints.flatMap(point => point.capabilities) as AgentWorkspaceCapability[];
        expect(capabilities.length).toBeGreaterThan(0);
    });

    test('transport registry covers the exported operation contract', () => {
        expect(new Set(diagnostics.operationTransports)).toEqual(new Set(AGENT_WORKSPACE_OPERATION_IDS));
    });
    test('request builders cover the exported operation contract', () => {
        expect(new Set(diagnostics.operationRequestBuilders)).toEqual(new Set(AGENT_WORKSPACE_OPERATION_IDS));
    });
    test('transports and request builders agree at runtime', () => {
        expect(new Set(diagnostics.operationTransports)).toEqual(new Set(diagnostics.operationRequestBuilders));
    });
    test('override operation keys exist in the exported contract', () => {
        for (const operation of Object.keys(diagnostics.operationResultPresentationOverrideMap)) expect(AGENT_WORKSPACE_OPERATION_IDS).toContain(operation);
    });
    test('override presentations exist in the exported contract', () => {
        for (const presentations of Object.values(diagnostics.operationResultPresentationOverrideMap) as string[][]) {
            expect(presentations.length).toBeGreaterThan(0);
            for (const presentation of presentations) expect(AGENT_WORKSPACE_RESULT_PRESENTATIONS).toContain(presentation);
        }
    });
    test('every operation has a nonempty unique allowlist containing its default', () => {
        for (const operation of AGENT_WORKSPACE_OPERATION_IDS) {
            const allowed = diagnostics.operationAllowedResultPresentations[operation];
            expect(allowed).toContain(diagnostics.operationDefaultResultPresentations[operation]);
            expect(new Set(allowed).size).toBe(allowed.length);
        }
    });
    test('overrides declare only non-default presentations', () => {
        for (const [operation, presentations] of Object.entries(diagnostics.operationResultPresentationOverrideMap) as Array<[string, string[]]>) {
            expect(presentations).not.toContain(diagnostics.operationDefaultResultPresentations[operation]);
        }
    });
    test('diagnostics report no invalid or unknown presentation drift', () => {
        expect(diagnostics.operationResultPresentationOverrideDriftDetected).toBe(false);
        expect(diagnostics.operationResultPresentationInvalidOverrideTokenCount).toBe(0);
        expect(diagnostics.operationResultPresentationUnknownOverrideTokenCount).toBe(0);
    });
    test('presenters cover the exported presentation contract', () => {
        expect(new Set(diagnostics.resultPresentations)).toEqual(new Set(AGENT_WORKSPACE_RESULT_PRESENTATIONS));
    });
    test('card presenters and payload builders agree', () => {
        expect(new Set(diagnostics.cardResultPresentations)).toEqual(new Set(diagnostics.resultPresentationPayloadBuilders));
    });
    test('execution handlers cover the exported execution contract', () => {
        expect(new Set(diagnostics.executionKinds)).toEqual(new Set(AGENT_WORKSPACE_EXECUTION_KINDS));
    });
    test('real conversation capabilities expose stable unique actions and core operations', () => {
        const oneAtom = capabilities.filter(capability => capability.targetAtomId === capabilities[0].targetAtomId);
        expect(new Set(oneAtom.map(capability => capability.capabilityId)).size).toBe(oneAtom.length);
        expect(oneAtom.map(capability => capability.actionId)).toEqual(expect.arrayContaining(['open_focus_mode', 'open_learning_path', 'build_study_session', 'generate_quiz', 'recap']));
        expect(oneAtom.map(capability => capability.actionId)).not.toContain('analyze_answer');
    });
    test('all emitted operations are executable through both frontend registries', () => {
        for (const capability of capabilities) if (capability.execution.kind === 'knowledge_operation') {
            expect(diagnostics.operationTransports).toContain(capability.execution.operationId);
            expect(diagnostics.operationRequestBuilders).toContain(capability.execution.operationId);
        }
    });
    test('every emitted result presentation has a frontend presenter', () => {
        for (const capability of capabilities) if (capability.execution.kind === 'knowledge_operation') expect(diagnostics.resultPresentations).toContain(capability.execution.resultPresentation);
    });
    test('emitted operation presentations respect each operation allowlist', () => {
        for (const capability of capabilities) if (capability.execution.kind === 'knowledge_operation') expect(diagnostics.operationAllowedResultPresentations[capability.execution.operationId]).toContain(capability.execution.resultPresentation);
    });
    test('emitted non-default presentations require an explicit override', () => {
        for (const capability of capabilities) if (capability.execution.kind === 'knowledge_operation') {
            const { operationId, resultPresentation } = capability.execution;
            if (resultPresentation !== diagnostics.operationDefaultResultPresentations[operationId]) expect(diagnostics.operationResultPresentationOverrideMap[operationId]).toContain(resultPresentation);
        }
    });
    test('tutor override is exercised by actual capability emission', () => {
        expect(capabilities.some(capability => capability.execution.kind === 'knowledge_operation' && capability.execution.resultPresentation === 'tutor_action_card')).toBe(true);
        // Workflow-history cards are emitted by artifact workflows, not every conversation.
        expect(diagnostics.operationAllowedResultPresentations.fetch_workflow_artifacts).toEqual(expect.arrayContaining(['knowledge_run_card', 'knowledge_run_history_card']));
    });
    test('every emitted capability has a complete executable identity and label', () => {
        for (const capability of capabilities) {
            expect(capability.capabilityId).toBeTruthy(); expect(capability.actionId).toBeTruthy();
            expect(capability.targetAtomId).toBeTruthy(); expect(capability.label).toBeTruthy();
            expect(capability.labelKey).toMatch(/^agentWorkspace\.actions\./);
            expect(diagnostics.executionKinds).toContain(capability.execution.kind);
        }
    });
    test.each([{ execution: { kind: 'unsupported' } }, { actionId: 'open_learning_path' }])('rejects unsupported/missing execution without implicit legacy I/O: %p', async capability => {
        await workspace.executeCapability({}, capability, {});
        expect(fetch).not.toHaveBeenCalled();
        expect(diagnostics.legacyActionFallbacks).toEqual([]);
    });
});
