import { JSDOM } from 'jsdom';

type AgentRuntimeModule = {
    createAgentWorkspaceRuntime: (options?: Record<string, unknown>) => {
        init: () => void;
        sendConversation: () => Promise<void>;
        loadFoundationReadiness: () => Promise<void>;
        openLearningPathDock: (preferredAtomId?: string) => void;
        hidePathDock: () => void;
        togglePathFullscreen: () => void;
        getDiagnosticsSnapshot: () => {
            conversationRequests: number;
            replayCandidateTurns: number;
            turnCounts: {
                user: number;
                assistant: number;
                system: number;
                total: number;
            };
            turns: Array<Record<string, unknown>>;
            capabilityEvents: Array<Record<string, unknown>>;
            lastCapabilityEvent: Record<string, unknown> | null;
            lastConversation: Record<string, unknown> | null;
            lastFoundationReadiness: Record<string, unknown> | null;
            lastFailure: Record<string, unknown> | null;
            memoryPolicySummary: Record<string, unknown>;
            managedConversationSummary: Record<string, unknown>;
            pathState: {
                visible: boolean;
                fullscreen: boolean;
                atomId: string;
            };
            latestFocusAtomId: string;
            latestKnowledgePoints: number;
        };
        getDiagnosticsTrendSnapshot: () => {
            conversationRequests: number;
            replayCandidateTurns: number;
            userTurns: number;
            replayCandidateRate: number;
            operationStats: Array<Record<string, unknown>>;
        };
        getDiagnosticsIndexSnapshot: () => {
            turnIndex: {
                byTurnId: Record<string, Record<string, unknown>>;
                replayCandidateTurnIds: string[];
            };
            capabilityIndex: {
                operationIds: string[];
                byOperationId: Record<string, Record<string, unknown>>;
            };
            managedConversationIndex: {
                actionIds: string[];
                byActionId: Record<string, Record<string, unknown>>;
                continuitySummary: Record<string, unknown>;
            };
        };
        exportDiagnosticsReport: (options?: { format?: string }) => string | Record<string, unknown>;
        persistDiagnosticsReport: (options?: { endpoint?: string; source?: string }) => Promise<Record<string, unknown>>;
    };
};

function createShellHtml(): string {
    return `
<!doctype html>
<html>
  <body>
    <div id="graph-wrapper"></div>
    <div id="path-container" style="display:none"></div>
    <button id="btn-path-mode" type="button"></button>
    <aside id="agent-workspace-panel">
      <form id="agent-workspace-form">
        <input id="agent-workspace-user-id" value="agent_user_default" />
        <textarea id="agent-workspace-input"></textarea>
        <button id="agent-workspace-send" type="submit">Send</button>
      </form>
      <div id="agent-workspace-messages"></div>
      <button id="agent-workspace-open-learning-path" type="button">Learning Path</button>
      <button id="agent-workspace-close-learning-path" type="button">Close Path</button>
      <button id="agent-workspace-path-fullscreen" type="button">Path Fullscreen</button>
      <button id="agent-workspace-open-foundation-readiness" type="button">Foundation Readiness</button>
      <div id="agent-workspace-knowledge-list"></div>
    </aside>
  </body>
</html>
`;
}

