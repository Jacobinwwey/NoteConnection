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

    function buildConversationSessionId(userId) {
        const normalizedUserId = String(userId || '').trim() || 'path_user_default';
        const timestamp = Date.now().toString(36);
        const randomSuffix = Math.random().toString(36).slice(2, 10);
        return `session_client_${normalizedUserId}_${timestamp}_${randomSuffix}`.replace(/[^a-zA-Z0-9._:-]+/g, '_');
    }

    function getOrCreateConversationSessionId(userId) {
        const normalizedUserId = String(userId || '').trim() || 'path_user_default';
        if (!window.__NC_AGENT_WORKSPACE_SESSION_BY_USER || typeof window.__NC_AGENT_WORKSPACE_SESSION_BY_USER !== 'object') {
            window.__NC_AGENT_WORKSPACE_SESSION_BY_USER = {};
        }
        const sessionMap = window.__NC_AGENT_WORKSPACE_SESSION_BY_USER;
        if (!sessionMap[normalizedUserId]) {
            sessionMap[normalizedUserId] = buildConversationSessionId(normalizedUserId);
        }
        return String(sessionMap[normalizedUserId] || buildConversationSessionId(normalizedUserId));
    }

    function getRuntime() {
        return window.NoteConnectionRuntime || null;
    }

    const ACTIVE_SOURCE_TARGET_STORAGE_KEY = 'nc_last_target';
    const ACTIVE_SOURCE_TARGET_EVENT = 'noteconnection:active-target-changed';
    const AGENT_CONVERSATION_ENDPOINT = '/api/knowledge/conversation';

    function normalizeActiveSourceTarget(value) {
        const normalized = String(value || '').trim();
        return normalized || 'ALL_FOLDERS';
    }

    function getActiveSourceTargetSnapshot() {
        if (window.__NC_ACTIVE_SOURCE_TARGET && typeof window.__NC_ACTIVE_SOURCE_TARGET === 'object') {
            return window.__NC_ACTIVE_SOURCE_TARGET;
        }
        const folderSelect = getElement('folder-select');
        const selectedTarget = folderSelect && typeof folderSelect.value === 'string'
            ? folderSelect.value
            : '';
        const rememberedTarget = typeof localStorage !== 'undefined'
            ? String(localStorage.getItem(ACTIVE_SOURCE_TARGET_STORAGE_KEY) || '').trim()
            : '';
        const target = normalizeActiveSourceTarget(selectedTarget || rememberedTarget);
        return {
            target,
            scope: target === 'ALL_FOLDERS'
                ? null
                : {
                    workspaceId: target.toLowerCase(),
                    corpusId: target.toLowerCase(),
                    sourcePathPrefixes: [`Knowledge_Base/${target}`],
                },
        };
    }

    function resolveKnowledgeWorkspaceRequestContext() {
        const activeTargetSnapshot = getActiveSourceTargetSnapshot();
        const target = normalizeActiveSourceTarget(activeTargetSnapshot && activeTargetSnapshot.target);
        return {
            activeTarget: target,
            scope: activeTargetSnapshot && activeTargetSnapshot.scope
                ? {
                    workspaceId: activeTargetSnapshot.scope.workspaceId,
                    corpusId: activeTargetSnapshot.scope.corpusId,
                    sourcePathPrefixes: Array.isArray(activeTargetSnapshot.scope.sourcePathPrefixes)
                        ? activeTargetSnapshot.scope.sourcePathPrefixes.slice()
                        : [],
                }
                : undefined,
        };
    }

    function buildScopeForTarget(target) {
        const normalizedTarget = normalizeActiveSourceTarget(target);
        return normalizedTarget === 'ALL_FOLDERS'
            ? null
            : {
                workspaceId: normalizedTarget.toLowerCase(),
                corpusId: normalizedTarget.toLowerCase(),
                sourcePathPrefixes: [`Knowledge_Base/${normalizedTarget}`],
            };
    }

    function buildActiveSourceTargetPayload(target, source) {
        const normalizedTarget = normalizeActiveSourceTarget(target);
        return {
            target: normalizedTarget,
            source: String(source || 'agent-workspace').trim() || 'agent-workspace',
            scope: buildScopeForTarget(normalizedTarget),
        };
    }

    function publishWorkspaceScopeTarget(target, source) {
        const payload = buildActiveSourceTargetPayload(target, source);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(ACTIVE_SOURCE_TARGET_STORAGE_KEY, payload.target);
        }
        window.__NC_ACTIVE_SOURCE_TARGET = payload;
        if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent(ACTIVE_SOURCE_TARGET_EVENT, { detail: payload }));
        }
        return payload;
    }

    function getAvailableWorkspaceScopeOptions() {
        const folderSelect = getElement('folder-select');
        const options = folderSelect && folderSelect.options
            ? Array.from(folderSelect.options)
                .map((option) => ({
                    value: normalizeActiveSourceTarget(option.value),
                    label: String(option.textContent || option.value || '').trim() || normalizeActiveSourceTarget(option.value),
                    disabled: option.disabled === true,
                }))
                .filter((option) => option.value && !option.disabled)
            : [];
        if (options.length > 0) {
            return options;
        }
        const activeTarget = resolveKnowledgeWorkspaceRequestContext().activeTarget;
        return [{
            value: activeTarget,
            label: activeTarget === 'ALL_FOLDERS'
                ? translate('agentWorkspace.scope.allFolders', 'All folders')
                : activeTarget,
            disabled: false,
        }];
    }

    function updateWorkspaceScopeSummary(target) {
        const summary = getElement('agent-workspace-scope-summary');
        if (!summary) {
            return;
        }
        const normalizedTarget = normalizeActiveSourceTarget(target);
        summary.textContent = normalizedTarget === 'ALL_FOLDERS'
            ? translate('agentWorkspace.scope.summaryAll', 'All folders')
            : translate('agentWorkspace.scope.summaryScoped', 'Scope: {scope}', { scope: normalizedTarget });
    }

    function renderWorkspaceScopeSelector() {
        const scopeSelect = getElement('agent-workspace-scope-select');
        if (!scopeSelect) {
            return;
        }
        const options = getAvailableWorkspaceScopeOptions();
        const activeTarget = resolveKnowledgeWorkspaceRequestContext().activeTarget;
        const previousValue = scopeSelect.value;
        scopeSelect.innerHTML = '';
        options.forEach((option) => {
            const node = document.createElement('option');
            node.value = option.value;
            node.textContent = option.label;
            scopeSelect.appendChild(node);
        });
        const optionValues = new Set(options.map((option) => option.value));
        scopeSelect.value = optionValues.has(activeTarget)
            ? activeTarget
            : (optionValues.has(previousValue) ? previousValue : (options[0] && options[0].value || 'ALL_FOLDERS'));
        updateWorkspaceScopeSummary(scopeSelect.value);
    }

    function syncGlobalFolderSelectFromWorkspace(target) {
        const folderSelect = getElement('folder-select');
        if (!folderSelect || !folderSelect.options) {
            return false;
        }
        const normalizedTarget = normalizeActiveSourceTarget(target);
        const hasOption = Array.from(folderSelect.options).some((option) => option.value === normalizedTarget);
        if (!hasOption) {
            return false;
        }
        if (folderSelect.value !== normalizedTarget) {
            folderSelect.value = normalizedTarget;
            if (typeof folderSelect.dispatchEvent === 'function') {
                folderSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        return true;
    }

    function bindWorkspaceScopeSelector() {
        const scopeSelect = getElement('agent-workspace-scope-select');
        if (!scopeSelect || scopeSelect.getAttribute('data-agent-scope-bound') === 'true') {
            return;
        }
        scopeSelect.setAttribute('data-agent-scope-bound', 'true');
        scopeSelect.addEventListener('change', function () {
            const target = normalizeActiveSourceTarget(scopeSelect.value);
            syncGlobalFolderSelectFromWorkspace(target);
            publishWorkspaceScopeTarget(target, 'agent-workspace-scope');
            renderWorkspaceScopeSelector();
        });
    }

    function observeGlobalScopeOptions() {
        const folderSelect = getElement('folder-select');
        if (!folderSelect || folderSelect.getAttribute('data-agent-scope-observed') === 'true') {
            return;
        }
        folderSelect.setAttribute('data-agent-scope-observed', 'true');
        if (typeof MutationObserver === 'function') {
            const observer = new MutationObserver(function () {
                renderWorkspaceScopeSelector();
            });
            observer.observe(folderSelect, { childList: true, subtree: true, attributes: true });
        }
    }

    function translate(key, fallback, params) {
        if (
            window.i18n
            && window.i18n.isInitialized !== false
            && typeof window.i18n.t === 'function'
        ) {
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

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatKnowledgeRunSourceRef(value) {
        const sourcePath = String(value && value.sourcePath || value && value.sourceRef || '').trim();
        if (!sourcePath) {
            return '';
        }
        const startLine = Number(value && value.startLine);
        return Number.isFinite(startLine) && startLine > 0
            ? `${sourcePath}:${startLine}`
            : sourcePath;
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
        fetch_workflow_artifacts: {
            endpoint: '/api/knowledge/workflow-artifacts',
            method: 'GET',
            defaultResultPresentation: 'flashcard_batch_card',
        },
        execute_workflow_artifact_review_follow_up: {
            endpoint: '/api/knowledge/workflow-artifacts/review-follow-up',
            method: 'POST',
            defaultResultPresentation: 'workflow_artifact_review_follow_up',
        },
        execute_study_session_action: {
            endpoint: '/api/knowledge/session/action',
            method: 'POST',
            defaultResultPresentation: 'assistant_message',
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
        fetch_workflow_artifacts: resolveWorkflowArtifactsRequestPayload,
        execute_workflow_artifact_review_follow_up: resolveWorkflowArtifactReviewFollowUpRequestPayload,
        execute_study_session_action: resolveStudySessionActionRequestPayload,
        build_study_session: resolveStudySessionRequestPayload,
        execute_tutor_action: resolveTutorActionRequestPayload,
    };

    const KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES = {
        fetch_workflow_artifacts: ['knowledge_run_card', 'knowledge_run_history_card'],
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
        return requestJson(AGENT_CONVERSATION_ENDPOINT, {
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
        const endpoint = AGENT_CONVERSATION_ENDPOINT;
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
        const startedAt = Date.now();
        try {
            const result = await requestConversationStream(requestPayload, {
                turnId: initialTurnId,
            });
            return {
                result,
                transport: 'SSE',
                latencyMs: Date.now() - startedAt,
            };
        } catch (streamError) {
            const resumeTurnId = resolveConversationResumeTurnId(streamError, initialTurnId);
            const result = await requestConversationSync(requestPayload, {
                turnId: resumeTurnId,
            });
            return {
                result,
                transport: resumeTurnId ? 'Sync fallback' : 'Sync',
                latencyMs: Date.now() - startedAt,
            };
        }
    }

    function pluralizeApiStatusCount(count, singular, plural) {
        return `${count} ${count === 1 ? singular : plural}`;
    }

    function buildConversationGroundingPayload(result) {
        const citationCount = Array.isArray(result && result.citations) ? result.citations.length : 0;
        const memoryCount = Array.isArray(result && result.recalledMemories) ? result.recalledMemories.length : 0;
        const memoryActionCount = Array.isArray(result && result.memoryActions) ? result.memoryActions.length : 0;
        const usedScope = result && result.trace && result.trace.usedScope ? result.trace.usedScope : null;
        const readiness = result && result.trace ? result.trace.workspaceReadiness : null;
        const missDiagnostics = result && result.trace ? result.trace.missDiagnostics : null;
        const graphContext = result && result.trace && result.trace.graphContext ? result.trace.graphContext : null;
        if (citationCount <= 0 && memoryCount <= 0 && memoryActionCount <= 0 && !readiness && !missDiagnostics && !graphContext) {
            return null;
        }
        const requestContext = resolveKnowledgeWorkspaceRequestContext();
        const scopeLabel = usedScope && usedScope.workspaceId
            ? String(usedScope.workspaceId)
            : usedScope && usedScope.corpusId
                ? String(usedScope.corpusId)
                : requestContext.scope && requestContext.scope.workspaceId
                    ? String(requestContext.scope.workspaceId)
                    : requestContext.activeTarget && requestContext.activeTarget !== 'ALL_FOLDERS'
                        ? String(requestContext.activeTarget)
                        : 'global';
        return {
            scopeLabel,
            citationCount,
            memoryCount,
            memoryActionCount,
            readinessMessage: readiness && readiness.message ? String(readiness.message) : '',
            missMessage: missDiagnostics && missDiagnostics.message ? String(missDiagnostics.message) : '',
            graphContext: graphContext && typeof graphContext === 'object'
                ? graphContext
                : null,
        };
    }

    function updateConversationApiStatus(status) {
        const node = getElement('agent-workspace-api-status');
        if (!node) {
            return;
        }
        const state = String(status && status.state || 'idle').trim() || 'idle';
        const endpoint = String(status && status.endpoint || AGENT_CONVERSATION_ENDPOINT).trim();
        const transport = String(status && status.transport || '').trim();
        const latencyMs = Number.isFinite(Number(status && status.latencyMs))
            ? Math.max(0, Math.round(Number(status.latencyMs)))
            : null;
        const error = String(status && status.error || '').trim();
        const activeTarget = String(status && status.activeTarget || '').trim();
        const result = status && typeof status.result === 'object' ? status.result : null;
        const groundingPayload = result ? buildConversationGroundingPayload(result) : null;
        const summary = result && typeof result.summary === 'object' ? result.summary : {};
        const trace = result && typeof result.trace === 'object' ? result.trace : {};
        const retrievalTrace = trace && typeof trace.retrieval === 'object' ? trace.retrieval : {};
        const scopeRecovery = retrievalTrace && typeof retrievalTrace.scopeRecovery === 'object'
            ? retrievalTrace.scopeRecovery
            : null;
        const recoveredSourcePaths = Array.isArray(scopeRecovery && scopeRecovery.recoveredSourcePaths)
            ? scopeRecovery.recoveredSourcePaths
                .map((sourcePath) => String(sourcePath || '').trim())
                .filter(Boolean)
            : [];
        const knowledgePointCount = Number.isFinite(Number(summary.returnedKnowledgePoints))
            ? Number(summary.returnedKnowledgePoints)
            : (Array.isArray(result && result.knowledgePoints) ? result.knowledgePoints.length : 0);
        const citationCount = Number.isFinite(Number(summary.returnedCitations))
            ? Number(summary.returnedCitations)
            : (Array.isArray(result && result.citations) ? result.citations.length : 0);
        const memoryCount = Number.isFinite(Number(summary.recalledMemoryCount))
            ? Number(summary.recalledMemoryCount)
            : (Array.isArray(result && result.recalledMemories) ? result.recalledMemories.length : 0);
        const stateLabel = state === 'pending'
            ? translate('agentWorkspace.apiStatus.pending', 'Checking')
            : state === 'ok'
                ? translate('agentWorkspace.apiStatus.ok', 'Available')
                : state === 'error'
                    ? translate('agentWorkspace.apiStatus.error', 'Failed')
                    : translate('agentWorkspace.apiStatus.idle', 'Idle');
        const details = [
            endpoint,
            transport,
            latencyMs !== null ? `${latencyMs} ms` : '',
            activeTarget
                ? translate('agentWorkspace.apiStatus.scope', 'Scope: {scope}', { scope: activeTarget })
                : '',
            state === 'ok' ? pluralizeApiStatusCount(knowledgePointCount, 'knowledge point', 'knowledge points') : '',
            state === 'ok' ? pluralizeApiStatusCount(citationCount, 'citation', 'citations') : '',
            state === 'ok' ? pluralizeApiStatusCount(memoryCount, 'memory', 'memories') : '',
            state === 'ok' && recoveredSourcePaths.length > 0
                ? translate('agentWorkspace.apiStatus.recovered', 'Recovered: {sources}', {
                    sources: recoveredSourcePaths.slice(0, 2).join(', '),
                })
                : '',
            error,
        ].filter(Boolean);
        if (window && typeof window === 'object') {
            window.__NC_LAST_AGENT_CONVERSATION_GROUNDING = (
                state === 'ok' && groundingPayload
            )
                ? groundingPayload
                : null;
        }
        node.setAttribute('data-api-state', state);
        node.setAttribute(
            'data-agent-inspectable',
            (
                state === 'ok'
                && Boolean(groundingPayload)
            )
                ? 'true'
                : 'false'
        );
        node.innerHTML = `
            <span class="agent-api-status-dot" aria-hidden="true"></span>
            <span class="agent-api-status-label">${escapeHtml(stateLabel)}</span>
            <span class="agent-api-status-detail">${escapeHtml(details.join(' | '))}</span>
        `;
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

    function appendAssistantConversationResult(result) {
        const controller = getController();
        if (window && typeof window === 'object') {
            window.__NC_LAST_AGENT_CONVERSATION_RESULT = result || null;
        }
        const assistantBlocks = Array.isArray(result && result.assistantBlocks)
            ? result.assistantBlocks.filter((block) => block && typeof block === 'object')
            : [];
        const visibleAssistantBlocks = assistantBlocks.filter((block) => {
            const type = String(block && block.type || '').trim();
            return type === 'structured_answer' || type === 'main_markdown' || type === 'html_artifact';
        });
        const fallbackMessage = String(
            result && (
                result.assistantMessage
                || result.answer
                || result.message
            )
            || ''
        ).trim();
        if (
            controller
            && visibleAssistantBlocks.length > 0
            && typeof controller.appendConversationBlocks === 'function'
        ) {
            return controller.appendConversationBlocks({
                role: 'assistant',
                blocks: visibleAssistantBlocks,
                fallbackMessage,
            });
        }
        if (fallbackMessage) {
            return appendAssistantMessage(fallbackMessage);
        }
        return null;
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

    function appendLocalizedSystemMessage(key, fallback, params) {
        const controller = getController();
        if (!controller) {
            return null;
        }
        return controller.appendConversationMessage({
            role: 'system',
            message: translate(key, fallback, params),
            messageKey: key,
            params: params || {},
        });
    }

    function openGroundingInspector() {
        const controller = getController();
        const grounding = window.__NC_LAST_AGENT_CONVERSATION_GROUNDING;
        if (!controller || typeof controller.openEvidencePane !== 'function' || !grounding || typeof grounding !== 'object') {
            return;
        }
        controller.openEvidencePane(Object.assign({
            kind: 'grounding',
            title: translate('agentWorkspace.evidence.groundingTitle', 'Grounding Inspector'),
        }, grounding));
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

    function appendGroundingSummaryMessage(result) {
        const groundingPayload = buildConversationGroundingPayload(result);
        if (window && typeof window === 'object') {
            window.__NC_LAST_AGENT_CONVERSATION_GROUNDING = groundingPayload;
        }
        return null;
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

    function resolveWorkflowArtifactsRequestPayload(_item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const artifactKinds = Array.isArray(capabilityRequest.artifactKinds)
            ? capabilityRequest.artifactKinds.map((kind) => String(kind || '').trim()).filter(Boolean)
            : ['flashcard_batch'];
        const requestContext = resolveKnowledgeWorkspaceRequestContext();
        const explicitWorkspaceId = typeof capabilityRequest.workspaceId === 'string' && capabilityRequest.workspaceId.trim()
            ? capabilityRequest.workspaceId.trim()
            : '';
        const explicitSessionId = typeof capabilityRequest.sessionId === 'string' && capabilityRequest.sessionId.trim()
            ? capabilityRequest.sessionId.trim()
            : '';
        const artifactId = typeof capabilityRequest.artifactId === 'string' && capabilityRequest.artifactId.trim()
            ? capabilityRequest.artifactId.trim()
            : undefined;
        const runId = typeof capabilityRequest.runId === 'string' && capabilityRequest.runId.trim()
            ? capabilityRequest.runId.trim()
            : undefined;
        return {
            workspaceId: explicitWorkspaceId || (requestContext.scope && requestContext.scope.workspaceId) || undefined,
            sessionId: explicitSessionId
                ? explicitSessionId
                : (artifactId || runId ? undefined : getOrCreateConversationSessionId(getUserId())),
            userId: getUserId(),
            artifactId,
            runId,
            artifactKinds: artifactKinds.join(','),
            limit: Number.isFinite(Number(capabilityRequest.limit))
                ? Number(capabilityRequest.limit)
                : 8,
        };
    }

    function resolveStudySessionActionRequestPayload(item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const targetAtomId = resolveCapabilityTargetAtomId(item, capability);
        return {
            userId: getUserId(),
            sessionId: getOrCreateConversationSessionId(getUserId()),
            action: {
                atomId: targetAtomId,
                kind: typeof capabilityRequest.learningActionKind === 'string' && capabilityRequest.learningActionKind.trim()
                    ? capabilityRequest.learningActionKind.trim()
                    : 'review',
                source: typeof capabilityRequest.actionSource === 'string' && capabilityRequest.actionSource.trim()
                    ? capabilityRequest.actionSource.trim()
                    : 'misconception_remediation',
                prompt: typeof capabilityRequest.prompt === 'string' && capabilityRequest.prompt.trim()
                    ? capabilityRequest.prompt.trim()
                    : undefined,
                answer: typeof capabilityRequest.answer === 'string' && capabilityRequest.answer.trim()
                    ? capabilityRequest.answer.trim()
                    : undefined,
            },
            persistMemory: capabilityRequest.persistMemory !== false,
            autoAnalyzeAnswer: capabilityRequest.autoAnalyzeAnswer !== false,
            autoUpdateMasteryFromAnswer: capabilityRequest.autoUpdateMasteryFromAnswer !== false,
        };
    }

    function resolveWorkflowArtifactReviewFollowUpRequestPayload(item, capability) {
        const capabilityRequest = capability && typeof capability.request === 'object'
            ? capability.request
            : {};
        const targetAtomId = resolveCapabilityTargetAtomId(item, capability);
        return {
            userId: getUserId(),
            sessionId: typeof capabilityRequest.sessionId === 'string' && capabilityRequest.sessionId.trim()
                ? capabilityRequest.sessionId.trim()
                : getOrCreateConversationSessionId(getUserId()),
            artifactId: typeof capabilityRequest.artifactId === 'string' && capabilityRequest.artifactId.trim()
                ? capabilityRequest.artifactId.trim()
                : '',
            cardId: typeof capabilityRequest.cardId === 'string' && capabilityRequest.cardId.trim()
                ? capabilityRequest.cardId.trim()
                : '',
            action: {
                atomId: targetAtomId,
                kind: typeof capabilityRequest.learningActionKind === 'string' && capabilityRequest.learningActionKind.trim()
                    ? capabilityRequest.learningActionKind.trim()
                    : 'review',
                source: typeof capabilityRequest.actionSource === 'string' && capabilityRequest.actionSource.trim()
                    ? capabilityRequest.actionSource.trim()
                    : 'flashcard_batch',
                prompt: typeof capabilityRequest.prompt === 'string' && capabilityRequest.prompt.trim()
                    ? capabilityRequest.prompt.trim()
                    : undefined,
                answer: typeof capabilityRequest.answer === 'string' && capabilityRequest.answer.trim()
                    ? capabilityRequest.answer.trim()
                    : undefined,
            },
            persistMemory: capabilityRequest.persistMemory !== false,
            autoAnalyzeAnswer: capabilityRequest.autoAnalyzeAnswer !== false,
            autoUpdateMasteryFromAnswer: capabilityRequest.autoUpdateMasteryFromAnswer !== false,
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
        const circuitBudget = result && result.queryVectorAccelerationCircuitBudget && typeof result.queryVectorAccelerationCircuitBudget === 'object'
            ? result.queryVectorAccelerationCircuitBudget
            : {};
        const indexSyncHealth = result && result.queryVectorAccelerationIndexSyncHealth && typeof result.queryVectorAccelerationIndexSyncHealth === 'object'
            ? result.queryVectorAccelerationIndexSyncHealth
            : {};
        const traceability = result && result.queryVectorAccelerationTraceability && typeof result.queryVectorAccelerationTraceability === 'object'
            ? result.queryVectorAccelerationTraceability
            : {};
        const prefilter = result && result.queryVectorAccelerationPrefilter && typeof result.queryVectorAccelerationPrefilter === 'object'
            ? result.queryVectorAccelerationPrefilter
            : {};
        const calibrationReadiness = result && result.queryVectorAccelerationCalibrationReadiness && typeof result.queryVectorAccelerationCalibrationReadiness === 'object'
            ? result.queryVectorAccelerationCalibrationReadiness
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
            annCircuitHealthStatus: String(circuitBudget.healthStatus || '').trim(),
            annCircuitState: String(circuitBudget.circuitState || '').trim(),
            annCircuitBudgetStatus: String(circuitBudget.budgetStatus || '').trim(),
            annCircuitShortCircuitRatioPct: Number(Number(circuitBudget.shortCircuitRatioPct || 0).toFixed(4)),
            annCircuitWarnBudgetShortCircuitCountLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.shortCircuitCountLt))
                ? Number(circuitBudget.budget.warn.shortCircuitCountLt)
                : 0,
            annCircuitWarnBudgetShortCircuitRatioPctLt: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.shortCircuitRatioPctLt || 0).toFixed(4)),
            annCircuitWarnBudgetConsecutiveFailuresLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.consecutiveFailuresLt))
                ? Number(circuitBudget.budget.warn.consecutiveFailuresLt)
                : 0,
            annCircuitWarnBudgetHalfOpenSuccessRatePctGte: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.halfOpenSuccessRatePctGte || 0).toFixed(4)),
            annCircuitFailBudgetShortCircuitCountLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.shortCircuitCountLt))
                ? Number(circuitBudget.budget.fail.shortCircuitCountLt)
                : 0,
            annCircuitFailBudgetShortCircuitRatioPctLt: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.shortCircuitRatioPctLt || 0).toFixed(4)),
            annCircuitFailBudgetConsecutiveFailuresLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.consecutiveFailuresLt))
                ? Number(circuitBudget.budget.fail.consecutiveFailuresLt)
                : 0,
            annCircuitFailBudgetHalfOpenSuccessRatePctGte: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.halfOpenSuccessRatePctGte || 0).toFixed(4)),
            annCircuitWarnBudgetExceeded: Boolean(circuitBudget.warnBudgetExceeded),
            annCircuitFailBudgetExceeded: Boolean(circuitBudget.failBudgetExceeded),
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
            annTraceabilityCoverage: String(traceability.correlationCoverage || '').trim(),
            annTraceabilityMissingFields: Array.isArray(traceability.missingFields)
                ? traceability.missingFields
                    .map((item) => String(item || '').trim())
                    .filter(Boolean)
                : [],
            annTraceabilityLastRequestId: String(traceability.lastRequestId || '').trim(),
            annTraceabilityRequestCount: Number.isFinite(Number(traceability.requestCount))
                ? Number(traceability.requestCount)
                : 0,
            annTraceabilityConsecutiveFailures: Number.isFinite(Number(traceability.consecutiveFailures))
                ? Number(traceability.consecutiveFailures)
                : 0,
            annTraceabilityShortCircuitCount: Number.isFinite(Number(traceability.shortCircuitCount))
                ? Number(traceability.shortCircuitCount)
                : 0,
            annPrefilterSelectionMode: String(prefilter.selectionMode || '').trim(),
            annPrefilterBudgetStatus: String(prefilter.budgetStatus || '').trim(),
            annPrefilterCandidateRatioPct: Number(Number(prefilter.candidateRatioPct || 0).toFixed(4)),
            annPrefilterFullScanFallback: Boolean(prefilter.fullScanFallback),
            annPrefilterMinRequestSampleGte: Number.isFinite(Number(prefilter && prefilter.budget && prefilter.budget.minRequestSampleGte))
                ? Number(prefilter.budget.minRequestSampleGte)
                : 0,
            annPrefilterWarnCandidateRatioPctLt: Number(Number(prefilter && prefilter.budget && prefilter.budget.warnCandidateRatioPctLt || 0).toFixed(4)),
            annPrefilterFailCandidateRatioPctLt: Number(Number(prefilter && prefilter.budget && prefilter.budget.failCandidateRatioPctLt || 0).toFixed(4)),
            annPrefilterSampleReady: Boolean(prefilter.sampleReady),
            annPrefilterSelectionActive: Boolean(prefilter.selectionActive),
            annPrefilterStableConnector: Boolean(prefilter.stableConnector),
            annPrefilterCanEvaluateCandidateRatio: Boolean(prefilter.canEvaluateCandidateRatio),
            annPrefilterWarnBudgetExceeded: Boolean(prefilter.warnBudgetExceeded),
            annPrefilterFailBudgetExceeded: Boolean(prefilter.failBudgetExceeded),
            annCalibrationStatus: String(calibrationReadiness.status || '').trim(),
            annCalibrationMode: String(calibrationReadiness.mode || '').trim(),
            annCalibrationExternalConnector: Boolean(calibrationReadiness.externalConnector),
            annCalibrationSyncReady: Boolean(calibrationReadiness.syncReady),
            annCalibrationSampleReady: Boolean(calibrationReadiness.sampleReady),
            annCalibrationSelectionActive: Boolean(calibrationReadiness.selectionActive),
            annCalibrationStableConnector: Boolean(calibrationReadiness.stableConnector),
            annCalibrationCanEvaluateCandidateRatio: Boolean(calibrationReadiness.canEvaluateCandidateRatio),
            annCalibrationTraceabilityReady: Boolean(calibrationReadiness.traceabilityReady),
            annCalibrationCircuitBudgetStatus: String(calibrationReadiness.circuitBudgetStatus || '').trim(),
            annCalibrationPrefilterBudgetStatus: String(calibrationReadiness.prefilterBudgetStatus || '').trim(),
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
        const circuitBudget = summary && summary.queryVectorAccelerationCircuitBudget && typeof summary.queryVectorAccelerationCircuitBudget === 'object'
            ? summary.queryVectorAccelerationCircuitBudget
            : {};
        const firstCheckIndexSyncHealth = firstCheck && firstCheck.queryVectorAccelerationIndexSyncHealth && typeof firstCheck.queryVectorAccelerationIndexSyncHealth === 'object'
            ? firstCheck.queryVectorAccelerationIndexSyncHealth
            : {};
        const traceability = summary && summary.queryVectorAccelerationTraceability && typeof summary.queryVectorAccelerationTraceability === 'object'
            ? summary.queryVectorAccelerationTraceability
            : {};
        const prefilter = summary && summary.queryVectorAccelerationPrefilter && typeof summary.queryVectorAccelerationPrefilter === 'object'
            ? summary.queryVectorAccelerationPrefilter
            : {};
        const calibrationReadiness = summary && summary.queryVectorAccelerationCalibrationReadiness && typeof summary.queryVectorAccelerationCalibrationReadiness === 'object'
            ? summary.queryVectorAccelerationCalibrationReadiness
            : {};
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
            firstCheckAnnIndexSyncStatus: String(firstCheckIndexSyncHealth.indexSyncStatus || '').trim(),
            firstCheckAnnIndexSyncCounts: `${Number.isFinite(Number(firstCheckIndexSyncHealth.syncRequestCount)) ? Number(firstCheckIndexSyncHealth.syncRequestCount) : 0}/${Number.isFinite(Number(firstCheckIndexSyncHealth.syncSuccessCount)) ? Number(firstCheckIndexSyncHealth.syncSuccessCount) : 0}/${Number.isFinite(Number(firstCheckIndexSyncHealth.syncFailureCount)) ? Number(firstCheckIndexSyncHealth.syncFailureCount) : 0}`,
            annCircuitState: String(circuitBudget.circuitState || '').trim(),
            annCircuitBudgetStatus: String(circuitBudget.budgetStatus || '').trim(),
            annCircuitShortCircuitRatioPct: Number(Number(circuitBudget.shortCircuitRatioPct || 0).toFixed(4)),
            annCircuitWarnBudgetShortCircuitCountLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.shortCircuitCountLt))
                ? Number(circuitBudget.budget.warn.shortCircuitCountLt)
                : 0,
            annCircuitWarnBudgetShortCircuitRatioPctLt: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.shortCircuitRatioPctLt || 0).toFixed(4)),
            annCircuitWarnBudgetConsecutiveFailuresLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.consecutiveFailuresLt))
                ? Number(circuitBudget.budget.warn.consecutiveFailuresLt)
                : 0,
            annCircuitWarnBudgetHalfOpenSuccessRatePctGte: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.warn && circuitBudget.budget.warn.halfOpenSuccessRatePctGte || 0).toFixed(4)),
            annCircuitFailBudgetShortCircuitCountLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.shortCircuitCountLt))
                ? Number(circuitBudget.budget.fail.shortCircuitCountLt)
                : 0,
            annCircuitFailBudgetShortCircuitRatioPctLt: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.shortCircuitRatioPctLt || 0).toFixed(4)),
            annCircuitFailBudgetConsecutiveFailuresLt: Number.isFinite(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.consecutiveFailuresLt))
                ? Number(circuitBudget.budget.fail.consecutiveFailuresLt)
                : 0,
            annCircuitFailBudgetHalfOpenSuccessRatePctGte: Number(Number(circuitBudget && circuitBudget.budget && circuitBudget.budget.fail && circuitBudget.budget.fail.halfOpenSuccessRatePctGte || 0).toFixed(4)),
            annCircuitWarnBudgetExceeded: Boolean(circuitBudget.warnBudgetExceeded),
            annCircuitFailBudgetExceeded: Boolean(circuitBudget.failBudgetExceeded),
            annTraceabilityCoverage: String(traceability.correlationCoverage || '').trim(),
            annTraceabilityMissingFieldCount: Array.isArray(traceability.missingFields)
                ? traceability.missingFields.filter((item) => String(item || '').trim().length > 0).length
                : 0,
            annTraceabilityRequestCount: Number.isFinite(Number(traceability.requestCount))
                ? Number(traceability.requestCount)
                : 0,
            annTraceabilityConsecutiveFailures: Number.isFinite(Number(traceability.consecutiveFailures))
                ? Number(traceability.consecutiveFailures)
                : 0,
            annTraceabilityShortCircuitCount: Number.isFinite(Number(traceability.shortCircuitCount))
                ? Number(traceability.shortCircuitCount)
                : 0,
            annPrefilterSelectionMode: String(prefilter.selectionMode || '').trim(),
            annPrefilterBudgetStatus: String(prefilter.budgetStatus || '').trim(),
            annPrefilterCandidateRatioPct: Number(Number(prefilter.candidateRatioPct || 0).toFixed(4)),
            annPrefilterMinRequestSampleGte: Number.isFinite(Number(prefilter && prefilter.budget && prefilter.budget.minRequestSampleGte))
                ? Number(prefilter.budget.minRequestSampleGte)
                : 0,
            annPrefilterWarnCandidateRatioPctLt: Number(Number(prefilter && prefilter.budget && prefilter.budget.warnCandidateRatioPctLt || 0).toFixed(4)),
            annPrefilterFailCandidateRatioPctLt: Number(Number(prefilter && prefilter.budget && prefilter.budget.failCandidateRatioPctLt || 0).toFixed(4)),
            annPrefilterSampleReady: Boolean(prefilter.sampleReady),
            annPrefilterSelectionActive: Boolean(prefilter.selectionActive),
            annPrefilterStableConnector: Boolean(prefilter.stableConnector),
            annPrefilterCanEvaluateCandidateRatio: Boolean(prefilter.canEvaluateCandidateRatio),
            annPrefilterWarnBudgetExceeded: Boolean(prefilter.warnBudgetExceeded),
            annPrefilterFailBudgetExceeded: Boolean(prefilter.failBudgetExceeded),
            annCalibrationStatus: String(calibrationReadiness.status || '').trim(),
            annCalibrationMode: String(calibrationReadiness.mode || '').trim(),
            annCalibrationExternalConnector: Boolean(calibrationReadiness.externalConnector),
            annCalibrationSyncReady: Boolean(calibrationReadiness.syncReady),
            annCalibrationSampleReady: Boolean(calibrationReadiness.sampleReady),
            annCalibrationSelectionActive: Boolean(calibrationReadiness.selectionActive),
            annCalibrationStableConnector: Boolean(calibrationReadiness.stableConnector),
            annCalibrationCanEvaluateCandidateRatio: Boolean(calibrationReadiness.canEvaluateCandidateRatio),
            annCalibrationTraceabilityReady: Boolean(calibrationReadiness.traceabilityReady),
            annCalibrationCircuitBudgetStatus: String(calibrationReadiness.circuitBudgetStatus || '').trim(),
            annCalibrationPrefilterBudgetStatus: String(calibrationReadiness.prefilterBudgetStatus || '').trim(),
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

    function buildFlashcardBatchCardPayloadFromArtifacts(artifacts, returnedArtifacts) {
        const normalizedArtifacts = Array.isArray(artifacts)
            ? artifacts.filter((artifact) => artifact && typeof artifact === 'object')
            : [];
        const flashcardArtifacts = normalizedArtifacts.filter((artifact) => String(artifact.kind || '').trim() === 'flashcard_batch');
        const normalizedArtifactCards = flashcardArtifacts.map(function (artifact) {
            const payload = artifact && typeof artifact.payload === 'object'
                ? artifact.payload
                : {};
            const reviewCards = Array.isArray(payload.reviewCards)
                ? payload.reviewCards.filter((card) => card && typeof card === 'object')
                : [];
            const reviewState = payload.reviewState && typeof payload.reviewState === 'object'
                ? payload.reviewState
                : {};
            const consumedCardIds = Array.isArray(reviewState.consumedCardIds)
                ? new Set(reviewState.consumedCardIds.map((value) => String(value || '').trim()).filter(Boolean))
                : new Set();
            const pendingCards = reviewCards.filter((card) => !consumedCardIds.has(String(card.cardId || '').trim()));
            return {
                artifact,
                reviewCards,
                consumedCardIds,
                pendingCards,
                completedCards: Number.isFinite(Number(reviewState.completedReviewCardCount))
                    ? Number(reviewState.completedReviewCardCount)
                    : consumedCardIds.size,
                remainingCards: Number.isFinite(Number(reviewState.remainingReviewCardCount))
                    ? Number(reviewState.remainingReviewCardCount)
                    : pendingCards.length,
            };
        });
        const totalCards = normalizedArtifactCards.reduce(function (sum, entry) {
            return sum + entry.reviewCards.length;
        }, 0);
        const completedCards = normalizedArtifactCards.reduce(function (sum, entry) {
            return sum + entry.completedCards;
        }, 0);
        const remainingCards = normalizedArtifactCards.reduce(function (sum, entry) {
            return sum + entry.remainingCards;
        }, 0);
        const firstPendingEntry = normalizedArtifactCards.find((entry) => entry.pendingCards.length > 0) || null;
        const firstArtifactEntry = firstPendingEntry || normalizedArtifactCards[0] || null;
        const firstCard = firstPendingEntry && firstPendingEntry.pendingCards[0] && typeof firstPendingEntry.pendingCards[0] === 'object'
            ? firstPendingEntry.pendingCards[0]
            : (
                firstArtifactEntry && firstArtifactEntry.reviewCards[0] && typeof firstArtifactEntry.reviewCards[0] === 'object'
                    ? firstArtifactEntry.reviewCards[0]
                    : {}
            );
        const firstArtifact = firstArtifactEntry ? firstArtifactEntry.artifact : (flashcardArtifacts[0] || {});
        const artifactKinds = Array.from(new Set(normalizedArtifacts.map((artifact) => String(artifact.kind || '').trim()).filter(Boolean)));
        const topEvidenceRef = Array.isArray(firstCard.evidenceRefs)
            ? firstCard.evidenceRefs.map((value) => String(value || '').trim()).filter(Boolean)[0] || ''
            : '';
        const topAtomId = String(firstCard.atomId || '').trim();
        const artifactId = String(firstArtifact && firstArtifact.artifactId || '').trim();
        const cardId = String(firstCard.cardId || '').trim();
        const artifactStatus = String(firstArtifact && firstArtifact.status || '').trim().toLowerCase();
        return {
            returnedArtifacts: Number.isFinite(Number(returnedArtifacts))
                ? Number(returnedArtifacts)
                : normalizedArtifacts.length,
            totalCards,
            completedCards,
            remainingCards,
            artifactKinds: artifactKinds.join(', '),
            artifactStatus,
            artifactId,
            cardId,
            topPrompt: String(firstCard.prompt || '').trim(),
            topEvidenceRef,
            nextCapability: firstPendingEntry && topAtomId && artifactId && cardId
                ? {
                    capabilityId: `cap_execute_flashcard_review_${artifactId}_${cardId}`,
                    actionId: 'execute_flashcard_review',
                    targetAtomId: topAtomId,
                    label: 'Review Now',
                    request: {
                        artifactId,
                        cardId,
                        learningActionKind: String(firstCard.suggestedActionKind || '').trim() || 'review',
                        actionSource: 'flashcard_batch',
                        prompt: String(firstCard.prompt || '').trim(),
                    },
                    execution: {
                        kind: 'knowledge_operation',
                        operationId: 'execute_workflow_artifact_review_follow_up',
                        resultPresentation: 'workflow_artifact_review_follow_up',
                    },
                }
                : null,
        };
    }

    function buildFlashcardBatchCardPayload(result) {
        const summary = result && typeof result === 'object'
            ? result
            : {};
        return buildFlashcardBatchCardPayloadFromArtifacts(summary.artifacts, summary.returnedArtifacts);
    }

    function buildKnowledgeRunCardPayload(result) {
        const summary = result && typeof result === 'object'
            ? result
            : {};
        const artifacts = Array.isArray(summary.artifacts)
            ? summary.artifacts.filter((artifact) => artifact && typeof artifact === 'object')
            : [];
        const knowledgeRunArtifact = artifacts.find((artifact) => String(artifact.kind || '').trim() === 'knowledge_run') || {};
        const artifactPayload = knowledgeRunArtifact && typeof knowledgeRunArtifact.payload === 'object'
            ? knowledgeRunArtifact.payload
            : {};
        const knowledgeRun = artifactPayload.knowledgeRun && typeof artifactPayload.knowledgeRun === 'object'
            ? artifactPayload.knowledgeRun
            : {};
        const runSummary = knowledgeRun.summary && typeof knowledgeRun.summary === 'object'
            ? knowledgeRun.summary
            : {};
        const reviewState = knowledgeRun.reviewState && typeof knowledgeRun.reviewState === 'object'
            ? knowledgeRun.reviewState
            : {};
        const quality = knowledgeRun.quality && typeof knowledgeRun.quality === 'object'
            ? knowledgeRun.quality
            : {};
        const scope = knowledgeRun.scope && typeof knowledgeRun.scope === 'object'
            ? knowledgeRun.scope
            : {};
        const claims = Array.isArray(knowledgeRun.evidenceClaims)
            ? knowledgeRun.evidenceClaims.filter((claim) => claim && typeof claim === 'object')
            : [];
        const reviewCards = Array.isArray(knowledgeRun.reviewCards)
            ? knowledgeRun.reviewCards.filter((card) => card && typeof card === 'object')
            : [];
        const qualityGates = Array.isArray(quality.gates)
            ? quality.gates.filter((gate) => gate && typeof gate === 'object')
            : [];
        const graphContext = artifactPayload.graphContext && typeof artifactPayload.graphContext === 'object'
            ? artifactPayload.graphContext
            : {};
        const graphDiagnostics = graphContext.diagnostics && typeof graphContext.diagnostics === 'object'
            ? graphContext.diagnostics
            : {};
        const temporalValidity = graphContext.temporalValidity && typeof graphContext.temporalValidity === 'object'
            ? graphContext.temporalValidity
            : {};
        const firstClaim = claims[0] && typeof claims[0] === 'object' ? claims[0] : {};
        const scopeLabel = [
            String(scope.workspaceId || '').trim(),
            String(scope.corpusId || '').trim(),
        ].filter(Boolean).join(' / ')
            || String(scope.source || '').trim()
            || 'global';
        const supportingTitles = Array.isArray(graphContext.supportingTitles)
            ? graphContext.supportingTitles.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        const connectionPaths = Array.isArray(graphContext.connectionPaths)
            ? graphContext.connectionPaths.filter((connectionPath) => connectionPath && typeof connectionPath === 'object')
            : [];
        const predecessorWindow = Array.isArray(graphContext.predecessorWindow)
            ? graphContext.predecessorWindow.filter((node) => node && typeof node === 'object')
            : [];
        const successorWindow = Array.isArray(graphContext.successorWindow)
            ? graphContext.successorWindow.filter((node) => node && typeof node === 'object')
            : [];
        const evidenceSourceRefs = Array.isArray(graphContext.evidenceSourceRefs)
            ? graphContext.evidenceSourceRefs.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        const temporalWarnings = Array.isArray(temporalValidity.warningReasons)
            ? temporalValidity.warningReasons.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        const missingConnectionPathSourceAtomIds = Array.isArray(graphDiagnostics.missingConnectionPathSourceAtomIds)
            ? graphDiagnostics.missingConnectionPathSourceAtomIds.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        const missingPredecessorAtomIds = Array.isArray(graphDiagnostics.missingPredecessorAtomIds)
            ? graphDiagnostics.missingPredecessorAtomIds.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        const missingSuccessorAtomIds = Array.isArray(graphDiagnostics.missingSuccessorAtomIds)
            ? graphDiagnostics.missingSuccessorAtomIds.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        const missingLookupCount = missingConnectionPathSourceAtomIds.length
            + missingPredecessorAtomIds.length
            + missingSuccessorAtomIds.length;
        return {
            returnedArtifacts: Number.isFinite(Number(summary.returnedArtifacts))
                ? Number(summary.returnedArtifacts)
                : artifacts.length,
            artifactId: String(knowledgeRunArtifact.artifactId || '').trim(),
            artifactStatus: String(knowledgeRunArtifact.status || '').trim().toLowerCase(),
            runId: String(knowledgeRun.runId || artifactPayload.runId || '').trim(),
            artifactTitle: String(knowledgeRunArtifact.title || '').trim(),
            scopeLabel,
            scopeSource: String(scope.scopeSource || scope.source || '').trim(),
            qualityStatus: String(quality.status || knowledgeRun.status || '').trim(),
            qualityScore: Number.isFinite(Number(quality.score)) ? Number(quality.score) : null,
            claimCount: Number.isFinite(Number(runSummary.claimCount)) ? Number(runSummary.claimCount) : claims.length,
            verifiedClaimCount: Number.isFinite(Number(runSummary.verifiedClaimCount)) ? Number(runSummary.verifiedClaimCount) : 0,
            weakClaimCount: Number.isFinite(Number(runSummary.weakClaimCount)) ? Number(runSummary.weakClaimCount) : 0,
            notProvenClaimCount: Number.isFinite(Number(runSummary.notProvenClaimCount)) ? Number(runSummary.notProvenClaimCount) : 0,
            rejectedClaimCount: Number.isFinite(Number(runSummary.rejectedClaimCount)) ? Number(runSummary.rejectedClaimCount) : 0,
            reviewCardCount: Number.isFinite(Number(runSummary.reviewCardCount)) ? Number(runSummary.reviewCardCount) : reviewCards.length,
            completedReviewCardCount: Number.isFinite(Number(runSummary.completedReviewCardCount))
                ? Number(runSummary.completedReviewCardCount)
                : Number(reviewState.completedReviewCardCount || 0),
            remainingReviewCardCount: Number.isFinite(Number(runSummary.remainingReviewCardCount))
                ? Number(runSummary.remainingReviewCardCount)
                : Number(reviewState.remainingReviewCardCount || 0),
            topClaimSourceRef: formatKnowledgeRunSourceRef(firstClaim),
            artifactSummary: String(knowledgeRunArtifact.summary || '').trim(),
            claims: claims.slice(0, 5).map(function (claim) {
                return {
                    atomId: String(claim.atomId || '').trim(),
                    title: String(claim.title || '').trim(),
                    status: String(claim.status || '').trim(),
                    confidencePct: Number((Number(claim.confidence || 0) * 100).toFixed(2)),
                    sourcePath: String(claim.sourcePath || '').trim(),
                    startLine: Number.isFinite(Number(claim.startLine)) ? Number(claim.startLine) : null,
                    endLine: Number.isFinite(Number(claim.endLine)) ? Number(claim.endLine) : null,
                    sourceRef: formatKnowledgeRunSourceRef(claim),
                    snippet: String(claim.snippet || claim.statement || '').trim(),
                    reason: String(claim.reason || '').trim(),
                };
            }),
            qualityGates: qualityGates.slice(0, 4).map(function (gate) {
                return {
                    gateId: String(gate.gateId || '').trim(),
                    passed: gate.passed === true,
                    message: String(gate.message || '').trim(),
                };
            }),
            reviewCards: reviewCards.slice(0, 4).map(function (card) {
                return {
                    prompt: String(card.prompt || '').trim(),
                    evidenceRefs: Array.isArray(card.evidenceRefs)
                        ? card.evidenceRefs.map((value) => String(value || '').trim()).filter(Boolean)
                        : [],
                };
            }),
            graphContext: (
                String(graphContext.anchorTitle || '').trim()
                || supportingTitles.length > 0
                || connectionPaths.length > 0
                || predecessorWindow.length > 0
                || successorWindow.length > 0
                || temporalWarnings.length > 0
                || evidenceSourceRefs.length > 0
            ) ? {
                anchorTitle: String(graphContext.anchorTitle || '').trim(),
                supportingTitles: supportingTitles.slice(0, 4),
                connectionPaths: connectionPaths.slice(0, 3).map(function (connectionPath) {
                    const pathTitles = Array.isArray(connectionPath.pathTitles)
                        ? connectionPath.pathTitles.map((value) => String(value || '').trim()).filter(Boolean)
                        : [];
                    return pathTitles.join(' -> ');
                }).filter(Boolean),
                predecessorCount: predecessorWindow.length,
                successorCount: successorWindow.length,
                temporalWarnings: temporalWarnings.slice(0, 3),
                evidenceSourceRefs: evidenceSourceRefs.slice(0, 4),
            } : null,
            graphDiagnostics: (
                Object.keys(graphDiagnostics).length > 0
                || missingLookupCount > 0
            ) ? {
                graphOpsAvailable: graphDiagnostics.graphOpsAvailable === true,
                usedFallback: graphDiagnostics.usedFallback === true,
                selectedAnchorReason: String(graphDiagnostics.selectedAnchorReason || '').trim(),
                supportNodeCount: Number.isFinite(Number(graphDiagnostics.supportNodeCount))
                    ? Number(graphDiagnostics.supportNodeCount)
                    : 0,
                supportNodeLimit: Number.isFinite(Number(graphDiagnostics.supportNodeLimit))
                    ? Number(graphDiagnostics.supportNodeLimit)
                    : 0,
                pathDepthLimit: Number.isFinite(Number(graphDiagnostics.pathDepthLimit))
                    ? Number(graphDiagnostics.pathDepthLimit)
                    : null,
                missingLookupSummary: missingLookupCount > 0
                    ? `paths ${missingConnectionPathSourceAtomIds.length}, predecessors ${missingPredecessorAtomIds.length}, successors ${missingSuccessorAtomIds.length}`
                    : '',
            } : null,
        };
    }

    function buildKnowledgeRunHistoryCardPayload(result) {
        const summary = result && typeof result === 'object'
            ? result
            : {};
        const artifacts = Array.isArray(summary.artifacts)
            ? summary.artifacts.filter((artifact) => artifact && typeof artifact === 'object')
            : [];
        const knowledgeRunArtifacts = artifacts.filter((artifact) => String(artifact.kind || '').trim() === 'knowledge_run');
        return {
            returnedArtifacts: Number.isFinite(Number(summary.returnedArtifacts))
                ? Number(summary.returnedArtifacts)
                : knowledgeRunArtifacts.length,
            runs: knowledgeRunArtifacts.slice(0, 8).map((artifact) => {
                const payload = artifact && typeof artifact.payload === 'object'
                    ? artifact.payload
                    : {};
                const knowledgeRun = payload.knowledgeRun && typeof payload.knowledgeRun === 'object'
                    ? payload.knowledgeRun
                    : {};
                const runSummary = knowledgeRun.summary && typeof knowledgeRun.summary === 'object'
                    ? knowledgeRun.summary
                    : {};
                const quality = knowledgeRun.quality && typeof knowledgeRun.quality === 'object'
                    ? knowledgeRun.quality
                    : {};
                const scope = knowledgeRun.scope && typeof knowledgeRun.scope === 'object'
                    ? knowledgeRun.scope
                    : {};
                return {
                    artifactId: String(artifact.artifactId || '').trim(),
                    workspaceId: String(artifact.workspaceId || '').trim(),
                    runId: String(knowledgeRun.runId || payload.runId || '').trim(),
                    generatedAt: String(knowledgeRun.generatedAt || artifact.updatedAt || artifact.createdAt || '').trim(),
                    artifactTitle: String(artifact.title || '').trim(),
                    scopeLabel: [
                        String(scope.workspaceId || '').trim(),
                        String(scope.corpusId || '').trim(),
                    ].filter(Boolean).join(' / ') || String(scope.source || '').trim() || 'global',
                    qualityStatus: String(quality.status || knowledgeRun.status || '').trim(),
                    qualityScore: Number.isFinite(Number(quality.score)) ? Number(quality.score) : null,
                    claimCount: Number.isFinite(Number(runSummary.claimCount)) ? Number(runSummary.claimCount) : 0,
                    weakClaimCount: Number.isFinite(Number(runSummary.weakClaimCount)) ? Number(runSummary.weakClaimCount) : 0,
                    reviewCardCount: Number.isFinite(Number(runSummary.reviewCardCount)) ? Number(runSummary.reviewCardCount) : 0,
                    remainingReviewCardCount: Number.isFinite(Number(runSummary.remainingReviewCardCount)) ? Number(runSummary.remainingReviewCardCount) : 0,
                };
            }),
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
            const appended = appendAssistantConversationResult(result);
            if (appended) {
                return;
            }
            appendLocalizedAssistantMessage(
                'agentWorkspace.messages.noResponse',
                'No grounded response.'
            );
        },
        workflow_artifact_review_follow_up: function ({ result, executionContext }) {
            const followUpResult = result && typeof result === 'object'
                ? result
                : {};
            const studySessionAction = followUpResult.studySessionAction && typeof followUpResult.studySessionAction === 'object'
                ? followUpResult.studySessionAction
                : {};
            const tutor = studySessionAction.tutor && typeof studySessionAction.tutor === 'object'
                ? studySessionAction.tutor
                : {};
            const tutorMessage = String(tutor.message || '').trim();
            if (tutorMessage) {
                appendAssistantMessage(tutorMessage);
            } else {
                appendLocalizedAssistantMessage(
                    'agentWorkspace.messages.noResponse',
                    'No grounded response.'
                );
            }
            const artifact = followUpResult.artifact && typeof followUpResult.artifact === 'object'
                ? followUpResult.artifact
                : null;
            if (!artifact) {
                return;
            }
            const payload = buildFlashcardBatchCardPayloadFromArtifacts([artifact], 1);
            const controller = getController();
            const cardNode = executionContext && executionContext.conversationCardNode
                ? executionContext.conversationCardNode
                : null;
            if (
                controller
                && cardNode
                && typeof controller.updateFlashcardBatchCard === 'function'
            ) {
                controller.updateFlashcardBatchCard(cardNode, payload);
                return;
            }
            if (controller && typeof controller.appendFlashcardBatchCard === 'function') {
                controller.appendFlashcardBatchCard(payload);
            }
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
        flashcard_batch_card: {
            appendMethodName: 'appendFlashcardBatchCard',
            unavailableErrorCode: 'flashcard_batch_card_unavailable',
        },
        knowledge_run_card: {
            appendMethodName: 'appendKnowledgeRunCard',
            unavailableErrorCode: 'knowledge_run_card_unavailable',
        },
        knowledge_run_history_card: {
            appendMethodName: 'appendKnowledgeRunHistoryCard',
            unavailableErrorCode: 'knowledge_run_history_card_unavailable',
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
        flashcard_batch_card: function ({ result }) {
            return buildFlashcardBatchCardPayload(result);
        },
        knowledge_run_card: function ({ result }) {
            return buildKnowledgeRunCardPayload(result);
        },
        knowledge_run_history_card: function ({ result }) {
            return buildKnowledgeRunHistoryCardPayload(result);
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

    function invokeCapabilityHandler(handler, item, capability, executionContext) {
        try {
            return Promise.resolve(handler(item, capability, executionContext));
        } catch (error) {
            appendCapabilityFailureMessage(capability, {
                error: String(error && error.message || error || 'unknown_error'),
            });
            return Promise.resolve();
        }
    }

    async function executeKnowledgeOperation(item, capability, executionContext) {
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
                executionContext: executionContext || null,
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

    function executeCapability(item, capability, executionContext) {
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
                capability,
                executionContext
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
        const sendStartedAt = Date.now();
        let requestActiveTarget = '';
        try {
            const userId = getUserId();
            const requestContext = resolveKnowledgeWorkspaceRequestContext();
            requestActiveTarget = requestContext.activeTarget;
            const requestPayload = {
                userId,
                sessionId: getOrCreateConversationSessionId(userId),
                activeTarget: requestContext.activeTarget,
                message,
                topK: 6,
                memoryNamespace: 'conversation',
                scope: requestContext.scope,
            };
            updateConversationApiStatus({
                state: 'pending',
                endpoint: AGENT_CONVERSATION_ENDPOINT,
                transport: 'SSE',
                activeTarget: requestContext.activeTarget,
            });
            const conversationCall = await requestConversationWithStreamingFallback(requestPayload);
            const result = conversationCall && typeof conversationCall === 'object' && conversationCall.result
                ? conversationCall.result
                : conversationCall;
            updateConversationApiStatus({
                state: 'ok',
                endpoint: AGENT_CONVERSATION_ENDPOINT,
                transport: String(conversationCall && conversationCall.transport || 'SSE'),
                latencyMs: Number(conversationCall && conversationCall.latencyMs),
                activeTarget: requestContext.activeTarget,
                result,
            });
            const appendedAssistant = await appendAssistantConversationResult(result);
            if (!appendedAssistant) {
                appendLocalizedAssistantMessage(
                    'agentWorkspace.messages.noResponse',
                    'No grounded response.'
                );
            }
            appendGroundingSummaryMessage(result);
            const controller = getController();
            if (controller) {
                const trace = result && typeof result.trace === 'object' ? result.trace : {};
                const summary = result && typeof result.summary === 'object' ? result.summary : {};
                const resultSetKey = String(
                    trace && (
                        trace.invocationId
                        || trace.sessionId
                    )
                    || summary.generatedAt
                    || ''
                ).trim();
                controller.renderKnowledgePoints(
                    Array.isArray(result && result.knowledgePoints) ? result.knowledgePoints : [],
                    {
                        resultSetKey: resultSetKey || undefined,
                        onCapability: function (item, capability) {
                            executeCapability(item, capability);
                        },
                    }
                );
            }
        } catch (error) {
            updateConversationApiStatus({
                state: 'error',
                endpoint: AGENT_CONVERSATION_ENDPOINT,
                latencyMs: Date.now() - sendStartedAt,
                activeTarget: requestActiveTarget,
                error: String(error && error.message || error || 'unknown_error'),
            });
            appendLocalizedAssistantMessage(
                'agentWorkspace.messages.conversationFailed',
                `Grounded conversation request failed: ${String(error && error.message || error || 'unknown_error')}`,
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

    function setWorkspaceOpen(open) {
        const isOpen = open === true;
        const drawer = getElement('agent-workspace-drawer');
        const backdrop = getElement('agent-workspace-backdrop');
        if (document.body) {
            document.body.classList.toggle('agent-workspace-open', isOpen);
        }
        if (drawer) {
            drawer.setAttribute('data-open', isOpen ? 'true' : 'false');
            drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        }
        if (backdrop) {
            backdrop.hidden = !isOpen;
        }
    }

    function isWorkspaceOpen() {
        return document.body ? document.body.classList.contains('agent-workspace-open') : false;
    }

    function bindWorkspaceDrawerChrome() {
        const toggleButton = getElement('btn-open-agent-workspace');
        const closeButton = getElement('btn-close-agent-workspace');
        const backdrop = getElement('agent-workspace-backdrop');
        const apiStatus = getElement('agent-workspace-api-status');

        if (toggleButton && typeof toggleButton.addEventListener === 'function') {
            toggleButton.addEventListener('click', function () {
                setWorkspaceOpen(!isWorkspaceOpen());
            });
        }
        if (closeButton && typeof closeButton.addEventListener === 'function') {
            closeButton.addEventListener('click', function () {
                setWorkspaceOpen(false);
            });
        }
        if (backdrop && typeof backdrop.addEventListener === 'function') {
            backdrop.addEventListener('click', function () {
                setWorkspaceOpen(false);
            });
        }
        if (apiStatus && typeof apiStatus.addEventListener === 'function') {
            apiStatus.addEventListener('click', function () {
                openGroundingInspector();
            });
            apiStatus.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openGroundingInspector();
                }
            });
            apiStatus.setAttribute('role', 'button');
            apiStatus.setAttribute('tabindex', '0');
        }
        if (typeof document.addEventListener === 'function') {
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && isWorkspaceOpen()) {
                    setWorkspaceOpen(false);
                }
            });
        }
    }

    function init() {
        const controller = getController();
        if (!controller) {
            return;
        }
        controller.init();
        bindWorkspaceDrawerChrome();
        bindWorkspaceScopeSelector();
        observeGlobalScopeOptions();
        renderWorkspaceScopeSelector();
        updateConversationApiStatus({
            state: 'idle',
            endpoint: AGENT_CONVERSATION_ENDPOINT,
        });
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
        if (typeof window.addEventListener === 'function') {
            window.addEventListener(ACTIVE_SOURCE_TARGET_EVENT, function () {
                renderWorkspaceScopeSelector();
            });
        }
        appendLocalizedAssistantMessage(
            'agentWorkspace.messages.ready',
            'Knowledge workspace ready. Start with a grounded question, then open focus or guided learning from cited knowledge matches.'
        );
    }

    window.NoteConnectionAgentWorkspace = {
        init,
        syncGraphFocus,
        sendConversation,
        openGraphFocus,
        openLearningPath,
        executeCapability,
        getLastConversationResult: function () {
            return window.__NC_LAST_AGENT_CONVERSATION_RESULT || null;
        },
        getLastConversationGrounding: function () {
            return window.__NC_LAST_AGENT_CONVERSATION_GROUNDING || null;
        },
        setWorkspaceOpen,
        isWorkspaceOpen,
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

    window.NoteConnectionAgentWorkspaceUi = {
        open: function () {
            setWorkspaceOpen(true);
        },
        close: function () {
            setWorkspaceOpen(false);
        },
        toggle: function () {
            setWorkspaceOpen(!isWorkspaceOpen());
        },
        isOpen: isWorkspaceOpen,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}());
