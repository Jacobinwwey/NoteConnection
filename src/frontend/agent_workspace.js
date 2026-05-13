(function () {
    function getController() {
        return window.NoteConnectionWorkspacePanes || null;
    }

    function getElement(id) {
        return document.getElementById(id);
    }

    function getUserId() {
        const input = getElement('agent-workspace-user-id');
        const value = input && typeof input.value === 'string' ? input.value.trim() : '';
        return value || 'path_user_default';
    }

    function getRuntime() {
        return window.NoteConnectionRuntime || null;
    }

    function translate(key, fallback, params) {
        if (window.i18n && typeof window.i18n.t === 'function') {
            const translated = window.i18n.t(key, params || {});
            if (typeof translated === 'string' && translated !== key) {
                return translated;
            }
        }
        return formatTemplate(fallback, params || {});
    }

    function getActiveLanguage() {
        if (window.i18n && typeof window.i18n.currentLanguage === 'string') {
            return window.i18n.currentLanguage;
        }
        return 'en';
    }

    function formatTemplate(template, params) {
        return String(template || '').replace(/\{(\w+)\}/g, function (_match, name) {
            return Object.prototype.hasOwnProperty.call(params || {}, name)
                ? String(params[name] == null ? '' : params[name])
                : '';
        });
    }

    function normalizeConversationMemoryNamespaceToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'conversation') {
            return 'conversation';
        }
        if (normalized === 'learner_profile' || normalized === 'learner-profile' || normalized === 'profile') {
            return 'learner_profile';
        }
        if (normalized === 'study_session' || normalized === 'study-session' || normalized === 'session') {
            return 'study_session';
        }
        if (normalized === 'project') {
            return 'project';
        }
        return 'conversation';
    }

    function normalizeWhitespace(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function appendQueryParams(endpoint, params) {
        const payload = params && typeof params === 'object' ? params : {};
        const queryString = Object.keys(payload).reduce(function (segments, key) {
            const value = payload[key];
            if (value === undefined || value === null) {
                return segments;
            }
            const normalized = String(value).trim();
            if (!normalized) {
                return segments;
            }
            segments.push(`${encodeURIComponent(key)}=${encodeURIComponent(normalized)}`);
            return segments;
        }, []);
        if (queryString.length <= 0) {
            return endpoint;
        }
        const separator = endpoint.indexOf('?') >= 0 ? '&' : '?';
        return `${endpoint}${separator}${queryString.join('&')}`;
    }

    const KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY = {
        build_learning_path: {
            endpoint: '/api/knowledge/path',
            method: 'POST',
            defaultResultPresentation: 'learning_path_pane',
        },
        search_conversation_memory: {
            endpoint: '/api/knowledge/conversation-memory/search',
            method: 'POST',
            defaultResultPresentation: 'assistant_message',
        },
        fetch_conversation_turn_cache_diagnostics: {
            endpoint: '/api/knowledge/conversation/turn-cache/diagnostics',
            method: 'GET',
            defaultResultPresentation: 'conversation_turn_cache_diagnostics_card',
        },
        fetch_conversation_turn_cache_alert_trend: {
            endpoint: '/api/knowledge/conversation/turn-cache/diagnostics/trend',
            method: 'GET',
            defaultResultPresentation: 'conversation_turn_cache_alert_trend_card',
        },
        fetch_conversation_turn_cache_alert_trend_index: {
            endpoint: '/api/knowledge/conversation/turn-cache/diagnostics/trend/index',
            method: 'GET',
            defaultResultPresentation: 'conversation_turn_cache_alert_trend_card',
        },
        fetch_conversation_turn_cache_alert_trend_export: {
            endpoint: '/api/knowledge/conversation/turn-cache/diagnostics/trend/export',
            method: 'GET',
            defaultResultPresentation: 'conversation_turn_cache_alert_trend_card',
        },
        compare_query_backends: {
            endpoint: '/api/knowledge/query/compare-backends',
            method: 'POST',
            defaultResultPresentation: 'query_backend_comparison_card',
        },
        fetch_query_backend_diagnostics: {
            endpoint: '/api/knowledge/query-backend-diagnostics',
            method: 'GET',
            defaultResultPresentation: 'query_backend_diagnostics_card',
        },
        fetch_query_backend_comparison_history: {
            endpoint: '/api/knowledge/query/compare-backends/history',
            method: 'GET',
            defaultResultPresentation: 'query_backend_comparison_history_card',
        },
        fetch_query_backend_comparison_trend: {
            endpoint: '/api/knowledge/query/compare-backends/trend',
            method: 'GET',
            defaultResultPresentation: 'query_backend_comparison_trend_card',
        },
        fetch_tutor_adapter_telemetry: {
            endpoint: '/api/knowledge/tutor/telemetry',
            method: 'GET',
            defaultResultPresentation: 'tutor_adapter_telemetry_card',
        },
        fetch_tutor_trace_diagnostics: {
            endpoint: '/api/knowledge/tutor/trace-diagnostics',
            method: 'GET',
            defaultResultPresentation: 'tutor_trace_diagnostics_card',
        },
        fetch_learning_quality_trend: {
            endpoint: '/api/knowledge/quality/trend',
            method: 'GET',
            defaultResultPresentation: 'learning_quality_trend_card',
        },
        fetch_learning_quality_history: {
            endpoint: '/api/knowledge/quality/history',
            method: 'GET',
            defaultResultPresentation: 'learning_quality_history_card',
        },
        evaluate_learning_quality_baseline: {
            endpoint: '/api/knowledge/quality/baseline/evaluate',
            method: 'POST',
            defaultResultPresentation: 'learning_quality_baseline_evaluation_card',
        },
        fetch_session_plan_quality_trend: {
            endpoint: '/api/knowledge/session/plan/quality/trend',
            method: 'GET',
            defaultResultPresentation: 'session_plan_quality_trend_card',
        },
        fetch_session_plan_quality_history: {
            endpoint: '/api/knowledge/session/plan/quality/history',
            method: 'GET',
            defaultResultPresentation: 'session_plan_quality_history_card',
        },
        verify_runtime_capability_runbook: {
            endpoint: '/api/knowledge/runtime-capability-runbook/verify',
            method: 'GET',
            defaultResultPresentation: 'runtime_capability_runbook_verify_card',
        },
        fetch_runtime_capability_runbook_history: {
            endpoint: '/api/knowledge/runtime-capability-runbook/history',
            method: 'GET',
            defaultResultPresentation: 'runtime_capability_runbook_history_card',
        },
        fetch_runtime_capability_runbook_checks: {
            endpoint: '/api/knowledge/runtime-capability-runbook/history/checks',
            method: 'GET',
            defaultResultPresentation: 'runtime_capability_runbook_checks_card',
        },
        fetch_runtime_capability_runbook_action_queue: {
            endpoint: '/api/knowledge/runtime-capability-runbook/history/action-queue',
            method: 'GET',
            defaultResultPresentation: 'runtime_capability_runbook_action_queue_card',
        },
        fetch_session_history: {
            endpoint: '/api/knowledge/session/history',
            method: 'POST',
            defaultResultPresentation: 'session_history_card',
        },
        build_study_session: {
            endpoint: '/api/knowledge/session/plan',
            method: 'POST',
            defaultResultPresentation: 'study_session_card',
        },
        execute_tutor_action: {
            endpoint: '/api/knowledge/tutor/action',
            method: 'POST',
            defaultResultPresentation: 'assistant_message',
        },
    };

    const KNOWLEDGE_OPERATION_REQUEST_BUILDERS = {
        build_learning_path: resolveLearningPathRequestPayload,
        search_conversation_memory: resolveConversationMemorySearchRequestPayload,
        fetch_conversation_turn_cache_diagnostics: resolveConversationTurnCacheDiagnosticsRequestPayload,
        fetch_conversation_turn_cache_alert_trend: resolveConversationTurnCacheAlertTrendRequestPayload,
        fetch_conversation_turn_cache_alert_trend_index: resolveConversationTurnCacheAlertTrendRequestPayload,
        fetch_conversation_turn_cache_alert_trend_export: resolveConversationTurnCacheAlertTrendRequestPayload,
        compare_query_backends: resolveQueryBackendComparisonRequestPayload,
        fetch_query_backend_diagnostics: resolveQueryBackendDiagnosticsRequestPayload,
        fetch_query_backend_comparison_history: resolveQueryBackendComparisonHistoryRequestPayload,
        fetch_query_backend_comparison_trend: resolveQueryBackendComparisonTrendRequestPayload,
        fetch_tutor_adapter_telemetry: resolveTutorAdapterTelemetryRequestPayload,
        fetch_tutor_trace_diagnostics: resolveTutorTraceDiagnosticsRequestPayload,
        fetch_learning_quality_trend: resolveLearningQualityTrendRequestPayload,
        fetch_learning_quality_history: resolveLearningQualityHistoryRequestPayload,
        evaluate_learning_quality_baseline: resolveLearningQualityBaselineEvaluationRequestPayload,
        fetch_session_plan_quality_trend: resolveSessionPlanQualityTrendRequestPayload,
        fetch_session_plan_quality_history: resolveSessionPlanQualityHistoryRequestPayload,
        verify_runtime_capability_runbook: resolveRuntimeCapabilityRunbookVerifyRequestPayload,
        fetch_runtime_capability_runbook_history: resolveRuntimeCapabilityRunbookHistoryRequestPayload,
        fetch_runtime_capability_runbook_checks: resolveRuntimeCapabilityRunbookChecksRequestPayload,
        fetch_runtime_capability_runbook_action_queue: resolveRuntimeCapabilityRunbookActionQueueRequestPayload,
        fetch_session_history: resolveSessionHistoryRequestPayload,
        build_study_session: resolveStudySessionRequestPayload,
        execute_tutor_action: resolveTutorActionRequestPayload,
    };

    const KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES = {
        execute_tutor_action: ['tutor_action_card'],
    };

    const CAPABILITY_EXECUTION_KIND_HANDLERS = {
        knowledge_operation: executeKnowledgeOperation,
        local_focus_mode: openGraphFocus,
    };

    // Keep this exported diagnostics field for compatibility, but no action is executed via legacy fallback anymore.
    const LEGACY_ACTION_FALLBACK_HANDLERS = Object.freeze({});

    async function requestJson(endpoint, init, options) {
        const requestOptions = options && typeof options === 'object'
            ? options
            : {};
        const runtime = getRuntime();
        const url = runtime && typeof runtime.buildUrl === 'function'
            ? runtime.buildUrl(endpoint)
            : endpoint;
        const fetchInit = runtime && typeof runtime.buildFetchOptions === 'function'
            ? runtime.buildFetchOptions(init || {})
            : (init || {});
        const response = await fetch(url, {
            method: 'GET',
            ...fetchInit,
        });
        const text = await response.text();
        const payload = text ? JSON.parse(text) : {};
        if (!response.ok || payload.success === false) {
            throw new Error(String(payload.error || `Request failed: ${response.status}`));
        }
        if (requestOptions.returnEnvelope === true) {
            return payload;
        }
        return payload.result;
    }

    const AGENT_CONVERSATION_TURN_ID_HEADER = 'X-Agent-Conversation-Turn-Id';
    const AGENT_CONVERSATION_RESUME_TURN_ID_HEADER = 'X-Agent-Conversation-Resume-Turn-Id';

    function buildConversationClientTurnId() {
        const randomSuffix = Math.random().toString(36).slice(2, 10);
        return `turn_client_${Date.now().toString(36)}_${randomSuffix}`;
    }

    function createConversationStreamError(message, resumeTurnId) {
        const normalizedMessage = String(message || 'conversation_stream_failed');
        const error = new Error(normalizedMessage);
        if (resumeTurnId) {
            error.resumeTurnId = String(resumeTurnId);
        }
        return error;
    }

    function resolveConversationResumeTurnId(errorLike, fallbackTurnId) {
        const resumeTurnId = String(errorLike && errorLike.resumeTurnId || '').trim();
        if (resumeTurnId) {
            return resumeTurnId;
        }
        return String(fallbackTurnId || '').trim();
    }

    async function requestConversationSync(requestPayload, options) {
        const turnId = String(options && options.turnId || '').trim();
        const requestHeaders = {
            'Content-Type': 'application/json',
        };
        if (turnId) {
            requestHeaders[AGENT_CONVERSATION_TURN_ID_HEADER] = turnId;
            requestHeaders[AGENT_CONVERSATION_RESUME_TURN_ID_HEADER] = turnId;
        }
        return requestJson('/api/knowledge/conversation', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestPayload),
        });
    }

    function parseSseEventBlock(block) {
        const normalizedBlock = String(block || '').replace(/\r/g, '');
        const lines = normalizedBlock.split('\n');
        let eventName = 'message';
        let eventId = '';
        const dataLines = [];
        lines.forEach(function (line) {
            if (!line || line.charAt(0) === ':') {
                return;
            }
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim() || 'message';
                return;
            }
            if (line.startsWith('id:')) {
                eventId = line.slice(3).trim();
                return;
            }
            if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).replace(/^\s/, ''));
            }
        });
        return {
            eventName,
            eventId,
            data: dataLines.join('\n'),
        };
    }

    async function requestConversationStream(requestPayload, requestOptions) {
        const runtime = getRuntime();
        const endpoint = '/api/knowledge/conversation';
        const url = runtime && typeof runtime.buildUrl === 'function'
            ? runtime.buildUrl(endpoint)
            : endpoint;
        const turnId = String(requestOptions && requestOptions.turnId || '').trim();
        const requestHeaders = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
        };
        if (turnId) {
            requestHeaders[AGENT_CONVERSATION_TURN_ID_HEADER] = turnId;
        }
        const init = {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestPayload),
        };
        const fetchOptions = runtime && typeof runtime.buildFetchOptions === 'function'
            ? runtime.buildFetchOptions(init)
            : init;
        const response = await fetch(url, fetchOptions);
        let observedTurnId = turnId;
        const responseTurnId = String(
            response
            && response.headers
            && typeof response.headers.get === 'function'
            && response.headers.get('x-agent-conversation-turn-id')
            || ''
        ).trim();
        if (responseTurnId) {
            observedTurnId = responseTurnId;
        }
        if (!response.ok) {
            const text = await response.text();
            let payload = {};
            if (text) {
                try {
                    payload = JSON.parse(text);
                } catch (_error) {
                    payload = {};
                }
            }
            throw createConversationStreamError(
                String(payload && payload.error || `Request failed: ${response.status}`),
                observedTurnId
            );
        }

        const contentType = String(
            response
            && response.headers
            && typeof response.headers.get === 'function'
            && response.headers.get('content-type')
            || ''
        ).toLowerCase();
        if (
            contentType.indexOf('text/event-stream') < 0
            || !response.body
            || typeof response.body.getReader !== 'function'
        ) {
            const text = await response.text();
            let payload = {};
            if (text) {
                try {
                    payload = JSON.parse(text);
                } catch (_error) {
                    payload = {};
                }
            }
            if (payload.success === false) {
                throw createConversationStreamError(
                    String(payload.error || 'conversation_stream_fallback_failed'),
                    observedTurnId
                );
            }
            return payload.result;
        }

        const textDecoderCtor = (
            window && window.TextDecoder
                ? window.TextDecoder
                : (typeof TextDecoder === 'function' ? TextDecoder : null)
        );
        if (!textDecoderCtor) {
            throw createConversationStreamError(
                'conversation_stream_decoder_unavailable',
                observedTurnId
            );
        }
        const decoder = new textDecoderCtor();
        const reader = response.body.getReader();
        let buffer = '';
        let streamFailedMessage = '';
        let completedResult = null;

        const consumeBuffer = function (flushAll) {
            let delimiterIndex = buffer.indexOf('\n\n');
            while (delimiterIndex >= 0) {
                const block = buffer.slice(0, delimiterIndex);
                buffer = buffer.slice(delimiterIndex + 2);
                const parsed = parseSseEventBlock(block);
                if (parsed.data) {
                    try {
                        const payload = JSON.parse(parsed.data);
                        if (payload && payload.turnId) {
                            observedTurnId = String(payload.turnId);
                        }
                        if (parsed.eventName === 'turn_failed') {
                            streamFailedMessage = String(
                                payload && payload.error || 'conversation_stream_failed'
                            );
                        } else if (parsed.eventName === 'turn_completed') {
                            completedResult = payload && payload.result !== undefined
                                ? payload.result
                                : payload;
                        }
                    } catch (_error) {
                        // Ignore malformed incremental event payloads and keep waiting for final turn event.
                    }
                }
                delimiterIndex = buffer.indexOf('\n\n');
            }

            if (flushAll && buffer.trim()) {
                const parsed = parseSseEventBlock(buffer);
                if (parsed.data) {
                    try {
                        const payload = JSON.parse(parsed.data);
                        if (payload && payload.turnId) {
                            observedTurnId = String(payload.turnId);
                        }
                        if (parsed.eventName === 'turn_failed') {
                            streamFailedMessage = String(
                                payload && payload.error || 'conversation_stream_failed'
                            );
                        } else if (parsed.eventName === 'turn_completed') {
                            completedResult = payload && payload.result !== undefined
                                ? payload.result
                                : payload;
                        }
                    } catch (_error) {
                        // Ignore malformed trailing payload on flush.
                    }
                }
                buffer = '';
            }
        };

        while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
                break;
            }
            buffer += decoder.decode(chunk.value, { stream: true });
            consumeBuffer(false);
        }
        buffer += decoder.decode();
        consumeBuffer(true);

        if (streamFailedMessage) {
            throw createConversationStreamError(streamFailedMessage, observedTurnId);
        }
        if (completedResult && typeof completedResult === 'object') {
            return completedResult;
        }
        throw createConversationStreamError('conversation_stream_incomplete', observedTurnId);
    }

    async function requestConversationWithStreamingFallback(requestPayload) {
        const initialTurnId = buildConversationClientTurnId();
        try {
            return await requestConversationStream(requestPayload, {
                turnId: initialTurnId,
            });
        } catch (streamError) {
            const resumeTurnId = resolveConversationResumeTurnId(streamError, initialTurnId);
            return requestConversationSync(requestPayload, {
                turnId: resumeTurnId,
            });
        }
    }

    function resolveKnowledgeOperationTransportDescriptor(operationId) {
        if (!Object.prototype.hasOwnProperty.call(KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY, operationId)) {
            return null;
        }
        return KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY[operationId];
    }

    function resolveKnowledgeOperationRequestBuilder(operationId) {
        if (!Object.prototype.hasOwnProperty.call(KNOWLEDGE_OPERATION_REQUEST_BUILDERS, operationId)) {
            return null;
        }
        return KNOWLEDGE_OPERATION_REQUEST_BUILDERS[operationId];
    }

    function resolveKnowledgeOperationDefaultResultPresentation(operationId) {
        const transportDescriptor = resolveKnowledgeOperationTransportDescriptor(operationId);
        return String(
            transportDescriptor && transportDescriptor.defaultResultPresentation || ''
        ).trim();
    }

    function resolveKnowledgeOperationOverrideResultPresentations(operationId) {
        if (!resolveKnowledgeOperationTransportDescriptor(operationId)) {
            return [];
        }
        const knownResultPresentations = new Set(resolveResultPresentationIds());
        const defaultResultPresentation = resolveKnowledgeOperationDefaultResultPresentation(operationId);
        if (!Object.prototype.hasOwnProperty.call(KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES, operationId)) {
            return [];
        }
        const rawOverrides = KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES[operationId];
        if (!Array.isArray(rawOverrides)) {
            return [];
        }
        return Array.from(new Set(
            rawOverrides
                .map((override) => String(override || '').trim())
                .filter(Boolean)
                .filter((override) => override !== defaultResultPresentation)
                .filter((override) => knownResultPresentations.has(override))
        ));
    }

    function resolveKnowledgeOperationInvalidOverrideResultPresentations(operationId) {
        if (!resolveKnowledgeOperationTransportDescriptor(operationId)) {
            return [];
        }
        const knownResultPresentations = new Set(resolveResultPresentationIds());
        const defaultResultPresentation = resolveKnowledgeOperationDefaultResultPresentation(operationId);
        if (!Object.prototype.hasOwnProperty.call(KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES, operationId)) {
            return [];
        }
        const rawOverrides = KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES[operationId];
        if (!Array.isArray(rawOverrides)) {
            return [];
        }
        return Array.from(new Set(
            rawOverrides
                .map((override) => String(override || '').trim())
                .filter(Boolean)
                .filter((override) => (
                    override === defaultResultPresentation
                    || !knownResultPresentations.has(override)
                ))
        ));
    }

    function resolveKnowledgeOperationAllowedResultPresentations(operationId) {
        const defaultResultPresentation = resolveKnowledgeOperationDefaultResultPresentation(operationId);
        const allowedResultPresentations = [];
        if (defaultResultPresentation) {
            allowedResultPresentations.push(defaultResultPresentation);
        }
        const overrides = resolveKnowledgeOperationOverrideResultPresentations(operationId);
        overrides.forEach((override) => {
            allowedResultPresentations.push(override);
        });
        return Array.from(new Set(allowedResultPresentations));
    }

    function resolveOperationDefaultResultPresentationMap() {
        const operationIds = Object.keys(KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY);
        const mapping = {};
        operationIds.forEach((operationId) => {
            const descriptor = KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY[operationId];
            mapping[operationId] = String(descriptor && descriptor.defaultResultPresentation || '').trim();
        });
        return mapping;
    }

    function resolveOperationAllowedResultPresentationMap() {
        const operationIds = Object.keys(KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY);
        const mapping = {};
        operationIds.forEach((operationId) => {
            mapping[operationId] = resolveKnowledgeOperationAllowedResultPresentations(operationId);
        });
        return mapping;
    }

    function resolveOperationResultPresentationOverrideMap() {
        const operationIds = Object.keys(KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES);
        const mapping = {};
        operationIds.forEach((operationId) => {
            if (!resolveKnowledgeOperationTransportDescriptor(operationId)) {
                return;
            }
            mapping[operationId] = resolveKnowledgeOperationOverrideResultPresentations(operationId);
        });
        return mapping;
    }

    function resolveOperationInvalidResultPresentationOverrideMap() {
        const operationIds = Object.keys(KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES);
        const mapping = {};
        operationIds.forEach((operationId) => {
            if (!resolveKnowledgeOperationTransportDescriptor(operationId)) {
                return;
            }
            const invalidOverrides = resolveKnowledgeOperationInvalidOverrideResultPresentations(operationId);
            if (invalidOverrides.length <= 0) {
                return;
            }
            mapping[operationId] = invalidOverrides;
        });
        return mapping;
    }

    function resolveOperationUnknownResultPresentationOverrideMap() {
        const operationIds = Object.keys(KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES);
        const mapping = {};
        operationIds.forEach((operationId) => {
            if (resolveKnowledgeOperationTransportDescriptor(operationId)) {
                return;
            }
            const rawOverrides = KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES[operationId];
            if (!Array.isArray(rawOverrides)) {
                mapping[operationId] = [];
                return;
            }
            mapping[operationId] = Array.from(new Set(
                rawOverrides
                    .map((override) => String(override || '').trim())
                    .filter(Boolean)
            ));
        });
        return mapping;
    }

    function countOperationResultPresentationOverrideMapTokens(mapping) {
        if (!mapping || typeof mapping !== 'object') {
            return 0;
        }
        return Object.values(mapping).reduce((count, overrides) => {
            if (!Array.isArray(overrides)) {
                return count;
            }
            return count + overrides.length;
        }, 0);
    }

    function appendAssistantMessage(message) {
        const controller = getController();
        if (!controller) {
            return null;
        }
        return controller.appendConversationMessage({
            role: 'assistant',
            message,
        });
    }

    function appendLocalizedAssistantMessage(key, fallback, params) {
        const controller = getController();
        if (!controller) {
            return null;
        }
        return controller.appendConversationMessage({
            role: 'assistant',
            message: translate(key, fallback, params),
            messageKey: key,
            params: params || {},
        });
    }

    function appendUserMessage(message) {
        const controller = getController();
        if (!controller) {
            return null;
        }
        return controller.appendConversationMessage({
            role: 'user',
            message,
        });
    }

    function resolveLiveNodeById(nodeId) {
        if (
            window.NoteConnectionGraphView
            && typeof window.NoteConnectionGraphView.resolveNodeById === 'function'
        ) {
            return window.NoteConnectionGraphView.resolveNodeById(nodeId);
        }
        return null;
    }

    function resolveCapabilityTargetAtomId(item, capability) {
        const capabilityTargetAtomId = String(capability && capability.targetAtomId || '').trim();
        if (capabilityTargetAtomId) {
            return capabilityTargetAtomId;
        }
        return String(item && item.atomId || '').trim();
    }

    function resolveCapabilityFailureConfig(capability, defaultFailure) {
        const capabilityFailure = capability && typeof capability.failure === 'object'
            ? capability.failure
            : {};
        const overrideFailure = defaultFailure && typeof defaultFailure === 'object'
            ? defaultFailure
            : {};
        return {
            messageKey: String(
                overrideFailure.messageKey
                || capabilityFailure.messageKey
                || ''
            ).trim(),
            fallbackMessage: String(
                overrideFailure.fallbackMessage
                || capabilityFailure.fallbackMessage
                || 'Capability execution failed.'
            ),
        };
    }

    function resolveCapabilityFailureMessage(capability, params, defaultFailure) {
        const failureConfig = resolveCapabilityFailureConfig(capability, defaultFailure);
        const fallbackMessage = formatTemplate(
            failureConfig.fallbackMessage,
            params || {}
        );
        return translate(
            failureConfig.messageKey,
            fallbackMessage,
            params || {}
        );
    }

    function appendCapabilityFailureMessage(capability, params, defaultFailure) {
        const failureConfig = resolveCapabilityFailureConfig(capability, defaultFailure);
        const messageKey = failureConfig.messageKey;
        const fallbackMessage = formatTemplate(
            failureConfig.fallbackMessage,
            params || {}
        );
        if (messageKey) {
            return appendLocalizedAssistantMessage(
                messageKey,
                fallbackMessage,
                params || {}
            );
        }
        return appendAssistantMessage(resolveCapabilityFailureMessage(capability, params, defaultFailure));
    }

    function resolveLearningPathRequestPayload(item, capability) {
        const nodeId = resolveCapabilityTargetAtomId(item, capability);
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const focusAtomIds = Array.isArray(capabilityRequest.focusAtomIds) && capabilityRequest.focusAtomIds.length > 0
            ? capabilityRequest.focusAtomIds.map((atomId) => String(atomId || '').trim()).filter(Boolean)
            : [nodeId];
        return {
            userId: getUserId(),
            focusAtomIds,
            maxMasteryPaths: Number.isFinite(Number(capabilityRequest.maxMasteryPaths))
                ? Number(capabilityRequest.maxMasteryPaths)
                : 4,
            maxDivergencePaths: Number.isFinite(Number(capabilityRequest.maxDivergencePaths))
                ? Number(capabilityRequest.maxDivergencePaths)
                : 2,
            recommendedActionLimit: Number.isFinite(Number(capabilityRequest.recommendedActionLimit))
                ? Number(capabilityRequest.recommendedActionLimit)
                : 8,
        };
    }

    function resolveTutorActionRequestPayload(item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const targetAtomId = resolveCapabilityTargetAtomId(item, capability);
        return {
            userId: getUserId(),
            atomId: targetAtomId || undefined,
            actionKind: String(capabilityRequest.actionKind || capability && capability.actionId || 'generate_quiz'),
            prompt: typeof capabilityRequest.prompt === 'string' && capabilityRequest.prompt.trim()
                ? capabilityRequest.prompt.trim()
                : undefined,
            answer: typeof capabilityRequest.answer === 'string' && capabilityRequest.answer.trim()
                ? capabilityRequest.answer.trim()
                : undefined,
            adapterId: typeof capabilityRequest.adapterId === 'string' && capabilityRequest.adapterId.trim()
                ? capabilityRequest.adapterId.trim()
                : undefined,
            providerName: typeof capabilityRequest.providerName === 'string' && capabilityRequest.providerName.trim()
                ? capabilityRequest.providerName.trim()
                : undefined,
            providerMode: typeof capabilityRequest.providerMode === 'string' && capabilityRequest.providerMode.trim()
                ? capabilityRequest.providerMode.trim()
                : undefined,
        };
    }

    function resolveConversationMemorySearchRequestPayload(item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const fallbackQuery = normalizeWhitespace([
            String(item && item.title || ''),
            String(item && item.summary || ''),
            String(item && item.evidenceSnippet || ''),
        ].join(' '));
        const requestedQuery = normalizeWhitespace(String(capabilityRequest.memoryQuery || ''));
        return {
            userId: getUserId(),
            namespace: normalizeConversationMemoryNamespaceToken(capabilityRequest.memoryNamespace),
            query: requestedQuery || fallbackQuery || 'conversation memory',
            limit: Number.isFinite(Number(capabilityRequest.memoryLimit))
                ? Number(capabilityRequest.memoryLimit)
                : 6,
        };
    }

    function resolveConversationTurnCacheDiagnosticsRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            prune: capabilityRequest.turnCachePrune === true ? '1' : undefined,
        };
    }

    function resolveConversationTurnCacheAlertTrendRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            limit: Number.isFinite(Number(capabilityRequest.turnCacheTrendLimit))
                ? Number(capabilityRequest.turnCacheTrendLimit)
                : 24,
            windowSize: Number.isFinite(Number(capabilityRequest.turnCacheTrendWindowSize))
                ? Number(capabilityRequest.turnCacheTrendWindowSize)
                : 12,
            minSamples: Number.isFinite(Number(capabilityRequest.turnCacheTrendMinSamples))
                ? Number(capabilityRequest.turnCacheTrendMinSamples)
                : 6,
        };
    }

    function resolveStudySessionRequestPayload(item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const targetAtomId = resolveCapabilityTargetAtomId(item, capability);
        const focusAtomIds = Array.isArray(capabilityRequest.focusAtomIds) && capabilityRequest.focusAtomIds.length > 0
            ? capabilityRequest.focusAtomIds.map((atomId) => String(atomId || '').trim()).filter(Boolean)
            : [targetAtomId].filter(Boolean);
        return {
            userId: getUserId(),
            focusAtomIds,
            maxActions: Number.isFinite(Number(capabilityRequest.maxActions))
                ? Number(capabilityRequest.maxActions)
                : 4,
            includeDivergence: capabilityRequest.includeDivergence !== false,
            includeRetrain: capabilityRequest.includeRetrain === true,
            pathStrategy: typeof capabilityRequest.pathStrategy === 'string' && capabilityRequest.pathStrategy.trim()
                ? capabilityRequest.pathStrategy.trim()
                : 'balanced',
            pathRecommendedActionLimit: Number.isFinite(Number(capabilityRequest.pathRecommendedActionLimit))
                ? Number(capabilityRequest.pathRecommendedActionLimit)
                : 6,
        };
    }

    function resolveSessionHistoryRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            userId: getUserId(),
            limit: Number.isFinite(Number(capabilityRequest.historyLimit))
                ? Number(capabilityRequest.historyLimit)
                : 10,
            sinceMinutes: Number.isFinite(Number(capabilityRequest.sinceMinutes))
                ? Number(capabilityRequest.sinceMinutes)
                : 10080,
            refreshSource: typeof capabilityRequest.refreshSource === 'string' && capabilityRequest.refreshSource.trim()
                ? capabilityRequest.refreshSource.trim()
                : 'manual',
        };
    }

    function resolveDefaultComparisonRightBackend(leftBackend) {
        const normalizedLeft = String(leftBackend || '').trim();
        if (normalizedLeft === 'local_hybrid') {
            return 'keyword_only';
        }
        if (normalizedLeft === 'keyword_only') {
            return 'local_vector';
        }
        return 'local_hybrid';
    }

    function resolveQueryBackendComparisonRequestPayload(item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const targetAtomId = resolveCapabilityTargetAtomId(item, capability);
        const fallbackQuery = normalizeWhitespace([
            String(item && item.title || ''),
            String(item && item.summary || ''),
            String(item && item.evidenceSnippet || ''),
        ].join(' '));
        const requestedQuery = typeof capabilityRequest.query === 'string'
            ? normalizeWhitespace(capabilityRequest.query)
            : '';
        const query = requestedQuery || fallbackQuery || targetAtomId || 'local knowledge query';
        const topK = Number.isFinite(Number(capabilityRequest.topK))
            ? Number(capabilityRequest.topK)
            : 6;
        const leftBackend = typeof capabilityRequest.leftBackend === 'string'
            && capabilityRequest.leftBackend.trim()
            ? capabilityRequest.leftBackend.trim()
            : 'local_hybrid';
        let rightBackend = typeof capabilityRequest.rightBackend === 'string'
            && capabilityRequest.rightBackend.trim()
            ? capabilityRequest.rightBackend.trim()
            : resolveDefaultComparisonRightBackend(leftBackend);
        if (rightBackend === leftBackend) {
            rightBackend = resolveDefaultComparisonRightBackend(leftBackend);
        }
        return {
            query,
            topK,
            leftBackend,
            rightBackend,
        };
    }

    function resolveQueryBackendDiagnosticsRequestPayload(_item, _capability) {
        return {};
    }

    function resolveTutorAdapterTelemetryRequestPayload(_item, _capability) {
        return {};
    }

    function normalizeTutorTraceSourceToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'llm-adapter' || normalized === 'llm_adapter' || normalized === 'llmadapter') {
            return 'llm-adapter';
        }
        if (normalized === 'rule-engine' || normalized === 'rule_engine' || normalized === 'ruleengine') {
            return 'rule-engine';
        }
        return '';
    }

    function normalizeTutorProviderModeToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'local' || normalized === 'cloud') {
            return normalized;
        }
        return '';
    }

    function resolveTutorTraceDiagnosticsRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const source = normalizeTutorTraceSourceToken(capabilityRequest.tutorTraceSource);
        const providerMode = normalizeTutorProviderModeToken(capabilityRequest.tutorTraceProviderMode);
        const actionKind = String(capabilityRequest.tutorTraceActionKind || '').trim();
        const providerName = String(capabilityRequest.tutorTraceProviderName || '').trim();
        return {
            userId: getUserId(),
            source: source || 'llm-adapter',
            actionKind,
            providerName,
            providerMode,
            fallbackUsed: typeof capabilityRequest.tutorTraceFallbackUsed === 'boolean'
                ? capabilityRequest.tutorTraceFallbackUsed
                : undefined,
            limit: Number.isFinite(Number(capabilityRequest.tutorTraceLimit))
                ? Number(capabilityRequest.tutorTraceLimit)
                : 12,
        };
    }

    function resolveQueryBackendComparisonHistoryRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            limit: Number.isFinite(Number(capabilityRequest.comparisonHistoryLimit))
                ? Number(capabilityRequest.comparisonHistoryLimit)
                : 8,
        };
    }

    function resolveQueryBackendComparisonTrendRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            limit: Number.isFinite(Number(capabilityRequest.trendLimit))
                ? Number(capabilityRequest.trendLimit)
                : 12,
            windowSize: Number.isFinite(Number(capabilityRequest.trendWindowSize))
                ? Number(capabilityRequest.trendWindowSize)
                : 2,
            minSamples: Number.isFinite(Number(capabilityRequest.trendMinSamples))
                ? Number(capabilityRequest.trendMinSamples)
                : 1,
        };
    }

    function resolveLearningQualityTrendRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            userId: getUserId(),
            limit: Number.isFinite(Number(capabilityRequest.learningTrendLimit))
                ? Number(capabilityRequest.learningTrendLimit)
                : 12,
            windowSize: Number.isFinite(Number(capabilityRequest.learningTrendWindowSize))
                ? Number(capabilityRequest.learningTrendWindowSize)
                : 2,
            minSamples: Number.isFinite(Number(capabilityRequest.learningTrendMinSamples))
                ? Number(capabilityRequest.learningTrendMinSamples)
                : 1,
        };
    }

    function resolveSessionPlanQualityTrendRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            userId: getUserId(),
            limit: Number.isFinite(Number(capabilityRequest.sessionPlanTrendLimit))
                ? Number(capabilityRequest.sessionPlanTrendLimit)
                : 12,
            windowSize: Number.isFinite(Number(capabilityRequest.sessionPlanTrendWindowSize))
                ? Number(capabilityRequest.sessionPlanTrendWindowSize)
                : 2,
            minSamples: Number.isFinite(Number(capabilityRequest.sessionPlanTrendMinSamples))
                ? Number(capabilityRequest.sessionPlanTrendMinSamples)
                : 1,
        };
    }

    function resolveLearningQualityHistoryRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            userId: getUserId(),
            limit: Number.isFinite(Number(capabilityRequest.learningHistoryLimit))
                ? Number(capabilityRequest.learningHistoryLimit)
                : 12,
        };
    }

    function resolveLearningQualityBaselineEvaluationRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const requestPayload = {
            userId: getUserId(),
            sampledAt: typeof capabilityRequest.learningBaselineSampledAt === 'string'
                && capabilityRequest.learningBaselineSampledAt.trim()
                ? capabilityRequest.learningBaselineSampledAt.trim()
                : undefined,
            historyWindowDays: Number.isFinite(Number(capabilityRequest.learningBaselineHistoryWindowDays))
                ? Number(capabilityRequest.learningBaselineHistoryWindowDays)
                : undefined,
        };
        if (capabilityRequest.currentSnapshot && typeof capabilityRequest.currentSnapshot === 'object') {
            requestPayload.current = capabilityRequest.currentSnapshot;
        }
        if (capabilityRequest.thresholds && typeof capabilityRequest.thresholds === 'object') {
            requestPayload.thresholds = capabilityRequest.thresholds;
        }
        return requestPayload;
    }

    function resolveSessionPlanQualityHistoryRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            userId: getUserId(),
            limit: Number.isFinite(Number(capabilityRequest.sessionPlanHistoryLimit))
                ? Number(capabilityRequest.sessionPlanHistoryLimit)
                : 12,
        };
    }

    function normalizeRunbookVerificationStatusToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'pass' || normalized === 'warn' || normalized === 'fail' || normalized === 'unknown') {
            return normalized;
        }
        return '';
    }

    function normalizeRunbookVerificationFocusToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'recommended' || normalized === 'none') {
            return normalized;
        }
        return '';
    }

    function normalizeRunbookQueuePriorityToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'p0' || normalized === 'p1' || normalized === 'p2') {
            return normalized;
        }
        return 'all';
    }

    function normalizeRunbookQueueCategoryToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (
            normalized === 'stabilize'
            || normalized === 'governance'
            || normalized === 'trend'
            || normalized === 'routing'
            || normalized === 'evidence'
            || normalized === 'verify'
            || normalized === 'monitor'
        ) {
            return normalized;
        }
        return 'all';
    }

    function normalizeRunbookRemediationStatusToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (
            normalized === 'applied'
            || normalized === 'not_applied'
            || normalized === 'cooldown'
            || normalized === 'error'
            || normalized === 'ignored'
        ) {
            return normalized;
        }
        return 'all';
    }

    function normalizeRunbookRemediationTrendToken(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (
            normalized === 'improving'
            || normalized === 'stable'
            || normalized === 'regressing'
            || normalized === 'insufficient_data'
        ) {
            return normalized;
        }
        return 'all';
    }

    function resolveRuntimeCapabilityRunbookVerifyRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const checkId = String(capabilityRequest.runbookCheckId || '').trim();
        const focusMode = normalizeRunbookVerificationFocusToken(capabilityRequest.runbookFocus)
            || (checkId ? 'none' : 'recommended');
        return {
            checkId,
            focus: focusMode,
            focusLimit: Number.isFinite(Number(capabilityRequest.runbookFocusLimit))
                ? Number(capabilityRequest.runbookFocusLimit)
                : 12,
            sinceMinutes: Number.isFinite(Number(capabilityRequest.runbookSinceMinutes))
                ? Number(capabilityRequest.runbookSinceMinutes)
                : 1440,
            status: normalizeRunbookVerificationStatusToken(capabilityRequest.runbookStatus),
            checkQuery: String(capabilityRequest.runbookCheckQuery || '').trim(),
            limit: Number.isFinite(Number(capabilityRequest.runbookTraceLimit))
                ? Number(capabilityRequest.runbookTraceLimit)
                : 20,
        };
    }

    function resolveRuntimeCapabilityRunbookHistoryRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            limit: Number.isFinite(Number(capabilityRequest.runbookHistoryLimit))
                ? Number(capabilityRequest.runbookHistoryLimit)
                : 12,
            checkId: String(capabilityRequest.runbookCheckId || '').trim(),
            sinceMinutes: Number.isFinite(Number(capabilityRequest.runbookSinceMinutes))
                ? Number(capabilityRequest.runbookSinceMinutes)
                : 10080,
            status: normalizeRunbookVerificationStatusToken(capabilityRequest.runbookStatus),
        };
    }

    function resolveRuntimeCapabilityRunbookChecksRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            limit: Number.isFinite(Number(capabilityRequest.runbookChecksLimit))
                ? Number(capabilityRequest.runbookChecksLimit)
                : (
                    Number.isFinite(Number(capabilityRequest.runbookHistoryLimit))
                        ? Number(capabilityRequest.runbookHistoryLimit)
                        : 8
                ),
            sinceMinutes: Number.isFinite(Number(capabilityRequest.runbookSinceMinutes))
                ? Number(capabilityRequest.runbookSinceMinutes)
                : 10080,
            status: normalizeRunbookVerificationStatusToken(capabilityRequest.runbookStatus),
            checkQuery: String(capabilityRequest.runbookCheckQuery || '').trim(),
        };
    }

    function resolveRuntimeCapabilityRunbookActionQueueRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        return {
            limit: Number.isFinite(Number(capabilityRequest.runbookChecksLimit))
                ? Number(capabilityRequest.runbookChecksLimit)
                : (
                    Number.isFinite(Number(capabilityRequest.runbookHistoryLimit))
                        ? Number(capabilityRequest.runbookHistoryLimit)
                        : 8
                ),
            sinceMinutes: Number.isFinite(Number(capabilityRequest.runbookSinceMinutes))
                ? Number(capabilityRequest.runbookSinceMinutes)
                : 10080,
            status: normalizeRunbookVerificationStatusToken(capabilityRequest.runbookStatus),
            checkQuery: String(capabilityRequest.runbookCheckQuery || '').trim(),
            queueLimit: Number.isFinite(Number(capabilityRequest.runbookQueueLimit))
                ? Number(capabilityRequest.runbookQueueLimit)
                : 12,
            priority: normalizeRunbookQueuePriorityToken(capabilityRequest.runbookQueuePriority),
            category: normalizeRunbookQueueCategoryToken(capabilityRequest.runbookQueueCategory),
            checkId: String(capabilityRequest.runbookCheckId || '').trim(),
            remediationStatus: normalizeRunbookRemediationStatusToken(capabilityRequest.runbookRemediationStatus),
            remediationTrend: normalizeRunbookRemediationTrendToken(capabilityRequest.runbookRemediationTrend),
        };
    }

    function buildConversationTurnCacheDiagnosticsCardPayload(result) {
        const summary = result && typeof result === 'object'
            ? result
            : {};
        const config = summary && typeof summary.config === 'object'
            ? summary.config
            : {};
        const state = summary && typeof summary.state === 'object'
            ? summary.state
            : {};
        const counters = summary && typeof summary.counters === 'object'
            ? summary.counters
            : {};
        const alerts = summary && typeof summary.alerts === 'object'
            ? summary.alerts
            : {};
        const alertChecks = Array.isArray(alerts.checks)
            ? alerts.checks.filter((item) => item && typeof item === 'object')
            : [];
        const normalizedAlertChecks = alertChecks.map((item) => ({
            checkId: String(item.checkId || '').trim(),
            severity: String(item.severity || '').trim().toLowerCase(),
            value: Number.isFinite(Number(item.value))
                ? Number(item.value)
                : 0,
            warnThreshold: Number.isFinite(Number(item.warnThreshold))
                ? Number(item.warnThreshold)
                : 0,
            failThreshold: Number.isFinite(Number(item.failThreshold))
                ? Number(item.failThreshold)
                : 0,
        }));
        const failAlertChecks = normalizedAlertChecks.filter((item) => item.severity === 'fail');
        const warnAlertChecks = normalizedAlertChecks.filter((item) => item.severity === 'warn');
        const topAlert = failAlertChecks[0] || warnAlertChecks[0] || normalizedAlertChecks[0] || null;
        const alertThresholds = config && typeof config.alertThresholds === 'object'
            ? config.alertThresholds
            : {};
        return {
            generatedAt: String(summary.generatedAt || '').trim(),
            ttlMs: Number.isFinite(Number(config.ttlMs))
                ? Number(config.ttlMs)
                : 0,
            maxEntries: Number.isFinite(Number(config.maxEntries))
                ? Number(config.maxEntries)
                : 0,
            maxEventsPerTurn: Number.isFinite(Number(config.maxEventsPerTurn))
                ? Number(config.maxEventsPerTurn)
                : 0,
            utilizationWarnPct: Number.isFinite(Number(alertThresholds.utilizationWarnPct))
                ? Number(alertThresholds.utilizationWarnPct)
                : 0,
            utilizationFailPct: Number.isFinite(Number(alertThresholds.utilizationFailPct))
                ? Number(alertThresholds.utilizationFailPct)
                : 0,
            executionFailureRatioWarnPct: Number.isFinite(Number(alertThresholds.executionFailureRatioWarnPct))
                ? Number(alertThresholds.executionFailureRatioWarnPct)
                : 0,
            executionFailureRatioFailPct: Number.isFinite(Number(alertThresholds.executionFailureRatioFailPct))
                ? Number(alertThresholds.executionFailureRatioFailPct)
                : 0,
            conflictWarnCount: Number.isFinite(Number(alertThresholds.conflictWarnCount))
                ? Number(alertThresholds.conflictWarnCount)
                : 0,
            conflictFailCount: Number.isFinite(Number(alertThresholds.conflictFailCount))
                ? Number(alertThresholds.conflictFailCount)
                : 0,
            staleEligibleWarnCount: Number.isFinite(Number(alertThresholds.staleEligibleWarnCount))
                ? Number(alertThresholds.staleEligibleWarnCount)
                : 0,
            staleEligibleFailCount: Number.isFinite(Number(alertThresholds.staleEligibleFailCount))
                ? Number(alertThresholds.staleEligibleFailCount)
                : 0,
            totalEntries: Number.isFinite(Number(state.totalEntries))
                ? Number(state.totalEntries)
                : 0,
            runningEntries: Number.isFinite(Number(state.runningEntries))
                ? Number(state.runningEntries)
                : 0,
            completedEntries: Number.isFinite(Number(state.completedEntries))
                ? Number(state.completedEntries)
                : 0,
            failedEntries: Number.isFinite(Number(state.failedEntries))
                ? Number(state.failedEntries)
                : 0,
            inFlightEntries: Number.isFinite(Number(state.inFlightEntries))
                ? Number(state.inFlightEntries)
                : 0,
            staleEligibleEntries: Number.isFinite(Number(state.staleEligibleEntries))
                ? Number(state.staleEligibleEntries)
                : 0,
            utilizationPct: Number(Number(state.utilizationPct || 0).toFixed(2)),
            oldestEntryAgeMs: Number.isFinite(Number(state.oldestEntryAgeMs))
                ? Number(state.oldestEntryAgeMs)
                : 0,
            newestEntryAgeMs: Number.isFinite(Number(state.newestEntryAgeMs))
                ? Number(state.newestEntryAgeMs)
                : 0,
            cacheHitCount: Number.isFinite(Number(counters.cacheHitCount))
                ? Number(counters.cacheHitCount)
                : 0,
            cacheMissCount: Number.isFinite(Number(counters.cacheMissCount))
                ? Number(counters.cacheMissCount)
                : 0,
            cacheHitRatioPct: Number(Number(counters.cacheHitRatioPct || 0).toFixed(2)),
            executionFailureRatioPct: Number(Number(counters.executionFailureRatioPct || 0).toFixed(2)),
            conflictCount: Number.isFinite(Number(counters.conflictCount))
                ? Number(counters.conflictCount)
                : 0,
            replayResponseCount: Number.isFinite(Number(counters.replayResponseCount))
                ? Number(counters.replayResponseCount)
                : 0,
            replayedEventCount: Number.isFinite(Number(counters.replayedEventCount))
                ? Number(counters.replayedEventCount)
                : 0,
            inFlightJoinCount: Number.isFinite(Number(counters.inFlightJoinCount))
                ? Number(counters.inFlightJoinCount)
                : 0,
            executionStartCount: Number.isFinite(Number(counters.executionStartCount))
                ? Number(counters.executionStartCount)
                : 0,
            executionSuccessCount: Number.isFinite(Number(counters.executionSuccessCount))
                ? Number(counters.executionSuccessCount)
                : 0,
            executionFailureCount: Number.isFinite(Number(counters.executionFailureCount))
                ? Number(counters.executionFailureCount)
                : 0,
            syncReuseCount: Number.isFinite(Number(counters.syncReuseCount))
                ? Number(counters.syncReuseCount)
                : 0,
            evictedByTtlCount: Number.isFinite(Number(counters.evictedByTtlCount))
                ? Number(counters.evictedByTtlCount)
                : 0,
            evictedByCapacityCount: Number.isFinite(Number(counters.evictedByCapacityCount))
                ? Number(counters.evictedByCapacityCount)
                : 0,
            alertSummaryStatus: String(alerts.summaryStatus || '').trim().toLowerCase() || 'pass',
            alertFailingCheckCount: Number.isFinite(Number(alerts.failingCheckCount))
                ? Number(alerts.failingCheckCount)
                : (failAlertChecks.length + warnAlertChecks.length),
            alertWarnCheckCount: Number.isFinite(Number(alerts.warnCheckCount))
                ? Number(alerts.warnCheckCount)
                : warnAlertChecks.length,
            alertFailCheckCount: Number.isFinite(Number(alerts.failCheckCount))
                ? Number(alerts.failCheckCount)
                : failAlertChecks.length,
            alertTopCheckId: topAlert ? String(topAlert.checkId || '').trim() : '',
            alertTopCheckSeverity: topAlert ? String(topAlert.severity || '').trim().toLowerCase() : '',
            alertTopCheckValue: topAlert && Number.isFinite(Number(topAlert.value))
                ? Number(topAlert.value)
                : 0,
            lastPrunedAt: String(counters.lastPrunedAt || '').trim(),
            lastConflictAt: String(counters.lastConflictAt || '').trim(),
        };
    }

    function buildConversationTurnCacheAlertTrendCardPayload(result) {
        const summary = result && typeof result === 'object'
            ? result
            : {};
        const config = summary && typeof summary.config === 'object'
            ? summary.config
            : {};
        const trendSummary = summary && typeof summary.summary === 'object'
            ? summary.summary
            : {};
        const latest = summary && typeof summary.latest === 'object'
            ? summary.latest
            : {};
        const storage = summary && typeof summary.storage === 'object'
            ? summary.storage
            : {};
        return {
            generatedAt: String(summary.generatedAt || '').trim(),
            historyLimit: Number.isFinite(Number(config.historyLimit))
                ? Number(config.historyLimit)
                : 0,
            sampleMinIntervalMs: Number.isFinite(Number(config.sampleMinIntervalMs))
                ? Number(config.sampleMinIntervalMs)
                : 0,
            trendWindowSize: Number.isFinite(Number(config.windowSize))
                ? Number(config.windowSize)
                : 0,
            trendMinSamples: Number.isFinite(Number(config.minSamples))
                ? Number(config.minSamples)
                : 0,
            returnedRecords: Number.isFinite(Number(trendSummary.returnedRecords))
                ? Number(trendSummary.returnedRecords)
                : 0,
            totalRecords: Number.isFinite(Number(trendSummary.totalRecords))
                ? Number(trendSummary.totalRecords)
                : 0,
            statusPassCount: Number.isFinite(Number(trendSummary.statusPassCount))
                ? Number(trendSummary.statusPassCount)
                : 0,
            statusWarnCount: Number.isFinite(Number(trendSummary.statusWarnCount))
                ? Number(trendSummary.statusWarnCount)
                : 0,
            statusFailCount: Number.isFinite(Number(trendSummary.statusFailCount))
                ? Number(trendSummary.statusFailCount)
                : 0,
            activeWarnStreak: Number.isFinite(Number(trendSummary.activeWarnStreak))
                ? Number(trendSummary.activeWarnStreak)
                : 0,
            activeFailStreak: Number.isFinite(Number(trendSummary.activeFailStreak))
                ? Number(trendSummary.activeFailStreak)
                : 0,
            trendStatus: String(trendSummary.trendStatus || '').trim().toLowerCase() || 'insufficient_data',
            recommendedEscalation: String(trendSummary.recommendedEscalation || '').trim().toLowerCase() || 'normal',
            reason: String(trendSummary.reason || '').trim(),
            latestSampledAt: String(trendSummary.latestSampledAt || '').trim(),
            latestSummaryStatus: String(latest.summaryStatus || '').trim().toLowerCase() || 'pass',
            latestFailingCheckCount: Number.isFinite(Number(latest.failingCheckCount))
                ? Number(latest.failingCheckCount)
                : 0,
            latestWarnCheckCount: Number.isFinite(Number(latest.warnCheckCount))
                ? Number(latest.warnCheckCount)
                : 0,
            latestFailCheckCount: Number.isFinite(Number(latest.failCheckCount))
                ? Number(latest.failCheckCount)
                : 0,
            latestTopCheckId: String(latest.topCheckId || '').trim(),
            latestTopCheckSeverity: String(latest.topCheckSeverity || '').trim().toLowerCase() || 'pass',
            latestTopCheckValue: Number.isFinite(Number(latest.topCheckValue))
                ? Number(latest.topCheckValue)
                : 0,
            latestUtilizationPct: Number(Number(latest.utilizationPct || 0).toFixed(2)),
            latestExecutionFailureRatioPct: Number(Number(latest.executionFailureRatioPct || 0).toFixed(2)),
            latestConflictCount: Number.isFinite(Number(latest.conflictCount))
                ? Number(latest.conflictCount)
                : 0,
            latestStaleEligibleEntries: Number.isFinite(Number(latest.staleEligibleEntries))
                ? Number(latest.staleEligibleEntries)
                : 0,
            latestTotalEntries: Number.isFinite(Number(latest.totalEntries))
                ? Number(latest.totalEntries)
                : 0,
            storageFilePath: String(storage.filePath || '').trim(),
            storageSchemaVersion: Number.isFinite(Number(storage.schemaVersion))
                ? Number(storage.schemaVersion)
                : 0,
            storageTotalRecords: Number.isFinite(Number(storage.totalRecords))
                ? Number(storage.totalRecords)
                : 0,
            storageConfiguredHistoryLimit: Number.isFinite(Number(storage.configuredHistoryLimit))
                ? Number(storage.configuredHistoryLimit)
                : 0,
            storageLastLoadedAt: String(storage.lastLoadedAt || '').trim(),
            storageLastLoadedRecordCount: Number.isFinite(Number(storage.lastLoadedRecordCount))
                ? Number(storage.lastLoadedRecordCount)
                : 0,
            storageLastPersistedAt: String(storage.lastPersistedAt || '').trim(),
            storageLastPersistedRecordCount: Number.isFinite(Number(storage.lastPersistedRecordCount))
                ? Number(storage.lastPersistedRecordCount)
                : 0,
            storageLastPersistReason: String(storage.lastPersistReason || '').trim(),
            storageLoadError: String(storage.loadError || '').trim(),
            storagePersistError: String(storage.persistError || '').trim(),
            trendIndexEndpointHint: '/api/knowledge/conversation/turn-cache/diagnostics/trend/index',
            trendExportEndpointHint: '/api/knowledge/conversation/turn-cache/diagnostics/trend/export',
        };
    }

    function buildQueryBackendComparisonCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const leftBackend = String(result && result.left && result.left.backend || '').trim() || 'left';
        const rightBackend = String(result && result.right && result.right.backend || '').trim() || 'right';
        const preferredRaw = String(summary && summary.preferredBackend || 'tie').trim().toLowerCase();
        const preferredBackendLabel = preferredRaw === 'left'
            ? leftBackend
            : (preferredRaw === 'right' ? rightBackend : 'tie');
        return {
            comparedAt: String(result && result.comparedAt || '').trim(),
            query: String(result && result.query || '').trim(),
            topK: Number.isFinite(Number(result && result.topK))
                ? Number(result.topK)
                : 0,
            leftBackend,
            rightBackend,
            preferredBackendLabel,
            preferredReason: String(summary && summary.reason || '').trim(),
            overlapRatioPct: Number(Number(summary && summary.overlapRatioPct || 0).toFixed(2)),
            latencyDeltaMs: Number(Number(summary && summary.latencyDeltaMs || 0).toFixed(2)),
            leftEvidenceCoveragePct: Number((Number(summary && summary.leftEvidenceCoverageRatio || 0) * 100).toFixed(2)),
            rightEvidenceCoveragePct: Number((Number(summary && summary.rightEvidenceCoverageRatio || 0) * 100).toFixed(2)),
            leftRelationPathCoveragePct: Number((Number(summary && summary.leftRelationPathCoverageRatio || 0) * 100).toFixed(2)),
            rightRelationPathCoveragePct: Number((Number(summary && summary.rightRelationPathCoverageRatio || 0) * 100).toFixed(2)),
            leftTemporalValidityPassPct: Number((Number(summary && summary.leftTemporalValidityPassRatio || 0) * 100).toFixed(2)),
            rightTemporalValidityPassPct: Number((Number(summary && summary.rightTemporalValidityPassRatio || 0) * 100).toFixed(2)),
        };
    }

    function buildQueryBackendDiagnosticsCardPayload(result, responseEnvelope) {
        const summary = result && typeof result === 'object'
            ? result
            : {};
        const envelope = responseEnvelope && typeof responseEnvelope === 'object'
            ? responseEnvelope
            : {};
        const runtime = summary && typeof summary.runtime === 'object'
            ? summary.runtime
            : {};
        const rendererRuntime = summary && typeof summary.rendererRuntime === 'object'
            ? summary.rendererRuntime
            : {};
        const graphvizRuntime = rendererRuntime && typeof rendererRuntime.graphviz === 'object'
            ? rendererRuntime.graphviz
            : {};
        const vectorIndex = runtime && typeof runtime.vectorIndex === 'object'
            ? runtime.vectorIndex
            : {};
        const acceleration = vectorIndex && typeof vectorIndex.acceleration === 'object'
            ? vectorIndex.acceleration
            : {};
        const comparisonTelemetry = summary && typeof summary.comparisonTelemetry === 'object'
            ? summary.comparisonTelemetry
            : {};
        const rolloutProfile = summary && typeof summary.rolloutProfile === 'object'
            ? summary.rolloutProfile
            : (envelope && typeof envelope.rolloutProfile === 'object'
                ? envelope.rolloutProfile
                : {});
        const rolloutVectorAcceleration = rolloutProfile && typeof rolloutProfile.vectorAcceleration === 'object'
            ? rolloutProfile.vectorAcceleration
            : {};
        const configuredBackend = String(
            summary.configuredBackend
            || envelope.configuredBackend
            || ''
        ).trim();
        const configuredVectorAccelerationProvider = String(
            summary.configuredVectorAccelerationProvider
            || envelope.configuredVectorAccelerationProvider
            || rolloutVectorAcceleration.provider
            || ''
        ).trim();
        const configuredVectorAccelerationFailureMode = String(
            summary.configuredVectorAccelerationFailureMode
            || envelope.configuredVectorAccelerationFailureMode
            || rolloutVectorAcceleration.failureMode
            || ''
        ).trim();
        const configuredVectorAccelerationRepresentationStrict = (() => {
            if (typeof summary.configuredVectorAccelerationRepresentationStrict === 'boolean') {
                return summary.configuredVectorAccelerationRepresentationStrict;
            }
            if (typeof envelope.configuredVectorAccelerationRepresentationStrict === 'boolean') {
                return envelope.configuredVectorAccelerationRepresentationStrict;
            }
            if (typeof rolloutVectorAcceleration.representationStrict === 'boolean') {
                return rolloutVectorAcceleration.representationStrict;
            }
            return null;
        })();
        const queryVectorAnnPrefilterEnabled = typeof summary.queryVectorAnnPrefilterEnabled === 'boolean'
            ? summary.queryVectorAnnPrefilterEnabled
            : (typeof envelope.queryVectorAnnPrefilterEnabled === 'boolean'
                ? envelope.queryVectorAnnPrefilterEnabled
                : null);
        const rolloutMode = String(
            summary.rolloutMode
            || rolloutProfile.mode
            || envelope.rolloutMode
            || ''
        ).trim();
        return {
            backendId: String(summary.backendId || '').trim(),
            configuredBackend,
            fallbackCount: Number.isFinite(Number(summary.fallbackCount))
                ? Number(summary.fallbackCount)
                : 0,
            fallbackBackendId: String(summary.fallbackBackendId || '').trim(),
            lastError: String(summary.lastError || '').trim(),
            totalComparisons: Number.isFinite(Number(comparisonTelemetry.totalComparisons))
                ? Number(comparisonTelemetry.totalComparisons)
                : 0,
            averageOverlapRatioPct: Number(Number(comparisonTelemetry.averageOverlapRatioPct || 0).toFixed(2)),
            averageLatencyDeltaMs: Number(Number(comparisonTelemetry.averageLatencyDeltaMs || 0).toFixed(2)),
            leftPreferredCount: Number.isFinite(Number(comparisonTelemetry.leftPreferredCount))
                ? Number(comparisonTelemetry.leftPreferredCount)
                : 0,
            rightPreferredCount: Number.isFinite(Number(comparisonTelemetry.rightPreferredCount))
                ? Number(comparisonTelemetry.rightPreferredCount)
                : 0,
            tieCount: Number.isFinite(Number(comparisonTelemetry.tieCount))
                ? Number(comparisonTelemetry.tieCount)
                : 0,
            runtimeReady: Boolean(runtime.ready),
            runtimeLastError: String(runtime.lastError || '').trim(),
            graphvizRuntimeAvailable: typeof graphvizRuntime.backendPngRuntimeAvailable === 'boolean'
                ? graphvizRuntime.backendPngRuntimeAvailable
                : null,
            graphvizDotBinary: String(graphvizRuntime.dotBinary || '').trim(),
            graphvizRuntimeReason: String(graphvizRuntime.reason || '').trim(),
            graphvizCheckedAtMs: Number.isFinite(Number(graphvizRuntime.checkedAtMs))
                ? Number(graphvizRuntime.checkedAtMs)
                : 0,
            graphvizProbeCacheTtlMs: Number.isFinite(Number(graphvizRuntime.probeCacheTtlMs))
                ? Number(graphvizRuntime.probeCacheTtlMs)
                : 0,
            vectorIndexStatus: String(vectorIndex.status || '').trim() || 'unknown',
            vectorIndexAtomCount: Number.isFinite(Number(vectorIndex.atomCount))
                ? Number(vectorIndex.atomCount)
                : 0,
            vectorAccelerationMode: String(acceleration.mode || '').trim() || 'unknown',
            vectorAccelerationSelectionMode: String(acceleration.lastSelectionMode || '').trim() || 'unknown',
            vectorAccelerationHealthStatus: String(acceleration.healthStatus || '').trim() || 'unknown',
            vectorAccelerationCircuitState: String(acceleration.circuitState || '').trim() || 'unknown',
            configuredVectorAccelerationProvider,
            configuredVectorAccelerationFailureMode,
            configuredVectorAccelerationRepresentationStrict,
            queryVectorAnnPrefilterEnabled,
            rolloutMode: rolloutMode || 'unknown',
        };
    }

    function buildQueryBackendComparisonHistoryCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const preferredCounts = summary && typeof summary.preferredCounts === 'object'
            ? summary.preferredCounts
            : {};
        return {
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : 0,
            returnedRecords: Number.isFinite(Number(summary.returnedRecords))
                ? Number(summary.returnedRecords)
                : 0,
            averageOverlapRatioPct: Number(Number(summary.averageOverlapRatioPct || 0).toFixed(2)),
            averageLatencyDeltaMs: Number(Number(summary.averageLatencyDeltaMs || 0).toFixed(2)),
            averageLeftEvidenceCoveragePct: Number((Number(summary.averageLeftEvidenceCoverageRatio || 0) * 100).toFixed(2)),
            averageRightEvidenceCoveragePct: Number((Number(summary.averageRightEvidenceCoverageRatio || 0) * 100).toFixed(2)),
            leftPreferredCount: Number.isFinite(Number(preferredCounts.left))
                ? Number(preferredCounts.left)
                : 0,
            rightPreferredCount: Number.isFinite(Number(preferredCounts.right))
                ? Number(preferredCounts.right)
                : 0,
            tieCount: Number.isFinite(Number(preferredCounts.tie))
                ? Number(preferredCounts.tie)
                : 0,
            latestComparedAt: String(summary.latestComparedAt || '').trim(),
        };
    }

    function buildTutorAdapterTelemetryCardPayload(result, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const adapters = Array.isArray(result && result.adapters)
            ? result.adapters
                .slice()
                .sort((left, right) => {
                    const leftRequests = Number(left && left.totalRequests || 0);
                    const rightRequests = Number(right && right.totalRequests || 0);
                    if (rightRequests !== leftRequests) {
                        return rightRequests - leftRequests;
                    }
                    return String(left && left.adapterId || '').localeCompare(String(right && right.adapterId || ''));
                })
            : [];
        const adapterLimit = Number.isFinite(Number(capabilityRequest.tutorTelemetryAdapterLimit))
            ? Math.max(1, Number(capabilityRequest.tutorTelemetryAdapterLimit))
            : 6;
        const selectedAdapters = adapters.slice(0, adapterLimit);
        const firstAdapter = selectedAdapters.length > 0 ? selectedAdapters[0] : null;
        return {
            totalAdapters: Number.isFinite(Number(summary.totalAdapters))
                ? Number(summary.totalAdapters)
                : adapters.length,
            activeAdapters: Number.isFinite(Number(summary.activeAdapters))
                ? Number(summary.activeAdapters)
                : adapters.length,
            totalRequests: Number.isFinite(Number(summary.totalRequests))
                ? Number(summary.totalRequests)
                : 0,
            acceptedResponses: Number.isFinite(Number(summary.acceptedResponses))
                ? Number(summary.acceptedResponses)
                : 0,
            failedResponses: Number.isFinite(Number(summary.failedResponses))
                ? Number(summary.failedResponses)
                : 0,
            providerFallbackRatioPct: Number(Number(summary.providerFallbackRatioPct || 0).toFixed(2)),
            averageProviderAttemptCount: Number(Number(summary.averageProviderAttemptCount || 0).toFixed(2)),
            averageConfidencePct: Number((Number(summary.averageConfidence || 0) * 100).toFixed(2)),
            lastRoutingStrategy: String(summary.lastRoutingStrategy || '').trim(),
            lastRoutingDynamicPreferredMode: String(summary.lastRoutingDynamicPreferredMode || '').trim(),
            firstAdapterId: String(firstAdapter && firstAdapter.adapterId || '').trim(),
            firstAdapterMode: String(firstAdapter && firstAdapter.mode || '').trim() || 'unknown',
            firstAdapterTotalRequests: Number.isFinite(Number(firstAdapter && firstAdapter.totalRequests))
                ? Number(firstAdapter && firstAdapter.totalRequests)
                : 0,
            firstAdapterFallbackRatioPct: Number(Number(firstAdapter && firstAdapter.providerFallbackRatioPct || 0).toFixed(2)),
            firstAdapterLastError: String(firstAdapter && firstAdapter.lastError || '').trim(),
        };
    }

    function buildTutorTraceDiagnosticsCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const filters = result && typeof result.filters === 'object'
            ? result.filters
            : {};
        const providerBreakdown = Array.isArray(result && result.providerBreakdown)
            ? result.providerBreakdown
            : [];
        const topProvider = providerBreakdown.length > 0 ? providerBreakdown[0] : null;
        const records = Array.isArray(result && result.records)
            ? result.records
            : [];
        const firstRecord = records.length > 0 ? records[0] : null;
        return {
            matchedTraces: Number.isFinite(Number(summary.matchedTraces))
                ? Number(summary.matchedTraces)
                : 0,
            returnedTraces: Number.isFinite(Number(summary.returnedTraces))
                ? Number(summary.returnedTraces)
                : 0,
            llmAdapterTraces: Number.isFinite(Number(summary.llmAdapterTraces))
                ? Number(summary.llmAdapterTraces)
                : 0,
            ruleEngineTraces: Number.isFinite(Number(summary.ruleEngineTraces))
                ? Number(summary.ruleEngineTraces)
                : 0,
            verifiedTraces: Number.isFinite(Number(summary.verifiedTraces))
                ? Number(summary.verifiedTraces)
                : 0,
            pendingVerificationTraces: Number.isFinite(Number(summary.pendingVerificationTraces))
                ? Number(summary.pendingVerificationTraces)
                : 0,
            fallbackRatioPct: Number(Number(summary.fallbackRatioPct || 0).toFixed(2)),
            averageProviderAttemptCount: Number(Number(summary.averageProviderAttemptCount || 0).toFixed(2)),
            latestCreatedAt: String(summary.latestCreatedAt || '').trim(),
            source: String(filters.source || '').trim(),
            actionKind: String(filters.actionKind || '').trim(),
            topProviderName: String(topProvider && topProvider.providerName || '').trim(),
            topProviderTraces: Number.isFinite(Number(topProvider && topProvider.traces))
                ? Number(topProvider && topProvider.traces)
                : 0,
            topProviderFallbackTraces: Number.isFinite(Number(topProvider && topProvider.fallbackTraces))
                ? Number(topProvider && topProvider.fallbackTraces)
                : 0,
            topProviderFailedTraces: Number.isFinite(Number(topProvider && topProvider.failedTraces))
                ? Number(topProvider && topProvider.failedTraces)
                : 0,
            topProviderAverageConfidencePct: Number((Number(topProvider && topProvider.averageConfidence || 0) * 100).toFixed(2)),
            topProviderLastSeenAt: String(topProvider && topProvider.lastSeenAt || '').trim(),
            firstRecordActionKind: String(firstRecord && firstRecord.actionKind || '').trim(),
            firstRecordVerificationStatus: String(firstRecord && firstRecord.verificationStatus || '').trim(),
            firstRecordProviderName: String(firstRecord && firstRecord.providerName || '').trim(),
        };
    }

    function buildQueryBackendComparisonTrendCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const deltas = result && typeof result.deltas === 'object'
            ? result.deltas
            : {};
        return {
            status: String(result && result.status || '').trim() || 'unknown',
            confidencePct: Number((Number(result && result.confidence || 0) * 100).toFixed(2)),
            score: Number(Number(result && result.score || 0).toFixed(4)),
            reason: String(summary.reason || '').trim(),
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : 0,
            evaluatedRecords: Number.isFinite(Number(summary.evaluatedRecords))
                ? Number(summary.evaluatedRecords)
                : 0,
            overlapDeltaPct: Number(Number(deltas.overlapDeltaPct || 0).toFixed(2)),
            latencyImbalanceDeltaMs: Number(Number(deltas.latencyImbalanceDeltaMs || 0).toFixed(2)),
            explainabilityGapDeltaPct: Number(Number(deltas.explainabilityGapDeltaPct || 0).toFixed(2)),
            leftPreferredShareDeltaPct: Number(Number(deltas.leftPreferredShareDeltaPct || 0).toFixed(2)),
            rightPreferredShareDeltaPct: Number(Number(deltas.rightPreferredShareDeltaPct || 0).toFixed(2)),
            latestComparedAt: String(summary.latestComparedAt || '').trim(),
        };
    }

    function buildLearningQualityTrendCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const deltas = result && typeof result.deltas === 'object'
            ? result.deltas
            : {};
        return {
            status: String(result && result.status || '').trim() || 'unknown',
            confidencePct: Number((Number(result && result.confidence || 0) * 100).toFixed(2)),
            score: Number(Number(result && result.score || 0).toFixed(4)),
            reason: String(summary.reason || '').trim(),
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : 0,
            evaluatedRecords: Number.isFinite(Number(summary.evaluatedRecords))
                ? Number(summary.evaluatedRecords)
                : 0,
            retestPassRateDeltaPct: Number(Number(deltas.retestPassRateDeltaPct || 0).toFixed(2)),
            evidenceBackedSuggestionDeltaPct: Number(Number(deltas.evidenceBackedSuggestionDeltaPct || 0).toFixed(2)),
            misconceptionRecurrenceDeltaPct: Number(Number(deltas.misconceptionRecurrenceDeltaPct || 0).toFixed(2)),
            queryBackendFallbackDeltaPct: Number(Number(deltas.queryBackendFallbackDeltaPct || 0).toFixed(2)),
            latestSampledAt: String(summary.latestSampledAt || '').trim(),
        };
    }

    function buildSessionPlanQualityTrendCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const deltas = result && typeof result.deltas === 'object'
            ? result.deltas
            : {};
        return {
            status: String(result && result.status || '').trim() || 'unknown',
            confidencePct: Number((Number(result && result.confidence || 0) * 100).toFixed(2)),
            score: Number(Number(result && result.score || 0).toFixed(4)),
            reason: String(summary.reason || '').trim(),
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : 0,
            evaluatedRecords: Number.isFinite(Number(summary.evaluatedRecords))
                ? Number(summary.evaluatedRecords)
                : 0,
            passRateDeltaPct: Number(Number(deltas.passRateDeltaPct || 0).toFixed(2)),
            evidenceCoverageDeltaPct: Number(Number(deltas.evidenceCoverageDeltaPct || 0).toFixed(2)),
            budgetDeviationDeltaActions: Number(Number(deltas.budgetDeviationDeltaActions || 0).toFixed(2)),
            recoveryShareDeltaPct: Number(Number(deltas.recoveryShareDeltaPct || 0).toFixed(2)),
            divergenceShareDeltaPct: Number(Number(deltas.divergenceShareDeltaPct || 0).toFixed(2)),
            latestEvaluatedAt: String(summary.latestEvaluatedAt || '').trim(),
        };
    }

    function buildLearningQualityHistoryCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const records = Array.isArray(result && result.records) ? result.records : [];
        const latestRecord = records.length > 0 ? records[0] : null;
        const latestSnapshot = latestRecord && typeof latestRecord.snapshot === 'object'
            ? latestRecord.snapshot
            : {};
        return {
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : records.length,
            returnedRecords: Number.isFinite(Number(summary.returnedRecords))
                ? Number(summary.returnedRecords)
                : records.length,
            latestSampledAt: String(summary.latestSampledAt || '').trim(),
            latestRetestPassRatePct: Number(Number(latestSnapshot.retestPassRatePct || 0).toFixed(2)),
            latestEvidenceBackedSuggestionRatioPct: Number(
                Number(latestSnapshot.evidenceBackedSuggestionRatioPct || 0).toFixed(2)
            ),
            latestMisconceptionRecurrenceRatePct: Number(
                Number(latestSnapshot.misconceptionRecurrenceRatePct || 0).toFixed(2)
            ),
            latestQueryBackendFallbackRatioPct: Number(
                Number(latestSnapshot.queryBackendFallbackRatioPct || 0).toFixed(2)
            ),
        };
    }

    function buildLearningQualityBaselineEvaluationCardPayload(result) {
        const summary = result && typeof result === 'object'
            ? result
            : {};
        const baseline = summary && typeof summary.baseline === 'object'
            ? summary.baseline
            : {};
        const baselineSnapshot = baseline && typeof baseline.snapshot === 'object'
            ? baseline.snapshot
            : {};
        const currentSnapshotEnvelope = summary && typeof summary.currentSnapshot === 'object'
            ? summary.currentSnapshot
            : {};
        const currentSnapshot = currentSnapshotEnvelope && typeof currentSnapshotEnvelope.snapshot === 'object'
            ? currentSnapshotEnvelope.snapshot
            : {};
        const evaluation = summary && typeof summary.evaluation === 'object'
            ? summary.evaluation
            : {};
        const failedGates = Array.isArray(evaluation.gates)
            ? evaluation.gates.filter((gate) => gate && gate.passed === false)
            : [];
        const firstFailedGate = failedGates.length > 0 ? failedGates[0] : null;
        return {
            userId: String(summary.userId || '').trim() || String(baseline.userId || '').trim(),
            baselineFound: baseline.found === true,
            baselineStoredAt: String(baseline.storedAt || '').trim(),
            baselineRetestPassRatePct: Number(Number(baselineSnapshot.retestPassRatePct || 0).toFixed(2)),
            baselineEvidenceBackedSuggestionRatioPct: Number(
                Number(baselineSnapshot.evidenceBackedSuggestionRatioPct || 0).toFixed(2)
            ),
            currentSampledAt: String(currentSnapshotEnvelope.sampledAt || '').trim(),
            currentRetestPassRatePct: Number(Number(currentSnapshot.retestPassRatePct || 0).toFixed(2)),
            currentEvidenceBackedSuggestionRatioPct: Number(
                Number(currentSnapshot.evidenceBackedSuggestionRatioPct || 0).toFixed(2)
            ),
            overallPassed: evaluation.overallPassed === true,
            failedGateCount: failedGates.length,
            firstFailedGateId: String(firstFailedGate && firstFailedGate.gateId || '').trim(),
            firstFailedGateObserved: Number(
                Number(firstFailedGate && firstFailedGate.observedValue || 0).toFixed(4)
            ),
            firstFailedGateThreshold: Number(
                Number(firstFailedGate && firstFailedGate.threshold || 0).toFixed(4)
            ),
            evaluatedAt: String(evaluation.evaluatedAt || '').trim(),
        };
    }

    function buildSessionPlanQualityHistoryCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const commonFailedGates = Array.isArray(summary.commonFailedGates)
            ? summary.commonFailedGates
            : [];
        const topGate = commonFailedGates.length > 0 ? commonFailedGates[0] : null;
        const topFailedGateCountValue = topGate && Number.isFinite(Number(topGate.count))
            ? Number(topGate.count)
            : 0;
        return {
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : 0,
            returnedRecords: Number.isFinite(Number(summary.returnedRecords))
                ? Number(summary.returnedRecords)
                : 0,
            overallPassRatePct: Number(Number(summary.overallPassRatePct || 0).toFixed(2)),
            returnedPassRatePct: Number(Number(summary.returnedPassRatePct || 0).toFixed(2)),
            consecutiveFailureCount: Number.isFinite(Number(summary.consecutiveFailureCount))
                ? Number(summary.consecutiveFailureCount)
                : 0,
            averageBudgetDeviationActions: Number(
                Number(summary.averageBudgetDeviationActions || 0).toFixed(2)
            ),
            latestEvaluatedAt: String(summary.latestEvaluatedAt || '').trim(),
            topFailedGateId: String(topGate && topGate.gateId || '').trim(),
            topFailedGateCount: topFailedGateCountValue,
        };
    }

    function buildRuntimeCapabilityRunbookVerifyCardPayload(result) {
        const traceSummary = result && typeof result.traceSummary === 'object'
            ? result.traceSummary
            : {};
        const selectedCheckHistory = result && typeof result.selectedCheckHistory === 'object'
            ? result.selectedCheckHistory
            : {};
        const selectedCheckRemediation = result && typeof result.selectedCheckRemediation === 'object'
            ? result.selectedCheckRemediation
            : {};
        const indexSyncHealth = result && typeof result.queryVectorAccelerationIndexSyncHealth === 'object'
            ? result.queryVectorAccelerationIndexSyncHealth
            : {};
        const escalationActions = Array.isArray(result && result.selectedCheckEscalationActions)
            ? result.selectedCheckEscalationActions
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        const verificationTargets = Array.isArray(result && result.verificationTargets)
            ? result.verificationTargets
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        return {
            generatedAt: String(result && result.generatedAt || '').trim(),
            selectedCheckId: String(result && (result.selectedCheckId || result.effectiveCheckId) || '').trim(),
            selectedCheckStatus: String(result && result.selectedCheckStatus || '').trim() || 'unknown',
            selectedCheckEscalation: String(result && result.selectedCheckEscalation || '').trim() || 'normal',
            selectedCheckPriorityScore: Number.isFinite(Number(result && result.selectedCheckPriorityScore))
                ? Number(result.selectedCheckPriorityScore)
                : 0,
            selectedCheckMessage: String(result && result.selectedCheckMessage || '').trim(),
            topRiskCheckId: String(result && result.topRiskCheckId || '').trim(),
            topRiskStatus: String(result && result.topRiskStatus || '').trim() || 'none',
            focusMode: String(result && result.focusMode || '').trim() || 'none',
            autoFocusApplied: Boolean(result && result.autoFocusApplied),
            autoFocusReason: String(result && result.autoFocusReason || '').trim(),
            autoFocusRecommendedCheckId: String(result && result.autoFocusRecommendedCheckId || '').trim(),
            verificationTargetCount: verificationTargets.length,
            firstEscalationAction: escalationActions[0] || '',
            traceReturnedRecords: Number.isFinite(Number(traceSummary.returnedRecords))
                ? Number(traceSummary.returnedRecords)
                : 0,
            traceErrorRequests: Number.isFinite(Number(traceSummary.errorRequests))
                ? Number(traceSummary.errorRequests)
                : 0,
            traceErrorRatioPct: Number(Number(traceSummary.errorRatioPct || 0).toFixed(4)),
            traceP95DurationMs: Number(Number(traceSummary.p95DurationMs || 0).toFixed(4)),
            historyReturnedRecords: Number.isFinite(Number(selectedCheckHistory.returnedRecords))
                ? Number(selectedCheckHistory.returnedRecords)
                : 0,
            historyRiskStreak: Number.isFinite(Number(selectedCheckHistory.activeRiskStreak))
                ? Number(selectedCheckHistory.activeRiskStreak)
                : 0,
            historyFailStreak: Number.isFinite(Number(selectedCheckHistory.activeFailStreak))
                ? Number(selectedCheckHistory.activeFailStreak)
                : 0,
            historyTrendStatus: String(selectedCheckHistory.trendStatus || '').trim() || 'insufficient_data',
            remediationRiskRatioPct: Number(Number(selectedCheckRemediation.riskRatioPct || 0).toFixed(4)),
            annIndexSyncStatus: String(indexSyncHealth.indexSyncStatus || '').trim(),
            annIndexSyncMessage: String(indexSyncHealth.indexSyncMessage || '').trim(),
            annIndexSyncRequestCount: Number.isFinite(Number(indexSyncHealth.syncRequestCount))
                ? Number(indexSyncHealth.syncRequestCount)
                : 0,
            annIndexSyncSuccessCount: Number.isFinite(Number(indexSyncHealth.syncSuccessCount))
                ? Number(indexSyncHealth.syncSuccessCount)
                : 0,
            annIndexSyncFailureCount: Number.isFinite(Number(indexSyncHealth.syncFailureCount))
                ? Number(indexSyncHealth.syncFailureCount)
                : 0,
            annIndexSyncedAtomCount: Number.isFinite(Number(indexSyncHealth.syncedAtomCount))
                ? Number(indexSyncHealth.syncedAtomCount)
                : 0,
            annIndexLastSyncAt: String(indexSyncHealth.lastSyncAt || '').trim(),
        };
    }

    function buildRuntimeCapabilityRunbookHistoryCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const statusCounts = summary && typeof summary.statusCounts === 'object'
            ? summary.statusCounts
            : {};
        return {
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : 0,
            matchedRecords: Number.isFinite(Number(summary.matchedRecords))
                ? Number(summary.matchedRecords)
                : 0,
            returnedRecords: Number.isFinite(Number(summary.returnedRecords))
                ? Number(summary.returnedRecords)
                : 0,
            checkId: String(summary.checkId || '').trim(),
            sinceMinutes: Number.isFinite(Number(summary.sinceMinutes))
                ? Number(summary.sinceMinutes)
                : 0,
            status: String(summary.status || '').trim(),
            statusPassCount: Number.isFinite(Number(statusCounts.pass))
                ? Number(statusCounts.pass)
                : 0,
            statusWarnCount: Number.isFinite(Number(statusCounts.warn))
                ? Number(statusCounts.warn)
                : 0,
            statusFailCount: Number.isFinite(Number(statusCounts.fail))
                ? Number(statusCounts.fail)
                : 0,
            statusUnknownCount: Number.isFinite(Number(statusCounts.unknown))
                ? Number(statusCounts.unknown)
                : 0,
            activeRiskStreak: Number.isFinite(Number(summary.activeRiskStreak))
                ? Number(summary.activeRiskStreak)
                : 0,
            activeFailStreak: Number.isFinite(Number(summary.activeFailStreak))
                ? Number(summary.activeFailStreak)
                : 0,
            averageErrorRatioPct: Number(Number(summary.averageErrorRatioPct || 0).toFixed(4)),
            averageP95DurationMs: Number(Number(summary.averageP95DurationMs || 0).toFixed(4)),
            trendStatus: String(summary.trendStatus || '').trim() || 'insufficient_data',
            trendWindowSize: Number.isFinite(Number(summary.trendWindowSize))
                ? Number(summary.trendWindowSize)
                : 0,
            severityDelta: Number(Number(summary.severityDelta || 0).toFixed(4)),
            errorRatioDeltaPct: Number(Number(summary.errorRatioDeltaPct || 0).toFixed(4)),
            p95DurationDeltaMs: Number(Number(summary.p95DurationDeltaMs || 0).toFixed(4)),
            latestVerifiedAt: String(summary.latestVerifiedAt || '').trim(),
        };
    }

    function buildRuntimeCapabilityRunbookChecksCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const checks = Array.isArray(result && result.checks)
            ? result.checks
            : [];
        const firstCheck = checks.length > 0 ? checks[0] : null;
        return {
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : 0,
            matchedRecords: Number.isFinite(Number(summary.matchedRecords))
                ? Number(summary.matchedRecords)
                : 0,
            returnedChecks: Number.isFinite(Number(summary.returnedChecks))
                ? Number(summary.returnedChecks)
                : checks.length,
            sinceMinutes: Number.isFinite(Number(summary.sinceMinutes))
                ? Number(summary.sinceMinutes)
                : 0,
            regressingChecks: Number.isFinite(Number(summary.regressingChecks))
                ? Number(summary.regressingChecks)
                : 0,
            improvingChecks: Number.isFinite(Number(summary.improvingChecks))
                ? Number(summary.improvingChecks)
                : 0,
            stableChecks: Number.isFinite(Number(summary.stableChecks))
                ? Number(summary.stableChecks)
                : 0,
            insufficientDataChecks: Number.isFinite(Number(summary.insufficientDataChecks))
                ? Number(summary.insufficientDataChecks)
                : 0,
            recommendedFocusCheckId: String(summary.recommendedFocusCheckId || '').trim(),
            recommendedFocusEscalation: String(summary.recommendedFocusEscalation || '').trim(),
            recommendedFocusReason: String(summary.recommendedFocusReason || '').trim(),
            recommendedFocusTopAction: String(summary.recommendedFocusTopAction || '').trim(),
            actionQueueTotal: Number.isFinite(Number(summary.actionQueueTotal))
                ? Number(summary.actionQueueTotal)
                : 0,
            actionQueueP0: Number.isFinite(Number(summary.actionQueueP0))
                ? Number(summary.actionQueueP0)
                : 0,
            actionQueueP1: Number.isFinite(Number(summary.actionQueueP1))
                ? Number(summary.actionQueueP1)
                : 0,
            actionQueueP2: Number.isFinite(Number(summary.actionQueueP2))
                ? Number(summary.actionQueueP2)
                : 0,
            remediationRiskRatioPct: Number(Number(summary.remediationRiskRatioPct || 0).toFixed(4)),
            remediationLatestRecordedAt: String(summary.remediationLatestRecordedAt || '').trim(),
            firstCheckId: String(firstCheck && firstCheck.checkId || '').trim(),
            firstCheckStatus: String(firstCheck && firstCheck.latestStatus || '').trim(),
            firstCheckTrendStatus: String(firstCheck && firstCheck.trendStatus || '').trim(),
        };
    }

    function buildRuntimeCapabilityRunbookActionQueueCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const actionQueue = Array.isArray(result && result.actionQueue)
            ? result.actionQueue
            : [];
        const firstItem = actionQueue.length > 0 ? actionQueue[0] : null;
        return {
            totalQueueItems: Number.isFinite(Number(summary.totalQueueItems))
                ? Number(summary.totalQueueItems)
                : actionQueue.length,
            filteredQueueItems: Number.isFinite(Number(summary.filteredQueueItems))
                ? Number(summary.filteredQueueItems)
                : actionQueue.length,
            returnedQueueItems: Number.isFinite(Number(summary.returnedQueueItems))
                ? Number(summary.returnedQueueItems)
                : actionQueue.length,
            queueP0: Number.isFinite(Number(summary.queueP0))
                ? Number(summary.queueP0)
                : 0,
            queueP1: Number.isFinite(Number(summary.queueP1))
                ? Number(summary.queueP1)
                : 0,
            queueP2: Number.isFinite(Number(summary.queueP2))
                ? Number(summary.queueP2)
                : 0,
            remediationRiskQueueItems: Number.isFinite(Number(summary.remediationRiskQueueItems))
                ? Number(summary.remediationRiskQueueItems)
                : 0,
            remediationRegressingQueueItems: Number.isFinite(Number(summary.remediationRegressingQueueItems))
                ? Number(summary.remediationRegressingQueueItems)
                : 0,
            remediationAverageRiskRatioPct: Number(Number(summary.remediationAverageRiskRatioPct || 0).toFixed(4)),
            queueLimit: Number.isFinite(Number(summary.queueLimit))
                ? Number(summary.queueLimit)
                : 0,
            priorityFilter: String(summary.priorityFilter || '').trim() || 'all',
            categoryFilter: String(summary.categoryFilter || '').trim() || 'all',
            remediationStatusFilter: String(summary.remediationStatusFilter || '').trim() || 'all',
            remediationTrendFilter: String(summary.remediationTrendFilter || '').trim() || 'all',
            recommendedFocusCheckId: String(summary.recommendedFocusCheckId || '').trim(),
            recommendedFocusEscalation: String(summary.recommendedFocusEscalation || '').trim(),
            firstCheckId: String(firstItem && firstItem.checkId || '').trim(),
            firstActionId: String(firstItem && firstItem.actionId || '').trim(),
            firstPriority: String(firstItem && firstItem.priority || '').trim(),
            firstCategory: String(firstItem && firstItem.category || '').trim(),
            firstRemediationStatus: String(firstItem && firstItem.remediationLatestStatus || '').trim(),
            firstRemediationTrend: String(firstItem && firstItem.remediationTrendStatus || '').trim(),
            firstInstruction: String(firstItem && firstItem.instruction || '').trim(),
            firstEndpointHint: String(firstItem && firstItem.endpointHint || '').trim(),
            firstAutomationHint: String(firstItem && firstItem.automationHint || '').trim(),
        };
    }

    function buildStudySessionCardPayload(item, result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const totalActions = Number.isFinite(Number(summary.totalActions))
            ? Number(summary.totalActions)
            : Array.isArray(result && result.actions)
                ? result.actions.length
                : 0;
        const totalEstimatedMinutes = Number.isFinite(Number(summary.totalEstimatedMinutes))
            ? Number(summary.totalEstimatedMinutes)
            : Array.isArray(result && result.actions)
                ? result.actions.reduce(function (sum, action) {
                    return sum + Number(action && action.estimatedMinutes || 0);
                }, 0)
                : 0;
        const actions = Array.isArray(result && result.actions)
            ? result.actions.slice(0, 4).map(function (action) {
                return {
                    atomId: String(action && action.atomId || ''),
                    kind: String(action && action.kind || ''),
                    rationale: String(action && action.rationale || ''),
                };
            })
            : [];
        return {
            atomId: resolveCapabilityTargetAtomId(item, null),
            title: String(item && item.title || ''),
            totalActions,
            totalEstimatedMinutes,
            actions,
        };
    }

    function buildSessionHistoryCardPayload(result) {
        const summary = result && typeof result.summary === 'object'
            ? result.summary
            : {};
        const records = Array.isArray(result && result.records)
            ? result.records
            : [];
        const appliedFilters = summary && typeof summary.appliedFilters === 'object'
            ? summary.appliedFilters
            : {};
        const averageMasteryDelta = Number.isFinite(Number(summary.averageMasteryDelta))
            ? Number(summary.averageMasteryDelta)
            : 0;
        const averageTutorConfidence = Number.isFinite(Number(summary.averageTutorConfidence))
            ? Number(summary.averageTutorConfidence)
            : 0;
        return {
            totalRecords: Number.isFinite(Number(summary.totalRecords))
                ? Number(summary.totalRecords)
                : records.length,
            matchedRecordsBeforeLimit: Number.isFinite(Number(summary.matchedRecordsBeforeLimit))
                ? Number(summary.matchedRecordsBeforeLimit)
                : records.length,
            sinceMinutes: Number.isFinite(Number(appliedFilters.sinceMinutes))
                ? Number(appliedFilters.sinceMinutes)
                : 0,
            totalExecutedActions: Number.isFinite(Number(summary.totalExecutedActions))
                ? Number(summary.totalExecutedActions)
                : 0,
            totalUpdatedMasteryCount: Number.isFinite(Number(summary.totalUpdatedMasteryCount))
                ? Number(summary.totalUpdatedMasteryCount)
                : 0,
            averageMasteryDeltaPct: Number((averageMasteryDelta * 100).toFixed(2)),
            averageTutorConfidencePct: Number((averageTutorConfidence * 100).toFixed(2)),
            latestExecutedAt: String(records[0] && records[0].executedAt || '').trim(),
        };
    }

    function buildTutorActionCardPayload(item, capability, result) {
        const trace = result && typeof result.trace === 'object'
            ? result.trace
            : {};
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const actionKind = String(
            trace.actionKind
            || capabilityRequest.actionKind
            || capability && capability.actionId
            || ''
        ).trim();
        const evidenceSpans = Array.isArray(result && result.evidenceSpans)
            ? result.evidenceSpans
            : [];
        const evidenceSnippets = evidenceSpans
            .map((span) => String(span && span.snippet || '').trim())
            .filter(Boolean)
            .slice(0, 4);
        return {
            atomId: resolveCapabilityTargetAtomId(item, capability),
            actionKind,
            message: String(result && result.message || '').trim(),
            evidenceSnippets,
        };
    }

    function openGraphFocus(item, capability) {
        const nodeId = resolveCapabilityTargetAtomId(item, capability);
        if (!nodeId) {
            return;
        }
        const node = resolveLiveNodeById(nodeId);
        if (!node) {
            appendCapabilityFailureMessage(capability, {
                nodeId: nodeId,
            }, {
                messageKey: 'agentWorkspace.messages.localNodeUnavailable',
                fallbackMessage: 'Local node {nodeId} is not currently available in the graph.',
            });
            return;
        }
        if (
            window.NoteConnectionGraphView
            && typeof window.NoteConnectionGraphView.openFocusModeById === 'function'
        ) {
            window.NoteConnectionGraphView.openFocusModeById(nodeId);
        } else if (typeof window.enterFocusMode === 'function') {
            window.enterFocusMode(node);
        }
        const controller = getController();
        if (controller) {
            controller.openGraphFocusPane({
                atomId: nodeId,
                title: String(item.title || node.label || node.id || nodeId),
                summary: String(item.summary || node.summary || node.content || ''),
            });
        }
    }

    function presentLearningPathResult(item, capability, result, requestPayload) {
        const nodeId = resolveCapabilityTargetAtomId(item, capability);
        const controller = getController();
        if (!controller) {
            return;
        }
        const items = [];
        const masteryPaths = Array.isArray(result && result.masteryPaths) ? result.masteryPaths : [];
        masteryPaths.forEach((path) => {
            items.push({
                atomId: String(path && path.atomId || ''),
                title: String(path && path.title || path && path.atomId || ''),
            });
        });
        const recommendedActions = Array.isArray(result && result.recommendedActions)
            ? result.recommendedActions
            : [];
        recommendedActions.slice(0, 4).forEach((action) => {
            items.push({
                atomId: String(action && action.atomId || ''),
                title: String(action && action.title || action && action.atomId || ''),
            });
        });
        controller.openLearningPathPane({
            atomId: nodeId,
            title: String(item.title || nodeId),
            items,
        });
        const pathContainer = getElement('path-container');
        if (pathContainer) {
            pathContainer.style.display = 'block';
        }
        const graphWrapper = getElement('graph-wrapper');
        if (graphWrapper) {
            graphWrapper.style.display = 'block';
        }
        if (window.pathApp) {
            const pathApp = window.pathApp;
            const config = {
                mode: 'diffusion',
                targetId: nodeId,
                targetIds: requestPayload.focusAtomIds,
                language: getActiveLanguage(),
            };
            if (!window.__NC_AGENT_PATH_WORKSPACE_INITIALIZED && typeof pathApp.init === 'function') {
                pathApp.init(nodeId);
                window.__NC_AGENT_PATH_WORKSPACE_INITIALIZED = true;
            }
            if (typeof pathApp.applyRemoteConfigure === 'function') {
                pathApp.applyRemoteConfigure(config);
            }
            const learningUserIdInput = getElement('learning-user-id');
            if (learningUserIdInput && typeof learningUserIdInput.value === 'string') {
                learningUserIdInput.value = getUserId();
            }
            if (typeof pathApp.triggerUpdate === 'function') {
                pathApp.triggerUpdate();
            }
        }
    }

    function presentLearningPathFailure(item, capability, error) {
        const nodeId = resolveCapabilityTargetAtomId(item, capability);
        const controller = getController();
        if (controller) {
            controller.openLearningPathPane({
                atomId: nodeId,
                title: String(item.title || nodeId),
                items: [],
            });
        }
        appendCapabilityFailureMessage(capability, {
            error: String(error && error.message || error || 'unknown_error'),
        }, {
            messageKey: 'agentWorkspace.messages.previewFailed',
            fallbackMessage: 'Learning path preview failed: {error}',
        });
    }

    async function openLearningPath(item, capability) {
        const nodeId = resolveCapabilityTargetAtomId(item, capability);
        if (!nodeId) {
            return;
        }
        try {
            const requestPayload = resolveLearningPathRequestPayload(item, capability);
            const result = await requestJson('/api/knowledge/path', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload),
            });
            presentLearningPathResult(item, capability, result, requestPayload);
        } catch (error) {
            presentLearningPathFailure(item, capability, error);
        }
    }

    function appendCardWithController(capability, appendMethodName, unavailableErrorCode, payload) {
        const controller = getController();
        if (!controller || typeof controller[appendMethodName] !== 'function') {
            appendCapabilityFailureMessage(capability, {
                error: unavailableErrorCode,
            });
            return;
        }
        controller[appendMethodName](payload);
    }

    const CUSTOM_RESULT_PRESENTERS = {
        learning_path_pane: function ({ item, capability, result, requestPayload }) {
            presentLearningPathResult(item, capability, result, requestPayload);
        },
        assistant_message: function ({ result }) {
            const assistantMessage = String(
                result && result.message
                || ''
            ).trim();
            if (assistantMessage) {
                appendAssistantMessage(assistantMessage);
                return;
            }
            appendLocalizedAssistantMessage(
                'agentWorkspace.messages.noResponse',
                'No response.'
            );
        },
    };

    const CARD_RESULT_PRESENTATION_REGISTRY = {
        conversation_turn_cache_diagnostics_card: {
            appendMethodName: 'appendConversationTurnCacheDiagnosticsCard',
            unavailableErrorCode: 'conversation_turn_cache_diagnostics_card_unavailable',
        },
        conversation_turn_cache_alert_trend_card: {
            appendMethodName: 'appendConversationTurnCacheAlertTrendCard',
            unavailableErrorCode: 'conversation_turn_cache_alert_trend_card_unavailable',
        },
        query_backend_comparison_card: {
            appendMethodName: 'appendQueryBackendComparisonCard',
            unavailableErrorCode: 'query_backend_comparison_card_unavailable',
        },
        query_backend_diagnostics_card: {
            appendMethodName: 'appendQueryBackendDiagnosticsCard',
            unavailableErrorCode: 'query_backend_diagnostics_card_unavailable',
        },
        query_backend_comparison_history_card: {
            appendMethodName: 'appendQueryBackendComparisonHistoryCard',
            unavailableErrorCode: 'query_backend_comparison_history_card_unavailable',
        },
        query_backend_comparison_trend_card: {
            appendMethodName: 'appendQueryBackendComparisonTrendCard',
            unavailableErrorCode: 'query_backend_comparison_trend_card_unavailable',
        },
        tutor_adapter_telemetry_card: {
            appendMethodName: 'appendTutorAdapterTelemetryCard',
            unavailableErrorCode: 'tutor_adapter_telemetry_card_unavailable',
        },
        tutor_trace_diagnostics_card: {
            appendMethodName: 'appendTutorTraceDiagnosticsCard',
            unavailableErrorCode: 'tutor_trace_diagnostics_card_unavailable',
        },
        learning_quality_trend_card: {
            appendMethodName: 'appendLearningQualityTrendCard',
            unavailableErrorCode: 'learning_quality_trend_card_unavailable',
        },
        learning_quality_history_card: {
            appendMethodName: 'appendLearningQualityHistoryCard',
            unavailableErrorCode: 'learning_quality_history_card_unavailable',
        },
        learning_quality_baseline_evaluation_card: {
            appendMethodName: 'appendLearningQualityBaselineEvaluationCard',
            unavailableErrorCode: 'learning_quality_baseline_evaluation_card_unavailable',
        },
        session_plan_quality_trend_card: {
            appendMethodName: 'appendSessionPlanQualityTrendCard',
            unavailableErrorCode: 'session_plan_quality_trend_card_unavailable',
        },
        session_plan_quality_history_card: {
            appendMethodName: 'appendSessionPlanQualityHistoryCard',
            unavailableErrorCode: 'session_plan_quality_history_card_unavailable',
        },
        runtime_capability_runbook_verify_card: {
            appendMethodName: 'appendRuntimeCapabilityRunbookVerifyCard',
            unavailableErrorCode: 'runtime_capability_runbook_verify_card_unavailable',
        },
        runtime_capability_runbook_history_card: {
            appendMethodName: 'appendRuntimeCapabilityRunbookHistoryCard',
            unavailableErrorCode: 'runtime_capability_runbook_history_card_unavailable',
        },
        runtime_capability_runbook_checks_card: {
            appendMethodName: 'appendRuntimeCapabilityRunbookChecksCard',
            unavailableErrorCode: 'runtime_capability_runbook_checks_card_unavailable',
        },
        runtime_capability_runbook_action_queue_card: {
            appendMethodName: 'appendRuntimeCapabilityRunbookActionQueueCard',
            unavailableErrorCode: 'runtime_capability_runbook_action_queue_card_unavailable',
        },
        session_history_card: {
            appendMethodName: 'appendSessionHistoryCard',
            unavailableErrorCode: 'session_history_card_unavailable',
        },
        study_session_card: {
            appendMethodName: 'appendStudySessionCard',
            unavailableErrorCode: 'study_session_card_unavailable',
        },
        tutor_action_card: {
            appendMethodName: 'appendTutorActionCard',
            unavailableErrorCode: 'tutor_action_card_unavailable',
        },
    };

    const RESULT_PRESENTATION_PAYLOAD_BUILDERS = {
        conversation_turn_cache_diagnostics_card: function ({ result }) {
            return buildConversationTurnCacheDiagnosticsCardPayload(result);
        },
        conversation_turn_cache_alert_trend_card: function ({ result }) {
            return buildConversationTurnCacheAlertTrendCardPayload(result);
        },
        query_backend_comparison_card: function ({ result }) {
            return buildQueryBackendComparisonCardPayload(result);
        },
        query_backend_diagnostics_card: function ({ result, responseEnvelope }) {
            return buildQueryBackendDiagnosticsCardPayload(result, responseEnvelope);
        },
        query_backend_comparison_history_card: function ({ result }) {
            return buildQueryBackendComparisonHistoryCardPayload(result);
        },
        query_backend_comparison_trend_card: function ({ result }) {
            return buildQueryBackendComparisonTrendCardPayload(result);
        },
        tutor_adapter_telemetry_card: function ({ capability, result }) {
            return buildTutorAdapterTelemetryCardPayload(result, capability);
        },
        tutor_trace_diagnostics_card: function ({ result }) {
            return buildTutorTraceDiagnosticsCardPayload(result);
        },
        learning_quality_trend_card: function ({ result }) {
            return buildLearningQualityTrendCardPayload(result);
        },
        learning_quality_history_card: function ({ result }) {
            return buildLearningQualityHistoryCardPayload(result);
        },
        learning_quality_baseline_evaluation_card: function ({ result }) {
            return buildLearningQualityBaselineEvaluationCardPayload(result);
        },
        session_plan_quality_trend_card: function ({ result }) {
            return buildSessionPlanQualityTrendCardPayload(result);
        },
        session_plan_quality_history_card: function ({ result }) {
            return buildSessionPlanQualityHistoryCardPayload(result);
        },
        runtime_capability_runbook_verify_card: function ({ result }) {
            return buildRuntimeCapabilityRunbookVerifyCardPayload(result);
        },
        runtime_capability_runbook_history_card: function ({ result }) {
            return buildRuntimeCapabilityRunbookHistoryCardPayload(result);
        },
        runtime_capability_runbook_checks_card: function ({ result }) {
            return buildRuntimeCapabilityRunbookChecksCardPayload(result);
        },
        runtime_capability_runbook_action_queue_card: function ({ result }) {
            return buildRuntimeCapabilityRunbookActionQueueCardPayload(result);
        },
        session_history_card: function ({ result }) {
            return buildSessionHistoryCardPayload(result);
        },
        study_session_card: function ({ item, result }) {
            return buildStudySessionCardPayload(item, result);
        },
        tutor_action_card: function ({ item, capability, result }) {
            return buildTutorActionCardPayload(item, capability, result);
        },
    };

    function resolveCustomResultPresenter(resultPresentation) {
        if (!Object.prototype.hasOwnProperty.call(CUSTOM_RESULT_PRESENTERS, resultPresentation)) {
            return null;
        }
        return CUSTOM_RESULT_PRESENTERS[resultPresentation];
    }

    function resolveCardResultPresentationDescriptor(resultPresentation) {
        if (!Object.prototype.hasOwnProperty.call(CARD_RESULT_PRESENTATION_REGISTRY, resultPresentation)) {
            return null;
        }
        return CARD_RESULT_PRESENTATION_REGISTRY[resultPresentation];
    }

    function resolveResultPresentationPayloadBuilder(resultPresentation) {
        if (!Object.prototype.hasOwnProperty.call(RESULT_PRESENTATION_PAYLOAD_BUILDERS, resultPresentation)) {
            return null;
        }
        return RESULT_PRESENTATION_PAYLOAD_BUILDERS[resultPresentation];
    }

    function presentCardResultPresentation(cardDescriptor, payload, capability) {
        appendCardWithController(
            capability,
            cardDescriptor.appendMethodName,
            cardDescriptor.unavailableErrorCode,
            payload
        );
    }

    function resolveResultPresentationIds() {
        return Object.keys(CUSTOM_RESULT_PRESENTERS).concat(Object.keys(CARD_RESULT_PRESENTATION_REGISTRY));
    }

    function presentKnowledgeOperationResult(resultPresentation, context) {
        const customPresenter = resolveCustomResultPresenter(resultPresentation);
        if (typeof customPresenter === 'function') {
            customPresenter(context);
            return;
        }

        const cardDescriptor = resolveCardResultPresentationDescriptor(resultPresentation);
        const payloadBuilder = resolveResultPresentationPayloadBuilder(resultPresentation);
        if (!cardDescriptor && typeof payloadBuilder !== 'function') {
            throw new Error('unsupported_result_presentation:' + (resultPresentation || 'unknown'));
        }
        if (!cardDescriptor) {
            throw new Error('unsupported_result_presentation_transport:' + (resultPresentation || 'unknown'));
        }
        if (typeof payloadBuilder !== 'function') {
            throw new Error('unsupported_result_presentation_payload_builder:' + (resultPresentation || 'unknown'));
        }

        presentCardResultPresentation(cardDescriptor, payloadBuilder(context), context.capability);
    }

    function invokeCapabilityHandler(handler, item, capability) {
        try {
            return Promise.resolve(handler(item, capability));
        } catch (error) {
            appendCapabilityFailureMessage(capability, {
                error: String(error && error.message || error || 'unknown_error'),
            });
            return Promise.resolve();
        }
    }

    async function executeKnowledgeOperation(item, capability) {
        const execution = capability && typeof capability.execution === 'object'
            ? capability.execution
            : {};
        const operationId = String(execution && execution.operationId || '').trim();
        const transportDescriptor = resolveKnowledgeOperationTransportDescriptor(operationId);
        if (!transportDescriptor) {
            appendCapabilityFailureMessage(capability, {
                error: `unsupported_operation:${operationId || 'unknown'}`,
            });
            return;
        }
        const requestBuilder = resolveKnowledgeOperationRequestBuilder(operationId);
        if (typeof requestBuilder !== 'function') {
            appendCapabilityFailureMessage(capability, {
                error: `unsupported_operation_request_builder:${operationId || 'unknown'}`,
            });
            return;
        }
        const resultPresentation = String(
            execution && execution.resultPresentation
            || transportDescriptor.defaultResultPresentation
            || ''
        ).trim();
        const allowedResultPresentations = resolveKnowledgeOperationAllowedResultPresentations(operationId);
        if (
            resultPresentation
            && allowedResultPresentations.length > 0
            && allowedResultPresentations.indexOf(resultPresentation) < 0
        ) {
            appendCapabilityFailureMessage(capability, {
                operationId,
                resultPresentation,
                allowedResultPresentations: allowedResultPresentations.join(', '),
                error: `unsupported_operation_result_presentation:${operationId}:${resultPresentation}`,
            }, {
                messageKey: 'agentWorkspace.messages.operationResultPresentationUnsupported',
                fallbackMessage: 'Unsupported result presentation {resultPresentation} for operation {operationId}; allowed: {allowedResultPresentations}',
            });
            return;
        }
        const requestPayload = requestBuilder(item, capability);

        try {
            const method = String(transportDescriptor.method || 'POST').toUpperCase();
            const isGetMethod = method === 'GET';
            const endpoint = isGetMethod
                ? appendQueryParams(transportDescriptor.endpoint, requestPayload)
                : transportDescriptor.endpoint;
            const requestInit = isGetMethod
                ? {
                    method,
                }
                : {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestPayload),
                };
            const responseEnvelope = await requestJson(endpoint, requestInit, {
                returnEnvelope: true,
            });
            const result = responseEnvelope && typeof responseEnvelope === 'object'
                ? responseEnvelope.result
                : null;
            presentKnowledgeOperationResult(resultPresentation, {
                item,
                capability,
                result,
                responseEnvelope,
                requestPayload,
            });
        } catch (error) {
            const errorMessage = String(error && error.message || error || 'unknown_error');
            if (
                operationId === 'build_learning_path'
                && !errorMessage.startsWith('unsupported_result_presentation:')
            ) {
                presentLearningPathFailure(item, capability, error);
                return;
            }
            appendCapabilityFailureMessage(capability, {
                error: errorMessage,
            });
        }
    }

    function executeCapability(item, capability) {
        const executionKind = String(capability && capability.execution && capability.execution.kind || '').trim();
        const actionId = String(capability && capability.actionId || '').trim();
        if (executionKind) {
            if (!Object.prototype.hasOwnProperty.call(CAPABILITY_EXECUTION_KIND_HANDLERS, executionKind)) {
                appendCapabilityFailureMessage(capability, {
                    executionKind,
                    error: `unsupported_execution_kind:${executionKind}`,
                }, {
                    messageKey: 'agentWorkspace.messages.executionKindUnsupported',
                    fallbackMessage: 'Unsupported capability execution kind: {executionKind}',
                });
                return Promise.resolve();
            }
            return invokeCapabilityHandler(
                CAPABILITY_EXECUTION_KIND_HANDLERS[executionKind],
                item,
                capability
            );
        }
        const missingExecutionKind = 'missing_execution';
        appendCapabilityFailureMessage(capability, {
            actionId: actionId || 'unknown',
            executionKind: missingExecutionKind,
            error: `unsupported_execution_kind:${missingExecutionKind}`,
        }, {
            messageKey: 'agentWorkspace.messages.executionKindUnsupported',
            fallbackMessage: 'Unsupported capability execution kind: {executionKind}',
        });
        return Promise.resolve();
    }

    async function sendConversation() {
        const input = getElement('agent-workspace-chat-input');
        if (!input || typeof input.value !== 'string') {
            return;
        }
        const message = input.value.trim();
        if (!message) {
            return;
        }
        input.value = '';
        appendUserMessage(message);
        try {
            const requestPayload = {
                userId: getUserId(),
                message,
                topK: 6,
            };
            const result = await requestConversationWithStreamingFallback(requestPayload);
            const assistantMessage = String(result && result.assistantMessage || '').trim();
            if (assistantMessage) {
                appendAssistantMessage(assistantMessage);
            } else {
                appendLocalizedAssistantMessage(
                    'agentWorkspace.messages.noResponse',
                    'No response.'
                );
            }
            const controller = getController();
            if (controller) {
                controller.renderKnowledgePoints(
                    Array.isArray(result && result.knowledgePoints) ? result.knowledgePoints : [],
                    {
                        onCapability: function (item, capability) {
                            executeCapability(item, capability);
                        },
                    }
                );
            }
        } catch (error) {
            appendLocalizedAssistantMessage(
                'agentWorkspace.messages.conversationFailed',
                `Conversation request failed: ${String(error && error.message || error || 'unknown_error')}`,
                { error: String(error && error.message || error || 'unknown_error') }
            );
        }
    }

    function syncGraphFocus(node) {
        const controller = getController();
        if (!controller) {
            return;
        }
        if (!node) {
            controller.clearGraphFocusPane();
            return;
        }
        controller.openGraphFocusPane({
            atomId: String(node.id || ''),
            title: String(node.label || node.id || ''),
            summary: String(node.summary || node.content || ''),
        });
    }

    function init() {
        const controller = getController();
        if (!controller) {
            return;
        }
        controller.init();
        const sendButton = getElement('btn-agent-workspace-send');
        if (sendButton && typeof sendButton.addEventListener === 'function') {
            sendButton.addEventListener('click', function () {
                void sendConversation();
            });
        }
        const input = getElement('agent-workspace-chat-input');
        if (input && typeof input.addEventListener === 'function') {
            input.addEventListener('keydown', function (event) {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void sendConversation();
                }
            });
        }
        appendLocalizedAssistantMessage(
            'agentWorkspace.messages.ready',
            'Agent workspace ready. Ask for a concept, then open focus or learning path panes from local knowledge points.'
        );
    }

    window.NoteConnectionAgentWorkspace = {
        init,
        syncGraphFocus,
        sendConversation,
        openGraphFocus,
        openLearningPath,
        executeCapability,
        getCapabilityRegistryDiagnostics: function () {
            const invalidOverrideMap = resolveOperationInvalidResultPresentationOverrideMap();
            const unknownOverrideMap = resolveOperationUnknownResultPresentationOverrideMap();
            const invalidOverrideTokenCount = countOperationResultPresentationOverrideMapTokens(invalidOverrideMap);
            const unknownOverrideTokenCount = countOperationResultPresentationOverrideMapTokens(unknownOverrideMap);
            return {
                operations: Object.keys(KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY),
                operationTransports: Object.keys(KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY),
                operationRequestBuilders: Object.keys(KNOWLEDGE_OPERATION_REQUEST_BUILDERS),
                operationResultPresentationOverrides: Object.keys(KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES),
                operationResultPresentationOverrideMap: resolveOperationResultPresentationOverrideMap(),
                operationInvalidResultPresentationOverrideMap: invalidOverrideMap,
                operationUnknownResultPresentationOverrideMap: unknownOverrideMap,
                operationResultPresentationOverrideDriftDetected: (
                    invalidOverrideTokenCount > 0 || unknownOverrideTokenCount > 0
                ),
                operationResultPresentationInvalidOverrideTokenCount: invalidOverrideTokenCount,
                operationResultPresentationUnknownOverrideTokenCount: unknownOverrideTokenCount,
                operationDefaultResultPresentations: resolveOperationDefaultResultPresentationMap(),
                operationAllowedResultPresentations: resolveOperationAllowedResultPresentationMap(),
                resultPresentations: resolveResultPresentationIds(),
                customResultPresentations: Object.keys(CUSTOM_RESULT_PRESENTERS),
                cardResultPresentations: Object.keys(CARD_RESULT_PRESENTATION_REGISTRY),
                resultPresentationPayloadBuilders: Object.keys(RESULT_PRESENTATION_PAYLOAD_BUILDERS),
                executionKinds: Object.keys(CAPABILITY_EXECUTION_KIND_HANDLERS),
                legacyActionFallbacks: Object.keys(LEGACY_ACTION_FALLBACK_HANDLERS),
            };
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}());
