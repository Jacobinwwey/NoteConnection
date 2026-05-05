(
    function bootstrapAgentWorkspaceRuntime(globalScope, factory) {
        const runtimeModule = factory(globalScope);
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = runtimeModule;
        }
        if (globalScope && typeof globalScope === 'object') {
            globalScope.NoteConnectionAgentWorkspaceRuntime = runtimeModule;
        }
    }
)(
    typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : this),
    function agentWorkspaceRuntimeFactory(globalScope) {
        const BODY_CLASS_ENABLED = 'agent-workspace-enabled';
        const BODY_CLASS_PATH_VISIBLE = 'agent-workspace-path-visible';
        const BODY_CLASS_PATH_FULLSCREEN = 'agent-workspace-path-fullscreen';
        const PATH_DOCK_CLASS = 'agent-workspace-path-docked';
        const MAX_ACTIVE_POINT_CONTEXTUAL_ACTIONS = 2;
        const MAX_DIAGNOSTIC_TURNS = 120;
        const MAX_DIAGNOSTIC_CAPABILITY_EVENTS = 120;
        const DIAGNOSTIC_RUNBOOK_LINKS = Object.freeze([
            Object.freeze({
                id: 'development-progress-dashboard',
                label: 'Development Progress Dashboard',
                paths: Object.freeze({
                    en: 'docs/diataxis/en/explanation/development-progress-dashboard.md',
                    zh: 'docs/diataxis/zh/explanation/development-progress-dashboard.md',
                }),
            }),
            Object.freeze({
                id: 'agent-conversation-focus-mode-plan',
                label: 'Agent Conversation + Focus Mode Delivery Plan',
                paths: Object.freeze({
                    en: 'docs/diataxis/en/explanation/agent-conversation-focus-mode-plan.md',
                    zh: 'docs/diataxis/zh/explanation/agent-conversation-focus-mode-plan.md',
                }),
            }),
            Object.freeze({
                id: 'm7-direction-requirements',
                label: 'Mainline CI Stabilization and M7 Direction Requirements',
                paths: Object.freeze({
                    en: 'docs/brainstorms/2026-04-16-mainline-ci-stabilization-and-m7-direction-requirements.md',
                    zh: 'docs/brainstorms/2026-04-16-mainline-ci-stabilization-and-m7-direction-requirements.md',
                }),
            }),
            Object.freeze({
                id: 'foundation-reentry-readiness-checklist',
                label: 'Foundation Re-entry Readiness Checklist',
                paths: Object.freeze({
                    en: 'docs/diataxis/en/explanation/foundation-reentry-readiness-checklist.md',
                    zh: 'docs/diataxis/zh/explanation/foundation-reentry-readiness-checklist.md',
                }),
            }),
        ]);
        const SUPPORTED_TUTOR_ACTION_KINDS = Object.freeze([
            'generate_quiz',
            'analyze_answer',
            'follow_up',
            'generate_transfer',
            'generate_counterexample',
            'recap',
        ]);
        const SUPPORTED_MEMORY_POLICY_LAYERS = Object.freeze([
            'session',
            'unit',
            'long_term',
        ]);
        const SUPPORTED_MEMORY_POLICY_OPERATIONS = Object.freeze([
            'read',
            'snapshot',
            'retrain_plan',
            'write',
            'evict',
        ]);
        const SUPPORTED_READONLY_MEMORY_POLICY_OPERATIONS = Object.freeze([
            'read',
            'snapshot',
            'retrain_plan',
        ]);
        const MANAGED_CONVERSATION_ACTION_IDS = Object.freeze([
            'inspect_managed_memory_state',
            'write_memory_note',
            'record_memory_correction',
            'evict_memory_note',
        ]);
        const STUDY_LOOP_ACTION_IDS = Object.freeze([
            'generate_quiz',
            'analyze_answer',
            'recap',
            'follow_up',
            'generate_transfer',
            'generate_counterexample',
            'build_study_session',
        ]);
        const MEMORY_ACTION_IDS = Object.freeze([
            'inspect_memory_snapshot',
            'inspect_unit_memory_snapshot',
            'inspect_long_term_memory_snapshot',
            'inspect_memory_retrain_plan',
            'inspect_memory_read',
            'inspect_long_term_memory_read',
            'inspect_managed_memory_state',
            'write_memory_note',
            'record_memory_correction',
            'evict_memory_note',
        ]);
        const HISTORY_FOLLOW_UP_CANDIDATES_BY_ACTION_ID = Object.freeze({
            open_learning_path: Object.freeze([
                'open_focus_mode',
                'build_study_session',
                'recap',
                'follow_up',
            ]),
            build_study_session: Object.freeze([
                'recap',
                'follow_up',
                'generate_transfer',
                'generate_quiz',
                'analyze_answer',
                'open_learning_path',
                'open_focus_mode',
            ]),
            recap: Object.freeze([
                'follow_up',
                'generate_transfer',
                'generate_counterexample',
                'generate_quiz',
                'build_study_session',
                'open_learning_path',
                'open_focus_mode',
            ]),
        });
        const DEFAULT_HISTORY_FOLLOW_UP_CANDIDATES = Object.freeze([
            'build_study_session',
            'recap',
            'follow_up',
            'open_learning_path',
            'open_focus_mode',
        ]);

        function createEmptyMemoryPolicyLayerCounts() {
            return {
                session: 0,
                unit: 0,
                long_term: 0,
            };
        }

        function createEmptyMemoryPolicyOperationCounts() {
            return {
                read: 0,
                snapshot: 0,
                retrain_plan: 0,
                write: 0,
                evict: 0,
            };
        }

        function trimString(value) {
            return typeof value === 'string' ? value.trim() : '';
        }

        function normalizeMemoryPolicyLayerForDiagnostics(rawLayer) {
            const layer = trimString(rawLayer);
            return SUPPORTED_MEMORY_POLICY_LAYERS.includes(layer) ? layer : '';
        }

        function normalizeMemoryPolicyOperationForDiagnostics(rawOperation) {
            const operation = trimString(rawOperation);
            return SUPPORTED_MEMORY_POLICY_OPERATIONS.includes(operation) ? operation : '';
        }

        function isReadonlyMemoryPolicyOperation(rawOperation) {
            const operation = normalizeMemoryPolicyOperationForDiagnostics(rawOperation);
            return SUPPORTED_READONLY_MEMORY_POLICY_OPERATIONS.includes(operation);
        }

        function resolveTutorActionKind(rawActionKind) {
            const actionKind = trimString(rawActionKind);
            if (!actionKind) {
                throw new Error('execute_tutor_action requires request.actionKind.');
            }
            if (!SUPPORTED_TUTOR_ACTION_KINDS.includes(actionKind)) {
                throw new Error(
                    `Unsupported tutor actionKind "${actionKind}". Supported kinds: ${SUPPORTED_TUTOR_ACTION_KINDS.join(', ')}.`
                );
            }
            return actionKind;
        }

        function resolveMemoryPolicyLayer(rawLayer) {
            const layer = trimString(rawLayer) || 'session';
            if (!SUPPORTED_MEMORY_POLICY_LAYERS.includes(layer)) {
                throw new Error(
                    `Unsupported memory layer "${layer}". Supported layers: ${SUPPORTED_MEMORY_POLICY_LAYERS.join(', ')}.`
                );
            }
            return layer;
        }

        function resolveMemoryPolicyOperation(rawOperation) {
            const operation = trimString(rawOperation) || 'snapshot';
            if (!SUPPORTED_MEMORY_POLICY_OPERATIONS.includes(operation)) {
                throw new Error(
                    `Unsupported memory operation "${operation}". Supported operations: ${SUPPORTED_MEMORY_POLICY_OPERATIONS.join(', ')}.`
                );
            }
            return operation;
        }

        function resolveReadonlyMemoryPolicyOperation(rawOperation) {
            const operation = resolveMemoryPolicyOperation(rawOperation);
            if (!SUPPORTED_READONLY_MEMORY_POLICY_OPERATIONS.includes(operation)) {
                throw new Error(
                    `Unsupported readonly memory operation "${operation}". Supported readonly operations: ${SUPPORTED_READONLY_MEMORY_POLICY_OPERATIONS.join(', ')}.`
                );
            }
            return operation;
        }

        function resolveStringArray(values) {
            if (!Array.isArray(values)) {
                return [];
            }
            return Array.from(new Set(values
                .map((value) => trimString(value))
                .filter((value) => value.length > 0)));
        }

        function resolveMemoryPolicyLimit(rawLimit, fallback) {
            const numericLimit = Number(rawLimit);
            const numericFallback = Number(fallback);
            const base = Number.isFinite(numericLimit) ? numericLimit : (Number.isFinite(numericFallback) ? numericFallback : 20);
            return Math.max(1, Math.min(100, Math.floor(base)));
        }

        function cloneCapabilityResultPreview(resultPreview) {
            if (!resultPreview || typeof resultPreview !== 'object') {
                return null;
            }
            return { ...resultPreview };
        }

        function cloneCapabilityEvent(event) {
            if (!event || typeof event !== 'object') {
                return null;
            }
            const resultPreview = cloneCapabilityResultPreview(event.resultPreview);
            return {
                ...event,
                ...(resultPreview ? { resultPreview } : {}),
            };
        }

        function formatMemoryKeyLabel(rawKey) {
            const key = trimString(rawKey);
            if (!key) {
                return '';
            }
            if (key.startsWith('conversation_note:')) {
                return 'note';
            }
            if (key.startsWith('conversation_correction:')) {
                return 'correction';
            }
            const segments = key.split(':').map((segment) => trimString(segment)).filter((segment) => segment.length > 0);
            return segments.length > 1 ? segments[segments.length - 1] : key;
        }

        function summarizeMemoryKeyLabels(keys) {
            const labels = resolveStringArray(keys)
                .map((key) => formatMemoryKeyLabel(key))
                .filter((label) => label.length > 0);
            return labels.length ? labels.join(', ') : 'none';
        }

        function resolveManagedConversationKeyLabels(keys) {
            return Array.from(new Set(
                resolveStringArray(keys)
                    .map((key) => formatMemoryKeyLabel(key))
                    .filter((label) => label === 'note' || label === 'correction')
            ));
        }

        function resolveManagedMemoryFollowUpKeyLabel(actionId) {
            const normalizedActionId = trimString(actionId);
            if (normalizedActionId === 'write_memory_note') {
                return 'note';
            }
            if (normalizedActionId === 'record_memory_correction') {
                return 'correction';
            }
            return '';
        }

        function resolveManagedConversationFollowUpActionIdsFromKeyCounts(counts) {
            const actionIds = [];
            if (Number(counts && counts.note) > 0) {
                actionIds.push('write_memory_note');
            }
            if (Number(counts && counts.correction) > 0) {
                actionIds.push('record_memory_correction');
            }
            return actionIds;
        }

        function resolveManagedConversationFollowUpActionIdsFromKeyLabels(keyLabels) {
            return Array.from(new Set(
                resolveManagedConversationKeyLabels(keyLabels)
                    .map((keyLabel) => {
                        if (keyLabel === 'note') {
                            return 'write_memory_note';
                        }
                        if (keyLabel === 'correction') {
                            return 'record_memory_correction';
                        }
                        return '';
                    })
                    .filter((actionId) => actionId.length > 0)
            ));
        }

        function resolveManagedConversationFollowUpActionLabels(actionIds) {
            return Array.from(new Set(
                resolveStringArray(actionIds)
                    .map((actionId) => {
                        const normalizedActionId = trimString(actionId);
                        if (normalizedActionId === 'write_memory_note') {
                            return getI18nText(
                                'agentWorkspace.actions.writeMemoryNote',
                                'Store Memory Note'
                            );
                        }
                        if (normalizedActionId === 'record_memory_correction') {
                            return getI18nText(
                                'agentWorkspace.actions.recordMemoryCorrection',
                                'Record Correction'
                            );
                        }
                        return normalizedActionId;
                    })
                    .filter((label) => trimString(label).length > 0)
            ));
        }

        function buildManagedConversationLastTransition(
            atomId,
            newerEvent,
            olderEvent,
            resolvedKeyLabels,
            persistentKeyLabels
        ) {
            const normalizedResolvedKeyLabels = resolveManagedConversationKeyLabels(resolvedKeyLabels);
            const normalizedPersistentKeyLabels = resolveManagedConversationKeyLabels(persistentKeyLabels);
            const keyLabels = normalizedResolvedKeyLabels.concat(
                normalizedPersistentKeyLabels.filter((label) => !normalizedResolvedKeyLabels.includes(label))
            );
            const resolvedFollowUpActionIds = resolveManagedConversationFollowUpActionIdsFromKeyLabels(
                normalizedResolvedKeyLabels
            );
            const resolvedFollowUpActionLabels = resolveManagedConversationFollowUpActionLabels(
                resolvedFollowUpActionIds
            );
            const persistentFollowUpActionIds = resolveManagedConversationFollowUpActionIdsFromKeyLabels(
                normalizedPersistentKeyLabels
            );
            const persistentFollowUpActionLabels = resolveManagedConversationFollowUpActionLabels(
                persistentFollowUpActionIds
            );
            const followUpActionIds = Array.from(new Set(
                resolvedFollowUpActionIds.concat(persistentFollowUpActionIds)
            ));
            const followUpActionLabels = resolveManagedConversationFollowUpActionLabels(followUpActionIds);
            const kind = normalizedResolvedKeyLabels.length > 0 && normalizedPersistentKeyLabels.length > 0
                ? 'mixed'
                : normalizedResolvedKeyLabels.length > 0
                    ? 'resolved'
                    : 'persistent';
            return {
                atomId,
                keyLabels,
                keyLabel: keyLabels.join(', '),
                kind,
                newerEventId: trimString(newerEvent && newerEvent.eventId),
                olderEventId: trimString(olderEvent && olderEvent.eventId),
                newerAt: trimString(newerEvent && newerEvent.at),
                olderAt: trimString(olderEvent && olderEvent.at),
                resolvedKeyLabels: normalizedResolvedKeyLabels,
                resolvedKeyLabel: normalizedResolvedKeyLabels.join(', '),
                persistentKeyLabels: normalizedPersistentKeyLabels,
                persistentKeyLabel: normalizedPersistentKeyLabels.join(', '),
                followUpActionId: followUpActionIds[0] || '',
                followUpActionIds,
                followUpActionLabel: followUpActionLabels[0] || '',
                followUpActionLabels,
                resolvedFollowUpActionIds,
                resolvedFollowUpActionLabels,
                persistentFollowUpActionIds,
                persistentFollowUpActionLabels,
            };
        }

        function isManagedMemoryStateActionId(actionId) {
            return trimString(actionId) === 'inspect_managed_memory_state';
        }

        function summarizeManagedMemoryFollowUpActions(keys) {
            const labels = [];
            resolveStringArray(keys).forEach((key) => {
                if (key.startsWith('conversation_note:')) {
                    labels.push(
                        getI18nText(
                            'agentWorkspace.actions.writeMemoryNote',
                            'Store Memory Note'
                        )
                    );
                    return;
                }
                if (key.startsWith('conversation_correction:')) {
                    labels.push(
                        getI18nText(
                            'agentWorkspace.actions.recordMemoryCorrection',
                            'Record Correction'
                        )
                    );
                }
            });
            return Array.from(new Set(labels)).join(', ');
        }

        function resolveMisconceptionTopK(rawTopK, fallback) {
            const numericTopK = Number(rawTopK);
            const numericFallback = Number(fallback);
            const base = Number.isFinite(numericTopK) ? numericTopK : (Number.isFinite(numericFallback) ? numericFallback : 5);
            return Math.max(1, Math.min(20, Math.floor(base)));
        }

        function resolveQueryTopK(rawTopK, fallback) {
            const numericTopK = Number(rawTopK);
            const numericFallback = Number(fallback);
            const base = Number.isFinite(numericTopK) ? numericTopK : (Number.isFinite(numericFallback) ? numericFallback : 4);
            return Math.max(1, Math.min(8, Math.floor(base)));
        }

        function formatI18nTemplate(template, params) {
            if (typeof template !== 'string' || !template) {
                return '';
            }
            return template.replace(/\{(\w+)\}/g, (_match, token) => {
                const value = params && Object.prototype.hasOwnProperty.call(params, token)
                    ? params[token]
                    : '';
                return value == null ? '' : String(value);
            });
        }

        function getI18nText(key, fallback, params) {
            if (
                globalScope
                && globalScope.i18n
                && typeof globalScope.i18n.t === 'function'
            ) {
                const translated = globalScope.i18n.t(key, params || {});
                if (typeof translated === 'string' && translated.trim().length > 0 && translated !== key) {
                    return translated;
                }
            }
            return formatI18nTemplate(fallback, params);
        }

        function getContractApi() {
            return (globalScope && globalScope.NoteConnectionAgentWorkspaceContract)
                ? globalScope.NoteConnectionAgentWorkspaceContract
                : null;
        }

        async function requestJson(endpoint, payload, options = {}) {
            const method = trimString(options.method || 'POST').toUpperCase() || 'POST';
            const responseKey = trimString(options.responseKey || 'result') || 'result';
            const headers = method === 'GET'
                ? {}
                : {
                    'Content-Type': 'application/json',
                };
            const requestOptions = {
                method,
                headers,
            };
            if (method !== 'GET') {
                requestOptions.body = JSON.stringify(payload || {});
            }
            const response = await fetch(endpoint, requestOptions);
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                const message = body && body.error
                    ? body.error
                    : `Request failed (${response.status})`;
                throw new Error(String(message));
            }
            if (!body || body.success !== true) {
                const message = body && body.error
                    ? body.error
                    : `API ${endpoint} returned unexpected response`;
                throw new Error(String(message));
            }
            return body[responseKey];
        }

        function resolveConversationPayload(input) {
            const contractApi = getContractApi();
            if (contractApi && typeof contractApi.createAgentConversationPayload === 'function') {
                return contractApi.createAgentConversationPayload(input);
            }
            const userId = trimString(input && input.userId);
            const message = trimString(input && input.message);
            const topKRaw = Number(input && input.topK);
            const topK = Number.isFinite(topKRaw) ? Math.max(1, Math.min(8, Math.floor(topKRaw))) : 4;
            if (!userId) {
                throw new Error('agent_workspace requires a non-empty userId for conversation payload.');
            }
            if (!message) {
                throw new Error('agent_workspace requires a non-empty message for conversation payload.');
            }
            return { userId, message, topK };
        }

        function resolveOperationPlan(capability) {
            const contractApi = getContractApi();
            if (contractApi && typeof contractApi.buildKnowledgeOperationRequestPayload === 'function') {
                return contractApi.buildKnowledgeOperationRequestPayload(capability);
            }
            const execution = capability && capability.execution && typeof capability.execution === 'object'
                ? capability.execution
                : {};
            const request = capability && capability.request && typeof capability.request === 'object'
                ? capability.request
                : {};
            const operationId = trimString(execution.operationId);
            if (operationId === 'build_learning_path') {
                return {
                    operationId,
                    endpoint: '/api/knowledge/path',
                    method: 'POST',
                    resultPresentation: 'learning_path_card',
                    body: {
                        userId: trimString(request.userId),
                        focusAtomIds: [trimString(request.atomId)],
                        maxMasteryPaths: 3,
                        maxDivergencePaths: 2,
                    },
                };
            }
            if (operationId === 'execute_tutor_action') {
                const userId = trimString(request.userId);
                const atomId = trimString(request.atomId);
                if (!userId || !atomId) {
                    throw new Error('execute_tutor_action requires request.userId, request.atomId, and request.actionKind.');
                }
                const actionKind = resolveTutorActionKind(request.actionKind);
                const answer = trimString(request.answer);
                return {
                    operationId,
                    endpoint: '/api/knowledge/tutor/action',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'assistant_message',
                    body: {
                        userId,
                        atomId,
                        actionKind,
                        prompt: trimString(request.message),
                        ...(answer ? { answer } : {}),
                    },
                };
            }
            if (operationId === 'build_study_session') {
                return {
                    operationId,
                    endpoint: '/api/knowledge/session/plan',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'study_session_card',
                    body: {
                        userId: trimString(request.userId),
                        focusAtomIds: [trimString(request.atomId)],
                        maxActions: 6,
                        includeDivergence: true,
                        includeRetrain: false,
                    },
                };
            }
            if (operationId === 'query_knowledge') {
                const query = trimString(request.query || request.message);
                if (!query) {
                    throw new Error('query_knowledge requires request.query or request.message.');
                }
                return {
                    operationId,
                    endpoint: '/api/knowledge/query',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'query_trace_card',
                    body: {
                        query,
                        topK: resolveQueryTopK(request.topK, 4),
                    },
                };
            }
            if (operationId === 'evaluate_ingest_guardrails') {
                return {
                    operationId,
                    endpoint: '/api/knowledge/ingest/guardrails/evaluate',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'ingest_guardrail_card',
                    body: {},
                };
            }
            if (operationId === 'query_session_history') {
                return {
                    operationId,
                    endpoint: '/api/knowledge/session/history',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'session_history_card',
                    body: {
                        userId: trimString(request.userId),
                        limit: 5,
                    },
                };
            }
            if (operationId === 'query_mastery_misconceptions') {
                const atomId = trimString(request.atomId);
                return {
                    operationId,
                    endpoint: '/api/knowledge/mastery/misconceptions',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'mastery_misconceptions_card',
                    body: {
                        userId: trimString(request.userId),
                        topK: resolveMisconceptionTopK(request.topK, 5),
                        ...(atomId ? { atomIds: [atomId] } : {}),
                    },
                };
            }
            if (operationId === 'capture_learning_quality_snapshot') {
                return {
                    operationId,
                    endpoint: '/api/knowledge/quality/snapshot',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'learning_quality_snapshot_card',
                    body: {
                        userId: trimString(request.userId),
                    },
                };
            }
            if (operationId === 'apply_memory_policy') {
                const userId = trimString(request.userId);
                if (!userId) {
                    throw new Error('apply_memory_policy requires request.userId.');
                }
                const layer = resolveMemoryPolicyLayer(request.memoryLayer || request.layer);
                const operation = resolveMemoryPolicyOperation(request.memoryOperation || request.operation);
                const query = trimString(request.memoryQuery || request.query);
                const limit = resolveMemoryPolicyLimit(
                    request.memoryLimit || request.limit,
                    operation === 'retrain_plan' ? 8 : 20
                );
                if (operation === 'write') {
                    const atomId = trimString(request.atomId);
                    const memoryKey = trimString(request.memoryKey) || (atomId ? `conversation_note:${atomId}` : '');
                    if (!memoryKey) {
                        throw new Error('apply_memory_policy write requires request.memoryKey or request.atomId.');
                    }
                    const memoryValue = trimString(request.memoryValue);
                    const memoryTags = resolveStringArray(request.memoryTags);
                    const memoryReferences = Array.from(new Set([
                        ...resolveStringArray(request.memoryReferences),
                        ...(atomId ? [atomId] : []),
                    ]));
                    const promptMessage = trimString(request.memoryPromptMessage);
                    return {
                        operationId,
                        endpoint: '/api/knowledge/memory/policy',
                        method: 'POST',
                        resultPresentation: trimString(execution.resultPresentation) || 'memory_policy_card',
                        body: {
                            userId,
                            layer,
                            operation,
                            ...(memoryValue ? {
                                entries: [
                                    {
                                        key: memoryKey,
                                        value: memoryValue,
                                        tags: memoryTags,
                                        references: memoryReferences,
                                    },
                                ],
                            } : {}),
                        },
                        ...(!memoryValue ? {
                            promptConfig: {
                                kind: 'memory_write',
                                message: promptMessage,
                                entryTemplate: {
                                    key: memoryKey,
                                    tags: memoryTags,
                                    references: memoryReferences,
                                },
                            },
                        } : {}),
                    };
                }
                if (operation === 'evict') {
                    const matchKeys = resolveStringArray(request.memoryMatchKeys);
                    return {
                        operationId,
                        endpoint: '/api/knowledge/memory/policy',
                        method: 'POST',
                        resultPresentation: trimString(execution.resultPresentation) || 'memory_policy_card',
                        body: {
                            userId,
                            layer,
                            operation,
                            ...(matchKeys.length ? { matchKeys } : {}),
                        },
                    };
                }
                return {
                    operationId,
                    endpoint: '/api/knowledge/memory/policy',
                    method: 'POST',
                    resultPresentation: trimString(execution.resultPresentation) || 'memory_policy_card',
                    body: {
                        userId,
                        layer,
                        operation,
                        ...(operation === 'read' || operation === 'retrain_plan' ? { limit } : {}),
                        ...(operation === 'read' && resolveStringArray(request.memoryMatchKeys).length > 0 ? {
                            matchKeys: resolveStringArray(request.memoryMatchKeys),
                        } : {}),
                        ...(operation === 'read' && query ? { query } : {}),
                    },
                };
            }
            throw new Error(`Unsupported knowledge operation: ${operationId || '<empty>'}`);
        }

        function createAgentWorkspaceRuntime(options = {}) {
            const state = {
                busy: false,
                latestKnowledgePoints: [],
                latestFocusAtomId: '',
                latestPathAtomId: '',
                expandedHistoryEventIdsByAtom: Object.create(null),
                pathVisible: false,
                pathFullscreen: false,
                initialized: false,
            };
            const diagnostics = {
                turnSequence: 0,
                capabilityEventSequence: 0,
                turnHistory: [],
                capabilityEvents: [],
                conversationRequests: 0,
                replayCandidateTurns: 0,
                userMessageFingerprintCounts: Object.create(null),
                lastConversation: null,
                lastFoundationReadiness: null,
                lastFailure: null,
            };

            const dom = {
                panel: null,
                form: null,
                userIdInput: null,
                input: null,
                sendButton: null,
                messages: null,
                knowledgeList: null,
                openPathButton: null,
                closePathButton: null,
                pathFullscreenButton: null,
                foundationReadinessButton: null,
            };

            function nowIso() {
                return new Date().toISOString();
            }

            function pushBounded(list, item, maxSize) {
                list.push(item);
                if (list.length > maxSize) {
                    list.splice(0, list.length - maxSize);
                }
            }

            function markUserMessageReplayCandidate(message) {
                const fingerprint = trimString(message).toLowerCase();
                if (!fingerprint) {
                    return {
                        fingerprint: '',
                        replayCandidate: false,
                        seenCount: 0,
                    };
                }
                const previousCount = Number(diagnostics.userMessageFingerprintCounts[fingerprint] || 0);
                const nextCount = previousCount + 1;
                diagnostics.userMessageFingerprintCounts[fingerprint] = nextCount;
                const replayCandidate = previousCount > 0;
                if (replayCandidate) {
                    diagnostics.replayCandidateTurns += 1;
                }
                return {
                    fingerprint,
                    replayCandidate,
                    seenCount: nextCount,
                };
            }

            function recordTurn(role, text, meta = {}) {
                const content = trimString(text);
                if (!content) {
                    return;
                }
                pushBounded(
                    diagnostics.turnHistory,
                    {
                        turnId: `turn_${diagnostics.turnSequence + 1}`,
                        role,
                        text: content,
                        at: nowIso(),
                        ...meta,
                    },
                    MAX_DIAGNOSTIC_TURNS
                );
                diagnostics.turnSequence += 1;
            }

            function recordCapabilityEvent(payload = {}) {
                const durationMs = Number(payload.durationMs);
                const memoryLayer = normalizeMemoryPolicyLayerForDiagnostics(payload.memoryLayer);
                const memoryOperation = normalizeMemoryPolicyOperationForDiagnostics(payload.memoryOperation);
                const managedKeyLabels = resolveManagedConversationKeyLabels(payload.managedKeyLabels);
                const matchedManagedKeyLabels = resolveManagedConversationKeyLabels(payload.matchedManagedKeyLabels);
                const missingManagedKeyLabels = resolveManagedConversationKeyLabels(payload.missingManagedKeyLabels);
                const resultPreview = cloneCapabilityResultPreview(payload.resultPreview);
                const event = {
                    eventId: `cap_${diagnostics.capabilityEventSequence + 1}`,
                    at: nowIso(),
                    phase: trimString(payload.phase) || 'event',
                    status: trimString(payload.status) || 'unknown',
                    actionId: trimString(payload.actionId),
                    operationId: trimString(payload.operationId),
                    resultPresentation: trimString(payload.resultPresentation),
                    atomId: trimString(payload.atomId),
                    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : undefined,
                    error: trimString(payload.error),
                    memoryLayer: memoryLayer || undefined,
                    memoryOperation: memoryOperation || undefined,
                    managedKeyLabels: managedKeyLabels.length > 0 ? managedKeyLabels : undefined,
                    matchedManagedKeyLabels: matchedManagedKeyLabels.length > 0 ? matchedManagedKeyLabels : undefined,
                    missingManagedKeyLabels: missingManagedKeyLabels.length > 0 ? missingManagedKeyLabels : undefined,
                    resultPreview: resultPreview || undefined,
                };
                pushBounded(diagnostics.capabilityEvents, event, MAX_DIAGNOSTIC_CAPABILITY_EVENTS);
                diagnostics.capabilityEventSequence += 1;
                return event;
            }

            function recordFailure(source, errorMessage) {
                diagnostics.lastFailure = {
                    at: nowIso(),
                    source: trimString(source),
                    message: trimString(errorMessage) || 'unknown error',
                };
            }

            function cloneRunbookLinks() {
                return DIAGNOSTIC_RUNBOOK_LINKS.map((link) => ({
                    id: link.id,
                    label: link.label,
                    paths: {
                        en: link.paths.en,
                        zh: link.paths.zh,
                    },
                }));
            }

            function resolvePrimaryRunbookAction() {
                // M8.53: bounded primary runbook consumer adoption.
                // Derives the primary recommendation from local diagnostics state
                // using the same contract shape as the server-side AgentWorkspaceDiagnosticsRunbookAction.
                // No new routes, persistence, or backend recomputation.
                var managedSummary = computeManagedConversationSummary();
                var capabilityStats = computeCapabilityOperationStats();
                var hasPersistentGaps = (
                    managedSummary.continuitySummary.persistentKeyCounts.note > 0 ||
                    managedSummary.continuitySummary.persistentKeyCounts.correction > 0
                );
                var hasResolvedGaps = (
                    managedSummary.continuitySummary.resolvedKeyCounts.note > 0 ||
                    managedSummary.continuitySummary.resolvedKeyCounts.correction > 0
                );
                var hasFailures = capabilityStats.some(function (stat) {
                    return stat.failureCount > 0;
                });
                var primaryAction = null;
                var secondaryActions = [];

                if (hasPersistentGaps) {
                    primaryAction = {
                        actionId: 'inspect_managed_memory_state',
                        severity: 'warning',
                        title: 'Review persistent managed-memory gaps',
                        trigger: 'persistentManagedMemoryGap',
                        rationale: (
                            'Persistent managed-memory gaps remain for the current atom. ' +
                            'Missing note keys: ' + (managedSummary.continuitySummary.persistentKeyCounts.note || 0) +
                            ', missing correction keys: ' + (managedSummary.continuitySummary.persistentKeyCounts.correction || 0) +
                            '. Recommended next step: Store Memory Note or Record Correction for this atom.'
                        ),
                        runbookLinkIds: ['development-progress-dashboard'],
                    };
                    if (managedSummary.continuitySummary.persistentFollowUpActionIds.length > 0) {
                        secondaryActions.push({
                            actionId: managedSummary.continuitySummary.persistentFollowUpActionIds[0],
                            severity: 'info',
                            title: 'Execute pending follow-up: ' + (managedSummary.continuitySummary.persistentFollowUpActionLabels[0] || managedSummary.continuitySummary.persistentFollowUpActionIds[0]),
                            trigger: 'persistentFollowUp',
                            rationale: 'A deterministic follow-up action remains from the most recent managed-memory gap analysis.',
                            runbookLinkIds: ['development-progress-dashboard'],
                        });
                    }
                } else if (hasFailures) {
                    var failedStats = capabilityStats.filter(function (stat) { return stat.failureCount > 0; });
                    var firstFailedOp = failedStats[0];
                    primaryAction = {
                        actionId: 'review_recent_failures',
                        severity: 'warning',
                        title: 'Review recent capability failures',
                        trigger: 'recentCapabilityFailure',
                        rationale: (
                            'Recent capability execution failures detected. ' +
                            'Operation: ' + (firstFailedOp ? firstFailedOp.operationId : 'unknown') +
                            ', failures: ' + (firstFailedOp ? firstFailedOp.failureCount : 0) +
                            '. Review the diagnostics snapshot for failure details.'
                        ),
                        runbookLinkIds: ['development-progress-dashboard'],
                    };
                } else if (hasResolvedGaps) {
                    primaryAction = {
                        actionId: 'review_continuity_recovery',
                        severity: 'info',
                        title: 'Continuity recovery confirmed',
                        trigger: 'managedMemoryGapResolved',
                        rationale: (
                            'Previously missing managed-memory gaps have been resolved by adjacent operations. ' +
                            'Resolved note keys: ' + (managedSummary.continuitySummary.resolvedKeyCounts.note || 0) +
                            ', resolved correction keys: ' + (managedSummary.continuitySummary.resolvedKeyCounts.correction || 0) +
                            '. No immediate corrective action needed.'
                        ),
                        runbookLinkIds: ['development-progress-dashboard'],
                    };
                }

                var runbookActions = [];
                if (primaryAction) {
                    runbookActions.push(primaryAction);
                }
                runbookActions = runbookActions.concat(secondaryActions);

                return {
                    primaryRunbookAction: primaryAction,
                    runbookActions: runbookActions,
                };
            }

            function computeCapabilityOperationStats() {
                const byOperationId = Object.create(null);
                diagnostics.capabilityEvents.forEach((event) => {
                    const operationId = trimString(event.operationId) || '__unknown__';
                    const status = trimString(event.status) || 'unknown';
                    const phase = trimString(event.phase) || 'event';
                    if (!byOperationId[operationId]) {
                        byOperationId[operationId] = {
                            operationId,
                            eventIds: [],
                            requestCount: 0,
                            resultCount: 0,
                            successCount: 0,
                            failureCount: 0,
                            pendingCount: 0,
                            unknownCount: 0,
                            durationTotalMs: 0,
                            durationSampleCount: 0,
                            latestStatus: '',
                            latestAt: '',
                        };
                    }
                    const stats = byOperationId[operationId];
                    const eventId = trimString(event.eventId);
                    if (eventId) {
                        stats.eventIds.push(eventId);
                    }
                    if (phase === 'request') {
                        stats.requestCount += 1;
                    } else if (phase === 'result') {
                        stats.resultCount += 1;
                    }
                    if (status === 'success') {
                        stats.successCount += 1;
                    } else if (status === 'failure' || status === 'error') {
                        stats.failureCount += 1;
                    } else if (status === 'pending') {
                        stats.pendingCount += 1;
                    } else {
                        stats.unknownCount += 1;
                    }
                    const durationMs = Number(event.durationMs);
                    if (Number.isFinite(durationMs)) {
                        stats.durationTotalMs += Math.max(0, Math.floor(durationMs));
                        stats.durationSampleCount += 1;
                    }
                    stats.latestStatus = status;
                    stats.latestAt = trimString(event.at);
                });

                return Object.keys(byOperationId)
                    .sort()
                    .map((operationId) => {
                        const stats = byOperationId[operationId];
                        return {
                            operationId: stats.operationId,
                            eventIds: stats.eventIds.slice(),
                            requestCount: stats.requestCount,
                            resultCount: stats.resultCount,
                            successCount: stats.successCount,
                            failureCount: stats.failureCount,
                            pendingCount: stats.pendingCount,
                            unknownCount: stats.unknownCount,
                            averageDurationMs: stats.durationSampleCount > 0
                                ? Math.round(stats.durationTotalMs / stats.durationSampleCount)
                                : null,
                            latestStatus: stats.latestStatus,
                            latestAt: stats.latestAt,
                        };
                    });
            }

            function computeTurnIndex() {
                const byTurnId = Object.create(null);
                const replayCandidateTurnIds = [];
                diagnostics.turnHistory.forEach((turn, index) => {
                    const turnId = trimString(turn && turn.turnId);
                    if (!turnId) {
                        return;
                    }
                    const replayCandidate = Boolean(turn && turn.replayCandidate);
                    if (replayCandidate) {
                        replayCandidateTurnIds.push(turnId);
                    }
                    byTurnId[turnId] = {
                        index,
                        role: trimString(turn && turn.role),
                        at: trimString(turn && turn.at),
                        replayCandidate,
                        userMessageFingerprint: trimString(turn && turn.userMessageFingerprint),
                    };
                });
                return {
                    byTurnId,
                    replayCandidateTurnIds,
                };
            }

            function computeMemoryPolicySummary() {
                const byLayer = createEmptyMemoryPolicyLayerCounts();
                const byOperation = createEmptyMemoryPolicyOperationCounts();
                let executionCount = 0;
                let readonlyExecutions = 0;
                let mutatingExecutions = 0;
                let successCount = 0;
                let failureCount = 0;
                let lastEvent = null;

                diagnostics.capabilityEvents.forEach((event) => {
                    if (trimString(event.operationId) !== 'apply_memory_policy') {
                        return;
                    }
                    if (trimString(event.phase) !== 'result') {
                        return;
                    }

                    executionCount += 1;
                    const memoryLayer = normalizeMemoryPolicyLayerForDiagnostics(event.memoryLayer);
                    const memoryOperation = normalizeMemoryPolicyOperationForDiagnostics(event.memoryOperation);
                    const status = trimString(event.status);

                    if (memoryLayer) {
                        byLayer[memoryLayer] += 1;
                    }
                    if (memoryOperation) {
                        byOperation[memoryOperation] += 1;
                        if (isReadonlyMemoryPolicyOperation(memoryOperation)) {
                            readonlyExecutions += 1;
                        } else {
                            mutatingExecutions += 1;
                        }
                    }
                    if (status === 'success') {
                        successCount += 1;
                    } else if (status === 'failure' || status === 'failed' || status === 'error') {
                        failureCount += 1;
                    }

                    lastEvent = { ...event };
                });

                return {
                    executionCount,
                    readonlyExecutions,
                    mutatingExecutions,
                    successCount,
                    failureCount,
                    byLayer,
                    byOperation,
                    lastEvent,
                };
            }

            function createEmptyManagedConversationActionCounts() {
                return {
                    inspect_managed_memory_state: 0,
                    write_memory_note: 0,
                    record_memory_correction: 0,
                    evict_memory_note: 0,
                };
            }

            function createEmptyManagedConversationKeyCounts() {
                return {
                    note: 0,
                    correction: 0,
                };
            }

        function createEmptyManagedConversationContinuitySummary() {
            return {
                atomIds: [],
                atomCount: 0,
                readCount: 0,
                transitionCount: 0,
                resolvedKeyCounts: createEmptyManagedConversationKeyCounts(),
                resolvedFollowUpActionIds: [],
                resolvedFollowUpActionLabels: [],
                persistentKeyCounts: createEmptyManagedConversationKeyCounts(),
                persistentFollowUpActionIds: [],
                persistentFollowUpActionLabels: [],
                lastTransition: null,
            };
        }

            function incrementManagedConversationKeyCounts(counts, labels) {
                resolveStringArray(labels).forEach((label) => {
                    if (label === 'note' || label === 'correction') {
                        counts[label] += 1;
                    }
                });
            }

            function isManagedConversationActionId(actionId) {
                return MANAGED_CONVERSATION_ACTION_IDS.includes(trimString(actionId));
            }

            function hasManagedConversationKeyCounts(counts) {
                return Boolean(counts) && (
                    Number(counts.note) > 0
                    || Number(counts.correction) > 0
                );
            }

            function computeManagedConversationContinuitySummary(events, newestFirst = true) {
                const summary = createEmptyManagedConversationContinuitySummary();
                const sourceEvents = Array.isArray(events)
                    ? (newestFirst ? events.slice() : events.slice().reverse())
                    : [];
                const eventsByAtomId = Object.create(null);

                sourceEvents.forEach((event) => {
                    const atomId = trimString(event && event.atomId);
                    if (!atomId) {
                        return;
                    }
                    if (trimString(event && event.actionId) !== 'inspect_managed_memory_state') {
                        return;
                    }
                    if (trimString(event && event.phase) === 'request' || trimString(event && event.phase) === 'plan') {
                        return;
                    }
                    if (trimString(event && event.status) !== 'success') {
                        return;
                    }
                    if (!eventsByAtomId[atomId]) {
                        eventsByAtomId[atomId] = [];
                    }
                    eventsByAtomId[atomId].push(event);
                });

                summary.atomIds = Object.keys(eventsByAtomId);
                summary.atomCount = summary.atomIds.length;

                summary.atomIds.forEach((atomId) => {
                    const atomEvents = eventsByAtomId[atomId];
                    summary.readCount += atomEvents.length;
                    for (let index = 0; index < atomEvents.length - 1; index += 1) {
                        const newerEvent = atomEvents[index];
                        const olderEvent = atomEvents[index + 1];
                        const newerMissingManagedKeyLabels = resolveManagedConversationKeyLabels(
                            newerEvent && newerEvent.missingManagedKeyLabels
                        );
                        const olderMissingManagedKeyLabels = resolveManagedConversationKeyLabels(
                            olderEvent && olderEvent.missingManagedKeyLabels
                        );
                        const persistentKeyLabels = [];
                        const resolvedKeyLabels = [];
                        olderMissingManagedKeyLabels.forEach((label) => {
                            if (newerMissingManagedKeyLabels.includes(label)) {
                                persistentKeyLabels.push(label);
                                summary.persistentKeyCounts[label] += 1;
                                summary.transitionCount += 1;
                                return;
                            }
                            resolvedKeyLabels.push(label);
                            summary.resolvedKeyCounts[label] += 1;
                            summary.transitionCount += 1;
                        });
                        if (!summary.lastTransition && (resolvedKeyLabels.length > 0 || persistentKeyLabels.length > 0)) {
                            summary.lastTransition = buildManagedConversationLastTransition(
                                atomId,
                                newerEvent,
                                olderEvent,
                                resolvedKeyLabels,
                                persistentKeyLabels
                            );
                        }
                    }
                });

                summary.resolvedFollowUpActionIds = resolveManagedConversationFollowUpActionIdsFromKeyCounts(
                    summary.resolvedKeyCounts
                );
                summary.resolvedFollowUpActionLabels = resolveManagedConversationFollowUpActionLabels(
                    summary.resolvedFollowUpActionIds
                );
                summary.persistentFollowUpActionIds = resolveManagedConversationFollowUpActionIdsFromKeyCounts(
                    summary.persistentKeyCounts
                );
                summary.persistentFollowUpActionLabels = resolveManagedConversationFollowUpActionLabels(
                    summary.persistentFollowUpActionIds
                );

                return summary;
            }

            function computeManagedConversationSummary() {
                const byActionId = createEmptyManagedConversationActionCounts();
                const matchedKeyCounts = createEmptyManagedConversationKeyCounts();
                const missingKeyCounts = createEmptyManagedConversationKeyCounts();
                const continuitySummary = computeManagedConversationContinuitySummary(diagnostics.capabilityEvents, false);
                let executionCount = 0;
                let successCount = 0;
                let failureCount = 0;
                let lastEvent = null;

                diagnostics.capabilityEvents.forEach((event) => {
                    const actionId = trimString(event && event.actionId);
                    if (!isManagedConversationActionId(actionId) || trimString(event && event.phase) !== 'result') {
                        return;
                    }

                    executionCount += 1;
                    byActionId[actionId] += 1;
                    incrementManagedConversationKeyCounts(matchedKeyCounts, event && event.matchedManagedKeyLabels);
                    incrementManagedConversationKeyCounts(missingKeyCounts, event && event.missingManagedKeyLabels);

                    const status = trimString(event && event.status);
                    if (status === 'success') {
                        successCount += 1;
                    } else if (status === 'failure' || status === 'failed' || status === 'error') {
                        failureCount += 1;
                    }

                    lastEvent = { ...event };
                });

                return {
                    executionCount,
                    successCount,
                    failureCount,
                    byActionId,
                    matchedKeyCounts,
                    missingKeyCounts,
                    continuitySummary,
                    lastEvent,
                };
            }

            function computeManagedConversationActionStats() {
                const statsByActionId = Object.create(null);
                MANAGED_CONVERSATION_ACTION_IDS.forEach((actionId) => {
                    statsByActionId[actionId] = {
                        actionId,
                        requestCount: 0,
                        resultCount: 0,
                        successCount: 0,
                        failureCount: 0,
                        pendingCount: 0,
                        unknownCount: 0,
                        targetKeyCounts: createEmptyManagedConversationKeyCounts(),
                        matchedKeyCounts: createEmptyManagedConversationKeyCounts(),
                        missingKeyCounts: createEmptyManagedConversationKeyCounts(),
                        latestStatus: '',
                        latestAt: '',
                    };
                });

                diagnostics.capabilityEvents.forEach((event) => {
                    const actionId = trimString(event && event.actionId);
                    if (!isManagedConversationActionId(actionId)) {
                        return;
                    }

                    const phase = trimString(event && event.phase) || 'event';
                    const status = trimString(event && event.status) || 'unknown';
                    const stats = statsByActionId[actionId];

                    if (phase === 'request') {
                        stats.requestCount += 1;
                    } else if (phase === 'result') {
                        stats.resultCount += 1;
                    }

                    if (status === 'success') {
                        stats.successCount += 1;
                    } else if (status === 'failure' || status === 'failed' || status === 'error') {
                        stats.failureCount += 1;
                    } else if (status === 'pending') {
                        stats.pendingCount += 1;
                    } else {
                        stats.unknownCount += 1;
                    }

                    incrementManagedConversationKeyCounts(stats.targetKeyCounts, event && event.managedKeyLabels);
                    incrementManagedConversationKeyCounts(stats.matchedKeyCounts, event && event.matchedManagedKeyLabels);
                    incrementManagedConversationKeyCounts(stats.missingKeyCounts, event && event.missingManagedKeyLabels);
                    stats.latestStatus = status;
                    stats.latestAt = trimString(event && event.at);
                });

                const actionIds = MANAGED_CONVERSATION_ACTION_IDS.filter((actionId) => {
                    const stats = statsByActionId[actionId];
                    return stats.requestCount > 0 || stats.resultCount > 0;
                });

                return {
                    actionIds,
                    byActionId: actionIds.reduce((accumulator, actionId) => {
                        const stats = statsByActionId[actionId];
                        accumulator[actionId] = {
                            actionId: stats.actionId,
                            requestCount: stats.requestCount,
                            resultCount: stats.resultCount,
                            successCount: stats.successCount,
                            failureCount: stats.failureCount,
                            pendingCount: stats.pendingCount,
                            unknownCount: stats.unknownCount,
                            targetKeyCounts: { ...stats.targetKeyCounts },
                            matchedKeyCounts: { ...stats.matchedKeyCounts },
                            missingKeyCounts: { ...stats.missingKeyCounts },
                            latestStatus: stats.latestStatus,
                            latestAt: stats.latestAt,
                        };
                        return accumulator;
                    }, Object.create(null)),
                };
            }

            function getDiagnosticsSnapshot() {
                const turnCounts = diagnostics.turnHistory.reduce(
                    (accumulator, turn) => {
                        if (turn.role === 'user') {
                            accumulator.user += 1;
                        } else if (turn.role === 'assistant') {
                            accumulator.assistant += 1;
                        } else if (turn.role === 'system') {
                            accumulator.system += 1;
                        }
                        return accumulator;
                    },
                    { user: 0, assistant: 0, system: 0 }
                );
                const latestCapabilityEvent = diagnostics.capabilityEvents.length > 0
                    ? diagnostics.capabilityEvents[diagnostics.capabilityEvents.length - 1]
                    : null;
                const memoryPolicySummary = computeMemoryPolicySummary();
                const managedConversationSummary = computeManagedConversationSummary();
                return {
                    generatedAt: nowIso(),
                    conversationRequests: diagnostics.conversationRequests,
                    replayCandidateTurns: diagnostics.replayCandidateTurns,
                    turnCounts: {
                        ...turnCounts,
                        total: diagnostics.turnHistory.length,
                    },
                    turns: diagnostics.turnHistory.map((turn) => ({ ...turn })),
                    capabilityEvents: diagnostics.capabilityEvents.map((event) => cloneCapabilityEvent(event)),
                    lastCapabilityEvent: latestCapabilityEvent ? cloneCapabilityEvent(latestCapabilityEvent) : null,
                    lastConversation: diagnostics.lastConversation
                        ? { ...diagnostics.lastConversation }
                        : null,
                    lastFoundationReadiness: diagnostics.lastFoundationReadiness
                        ? { ...diagnostics.lastFoundationReadiness }
                        : null,
                    lastFailure: diagnostics.lastFailure
                        ? { ...diagnostics.lastFailure }
                        : null,
                    memoryPolicySummary: {
                        ...memoryPolicySummary,
                        byLayer: { ...memoryPolicySummary.byLayer },
                        byOperation: { ...memoryPolicySummary.byOperation },
                        lastEvent: memoryPolicySummary.lastEvent
                            ? { ...memoryPolicySummary.lastEvent }
                            : null,
                    },
                    managedConversationSummary: {
                        ...managedConversationSummary,
                        byActionId: { ...managedConversationSummary.byActionId },
                        matchedKeyCounts: { ...managedConversationSummary.matchedKeyCounts },
                        missingKeyCounts: { ...managedConversationSummary.missingKeyCounts },
                        continuitySummary: {
                            ...managedConversationSummary.continuitySummary,
                            atomIds: managedConversationSummary.continuitySummary.atomIds.slice(),
                            resolvedKeyCounts: { ...managedConversationSummary.continuitySummary.resolvedKeyCounts },
                            resolvedFollowUpActionIds: managedConversationSummary.continuitySummary.resolvedFollowUpActionIds.slice(),
                            resolvedFollowUpActionLabels: managedConversationSummary.continuitySummary.resolvedFollowUpActionLabels.slice(),
                            persistentKeyCounts: { ...managedConversationSummary.continuitySummary.persistentKeyCounts },
                            persistentFollowUpActionIds: managedConversationSummary.continuitySummary.persistentFollowUpActionIds.slice(),
                            persistentFollowUpActionLabels: managedConversationSummary.continuitySummary.persistentFollowUpActionLabels.slice(),
                            lastTransition: managedConversationSummary.continuitySummary.lastTransition
                                ? {
                                    ...managedConversationSummary.continuitySummary.lastTransition,
                                    keyLabels: managedConversationSummary.continuitySummary.lastTransition.keyLabels.slice(),
                                    resolvedKeyLabels: managedConversationSummary.continuitySummary.lastTransition.resolvedKeyLabels.slice(),
                                    persistentKeyLabels: managedConversationSummary.continuitySummary.lastTransition.persistentKeyLabels.slice(),
                                    followUpActionIds: managedConversationSummary.continuitySummary.lastTransition.followUpActionIds.slice(),
                                    followUpActionLabels: managedConversationSummary.continuitySummary.lastTransition.followUpActionLabels.slice(),
                                    resolvedFollowUpActionIds: managedConversationSummary.continuitySummary.lastTransition.resolvedFollowUpActionIds.slice(),
                                    resolvedFollowUpActionLabels: managedConversationSummary.continuitySummary.lastTransition.resolvedFollowUpActionLabels.slice(),
                                    persistentFollowUpActionIds: managedConversationSummary.continuitySummary.lastTransition.persistentFollowUpActionIds.slice(),
                                    persistentFollowUpActionLabels: managedConversationSummary.continuitySummary.lastTransition.persistentFollowUpActionLabels.slice(),
                                }
                                : null,
                        },
                        lastEvent: managedConversationSummary.lastEvent
                            ? { ...managedConversationSummary.lastEvent }
                            : null,
                    },
                    pathState: {
                        visible: state.pathVisible,
                        fullscreen: state.pathFullscreen,
                        atomId: resolveCurrentPathAtomId(),
                    },
                    latestFocusAtomId: state.latestFocusAtomId,
                    latestKnowledgePoints: Array.isArray(state.latestKnowledgePoints)
                        ? state.latestKnowledgePoints.length
                        : 0,
                };
            }

            function getDiagnosticsTrendSnapshot() {
                const operationStats = computeCapabilityOperationStats();
                const userTurnCount = diagnostics.turnHistory.reduce(
                    (count, turn) => (turn.role === 'user' ? count + 1 : count),
                    0
                );
                const replayCandidateRate = userTurnCount > 0
                    ? Number((diagnostics.replayCandidateTurns / userTurnCount).toFixed(4))
                    : 0;
                return {
                    generatedAt: nowIso(),
                    window: {
                        turns: diagnostics.turnHistory.length,
                        capabilityEvents: diagnostics.capabilityEvents.length,
                    },
                    conversationRequests: diagnostics.conversationRequests,
                    userTurns: userTurnCount,
                    replayCandidateTurns: diagnostics.replayCandidateTurns,
                    replayCandidateRate,
                    operationStats: operationStats.map((stats) => ({
                        operationId: stats.operationId,
                        requestCount: stats.requestCount,
                        resultCount: stats.resultCount,
                        successCount: stats.successCount,
                        failureCount: stats.failureCount,
                        pendingCount: stats.pendingCount,
                        unknownCount: stats.unknownCount,
                        averageDurationMs: stats.averageDurationMs,
                        latestStatus: stats.latestStatus,
                        latestAt: stats.latestAt,
                    })),
                    lastFailure: diagnostics.lastFailure
                        ? { ...diagnostics.lastFailure }
                        : null,
                };
            }

            function getDiagnosticsIndexSnapshot() {
                const capabilityOperationStats = computeCapabilityOperationStats();
                const capabilityOperationIds = capabilityOperationStats.map((stats) => stats.operationId);
                const byOperationId = capabilityOperationStats.reduce((accumulator, stats) => {
                    accumulator[stats.operationId] = {
                        operationId: stats.operationId,
                        eventIds: stats.eventIds.slice(),
                        requestCount: stats.requestCount,
                        resultCount: stats.resultCount,
                        successCount: stats.successCount,
                        failureCount: stats.failureCount,
                        pendingCount: stats.pendingCount,
                        unknownCount: stats.unknownCount,
                        averageDurationMs: stats.averageDurationMs,
                        latestStatus: stats.latestStatus,
                        latestAt: stats.latestAt,
                    };
                    return accumulator;
                }, Object.create(null));
                const managedConversationActionStats = computeManagedConversationActionStats();
                const managedConversationSummary = computeManagedConversationSummary();

                return {
                    generatedAt: nowIso(),
                    turnIndex: computeTurnIndex(),
                    capabilityIndex: {
                        operationIds: capabilityOperationIds,
                        byOperationId,
                    },
                    managedConversationIndex: {
                        actionIds: managedConversationActionStats.actionIds.slice(),
                        byActionId: managedConversationActionStats.actionIds.reduce((accumulator, actionId) => {
                            const stats = managedConversationActionStats.byActionId[actionId];
                            accumulator[actionId] = {
                                actionId: stats.actionId,
                                requestCount: stats.requestCount,
                                resultCount: stats.resultCount,
                                successCount: stats.successCount,
                                failureCount: stats.failureCount,
                                pendingCount: stats.pendingCount,
                                unknownCount: stats.unknownCount,
                                targetKeyCounts: { ...stats.targetKeyCounts },
                                matchedKeyCounts: { ...stats.matchedKeyCounts },
                                missingKeyCounts: { ...stats.missingKeyCounts },
                                latestStatus: stats.latestStatus,
                                latestAt: stats.latestAt,
                            };
                            return accumulator;
                        }, Object.create(null)),
                        continuitySummary: {
                            ...managedConversationSummary.continuitySummary,
                            atomIds: managedConversationSummary.continuitySummary.atomIds.slice(),
                            resolvedKeyCounts: { ...managedConversationSummary.continuitySummary.resolvedKeyCounts },
                            resolvedFollowUpActionIds: managedConversationSummary.continuitySummary.resolvedFollowUpActionIds.slice(),
                            resolvedFollowUpActionLabels: managedConversationSummary.continuitySummary.resolvedFollowUpActionLabels.slice(),
                            persistentKeyCounts: { ...managedConversationSummary.continuitySummary.persistentKeyCounts },
                            persistentFollowUpActionIds: managedConversationSummary.continuitySummary.persistentFollowUpActionIds.slice(),
                            persistentFollowUpActionLabels: managedConversationSummary.continuitySummary.persistentFollowUpActionLabels.slice(),
                            lastTransition: managedConversationSummary.continuitySummary.lastTransition
                                ? {
                                    ...managedConversationSummary.continuitySummary.lastTransition,
                                    keyLabels: managedConversationSummary.continuitySummary.lastTransition.keyLabels.slice(),
                                    resolvedKeyLabels: managedConversationSummary.continuitySummary.lastTransition.resolvedKeyLabels.slice(),
                                    persistentKeyLabels: managedConversationSummary.continuitySummary.lastTransition.persistentKeyLabels.slice(),
                                    followUpActionIds: managedConversationSummary.continuitySummary.lastTransition.followUpActionIds.slice(),
                                    followUpActionLabels: managedConversationSummary.continuitySummary.lastTransition.followUpActionLabels.slice(),
                                    resolvedFollowUpActionIds: managedConversationSummary.continuitySummary.lastTransition.resolvedFollowUpActionIds.slice(),
                                    resolvedFollowUpActionLabels: managedConversationSummary.continuitySummary.lastTransition.resolvedFollowUpActionLabels.slice(),
                                    persistentFollowUpActionIds: managedConversationSummary.continuitySummary.lastTransition.persistentFollowUpActionIds.slice(),
                                    persistentFollowUpActionLabels: managedConversationSummary.continuitySummary.lastTransition.persistentFollowUpActionLabels.slice(),
                                }
                                : null,
                        },
                    },
                };
            }

            function exportDiagnosticsReport(options = {}) {
                const format = trimString(options && options.format).toLowerCase();
                const runbookResolution = resolvePrimaryRunbookAction();
                const report = {
                    generatedAt: nowIso(),
                    snapshot: getDiagnosticsSnapshot(),
                    trend: getDiagnosticsTrendSnapshot(),
                    index: getDiagnosticsIndexSnapshot(),
                    runbookLinks: cloneRunbookLinks(),
                    primaryRunbookAction: runbookResolution.primaryRunbookAction,
                    runbookActions: runbookResolution.runbookActions,
                };
                if (format === 'json') {
                    return JSON.stringify(report, null, 2);
                }
                return report;
            }

            function resolveCapabilityResultPreviewData(presentation, result) {
                const normalizedPresentation = trimString(presentation);
                if (!normalizedPresentation) {
                    return null;
                }
                if (normalizedPresentation === 'learning_path_card') {
                    return {
                        kind: 'learning_path',
                        masteryPathCount: Array.isArray(result && result.masteryPaths) ? result.masteryPaths.length : 0,
                        divergencePathCount: Array.isArray(result && result.divergencePaths) ? result.divergencePaths.length : 0,
                    };
                }
                if (normalizedPresentation === 'study_session_card') {
                    const summary = result && result.summary && typeof result.summary === 'object'
                        ? result.summary
                        : {};
                    return {
                        kind: 'study_session',
                        totalActions: Number.isFinite(Number(summary.totalActions)) ? Number(summary.totalActions) : 0,
                        totalEstimatedMinutes: Number.isFinite(Number(summary.totalEstimatedMinutes))
                            ? Number(summary.totalEstimatedMinutes)
                            : 0,
                    };
                }
                if (normalizedPresentation === 'query_trace_card') {
                    const retrievalModes = Array.isArray(result && result.trace && result.trace.retrievalModes)
                        ? result.trace.retrievalModes
                        : [];
                    return {
                        kind: 'query_trace',
                        itemsCount: Array.isArray(result && result.items) ? result.items.length : 0,
                        retrievalModesCount: retrievalModes.length,
                    };
                }
                if (normalizedPresentation === 'ingest_guardrail_card') {
                    const summary = result && result.summary && typeof result.summary === 'object'
                        ? result.summary
                        : {};
                    return {
                        kind: 'ingest_guardrail',
                        status: trimString(result && result.status) || trimString(summary.status) || 'unknown',
                        failedGates: Number.isFinite(Number(summary.failedGates)) ? Number(summary.failedGates) : 0,
                        totalGates: Number.isFinite(Number(summary.totalGates)) ? Number(summary.totalGates) : 0,
                    };
                }
                if (normalizedPresentation === 'session_history_card') {
                    const summary = result && result.summary && typeof result.summary === 'object'
                        ? result.summary
                        : {};
                    return {
                        kind: 'session_history',
                        totalRecords: Number.isFinite(Number(summary.totalRecords)) ? Number(summary.totalRecords) : 0,
                        totalExecutedActions: Number.isFinite(Number(summary.totalExecutedActions))
                            ? Number(summary.totalExecutedActions)
                            : 0,
                    };
                }
                if (normalizedPresentation === 'mastery_misconceptions_card') {
                    const summary = result && result.summary && typeof result.summary === 'object'
                        ? result.summary
                        : {};
                    return {
                        kind: 'mastery_misconceptions',
                        trackedTags: Number.isFinite(Number(summary.trackedTags)) ? Number(summary.trackedTags) : 0,
                        totalObservations: Number.isFinite(Number(summary.totalObservations))
                            ? Number(summary.totalObservations)
                            : 0,
                    };
                }
                if (normalizedPresentation === 'learning_quality_snapshot_card') {
                    const snapshot = result && result.snapshot && typeof result.snapshot === 'object'
                        ? result.snapshot
                        : {};
                    return {
                        kind: 'learning_quality',
                        retestPassRatePct: Number.isFinite(Number(snapshot.retestPassRatePct))
                            ? Number(Number(snapshot.retestPassRatePct).toFixed(1))
                            : 0,
                        misconceptionRecurrenceRatePct: Number.isFinite(Number(snapshot.misconceptionRecurrenceRatePct))
                            ? Number(Number(snapshot.misconceptionRecurrenceRatePct).toFixed(1))
                            : 0,
                    };
                }
                if (normalizedPresentation === 'memory_policy_card') {
                    return {
                        kind: 'memory_policy',
                        layer: trimString(result && result.layer) || 'session',
                        operation: trimString(result && result.operation) || 'snapshot',
                        entriesCount: Array.isArray(result && result.entries) ? result.entries.length : 0,
                        mutatedCount: Number.isFinite(Number(result && result.mutatedCount))
                            ? Number(result && result.mutatedCount)
                            : Array.isArray(result && result.entries) ? result.entries.length : 0,
                        evictedCount: Number.isFinite(Number(result && result.evictedCount)) ? Number(result && result.evictedCount) : 0,
                    };
                }
                if (normalizedPresentation === 'tutor_action_card' || normalizedPresentation === 'assistant_message') {
                    return {
                        kind: 'message',
                        message: trimString(result && result.message),
                    };
                }
                return null;
            }

            async function persistDiagnosticsReport(options = {}) {
                const endpoint = trimString(options && options.endpoint)
                    || '/api/knowledge/operator/agent-workspace-diagnostics/report';
                const source = trimString(options && options.source) || 'agent-workspace-runtime';
                const report = exportDiagnosticsReport();
                return requestJson(endpoint, {
                    source,
                    report,
                });
            }

            function resolveUserId() {
                const fallback = trimString(options.defaultUserId) || 'agent_user_default';
                const candidate = trimString(dom.userIdInput && dom.userIdInput.value);
                return candidate || fallback;
            }

            function appendMessage(role, text, meta = {}) {
                if (!dom.messages) {
                    return;
                }
                const content = trimString(text);
                if (!content) {
                    return;
                }
                const item = document.createElement('div');
                item.className = `agent-workspace-message agent-workspace-message--${role}`;
                item.textContent = content;
                dom.messages.appendChild(item);
                dom.messages.scrollTop = dom.messages.scrollHeight;
                recordTurn(role, content, meta);
            }

            function setBusy(nextBusy) {
                state.busy = Boolean(nextBusy);
                if (dom.sendButton) {
                    dom.sendButton.disabled = state.busy;
                }
                if (dom.form) {
                    dom.form.classList.toggle('is-busy', state.busy);
                }
            }

            function findKnowledgePoint(atomId) {
                const normalized = trimString(atomId);
                if (!normalized) {
                    return null;
                }
                return state.latestKnowledgePoints.find((point) => trimString(point.atomId) === normalized) || null;
            }

            function focusAtom(atomId) {
                const normalizedAtomId = trimString(atomId);
                if (!normalizedAtomId) {
                    throw new Error('Missing atomId for focus action.');
                }

                if (typeof globalScope.focusOnNode === 'function') {
                    globalScope.focusOnNode(normalizedAtomId);
                } else if (typeof globalScope.enterFocusMode === 'function') {
                    globalScope.enterFocusMode(normalizedAtomId);
                } else {
                    throw new Error('Focus runtime is unavailable. Ensure app.js is loaded.');
                }
                state.latestFocusAtomId = normalizedAtomId;
                appendMessage(
                    'system',
                    getI18nText('agentWorkspace.messages.focusModeOpened', `Focus mode opened for ${normalizedAtomId}.`, {
                        atomId: normalizedAtomId,
                    })
                );
                renderKnowledgePoints(state.latestKnowledgePoints);
            }

            function ensurePathDockVisible() {
                const body = document.body;
                const pathContainer = document.getElementById('path-container');
                const graphWrapper = document.getElementById('graph-wrapper');
                if (!pathContainer) {
                    throw new Error('Path container is unavailable.');
                }
                body.classList.add(BODY_CLASS_PATH_VISIBLE);
                pathContainer.classList.add(PATH_DOCK_CLASS);
                pathContainer.style.display = 'block';
                if (graphWrapper) {
                    graphWrapper.style.display = 'block';
                }
                state.pathVisible = true;
            }

            function resolveCurrentPathAtomId() {
                const runtimeTarget = trimString(
                    globalScope.pathApp
                    && typeof globalScope.pathApp === 'object'
                    && globalScope.pathApp.currentTargetId
                );
                if (runtimeTarget) {
                    state.latestPathAtomId = runtimeTarget;
                    return runtimeTarget;
                }
                return trimString(state.latestPathAtomId);
            }

            function hidePathDock() {
                const body = document.body;
                const pathContainer = document.getElementById('path-container');
                body.classList.remove(BODY_CLASS_PATH_VISIBLE);
                body.classList.remove(BODY_CLASS_PATH_FULLSCREEN);
                if (pathContainer) {
                    pathContainer.classList.remove(PATH_DOCK_CLASS);
                    pathContainer.style.display = 'none';
                }
                state.pathVisible = false;
                state.pathFullscreen = false;
                state.latestPathAtomId = '';
                refreshToolbarButtons();
                renderKnowledgePoints(state.latestKnowledgePoints);
                if (globalScope.pathApp && typeof globalScope.pathApp.requestBridgeWindowVisibility === 'function') {
                    void globalScope.pathApp.requestBridgeWindowVisibility(false, {
                        waitMs: 900,
                        reason: 'agent-workspace-hide-path-dock',
                    });
                }
                globalScope.dispatchEvent(new Event('resize'));
            }

            function refreshToolbarButtons() {
                if (dom.closePathButton) {
                    dom.closePathButton.disabled = !state.pathVisible;
                }
                if (dom.pathFullscreenButton) {
                    dom.pathFullscreenButton.disabled = !state.pathVisible;
                    dom.pathFullscreenButton.textContent = state.pathFullscreen
                        ? getI18nText('agentWorkspace.actions.exitPathFullscreen', 'Exit Path Fullscreen')
                        : getI18nText('agentWorkspace.actions.pathFullscreen', 'Path Fullscreen');
                }
                if (dom.foundationReadinessButton) {
                    dom.foundationReadinessButton.textContent = getI18nText(
                        'agentWorkspace.actions.openFoundationReadiness',
                        'Foundation Readiness'
                    );
                }
            }

            function togglePathFullscreen() {
                if (!state.pathVisible) {
                    return;
                }
                const body = document.body;
                state.pathFullscreen = !state.pathFullscreen;
                body.classList.toggle(BODY_CLASS_PATH_FULLSCREEN, state.pathFullscreen);
                refreshToolbarButtons();
                renderKnowledgePoints(state.latestKnowledgePoints);
                globalScope.dispatchEvent(new Event('resize'));
            }

            function resolvePathAtomId(preferredAtomId) {
                const preferred = trimString(preferredAtomId);
                if (preferred) {
                    return preferred;
                }
                if (trimString(state.latestFocusAtomId)) {
                    return state.latestFocusAtomId;
                }
                const firstPoint = state.latestKnowledgePoints[0];
                return trimString(firstPoint && firstPoint.atomId);
            }

            function openLearningPathDock(preferredAtomId) {
                const atomId = resolvePathAtomId(preferredAtomId);
                ensurePathDockVisible();
                refreshToolbarButtons();
                if (!globalScope.pathApp || typeof globalScope.pathApp !== 'object') {
                    const fallbackButton = document.getElementById('btn-path-mode');
                    if (fallbackButton && typeof fallbackButton.click === 'function') {
                        fallbackButton.click();
                        return;
                    }
                    throw new Error('Path runtime is unavailable. Ensure path_app.js is loaded.');
                }

                if (!globalScope.pathApp.uiInitialized) {
                    globalScope.pathApp.init(atomId || null);
                    globalScope.pathApp.currentTargetId = atomId || '';
                } else if (atomId && typeof globalScope.pathApp.switchCentral === 'function') {
                    globalScope.pathApp.switchCentral(atomId);
                    globalScope.pathApp.currentTargetId = atomId;
                    if (typeof globalScope.pathApp.triggerUpdate === 'function') {
                        globalScope.pathApp.triggerUpdate();
                    }
                } else if (typeof globalScope.pathApp.triggerUpdate === 'function') {
                    globalScope.pathApp.triggerUpdate();
                }

                if (typeof globalScope.pathApp.requestBridgeWindowVisibility === 'function') {
                    void globalScope.pathApp.requestBridgeWindowVisibility(true, {
                        waitMs: 1200,
                        reason: 'agent-workspace-open-path-dock',
                    });
                }
                if (atomId) {
                    state.latestFocusAtomId = atomId;
                    state.latestPathAtomId = atomId;
                }
                appendMessage(
                    'system',
                    getI18nText('agentWorkspace.messages.learningPathOpened', `Learning path opened${atomId ? ` for ${atomId}` : ''}.`, {
                        atomId: atomId || '',
                    })
                );
                renderKnowledgePoints(state.latestKnowledgePoints);
                globalScope.dispatchEvent(new Event('resize'));
            }

            function hydrateTutorOperationPlan(operationPlan) {
                const normalizedOperationId = trimString(operationPlan && operationPlan.operationId);
                if (normalizedOperationId !== 'execute_tutor_action') {
                    return operationPlan;
                }
                const body = operationPlan && operationPlan.body && typeof operationPlan.body === 'object'
                    ? operationPlan.body
                    : {};
                const actionKind = trimString(body.actionKind);
                if (actionKind !== 'analyze_answer') {
                    return operationPlan;
                }
                const existingAnswer = trimString(body.answer);
                if (existingAnswer) {
                    return operationPlan;
                }
                const atomId = trimString(body.atomId);
                const promptText = getI18nText(
                    'agentWorkspace.messages.analyzeAnswerPrompt',
                    `Enter learner answer to analyze for ${atomId || 'target atom'}:`,
                    { atomId: atomId || 'target atom' }
                );
                const promptFn = globalScope && typeof globalScope.prompt === 'function'
                    ? globalScope.prompt.bind(globalScope)
                    : null;
                const collectedAnswer = promptFn ? trimString(promptFn(promptText) || '') : '';
                if (!collectedAnswer) {
                    throw new Error(
                        getI18nText(
                            'agentWorkspace.messages.analyzeAnswerRequired',
                            'Analyze answer requires a non-empty learner answer.'
                        )
                    );
                }
                return {
                    ...operationPlan,
                    body: {
                        ...body,
                        answer: collectedAnswer,
                    },
                };
            }

            function hydrateMemoryPolicyOperationPlan(operationPlan) {
                const normalizedOperationId = trimString(operationPlan && operationPlan.operationId);
                if (normalizedOperationId !== 'apply_memory_policy') {
                    return operationPlan;
                }
                const body = operationPlan && operationPlan.body && typeof operationPlan.body === 'object'
                    ? operationPlan.body
                    : {};
                const operation = trimString(body.operation);
                if (operation !== 'write') {
                    return operationPlan;
                }
                const existingEntries = Array.isArray(body.entries) ? body.entries : [];
                if (existingEntries.length > 0) {
                    return operationPlan;
                }
                const promptConfig = operationPlan && operationPlan.promptConfig && typeof operationPlan.promptConfig === 'object'
                    ? operationPlan.promptConfig
                    : {};
                if (trimString(promptConfig.kind) !== 'memory_write') {
                    throw new Error('Memory write operation requires prompt configuration or request.memoryValue.');
                }
                const promptFn = globalScope && typeof globalScope.prompt === 'function'
                    ? globalScope.prompt.bind(globalScope)
                    : null;
                const promptMessage = trimString(promptConfig.message)
                    || getI18nText(
                        'agentWorkspace.messages.memoryWritePrompt',
                        'Enter memory note to store:',
                        {}
                    );
                const collectedValue = promptFn ? trimString(promptFn(promptMessage) || '') : '';
                if (!collectedValue) {
                    throw new Error(
                        getI18nText(
                            'agentWorkspace.messages.memoryWriteRequired',
                            'Memory write requires a non-empty note.'
                        )
                    );
                }
                const entryTemplate = promptConfig.entryTemplate && typeof promptConfig.entryTemplate === 'object'
                    ? promptConfig.entryTemplate
                    : {};
                const nowIso = new Date().toISOString();
                return {
                    ...operationPlan,
                    body: {
                        ...body,
                        entries: [
                            {
                                key: trimString(entryTemplate.key) || `conversation_note:${Date.now()}`,
                                value: collectedValue,
                                tags: resolveStringArray(entryTemplate.tags),
                                references: resolveStringArray(entryTemplate.references),
                                createdAt: nowIso,
                                updatedAt: nowIso,
                            },
                        ],
                    },
                };
            }

            async function executeCapability(capability, knowledgePoint) {
                const actionId = trimString(capability && capability.actionId);
                const request = capability && capability.request && typeof capability.request === 'object'
                    ? capability.request
                    : {};
                const atomId = trimString(request.atomId) || trimString(knowledgePoint && knowledgePoint.atomId);
                if (actionId === 'open_focus_mode') {
                    focusAtom(atomId);
                    recordCapabilityEvent({
                        phase: 'frontend',
                        status: 'success',
                        actionId,
                        atomId,
                    });
                    return;
                }

                let operationPlan;
                try {
                    operationPlan = resolveOperationPlan(capability);
                    operationPlan = hydrateTutorOperationPlan(operationPlan);
                    operationPlan = hydrateMemoryPolicyOperationPlan(operationPlan);
                } catch (error) {
                    const errorMessage = trimString(error && error.message);
                    recordCapabilityEvent({
                        phase: 'plan',
                        status: 'failed',
                        actionId,
                        atomId,
                        error: errorMessage,
                    });
                    recordFailure('executeCapability:plan', errorMessage);
                    appendMessage(
                        'assistant',
                        getI18nText('agentWorkspace.messages.operationPlanFailed', 'Unable to build operation request.', {})
                    );
                    throw error;
                }

                const operationStartedAt = Date.now();
                const plannedMemoryLayer = operationPlan.operationId === 'apply_memory_policy'
                    ? normalizeMemoryPolicyLayerForDiagnostics(operationPlan.body && operationPlan.body.layer)
                    : '';
                const plannedMemoryOperation = operationPlan.operationId === 'apply_memory_policy'
                    ? normalizeMemoryPolicyOperationForDiagnostics(operationPlan.body && operationPlan.body.operation)
                    : '';
                const plannedManagedKeyLabels = operationPlan.operationId === 'apply_memory_policy'
                    ? resolveManagedConversationKeyLabels([
                        ...resolveStringArray(operationPlan.body && operationPlan.body.matchKeys),
                        ...resolveStringArray(operationPlan.body && operationPlan.body.keys),
                        ...(
                            Array.isArray(operationPlan.body && operationPlan.body.entries)
                                ? operationPlan.body.entries
                                    .map((entry) => trimString(entry && entry.key))
                                    .filter((key) => key.length > 0)
                                : []
                        ),
                    ])
                    : [];
                recordCapabilityEvent({
                    phase: 'request',
                    status: 'pending',
                    actionId,
                    atomId,
                    operationId: operationPlan.operationId,
                    resultPresentation: operationPlan.resultPresentation,
                    memoryLayer: plannedMemoryLayer,
                    memoryOperation: plannedMemoryOperation,
                    managedKeyLabels: plannedManagedKeyLabels,
                });

                let result;
                try {
                    result = await requestJson(operationPlan.endpoint, operationPlan.body);
                } catch (error) {
                    const errorMessage = trimString(error && error.message);
                    recordCapabilityEvent({
                        phase: 'result',
                        status: 'failed',
                        actionId,
                        atomId,
                        operationId: operationPlan.operationId,
                        resultPresentation: operationPlan.resultPresentation,
                        durationMs: Date.now() - operationStartedAt,
                        error: errorMessage,
                        memoryLayer: plannedMemoryLayer,
                        memoryOperation: plannedMemoryOperation,
                        managedKeyLabels: plannedManagedKeyLabels,
                    });
                    recordFailure('executeCapability:request', errorMessage);
                    throw error;
                }
                const resultFilter = result && result.filter && typeof result.filter === 'object'
                    ? result.filter
                    : {};
                recordCapabilityEvent({
                    phase: 'result',
                    status: 'success',
                    actionId,
                    atomId,
                    operationId: operationPlan.operationId,
                    resultPresentation: operationPlan.resultPresentation,
                    durationMs: Date.now() - operationStartedAt,
                    memoryLayer: operationPlan.operationId === 'apply_memory_policy'
                        ? normalizeMemoryPolicyLayerForDiagnostics(result && result.layer) || plannedMemoryLayer
                        : '',
                    memoryOperation: operationPlan.operationId === 'apply_memory_policy'
                        ? normalizeMemoryPolicyOperationForDiagnostics(result && result.operation) || plannedMemoryOperation
                        : '',
                    managedKeyLabels: plannedManagedKeyLabels,
                    matchedManagedKeyLabels: resolveManagedConversationKeyLabels(resultFilter && resultFilter.matchedKeys),
                    missingManagedKeyLabels: resolveManagedConversationKeyLabels(resultFilter && resultFilter.missingKeys),
                    resultPreview: resolveCapabilityResultPreviewData(operationPlan.resultPresentation, result),
                });
                const presentation = trimString(operationPlan.resultPresentation);

                if (presentation === 'learning_path_card') {
                    const masteryPathCount = Array.isArray(result.masteryPaths) ? result.masteryPaths.length : 0;
                    const divergencePathCount = Array.isArray(result.divergencePaths) ? result.divergencePaths.length : 0;
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.learningPathBuilt',
                            `Learning path generated (mastery ${masteryPathCount}, divergence ${divergencePathCount}).`,
                            { masteryPathCount, divergencePathCount }
                        )
                    );
                    openLearningPathDock(atomId);
                    return;
                }

                if (presentation === 'tutor_action_card') {
                    const tutorMessage = trimString(result && result.message);
                    appendMessage(
                        'assistant',
                        tutorMessage || getI18nText('agentWorkspace.messages.tutorActionCompleted', 'Tutor action completed.', {})
                    );
                    return;
                }

                if (presentation === 'study_session_card') {
                    const summary = result && result.summary && typeof result.summary === 'object'
                        ? result.summary
                        : {};
                    const totalActions = Number(summary.totalActions);
                    const totalEstimatedMinutes = Number(summary.totalEstimatedMinutes);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.studySessionBuilt',
                            `Study session built (${Number.isFinite(totalActions) ? totalActions : 0} actions, ${Number.isFinite(totalEstimatedMinutes) ? totalEstimatedMinutes : 0} min).`,
                            {
                                totalActions: Number.isFinite(totalActions) ? totalActions : 0,
                                totalEstimatedMinutes: Number.isFinite(totalEstimatedMinutes) ? totalEstimatedMinutes : 0,
                            }
                        )
                    );
                    return;
                }

                if (presentation === 'query_trace_card') {
                    const trace = result && result.trace && typeof result.trace === 'object'
                        ? result.trace
                        : {};
                    const itemsCount = Array.isArray(result && result.items) ? result.items.length : 0;
                    const retrievalModes = Array.isArray(trace.retrievalModes) ? trace.retrievalModes.join(', ') : '';
                    const vectorAcceleration = trace.vectorAcceleration && typeof trace.vectorAcceleration === 'object'
                        ? trace.vectorAcceleration
                        : null;
                    const vectorMode = vectorAcceleration ? trimString(vectorAcceleration.mode) : '';
                    const vectorStatus = vectorAcceleration ? trimString(vectorAcceleration.status) : '';
                    const vectorCandidateCount = vectorAcceleration ? Number(vectorAcceleration.candidateCount) : NaN;
                    const vectorAccelerationSummary = vectorMode && vectorStatus
                        ? `${vectorMode}/${vectorStatus}${Number.isFinite(vectorCandidateCount) ? `/${vectorCandidateCount}` : ''}`
                        : 'n/a';
                    const latencyMs = Number(trace.latencyMs);
                    const evidenceCoverageRatio = Number(trace.evidenceCoverageRatio);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.queryTraceLoaded',
                            `Query trace loaded (${itemsCount} hits, modes ${retrievalModes || 'n/a'}, vector ${vectorAccelerationSummary}, latency ${Number.isFinite(latencyMs) ? latencyMs : 0} ms, evidence ${Number.isFinite(evidenceCoverageRatio) ? evidenceCoverageRatio.toFixed(2) : '0.00'}).`,
                            {
                                itemsCount,
                                retrievalModes: retrievalModes || 'n/a',
                                vectorAcceleration: vectorAccelerationSummary,
                                latencyMs: Number.isFinite(latencyMs) ? latencyMs : 0,
                                evidenceCoverageRatio: Number.isFinite(evidenceCoverageRatio) ? evidenceCoverageRatio.toFixed(2) : '0.00',
                            }
                        )
                    );
                    return;
                }

                if (presentation === 'ingest_guardrail_card') {
                    const gates = Array.isArray(result && result.gates) ? result.gates : [];
                    const totalGates = gates.length;
                    const failedGates = gates.filter((gate) => gate && gate.passed === false).length;
                    const overallPassed = Boolean(result && result.overallPassed);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.ingestGuardrailLoaded',
                            `Ingest guardrails evaluated (${overallPassed ? 'pass' : 'fail'}): ${failedGates}/${totalGates} gates failed.`,
                            {
                                status: overallPassed ? 'pass' : 'fail',
                                failedGates,
                                totalGates,
                            }
                        )
                    );
                    return;
                }

                if (presentation === 'session_history_card') {
                    const summary = result && result.summary && typeof result.summary === 'object'
                        ? result.summary
                        : {};
                    const totalRecords = Number(summary.totalRecords);
                    const totalExecutedActions = Number(summary.totalExecutedActions);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.sessionHistoryLoaded',
                            `Session history loaded (${Number.isFinite(totalRecords) ? totalRecords : 0} sessions, ${Number.isFinite(totalExecutedActions) ? totalExecutedActions : 0} actions).`,
                            {
                                totalRecords: Number.isFinite(totalRecords) ? totalRecords : 0,
                                totalExecutedActions: Number.isFinite(totalExecutedActions) ? totalExecutedActions : 0,
                            }
                        )
                    );
                    return;
                }

                if (presentation === 'mastery_misconceptions_card') {
                    const summary = result && result.summary && typeof result.summary === 'object'
                        ? result.summary
                        : {};
                    const trackedTags = Number(summary.trackedTags);
                    const totalObservations = Number(summary.totalObservations);
                    const topItem = Array.isArray(result && result.items) && result.items.length > 0
                        ? result.items[0]
                        : null;
                    const topErrorTag = trimString(topItem && topItem.errorTag);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.masteryMisconceptionsLoaded',
                            `Mastery misconceptions loaded (${Number.isFinite(trackedTags) ? trackedTags : 0} tags, ${Number.isFinite(totalObservations) ? totalObservations : 0} observations, top "${topErrorTag || 'n/a'}").`,
                            {
                                trackedTags: Number.isFinite(trackedTags) ? trackedTags : 0,
                                totalObservations: Number.isFinite(totalObservations) ? totalObservations : 0,
                                topErrorTag: topErrorTag || 'n/a',
                            }
                        )
                    );
                    return;
                }

                if (presentation === 'learning_quality_snapshot_card') {
                    const snapshot = result && result.snapshot && typeof result.snapshot === 'object'
                        ? result.snapshot
                        : {};
                    const retestPassRatePct = Number(snapshot.retestPassRatePct);
                    const misconceptionRecurrenceRatePct = Number(snapshot.misconceptionRecurrenceRatePct);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.learningQualitySnapshotLoaded',
                            `Learning quality snapshot loaded (retest ${Number.isFinite(retestPassRatePct) ? retestPassRatePct.toFixed(1) : '0.0'}%, recurrence ${Number.isFinite(misconceptionRecurrenceRatePct) ? misconceptionRecurrenceRatePct.toFixed(1) : '0.0'}%).`,
                            {
                                retestPassRatePct: Number.isFinite(retestPassRatePct) ? retestPassRatePct.toFixed(1) : '0.0',
                                misconceptionRecurrenceRatePct: Number.isFinite(misconceptionRecurrenceRatePct)
                                    ? misconceptionRecurrenceRatePct.toFixed(1)
                                    : '0.0',
                            }
                        )
                    );
                    return;
                }

                if (presentation === 'memory_policy_card') {
                    const stats = result && result.stats && typeof result.stats === 'object'
                        ? result.stats
                        : {};
                    const filter = result && result.filter && typeof result.filter === 'object'
                        ? result.filter
                        : {};
                    const entriesCount = Array.isArray(result && result.entries) ? result.entries.length : 0;
                    const recommendedActionsCount = Array.isArray(result && result.recommendedActions)
                        ? result.recommendedActions.length
                        : 0;
                    const evictedCount = Number(result && result.evictedCount);
                    const mutatedCount = Number(result && result.mutatedCount);
                    const removedKeysCount = Array.isArray(result && result.removedKeys)
                        ? result.removedKeys.length
                        : 0;
                    const sessionCount = Number(stats.session);
                    const unitCount = Number(stats.unit);
                    const longTermCount = Number(stats.longTerm);
                    const layer = trimString(result && result.layer) || 'session';
                    const operation = trimString(result && result.operation) || 'snapshot';
                    const targetedMatchKeys = resolveStringArray(filter && filter.matchKeys);
                    const matchedKeys = resolveStringArray(filter && filter.matchedKeys);
                    const missingKeys = resolveStringArray(filter && filter.missingKeys);
                    const followUpActionsSummary = summarizeManagedMemoryFollowUpActions(missingKeys);
                    if (operation === 'write') {
                        appendMessage(
                            'assistant',
                            getI18nText(
                                'agentWorkspace.messages.memoryWriteLoaded',
                                `Memory updated (${layer}/${operation}): wrote ${Number.isFinite(mutatedCount) ? mutatedCount : entriesCount} entry, totals session ${Number.isFinite(sessionCount) ? sessionCount : 0}, unit ${Number.isFinite(unitCount) ? unitCount : 0}, long-term ${Number.isFinite(longTermCount) ? longTermCount : 0}.`,
                                {
                                    layer,
                                    operation,
                                    mutatedCount: Number.isFinite(mutatedCount) ? mutatedCount : entriesCount,
                                    sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
                                    unitCount: Number.isFinite(unitCount) ? unitCount : 0,
                                    longTermCount: Number.isFinite(longTermCount) ? longTermCount : 0,
                                }
                            )
                        );
                        return;
                    }
                    if (operation === 'evict') {
                        appendMessage(
                            'assistant',
                            getI18nText(
                                'agentWorkspace.messages.memoryEvictLoaded',
                                `Memory eviction completed (${layer}/${operation}): removed ${Number.isFinite(evictedCount) ? evictedCount : 0} entries, targeted keys ${removedKeysCount}, totals session ${Number.isFinite(sessionCount) ? sessionCount : 0}, unit ${Number.isFinite(unitCount) ? unitCount : 0}, long-term ${Number.isFinite(longTermCount) ? longTermCount : 0}.`,
                                {
                                    layer,
                                    operation,
                                    evictedCount: Number.isFinite(evictedCount) ? evictedCount : 0,
                                    removedKeysCount,
                                    sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
                                    unitCount: Number.isFinite(unitCount) ? unitCount : 0,
                                    longTermCount: Number.isFinite(longTermCount) ? longTermCount : 0,
                                }
                            )
                        );
                        return;
                    }
                    if (operation === 'read' && targetedMatchKeys.length > 0) {
                        appendMessage(
                            'assistant',
                            getI18nText(
                                followUpActionsSummary
                                    ? 'agentWorkspace.messages.memoryTargetedReadLoadedWithNext'
                                    : 'agentWorkspace.messages.memoryTargetedReadLoaded',
                                followUpActionsSummary
                                    ? `Memory targeted read loaded (${layer}/${operation}): present ${summarizeMemoryKeyLabels(matchedKeys)}, missing ${summarizeMemoryKeyLabels(missingKeys)}, next ${followUpActionsSummary}, totals session ${Number.isFinite(sessionCount) ? sessionCount : 0}, unit ${Number.isFinite(unitCount) ? unitCount : 0}, long-term ${Number.isFinite(longTermCount) ? longTermCount : 0}.`
                                    : `Memory targeted read loaded (${layer}/${operation}): present ${summarizeMemoryKeyLabels(matchedKeys)}, missing ${summarizeMemoryKeyLabels(missingKeys)}, totals session ${Number.isFinite(sessionCount) ? sessionCount : 0}, unit ${Number.isFinite(unitCount) ? unitCount : 0}, long-term ${Number.isFinite(longTermCount) ? longTermCount : 0}.`,
                                {
                                    layer,
                                    operation,
                                    matchedKeysSummary: summarizeMemoryKeyLabels(matchedKeys),
                                    missingKeysSummary: summarizeMemoryKeyLabels(missingKeys),
                                    nextActionsSummary: followUpActionsSummary,
                                    sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
                                    unitCount: Number.isFinite(unitCount) ? unitCount : 0,
                                    longTermCount: Number.isFinite(longTermCount) ? longTermCount : 0,
                                }
                            )
                        );
                        return;
                    }
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.memoryPolicyLoaded',
                            `Memory snapshot loaded (${layer}/${operation}): ${entriesCount} entries, evicted ${Number.isFinite(evictedCount) ? evictedCount : 0}, totals session ${Number.isFinite(sessionCount) ? sessionCount : 0}, unit ${Number.isFinite(unitCount) ? unitCount : 0}, long-term ${Number.isFinite(longTermCount) ? longTermCount : 0}, recommended ${recommendedActionsCount} actions.`,
                            {
                                layer,
                                operation,
                                entriesCount,
                                recommendedActionsCount,
                                evictedCount: Number.isFinite(evictedCount) ? evictedCount : 0,
                                sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
                                unitCount: Number.isFinite(unitCount) ? unitCount : 0,
                                longTermCount: Number.isFinite(longTermCount) ? longTermCount : 0,
                            }
                        )
                    );
                    return;
                }

                appendMessage(
                    'assistant',
                    trimString(result && result.message)
                    || getI18nText('agentWorkspace.messages.operationCompleted', 'Operation completed.', {})
                );
            }

            function resolveCapabilityLabel(capability) {
                if (!capability || typeof capability !== 'object') {
                    return getI18nText('agentWorkspace.actions.unknown', 'Action');
                }
                const fallback = trimString(capability.label) || getI18nText('agentWorkspace.actions.unknown', 'Action');
                const labelKey = trimString(capability.labelKey);
                if (!labelKey) {
                    return fallback;
                }
                return getI18nText(labelKey, fallback);
            }

            function findCapabilityByActionId(point, actionId) {
                const normalizedActionId = trimString(actionId);
                if (!normalizedActionId) {
                    return null;
                }
                const capabilities = Array.isArray(point && point.capabilities) ? point.capabilities : [];
                return capabilities.find((capability) => trimString(capability && capability.actionId) === normalizedActionId) || null;
            }

            function appendPointActionFailure(capability, point, error) {
                const fallback = trimString(capability && capability.failure && capability.failure.fallbackMessage)
                    || getI18nText('agentWorkspace.messages.operationFailed', 'Operation failed.');
                appendMessage('assistant', fallback.replace('{title}', trimString(point && point.title) || trimString(point && point.atomId)));
                console.error('[AgentWorkspace] capability execution failed:', error);
            }

            async function runCapabilityAction(capability, point) {
                try {
                    setBusy(true);
                    await executeCapability(capability, point);
                } catch (error) {
                    appendPointActionFailure(capability, point, error);
                } finally {
                    setBusy(false);
                    renderKnowledgePoints(state.latestKnowledgePoints);
                }
            }

            async function runFallbackPointAction(actionId, point) {
                const normalizedActionId = trimString(actionId);
                try {
                    setBusy(true);
                    if (normalizedActionId === 'open_focus_mode') {
                        focusKnowledgePoint(point);
                        return;
                    }
                    if (normalizedActionId === 'open_learning_path') {
                        openLearningPathDock(trimString(point && point.atomId));
                        return;
                    }
                    throw new Error(`Unsupported point action "${normalizedActionId || '<empty>'}".`);
                } catch (error) {
                    appendPointActionFailure(null, point, error);
                } finally {
                    setBusy(false);
                }
            }

            function triggerPointAction(actionId, point) {
                const capability = findCapabilityByActionId(point, actionId);
                if (capability) {
                    void runCapabilityAction(capability, point);
                    return;
                }
                void runFallbackPointAction(actionId, point);
            }

            function createPointActionButton(label, onClick) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'agent-workspace-action-button';
                button.textContent = trimString(label) || getI18nText('agentWorkspace.actions.unknown', 'Action');
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onClick();
                });
                return button;
            }

            function appendPointIdentity(container, point) {
                const title = document.createElement('h4');
                title.className = 'agent-workspace-point-title';
                title.textContent = trimString(point && point.title) || trimString(point && point.atomId) || 'Untitled';
                container.appendChild(title);

                const snippetText = trimString(point && point.snippet);
                if (snippetText) {
                    const snippet = document.createElement('p');
                    snippet.className = 'agent-workspace-point-snippet';
                    snippet.textContent = snippetText;
                    container.appendChild(snippet);
                }

                const meta = document.createElement('div');
                meta.className = 'agent-workspace-point-meta';
                const score = Number(point && point.score);
                meta.textContent = Number.isFinite(score)
                    ? `${getI18nText('agentWorkspace.labels.score', 'Score')}: ${score.toFixed(3)}`
                    : '';
                if (meta.textContent) {
                    container.appendChild(meta);
                }
            }

            function createStatusBadge(label, extraClassName = '') {
                const badge = document.createElement('span');
                badge.className = extraClassName
                    ? `agent-workspace-status-badge ${extraClassName}`
                    : 'agent-workspace-status-badge';
                badge.textContent = label;
                return badge;
            }

            function resolveActivePointContinuity(point) {
                const activeAtomId = trimString(point && point.atomId);
                const pathAtomId = resolveCurrentPathAtomId();
                if (!activeAtomId) {
                    return {
                        message: '',
                        showPathBadge: false,
                        pathBadgeLabel: '',
                    };
                }
                if (!state.pathVisible || !pathAtomId) {
                    return {
                        message: getI18nText(
                            'agentWorkspace.messages.activeAtomPathInactive',
                            'Focus is ready for {atomId}. Open Learning Path to pair the side pane with this atom.',
                            { atomId: activeAtomId }
                        ),
                        showPathBadge: false,
                        pathBadgeLabel: '',
                    };
                }
                if (pathAtomId === activeAtomId) {
                    return {
                        message: getI18nText(
                            state.pathFullscreen
                                ? 'agentWorkspace.messages.activeAtomPathAlignedFullscreen'
                                : 'agentWorkspace.messages.activeAtomPathAligned',
                            state.pathFullscreen
                                ? 'Focus and learning path are aligned on {atomId} in fullscreen path view.'
                                : 'Focus and learning path are aligned on {atomId}.',
                            { atomId: activeAtomId }
                        ),
                        showPathBadge: true,
                        pathBadgeLabel: state.pathFullscreen
                            ? getI18nText('agentWorkspace.labels.learningPathFullscreen', 'Path Fullscreen')
                            : getI18nText('agentWorkspace.labels.learningPathDocked', 'Path Docked'),
                    };
                }
                return {
                    message: getI18nText(
                        'agentWorkspace.messages.activeAtomPathDrifted',
                        'Focus is on {atomId}. Learning path is still pinned to {pathAtomId}. Reopen Learning Path to realign.',
                        {
                            atomId: activeAtomId,
                            pathAtomId,
                        }
                    ),
                    showPathBadge: true,
                    pathBadgeLabel: getI18nText('agentWorkspace.labels.learningPathPinned', 'Path Pinned'),
                };
            }

            function appendActivePointStatus(container, point) {
                const normalizedAtomId = trimString(point && point.atomId);
                if (!normalizedAtomId) {
                    return;
                }
                const continuity = resolveActivePointContinuity(point);
                const badges = document.createElement('div');
                badges.className = 'agent-workspace-status-badges';
                badges.appendChild(createStatusBadge(
                    getI18nText('agentWorkspace.labels.active', 'Active')
                ));
                badges.appendChild(createStatusBadge(
                    getI18nText('agentWorkspace.labels.focusReady', 'Focus Ready')
                ));
                if (continuity.showPathBadge && continuity.pathBadgeLabel) {
                    badges.appendChild(createStatusBadge(
                        continuity.pathBadgeLabel
                    ));
                }
                container.appendChild(badges);
                if (continuity.message) {
                    const note = document.createElement('p');
                    note.className = 'agent-workspace-active-point-note';
                    note.textContent = continuity.message;
                    container.appendChild(note);
                }
            }

            function resolveActivePointCapabilities(point) {
                const capabilities = Array.isArray(point && point.capabilities) ? point.capabilities : [];
                return capabilities
                    .filter((capability) => {
                        const actionId = trimString(capability && capability.actionId);
                        return actionId && actionId !== 'open_focus_mode' && actionId !== 'open_learning_path';
                    })
                    .slice(0, MAX_ACTIVE_POINT_CONTEXTUAL_ACTIONS);
            }

            function resolveCapabilityCategory(capability) {
                const actionId = trimString(capability && capability.actionId);
                if (!actionId) {
                    return 'other';
                }
                if (STUDY_LOOP_ACTION_IDS.includes(actionId)) {
                    return 'study';
                }
                if (MEMORY_ACTION_IDS.includes(actionId)) {
                    return 'memory';
                }
                if (actionId.startsWith('inspect_') || actionId.startsWith('compare_')) {
                    return 'diagnostic';
                }
                return 'other';
            }

            function resolveActivePointCapabilitySummary(point) {
                const capabilities = Array.isArray(point && point.capabilities) ? point.capabilities : [];
                return capabilities.reduce((summary, capability) => {
                    const category = resolveCapabilityCategory(capability);
                    if (category === 'study') {
                        summary.study.push(capability);
                    } else if (category === 'memory') {
                        summary.memory.push(capability);
                    } else if (category === 'diagnostic') {
                        summary.diagnostic.push(capability);
                    } else {
                        summary.other.push(capability);
                    }
                    return summary;
                }, {
                    study: [],
                    memory: [],
                    diagnostic: [],
                    other: [],
                });
            }

            function resolveLatestCapabilityEventForAtom(atomId, category) {
                const normalizedAtomId = trimString(atomId);
                if (!normalizedAtomId) {
                    return null;
                }
                for (let index = diagnostics.capabilityEvents.length - 1; index >= 0; index -= 1) {
                    const event = diagnostics.capabilityEvents[index];
                    if (trimString(event && event.atomId) !== normalizedAtomId) {
                        continue;
                    }
                    if (trimString(event && event.status) !== 'success') {
                        continue;
                    }
                    if (trimString(event && event.phase) === 'request') {
                        continue;
                    }
                    if (category && resolveCapabilityCategory({ actionId: event && event.actionId }) !== category) {
                        continue;
                    }
                    return event;
                }
                return null;
            }

            function resolveRecentCapabilityEventsForAtom(atomId, limit = 3) {
                const normalizedAtomId = trimString(atomId);
                const boundedLimit = Math.max(1, Math.floor(Number(limit) || 3));
                if (!normalizedAtomId) {
                    return [];
                }
                const events = [];
                for (let index = diagnostics.capabilityEvents.length - 1; index >= 0; index -= 1) {
                    const event = diagnostics.capabilityEvents[index];
                    const actionId = trimString(event && event.actionId);
                    const phase = trimString(event && event.phase);
                    const operationId = trimString(event && event.operationId);
                    if (trimString(event && event.atomId) !== normalizedAtomId) {
                        continue;
                    }
                    if (trimString(event && event.status) !== 'success') {
                        continue;
                    }
                    if (!actionId || actionId === 'open_focus_mode') {
                        continue;
                    }
                    if (actionId === 'open_learning_path' && !operationId) {
                        continue;
                    }
                    if (phase === 'request' || phase === 'plan') {
                        continue;
                    }
                    events.push(event);
                    if (events.length >= boundedLimit) {
                        break;
                    }
                }
                return events;
            }

            function resolveCapabilityEventPreviewText(event) {
                const preview = event && event.resultPreview && typeof event.resultPreview === 'object'
                    ? event.resultPreview
                    : null;
                if (!preview) {
                    return '';
                }
                const kind = trimString(preview.kind);
                if (kind === 'learning_path') {
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewLearningPath',
                        'mastery {masteryPathCount} divergence {divergencePathCount}',
                        {
                            masteryPathCount: Number.isFinite(Number(preview.masteryPathCount))
                                ? Number(preview.masteryPathCount)
                                : 0,
                            divergencePathCount: Number.isFinite(Number(preview.divergencePathCount))
                                ? Number(preview.divergencePathCount)
                                : 0,
                        }
                    );
                }
                if (kind === 'study_session') {
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewStudySession',
                        '{totalActions} actions {totalEstimatedMinutes} min',
                        {
                            totalActions: Number.isFinite(Number(preview.totalActions)) ? Number(preview.totalActions) : 0,
                            totalEstimatedMinutes: Number.isFinite(Number(preview.totalEstimatedMinutes))
                                ? Number(preview.totalEstimatedMinutes)
                                : 0,
                        }
                    );
                }
                if (kind === 'memory_policy') {
                    const operation = trimString(preview.operation) || 'snapshot';
                    if (operation === 'write') {
                        return getI18nText(
                            'agentWorkspace.messages.currentAtomHistoryPreviewMemoryWrite',
                            '{layer}/{operation} {mutatedCount} written',
                            {
                                layer: trimString(preview.layer) || 'session',
                                operation,
                                mutatedCount: Number.isFinite(Number(preview.mutatedCount)) ? Number(preview.mutatedCount) : 0,
                            }
                        );
                    }
                    if (operation === 'evict') {
                        return getI18nText(
                            'agentWorkspace.messages.currentAtomHistoryPreviewMemoryEvict',
                            '{layer}/{operation} {evictedCount} evicted',
                            {
                                layer: trimString(preview.layer) || 'session',
                                operation,
                                evictedCount: Number.isFinite(Number(preview.evictedCount)) ? Number(preview.evictedCount) : 0,
                            }
                        );
                    }
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewMemoryPolicy',
                        '{layer}/{operation} {entriesCount} entry',
                        {
                            layer: trimString(preview.layer) || 'session',
                            operation,
                            entriesCount: Number.isFinite(Number(preview.entriesCount)) ? Number(preview.entriesCount) : 0,
                        }
                    );
                }
                if (kind === 'query_trace') {
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewQueryTrace',
                        '{itemsCount} hits {retrievalModesCount} modes',
                        {
                            itemsCount: Number.isFinite(Number(preview.itemsCount)) ? Number(preview.itemsCount) : 0,
                            retrievalModesCount: Number.isFinite(Number(preview.retrievalModesCount))
                                ? Number(preview.retrievalModesCount)
                                : 0,
                        }
                    );
                }
                if (kind === 'ingest_guardrail') {
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewIngestGuardrail',
                        '{status} {failedGates}/{totalGates} failed',
                        {
                            status: trimString(preview.status) || 'unknown',
                            failedGates: Number.isFinite(Number(preview.failedGates)) ? Number(preview.failedGates) : 0,
                            totalGates: Number.isFinite(Number(preview.totalGates)) ? Number(preview.totalGates) : 0,
                        }
                    );
                }
                if (kind === 'session_history') {
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewSessionHistory',
                        '{totalRecords} sessions {totalExecutedActions} actions',
                        {
                            totalRecords: Number.isFinite(Number(preview.totalRecords)) ? Number(preview.totalRecords) : 0,
                            totalExecutedActions: Number.isFinite(Number(preview.totalExecutedActions))
                                ? Number(preview.totalExecutedActions)
                                : 0,
                        }
                    );
                }
                if (kind === 'mastery_misconceptions') {
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewMasteryMisconceptions',
                        '{trackedTags} tags {totalObservations} observations',
                        {
                            trackedTags: Number.isFinite(Number(preview.trackedTags)) ? Number(preview.trackedTags) : 0,
                            totalObservations: Number.isFinite(Number(preview.totalObservations))
                                ? Number(preview.totalObservations)
                                : 0,
                        }
                    );
                }
                if (kind === 'learning_quality') {
                    return getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryPreviewLearningQuality',
                        'retest {retestPassRatePct}% recurrence {misconceptionRecurrenceRatePct}%',
                        {
                            retestPassRatePct: Number.isFinite(Number(preview.retestPassRatePct))
                                ? Number(preview.retestPassRatePct).toFixed(1)
                                : '0.0',
                            misconceptionRecurrenceRatePct: Number.isFinite(Number(preview.misconceptionRecurrenceRatePct))
                                ? Number(preview.misconceptionRecurrenceRatePct).toFixed(1)
                                : '0.0',
                        }
                    );
                }
                if (kind === 'message') {
                    return trimString(preview.message);
                }
                return '';
            }

            function resolveExpandedHistoryEventIdForAtom(atomId) {
                const normalizedAtomId = trimString(atomId);
                if (!normalizedAtomId) {
                    return '';
                }
                return trimString(state.expandedHistoryEventIdsByAtom[normalizedAtomId]);
            }

            function toggleHistoryEventDetails(atomId, eventId) {
                const normalizedAtomId = trimString(atomId);
                const normalizedEventId = trimString(eventId);
                if (!normalizedAtomId || !normalizedEventId) {
                    return;
                }
                const currentExpandedEventId = resolveExpandedHistoryEventIdForAtom(normalizedAtomId);
                if (currentExpandedEventId === normalizedEventId) {
                    delete state.expandedHistoryEventIdsByAtom[normalizedAtomId];
                } else {
                    state.expandedHistoryEventIdsByAtom[normalizedAtomId] = normalizedEventId;
                }
                renderKnowledgePoints(state.latestKnowledgePoints);
            }

            function appendHistoryDetailLine(container, label, value) {
                const normalizedValue = trimString(value);
                if (!container || !label || !normalizedValue) {
                    return;
                }
                const line = document.createElement('p');
                line.className = 'agent-workspace-history-detail-line';
                line.textContent = `${label}: ${normalizedValue}`;
                container.appendChild(line);
            }

            function resolvePointActionLabelByActionId(point, actionId) {
                const capability = findCapabilityByActionId(point, actionId);
                if (capability) {
                    return resolveCapabilityLabel(capability);
                }
                if (trimString(actionId) === 'open_focus_mode') {
                    return getI18nText('agentWorkspace.actions.openFocusMode', 'Focus');
                }
                if (trimString(actionId) === 'open_learning_path') {
                    return getI18nText('agentWorkspace.actions.openLearningPath', 'Learning Path');
                }
                return trimString(actionId) || getI18nText('agentWorkspace.actions.unknown', 'Action');
            }

            function isFallbackPointActionId(actionId) {
                const normalizedActionId = trimString(actionId);
                return normalizedActionId === 'open_focus_mode' || normalizedActionId === 'open_learning_path';
            }

            function canTriggerPointActionByActionId(point, actionId) {
                const normalizedActionId = trimString(actionId);
                if (!normalizedActionId) {
                    return false;
                }
                if (findCapabilityByActionId(point, normalizedActionId)) {
                    return true;
                }
                return isFallbackPointActionId(normalizedActionId);
            }

            function resolvePointActionAvailabilityKind(point, actionId) {
                const normalizedActionId = trimString(actionId);
                if (!normalizedActionId) {
                    return '';
                }
                if (findCapabilityByActionId(point, normalizedActionId)) {
                    return 'typed';
                }
                if (isFallbackPointActionId(normalizedActionId)) {
                    return 'fallback';
                }
                return '';
            }

            function resolveManagedMemoryMissingFollowUpActionIds(event) {
                const labels = resolveManagedConversationKeyLabels(event && event.missingManagedKeyLabels);
                const actionIds = [];
                labels.forEach((label) => {
                    if (label === 'note') {
                        actionIds.push('write_memory_note');
                    } else if (label === 'correction') {
                        actionIds.push('record_memory_correction');
                    }
                });
                return actionIds;
            }

            function resolveHistoryFollowUpDescriptor(point, event) {
                const eventActionId = trimString(event && event.actionId);
                const eventIsManagedMemoryState = isManagedMemoryStateActionId(eventActionId);
                const missingManagedKeyLabels = resolveManagedConversationKeyLabels(event && event.missingManagedKeyLabels);
                const managedMemoryMissingActionIds = resolveManagedMemoryMissingFollowUpActionIds(event);
                const preferredCandidates = HISTORY_FOLLOW_UP_CANDIDATES_BY_ACTION_ID[eventActionId]
                    || DEFAULT_HISTORY_FOLLOW_UP_CANDIDATES;
                const actionIds = managedMemoryMissingActionIds.concat(preferredCandidates, DEFAULT_HISTORY_FOLLOW_UP_CANDIDATES);
                const moreRecentActionIds = new Set();
                const recentHistoryEvents = resolveRecentCapabilityEventsForAtom(point && point.atomId, 3);
                const targetEventId = trimString(event && event.eventId);
                for (let index = 0; index < recentHistoryEvents.length; index += 1) {
                    const historyEvent = recentHistoryEvents[index];
                    if (trimString(historyEvent && historyEvent.eventId) === targetEventId) {
                        break;
                    }
                    const historyActionId = trimString(historyEvent && historyEvent.actionId);
                    if (historyActionId) {
                        moreRecentActionIds.add(historyActionId);
                    }
                }
                const visitedActionIds = new Set();
                const orderedValidActionIds = [];
                for (let index = 0; index < actionIds.length; index += 1) {
                    const candidateActionId = trimString(actionIds[index]);
                    if (!candidateActionId || candidateActionId === eventActionId) {
                        continue;
                    }
                    if (visitedActionIds.has(candidateActionId)) {
                        continue;
                    }
                    visitedActionIds.add(candidateActionId);
                    if (!canTriggerPointActionByActionId(point, candidateActionId)) {
                        continue;
                    }
                    orderedValidActionIds.push(candidateActionId);
                }
                const primaryActionId = orderedValidActionIds.find((actionId) => !moreRecentActionIds.has(actionId))
                    || orderedValidActionIds[0]
                    || '';
                const primaryIndex = orderedValidActionIds.indexOf(primaryActionId);
                const skippedRecentActionId = primaryIndex > 0
                    ? orderedValidActionIds
                        .slice(0, primaryIndex)
                        .find((actionId) => moreRecentActionIds.has(actionId))
                    : '';
                const primaryRecentCoverage = Boolean(primaryActionId) && moreRecentActionIds.has(primaryActionId);
                const secondaryActionId = orderedValidActionIds.find(
                    (actionId, index) => index !== primaryIndex && actionId !== primaryActionId && !moreRecentActionIds.has(actionId)
                ) || orderedValidActionIds.find(
                    (actionId, index) => index !== primaryIndex && actionId !== primaryActionId
                ) || '';
                const primaryRank = primaryIndex >= 0 ? primaryIndex + 1 : 0;
                const secondaryIndex = orderedValidActionIds.indexOf(secondaryActionId);
                const secondaryRank = secondaryIndex >= 0 ? secondaryIndex + 1 : 0;
                const totalCandidates = orderedValidActionIds.length;
                const primaryIsFresh = Boolean(primaryActionId) && !primaryRecentCoverage;
                const secondaryRecentCoverage = Boolean(secondaryActionId) && moreRecentActionIds.has(secondaryActionId);
                const secondaryAvailabilityKind = resolvePointActionAvailabilityKind(point, secondaryActionId);

                let rationaleText = '';
                if (primaryActionId) {
                    if (managedMemoryMissingActionIds.includes(primaryActionId) && missingManagedKeyLabels.length > 0) {
                        rationaleText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpReasonMissingManagedKey',
                            'Managed state still misses {missingKey}, so {action} becomes next step.',
                            {
                                missingKey: summarizeMemoryKeyLabels(missingManagedKeyLabels),
                                action: resolvePointActionLabelByActionId(point, primaryActionId),
                            }
                        );
                    } else if (skippedRecentActionId) {
                        rationaleText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpReasonSkippedRecent',
                            'Recent activity already covered {action}.',
                            { action: resolvePointActionLabelByActionId(point, skippedRecentActionId) }
                        );
                    } else if (moreRecentActionIds.has(primaryActionId)) {
                        rationaleText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpReasonBestAvailable',
                            'Reusing {action} because no fresher alternative is available.',
                            { action: resolvePointActionLabelByActionId(point, primaryActionId) }
                        );
                    } else {
                        rationaleText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpReasonTopRanked',
                            'Top ranked next step after {action}.',
                            { action: resolvePointActionLabelByActionId(point, eventActionId) }
                        );
                    }
                }

                let tradeoffText = '';
                if (primaryActionId && secondaryActionId) {
                    const primaryLabel = resolvePointActionLabelByActionId(point, primaryActionId);
                    const secondaryLabel = resolvePointActionLabelByActionId(point, secondaryActionId);
                    const eventLabel = resolvePointActionLabelByActionId(point, eventActionId);
                    if (secondaryRecentCoverage) {
                        tradeoffText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpTradeoffCoveredAlternative',
                            '{primary} stays primary because recent activity already covered {secondary}.',
                            {
                                primary: primaryLabel,
                                secondary: secondaryLabel,
                            }
                        );
                    } else if (primaryRank > 0 && secondaryRank > 0) {
                        const availabilityText = secondaryAvailabilityKind === 'typed'
                            ? getI18nText(
                                'agentWorkspace.messages.historyFollowUpTradeoffTypedAlternative',
                                '{secondary} remains available as a typed alternative.',
                                { secondary: secondaryLabel }
                            )
                            : secondaryAvailabilityKind === 'fallback'
                                ? getI18nText(
                                    'agentWorkspace.messages.historyFollowUpTradeoffFallbackAlternative',
                                    '{secondary} remains available as the fallback alternative.',
                                    { secondary: secondaryLabel }
                                )
                                : '';
                        tradeoffText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpTradeoffRankedAhead',
                            '{primary} stays primary because it ranks ahead of {secondary} after {action}.',
                            {
                                primary: primaryLabel,
                                secondary: secondaryLabel,
                                action: eventLabel,
                            }
                        );
                        if (availabilityText) {
                            const joiner = /[\u4e00-\u9fff]/.test(`${tradeoffText}${availabilityText}`) ? '' : ' ';
                            tradeoffText = `${tradeoffText}${joiner}${availabilityText}`;
                        }
                    }
                }

                const signalBadges = [];
                let confidenceText = '';
                if (primaryActionId) {
                    if (primaryRank > 0 && totalCandidates > 0) {
                        signalBadges.push(getI18nText(
                            'agentWorkspace.labels.historyFollowUpSignalRank',
                            'Rank {rank}/{total}',
                            { rank: primaryRank, total: totalCandidates }
                        ));
                    }
                    signalBadges.push(getI18nText(
                        primaryIsFresh
                            ? 'agentWorkspace.labels.historyFollowUpSignalFresh'
                            : 'agentWorkspace.labels.historyFollowUpSignalReused',
                        primaryIsFresh ? 'Fresh' : 'Reused'
                    ));
                    if (skippedRecentActionId) {
                        signalBadges.push(getI18nText(
                            'agentWorkspace.labels.historyFollowUpSignalSkippedRecent',
                            'Skipped recent'
                        ));
                    }
                    missingManagedKeyLabels.forEach((label) => {
                        signalBadges.push(getI18nText(
                            label === 'note'
                                ? 'agentWorkspace.labels.historyFollowUpSignalMissingNote'
                                : 'agentWorkspace.labels.historyFollowUpSignalMissingCorrection',
                            label === 'note' ? 'Missing note' : 'Missing correction'
                        ));
                    });
                    if (secondaryActionId) {
                        signalBadges.push(getI18nText(
                            'agentWorkspace.labels.historyFollowUpSignalAlternativeReady',
                            'Alt ready'
                        ));
                    }

                    if (skippedRecentActionId) {
                        confidenceText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpConfidenceSkippedRecent',
                            'Fresh candidate after skipping the more recent {action} repeat.',
                            { action: resolvePointActionLabelByActionId(point, skippedRecentActionId) }
                        );
                    } else if (primaryIsFresh) {
                        confidenceText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpConfidenceFresh',
                            'Fresh deterministic candidate with no newer overlap.'
                        );
                    } else {
                        confidenceText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpConfidenceReused',
                            'No fresh candidate remained, so the rail reused {action}.',
                            { action: resolvePointActionLabelByActionId(point, primaryActionId) }
                        );
                    }
                    if (managedMemoryMissingActionIds.includes(primaryActionId) && missingManagedKeyLabels.length > 0) {
                        const missingManagedKeyText = getI18nText(
                            'agentWorkspace.messages.historyFollowUpConfidenceMissingManagedKey',
                            'Targets missing {missingKey}.',
                            { missingKey: summarizeMemoryKeyLabels(missingManagedKeyLabels) }
                        );
                        if (confidenceText) {
                            const joiner = /[\u4e00-\u9fff]/.test(`${confidenceText}${missingManagedKeyText}`) ? '' : ' ';
                            confidenceText = `${confidenceText}${joiner}${missingManagedKeyText}`;
                        } else {
                            confidenceText = missingManagedKeyText;
                        }
                    }
                }

                let driftText = '';
                let stabilityText = '';
                let stabilityEventCount = 0;
                const targetEventIndex = recentHistoryEvents.findIndex(
                    (historyEvent) => trimString(historyEvent && historyEvent.eventId) === targetEventId
                );
                if (primaryActionId && targetEventIndex > 0) {
                    const primaryManagedKeyLabel = resolveManagedMemoryFollowUpKeyLabel(primaryActionId);
                    const adjacentNewerEvent = recentHistoryEvents[targetEventIndex - 1];
                    const adjacentDescriptor = adjacentNewerEvent
                        ? resolveHistoryFollowUpDescriptor(point, adjacentNewerEvent)
                        : null;
                    const adjacentPrimaryActionId = trimString(adjacentDescriptor && adjacentDescriptor.primaryActionId);
                    const adjacentEventActionId = trimString(adjacentNewerEvent && adjacentNewerEvent.actionId);
                    const adjacentIsManagedMemoryState = isManagedMemoryStateActionId(adjacentEventActionId);
                    const adjacentMissingManagedKeyLabels = resolveManagedConversationKeyLabels(
                        adjacentNewerEvent && adjacentNewerEvent.missingManagedKeyLabels
                    );
                    if (adjacentPrimaryActionId && adjacentPrimaryActionId !== primaryActionId) {
                        const currentPrimaryLabel = resolvePointActionLabelByActionId(point, primaryActionId);
                        const adjacentPrimaryLabel = resolvePointActionLabelByActionId(point, adjacentPrimaryActionId);
                        const adjacentEventLabel = resolvePointActionLabelByActionId(point, adjacentNewerEvent && adjacentNewerEvent.actionId);
                        const adjacentMoreRecentCoverage = Array.isArray(adjacentDescriptor && adjacentDescriptor.moreRecentActionIds)
                            ? adjacentDescriptor.moreRecentActionIds.includes(primaryActionId)
                            : false;
                        const managedKeyResolvedInAdjacent = Boolean(
                            eventIsManagedMemoryState
                            && adjacentIsManagedMemoryState
                            && primaryManagedKeyLabel
                            && missingManagedKeyLabels.includes(primaryManagedKeyLabel)
                            && !adjacentMissingManagedKeyLabels.includes(primaryManagedKeyLabel)
                        );
                        driftText = managedKeyResolvedInAdjacent
                            ? getI18nText(
                                'agentWorkspace.messages.historyFollowUpDriftManagedKeyResolved',
                                'Newer managed state no longer misses {resolvedKey}, so the next step shifts from {previousPrimary} to {currentPrimary}.',
                                {
                                    resolvedKey: primaryManagedKeyLabel,
                                    previousPrimary: currentPrimaryLabel,
                                    currentPrimary: adjacentPrimaryLabel,
                                }
                            )
                            : adjacentMoreRecentCoverage
                                ? getI18nText(
                                    'agentWorkspace.messages.historyFollowUpDriftCoveredPrimary',
                                    'Newer {action} already covered {previousPrimary}, so the next step shifts to {currentPrimary}.',
                                    {
                                        action: adjacentEventLabel,
                                        previousPrimary: currentPrimaryLabel,
                                        currentPrimary: adjacentPrimaryLabel,
                                    }
                                )
                                : getI18nText(
                                    'agentWorkspace.messages.historyFollowUpDriftDifferentOrder',
                                    'Newer {action} shifts the next step from {previousPrimary} to {currentPrimary} because its follow-up order ranks {currentPrimary} earlier.',
                                    {
                                        action: adjacentEventLabel,
                                        previousPrimary: currentPrimaryLabel,
                                        currentPrimary: adjacentPrimaryLabel,
                                    }
                                );
                    }
                    if (adjacentPrimaryActionId && adjacentPrimaryActionId === primaryActionId) {
                        stabilityEventCount = 1;
                        let managedKeyStableAcrossSeries = Boolean(
                            eventIsManagedMemoryState
                            && primaryManagedKeyLabel
                            && missingManagedKeyLabels.includes(primaryManagedKeyLabel)
                        );
                        for (let index = targetEventIndex - 1; index >= 0; index -= 1) {
                            const newerEvent = recentHistoryEvents[index];
                            const newerDescriptor = index === targetEventIndex - 1
                                ? adjacentDescriptor
                                : resolveHistoryFollowUpDescriptor(point, newerEvent);
                            if (trimString(newerDescriptor && newerDescriptor.primaryActionId) !== primaryActionId) {
                                break;
                            }
                            stabilityEventCount += 1;
                            if (managedKeyStableAcrossSeries) {
                                const newerEventActionId = trimString(newerEvent && newerEvent.actionId);
                                const newerMissingManagedKeyLabels = resolveManagedConversationKeyLabels(
                                    newerEvent && newerEvent.missingManagedKeyLabels
                                );
                                if (
                                    !isManagedMemoryStateActionId(newerEventActionId)
                                    || !newerMissingManagedKeyLabels.includes(primaryManagedKeyLabel)
                                ) {
                                    managedKeyStableAcrossSeries = false;
                                }
                            }
                        }
                        if (stabilityEventCount > 1) {
                            stabilityText = managedKeyStableAcrossSeries
                                ? getI18nText(
                                    'agentWorkspace.messages.historyFollowUpStabilityMissingManagedKey',
                                    'Newer managed state still misses {missingKey}, so {currentPrimary} stays next across {count} consecutive history events.',
                                    {
                                        missingKey: primaryManagedKeyLabel,
                                        currentPrimary: resolvePointActionLabelByActionId(point, primaryActionId),
                                        count: stabilityEventCount,
                                    }
                                )
                                : getI18nText(
                                    'agentWorkspace.messages.historyFollowUpStabilityKeptPrimary',
                                    'Newer {action} keeps {currentPrimary} ahead, so the next step stays stable across {count} consecutive history events.',
                                    {
                                        action: resolvePointActionLabelByActionId(point, adjacentNewerEvent && adjacentNewerEvent.actionId),
                                        currentPrimary: resolvePointActionLabelByActionId(point, primaryActionId),
                                        count: stabilityEventCount,
                                    }
                                );
                        }
                    }
                }
                if (primaryActionId && stabilityEventCount > 1) {
                    signalBadges.push(getI18nText(
                        'agentWorkspace.labels.historyFollowUpSignalStableSeries',
                        'Stable x{count}',
                        { count: stabilityEventCount }
                    ));
                    const stabilityConfidenceText = getI18nText(
                        'agentWorkspace.messages.historyFollowUpConfidenceStableSeries',
                        'Reinforced across {count} consecutive history events.',
                        { count: stabilityEventCount }
                    );
                    if (stabilityConfidenceText) {
                        if (confidenceText) {
                            const joiner = /[\u4e00-\u9fff]/.test(`${confidenceText}${stabilityConfidenceText}`) ? '' : ' ';
                            confidenceText = `${confidenceText}${joiner}${stabilityConfidenceText}`;
                        } else {
                            confidenceText = stabilityConfidenceText;
                        }
                    }
                }

                return {
                    primaryActionId,
                    secondaryActionId,
                    rationaleText,
                    tradeoffText,
                    stabilityText,
                    signalBadges,
                    confidenceText,
                    driftText,
                    moreRecentActionIds: Array.from(moreRecentActionIds),
                };
            }

            function resolveHistoryFollowUpActionId(point, event) {
                return resolveHistoryFollowUpDescriptor(point, event).primaryActionId;
            }

            function createActivePointSummaryCard(title) {
                const card = document.createElement('section');
                card.className = 'agent-workspace-active-point-summary-card';
                const heading = document.createElement('h5');
                heading.className = 'agent-workspace-active-point-summary-heading';
                heading.textContent = title;
                card.appendChild(heading);
                return card;
            }

            function appendSummaryLine(card, text, extraClassName = '') {
                const line = document.createElement('p');
                line.className = extraClassName
                    ? `agent-workspace-active-point-summary-line ${extraClassName}`
                    : 'agent-workspace-active-point-summary-line';
                line.textContent = text;
                card.appendChild(line);
            }

            function createHistoryEventItem(point, event, index) {
                const atomId = trimString(point && point.atomId);
                const eventId = trimString(event && event.eventId);
                const item = document.createElement('div');
                item.className = 'agent-workspace-history-item';
                if (!eventId) {
                    return item;
                }

                appendSummaryLine(
                    item,
                    `${index + 1}. ${resolvePointActionLabelByActionId(point, event.actionId)}`,
                    'agent-workspace-active-point-summary-line--history-title'
                );

                const previewText = resolveCapabilityEventPreviewText(event);
                if (previewText) {
                    appendSummaryLine(
                        item,
                        previewText,
                        'agent-workspace-active-point-summary-line--detail'
                    );
                }

                const toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.className = 'agent-workspace-history-toggle';
                const expanded = resolveExpandedHistoryEventIdForAtom(atomId) === eventId;
                toggleButton.textContent = expanded
                    ? getI18nText('agentWorkspace.actions.hideHistoryDetails', 'Hide details')
                    : getI18nText('agentWorkspace.actions.showHistoryDetails', 'Show details');
                toggleButton.addEventListener('click', (clickEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    toggleHistoryEventDetails(atomId, eventId);
                });
                item.appendChild(toggleButton);

                if (expanded) {
                    const details = document.createElement('div');
                    details.className = 'agent-workspace-history-details';
                    appendHistoryDetailLine(
                        details,
                        getI18nText('agentWorkspace.labels.historyEventAt', 'At'),
                        trimString(event && event.at)
                    );
                    appendHistoryDetailLine(
                        details,
                        getI18nText('agentWorkspace.labels.historyEventOperation', 'Operation'),
                        trimString(event && event.operationId)
                    );
                    appendHistoryDetailLine(
                        details,
                        getI18nText('agentWorkspace.labels.historyEventSurface', 'Surface'),
                        trimString(event && event.resultPresentation)
                    );
                    const durationMs = Number(event && event.durationMs);
                    if (Number.isFinite(durationMs)) {
                        appendHistoryDetailLine(
                            details,
                            getI18nText('agentWorkspace.labels.historyEventDuration', 'Duration'),
                            `${Math.max(0, Math.floor(durationMs))} ms`
                        );
                    }
                    const followUpDescriptor = resolveHistoryFollowUpDescriptor(point, event);
                    if (followUpDescriptor.rationaleText) {
                        const followUpReason = document.createElement('div');
                        followUpReason.className = 'agent-workspace-history-follow-up-reason';
                        const followUpReasonLabel = document.createElement('p');
                        followUpReasonLabel.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-reason-label';
                        followUpReasonLabel.textContent = getI18nText('agentWorkspace.labels.historyFollowUpReason', 'Why this');
                        const followUpReasonCopy = document.createElement('p');
                        followUpReasonCopy.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-reason-copy';
                        followUpReasonCopy.textContent = followUpDescriptor.rationaleText;
                        followUpReason.appendChild(followUpReasonLabel);
                        followUpReason.appendChild(followUpReasonCopy);
                        details.appendChild(followUpReason);
                    }
                    if (followUpDescriptor.tradeoffText) {
                        const followUpTradeoff = document.createElement('div');
                        followUpTradeoff.className = 'agent-workspace-history-follow-up-tradeoff';
                        const followUpTradeoffLabel = document.createElement('p');
                        followUpTradeoffLabel.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-tradeoff-label';
                        followUpTradeoffLabel.textContent = getI18nText(
                            'agentWorkspace.labels.historyFollowUpTradeoff',
                            'Why not alternative'
                        );
                        const followUpTradeoffCopy = document.createElement('p');
                        followUpTradeoffCopy.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-tradeoff-copy';
                        followUpTradeoffCopy.textContent = followUpDescriptor.tradeoffText;
                        followUpTradeoff.appendChild(followUpTradeoffLabel);
                        followUpTradeoff.appendChild(followUpTradeoffCopy);
                        details.appendChild(followUpTradeoff);
                    }
                    if (followUpDescriptor.driftText) {
                        const followUpDrift = document.createElement('div');
                        followUpDrift.className = 'agent-workspace-history-follow-up-drift';
                        const followUpDriftLabel = document.createElement('p');
                        followUpDriftLabel.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-drift-label';
                        followUpDriftLabel.textContent = getI18nText(
                            'agentWorkspace.labels.historyFollowUpDrift',
                            'Why it changed'
                        );
                        const followUpDriftCopy = document.createElement('p');
                        followUpDriftCopy.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-drift-copy';
                        followUpDriftCopy.textContent = followUpDescriptor.driftText;
                        followUpDrift.appendChild(followUpDriftLabel);
                        followUpDrift.appendChild(followUpDriftCopy);
                        details.appendChild(followUpDrift);
                    }
                    if (followUpDescriptor.stabilityText) {
                        const followUpStability = document.createElement('div');
                        followUpStability.className = 'agent-workspace-history-follow-up-stability';
                        const followUpStabilityLabel = document.createElement('p');
                        followUpStabilityLabel.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-stability-label';
                        followUpStabilityLabel.textContent = getI18nText(
                            'agentWorkspace.labels.historyFollowUpStability',
                            'Why it held'
                        );
                        const followUpStabilityCopy = document.createElement('p');
                        followUpStabilityCopy.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-stability-copy';
                        followUpStabilityCopy.textContent = followUpDescriptor.stabilityText;
                        followUpStability.appendChild(followUpStabilityLabel);
                        followUpStability.appendChild(followUpStabilityCopy);
                        details.appendChild(followUpStability);
                    }
                    if (followUpDescriptor.signalBadges.length > 0 || followUpDescriptor.confidenceText) {
                        const followUpConfidence = document.createElement('div');
                        followUpConfidence.className = 'agent-workspace-history-follow-up-confidence';
                        const followUpConfidenceLabel = document.createElement('p');
                        followUpConfidenceLabel.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-confidence-label';
                        followUpConfidenceLabel.textContent = getI18nText(
                            'agentWorkspace.labels.historyFollowUpConfidence',
                            'Confidence'
                        );
                        followUpConfidence.appendChild(followUpConfidenceLabel);
                        if (followUpDescriptor.signalBadges.length > 0) {
                            const signalBadges = document.createElement('div');
                            signalBadges.className = 'agent-workspace-status-badges agent-workspace-history-follow-up-confidence-badges';
                            followUpDescriptor.signalBadges.forEach((badgeLabel) => {
                                signalBadges.appendChild(createStatusBadge(
                                    badgeLabel,
                                    'agent-workspace-status-badge--history-confidence'
                                ));
                            });
                            followUpConfidence.appendChild(signalBadges);
                        }
                        if (followUpDescriptor.confidenceText) {
                            const followUpConfidenceCopy = document.createElement('p');
                            followUpConfidenceCopy.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-confidence-copy';
                            followUpConfidenceCopy.textContent = followUpDescriptor.confidenceText;
                            followUpConfidence.appendChild(followUpConfidenceCopy);
                        }
                        details.appendChild(followUpConfidence);
                    }
                    if (followUpDescriptor.primaryActionId) {
                        const followUp = document.createElement('div');
                        followUp.className = 'agent-workspace-history-follow-up';
                        const followUpLabel = document.createElement('p');
                        followUpLabel.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-label';
                        followUpLabel.textContent = getI18nText('agentWorkspace.labels.historyFollowUp', 'Next step');
                        followUp.appendChild(followUpLabel);
                        followUp.appendChild(createPointActionButton(
                            resolvePointActionLabelByActionId(point, followUpDescriptor.primaryActionId),
                            () => triggerPointAction(followUpDescriptor.primaryActionId, point)
                        ));
                        details.appendChild(followUp);
                    }
                    if (followUpDescriptor.secondaryActionId) {
                        const alternatives = document.createElement('div');
                        alternatives.className = 'agent-workspace-history-follow-up-alternatives';
                        const alternativesLabel = document.createElement('p');
                        alternativesLabel.className = 'agent-workspace-history-detail-line agent-workspace-history-follow-up-alternatives-label';
                        alternativesLabel.textContent = getI18nText(
                            'agentWorkspace.labels.historyFollowUpAlternatives',
                            'Also available'
                        );
                        alternatives.appendChild(alternativesLabel);
                        alternatives.appendChild(createPointActionButton(
                            resolvePointActionLabelByActionId(point, followUpDescriptor.secondaryActionId),
                            () => triggerPointAction(followUpDescriptor.secondaryActionId, point)
                        ));
                        details.appendChild(alternatives);
                    }
                    item.appendChild(details);
                }

                return item;
            }

            function renderActivePointSummaryCards(point) {
                const summary = resolveActivePointCapabilitySummary(point);
                const wrapper = document.createElement('div');
                wrapper.className = 'agent-workspace-active-point-summaries';

                const studyCard = createActivePointSummaryCard(
                    getI18nText('agentWorkspace.labels.studyLoopSummary', 'Study Loop')
                );
                appendSummaryLine(
                    studyCard,
                    getI18nText(
                        'agentWorkspace.messages.studyLoopReadyCount',
                        '{count} ready',
                        { count: summary.study.length }
                    ),
                    'agent-workspace-active-point-summary-line--metric'
                );
                if (summary.study.length > 0) {
                    appendSummaryLine(
                        studyCard,
                        summary.study
                            .map((capability) => resolveCapabilityLabel(capability))
                            .join(', ')
                    );
                } else {
                    appendSummaryLine(
                        studyCard,
                        getI18nText('agentWorkspace.labels.noStudyActionYet', 'No study action yet')
                    );
                }
                const latestStudyEvent = resolveLatestCapabilityEventForAtom(point && point.atomId, 'study');
                if (latestStudyEvent) {
                    appendSummaryLine(
                        studyCard,
                        `${getI18nText('agentWorkspace.labels.lastAction', 'Last action')}: ${resolvePointActionLabelByActionId(point, latestStudyEvent.actionId)}`
                    );
                    appendSummaryLine(
                        studyCard,
                        getI18nText('agentWorkspace.labels.success', 'Success')
                    );
                } else {
                    appendSummaryLine(
                        studyCard,
                        getI18nText('agentWorkspace.labels.noStudyActionYet', 'No study action yet')
                    );
                }
                wrapper.appendChild(studyCard);

                const supportCard = createActivePointSummaryCard(
                    getI18nText('agentWorkspace.labels.supportSurfaceSummary', 'Support Surface')
                );
                appendSummaryLine(
                    supportCard,
                    getI18nText(
                        'agentWorkspace.messages.supportSurfaceCounts',
                        'Memory {memoryCount} Diagnostics {diagnosticCount}',
                        {
                            memoryCount: summary.memory.length,
                            diagnosticCount: summary.diagnostic.length,
                        }
                    ),
                    'agent-workspace-active-point-summary-line--metric'
                );
                wrapper.appendChild(supportCard);

                const historyEvents = resolveRecentCapabilityEventsForAtom(point && point.atomId, 3);
                const historyCard = createActivePointSummaryCard(
                    getI18nText('agentWorkspace.labels.currentAtomHistorySummary', 'Recent Activity')
                );
                appendSummaryLine(
                    historyCard,
                    getI18nText(
                        'agentWorkspace.messages.currentAtomHistoryCount',
                        '{count} recent results',
                        { count: historyEvents.length }
                    ),
                    'agent-workspace-active-point-summary-line--metric'
                );
                const managedConversationContinuitySummary = computeManagedConversationContinuitySummary(historyEvents);
                if (managedConversationContinuitySummary.readCount > 1) {
                    appendSummaryLine(
                        historyCard,
                        getI18nText(
                            'agentWorkspace.messages.currentAtomHistoryManagedContinuityReads',
                            'Managed continuity {readCount} reads',
                            { readCount: managedConversationContinuitySummary.readCount }
                        ),
                        'agent-workspace-active-point-summary-line--metric'
                    );
                    if (hasManagedConversationKeyCounts(managedConversationContinuitySummary.resolvedKeyCounts)) {
                        appendSummaryLine(
                            historyCard,
                            getI18nText(
                                'agentWorkspace.messages.currentAtomHistoryManagedContinuityResolved',
                                'resolved note {noteCount} correction {correctionCount}',
                                {
                                    noteCount: managedConversationContinuitySummary.resolvedKeyCounts.note,
                                    correctionCount: managedConversationContinuitySummary.resolvedKeyCounts.correction,
                                }
                            )
                        );
                        if (Array.isArray(managedConversationContinuitySummary.resolvedFollowUpActionLabels)
                            && managedConversationContinuitySummary.resolvedFollowUpActionLabels.length > 0) {
                            appendSummaryLine(
                                historyCard,
                                getI18nText(
                                    'agentWorkspace.messages.currentAtomHistoryManagedContinuityResolvedActions',
                                    'resolved no longer needs {actions}',
                                    {
                                        actions: managedConversationContinuitySummary.resolvedFollowUpActionLabels.join(', '),
                                    }
                                )
                            );
                        }
                    }
                    if (hasManagedConversationKeyCounts(managedConversationContinuitySummary.persistentKeyCounts)) {
                        appendSummaryLine(
                            historyCard,
                            getI18nText(
                                'agentWorkspace.messages.currentAtomHistoryManagedContinuityPersistent',
                                'persistent note {noteCount} correction {correctionCount}',
                                {
                                    noteCount: managedConversationContinuitySummary.persistentKeyCounts.note,
                                    correctionCount: managedConversationContinuitySummary.persistentKeyCounts.correction,
                                }
                            )
                        );
                    }
                    if (Array.isArray(managedConversationContinuitySummary.persistentFollowUpActionIds)
                        && managedConversationContinuitySummary.persistentFollowUpActionIds.length > 0) {
                        appendSummaryLine(
                            historyCard,
                            getI18nText(
                                'agentWorkspace.messages.currentAtomHistoryManagedContinuityNextActions',
                                'persistent next {actions}',
                                {
                                    actions: managedConversationContinuitySummary.persistentFollowUpActionLabels.join(', '),
                                }
                            )
                        );
                    }
                    if (managedConversationContinuitySummary.lastTransition
                        && trimString(managedConversationContinuitySummary.lastTransition.keyLabel)) {
                        const lastTransition = managedConversationContinuitySummary.lastTransition;
                        const resolvedKeyLabelsSummary = resolveManagedConversationKeyLabels(
                            lastTransition.resolvedKeyLabels
                        ).join(', ');
                        const persistentKeyLabelsSummary = resolveManagedConversationKeyLabels(
                            lastTransition.persistentKeyLabels
                        ).join(', ');
                        const resolvedActionLabelsSummary = Array.isArray(lastTransition.resolvedFollowUpActionLabels)
                            ? lastTransition.resolvedFollowUpActionLabels.join(', ')
                            : trimString(lastTransition.followUpActionLabel);
                        const persistentActionLabelsSummary = Array.isArray(lastTransition.persistentFollowUpActionLabels)
                            ? lastTransition.persistentFollowUpActionLabels.join(', ')
                            : trimString(lastTransition.followUpActionLabel);
                        const lastTransitionActionLabel = trimString(lastTransition.followUpActionLabel);
                        if (lastTransition.kind === 'mixed'
                            && resolvedKeyLabelsSummary
                            && persistentKeyLabelsSummary
                            && resolvedActionLabelsSummary
                            && persistentActionLabelsSummary) {
                            appendSummaryLine(
                                historyCard,
                                getI18nText(
                                    'agentWorkspace.messages.currentAtomHistoryManagedContinuityLatestMixed',
                                    'latest transition resolved {resolvedKeyLabels}, retired {resolvedActions}; persistent {persistentKeyLabels}, next {persistentActions}',
                                    {
                                        resolvedKeyLabels: resolvedKeyLabelsSummary,
                                        resolvedActions: resolvedActionLabelsSummary,
                                        persistentKeyLabels: persistentKeyLabelsSummary,
                                        persistentActions: persistentActionLabelsSummary,
                                    }
                                )
                            );
                        } else if (lastTransition.kind === 'resolved' && lastTransitionActionLabel) {
                            appendSummaryLine(
                                historyCard,
                                getI18nText(
                                    'agentWorkspace.messages.currentAtomHistoryManagedContinuityLatestResolved',
                                    'latest transition resolved {keyLabel}, retired {action}',
                                    {
                                        keyLabel: resolvedKeyLabelsSummary || trimString(lastTransition.keyLabel),
                                        action: lastTransitionActionLabel,
                                    }
                                )
                            );
                        } else if (lastTransition.kind === 'persistent' && lastTransitionActionLabel) {
                            appendSummaryLine(
                                historyCard,
                                getI18nText(
                                    'agentWorkspace.messages.currentAtomHistoryManagedContinuityLatestPersistent',
                                    'latest transition persistent {keyLabel}, next {action}',
                                    {
                                        keyLabel: persistentKeyLabelsSummary || trimString(lastTransition.keyLabel),
                                        action: lastTransitionActionLabel,
                                    }
                                )
                            );
                        }
                    }
                }
                if (historyEvents.length > 0) {
                    historyEvents.forEach((event, index) => {
                        historyCard.appendChild(createHistoryEventItem(point, event, index));
                    });
                } else {
                    appendSummaryLine(
                        historyCard,
                        getI18nText('agentWorkspace.labels.noCurrentAtomHistoryYet', 'No current-atom history yet')
                    );
                }
                wrapper.appendChild(historyCard);

                return wrapper;
            }

            function renderActivePointRail(point) {
                const atomId = trimString(point && point.atomId);
                if (!atomId) {
                    return null;
                }
                const rail = document.createElement('section');
                rail.className = 'agent-workspace-active-point';
                rail.dataset.atomId = atomId;

                const heading = document.createElement('h4');
                heading.className = 'agent-workspace-active-point-heading';
                heading.textContent = getI18nText('agentWorkspace.labels.activeAtom', 'Active Atom');
                rail.appendChild(heading);

                appendActivePointStatus(rail, point);
                appendPointIdentity(rail, point);
                rail.appendChild(renderActivePointSummaryCards(point));

                const actions = document.createElement('div');
                actions.className = 'agent-workspace-point-actions agent-workspace-active-point-actions';
                actions.appendChild(createPointActionButton(
                    getI18nText('agentWorkspace.actions.openFocusMode', 'Focus'),
                    () => triggerPointAction('open_focus_mode', point)
                ));
                actions.appendChild(createPointActionButton(
                    getI18nText('agentWorkspace.actions.openLearningPath', 'Learning Path'),
                    () => triggerPointAction('open_learning_path', point)
                ));
                resolveActivePointCapabilities(point).forEach((capability) => {
                    actions.appendChild(createPointActionButton(
                        resolveCapabilityLabel(capability),
                        () => {
                            void runCapabilityAction(capability, point);
                        }
                    ));
                });
                rail.appendChild(actions);
                return rail;
            }

            function focusKnowledgePoint(point) {
                const atomId = trimString(point && point.atomId);
                if (!atomId) {
                    return;
                }
                focusAtom(atomId);
            }

            function renderKnowledgePoints(knowledgePoints) {
                if (!dom.knowledgeList) {
                    return;
                }
                dom.knowledgeList.innerHTML = '';
                if (!Array.isArray(knowledgePoints) || knowledgePoints.length === 0) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'agent-workspace-empty';
                    emptyState.textContent = getI18nText(
                        'agentWorkspace.messages.noKnowledgePoints',
                        'No local knowledge points found for current query.'
                    );
                    dom.knowledgeList.appendChild(emptyState);
                    return;
                }

                const activePoint = findKnowledgePoint(state.latestFocusAtomId);
                const activeRail = renderActivePointRail(activePoint);
                if (activeRail) {
                    dom.knowledgeList.appendChild(activeRail);
                }

                knowledgePoints.forEach((point) => {
                    const card = document.createElement('article');
                    card.className = 'agent-workspace-point-card';
                    card.dataset.atomId = trimString(point && point.atomId);
                    if (trimString(point && point.atomId) === trimString(state.latestFocusAtomId)) {
                        card.classList.add('agent-workspace-point-card--active');
                    }
                    card.setAttribute('role', 'button');
                    card.setAttribute('tabindex', '0');
                    card.title = getI18nText(
                        'agentWorkspace.messages.clickPointToFocus',
                        'Click to open focus mode'
                    );
                    card.addEventListener('click', () => {
                        try {
                            focusKnowledgePoint(point);
                        } catch (error) {
                            appendMessage(
                                'assistant',
                                getI18nText('agentWorkspace.messages.operationFailed', 'Operation failed.')
                            );
                            console.error('[AgentWorkspace] point-focus failed:', error);
                        }
                    });
                    card.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            card.click();
                        }
                    });

                    appendPointIdentity(card, point);

                    const actions = document.createElement('div');
                    actions.className = 'agent-workspace-point-actions';
                    const capabilities = Array.isArray(point.capabilities) ? point.capabilities : [];
                    capabilities.forEach((capability) => {
                        const button = createPointActionButton(resolveCapabilityLabel(capability), () => {
                            void runCapabilityAction(capability, point);
                        });
                        actions.appendChild(button);
                    });
                    card.appendChild(actions);
                    dom.knowledgeList.appendChild(card);
                });
            }

            async function sendConversation() {
                if (!dom.input) {
                    return;
                }
                const message = trimString(dom.input.value);
                if (!message || state.busy) {
                    return;
                }
                const payload = resolveConversationPayload({
                    userId: resolveUserId(),
                    message,
                    topK: options.defaultTopK || 4,
                });
                const replayMarker = markUserMessageReplayCandidate(payload.message);
                diagnostics.conversationRequests += 1;
                diagnostics.lastConversation = {
                    requestedAt: nowIso(),
                    respondedAt: '',
                    userId: payload.userId,
                    message: payload.message,
                    status: 'pending',
                    replayCandidate: replayMarker.replayCandidate,
                    knowledgePoints: 0,
                };
                appendMessage('user', payload.message, {
                    source: 'conversation',
                    replayCandidate: replayMarker.replayCandidate,
                    replaySeenCount: replayMarker.seenCount,
                    fingerprint: replayMarker.fingerprint,
                });
                dom.input.value = '';

                setBusy(true);
                try {
                    const result = await requestJson('/api/knowledge/conversation', payload);
                    const knowledgePoints = Array.isArray(result && result.knowledgePoints)
                        ? result.knowledgePoints
                        : [];
                    diagnostics.lastConversation = {
                        requestedAt: diagnostics.lastConversation && diagnostics.lastConversation.requestedAt
                            ? diagnostics.lastConversation.requestedAt
                            : nowIso(),
                        respondedAt: nowIso(),
                        userId: payload.userId,
                        message: payload.message,
                        status: 'success',
                        replayCandidate: replayMarker.replayCandidate,
                        knowledgePoints: knowledgePoints.length,
                        retrievalModes: Array.isArray(result && result.trace && result.trace.retrievalModes)
                            ? result.trace.retrievalModes.slice()
                            : [],
                        vectorAcceleration: result && result.trace && result.trace.vectorAcceleration
                            && typeof result.trace.vectorAcceleration === 'object'
                            ? { ...result.trace.vectorAcceleration }
                            : null,
                        evidenceCoverageRatio: Number(result && result.trace && result.trace.evidenceCoverageRatio),
                    };
                    appendMessage('assistant', trimString(result && result.message));
                    state.latestKnowledgePoints = knowledgePoints;
                    renderKnowledgePoints(state.latestKnowledgePoints);
                } catch (error) {
                    const errorMessage = trimString(error && error.message);
                    diagnostics.lastConversation = {
                        requestedAt: diagnostics.lastConversation && diagnostics.lastConversation.requestedAt
                            ? diagnostics.lastConversation.requestedAt
                            : nowIso(),
                        respondedAt: nowIso(),
                        userId: payload.userId,
                        message: payload.message,
                        status: 'failed',
                        replayCandidate: replayMarker.replayCandidate,
                        knowledgePoints: 0,
                    };
                    recordFailure('sendConversation', errorMessage);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.conversationFailed',
                            `Conversation failed: ${errorMessage || 'unknown error'}.`
                        )
                    );
                    console.error('[AgentWorkspace] conversation request failed:', error);
                } finally {
                    setBusy(false);
                }
            }

            async function loadFoundationReadiness() {
                if (state.busy) {
                    return;
                }
                const requestedAt = nowIso();
                diagnostics.lastFoundationReadiness = {
                    requestedAt,
                    respondedAt: '',
                    status: 'pending',
                    decision: '',
                    storeType: '',
                    graphBackendStatus: '',
                    graphBackendSignalKind: '',
                    graphBackendIndependent: false,
                    queryBackendDefaultMode: '',
                    queryBackendScoreSignals: [],
                    vectorAdapterStatus: '',
                    vectorAdapterSignalKind: '',
                    vectorAdapterIndependent: false,
                    vectorAdapterLinkedIntoQueryBackend: false,
                    repoRootSource: '',
                    runtimeProjectRootAligned: false,
                    mandatoryCheckIds: [],
                    mandatoryChecks: [],
                    promotionCriteriaPassed: 0,
                    promotionCriteriaTotal: 0,
                    mandatoryChecksCount: 0,
                    promotionCriteriaSatisfiedIds: [],
                    promotionCriteriaUnsatisfiedIds: [],
                    promotionCriteria: [],
                    promotionBlockerIds: [],
                    promotionBlockers: [],
                    promotionBlockersCount: 0,
                    recommendations: [],
                    recommendationsCount: 0,
                };
                setBusy(true);
                try {
                    const readiness = await requestJson(
                        '/api/knowledge/foundation/readiness',
                        null,
                        {
                            method: 'GET',
                            responseKey: 'readiness',
                        }
                    );
                    const baseline = readiness && readiness.baseline && typeof readiness.baseline === 'object'
                        ? readiness.baseline
                        : {};
                    const recommendationsCount = Array.isArray(readiness && readiness.recommendations)
                        ? readiness.recommendations.length
                        : 0;
                    const mandatoryCheckIds = Array.isArray(readiness && readiness.mandatoryChecks)
                        ? readiness.mandatoryChecks
                            .map((entry) => {
                                const source = entry && typeof entry === 'object' ? entry : {};
                                return trimString(source.gateId);
                            })
                            .filter(Boolean)
                        : [];
                    const mandatoryChecks = Array.isArray(readiness && readiness.mandatoryChecks)
                        ? readiness.mandatoryChecks
                            .map((entry) => {
                                const source = entry && typeof entry === 'object' ? entry : {};
                                return {
                                    gateId: trimString(source.gateId),
                                    command: trimString(source.command),
                                };
                            })
                            .filter((entry) => entry.gateId)
                        : [];
                    const provenance = readiness && readiness.provenance && typeof readiness.provenance === 'object'
                        ? readiness.provenance
                        : {};
                    const promotionBlockers = Array.isArray(readiness && readiness.promotionBlockers)
                        ? readiness.promotionBlockers
                            .map((entry) => {
                                const source = entry && typeof entry === 'object' ? entry : {};
                                return {
                                    blockerId: trimString(source.blockerId),
                                    summary: trimString(source.summary),
                                };
                            })
                            .filter((entry) => entry.blockerId)
                        : [];
                    const promotionCriteria = Array.isArray(readiness && readiness.promotionCriteria)
                        ? readiness.promotionCriteria
                            .map((entry) => {
                                const source = entry && typeof entry === 'object' ? entry : {};
                                return {
                                    criterionId: trimString(source.criterionId),
                                    satisfied: Boolean(source.satisfied),
                                    summary: trimString(source.summary),
                                };
                            })
                            .filter((entry) => entry.criterionId)
                        : [];
                    const promotionBlockerIds = promotionBlockers.map((entry) => entry.blockerId);
                    const promotionCriteriaPassed = Number.isFinite(Number(readiness && readiness.promotionCriteriaPassed))
                        ? Number(readiness && readiness.promotionCriteriaPassed)
                        : promotionCriteria.filter((entry) => entry.satisfied).length;
                    const promotionCriteriaTotal = Number.isFinite(Number(readiness && readiness.promotionCriteriaTotal))
                        ? Number(readiness && readiness.promotionCriteriaTotal)
                        : promotionCriteria.length;
                    const promotionCriteriaSatisfiedIds = Array.isArray(readiness && readiness.promotionCriteriaSatisfiedIds)
                        ? readiness.promotionCriteriaSatisfiedIds.map((entry) => trimString(entry)).filter(Boolean)
                        : promotionCriteria.filter((entry) => entry.satisfied).map((entry) => entry.criterionId);
                    const promotionCriteriaUnsatisfiedIds = Array.isArray(readiness && readiness.promotionCriteriaUnsatisfiedIds)
                        ? readiness.promotionCriteriaUnsatisfiedIds.map((entry) => trimString(entry)).filter(Boolean)
                        : promotionCriteria.filter((entry) => !entry.satisfied).map((entry) => entry.criterionId);
                    diagnostics.lastFoundationReadiness = {
                        requestedAt,
                        respondedAt: nowIso(),
                        evaluatedAt: trimString(readiness && readiness.evaluatedAt),
                        status: trimString(readiness && readiness.status),
                        decision: trimString(readiness && readiness.decision),
                        storeType: trimString(baseline.storeType),
                        graphBackendStatus: trimString(baseline.graphBackendStatus),
                        graphBackendSignalKind: trimString(baseline.graphBackendSignalKind),
                        graphBackendIndependent: Boolean(baseline.graphBackendIndependent),
                        queryBackendDefaultMode: trimString(baseline.queryBackendDefaultMode),
                        queryBackendScoreSignals: Array.isArray(baseline.queryBackendScoreSignals)
                            ? baseline.queryBackendScoreSignals.map((entry) => trimString(entry)).filter(Boolean)
                            : [],
                        vectorAdapterStatus: trimString(baseline.vectorAdapterStatus),
                        vectorAdapterSignalKind: trimString(baseline.vectorAdapterSignalKind),
                        vectorAdapterIndependent: Boolean(baseline.vectorAdapterIndependent),
                        vectorAdapterLinkedIntoQueryBackend: Boolean(baseline.vectorAdapterLinkedIntoQueryBackend),
                        repoRootSource: trimString(provenance.repoRootSource),
                        runtimeProjectRootAligned: Boolean(provenance.runtimeProjectRootAligned),
                        mandatoryCheckIds,
                        mandatoryChecks,
                        promotionCriteriaPassed,
                        promotionCriteriaTotal,
                        mandatoryChecksCount: mandatoryCheckIds.length,
                        promotionCriteriaSatisfiedIds,
                        promotionCriteriaUnsatisfiedIds,
                        promotionCriteria,
                        promotionBlockerIds,
                        promotionBlockers,
                        promotionBlockersCount: promotionBlockerIds.length,
                        recommendations: Array.isArray(readiness && readiness.recommendations)
                            ? readiness.recommendations.map((entry) => trimString(entry)).filter(Boolean)
                            : [],
                        recommendationsCount,
                    };
                    const queryBackendScoreSignals = Array.isArray(baseline.queryBackendScoreSignals)
                        ? baseline.queryBackendScoreSignals.map((entry) => trimString(entry)).filter(Boolean)
                        : [];
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.foundationReadinessLoaded',
                            `Foundation readiness ${trimString(readiness && readiness.status) || 'unknown'} / ${trimString(readiness && readiness.decision) || 'unknown'} (store ${trimString(baseline.storeType) || 'n/a'}, graph ${trimString(baseline.graphBackendStatus) || 'n/a'}/${trimString(baseline.graphBackendSignalKind) || 'n/a'}, graph-independent ${Boolean(baseline.graphBackendIndependent) ? 'yes' : 'no'}, backend ${trimString(baseline.queryBackendDefaultMode) || 'n/a'}, signals ${queryBackendScoreSignals.join(', ') || 'none'}, vector ${trimString(baseline.vectorAdapterStatus) || 'n/a'}, signal-kind ${trimString(baseline.vectorAdapterSignalKind) || 'n/a'}, independent ${Boolean(baseline.vectorAdapterIndependent) ? 'yes' : 'no'}, linked ${Boolean(baseline.vectorAdapterLinkedIntoQueryBackend) ? 'yes' : 'no'}, repo-source ${trimString(provenance.repoRootSource) || 'n/a'}, aligned ${Boolean(provenance.runtimeProjectRootAligned) ? 'yes' : 'no'}, gates ${mandatoryCheckIds.join(', ') || 'none'}, criteria ${promotionCriteriaPassed}/${promotionCriteriaTotal}, criteria-detail ${promotionCriteria.length}, satisfied ${promotionCriteriaSatisfiedIds.join(', ') || 'none'}, unmet ${promotionCriteriaUnsatisfiedIds.join(', ') || 'none'}, blockers ${promotionBlockerIds.join(', ') || 'none'}, recommendations ${recommendationsCount}).`,
                            {
                                status: trimString(readiness && readiness.status) || 'unknown',
                                decision: trimString(readiness && readiness.decision) || 'unknown',
                                storeType: trimString(baseline.storeType) || 'n/a',
                                graphBackendStatus: trimString(baseline.graphBackendStatus) || 'n/a',
                                graphBackendSignalKind: trimString(baseline.graphBackendSignalKind) || 'n/a',
                                graphBackendIndependent: Boolean(baseline.graphBackendIndependent) ? 'yes' : 'no',
                                queryBackendDefaultMode: trimString(baseline.queryBackendDefaultMode) || 'n/a',
                                queryBackendScoreSignals: queryBackendScoreSignals.join(', ') || 'none',
                                vectorAdapterStatus: trimString(baseline.vectorAdapterStatus) || 'n/a',
                                vectorAdapterSignalKind: trimString(baseline.vectorAdapterSignalKind) || 'n/a',
                                vectorAdapterIndependent: Boolean(baseline.vectorAdapterIndependent) ? 'yes' : 'no',
                                vectorAdapterLinkedIntoQueryBackend: Boolean(baseline.vectorAdapterLinkedIntoQueryBackend)
                                    ? 'yes'
                                    : 'no',
                                repoRootSource: trimString(provenance.repoRootSource) || 'n/a',
                                runtimeProjectRootAligned: Boolean(provenance.runtimeProjectRootAligned) ? 'yes' : 'no',
                                mandatoryCheckIds: mandatoryCheckIds.join(', ') || 'none',
                                promotionCriteriaPassed,
                                promotionCriteriaTotal,
                                promotionCriteriaCount: promotionCriteria.length,
                                promotionCriteriaSatisfiedIds: promotionCriteriaSatisfiedIds.join(', ') || 'none',
                                promotionCriteriaUnsatisfiedIds: promotionCriteriaUnsatisfiedIds.join(', ') || 'none',
                                promotionBlockerIds: promotionBlockerIds.join(', ') || 'none',
                                recommendationsCount,
                            }
                        )
                    );
                } catch (error) {
                    const errorMessage = trimString(error && error.message);
                    diagnostics.lastFoundationReadiness = {
                        requestedAt,
                        respondedAt: nowIso(),
                        status: 'failed',
                        decision: '',
                        storeType: '',
                        graphBackendStatus: '',
                        graphBackendSignalKind: '',
                        graphBackendIndependent: false,
                        queryBackendDefaultMode: '',
                        queryBackendScoreSignals: [],
                        vectorAdapterStatus: '',
                        vectorAdapterSignalKind: '',
                        vectorAdapterIndependent: false,
                        vectorAdapterLinkedIntoQueryBackend: false,
                        repoRootSource: '',
                        runtimeProjectRootAligned: false,
                        mandatoryCheckIds: [],
                        mandatoryChecks: [],
                        promotionCriteriaPassed: 0,
                        promotionCriteriaTotal: 0,
                        mandatoryChecksCount: 0,
                        promotionCriteriaSatisfiedIds: [],
                        promotionCriteriaUnsatisfiedIds: [],
                        promotionCriteria: [],
                        promotionBlockerIds: [],
                        promotionBlockers: [],
                        promotionBlockersCount: 0,
                        recommendations: [],
                        recommendationsCount: 0,
                    };
                    recordFailure('loadFoundationReadiness', errorMessage);
                    appendMessage(
                        'assistant',
                        getI18nText(
                            'agentWorkspace.messages.foundationReadinessFailed',
                            `Foundation readiness request failed: ${errorMessage || 'unknown error'}.`
                        )
                    );
                    console.error('[AgentWorkspace] foundation readiness request failed:', error);
                } finally {
                    setBusy(false);
                }
            }

            function bindDom() {
                dom.panel = document.getElementById('agent-workspace-panel');
                dom.form = document.getElementById('agent-workspace-form');
                dom.userIdInput = document.getElementById('agent-workspace-user-id');
                dom.input = document.getElementById('agent-workspace-input');
                dom.sendButton = document.getElementById('agent-workspace-send');
                dom.messages = document.getElementById('agent-workspace-messages');
                dom.knowledgeList = document.getElementById('agent-workspace-knowledge-list');
                dom.openPathButton = document.getElementById('agent-workspace-open-learning-path');
                dom.closePathButton = document.getElementById('agent-workspace-close-learning-path');
                dom.pathFullscreenButton = document.getElementById('agent-workspace-path-fullscreen');
                dom.foundationReadinessButton = document.getElementById('agent-workspace-open-foundation-readiness');
                if (!dom.panel || !dom.form || !dom.input || !dom.sendButton || !dom.messages || !dom.knowledgeList) {
                    return false;
                }
                return true;
            }

            function applyI18nPlaceholders() {
                if (dom.input) {
                    dom.input.placeholder = getI18nText(
                        'agentWorkspace.placeholders.input',
                        'Ask agent to find local knowledge and run actions...'
                    );
                }
            }

            function init() {
                if (state.initialized || !globalScope.document) {
                    return;
                }
                if (!bindDom()) {
                    return;
                }
                state.initialized = true;
                document.body.classList.add(BODY_CLASS_ENABLED);
                applyI18nPlaceholders();

                if (dom.userIdInput) {
                    dom.userIdInput.value = trimString(options.defaultUserId) || 'agent_user_default';
                }
                dom.form.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    await sendConversation();
                });
                if (dom.openPathButton) {
                    dom.openPathButton.addEventListener('click', () => {
                        const activePoint = findKnowledgePoint(resolvePathAtomId(''));
                        if (activePoint) {
                            triggerPointAction('open_learning_path', activePoint);
                            return;
                        }
                        openLearningPathDock('');
                    });
                }
                if (dom.closePathButton) {
                    dom.closePathButton.addEventListener('click', () => {
                        hidePathDock();
                    });
                }
                if (dom.pathFullscreenButton) {
                    dom.pathFullscreenButton.addEventListener('click', () => {
                        togglePathFullscreen();
                    });
                }
                if (dom.foundationReadinessButton) {
                    dom.foundationReadinessButton.addEventListener('click', () => {
                        void loadFoundationReadiness();
                    });
                }
                globalScope.addEventListener('nc:pathmode:exited', () => {
                    hidePathDock();
                });
                if (globalScope.i18n && typeof globalScope.i18n.onLanguageChange === 'function') {
                    globalScope.i18n.onLanguageChange(() => {
                        applyI18nPlaceholders();
                        refreshToolbarButtons();
                        renderKnowledgePoints(state.latestKnowledgePoints);
                    });
                }
                appendMessage(
                    'system',
                    getI18nText(
                        'agentWorkspace.messages.ready',
                        'Agent workspace ready. Ask for a topic to retrieve local knowledge points.'
                    )
                );
                refreshToolbarButtons();
            }

            return {
                init,
                sendConversation,
                loadFoundationReadiness,
                openLearningPathDock,
                hidePathDock,
                togglePathFullscreen,
                getDiagnosticsSnapshot,
                getDiagnosticsTrendSnapshot,
                getDiagnosticsIndexSnapshot,
                exportDiagnosticsReport,
                persistDiagnosticsReport,
                _state: state,
            };
        }

        function initAgentWorkspaceRuntime(options = {}) {
            const runtime = createAgentWorkspaceRuntime(options);
            runtime.init();
            if (globalScope && typeof globalScope === 'object') {
                globalScope.__noteConnectionAgentWorkspaceRuntimeInstance = runtime;
            }
            return runtime;
        }

        if (globalScope && globalScope.document) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    initAgentWorkspaceRuntime();
                });
            } else {
                initAgentWorkspaceRuntime();
            }
        }

        return {
            createAgentWorkspaceRuntime,
            initAgentWorkspaceRuntime,
        };
    }
);
