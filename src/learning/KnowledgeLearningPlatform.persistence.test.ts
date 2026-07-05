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
        await platformA.recordGraphFocusRenderDiagnostics({
            userId: 'user_persist',
            sessionId: 'persist_session_scope',
            workspaceId: 'persist',
            corpusId: 'persist',
            title: 'Persistence Layer',
            requestedSourcePath: 'Knowledge_Base/persist-old.md',
            resolvedSourcePath: 'Knowledge_Base/persist.md',
            candidateSourcePaths: [
                'Knowledge_Base/persist-old.md',
                'Knowledge_Base/persist.md',
            ],
            attemptedSourcePaths: [
                'Knowledge_Base/persist-old.md',
                'Knowledge_Base/persist.md',
            ],
            fallbackSourcePathUsed: true,
            matchedSpanCount: 1,
            highlightTermCount: 1,
            highlightedNodeCount: 1,
            markdownRuntimeAvailable: true,
            storageProviderAvailable: true,
            readSucceeded: true,
            renderSucceeded: true,
            usedFallback: false,
            failureReason: '',
            recordedAt: nowIso,
        });
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
        expect(snapshotJson.conversationTurns[0]?.response?.trace?.graphContext).toBeDefined();
        expect(snapshotJson.sessionStateSnapshot.sessionStates[0]?.panelState?.graphFocusReports).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    title: 'Persistence Layer',
                    requestedSourcePath: 'Knowledge_Base/persist-old.md',
                    resolvedSourcePath: 'Knowledge_Base/persist.md',
                    fallbackSourcePathUsed: true,
                }),
            ])
        );

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
        expect(restoredConversation.trace.graphContext).toEqual(expect.objectContaining({
            anchorAtomId: atomId,
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
        expect(restoredBundle.runtime.conversationTurns.some((turn) => Boolean((turn as any).response.trace.graphContext))).toBe(true);
        expect((restoredBundle.runtime as any).graphFocusReports).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    sessionId: 'persist_session_scope',
                    title: 'Persistence Layer',
                    requestedSourcePath: 'Knowledge_Base/persist-old.md',
                    resolvedSourcePath: 'Knowledge_Base/persist.md',
                    signal: expect.objectContaining({
                        fallbackSourcePathUsed: true,
                        usedFallback: false,
                    }),
                }),
            ])
        );

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

    test('persists full source document content while tolerating older snapshots without it', async () => {
        const documentContent = [
            '# Water Glass',
            '',
            'A water glass is a transparent drinking vessel that contains water.',
            '',
            'A remote source paragraph remains available for document augmentation after restart.',
        ].join('\n');
        const store = createFileBackedKnowledgeGraphStore({ filePath: snapshotPath });
        const platformA = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store,
        });

        await platformA.ingestKnowledge({
            incremental: true,
            documents: [
                {
                    documentId: 'doc_source_content',
                    sourcePath: 'Knowledge_Base/source-content.md',
                    language: 'en',
                    content: documentContent,
                },
            ],
        });

        const persistedSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as {
            documents: Array<{ documentId: string; content?: string }>;
        };
        expect(persistedSnapshot.documents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentId: 'doc_source_content',
                content: documentContent,
            }),
        ]));

        persistedSnapshot.documents = persistedSnapshot.documents.map((documentSnapshot) => {
            const { content: _content, ...legacyDocumentSnapshot } = documentSnapshot;
            return legacyDocumentSnapshot;
        });
        fs.writeFileSync(snapshotPath, JSON.stringify(persistedSnapshot, null, 2), 'utf8');

        const platformB = new KnowledgeLearningPlatform({
            nowProvider: () => new Date(nowIso),
            store: createFileBackedKnowledgeGraphStore({ filePath: snapshotPath }),
        });
        await platformB.ensureReady();

        const restoredQuery = await platformB.queryKnowledge({
            query: 'transparent drinking vessel water',
            topK: 1,
        });
        expect(restoredQuery.items.length).toBeGreaterThan(0);
        expect(platformB.getKnowledgeState().documents).toBe(1);
    });
});
