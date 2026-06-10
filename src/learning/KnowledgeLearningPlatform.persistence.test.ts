import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import { createFileBackedKnowledgeGraphStore } from './store';

describe('KnowledgeLearningPlatform persistence', () => {
    let tempRoot: string;
    let snapshotPath: string;
    let nowIso: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'knowledge-platform-'));
        snapshotPath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
        nowIso = '2026-03-31T10:00:00.000Z';
    });

    afterEach(() => {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('restores ingested graph and learner state from local file store', async () => {
        const store = createFileBackedKnowledgeGraphStore({ filePath: snapshotPath });
        const platformA = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store,
        });

        const ingestResult = await platformA.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_persist',
                    sourcePath: 'Knowledge_Base/persist.md',
                    language: 'en',
                    content: '# Persistence Layer\nKnowledge graph snapshots should survive restarts.',
                },
            ],
        });
        const atomId = ingestResult.atoms[0]?.id as string;
        expect(atomId).toBeDefined();

        await platformA.diagnoseMastery({
            userId: 'user_persist',
            observations: [
                {
                    atomId,
                    outcome: 'incorrect',
                    errorTag: 'recall_gap',
                },
            ],
        });

        await platformA.applyMemoryPolicy({
            userId: 'user_persist',
            layer: 'session',
            operation: 'write',
            entries: [
                {
                    key: 'persist-note',
                    value: 'Learner missed core definition.',
                    tags: ['misconception'],
                    confidence: 0.8,
                    references: [atomId],
                    createdAt: nowIso,
                    updatedAt: nowIso,
                },
            ],
        });
        await platformA.queryKnowledge({
            query: 'persistence graph snapshots',
            topK: 2,
        });
        const firstConversation = await platformA.agentConversation({
            userId: 'user_persist',
            sessionId: 'persist_session_scope',
            message: 'Explain the persistence snapshot behavior.',
            scope: {
                sourcePathPrefixes: ['Knowledge_Base/persist'],
            },
            persistMemory: true,
        });
        expect(firstConversation.summary.appliedMemoryCount).toBeGreaterThan(0);
        await platformA.executeStudySessionAction({
            userId: 'user_persist',
            action: {
                atomId,
                kind: 'quiz',
                source: 'mastery_path',
                answer: 'xylophone quasar nebula',
            },
            persistMemory: true,
            memoryLayer: 'session',
        });
        const sessionPlan = await platformA.buildStudySession({
            userId: 'user_persist',
            focusAtomIds: [atomId],
            maxActions: 2,
            includeDivergence: false,
            includeRetrain: false,
        });
        await platformA.executeStudySessionPlan({
            userId: 'user_persist',
            executionKind: 'session',
            sessionPlan,
            actionLimit: 1,
            persistMemory: true,
            memoryLayer: 'session',
        });

        expect(fs.existsSync(snapshotPath)).toBe(true);
        const snapshotJson = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        expect(Array.isArray(snapshotJson.conversationSessions)).toBe(true);
        expect(Array.isArray(snapshotJson.conversationTurns)).toBe(true);
        expect(Array.isArray(snapshotJson.conversationInvocations)).toBe(true);
        expect(Array.isArray(snapshotJson.resourceRegistry?.resources)).toBe(true);
        expect(Array.isArray(snapshotJson.resourceRegistry?.projections)).toBe(true);
        expect(Array.isArray(snapshotJson.workspaceRegistry?.workspaces)).toBe(true);
        expect(Array.isArray(snapshotJson.workspaceRegistry?.bindings)).toBe(true);
        expect(Array.isArray(snapshotJson.indexLifecycle?.units)).toBe(true);
        expect(Array.isArray(snapshotJson.indexLifecycle?.segments)).toBe(true);
        expect(Array.isArray(snapshotJson.sessionStateSnapshot?.sessionStates)).toBe(true);
        expect(Array.isArray(snapshotJson.workflowArtifacts?.artifacts)).toBe(true);
        expect(Array.isArray(snapshotJson.memoryAuditRecords)).toBe(true);
        expect(snapshotJson.conversationSessions.length).toBeGreaterThan(0);
        expect(snapshotJson.conversationTurns.length).toBeGreaterThan(0);
        expect(snapshotJson.conversationInvocations.length).toBeGreaterThan(0);
        expect(snapshotJson.workflowArtifacts.artifacts.some((artifact: { kind?: string }) => artifact.kind === 'knowledge_run')).toBe(true);
        expect(snapshotJson.workflowArtifacts.artifacts.some((artifact: { kind?: string }) => artifact.kind === 'flashcard_batch')).toBe(true);

        nowIso = '2026-03-31T11:00:00.000Z';
        const platformB = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store: createFileBackedKnowledgeGraphStore({ filePath: snapshotPath }),
        });

        await platformB.ensureReady();
        const state = platformB.getKnowledgeState();
        expect(state.documents).toBe(1);
        expect(state.activeAtoms).toBeGreaterThan(0);
        expect(state.masteryStates).toBeGreaterThan(0);
        expect(state.memoryEntries.session).toBeGreaterThan(0);
        expect(state.ingestTelemetry.ingestCount).toBeGreaterThan(0);
        expect(state.retrievalTelemetry.queryCount).toBeGreaterThan(0);
        expect(state.sessionActionTelemetry.executionCount).toBeGreaterThan(0);
        expect(state.sessionActionTelemetry.analyzedAnswerCount).toBeGreaterThan(0);
        expect(state.sessionExecutionHistoryRecords).toBeGreaterThan(0);

        const queryResult = await platformB.queryKnowledge({
            query: 'persistence snapshots restarts',
            topK: 2,
        });
        expect(queryResult.items.length).toBeGreaterThan(0);

        const restoredConversation = await platformB.agentConversation({
            userId: 'user_persist',
            sessionId: 'persist_session_scope',
            message: 'Explain the persistence snapshot behavior again.',
            scope: {
                sourcePathPrefixes: ['Knowledge_Base/persist'],
            },
            persistMemory: false,
        });
        expect(restoredConversation.trace.recalledMemoryCount).toBeGreaterThan(0);
        expect(restoredConversation.trace.workspaceReadiness).toEqual(expect.objectContaining({
            status: 'ready',
        }));
        expect(restoredConversation.trace.usedScope.readiness).toEqual(expect.objectContaining({
            status: 'ready',
        }));

        const restoredBundle = await platformB.buildWorkspaceExportBundle({
            workspaceId: 'persist',
            userId: 'user_persist',
            exportProfileId: 'mobile-slim',
        });
        expect(restoredBundle.readiness.ready).toBe(true);
        expect(restoredBundle.resources.length).toBeGreaterThan(0);
        expect(restoredBundle.index.units.length).toBeGreaterThan(0);
        expect(restoredBundle.runtime.workflowArtifacts.length).toBeGreaterThan(0);
        expect(restoredBundle.runtime.workflowArtifacts.some((artifact) => artifact.kind === 'knowledge_run')).toBe(true);
        expect(restoredBundle.runtime.workflowArtifacts.some((artifact) => artifact.kind === 'flashcard_batch')).toBe(true);
        expect(restoredBundle.memory.auditRecords.length).toBeGreaterThan(0);

        const storeDiagnostics = await platformB.getStoreDiagnostics();
        expect(storeDiagnostics.storeType).toBe('file');
        expect(storeDiagnostics.exists).toBe(true);
        expect(storeDiagnostics.loaded).toBe(true);

        const history = await platformB.queryStudySessionHistory({
            userId: 'user_persist',
            limit: 5,
            executionKinds: ['session'],
        });
        expect(history.records.length).toBeGreaterThan(0);
        expect(history.records[0]?.executionKind).toBe('session');
        expect(history.records[0]?.focusAtomIds.length).toBeGreaterThan(0);
        expect(history.page.totalFilteredRecords).toBeGreaterThan(0);
        expect(history.summary.executionKindBreakdown.find((item) => item.executionKind === 'session')?.recordCount).toBeGreaterThan(0);

        const guardrail = await platformB.evaluateIngestGuardrails({});
        expect(guardrail.latestSummary).not.toBeNull();
        expect(guardrail.latestSummary?.ingestedDocuments).toBe(1);

        const restored = await platformB.reloadFromStore();
        expect(restored).toBe(true);
    });
});