async function flushAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('agent workspace runtime behavior', () => {
    let dom: JSDOM | null = null;
    let runtimeModule: AgentRuntimeModule;

    beforeEach(() => {
        jest.resetModules();
        runtimeModule = require('./frontend/agent_workspace_runtime.js') as AgentRuntimeModule;

        dom = new JSDOM(createShellHtml(), { url: 'http://localhost/' });
        const win = dom.window as unknown as Record<string, unknown>;

        (global as unknown as Record<string, unknown>).window = dom.window;
        (global as unknown as Record<string, unknown>).document = dom.window.document;
        (global as unknown as Record<string, unknown>).Event = dom.window.Event;
        (global as unknown as Record<string, unknown>).CustomEvent = dom.window.CustomEvent;
        (global as unknown as Record<string, unknown>).KeyboardEvent = dom.window.KeyboardEvent;
        (global as unknown as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
        (global as unknown as Record<string, unknown>).addEventListener = dom.window.addEventListener.bind(dom.window);
        (global as unknown as Record<string, unknown>).removeEventListener = dom.window.removeEventListener.bind(dom.window);
        (global as unknown as Record<string, unknown>).dispatchEvent = dom.window.dispatchEvent.bind(dom.window);
        (global as unknown as Record<string, unknown>).pathApp = {
            uiInitialized: false,
            init: jest.fn(),
            switchCentral: jest.fn(),
            triggerUpdate: jest.fn(),
            requestBridgeWindowVisibility: jest.fn().mockResolvedValue(true),
        };
        (global as unknown as Record<string, unknown>).focusOnNode = jest.fn();
        (global as unknown as Record<string, unknown>).enterFocusMode = jest.fn();
        (global as unknown as Record<string, unknown>).i18n = {
            t: (_key: string, _params?: Record<string, unknown>) => '',
            onLanguageChange: jest.fn(),
        };
        (global as unknown as Record<string, unknown>).NoteConnectionAgentWorkspaceContract = {
            createAgentConversationPayload: (input: { userId: string; message: string; topK: number }) => input,
            buildKnowledgeOperationRequestPayload: (capability: any) => {
                const operationId = capability.execution.operationId;
                const request = capability.request || {};
                const endpoint = operationId === 'build_learning_path'
                    ? '/api/knowledge/path'
                    : operationId === 'build_study_session'
                        ? '/api/knowledge/session/plan'
                        : operationId === 'query_knowledge'
                            ? '/api/knowledge/query'
                            : operationId === 'evaluate_ingest_guardrails'
                                ? '/api/knowledge/ingest/guardrails/evaluate'
                        : operationId === 'query_session_history'
                            ? '/api/knowledge/session/history'
                            : operationId === 'query_mastery_misconceptions'
                                ? '/api/knowledge/mastery/misconceptions'
                            : operationId === 'capture_learning_quality_snapshot'
                                ? '/api/knowledge/quality/snapshot'
                                : operationId === 'apply_memory_policy'
                                    ? '/api/knowledge/memory/policy'
                                    : '/api/knowledge/tutor/action';
                if (operationId === 'apply_memory_policy') {
                    const memoryOperation = request.memoryOperation || 'snapshot';
                    const atomId = request.atomId || '';
                    const memoryKey = request.memoryKey || (atomId ? `conversation_note:${atomId}` : '');
                    const memoryTags = Array.isArray(request.memoryTags) ? request.memoryTags : [];
                    const memoryReferences = Array.isArray(request.memoryReferences)
                        ? Array.from(new Set([...request.memoryReferences, ...(atomId ? [atomId] : [])]))
                        : (atomId ? [atomId] : []);
                    const promptMessage = typeof request.memoryPromptMessage === 'string'
                        ? request.memoryPromptMessage
                        : '';
                    return {
                        operationId,
                        endpoint,
                        method: 'POST',
                        resultPresentation: capability.execution.resultPresentation,
                        body: {
                            userId: request.userId,
                            layer: request.memoryLayer || 'session',
                            operation: memoryOperation,
                            ...(memoryOperation === 'write' && typeof request.memoryValue === 'string' && request.memoryValue.trim().length > 0
                                ? {
                                    entries: [
                                        {
                                            key: memoryKey,
                                            value: request.memoryValue.trim(),
                                            tags: memoryTags,
                                            references: memoryReferences,
                                        },
                                    ],
                                }
                                : {}),
                            ...(Number.isFinite(Number(request.memoryLimit))
                                ? { limit: Number(request.memoryLimit) }
                                : {}),
                            ...(memoryOperation === 'read' && Array.isArray(request.memoryMatchKeys) && request.memoryMatchKeys.length > 0
                                ? { matchKeys: request.memoryMatchKeys }
                                : {}),
                            ...(memoryOperation === 'read' && typeof request.memoryQuery === 'string' && request.memoryQuery.trim().length > 0
                                ? { query: request.memoryQuery.trim() }
                                : {}),
                            ...(memoryOperation === 'evict' && Array.isArray(request.memoryMatchKeys) && request.memoryMatchKeys.length > 0
                                ? { matchKeys: request.memoryMatchKeys }
                                : {}),
                        },
                        ...(memoryOperation === 'write' && !(typeof request.memoryValue === 'string' && request.memoryValue.trim().length > 0)
                            ? {
                                promptConfig: {
                                    kind: 'memory_write',
                                    message: promptMessage,
                                    entryTemplate: {
                                        key: memoryKey,
                                        tags: memoryTags,
                                        references: memoryReferences,
                                    },
                                },
                            }
                            : {}),
                    };
                }
                if (operationId === 'query_knowledge') {
                    return {
                        operationId,
                        endpoint,
                        method: 'POST',
                        resultPresentation: capability.execution.resultPresentation,
                        body: {
                            query: request.query || request.message || '',
                            topK: Number.isFinite(Number(request.topK)) ? Number(request.topK) : 4,
                        },
                    };
                }
                if (operationId === 'evaluate_ingest_guardrails') {
                    return {
                        operationId,
                        endpoint,
                        method: 'POST',
                        resultPresentation: capability.execution.resultPresentation,
                        body: {},
                    };
                }
                if (operationId === 'query_mastery_misconceptions') {
                    return {
                        operationId,
                        endpoint,
                        method: 'POST',
                        resultPresentation: capability.execution.resultPresentation,
                        body: {
                            userId: request.userId,
                            topK: Number.isFinite(Number(request.topK)) ? Number(request.topK) : 5,
                            ...(typeof request.atomId === 'string' && request.atomId.trim().length > 0
                                ? { atomIds: [request.atomId.trim()] }
                                : {}),
                        },
                    };
                }
                return {
                    operationId,
                    endpoint,
                    method: 'POST',
                    resultPresentation: capability.execution.resultPresentation,
                    body: request,
                };
            },
        };
        Object.assign(win, {
            pathApp: (global as unknown as Record<string, unknown>).pathApp,
            focusOnNode: (global as unknown as Record<string, unknown>).focusOnNode,
            enterFocusMode: (global as unknown as Record<string, unknown>).enterFocusMode,
            i18n: (global as unknown as Record<string, unknown>).i18n,
            NoteConnectionAgentWorkspaceContract: (global as unknown as Record<string, unknown>).NoteConnectionAgentWorkspaceContract,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (dom) {
            dom.window.close();
            dom = null;
        }
        delete (global as unknown as Record<string, unknown>).window;
        delete (global as unknown as Record<string, unknown>).document;
        delete (global as unknown as Record<string, unknown>).Event;
        delete (global as unknown as Record<string, unknown>).CustomEvent;
        delete (global as unknown as Record<string, unknown>).KeyboardEvent;
        delete (global as unknown as Record<string, unknown>).HTMLElement;
        delete (global as unknown as Record<string, unknown>).addEventListener;
        delete (global as unknown as Record<string, unknown>).removeEventListener;
        delete (global as unknown as Record<string, unknown>).dispatchEvent;
        delete (global as unknown as Record<string, unknown>).pathApp;
        delete (global as unknown as Record<string, unknown>).focusOnNode;
        delete (global as unknown as Record<string, unknown>).enterFocusMode;
        delete (global as unknown as Record<string, unknown>).i18n;
        delete (global as unknown as Record<string, unknown>).NoteConnectionAgentWorkspaceContract;
        delete (global as unknown as Record<string, unknown>).prompt;
        delete (global as unknown as Record<string, unknown>).fetch;
    });

    test('submits conversation and clicking point card opens focus mode', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                result: {
                    userId: 'agent_user_default',
                    message: 'Found 1 local knowledge point(s).',
                    knowledgePoints: [
                        {
                            atomId: 'atom-focus-1',
                            title: 'Retrieval Loop',
                            snippet: 'Loop retrieval and recap.',
                            score: 0.9321,
                            capabilities: [
                                {
                                    actionId: 'open_focus_mode',
                                    label: 'Focus',
                                    request: { userId: 'agent_user_default', atomId: 'atom-focus-1' },
                                    execution: { kind: 'frontend_only' },
                                },
                            ],
                        },
                    ],
                },
            }),
        });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'show retrieval';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/knowledge/conversation',
            expect.objectContaining({ method: 'POST' })
        );

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        expect(pointCard).not.toBeNull();
        pointCard.click();

        const focusOnNode = (global as unknown as Record<string, unknown>).focusOnNode as jest.Mock;
        expect(focusOnNode).toHaveBeenCalledWith('atom-focus-1');
    });

    test('executes learning path capability and opens docked path pane', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:00.000Z',
                            asOf: '2026-04-20T04:00:00.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 11,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-path-1',
                                title: 'Path Candidate',
                                snippet: 'Open path card flow.',
                                score: 0.84,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Learning Path',
                                        request: { userId: 'agent_user_default', atomId: 'atom-path-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        masteryPaths: [{ id: 'm1' }],
                        divergencePaths: [{ id: 'd1' }],
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'build path';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = Array.from(document.querySelectorAll('.agent-workspace-action-button'))
            .find((button) => (button as HTMLElement).textContent === 'Learning Path') as HTMLButtonElement;
        expect(actionButton).not.toBeUndefined();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/path',
            expect.objectContaining({ method: 'POST' })
        );

        expect(document.body.classList.contains('agent-workspace-path-visible')).toBe(true);
        const pathContainer = document.getElementById('path-container') as HTMLElement;
        expect(pathContainer.classList.contains('agent-workspace-path-docked')).toBe(true);

        const pathApp = (global as unknown as Record<string, unknown>).pathApp as Record<string, jest.Mock>;
        expect(pathApp.init).toHaveBeenCalledWith('atom-path-1');
        expect(pathApp.requestBridgeWindowVisibility).toHaveBeenCalledWith(
            true,
            expect.objectContaining({ reason: 'agent-workspace-open-path-dock' })
        );
    });

    test('renders active atom rail and active-card highlight after focus changes', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                result: {
                    userId: 'agent_user_default',
                    message: 'Found 2 local knowledge point(s).',
                    knowledgePoints: [
                        {
                            atomId: 'atom-active-1',
                            title: 'Active Candidate One',
                            snippet: 'First active candidate.',
                            score: 0.84,
                            capabilities: [],
                        },
                        {
                            atomId: 'atom-active-2',
                            title: 'Active Candidate Two',
                            snippet: 'Second active candidate.',
                            score: 0.92,
                            capabilities: [],
                        },
                    ],
                },
            }),
        });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'show active rail';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        expect(document.querySelector('.agent-workspace-active-point')).toBeNull();

        const pointCards = Array.from(document.querySelectorAll('.agent-workspace-point-card')) as HTMLElement[];
        expect(pointCards).toHaveLength(2);

        pointCards[1].click();
        await flushAsync();

        const activeRail = document.querySelector('.agent-workspace-active-point') as HTMLElement;
        expect(activeRail).not.toBeNull();
        expect(activeRail.textContent || '').toContain('Active Candidate Two');
        expect(activeRail.textContent || '').toContain('Second active candidate.');

        const refreshedCards = Array.from(document.querySelectorAll('.agent-workspace-point-card')) as HTMLElement[];
        expect(refreshedCards[0].classList.contains('agent-workspace-point-card--active')).toBe(false);
        expect(refreshedCards[1].classList.contains('agent-workspace-point-card--active')).toBe(true);
    });

    test('routes toolbar learning path action through active atom capability', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 2 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-toolbar-1',
                                title: 'Toolbar Candidate One',
                                snippet: 'First toolbar candidate.',
                                score: 0.71,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Learning Path',
                                        request: { userId: 'agent_user_default', atomId: 'atom-toolbar-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                ],
                            },
                            {
                                atomId: 'atom-toolbar-2',
                                title: 'Toolbar Candidate Two',
                                snippet: 'Second toolbar candidate.',
                                score: 0.93,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Learning Path',
                                        request: { userId: 'agent_user_default', atomId: 'atom-toolbar-2' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        masteryPaths: [{ id: 'm-toolbar-1' }],
                        divergencePaths: [{ id: 'd-toolbar-1' }],
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'toolbar route';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCards = Array.from(document.querySelectorAll('.agent-workspace-point-card')) as HTMLElement[];
        pointCards[1].click();
        await flushAsync();

        const openLearningPathButton = document.getElementById('agent-workspace-open-learning-path') as HTMLButtonElement;
        openLearningPathButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/path',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('atom-toolbar-2'),
            })
        );

        const pathApp = (global as unknown as Record<string, unknown>).pathApp as Record<string, jest.Mock>;
        expect(pathApp.init).toHaveBeenCalledWith('atom-toolbar-2');
    });

    test('executes active rail contextual capability through shared capability path', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-rail-1',
                                title: 'Rail Candidate',
                                snippet: 'Rail capability candidate.',
                                score: 0.88,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Learning Path',
                                        request: { userId: 'agent_user_default', atomId: 'atom-rail-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-rail-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            totalActions: 4,
                            totalEstimatedMinutes: 18,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'rail capability';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const railAction = Array.from(document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button'))
            .find((button) => (button as HTMLElement).textContent === 'Build Session') as HTMLButtonElement;
        expect(railAction).not.toBeUndefined();

        railAction.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/session/plan',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('atom-rail-1'),
            })
        );
        expect(document.getElementById('agent-workspace-messages')?.textContent || '').toContain(
            'Study session built (4 actions, 18 min).'
        );
    });

    test('reports aligned path state for active atom in rail and diagnostics snapshot', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                result: {
                    userId: 'agent_user_default',
                    message: 'Found 1 local knowledge point(s).',
                    knowledgePoints: [
                        {
                            atomId: 'atom-pane-1',
                            title: 'Pane Candidate',
                            snippet: 'Aligned pane-state candidate.',
                            score: 0.81,
                            capabilities: [],
                        },
                    ],
                },
            }),
        });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'pane aligned';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        runtime.openLearningPathDock('atom-pane-1');
        await flushAsync();

        const activeRail = document.querySelector('.agent-workspace-active-point') as HTMLElement;
        expect(activeRail.textContent || '').toContain('Focus Ready');
        expect(activeRail.textContent || '').toContain('Path Docked');
        expect(activeRail.textContent || '').toContain('Focus and learning path are aligned on atom-pane-1.');

        const diagnostics = runtime.getDiagnosticsSnapshot();
        expect(diagnostics.pathState.atomId).toBe('atom-pane-1');
        expect(diagnostics.pathState.visible).toBe(true);
        expect(diagnostics.pathState.fullscreen).toBe(false);
    });

    test('surfaces pane drift note when focus atom changes away from docked path target', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                result: {
                    userId: 'agent_user_default',
                    message: 'Found 2 local knowledge point(s).',
                    knowledgePoints: [
                        {
                            atomId: 'atom-drift-1',
                            title: 'Drift Candidate One',
                            snippet: 'Initial path target.',
                            score: 0.77,
                            capabilities: [],
                        },
                        {
                            atomId: 'atom-drift-2',
                            title: 'Drift Candidate Two',
                            snippet: 'New focus target.',
                            score: 0.83,
                            capabilities: [],
                        },
                    ],
                },
            }),
        });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'pane drift';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        runtime.openLearningPathDock('atom-drift-1');
        await flushAsync();

        const pointCards = Array.from(document.querySelectorAll('.agent-workspace-point-card')) as HTMLElement[];
        pointCards[1].click();
        await flushAsync();

        const activeRail = document.querySelector('.agent-workspace-active-point') as HTMLElement;
        expect(activeRail.textContent || '').toContain('Path Pinned');
        expect(activeRail.textContent || '').toContain(
            'Focus is on atom-drift-2. Learning path is still pinned to atom-drift-1. Reopen Learning Path to realign.'
        );

        const diagnostics = runtime.getDiagnosticsSnapshot();
        expect(diagnostics.latestFocusAtomId).toBe('atom-drift-2');
        expect(diagnostics.pathState.atomId).toBe('atom-drift-1');
    });

    test('renders active atom summary cards from capability taxonomy without endpoint branching', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                result: {
                    userId: 'agent_user_default',
                    message: 'Found 1 local knowledge point(s).',
                    knowledgePoints: [
                        {
                            atomId: 'atom-summary-1',
                            title: 'Summary Candidate',
                            snippet: 'Capability summary candidate.',
                            score: 0.9,
                            capabilities: [
                                {
                                    actionId: 'build_study_session',
                                    label: 'Build Session',
                                    request: { userId: 'agent_user_default', atomId: 'atom-summary-1' },
                                    execution: {
                                        kind: 'knowledge_operation',
                                        operationId: 'build_study_session',
                                        resultPresentation: 'study_session_card',
                                    },
                                },
                                {
                                    actionId: 'recap',
                                    label: 'Recap',
                                    request: { userId: 'agent_user_default', atomId: 'atom-summary-1', actionKind: 'recap' },
                                    execution: {
                                        kind: 'knowledge_operation',
                                        operationId: 'execute_tutor_action',
                                        resultPresentation: 'assistant_message',
                                    },
                                },
                                {
                                    actionId: 'inspect_managed_memory_state',
                                    label: 'Managed Memory',
                                    request: { userId: 'agent_user_default', atomId: 'atom-summary-1' },
                                    execution: {
                                        kind: 'knowledge_operation',
                                        operationId: 'apply_memory_policy',
                                        resultPresentation: 'memory_policy_card',
                                    },
                                },
                                {
                                    actionId: 'inspect_query_trace',
                                    label: 'Query Trace',
                                    request: { userId: 'agent_user_default', atomId: 'atom-summary-1' },
                                    execution: {
                                        kind: 'knowledge_operation',
                                        operationId: 'query_knowledge',
                                        resultPresentation: 'query_trace_card',
                                    },
                                },
                            ],
                        },
                    ],
                },
            }),
        });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'summary cards';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        expect(summaryCards).toHaveLength(3);
        expect(summaryCards[0].textContent || '').toContain('Study Loop');
        expect(summaryCards[0].textContent || '').toContain('2 ready');
        expect(summaryCards[0].textContent || '').toContain('Build Session');
        expect(summaryCards[0].textContent || '').toContain('Recap');
        expect(summaryCards[1].textContent || '').toContain('Support Surface');
        expect(summaryCards[1].textContent || '').toContain('Memory 1');
        expect(summaryCards[1].textContent || '').toContain('Diagnostics 1');
        expect(summaryCards[2].textContent || '').toContain('Recent Activity');
        expect(summaryCards[2].textContent || '').toContain('0 recent results');
        expect(summaryCards[2].textContent || '').toContain('No current-atom history yet');
    });

    test('updates active atom study summary with latest action after execution', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-summary-2',
                                title: 'Summary Candidate Two',
                                snippet: 'Execution summary candidate.',
                                score: 0.86,
                                capabilities: [
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-summary-2' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            totalActions: 3,
                            totalEstimatedMinutes: 12,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'summary latest action';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const railAction = Array.from(document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button'))
            .find((button) => (button as HTMLElement).textContent === 'Build Session') as HTMLButtonElement;
        railAction.click();
        await flushAsync();

        const studySummaryCard = document.querySelector('.agent-workspace-active-point-summary-card') as HTMLElement;
        expect(studySummaryCard.textContent || '').toContain('Last action');
        expect(studySummaryCard.textContent || '').toContain('Build Session');
        expect(studySummaryCard.textContent || '').toContain('Success');
    });

    test('keeps recent current-atom activity history across turns for the same active atom', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-history-1',
                                title: 'History Candidate',
                                snippet: 'Cross-turn continuity history.',
                                score: 0.88,
                                capabilities: [
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Managed Memory',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'recap',
                                        label: 'Recap',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-1', actionKind: 'recap' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            totalActions: 3,
                            totalEstimatedMinutes: 12,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'snapshot',
                        entries: [{ key: 'conversation_note:atom-history-1', value: 'Persisted note.' }],
                        evictedCount: 0,
                        recommendedActions: [],
                        stats: {
                            session: 1,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        message: 'Recap completed.',
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-history-1',
                                title: 'History Candidate',
                                snippet: 'Cross-turn continuity history refreshed.',
                                score: 0.9,
                                capabilities: [
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Managed Memory',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'recap',
                                        label: 'Recap',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-1', actionKind: 'recap' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            totalActions: 4,
                            totalEstimatedMinutes: 15,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'history continuity';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const findActiveRailButton = (label: string): HTMLButtonElement => Array.from(
            document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === label) as HTMLButtonElement;
        const findPointCardButton = (label: string): HTMLButtonElement => Array.from(
            document.querySelectorAll('.agent-workspace-point-card[data-atom-id="atom-history-1"] .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === label) as HTMLButtonElement;

        findActiveRailButton('Build Session').click();
        await flushAsync();
        findActiveRailButton('Managed Memory').click();
        await flushAsync();
        findPointCardButton('Recap').click();
        await flushAsync();

        input.value = 'history continuity refresh';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        expect(summaryCards).toHaveLength(3);
        expect(summaryCards[0].textContent || '').toContain('Last action');
        expect(summaryCards[0].textContent || '').toContain('Recap');
        expect(summaryCards[0].textContent || '').toContain('Success');
        expect(summaryCards[2].textContent || '').toContain('Recent Activity');
        expect(summaryCards[2].textContent || '').toContain('3 recent results');
        expect(summaryCards[2].textContent || '').toContain('1. Recap');
        expect(summaryCards[2].textContent || '').toContain('Recap completed.');
        expect(summaryCards[2].textContent || '').toContain('2. Managed Memory');
        expect(summaryCards[2].textContent || '').toContain('session/snapshot');
        expect(summaryCards[2].textContent || '').toContain('1 entry');
        expect(summaryCards[2].textContent || '').toContain('3. Build Session');
        expect(summaryCards[2].textContent || '').toContain('3 actions');
        expect(summaryCards[2].textContent || '').toContain('12 min');
        const historyToggles = Array.from(summaryCards[2].querySelectorAll('.agent-workspace-history-toggle')) as HTMLButtonElement[];
        expect(historyToggles).toHaveLength(3);
        expect(historyToggles[0].textContent).toBe('Show details');
        historyToggles[0].click();
        await flushAsync();
        const refreshedHistoryCard = (Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[])[2];
        const refreshedHistoryToggles = Array.from(
            refreshedHistoryCard.querySelectorAll('.agent-workspace-history-toggle')
        ) as HTMLButtonElement[];
        expect(refreshedHistoryToggles[0].textContent).toBe('Hide details');
        expect(refreshedHistoryCard.textContent || '').toContain('Operation');
        expect(refreshedHistoryCard.textContent || '').toContain('execute_tutor_action');
        expect(refreshedHistoryCard.textContent || '').toContain('Surface');
        expect(refreshedHistoryCard.textContent || '').toContain('assistant_message');
        expect(refreshedHistoryCard.textContent || '').toContain('Duration');
        expect(refreshedHistoryCard.textContent || '').toContain('At');
        expect(refreshedHistoryCard.textContent || '').toContain('Confidence');
        expect(refreshedHistoryCard.textContent || '').toContain('Rank 1/3');
        expect(refreshedHistoryCard.textContent || '').toContain('Fresh');
        expect(refreshedHistoryCard.textContent || '').toContain('Alt ready');
        expect(refreshedHistoryCard.textContent || '').toContain('Fresh deterministic candidate with no newer overlap.');
        expect(refreshedHistoryCard.textContent || '').toContain('Next step');
        const historyFollowUpButton = refreshedHistoryCard.querySelector(
            '.agent-workspace-history-follow-up .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(historyFollowUpButton.textContent).toBe('Build Session');
        historyFollowUpButton.click();
        await flushAsync();

        const followUpSummaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        expect(followUpSummaryCards[0].textContent || '').toContain('Last action');
        expect(followUpSummaryCards[0].textContent || '').toContain('Build Session');
        expect(followUpSummaryCards[2].textContent || '').toContain('1. Build Session');
        expect(followUpSummaryCards[2].textContent || '').toContain('4 actions');
        expect(followUpSummaryCards[2].textContent || '').toContain('15 min');

        const snapshot = runtime.getDiagnosticsSnapshot();
        expect(
            snapshot.capabilityEvents.filter(
                (event) => event.atomId === 'atom-history-1' && event.status === 'success' && event.phase !== 'request'
            )
        ).toHaveLength(4);
        expect(
            snapshot.capabilityEvents.find(
                (event) => event.atomId === 'atom-history-1' && event.actionId === 'build_study_session' && event.phase === 'result'
            )
        ).toEqual(
            expect.objectContaining({
                resultPreview: expect.objectContaining({
                    kind: 'study_session',
                    totalActions: 3,
                    totalEstimatedMinutes: 12,
                }),
            })
        );
    });

    test('skips already-completed recent actions when resolving history follow-up suggestions', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-history-fresh-1',
                                title: 'Freshness Candidate',
                                snippet: 'History-aware follow-up freshness.',
                                score: 0.84,
                                capabilities: [
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-fresh-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                    {
                                        actionId: 'recap',
                                        label: 'Recap',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-history-fresh-1',
                                            actionKind: 'recap',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                    {
                                        actionId: 'follow_up',
                                        label: 'Follow Up',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-history-fresh-1',
                                            actionKind: 'follow_up',
                                            message: 'continue',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            totalActions: 2,
                            totalEstimatedMinutes: 8,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        message: 'Recap completed.',
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-history-fresh-1',
                                title: 'Freshness Candidate',
                                snippet: 'History-aware follow-up freshness refreshed.',
                                score: 0.86,
                                capabilities: [
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-fresh-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                    {
                                        actionId: 'recap',
                                        label: 'Recap',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-history-fresh-1',
                                            actionKind: 'recap',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                    {
                                        actionId: 'follow_up',
                                        label: 'Follow Up',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-history-fresh-1',
                                            actionKind: 'follow_up',
                                            message: 'continue',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        message: 'Try one harder recall question next.',
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'history freshness';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const findActiveRailButton = (label: string): HTMLButtonElement => Array.from(
            document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === label) as HTMLButtonElement;

        findActiveRailButton('Build Session').click();
        await flushAsync();
        findActiveRailButton('Recap').click();
        await flushAsync();

        input.value = 'history freshness refresh';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        expect(summaryCards[2].textContent || '').toContain('1. Recap');
        expect(summaryCards[2].textContent || '').toContain('2. Build Session');

        const historyToggles = Array.from(summaryCards[2].querySelectorAll('.agent-workspace-history-toggle')) as HTMLButtonElement[];
        expect(historyToggles).toHaveLength(2);
        historyToggles[1].click();
        await flushAsync();

        const refreshedHistoryCard = (Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[])[2];
        expect(refreshedHistoryCard.textContent || '').toContain('Why this');
        expect(refreshedHistoryCard.textContent || '').toContain('Recent activity already covered Recap.');
        expect(refreshedHistoryCard.textContent || '').toContain('Why it held');
        expect(refreshedHistoryCard.textContent || '').toContain(
            'Newer Recap keeps Follow Up ahead, so the next step stays stable across 2 consecutive history events.'
        );
        expect(refreshedHistoryCard.textContent || '').toContain('Confidence');
        expect(refreshedHistoryCard.textContent || '').toContain('Rank 2/4');
        expect(refreshedHistoryCard.textContent || '').toContain('Fresh');
        expect(refreshedHistoryCard.textContent || '').toContain('Stable x2');
        expect(refreshedHistoryCard.textContent || '').toContain('Skipped recent');
        expect(refreshedHistoryCard.textContent || '').toContain('Alt ready');
        expect(refreshedHistoryCard.textContent || '').toContain(
            'Fresh candidate after skipping the more recent Recap repeat. Reinforced across 2 consecutive history events.'
        );
        expect(refreshedHistoryCard.textContent || '').toContain('Also available');
        const alternativeButton = refreshedHistoryCard.querySelector(
            '.agent-workspace-history-follow-up-alternatives .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(alternativeButton.textContent).toBe('Learning Path');
        const historyFollowUpButton = refreshedHistoryCard.querySelector(
            '.agent-workspace-history-follow-up .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(historyFollowUpButton.textContent).toBe('Follow Up');
        historyFollowUpButton.click();
        await flushAsync();

        const refreshedCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        expect(refreshedCards[2].textContent || '').toContain('1. Follow Up');
        expect(refreshedCards[2].textContent || '').toContain('Try one harder recall question next.');
    });

    test('keeps focus mode and path dock coexistence during fullscreen lifecycle', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                result: {
                    userId: 'agent_user_default',
                    message: 'Found 1 local knowledge point(s).',
                    knowledgePoints: [
                        {
                            atomId: 'atom-coexist-1',
                            title: 'Coexist Candidate',
                            snippet: 'Focus then path dock.',
                            score: 0.73,
                            capabilities: [
                                {
                                    actionId: 'open_focus_mode',
                                    label: 'Focus',
                                    request: { userId: 'agent_user_default', atomId: 'atom-coexist-1' },
                                    execution: { kind: 'frontend_only' },
                                },
                            ],
                        },
                    ],
                },
            }),
        });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'focus then open path';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        expect(pointCard).not.toBeNull();
        pointCard.click();

        runtime.openLearningPathDock('atom-coexist-1');
        await flushAsync();

        expect(document.body.classList.contains('agent-workspace-enabled')).toBe(true);
        expect(document.body.classList.contains('agent-workspace-path-visible')).toBe(true);
        expect(document.body.classList.contains('agent-workspace-path-fullscreen')).toBe(false);
        const graphWrapper = document.getElementById('graph-wrapper') as HTMLElement;
        expect(graphWrapper.style.display).toBe('block');

        runtime.togglePathFullscreen();
        expect(document.body.classList.contains('agent-workspace-path-fullscreen')).toBe(true);
        runtime.togglePathFullscreen();
        expect(document.body.classList.contains('agent-workspace-path-fullscreen')).toBe(false);

        const pathApp = (global as unknown as Record<string, unknown>).pathApp as Record<string, jest.Mock>;
        expect(pathApp.requestBridgeWindowVisibility).toHaveBeenCalledWith(
            true,
            expect.objectContaining({ reason: 'agent-workspace-open-path-dock' })
        );
        const focusOnNode = (global as unknown as Record<string, unknown>).focusOnNode as jest.Mock;
        expect(focusOnNode).toHaveBeenCalledWith('atom-coexist-1');
    });

    test('sends deterministic bridge-hide transitions for close button and path exit event', async () => {
        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        runtime.openLearningPathDock('atom-close-1');
        await flushAsync();

        const pathApp = (global as unknown as Record<string, unknown>).pathApp as Record<string, jest.Mock>;
        pathApp.requestBridgeWindowVisibility.mockClear();

        const closeButton = document.getElementById('agent-workspace-close-learning-path') as HTMLButtonElement;
        closeButton.click();
        await flushAsync();

        expect(document.body.classList.contains('agent-workspace-path-visible')).toBe(false);
        expect(document.body.classList.contains('agent-workspace-path-fullscreen')).toBe(false);
        const pathContainer = document.getElementById('path-container') as HTMLElement;
        expect(pathContainer.style.display).toBe('none');
        expect(pathApp.requestBridgeWindowVisibility).toHaveBeenCalledWith(
            false,
            expect.objectContaining({ reason: 'agent-workspace-hide-path-dock' })
        );

        runtime.openLearningPathDock('atom-close-2');
        await flushAsync();
        pathApp.requestBridgeWindowVisibility.mockClear();

        dom!.window.dispatchEvent(new dom!.window.CustomEvent('nc:pathmode:exited'));
        await flushAsync();

        expect(document.body.classList.contains('agent-workspace-path-visible')).toBe(false);
        expect(pathApp.requestBridgeWindowVisibility).toHaveBeenCalledWith(
            false,
            expect.objectContaining({ reason: 'agent-workspace-hide-path-dock' })
        );
    });

    test('executes study session capability and renders summary message', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:01.000Z',
                            asOf: '2026-04-20T04:00:01.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 12,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-session-1',
                                title: 'Session Candidate',
                                snippet: 'Build a study session.',
                                score: 0.77,
                                capabilities: [
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-session-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            totalActions: 4,
                            totalEstimatedMinutes: 12,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'build study session';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/session/plan',
            expect.objectContaining({ method: 'POST' })
        );

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Study session built');
    });

    test('executes query trace capability and renders retrieval summary', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:00.000Z',
                            asOf: '2026-04-20T04:00:00.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 11,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-query-1',
                                title: 'Query Candidate',
                                snippet: 'Inspect retrieval trace.',
                                score: 0.79,
                                capabilities: [
                                    {
                                        actionId: 'inspect_query_trace',
                                        label: 'Query Trace',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-query-1',
                                            query: 'retrieval loop',
                                            topK: 5,
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'query_knowledge',
                                            resultPresentation: 'query_trace_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        items: [{ atom: { id: 'a1' } }, { atom: { id: 'a2' } }],
                        trace: {
                            retrievalModes: ['keyword', 'graph_traversal'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 2,
                            },
                            latencyMs: 17,
                            evidenceCoverageRatio: 0.75,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'inspect query trace';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/query',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            query?: string;
            topK?: number;
        };
        expect(payload.query).toBe('retrieval loop');
        expect(payload.topK).toBe(5);

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Query trace loaded');
        expect(messages.textContent || '').toContain('vector local_ann/independent');
    });

    test('executes ingest guardrail capability and renders gate summary', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:01.000Z',
                            asOf: '2026-04-20T04:00:01.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 12,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-guardrail-1',
                                title: 'Guardrail Candidate',
                                snippet: 'Inspect ingest governance budget.',
                                score: 0.71,
                                capabilities: [
                                    {
                                        actionId: 'inspect_ingest_guardrails',
                                        label: 'Ingest Guardrails',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-guardrail-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'evaluate_ingest_guardrails',
                                            resultPresentation: 'ingest_guardrail_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        overallPassed: false,
                        gates: [
                            { gateId: 'changed_documents', passed: true },
                            { gateId: 'ingest_p95', passed: false },
                        ],
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'inspect ingest guardrails';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/ingest/guardrails/evaluate',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as Record<string, unknown>;
        expect(payload).toEqual({});

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Ingest guardrails evaluated');
    });

    test('executes mastery misconceptions capability and renders summary message', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:00.000Z',
                            asOf: '2026-04-20T04:00:00.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 11,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-misconception-1',
                                title: 'Misconception Candidate',
                                snippet: 'Inspect misconception concentration.',
                                score: 0.72,
                                capabilities: [
                                    {
                                        actionId: 'inspect_mastery_misconceptions',
                                        label: 'Mastery Misconceptions',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-misconception-1',
                                            topK: 6,
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'query_mastery_misconceptions',
                                            resultPresentation: 'mastery_misconceptions_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            trackedTags: 2,
                            totalObservations: 7,
                        },
                        items: [
                            {
                                errorTag: 'overgeneralization',
                            },
                        ],
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'inspect misconceptions';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/mastery/misconceptions',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            topK?: number;
            atomIds?: string[];
        };
        expect(payload.topK).toBe(6);
        expect(payload.atomIds).toEqual(['atom-misconception-1']);

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Mastery misconceptions loaded');
    });

    test('executes follow-up tutor capability and renders assistant message', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:01.000Z',
                            asOf: '2026-04-20T04:00:01.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 12,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-followup-1',
                                title: 'Follow Up Candidate',
                                snippet: 'Tutor follow-up action.',
                                score: 0.66,
                                capabilities: [
                                    {
                                        actionId: 'follow_up',
                                        label: 'Follow Up',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-followup-1',
                                            actionKind: 'follow_up',
                                            message: 'continue',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        message: 'Try one harder recall question next.',
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'follow up';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/tutor/action',
            expect.objectContaining({ method: 'POST' })
        );
        const followUpPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as { actionKind?: string };
        expect(followUpPayload.actionKind).toBe('follow_up');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Try one harder recall question next.');
    });

    test('executes generate_transfer tutor capability and preserves action kind', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:00.000Z',
                            asOf: '2026-04-20T04:00:00.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 11,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-transfer-1',
                                title: 'Transfer Candidate',
                                snippet: 'Tutor transfer action.',
                                score: 0.69,
                                capabilities: [
                                    {
                                        actionId: 'generate_transfer',
                                        label: 'Generate Transfer',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-transfer-1',
                                            actionKind: 'generate_transfer',
                                            message: 'apply to new scenario',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        message: 'Apply retrieval loop to a new domain and validate assumptions.',
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'transfer task';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/tutor/action',
            expect.objectContaining({ method: 'POST' })
        );
        const transferPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as { actionKind?: string };
        expect(transferPayload.actionKind).toBe('generate_transfer');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Apply retrieval loop to a new domain and validate assumptions.');
    });

    test('executes analyze_answer tutor capability and prompts for missing learner answer', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:01.000Z',
                            asOf: '2026-04-20T04:00:01.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 12,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-analyze-1',
                                title: 'Analyze Candidate',
                                snippet: 'Tutor analyze action.',
                                score: 0.71,
                                capabilities: [
                                    {
                                        actionId: 'analyze_answer',
                                        label: 'Analyze Answer',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-analyze-1',
                                            actionKind: 'analyze_answer',
                                            message: 'grade this answer',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        message: 'Answer quality: partial.',
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;
        const promptMock = jest.fn().mockReturnValue('retrieval loop plus source evidence');
        (global as unknown as Record<string, unknown>).prompt = promptMock;
        (dom!.window as unknown as Record<string, unknown>).prompt = promptMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'analyze answer';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(promptMock).toHaveBeenCalledTimes(1);
        const analyzePayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            actionKind?: string;
            answer?: string;
        };
        expect(analyzePayload.actionKind).toBe('analyze_answer');
        expect(analyzePayload.answer).toBe('retrieval loop plus source evidence');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Answer quality: partial.');
    });

    test('executes memory snapshot capability and renders memory policy summary', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-1',
                                title: 'Memory Candidate',
                                snippet: 'Inspect memory snapshot.',
                                score: 0.73,
                                capabilities: [
                                    {
                                        actionId: 'inspect_memory_snapshot',
                                        label: 'Memory Snapshot',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'snapshot',
                                            memoryLimit: 10,
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'snapshot',
                        entries: [
                            { key: 'k1', value: 'v1' },
                            { key: 'k2', value: 'v2' },
                        ],
                        evictedCount: 0,
                        stats: {
                            session: 2,
                            unit: 1,
                            longTerm: 3,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'show memory snapshot';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/memory/policy',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            layer?: string;
            operation?: string;
        };
        expect(payload.layer).toBe('session');
        expect(payload.operation).toBe('snapshot');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Memory snapshot loaded');
    });

    test('executes unit memory snapshot capability and forwards unit layer', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-unit-1',
                                title: 'Unit Memory Candidate',
                                snippet: 'Inspect unit memory snapshot.',
                                score: 0.71,
                                capabilities: [
                                    {
                                        actionId: 'inspect_unit_memory_snapshot',
                                        label: 'Unit Memory Snapshot',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-unit-1',
                                            memoryLayer: 'unit',
                                            memoryOperation: 'snapshot',
                                            memoryLimit: 10,
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'unit',
                        operation: 'snapshot',
                        entries: [
                            { key: 'u1', value: 'unit memory 1' },
                        ],
                        evictedCount: 0,
                        stats: {
                            session: 3,
                            unit: 4,
                            longTerm: 2,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'show unit memory snapshot';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/memory/policy',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            layer?: string;
            operation?: string;
        };
        expect(payload.layer).toBe('unit');
        expect(payload.operation).toBe('snapshot');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('unit/snapshot');
    });

    test('executes long-term memory snapshot capability and forwards long_term layer', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-long-term-1',
                                title: 'Long-Term Memory Candidate',
                                snippet: 'Inspect long-term memory snapshot.',
                                score: 0.7,
                                capabilities: [
                                    {
                                        actionId: 'inspect_long_term_memory_snapshot',
                                        label: 'Long-Term Memory Snapshot',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-long-term-1',
                                            memoryLayer: 'long_term',
                                            memoryOperation: 'snapshot',
                                            memoryLimit: 10,
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'long_term',
                        operation: 'snapshot',
                        entries: [
                            { key: 'lt1', value: 'long-term memory 1' },
                        ],
                        evictedCount: 0,
                        stats: {
                            session: 2,
                            unit: 1,
                            longTerm: 5,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'show long-term memory snapshot';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/memory/policy',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            layer?: string;
            operation?: string;
        };
        expect(payload.layer).toBe('long_term');
        expect(payload.operation).toBe('snapshot');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('long_term/snapshot');
    });

    test('executes memory retrain-plan capability and preserves readonly operation', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-2',
                                title: 'Retrain Candidate',
                                snippet: 'Inspect memory retrain plan.',
                                score: 0.7,
                                capabilities: [
                                    {
                                        actionId: 'inspect_memory_retrain_plan',
                                        label: 'Memory Retrain Plan',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-2',
                                            memoryLayer: 'session',
                                            memoryOperation: 'retrain_plan',
                                            memoryLimit: 6,
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'retrain_plan',
                        entries: [],
                        evictedCount: 0,
                        recommendedActions: [
                            { id: 'a1' },
                            { id: 'a2' },
                        ],
                        stats: {
                            session: 4,
                            unit: 2,
                            longTerm: 3,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'show memory retrain plan';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/memory/policy',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            operation?: string;
            limit?: number;
        };
        expect(payload.operation).toBe('retrain_plan');
        expect(payload.limit).toBe(6);

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('recommended 2 actions');
    });

    test('executes memory read capability and forwards query text', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-3',
                                title: 'Memory Read Candidate',
                                snippet: 'Inspect memory read.',
                                score: 0.68,
                                capabilities: [
                                    {
                                        actionId: 'inspect_memory_read',
                                        label: 'Memory Read',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-3',
                                            memoryLayer: 'session',
                                            memoryOperation: 'read',
                                            memoryLimit: 7,
                                            memoryQuery: 'retrieval',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'memory:1', value: 'retrieval note' },
                        ],
                        evictedCount: 0,
                        stats: {
                            session: 5,
                            unit: 2,
                            longTerm: 3,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'read memory retrieval';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/memory/policy',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            operation?: string;
            limit?: number;
            query?: string;
        };
        expect(payload.operation).toBe('read');
        expect(payload.limit).toBe(7);
        expect(payload.query).toBe('retrieval');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('read');
    });

    test('executes long-term memory read capability and forwards long_term query text', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-long-term-2',
                                title: 'Long-Term Memory Read Candidate',
                                snippet: 'Inspect long-term memory read.',
                                score: 0.69,
                                capabilities: [
                                    {
                                        actionId: 'inspect_long_term_memory_read',
                                        label: 'Long-Term Memory Read',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-long-term-2',
                                            memoryLayer: 'long_term',
                                            memoryOperation: 'read',
                                            memoryLimit: 8,
                                            memoryQuery: 'durable retrieval',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'long_term',
                        operation: 'read',
                        entries: [
                            { key: 'memory:lt:1', value: 'durable retrieval note' },
                        ],
                        evictedCount: 0,
                        stats: {
                            session: 5,
                            unit: 2,
                            longTerm: 8,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'read long-term memory durable retrieval';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/memory/policy',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            layer?: string;
            operation?: string;
            limit?: number;
            query?: string;
        };
        expect(payload.layer).toBe('long_term');
        expect(payload.operation).toBe('read');
        expect(payload.limit).toBe(8);
        expect(payload.query).toBe('durable retrieval');

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('long_term/read');
    });

    test('executes managed memory state capability and forwards targeted matchKeys', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-managed-1',
                                title: 'Managed Memory Candidate',
                                snippet: 'Inspect managed memory state.',
                                score: 0.7,
                                capabilities: [
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Managed Memory',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-managed-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'read',
                                            memoryLimit: 4,
                                            memoryMatchKeys: [
                                                'conversation_note:atom-memory-managed-1',
                                                'conversation_correction:atom-memory-managed-1',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'conversation_note:atom-memory-managed-1', value: 'managed note' },
                        ],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-memory-managed-1',
                                'conversation_correction:atom-memory-managed-1',
                            ],
                            matchedKeys: ['conversation_note:atom-memory-managed-1'],
                            missingKeys: ['conversation_correction:atom-memory-managed-1'],
                            returnedEntries: 1,
                        },
                        evictedCount: 0,
                        stats: {
                            session: 4,
                            unit: 1,
                            longTerm: 6,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'inspect managed memory';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/knowledge/memory/policy',
            expect.objectContaining({ method: 'POST' })
        );
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            layer?: string;
            operation?: string;
            limit?: number;
            matchKeys?: string[];
        };
        expect(payload.layer).toBe('session');
        expect(payload.operation).toBe('read');
        expect(payload.limit).toBe(4);
        expect(payload.matchKeys).toEqual([
            'conversation_note:atom-memory-managed-1',
            'conversation_correction:atom-memory-managed-1',
        ]);

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('session/read');
        expect(messages.textContent || '').toContain('present note');
        expect(messages.textContent || '').toContain('missing correction');
        expect(messages.textContent || '').toContain('next Record Correction');
    });

    test('personalizes history follow-up from missing managed memory keys', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-history-1',
                                title: 'Managed Memory History Candidate',
                                snippet: 'History should prioritize missing managed keys.',
                                score: 0.79,
                                capabilities: [
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Managed Memory',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-history-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'read',
                                            memoryLimit: 4,
                                            memoryMatchKeys: [
                                                'conversation_note:atom-memory-history-1',
                                                'conversation_correction:atom-memory-history-1',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'write_memory_note',
                                        label: 'Store Memory Note',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-history-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_note:atom-memory-history-1',
                                            memoryTags: ['agent_workspace', 'conversation_note'],
                                            memoryReferences: ['atom-memory-history-1'],
                                            memoryPromptMessage: 'Store note for atom-memory-history-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'record_memory_correction',
                                        label: 'Record Correction',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-history-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_correction:atom-memory-history-1',
                                            memoryTags: ['agent_workspace', 'conversation_correction'],
                                            memoryReferences: ['atom-memory-history-1'],
                                            memoryPromptMessage: 'Record correction for atom-memory-history-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'conversation_note:atom-memory-history-1', value: 'existing managed note' },
                        ],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-memory-history-1',
                                'conversation_correction:atom-memory-history-1',
                            ],
                            matchedKeys: ['conversation_note:atom-memory-history-1'],
                            missingKeys: ['conversation_correction:atom-memory-history-1'],
                            returnedEntries: 1,
                        },
                        stats: {
                            session: 2,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'write',
                        entries: [
                            { key: 'conversation_correction:atom-memory-history-1', value: 'Persist correction note.' },
                        ],
                        mutatedCount: 1,
                        stats: {
                            session: 3,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;
        const promptMock = jest.fn().mockReturnValue('Persist correction note.');
        (global as unknown as Record<string, unknown>).prompt = promptMock;
        (dom!.window as unknown as Record<string, unknown>).prompt = promptMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'managed memory history';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const actionButton = Array.from(
            document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === 'Managed Memory') as HTMLButtonElement;
        actionButton.click();
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        const historyToggles = Array.from(summaryCards[2].querySelectorAll('.agent-workspace-history-toggle')) as HTMLButtonElement[];
        expect(historyToggles).toHaveLength(1);
        historyToggles[0].click();
        await flushAsync();

        const refreshedHistoryCard = (Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[])[2];
        expect(refreshedHistoryCard.textContent || '').toContain('Why this');
        expect(refreshedHistoryCard.textContent || '').toContain(
            'Managed state still misses correction, so Record Correction becomes next step.'
        );
        expect(refreshedHistoryCard.textContent || '').toContain('Confidence');
        expect(refreshedHistoryCard.textContent || '').toContain('Missing correction');
        expect(refreshedHistoryCard.textContent || '').toContain('Targets missing correction.');

        const historyFollowUpButton = refreshedHistoryCard.querySelector(
            '.agent-workspace-history-follow-up .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(historyFollowUpButton.textContent).toBe('Record Correction');
        historyFollowUpButton.click();
        await flushAsync();

        expect(promptMock).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body || '{}')) as {
            operation?: string;
            entries?: Array<{ key?: string; value?: string }>;
        };
        expect(payload.operation).toBe('write');
        expect(payload.entries?.[0]?.key).toBe('conversation_correction:atom-memory-history-1');
        expect(payload.entries?.[0]?.value).toBe('Persist correction note.');
    });

    test('personalizes history drift when newer managed state resolves a missing key', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-managed-drift-1',
                                title: 'Managed Drift Candidate',
                                snippet: 'Managed drift should explain resolved keys.',
                                score: 0.83,
                                capabilities: [
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Managed Memory',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-drift-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'read',
                                            memoryLimit: 4,
                                            memoryMatchKeys: [
                                                'conversation_note:atom-managed-drift-1',
                                                'conversation_correction:atom-managed-drift-1',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'write_memory_note',
                                        label: 'Store Memory Note',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-drift-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_note:atom-managed-drift-1',
                                            memoryTags: ['agent_workspace', 'conversation_note'],
                                            memoryReferences: ['atom-managed-drift-1'],
                                            memoryPromptMessage: 'Store note for atom-managed-drift-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'record_memory_correction',
                                        label: 'Record Correction',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-drift-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_correction:atom-managed-drift-1',
                                            memoryTags: ['agent_workspace', 'conversation_correction'],
                                            memoryReferences: ['atom-managed-drift-1'],
                                            memoryPromptMessage: 'Record correction for atom-managed-drift-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-managed-drift-1',
                                'conversation_correction:atom-managed-drift-1',
                            ],
                            matchedKeys: [],
                            missingKeys: [
                                'conversation_note:atom-managed-drift-1',
                                'conversation_correction:atom-managed-drift-1',
                            ],
                            returnedEntries: 0,
                        },
                        stats: {
                            session: 0,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'conversation_note:atom-managed-drift-1', value: 'stored managed note' },
                        ],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-managed-drift-1',
                                'conversation_correction:atom-managed-drift-1',
                            ],
                            matchedKeys: ['conversation_note:atom-managed-drift-1'],
                            missingKeys: ['conversation_correction:atom-managed-drift-1'],
                            returnedEntries: 1,
                        },
                        stats: {
                            session: 1,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'managed drift';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const findManagedMemoryButton = (): HTMLButtonElement => Array.from(
            document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === 'Managed Memory') as HTMLButtonElement;

        findManagedMemoryButton().click();
        await flushAsync();
        findManagedMemoryButton().click();
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        const historyToggles = Array.from(summaryCards[2].querySelectorAll('.agent-workspace-history-toggle')) as HTMLButtonElement[];
        expect(historyToggles).toHaveLength(2);
        historyToggles[1].click();
        await flushAsync();

        const refreshedHistoryCard = (Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[])[2];
        expect(refreshedHistoryCard.textContent || '').toContain('Why it changed');
        expect(refreshedHistoryCard.textContent || '').toContain(
            'Newer managed state no longer misses note, so the next step shifts from Store Memory Note to Record Correction.'
        );
    });

    test('personalizes history stability when the same managed key stays missing', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-managed-stability-1',
                                title: 'Managed Stability Candidate',
                                snippet: 'Managed stability should explain persistent gaps.',
                                score: 0.85,
                                capabilities: [
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Managed Memory',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-stability-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'read',
                                            memoryLimit: 4,
                                            memoryMatchKeys: [
                                                'conversation_note:atom-managed-stability-1',
                                                'conversation_correction:atom-managed-stability-1',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'write_memory_note',
                                        label: 'Store Memory Note',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-stability-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_note:atom-managed-stability-1',
                                            memoryTags: ['agent_workspace', 'conversation_note'],
                                            memoryReferences: ['atom-managed-stability-1'],
                                            memoryPromptMessage: 'Store note for atom-managed-stability-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'record_memory_correction',
                                        label: 'Record Correction',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-stability-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_correction:atom-managed-stability-1',
                                            memoryTags: ['agent_workspace', 'conversation_correction'],
                                            memoryReferences: ['atom-managed-stability-1'],
                                            memoryPromptMessage: 'Record correction for atom-managed-stability-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'conversation_note:atom-managed-stability-1', value: 'stored managed note' },
                        ],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-managed-stability-1',
                                'conversation_correction:atom-managed-stability-1',
                            ],
                            matchedKeys: ['conversation_note:atom-managed-stability-1'],
                            missingKeys: ['conversation_correction:atom-managed-stability-1'],
                            returnedEntries: 1,
                        },
                        stats: {
                            session: 1,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'conversation_note:atom-managed-stability-1', value: 'stored managed note' },
                        ],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-managed-stability-1',
                                'conversation_correction:atom-managed-stability-1',
                            ],
                            matchedKeys: ['conversation_note:atom-managed-stability-1'],
                            missingKeys: ['conversation_correction:atom-managed-stability-1'],
                            returnedEntries: 1,
                        },
                        stats: {
                            session: 1,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'managed stability';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const findManagedMemoryButton = (): HTMLButtonElement => Array.from(
            document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === 'Managed Memory') as HTMLButtonElement;

        findManagedMemoryButton().click();
        await flushAsync();
        findManagedMemoryButton().click();
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        const historyToggles = Array.from(summaryCards[2].querySelectorAll('.agent-workspace-history-toggle')) as HTMLButtonElement[];
        expect(historyToggles).toHaveLength(2);
        historyToggles[1].click();
        await flushAsync();

        const refreshedHistoryCard = (Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[])[2];
        expect(refreshedHistoryCard.textContent || '').toContain('Why it held');
        expect(refreshedHistoryCard.textContent || '').toContain(
            'Newer managed state still misses correction, so Record Correction stays next across 2 consecutive history events.'
        );
    });

    test('summarizes managed memory continuity in history card and diagnostics snapshot', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-managed-rollup-1',
                                title: 'Managed Rollup Candidate',
                                snippet: 'Managed continuity rollup should stay readable.',
                                score: 0.84,
                                capabilities: [
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Managed Memory',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-rollup-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'read',
                                            memoryLimit: 4,
                                            memoryMatchKeys: [
                                                'conversation_note:atom-managed-rollup-1',
                                                'conversation_correction:atom-managed-rollup-1',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'write_memory_note',
                                        label: 'Store Memory Note',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-rollup-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_note:atom-managed-rollup-1',
                                            memoryTags: ['agent_workspace', 'conversation_note'],
                                            memoryReferences: ['atom-managed-rollup-1'],
                                            memoryPromptMessage: 'Store note for atom-managed-rollup-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'record_memory_correction',
                                        label: 'Record Correction',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-rollup-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_correction:atom-managed-rollup-1',
                                            memoryTags: ['agent_workspace', 'conversation_correction'],
                                            memoryReferences: ['atom-managed-rollup-1'],
                                            memoryPromptMessage: 'Record correction for atom-managed-rollup-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-managed-rollup-1',
                                'conversation_correction:atom-managed-rollup-1',
                            ],
                            matchedKeys: [],
                            missingKeys: [
                                'conversation_note:atom-managed-rollup-1',
                                'conversation_correction:atom-managed-rollup-1',
                            ],
                            returnedEntries: 0,
                        },
                        stats: {
                            session: 0,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'conversation_note:atom-managed-rollup-1', value: 'stored managed note' },
                        ],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-managed-rollup-1',
                                'conversation_correction:atom-managed-rollup-1',
                            ],
                            matchedKeys: ['conversation_note:atom-managed-rollup-1'],
                            missingKeys: ['conversation_correction:atom-managed-rollup-1'],
                            returnedEntries: 1,
                        },
                        stats: {
                            session: 1,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'managed rollup';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        pointCard.click();
        await flushAsync();

        const findManagedMemoryButton = (): HTMLButtonElement => Array.from(
            document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === 'Managed Memory') as HTMLButtonElement;

        findManagedMemoryButton().click();
        await flushAsync();
        findManagedMemoryButton().click();
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        expect(summaryCards[2].textContent || '').toContain('Managed continuity 2 reads');
        expect(summaryCards[2].textContent || '').toContain('resolved note 1 correction 0');
        expect(summaryCards[2].textContent || '').toContain('resolved no longer needs Store Memory Note');
        expect(summaryCards[2].textContent || '').toContain('persistent note 0 correction 1');
        expect(summaryCards[2].textContent || '').toContain('persistent next Record Correction');
        expect(summaryCards[2].textContent || '').toContain(
            'latest transition resolved note, retired Store Memory Note; persistent correction, next Record Correction'
        );

        const snapshot = runtime.getDiagnosticsSnapshot();
        const managedReadEvents = snapshot.capabilityEvents.filter(
            (event) => event.actionId === 'inspect_managed_memory_state'
                && event.status === 'success'
                && event.phase !== 'request'
                && event.phase !== 'plan'
        );
        expect(managedReadEvents).toHaveLength(2);
        const olderManagedReadEvent = managedReadEvents[0];
        const newerManagedReadEvent = managedReadEvents[1];
        expect(snapshot.managedConversationSummary).toEqual(
            expect.objectContaining({
                executionCount: 2,
                byActionId: expect.objectContaining({
                    inspect_managed_memory_state: 2,
                }),
                continuitySummary: expect.objectContaining({
                    atomIds: ['atom-managed-rollup-1'],
                    atomCount: 1,
                    readCount: 2,
                    transitionCount: 2,
                    resolvedKeyCounts: {
                        note: 1,
                        correction: 0,
                    },
                    resolvedFollowUpActionIds: ['write_memory_note'],
                    resolvedFollowUpActionLabels: ['Store Memory Note'],
                    persistentKeyCounts: {
                        note: 0,
                        correction: 1,
                    },
                    persistentFollowUpActionIds: ['record_memory_correction'],
                    persistentFollowUpActionLabels: ['Record Correction'],
                    lastTransition: expect.objectContaining({
                        keyLabel: 'note, correction',
                        keyLabels: ['note', 'correction'],
                        kind: 'mixed',
                        newerEventId: newerManagedReadEvent.eventId,
                        olderEventId: olderManagedReadEvent.eventId,
                        newerAt: newerManagedReadEvent.at,
                        olderAt: olderManagedReadEvent.at,
                        followUpActionId: 'write_memory_note',
                        followUpActionIds: ['write_memory_note', 'record_memory_correction'],
                        followUpActionLabel: 'Store Memory Note',
                        followUpActionLabels: ['Store Memory Note', 'Record Correction'],
                        resolvedKeyLabels: ['note'],
                        resolvedFollowUpActionIds: ['write_memory_note'],
                        resolvedFollowUpActionLabels: ['Store Memory Note'],
                        persistentKeyLabels: ['correction'],
                        persistentFollowUpActionIds: ['record_memory_correction'],
                        persistentFollowUpActionLabels: ['Record Correction'],
                    }),
                }),
            })
        );

        const index = runtime.getDiagnosticsIndexSnapshot();
        expect(index.managedConversationIndex.continuitySummary).toEqual(
            expect.objectContaining({
                atomIds: ['atom-managed-rollup-1'],
                atomCount: 1,
                readCount: 2,
                transitionCount: 2,
                resolvedKeyCounts: {
                    note: 1,
                    correction: 0,
                },
                resolvedFollowUpActionIds: ['write_memory_note'],
                resolvedFollowUpActionLabels: ['Store Memory Note'],
                persistentKeyCounts: {
                    note: 0,
                    correction: 1,
                },
                persistentFollowUpActionIds: ['record_memory_correction'],
                persistentFollowUpActionLabels: ['Record Correction'],
                lastTransition: expect.objectContaining({
                    keyLabel: 'note, correction',
                    keyLabels: ['note', 'correction'],
                    kind: 'mixed',
                    newerEventId: newerManagedReadEvent.eventId,
                    olderEventId: olderManagedReadEvent.eventId,
                    newerAt: newerManagedReadEvent.at,
                    olderAt: olderManagedReadEvent.at,
                    followUpActionId: 'write_memory_note',
                    followUpActionIds: ['write_memory_note', 'record_memory_correction'],
                    followUpActionLabel: 'Store Memory Note',
                    followUpActionLabels: ['Store Memory Note', 'Record Correction'],
                    resolvedKeyLabels: ['note'],
                    resolvedFollowUpActionIds: ['write_memory_note'],
                    resolvedFollowUpActionLabels: ['Store Memory Note'],
                    persistentKeyLabels: ['correction'],
                    persistentFollowUpActionIds: ['record_memory_correction'],
                    persistentFollowUpActionLabels: ['Record Correction'],
                }),
            })
        );

        const exported = JSON.parse(runtime.exportDiagnosticsReport({ format: 'json' }) as string);
        expect(exported.snapshot.managedConversationSummary.continuitySummary).toEqual(
            expect.objectContaining({
                atomIds: ['atom-managed-rollup-1'],
                atomCount: 1,
                readCount: 2,
                transitionCount: 2,
                resolvedKeyCounts: {
                    note: 1,
                    correction: 0,
                },
                resolvedFollowUpActionIds: ['write_memory_note'],
                resolvedFollowUpActionLabels: ['Store Memory Note'],
                persistentKeyCounts: {
                    note: 0,
                    correction: 1,
                },
                persistentFollowUpActionIds: ['record_memory_correction'],
                persistentFollowUpActionLabels: ['Record Correction'],
                lastTransition: expect.objectContaining({
                    keyLabel: 'note, correction',
                    keyLabels: ['note', 'correction'],
                    kind: 'mixed',
                    newerEventId: newerManagedReadEvent.eventId,
                    olderEventId: olderManagedReadEvent.eventId,
                    newerAt: newerManagedReadEvent.at,
                    olderAt: olderManagedReadEvent.at,
                    followUpActionId: 'write_memory_note',
                    followUpActionIds: ['write_memory_note', 'record_memory_correction'],
                    followUpActionLabel: 'Store Memory Note',
                    followUpActionLabels: ['Store Memory Note', 'Record Correction'],
                    resolvedKeyLabels: ['note'],
                    resolvedFollowUpActionIds: ['write_memory_note'],
                    resolvedFollowUpActionLabels: ['Store Memory Note'],
                    persistentKeyLabels: ['correction'],
                    persistentFollowUpActionIds: ['record_memory_correction'],
                    persistentFollowUpActionLabels: ['Record Correction'],
                }),
            })
        );
        expect(exported.index.managedConversationIndex.continuitySummary).toEqual(
            expect.objectContaining({
                atomIds: ['atom-managed-rollup-1'],
                atomCount: 1,
                readCount: 2,
                transitionCount: 2,
                resolvedKeyCounts: {
                    note: 1,
                    correction: 0,
                },
                resolvedFollowUpActionIds: ['write_memory_note'],
                resolvedFollowUpActionLabels: ['Store Memory Note'],
                persistentKeyCounts: {
                    note: 0,
                    correction: 1,
                },
                persistentFollowUpActionIds: ['record_memory_correction'],
                persistentFollowUpActionLabels: ['Record Correction'],
                lastTransition: expect.objectContaining({
                    keyLabel: 'note, correction',
                    keyLabels: ['note', 'correction'],
                    kind: 'mixed',
                    newerEventId: newerManagedReadEvent.eventId,
                    olderEventId: olderManagedReadEvent.eventId,
                    newerAt: newerManagedReadEvent.at,
                    olderAt: olderManagedReadEvent.at,
                    followUpActionId: 'write_memory_note',
                    followUpActionIds: ['write_memory_note', 'record_memory_correction'],
                    followUpActionLabel: 'Store Memory Note',
                    followUpActionLabels: ['Store Memory Note', 'Record Correction'],
                    resolvedKeyLabels: ['note'],
                    resolvedFollowUpActionIds: ['write_memory_note'],
                    resolvedFollowUpActionLabels: ['Store Memory Note'],
                    persistentKeyLabels: ['correction'],
                    persistentFollowUpActionIds: ['record_memory_correction'],
                    persistentFollowUpActionLabels: ['Record Correction'],
                }),
            })
        );
    });

    test('executes memory write capability, prompts for note text, and persists deterministic key', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-4',
                                title: 'Memory Write Candidate',
                                snippet: 'Store memory note.',
                                score: 0.66,
                                capabilities: [
                                    {
                                        actionId: 'write_memory_note',
                                        label: 'Store Memory Note',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-4',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_note:atom-memory-4',
                                            memoryTags: ['agent_workspace', 'conversation_note'],
                                            memoryReferences: ['atom-memory-4'],
                                            memoryPromptMessage: 'Store note for atom-memory-4',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'write',
                        entries: [
                            { key: 'conversation_note:atom-memory-4', value: 'Persist this note.' },
                        ],
                        evictedCount: 0,
                        mutatedCount: 1,
                        stats: {
                            session: 6,
                            unit: 2,
                            longTerm: 3,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;
        const promptMock = jest.fn().mockReturnValue('Persist this note.');
        (global as unknown as Record<string, unknown>).prompt = promptMock;
        (dom!.window as unknown as Record<string, unknown>).prompt = promptMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'store note for memory candidate';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        expect(promptMock).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            operation?: string;
            entries?: Array<{
                key?: string;
                value?: string;
                tags?: string[];
                references?: string[];
            }>;
        };
        expect(payload.operation).toBe('write');
        expect(payload.entries?.[0]?.key).toBe('conversation_note:atom-memory-4');
        expect(payload.entries?.[0]?.value).toBe('Persist this note.');
        expect(payload.entries?.[0]?.tags).toEqual(['agent_workspace', 'conversation_note']);
        expect(payload.entries?.[0]?.references).toEqual(['atom-memory-4']);

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Memory updated');
    });

    test('executes targeted memory eviction capability and forwards managed keys', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-5',
                                title: 'Memory Evict Candidate',
                                snippet: 'Evict managed memory.',
                                score: 0.65,
                                capabilities: [
                                    {
                                        actionId: 'evict_memory_note',
                                        label: 'Evict Managed Memory',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-5',
                                            memoryLayer: 'session',
                                            memoryOperation: 'evict',
                                            memoryMatchKeys: [
                                                'conversation_note:atom-memory-5',
                                                'conversation_correction:atom-memory-5',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'evict',
                        entries: [],
                        evictedCount: 2,
                        removedKeys: [
                            'conversation_note:atom-memory-5',
                            'conversation_correction:atom-memory-5',
                        ],
                        stats: {
                            session: 4,
                            unit: 2,
                            longTerm: 3,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'evict managed note';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}')) as {
            operation?: string;
            matchKeys?: string[];
        };
        expect(payload.operation).toBe('evict');
        expect(payload.matchKeys).toEqual([
            'conversation_note:atom-memory-5',
            'conversation_correction:atom-memory-5',
        ]);

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Memory eviction completed');
    });

    test('re-renders pane labels and capability cards on language change', async () => {
        let language = 'en';
        const languageListeners: Array<() => void> = [];
        const dictionaries: Record<string, Record<string, string>> = {
            en: {
                'agentWorkspace.placeholders.input': 'Ask in English',
                'agentWorkspace.actions.openFocusMode': 'Focus EN',
                'agentWorkspace.actions.pathFullscreen': 'Path Fullscreen EN',
                'agentWorkspace.actions.exitPathFullscreen': 'Exit Path Fullscreen EN',
                'agentWorkspace.actions.openFoundationReadiness': 'Foundation Readiness EN',
                'agentWorkspace.messages.clickPointToFocus': 'Click to focus EN',
                'agentWorkspace.labels.score': 'Score EN',
                'agentWorkspace.actions.openLearningPath': 'Open Learning Path EN',
                'agentWorkspace.labels.activeAtom': 'Active Atom EN',
                'agentWorkspace.labels.active': 'Active EN',
                'agentWorkspace.labels.focusReady': 'Focus Ready EN',
                'agentWorkspace.labels.learningPathDocked': 'Path Docked EN',
                'agentWorkspace.labels.learningPathFullscreen': 'Path Fullscreen EN',
                'agentWorkspace.labels.learningPathPinned': 'Path Pinned EN',
                'agentWorkspace.labels.studyLoopSummary': 'Study Loop EN',
                'agentWorkspace.labels.supportSurfaceSummary': 'Support Surface EN',
                'agentWorkspace.labels.currentAtomHistorySummary': 'Recent Activity EN',
                'agentWorkspace.labels.lastAction': 'Last action EN',
                'agentWorkspace.labels.success': 'Success EN',
                'agentWorkspace.labels.noStudyActionYet': 'No study action yet EN',
                'agentWorkspace.labels.noCurrentAtomHistoryYet': 'No current-atom history yet EN',
                'agentWorkspace.labels.historyEventAt': 'At EN',
                'agentWorkspace.labels.historyEventOperation': 'Operation EN',
                'agentWorkspace.labels.historyEventSurface': 'Surface EN',
                'agentWorkspace.labels.historyEventDuration': 'Duration EN',
                'agentWorkspace.labels.historyFollowUp': 'Next step EN',
                'agentWorkspace.labels.historyFollowUpReason': 'Why this EN',
                'agentWorkspace.labels.historyFollowUpTradeoff': 'Why not alternative EN',
                'agentWorkspace.labels.historyFollowUpDrift': 'Why it changed EN',
                'agentWorkspace.labels.historyFollowUpStability': 'Why it held EN',
                'agentWorkspace.labels.historyFollowUpConfidence': 'Confidence EN',
                'agentWorkspace.labels.historyFollowUpSignalRank': 'Rank {rank}/{total} EN',
                'agentWorkspace.labels.historyFollowUpSignalFresh': 'Fresh EN',
                'agentWorkspace.labels.historyFollowUpSignalReused': 'Reused EN',
                'agentWorkspace.labels.historyFollowUpSignalSkippedRecent': 'Skipped recent EN',
                'agentWorkspace.labels.historyFollowUpSignalMissingNote': 'Missing note EN',
                'agentWorkspace.labels.historyFollowUpSignalMissingCorrection': 'Missing correction EN',
                'agentWorkspace.labels.historyFollowUpSignalStableSeries': 'Stable x{count} EN',
                'agentWorkspace.labels.historyFollowUpSignalAlternativeReady': 'Alt ready EN',
                'agentWorkspace.labels.historyFollowUpAlternatives': 'Also available EN',
                'agentWorkspace.messages.activeAtomPathAligned': 'Aligned EN {atomId}',
                'agentWorkspace.messages.activeAtomPathAlignedFullscreen': 'Aligned Fullscreen EN {atomId}',
                'agentWorkspace.messages.activeAtomPathDrifted': 'Drifted EN {atomId} -> {pathAtomId}',
                'agentWorkspace.messages.studyLoopReadyCount': '{count} ready EN',
                'agentWorkspace.messages.supportSurfaceCounts': 'Memory {memoryCount} EN Diagnostics {diagnosticCount} EN',
                'agentWorkspace.messages.currentAtomHistoryCount': '{count} recent results EN',
                'agentWorkspace.messages.currentAtomHistoryPreviewLearningPath': 'mastery {masteryPathCount} EN divergence {divergencePathCount} EN',
                'agentWorkspace.messages.historyFollowUpReasonTopRanked': 'Top ranked next step after {action}.',
                'agentWorkspace.messages.historyFollowUpReasonMissingManagedKey': 'Managed state still misses {missingKey}, so {action} becomes next step.',
                'agentWorkspace.messages.historyFollowUpReasonSkippedRecent': 'Recent activity already covered {action}.',
                'agentWorkspace.messages.historyFollowUpTradeoffRankedAhead': '{primary} stays primary because it ranks ahead of {secondary} after {action}.',
                'agentWorkspace.messages.historyFollowUpTradeoffTypedAlternative': '{secondary} remains available as a typed alternative.',
                'agentWorkspace.messages.historyFollowUpTradeoffFallbackAlternative': '{secondary} remains available as the fallback alternative.',
                'agentWorkspace.messages.historyFollowUpDriftManagedKeyResolved': 'Newer managed state no longer misses {resolvedKey}, so the next step shifts from {previousPrimary} to {currentPrimary}.',
                'agentWorkspace.messages.historyFollowUpDriftDifferentOrder': 'Newer {action} shifts the next step from {previousPrimary} to {currentPrimary} because its follow-up order ranks {currentPrimary} earlier.',
                'agentWorkspace.messages.historyFollowUpDriftCoveredPrimary': 'Newer {action} already covered {previousPrimary}, so the next step shifts to {currentPrimary}.',
                'agentWorkspace.messages.historyFollowUpStabilityMissingManagedKey': 'Newer managed state still misses {missingKey}, so {currentPrimary} stays next across {count} consecutive history events.',
                'agentWorkspace.messages.historyFollowUpStabilityKeptPrimary': 'Newer {action} keeps {currentPrimary} ahead, so the next step stays stable across {count} consecutive history events.',
                'agentWorkspace.messages.historyFollowUpConfidenceFresh': 'Fresh deterministic candidate with no newer overlap.',
                'agentWorkspace.messages.historyFollowUpConfidenceMissingManagedKey': 'Targets missing {missingKey}.',
                'agentWorkspace.messages.historyFollowUpConfidenceSkippedRecent': 'Fresh candidate after skipping the more recent {action} repeat.',
                'agentWorkspace.messages.historyFollowUpConfidenceStableSeries': 'Reinforced across {count} consecutive history events.',
                'agentWorkspace.actions.showHistoryDetails': 'Show details EN',
                'agentWorkspace.actions.hideHistoryDetails': 'Hide details EN',
                'agentWorkspace.actions.buildStudySession': 'Build Session EN',
            },
            zh: {
                'agentWorkspace.placeholders.input': '请用中文提问',
                'agentWorkspace.actions.openFocusMode': '专注 ZH',
                'agentWorkspace.actions.pathFullscreen': '路径全屏 ZH',
                'agentWorkspace.actions.exitPathFullscreen': '退出路径全屏 ZH',
                'agentWorkspace.actions.openFoundationReadiness': '基础就绪性 ZH',
                'agentWorkspace.messages.clickPointToFocus': '点击进入专注 ZH',
                'agentWorkspace.labels.score': '分数 ZH',
                'agentWorkspace.actions.openLearningPath': '打开学习路径 ZH',
                'agentWorkspace.labels.activeAtom': '当前知识点 ZH',
                'agentWorkspace.labels.active': '当前 ZH',
                'agentWorkspace.labels.focusReady': '专注就绪 ZH',
                'agentWorkspace.labels.learningPathDocked': '路径停靠 ZH',
                'agentWorkspace.labels.learningPathFullscreen': '路径全屏状态 ZH',
                'agentWorkspace.labels.learningPathPinned': '路径已固定 ZH',
                'agentWorkspace.labels.studyLoopSummary': '学习闭环 ZH',
                'agentWorkspace.labels.supportSurfaceSummary': '支持面 ZH',
                'agentWorkspace.labels.currentAtomHistorySummary': '最近活动 ZH',
                'agentWorkspace.labels.lastAction': '最近动作 ZH',
                'agentWorkspace.labels.success': '成功 ZH',
                'agentWorkspace.labels.noStudyActionYet': '暂无学习动作 ZH',
                'agentWorkspace.labels.noCurrentAtomHistoryYet': '暂无当前知识点历史 ZH',
                'agentWorkspace.labels.historyEventAt': '时间 ZH',
                'agentWorkspace.labels.historyEventOperation': '操作 ZH',
                'agentWorkspace.labels.historyEventSurface': '结果面 ZH',
                'agentWorkspace.labels.historyEventDuration': '耗时 ZH',
                'agentWorkspace.labels.historyFollowUp': '下一步 ZH',
                'agentWorkspace.labels.historyFollowUpReason': '为什么是这步 ZH',
                'agentWorkspace.labels.historyFollowUpTradeoff': '为什么不是备选 ZH',
                'agentWorkspace.labels.historyFollowUpDrift': '为什么会变化 ZH',
                'agentWorkspace.labels.historyFollowUpStability': '为什么保持稳定 ZH',
                'agentWorkspace.labels.historyFollowUpConfidence': '置信信号 ZH',
                'agentWorkspace.labels.historyFollowUpSignalRank': '排序 {rank}/{total} ZH',
                'agentWorkspace.labels.historyFollowUpSignalFresh': '新鲜候选 ZH',
                'agentWorkspace.labels.historyFollowUpSignalReused': '沿用旧候选 ZH',
                'agentWorkspace.labels.historyFollowUpSignalSkippedRecent': '跳过近期重复 ZH',
                'agentWorkspace.labels.historyFollowUpSignalMissingNote': '缺少笔记 ZH',
                'agentWorkspace.labels.historyFollowUpSignalMissingCorrection': '缺少纠正 ZH',
                'agentWorkspace.labels.historyFollowUpSignalStableSeries': '连续稳定 x{count} ZH',
                'agentWorkspace.labels.historyFollowUpSignalAlternativeReady': '备选可用 ZH',
                'agentWorkspace.labels.historyFollowUpAlternatives': '还可执行 ZH',
                'agentWorkspace.messages.activeAtomPathAligned': '已对齐 ZH {atomId}',
                'agentWorkspace.messages.activeAtomPathAlignedFullscreen': '全屏已对齐 ZH {atomId}',
                'agentWorkspace.messages.activeAtomPathDrifted': '已漂移 ZH {atomId} -> {pathAtomId}',
                'agentWorkspace.messages.studyLoopReadyCount': '{count} 个已就绪 ZH',
                'agentWorkspace.messages.supportSurfaceCounts': '记忆 {memoryCount} ZH 诊断 {diagnosticCount} ZH',
                'agentWorkspace.messages.currentAtomHistoryCount': '{count} 条最近结果 ZH',
                'agentWorkspace.messages.currentAtomHistoryPreviewLearningPath': '掌握 {masteryPathCount} ZH 发散 {divergencePathCount} ZH',
                'agentWorkspace.messages.historyFollowUpReasonTopRanked': '{action} 之后的最高优先级下一步。',
                'agentWorkspace.messages.historyFollowUpReasonMissingManagedKey': '托管状态仍缺少 {missingKey}，因此下一步改为 {action}。',
                'agentWorkspace.messages.historyFollowUpReasonSkippedRecent': '最近活动已覆盖 {action}。',
                'agentWorkspace.messages.historyFollowUpTradeoffRankedAhead': '{primary} 仍是主建议，因为在 {action} 之后它的排序高于 {secondary}。',
                'agentWorkspace.messages.historyFollowUpTradeoffTypedAlternative': '{secondary} 仍保留为 typed 备选动作。',
                'agentWorkspace.messages.historyFollowUpTradeoffFallbackAlternative': '{secondary} 仍保留为 fallback 备选动作。',
                'agentWorkspace.messages.historyFollowUpDriftManagedKeyResolved': '更新的托管状态已不再缺少 {resolvedKey}，所以下一步从 {previousPrimary} 改为 {currentPrimary}。',
                'agentWorkspace.messages.historyFollowUpDriftDifferentOrder': '更新的 {action} 把下一步从 {previousPrimary} 切换为 {currentPrimary}，因为它的 follow-up 顺序会更早选中 {currentPrimary}。',
                'agentWorkspace.messages.historyFollowUpDriftCoveredPrimary': '更新的 {action} 已经覆盖了 {previousPrimary}，所以下一步改为 {currentPrimary}。',
                'agentWorkspace.messages.historyFollowUpStabilityMissingManagedKey': '更新的托管状态仍缺少 {missingKey}，因此 {currentPrimary} 在连续 {count} 条历史事件中继续保持为下一步。',
                'agentWorkspace.messages.historyFollowUpStabilityKeptPrimary': '更新的 {action} 仍让 {currentPrimary} 保持领先，因此下一步在连续 {count} 条历史事件中保持稳定。',
                'agentWorkspace.messages.historyFollowUpConfidenceFresh': '这是一个没有更新历史冲突的新鲜确定性候选。',
                'agentWorkspace.messages.historyFollowUpConfidenceMissingManagedKey': '它直接指向缺少的 {missingKey}。',
                'agentWorkspace.messages.historyFollowUpConfidenceSkippedRecent': '跳过近期已重复的 {action} 后，保留了这个新鲜候选。',
                'agentWorkspace.messages.historyFollowUpConfidenceStableSeries': '并且它在连续 {count} 条历史事件中得到强化。',
                'agentWorkspace.actions.showHistoryDetails': '展开详情 ZH',
                'agentWorkspace.actions.hideHistoryDetails': '收起详情 ZH',
                'agentWorkspace.actions.buildStudySession': '构建学习会话 ZH',
            },
        };
        const i18nMock = {
            t: jest.fn((key: string, params?: Record<string, unknown>) => {
                const template = dictionaries[language]?.[key];
                if (!template) {
                    return key;
                }
                return template.replace(/\{(\w+)\}/g, (_match, token) => {
                    const value = params && Object.prototype.hasOwnProperty.call(params, token)
                        ? params[token]
                        : '';
                    return value == null ? '' : String(value);
                });
            }),
            onLanguageChange: jest.fn((listener: () => void) => {
                languageListeners.push(listener);
            }),
        };
        (global as unknown as Record<string, unknown>).i18n = i18nMock;
        ((global as unknown as { window: { i18n?: unknown } }).window).i18n = i18nMock;

        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-i18n-1',
                                title: 'I18N Candidate',
                                snippet: 'Language rerender coverage.',
                                score: 0.905,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Learning Path',
                                        labelKey: 'agentWorkspace.actions.openLearningPath',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-i18n-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        labelKey: 'agentWorkspace.actions.buildStudySession',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-i18n-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        masteryPaths: [{ atomId: 'atom-i18n-1' }],
                        divergencePaths: [{ atomId: 'atom-i18n-aux' }],
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();
        expect(i18nMock.onLanguageChange).toHaveBeenCalledTimes(1);

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'language rerender';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCardEn = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        const actionButtonEn = pointCardEn.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        actionButtonEn.click();
        await flushAsync();

        const pathFullscreenButton = document.getElementById('agent-workspace-path-fullscreen') as HTMLButtonElement;
        const readinessButton = document.getElementById('agent-workspace-open-foundation-readiness') as HTMLButtonElement;
        expect(input.placeholder).toBe('Ask in English');
        expect(pathFullscreenButton.textContent).toBe('Path Fullscreen EN');
        expect(readinessButton.textContent).toBe('Foundation Readiness EN');
        runtime.togglePathFullscreen();
        expect(pathFullscreenButton.textContent).toBe('Exit Path Fullscreen EN');

        const pointMetaEn = document.querySelector('.agent-workspace-point-meta') as HTMLElement;
        const activeRailEn = document.querySelector('.agent-workspace-active-point') as HTMLElement;
        expect(pointCardEn.title).toBe('Click to focus EN');
        expect(pointMetaEn.textContent || '').toContain('Score EN: 0.905');
        expect(actionButtonEn.textContent).toBe('Open Learning Path EN');
        expect(activeRailEn.textContent || '').toContain('Active Atom EN');
        expect(activeRailEn.textContent || '').toContain('Active EN');
        expect(activeRailEn.textContent || '').toContain('Focus Ready EN');
        expect(activeRailEn.textContent || '').toContain('Path Fullscreen EN');
        expect(activeRailEn.textContent || '').toContain('Aligned Fullscreen EN atom-i18n-1');
        expect(activeRailEn.textContent || '').toContain('Study Loop EN');
        expect(activeRailEn.textContent || '').toContain('No study action yet EN');
        expect(activeRailEn.textContent || '').toContain('Support Surface EN');
        expect(activeRailEn.textContent || '').toContain('Recent Activity EN');
        expect(activeRailEn.textContent || '').toContain('1 recent results EN');
        expect(activeRailEn.textContent || '').toContain('1. Open Learning Path EN');
        expect(activeRailEn.textContent || '').toContain('mastery 1 EN divergence 1 EN');
        const historyToggleEn = activeRailEn.querySelector('.agent-workspace-history-toggle') as HTMLButtonElement;
        expect(historyToggleEn.textContent).toBe('Show details EN');
        historyToggleEn.click();
        await flushAsync();
        const refreshedActiveRailEn = document.querySelector('.agent-workspace-active-point') as HTMLElement;
        const refreshedHistoryToggleEn = refreshedActiveRailEn.querySelector('.agent-workspace-history-toggle') as HTMLButtonElement;
        expect(refreshedHistoryToggleEn.textContent).toBe('Hide details EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Operation EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('build_learning_path');
        expect(refreshedActiveRailEn.textContent || '').toContain('Surface EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('learning_path_card');
        expect(refreshedActiveRailEn.textContent || '').toContain('Duration EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Next step EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Why this EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Top ranked next step after Open Learning Path EN.');
        expect(refreshedActiveRailEn.textContent || '').toContain('Why not alternative EN');
        expect(refreshedActiveRailEn.textContent || '').toContain(
            'Focus EN stays primary because it ranks ahead of Build Session EN after Open Learning Path EN. Build Session EN remains available as a typed alternative.'
        );
        expect(refreshedActiveRailEn.textContent || '').toContain('Confidence EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Rank 1/2 EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Fresh EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Alt ready EN');
        expect(refreshedActiveRailEn.textContent || '').toContain('Fresh deterministic candidate with no newer overlap.');
        expect(refreshedActiveRailEn.textContent || '').toContain('Also available EN');
        const followUpButtonEn = refreshedActiveRailEn.querySelector(
            '.agent-workspace-history-follow-up .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(followUpButtonEn.textContent).toBe('Focus EN');
        const alternativeButtonEn = refreshedActiveRailEn.querySelector(
            '.agent-workspace-history-follow-up-alternatives .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(alternativeButtonEn.textContent).toBe('Build Session EN');

        language = 'zh';
        languageListeners.forEach((listener) => listener());
        await flushAsync();

        const pointCardZh = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        const pointMetaZh = document.querySelector('.agent-workspace-point-meta') as HTMLElement;
        const actionButtonZh = pointCardZh.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        const activeRailZh = document.querySelector('.agent-workspace-active-point') as HTMLElement;
        expect(input.placeholder).toBe('请用中文提问');
        expect(pathFullscreenButton.textContent).toBe('退出路径全屏 ZH');
        expect(readinessButton.textContent).toBe('基础就绪性 ZH');
        expect(pointCardZh.title).toBe('点击进入专注 ZH');
        expect(pointMetaZh.textContent || '').toContain('分数 ZH: 0.905');
        expect(actionButtonZh.textContent).toBe('打开学习路径 ZH');
        expect(activeRailZh.textContent || '').toContain('当前知识点 ZH');
        expect(activeRailZh.textContent || '').toContain('当前 ZH');
        expect(activeRailZh.textContent || '').toContain('专注就绪 ZH');
        expect(activeRailZh.textContent || '').toContain('路径全屏状态 ZH');
        expect(activeRailZh.textContent || '').toContain('全屏已对齐 ZH atom-i18n-1');
        expect(activeRailZh.textContent || '').toContain('学习闭环 ZH');
        expect(activeRailZh.textContent || '').toContain('暂无学习动作 ZH');
        expect(activeRailZh.textContent || '').toContain('支持面 ZH');
        expect(activeRailZh.textContent || '').toContain('最近活动 ZH');
        expect(activeRailZh.textContent || '').toContain('1 条最近结果 ZH');
        expect(activeRailZh.textContent || '').toContain('1. 打开学习路径 ZH');
        expect(activeRailZh.textContent || '').toContain('掌握 1 ZH 发散 1 ZH');
        const historyToggleZh = activeRailZh.querySelector('.agent-workspace-history-toggle') as HTMLButtonElement;
        expect(historyToggleZh.textContent).toBe('收起详情 ZH');
        expect(activeRailZh.textContent || '').toContain('操作 ZH');
        expect(activeRailZh.textContent || '').toContain('build_learning_path');
        expect(activeRailZh.textContent || '').toContain('结果面 ZH');
        expect(activeRailZh.textContent || '').toContain('learning_path_card');
        expect(activeRailZh.textContent || '').toContain('耗时 ZH');
        expect(activeRailZh.textContent || '').toContain('下一步 ZH');
        expect(activeRailZh.textContent || '').toContain('为什么是这步 ZH');
        expect(activeRailZh.textContent || '').toContain('打开学习路径 ZH 之后的最高优先级下一步。');
        expect(activeRailZh.textContent || '').toContain('为什么不是备选 ZH');
        expect(activeRailZh.textContent || '').toContain(
            '专注 ZH 仍是主建议，因为在 打开学习路径 ZH 之后它的排序高于 构建学习会话 ZH。构建学习会话 ZH 仍保留为 typed 备选动作。'
        );
        expect(activeRailZh.textContent || '').toContain('置信信号 ZH');
        expect(activeRailZh.textContent || '').toContain('排序 1/2 ZH');
        expect(activeRailZh.textContent || '').toContain('新鲜候选 ZH');
        expect(activeRailZh.textContent || '').toContain('备选可用 ZH');
        expect(activeRailZh.textContent || '').toContain('这是一个没有更新历史冲突的新鲜确定性候选。');
        expect(activeRailZh.textContent || '').toContain('还可执行 ZH');
        const followUpButtonZh = activeRailZh.querySelector(
            '.agent-workspace-history-follow-up .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(followUpButtonZh.textContent).toBe('专注 ZH');
        const alternativeButtonZh = activeRailZh.querySelector(
            '.agent-workspace-history-follow-up-alternatives .agent-workspace-action-button'
        ) as HTMLButtonElement;
        expect(alternativeButtonZh.textContent).toBe('构建学习会话 ZH');

        runtime.togglePathFullscreen();
        expect(pathFullscreenButton.textContent).toBe('路径全屏 ZH');
        const activeRailZhDocked = document.querySelector('.agent-workspace-active-point') as HTMLElement;
        expect(activeRailZhDocked.textContent || '').toContain('路径停靠 ZH');
        expect(activeRailZhDocked.textContent || '').toContain('已对齐 ZH atom-i18n-1');
    });

    test('loads foundation readiness from toolbar and records diagnostics snapshot', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                readiness: {
                    evaluatedAt: '2026-04-20T05:00:00.000Z',
                    status: 'integrated',
                    decision: 'go',
                    baseline: {
                        storeType: 'sqlite',
                        exists: true,
                        loaded: true,
                        fileBackedStore: false,
                        graphBackendStatus: 'independent',
                        graphBackendSignalKind: 'embedded_graphdb',
                        graphBackendIndependent: true,
                        graphAdapterModulePresent: true,
                        queryBackendDefaultMode: 'local_hybrid',
                        queryBackendScoreSignals: [
                            'keyword_matches',
                            'title_match_bonus',
                            'vector_ann_similarity_bonus',
                            'relation_bonus',
                        ],
                        vectorAdapterModulePresent: true,
                        vectorAdapterStatus: 'independent',
                        vectorAdapterSignalKind: 'embedding_ann',
                        vectorAdapterIndependent: true,
                        vectorAdapterLinkedIntoQueryBackend: true,
                    },
                    documents: {
                        checklistPagesPresent: true,
                        dashboardReferencesPresent: true,
                    },
                    packageScripts: {
                        readinessVerifierPresent: true,
                    },
                    provenance: {
                        repoRootSource: 'cwd',
                        runtimeProjectRootAligned: false,
                    },
                    promotionCriteriaPassed: 7,
                    promotionCriteriaTotal: 7,
                    promotionCriteriaSatisfiedIds: [
                        'store_backend_evidence_present',
                        'graph_backend_independent',
                        'query_backend_boundary_present',
                        'vector_backend_present',
                        'vector_backend_independent',
                        'docs_aligned',
                        'readiness_verifier_present',
                    ],
                    promotionCriteriaUnsatisfiedIds: [],
                    promotionCriteria: [
                        {
                            criterionId: 'store_backend_evidence_present',
                            satisfied: true,
                            summary: 'Store backend evidence is present in the repository baseline.',
                        },
                        {
                            criterionId: 'graph_backend_independent',
                            satisfied: true,
                            summary: 'Graph backend resolves to independent graph semantics.',
                        },
                        {
                            criterionId: 'query_backend_boundary_present',
                            satisfied: true,
                            summary: 'Dedicated query backend boundary is present.',
                        },
                        {
                            criterionId: 'vector_backend_present',
                            satisfied: true,
                            summary: 'Dedicated vector adapter boundary is present.',
                        },
                        {
                            criterionId: 'vector_backend_independent',
                            satisfied: true,
                            summary: 'Vector backend resolves to independent ANN semantics.',
                        },
                        {
                            criterionId: 'docs_aligned',
                            satisfied: true,
                            summary: 'EN/ZH checklist and dashboard references are aligned.',
                        },
                        {
                            criterionId: 'readiness_verifier_present',
                            satisfied: true,
                            summary: 'Readiness verifier command is present in package scripts.',
                        },
                    ],
                    mandatoryChecks: [
                        {
                            gateId: 'contract',
                            command: 'npm test -- src/knowledge.api.contract.test.ts --runInBand',
                        },
                        {
                            gateId: 'core_behavior',
                            command: 'npm test -- src/learning/KnowledgeLearningPlatform.test.ts --runInBand',
                        },
                        {
                            gateId: 'persistence_safety',
                            command: 'npm test -- src/learning/KnowledgeLearningPlatform.persistence.test.ts --runInBand',
                        },
                        {
                            gateId: 'interaction_non_regression',
                            command: 'npm run test:agent-workspace:contracts',
                        },
                        {
                            gateId: 'documentation',
                            command: 'npm run docs:diataxis:check && npm run docs:site:build',
                        },
                    ],
                    promotionBlockers: [],
                    recommendations: [
                        'Keep mandatory foundation gates green and preserve anti-overclaim wording while adapter depth evolves.',
                    ],
                },
            }),
        });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const readinessButton = document.getElementById('agent-workspace-open-foundation-readiness') as HTMLButtonElement;
        readinessButton.click();
        await flushAsync();

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/knowledge/foundation/readiness',
            expect.objectContaining({
                method: 'GET',
            })
        );

        const messages = document.getElementById('agent-workspace-messages') as HTMLElement;
        expect(messages.textContent || '').toContain('Foundation readiness');
        expect(messages.textContent || '').toContain('embedded_graphdb');
        expect(messages.textContent || '').toContain('independent');
        expect(messages.textContent || '').toContain('local_hybrid');
        expect(messages.textContent || '').toContain('embedding_ann');
        expect(messages.textContent || '').toContain('repo-source cwd');
        expect(messages.textContent || '').toContain('aligned no');
        expect(messages.textContent || '').toContain(
            'gates contract, core_behavior, persistence_safety, interaction_non_regression, documentation'
        );
        expect(messages.textContent || '').toContain('criteria-detail 7');
        expect(messages.textContent || '').toContain('recommendations 1');
        expect(messages.textContent || '').toContain(
            'satisfied store_backend_evidence_present, graph_backend_independent, query_backend_boundary_present, vector_backend_present, vector_backend_independent, docs_aligned, readiness_verifier_present'
        );
        expect(messages.textContent || '').toContain('unmet none');
        expect(messages.textContent || '').toContain('blockers none');
        expect(messages.textContent || '').toContain('criteria 7/7');

        const snapshot = runtime.getDiagnosticsSnapshot();
        expect(snapshot.lastFoundationReadiness).toEqual(
            expect.objectContaining({
                status: 'integrated',
                decision: 'go',
                storeType: 'sqlite',
                graphBackendStatus: 'independent',
                graphBackendSignalKind: 'embedded_graphdb',
                graphBackendIndependent: true,
                queryBackendDefaultMode: 'local_hybrid',
                queryBackendScoreSignals: [
                    'keyword_matches',
                    'title_match_bonus',
                    'vector_ann_similarity_bonus',
                    'relation_bonus',
                ],
                vectorAdapterStatus: 'independent',
                vectorAdapterSignalKind: 'embedding_ann',
                vectorAdapterIndependent: true,
                vectorAdapterLinkedIntoQueryBackend: true,
                repoRootSource: 'cwd',
                runtimeProjectRootAligned: false,
                mandatoryCheckIds: [
                    'contract',
                    'core_behavior',
                    'persistence_safety',
                    'interaction_non_regression',
                    'documentation',
                ],
                mandatoryChecks: [
                    {
                        gateId: 'contract',
                        command: 'npm test -- src/knowledge.api.contract.test.ts --runInBand',
                    },
                    {
                        gateId: 'core_behavior',
                        command: 'npm test -- src/learning/KnowledgeLearningPlatform.test.ts --runInBand',
                    },
                    {
                        gateId: 'persistence_safety',
                        command: 'npm test -- src/learning/KnowledgeLearningPlatform.persistence.test.ts --runInBand',
                    },
                    {
                        gateId: 'interaction_non_regression',
                        command: 'npm run test:agent-workspace:contracts',
                    },
                    {
                        gateId: 'documentation',
                        command: 'npm run docs:diataxis:check && npm run docs:site:build',
                    },
                ],
                promotionCriteriaSatisfiedIds: [
                    'store_backend_evidence_present',
                    'graph_backend_independent',
                    'query_backend_boundary_present',
                    'vector_backend_present',
                    'vector_backend_independent',
                    'docs_aligned',
                    'readiness_verifier_present',
                ],
                promotionCriteriaUnsatisfiedIds: [],
                promotionCriteria: [
                    {
                        criterionId: 'store_backend_evidence_present',
                        satisfied: true,
                        summary: 'Store backend evidence is present in the repository baseline.',
                    },
                    {
                        criterionId: 'graph_backend_independent',
                        satisfied: true,
                        summary: 'Graph backend resolves to independent graph semantics.',
                    },
                    {
                        criterionId: 'query_backend_boundary_present',
                        satisfied: true,
                        summary: 'Dedicated query backend boundary is present.',
                    },
                    {
                        criterionId: 'vector_backend_present',
                        satisfied: true,
                        summary: 'Dedicated vector adapter boundary is present.',
                    },
                    {
                        criterionId: 'vector_backend_independent',
                        satisfied: true,
                        summary: 'Vector backend resolves to independent ANN semantics.',
                    },
                    {
                        criterionId: 'docs_aligned',
                        satisfied: true,
                        summary: 'EN/ZH checklist and dashboard references are aligned.',
                    },
                    {
                        criterionId: 'readiness_verifier_present',
                        satisfied: true,
                        summary: 'Readiness verifier command is present in package scripts.',
                    },
                ],
                promotionBlockerIds: [],
                promotionBlockers: [],
                promotionCriteriaPassed: 7,
                promotionCriteriaTotal: 7,
                mandatoryChecksCount: 5,
                promotionBlockersCount: 0,
                recommendations: [
                    'Keep mandatory foundation gates green and preserve anti-overclaim wording while adapter depth evolves.',
                ],
                recommendationsCount: 1,
            })
        );
    });

    test('explains drift when adjacent history events change the recommended next step', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-history-drift-1',
                                title: 'Drift Candidate',
                                snippet: 'History drift explanation.',
                                score: 0.89,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Open Learning Path',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-drift-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                    {
                                        actionId: 'build_study_session',
                                        label: 'Build Session',
                                        request: { userId: 'agent_user_default', atomId: 'atom-history-drift-1' },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_study_session',
                                            resultPresentation: 'study_session_card',
                                        },
                                    },
                                    {
                                        actionId: 'recap',
                                        label: 'Recap',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-history-drift-1',
                                            actionKind: 'recap',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'execute_tutor_action',
                                            resultPresentation: 'assistant_message',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        masteryPaths: [{ atomId: 'atom-history-drift-1' }],
                        divergencePaths: [],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        summary: {
                            totalActions: 3,
                            totalEstimatedMinutes: 11,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'history drift';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const pointCard = document.querySelector('.agent-workspace-point-card') as HTMLElement;
        const firstActionButton = pointCard.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        firstActionButton.click();
        await flushAsync();

        const buildSessionButton = Array.from(
            document.querySelectorAll('.agent-workspace-active-point .agent-workspace-action-button')
        ).find((button) => (button as HTMLElement).textContent === 'Build Session') as HTMLButtonElement;
        buildSessionButton.click();
        await flushAsync();

        const summaryCards = Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[];
        expect(summaryCards[2].textContent || '').toContain('1. Build Session');
        expect(summaryCards[2].textContent || '').toContain('2. Open Learning Path');

        const historyToggles = Array.from(summaryCards[2].querySelectorAll('.agent-workspace-history-toggle')) as HTMLButtonElement[];
        expect(historyToggles).toHaveLength(2);
        historyToggles[1].click();
        await flushAsync();

        const refreshedHistoryCard = (Array.from(document.querySelectorAll('.agent-workspace-active-point-summary-card')) as HTMLElement[])[2];
        expect(refreshedHistoryCard.textContent || '').toContain('Why it changed');
        expect(refreshedHistoryCard.textContent || '').toContain(
            'Newer Build Session shifts the next step from Focus to Recap because its follow-up order ranks Recap earlier.'
        );
    });

    test('records replay candidates and capability execution diagnostics snapshot', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:00.000Z',
                            asOf: '2026-04-20T04:00:00.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 11,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-diagnostic-1',
                                title: 'Diagnostic Candidate',
                                snippet: 'Replay and capability diagnostics.',
                                score: 0.81,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Learning Path',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-diagnostic-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        trace: {
                            generatedAt: '2026-04-20T04:00:01.000Z',
                            asOf: '2026-04-20T04:00:01.000Z',
                            queryTopK: 4,
                            resolvedKnowledgePoints: 1,
                            retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                            vectorAcceleration: {
                                mode: 'local_ann',
                                status: 'independent',
                                candidateCount: 1,
                            },
                            evidenceCoverageRatio: 1,
                            latencyMs: 12,
                        },
                        knowledgePoints: [
                            {
                                atomId: 'atom-diagnostic-1',
                                title: 'Diagnostic Candidate',
                                snippet: 'Replay and capability diagnostics.',
                                score: 0.81,
                                capabilities: [
                                    {
                                        actionId: 'open_learning_path',
                                        label: 'Learning Path',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-diagnostic-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'build_learning_path',
                                            resultPresentation: 'learning_path_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        masteryPaths: [{ id: 'mastery-1' }],
                        divergencePaths: [{ id: 'divergence-1' }],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        metadata: {
                            reportId: 'awd-1',
                            source: 'agent-workspace-runtime',
                        },
                        indexCount: 1,
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'repeat diagnostics';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        input.value = 'repeat diagnostics';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButton = document.querySelector('.agent-workspace-action-button') as HTMLButtonElement;
        expect(actionButton).not.toBeNull();
        actionButton.click();
        await flushAsync();

        const snapshot = runtime.getDiagnosticsSnapshot();
        expect(snapshot.conversationRequests).toBe(2);
        expect(snapshot.replayCandidateTurns).toBe(1);
        expect(snapshot.turnCounts.user).toBe(2);
        expect(snapshot.latestKnowledgePoints).toBe(1);
        expect(snapshot.pathState.visible).toBe(true);
        expect(snapshot.pathState.fullscreen).toBe(false);
        expect(snapshot.lastConversation).toEqual(
            expect.objectContaining({
                status: 'success',
                replayCandidate: true,
                knowledgePoints: 1,
                retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                vectorAcceleration: expect.objectContaining({
                    mode: 'local_ann',
                    status: 'independent',
                    candidateCount: 1,
                }),
                evidenceCoverageRatio: 1,
            })
        );

        const requestEvent = snapshot.capabilityEvents.find(
            (event) => event.phase === 'request' && event.operationId === 'build_learning_path'
        );
        expect(requestEvent).toBeDefined();
        expect(snapshot.lastCapabilityEvent).toEqual(
            expect.objectContaining({
                phase: 'result',
                status: 'success',
                operationId: 'build_learning_path',
                resultPresentation: 'learning_path_card',
            })
        );

        const trend = runtime.getDiagnosticsTrendSnapshot();
        expect(trend.conversationRequests).toBe(2);
        expect(trend.userTurns).toBe(2);
        expect(trend.replayCandidateTurns).toBe(1);
        expect(trend.replayCandidateRate).toBe(0.5);
        const operationTrend = trend.operationStats.find(
            (stats) => stats.operationId === 'build_learning_path'
        );
        expect(operationTrend).toEqual(
            expect.objectContaining({
                requestCount: 1,
                resultCount: 1,
                successCount: 1,
                failureCount: 0,
                latestStatus: 'success',
            })
        );

        const index = runtime.getDiagnosticsIndexSnapshot();
        expect(index.turnIndex.replayCandidateTurnIds.length).toBe(1);
        expect(index.capabilityIndex.operationIds).toContain('build_learning_path');
        expect(index.capabilityIndex.byOperationId.build_learning_path).toEqual(
            expect.objectContaining({
                requestCount: 1,
                resultCount: 1,
                successCount: 1,
                failureCount: 0,
            })
        );

        const exportedJson = runtime.exportDiagnosticsReport({ format: 'json' });
        expect(typeof exportedJson).toBe('string');
        const exported = JSON.parse(exportedJson as string);
        expect(exported.snapshot).toEqual(
            expect.objectContaining({
                conversationRequests: 2,
                replayCandidateTurns: 1,
            })
        );
        expect(exported.trend).toEqual(
            expect.objectContaining({
                replayCandidateRate: 0.5,
            })
        );
        expect(exported.runbookLinks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'development-progress-dashboard',
                }),
                expect.objectContaining({
                    id: 'm7-direction-requirements',
                }),
            ])
        );

        // M8.53: primary runbook action consumer contract
        expect(exported).toHaveProperty('primaryRunbookAction');
        expect(exported).toHaveProperty('runbookActions');
        expect(Array.isArray(exported.runbookActions)).toBe(true);
        if (exported.primaryRunbookAction) {
            expect(exported.primaryRunbookAction).toEqual(
                expect.objectContaining({
                    actionId: expect.any(String),
                    severity: expect.stringMatching(/^(info|warning|critical)$/),
                    title: expect.any(String),
                    trigger: expect.any(String),
                    rationale: expect.any(String),
                    runbookLinkIds: expect.any(Array),
                })
            );
            expect(exported.primaryRunbookAction.runbookLinkIds.length).toBeGreaterThan(0);
            expect(exported.runbookActions.length).toBeGreaterThan(0);
            expect(exported.runbookActions[0]).toEqual(exported.primaryRunbookAction);
        }

        const persistResult = await runtime.persistDiagnosticsReport();
        expect(persistResult).toEqual(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    reportId: 'awd-1',
                }),
                indexCount: 1,
            })
        );
        const persistCall = fetchMock.mock.calls[3];
        expect(persistCall[0]).toBe('/api/knowledge/operator/agent-workspace-diagnostics/report');
        expect(persistCall[1]).toEqual(
            expect.objectContaining({
                method: 'POST',
            })
        );
        const persistedBody = JSON.parse(String(persistCall[1].body));
        expect(persistedBody.source).toBe('agent-workspace-runtime');
        expect(persistedBody.report).toEqual(
            expect.objectContaining({
                snapshot: expect.objectContaining({
                    conversationRequests: 2,
                }),
                trend: expect.objectContaining({
                    replayCandidateRate: 0.5,
                }),
                index: expect.any(Object),
            })
        );
    });

    test('records memory policy diagnostics summary with layer and operation visibility', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-memory-diagnostics-1',
                                title: 'Memory Diagnostics Candidate',
                                snippet: 'Track readonly and mutating memory actions.',
                                score: 0.82,
                                capabilities: [
                                    {
                                        actionId: 'inspect_long_term_memory_read',
                                        label: 'Long-Term Memory Read',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-diagnostics-1',
                                            memoryLayer: 'long_term',
                                            memoryOperation: 'read',
                                            memoryLimit: 8,
                                            memoryQuery: 'durable retrieval',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'write_memory_note',
                                        label: 'Store Memory Note',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-memory-diagnostics-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_note:atom-memory-diagnostics-1',
                                            memoryTags: ['agent_workspace', 'conversation_note'],
                                            memoryReferences: ['atom-memory-diagnostics-1'],
                                            memoryPromptMessage: 'Store note for atom-memory-diagnostics-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'long_term',
                        operation: 'read',
                        entries: [
                            { key: 'memory:lt:1', value: 'durable retrieval note' },
                        ],
                        evictedCount: 0,
                        stats: {
                            session: 2,
                            unit: 1,
                            longTerm: 6,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'write',
                        entries: [
                            { key: 'conversation_note:atom-memory-diagnostics-1', value: 'Persist this diagnostic note.' },
                        ],
                        evictedCount: 0,
                        mutatedCount: 1,
                        stats: {
                            session: 3,
                            unit: 1,
                            longTerm: 6,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;
        const promptMock = jest.fn().mockReturnValue('Persist this diagnostic note.');
        (global as unknown as Record<string, unknown>).prompt = promptMock;
        (dom!.window as unknown as Record<string, unknown>).prompt = promptMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'run memory diagnostics';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButtons = Array.from(
            document.querySelectorAll('.agent-workspace-action-button')
        ) as HTMLButtonElement[];
        expect(actionButtons).toHaveLength(2);

        actionButtons[0].click();
        await flushAsync();
        actionButtons[1].click();
        await flushAsync();

        const snapshot = runtime.getDiagnosticsSnapshot();
        expect(snapshot.memoryPolicySummary).toEqual(
            expect.objectContaining({
                executionCount: 2,
                readonlyExecutions: 1,
                mutatingExecutions: 1,
                successCount: 2,
                failureCount: 0,
                byLayer: {
                    session: 1,
                    unit: 0,
                    long_term: 1,
                },
                byOperation: {
                    read: 1,
                    snapshot: 0,
                    retrain_plan: 0,
                    write: 1,
                    evict: 0,
                },
                lastEvent: expect.objectContaining({
                    memoryLayer: 'session',
                    memoryOperation: 'write',
                    status: 'success',
                }),
            })
        );
        expect(
            snapshot.capabilityEvents.some(
                (event) => event.memoryLayer === 'long_term' && event.memoryOperation === 'read'
            )
        ).toBe(true);

        const exported = JSON.parse(runtime.exportDiagnosticsReport({ format: 'json' }) as string);
        expect(exported.snapshot.memoryPolicySummary).toEqual(
            expect.objectContaining({
                executionCount: 2,
                readonlyExecutions: 1,
                mutatingExecutions: 1,
            })
        );
    });

    test('records operator-facing managed conversation diagnostics by action and key visibility', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        userId: 'agent_user_default',
                        message: 'Found 1 local knowledge point(s).',
                        knowledgePoints: [
                            {
                                atomId: 'atom-managed-ops-1',
                                title: 'Managed Visibility Candidate',
                                snippet: 'Track operator-facing conversation memory actions.',
                                score: 0.88,
                                capabilities: [
                                    {
                                        actionId: 'inspect_managed_memory_state',
                                        label: 'Inspect Managed Memory State',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-ops-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'read',
                                            memoryLimit: 4,
                                            memoryMatchKeys: [
                                                'conversation_note:atom-managed-ops-1',
                                                'conversation_correction:atom-managed-ops-1',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'record_memory_correction',
                                        label: 'Record Correction',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-ops-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'write',
                                            memoryKey: 'conversation_correction:atom-managed-ops-1',
                                            memoryTags: ['agent_workspace', 'conversation_correction'],
                                            memoryReferences: ['atom-managed-ops-1'],
                                            memoryPromptMessage: 'Record correction for atom-managed-ops-1',
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                    {
                                        actionId: 'evict_memory_note',
                                        label: 'Evict Managed Memory',
                                        request: {
                                            userId: 'agent_user_default',
                                            atomId: 'atom-managed-ops-1',
                                            memoryLayer: 'session',
                                            memoryOperation: 'evict',
                                            memoryMatchKeys: [
                                                'conversation_note:atom-managed-ops-1',
                                                'conversation_correction:atom-managed-ops-1',
                                            ],
                                        },
                                        execution: {
                                            kind: 'knowledge_operation',
                                            operationId: 'apply_memory_policy',
                                            resultPresentation: 'memory_policy_card',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'read',
                        entries: [
                            { key: 'conversation_note:atom-managed-ops-1', value: 'existing managed note' },
                        ],
                        filter: {
                            matchKeys: [
                                'conversation_note:atom-managed-ops-1',
                                'conversation_correction:atom-managed-ops-1',
                            ],
                            matchedKeys: ['conversation_note:atom-managed-ops-1'],
                            missingKeys: ['conversation_correction:atom-managed-ops-1'],
                        },
                        stats: {
                            session: 2,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'write',
                        entries: [
                            { key: 'conversation_correction:atom-managed-ops-1', value: 'Persist correction note.' },
                        ],
                        mutatedCount: 1,
                        evictedCount: 0,
                        stats: {
                            session: 3,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    result: {
                        layer: 'session',
                        operation: 'evict',
                        entries: [],
                        evictedCount: 2,
                        removedKeys: [
                            'conversation_note:atom-managed-ops-1',
                            'conversation_correction:atom-managed-ops-1',
                        ],
                        stats: {
                            session: 1,
                            unit: 0,
                            longTerm: 0,
                        },
                    },
                }),
            });
        (global as unknown as Record<string, unknown>).fetch = fetchMock;
        const promptMock = jest.fn().mockReturnValue('Persist correction note.');
        (global as unknown as Record<string, unknown>).prompt = promptMock;
        (dom!.window as unknown as Record<string, unknown>).prompt = promptMock;

        const runtime = runtimeModule.createAgentWorkspaceRuntime({ defaultUserId: 'agent_user_default' });
        runtime.init();

        const input = document.getElementById('agent-workspace-input') as HTMLTextAreaElement;
        const form = document.getElementById('agent-workspace-form') as HTMLFormElement;
        input.value = 'managed operator diagnostics';
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
        await flushAsync();

        const actionButtons = Array.from(
            document.querySelectorAll('.agent-workspace-action-button')
        ) as HTMLButtonElement[];
        expect(actionButtons).toHaveLength(3);

        actionButtons[0].click();
        await flushAsync();
        actionButtons[1].click();
        await flushAsync();
        actionButtons[2].click();
        await flushAsync();

        const snapshot = runtime.getDiagnosticsSnapshot();
        expect(snapshot.managedConversationSummary).toEqual(
            expect.objectContaining({
                executionCount: 3,
                successCount: 3,
                failureCount: 0,
                byActionId: {
                    inspect_managed_memory_state: 1,
                    write_memory_note: 0,
                    record_memory_correction: 1,
                    evict_memory_note: 1,
                },
                matchedKeyCounts: {
                    note: 1,
                    correction: 0,
                },
                missingKeyCounts: {
                    note: 0,
                    correction: 1,
                },
                continuitySummary: expect.objectContaining({
                    atomIds: ['atom-managed-ops-1'],
                    atomCount: 1,
                    readCount: 1,
                    transitionCount: 0,
                    resolvedKeyCounts: {
                        note: 0,
                        correction: 0,
                    },
                    persistentKeyCounts: {
                        note: 0,
                        correction: 0,
                    },
                    lastTransition: null,
                }),
                lastEvent: expect.objectContaining({
                    actionId: 'evict_memory_note',
                    status: 'success',
                }),
            })
        );

        const index = runtime.getDiagnosticsIndexSnapshot();
        expect(index.managedConversationIndex).toEqual(
            expect.objectContaining({
                actionIds: expect.arrayContaining([
                    'inspect_managed_memory_state',
                    'record_memory_correction',
                    'evict_memory_note',
                ]),
                continuitySummary: expect.objectContaining({
                    atomIds: ['atom-managed-ops-1'],
                    atomCount: 1,
                    readCount: 1,
                    transitionCount: 0,
                    resolvedKeyCounts: {
                        note: 0,
                        correction: 0,
                    },
                    persistentKeyCounts: {
                        note: 0,
                        correction: 0,
                    },
                    lastTransition: null,
                }),
                byActionId: expect.objectContaining({
                    inspect_managed_memory_state: expect.objectContaining({
                        resultCount: 1,
                        matchedKeyCounts: {
                            note: 1,
                            correction: 0,
                        },
                        missingKeyCounts: {
                            note: 0,
                            correction: 1,
                        },
                    }),
                    record_memory_correction: expect.objectContaining({
                        resultCount: 1,
                        targetKeyCounts: {
                            note: 0,
                            correction: 2,
                        },
                    }),
                    evict_memory_note: expect.objectContaining({
                        resultCount: 1,
                        targetKeyCounts: {
                            note: 2,
                            correction: 2,
                        },
                    }),
                }),
            })
        );

        const exported = JSON.parse(runtime.exportDiagnosticsReport({ format: 'json' }) as string);
        expect(exported.snapshot.managedConversationSummary).toEqual(
            expect.objectContaining({
                executionCount: 3,
                missingKeyCounts: {
                    note: 0,
                    correction: 1,
                },
            })
        );
        expect(exported.index.managedConversationIndex.byActionId.inspect_managed_memory_state).toEqual(
            expect.objectContaining({
                resultCount: 1,
                matchedKeyCounts: {
                    note: 1,
                    correction: 0,
                },
            })
        );
        expect(exported.index.managedConversationIndex.continuitySummary).toEqual(
            expect.objectContaining({
                atomIds: ['atom-managed-ops-1'],
                atomCount: 1,
                readCount: 1,
                transitionCount: 0,
                resolvedKeyCounts: {
                    note: 0,
                    correction: 0,
                },
                persistentKeyCounts: {
                    note: 0,
                    correction: 0,
                },
                lastTransition: null,
            })
        );
    });
});
