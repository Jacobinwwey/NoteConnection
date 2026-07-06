(function () {
    const PANE_KEYS = ['graph-focus', 'evidence', 'learning-path'];
    const PROMOTION_ATTRIBUTE = 'data-agent-workspace-promotion';
    const HOSTED_FOCUS_HISTORY_LIMIT = 10;
    let godotFuturePathRetryTimer = null;
    let godotFuturePathRetryCount = 0;
    let hostedFuturePathRuntimeManager = null;

    function getElement(id) {
        return document.getElementById(id);
    }

    function setPaneAttribute(paneKey, attributeName, value) {
        const pane = getPaneElement(paneKey);
        if (!pane) {
            return;
        }
        pane.setAttribute(attributeName, value ? 'true' : 'false');
    }

    function getPaneElement(paneKey) {
        if (paneKey === 'graph-focus') {
            return getElement('agent-graph-focus-pane');
        }
        if (paneKey === 'evidence') {
            return getElement('agent-evidence-pane');
        }
        if (paneKey === 'learning-path') {
            return getElement('agent-learning-path-pane');
        }
        return null;
    }

    function getPaneBodyElement(paneKey) {
        if (paneKey === 'graph-focus') {
            return getElement('agent-graph-focus-body');
        }
        if (paneKey === 'evidence') {
            return getElement('agent-evidence-body');
        }
        if (paneKey === 'learning-path') {
            return getElement('agent-learning-path-body');
        }
        return null;
    }

    function isDeveloperModeEnabled() {
        if (window.__NC_AGENT_WORKSPACE_DEVELOPER_MODE === true) {
            return true;
        }
        const settingsManager = window.settingsManager;
        try {
            if (settingsManager && typeof settingsManager.get === 'function') {
                return settingsManager.get('performance', 'developerMode') === true
                    || settingsManager.get('performance', 'deepDebug') === true;
            }
        } catch (_error) {
            // Fall back to the raw settings object below. Older settings shims may
            // throw for unknown keys while still exposing the compatibility value.
        }
        const performanceSettings = settingsManager
            && settingsManager.settings
            && typeof settingsManager.settings === 'object'
            && settingsManager.settings.performance
            && typeof settingsManager.settings.performance === 'object'
            ? settingsManager.settings.performance
            : null;
        return Boolean(
            performanceSettings
            && (performanceSettings.developerMode === true || performanceSettings.deepDebug === true)
        );
    }

    function getActiveWorkspaceLanguage() {
        const i18nLanguage = window.i18n && typeof window.i18n.currentLanguage === 'string'
            ? window.i18n.currentLanguage.trim()
            : '';
        const documentLanguage = document.documentElement && typeof document.documentElement.lang === 'string'
            ? document.documentElement.lang.trim()
            : '';
        return i18nLanguage || documentLanguage || 'en';
    }

    function formatTemplate(template, params) {
        return String(template || '').replace(/\{(\w+)\}/g, function (_match, name) {
            return Object.prototype.hasOwnProperty.call(params || {}, name)
                ? String(params[name] == null ? '' : params[name])
                : '';
        });
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

    function cloneJsonPayload(value) {
        return value == null ? null : JSON.parse(JSON.stringify(value));
    }

    function ensureWorkspaceVisible() {
        if (
            window.NoteConnectionAgentWorkspaceUi
            && typeof window.NoteConnectionAgentWorkspaceUi.open === 'function'
        ) {
            window.NoteConnectionAgentWorkspaceUi.open();
        }
    }

    const CONVERSATION_CARD_RENDERERS = Object.freeze({
        'study-session': renderStudySessionCard,
        'tutor-action': renderTutorActionCard,
        'session-history': renderSessionHistoryCard,
        'conversation-turn-cache-diagnostics': renderConversationTurnCacheDiagnosticsCard,
        'conversation-turn-cache-alert-trend': renderConversationTurnCacheAlertTrendCard,
        'query-backend-comparison': renderQueryBackendComparisonCard,
        'query-backend-diagnostics': renderQueryBackendDiagnosticsCard,
        'query-backend-comparison-history': renderQueryBackendComparisonHistoryCard,
        'query-backend-comparison-trend': renderQueryBackendComparisonTrendCard,
        'tutor-adapter-telemetry': renderTutorAdapterTelemetryCard,
        'tutor-trace-diagnostics': renderTutorTraceDiagnosticsCard,
        'learning-quality-trend': renderLearningQualityTrendCard,
        'session-plan-quality-trend': renderSessionPlanQualityTrendCard,
        'learning-quality-history': renderLearningQualityHistoryCard,
        'learning-quality-baseline-evaluation': renderLearningQualityBaselineEvaluationCard,
        'session-plan-quality-history': renderSessionPlanQualityHistoryCard,
        'flashcard-batch': renderFlashcardBatchCard,
        'knowledge-run': renderKnowledgeRunCard,
        'knowledge-run-history': renderKnowledgeRunHistoryCard,
        'knowledge-run-compare': renderKnowledgeRunCompareCard,
        'runtime-capability-runbook-verify': renderRuntimeCapabilityRunbookVerifyCard,
        'runtime-capability-runbook-history': renderRuntimeCapabilityRunbookHistoryCard,
        'runtime-capability-runbook-checks': renderRuntimeCapabilityRunbookChecksCard,
        'runtime-capability-runbook-action-queue': renderRuntimeCapabilityRunbookActionQueueCard,
    });

    function rerenderConversationCardNode(node) {
        if (!node || typeof node.getAttribute !== 'function') {
            return;
        }
        const cardKind = String(node.getAttribute('data-agent-workspace-card-kind') || '').trim();
        if (!cardKind) {
            return;
        }
        const renderer = CONVERSATION_CARD_RENDERERS[cardKind];
        if (typeof renderer !== 'function') {
            return;
        }
        const rawPayload = node.getAttribute('data-agent-workspace-card-payload');
        if (!rawPayload) {
            return;
        }
        try {
            renderer(node, JSON.parse(rawPayload));
        } catch (_error) {
            // Ignore malformed payload snapshots during rerender.
        }
    }

    function rerenderLocalizedConversationCards(container) {
        if (!container) {
            return;
        }
        const nodes = container.querySelectorAll('[data-agent-workspace-card-kind]');
        nodes.forEach((node) => {
            rerenderConversationCardNode(node);
        });
    }

    function getFullscreenButtonElement(paneKey) {
        if (paneKey === 'graph-focus') {
            return getElement('btn-agent-graph-focus-fullscreen');
        }
        if (paneKey === 'evidence') {
            return getElement('btn-agent-evidence-fullscreen');
        }
        if (paneKey === 'learning-path') {
            return getElement('btn-agent-learning-path-fullscreen');
        }
        return null;
    }

    function getCloseButtonElement(paneKey) {
        if (paneKey === 'graph-focus') {
            return getElement('btn-agent-graph-focus-close');
        }
        if (paneKey === 'evidence') {
            return getElement('btn-agent-evidence-close');
        }
        if (paneKey === 'learning-path') {
            return getElement('btn-agent-learning-path-close');
        }
        return null;
    }

    function updatePaneControlLabels() {
        PANE_KEYS.forEach((paneKey) => {
            const button = getFullscreenButtonElement(paneKey);
            if (button) {
                const isFullscreen = state.panes[paneKey].fullscreen === true;
                button.textContent = isFullscreen
                    ? translate('agentWorkspace.actions.restore', 'Restore')
                    : translate('agentWorkspace.actions.fullscreen', 'Fullscreen');
            }
            const closeButton = getCloseButtonElement(paneKey);
            if (closeButton) {
                const label = translate('agentWorkspace.actions.closePane', 'Close pane');
                closeButton.textContent = '\u00d7';
                closeButton.setAttribute('aria-label', label);
                closeButton.setAttribute('title', label);
            }
        });
    }

    function updateConversationMessageTranslations() {
        const container = getElement('agent-workspace-chat-messages');
        if (!container) {
            return;
        }
        const nodes = container.querySelectorAll('[data-agent-workspace-message-key]');
        nodes.forEach((node) => {
            const key = node.getAttribute('data-agent-workspace-message-key');
            if (!key) {
                return;
            }
            let params = {};
            const rawParams = node.getAttribute('data-agent-workspace-message-params');
            if (rawParams) {
                try {
                    params = JSON.parse(rawParams);
                } catch (_error) {
                    params = {};
                }
            }
            node.textContent = translate(key, String(node.textContent || ''), params);
        });
        container.querySelectorAll('[data-agent-workspace-rendered-block-payload]').forEach((node) => {
            const rawPayload = node.getAttribute('data-agent-workspace-rendered-block-payload');
            if (!rawPayload) {
                return;
            }
            try {
                const payload = JSON.parse(rawPayload);
                void renderConversationBlocksIntoNode(node, payload);
            } catch (_error) {
                // Ignore malformed rerender payloads.
            }
        });
        rerenderLocalizedConversationCards(container);
    }

    function syncBodyPromotionState() {
        if (!document.body) {
            return;
        }
        if (state.promotionPane) {
            document.body.setAttribute(PROMOTION_ATTRIBUTE, state.promotionPane);
        } else {
            document.body.removeAttribute(PROMOTION_ATTRIBUTE);
        }
    }

    function getStorageProvider() {
        if (!window.NoteConnectionStorage || typeof window.NoteConnectionStorage.createProvider !== 'function') {
            return null;
        }
        return window.NoteConnectionStorage.createProvider({
            runtimeCaps: window.__NC_RUNTIME_CAPS || {},
        });
    }

    function normalizeMatchedSpans(spans) {
        const normalizeLineNumber = function (primaryValue, fallbackValue) {
            const candidates = [primaryValue, fallbackValue];
            for (let index = 0; index < candidates.length; index += 1) {
                const numericValue = Number(candidates[index]);
                if (Number.isFinite(numericValue) && numericValue > 0) {
                    return Math.trunc(numericValue);
                }
            }
            return undefined;
        };
        const normalizeSourceOffset = function (primaryValue, fallbackValue) {
            const candidates = [primaryValue, fallbackValue];
            for (let index = 0; index < candidates.length; index += 1) {
                const numericValue = Number(candidates[index]);
                if (Number.isFinite(numericValue) && numericValue >= 0) {
                    return Math.trunc(numericValue);
                }
            }
            return undefined;
        };
        return Array.isArray(spans)
            ? spans
                .map((span) => {
                    if (!span || typeof span !== 'object') {
                        return null;
                    }
                    const citation = span.citation && typeof span.citation === 'object'
                        ? { ...span.citation }
                        : null;
                    return {
                        ...span,
                        citation,
                        title: String(span.title || citation && citation.title || '').trim(),
                        snippet: String(span.snippet || citation && citation.snippet || '').trim(),
                        sourcePath: String(span.sourcePath || citation && citation.sourcePath || '').trim(),
                        startLine: normalizeLineNumber(span.startLine, citation && citation.startLine),
                        endLine: normalizeLineNumber(span.endLine, citation && citation.endLine),
                        startOffset: normalizeSourceOffset(span.startOffset, citation && citation.startOffset),
                        endOffset: normalizeSourceOffset(span.endOffset, citation && citation.endOffset),
                    };
                })
                .filter(Boolean)
            : [];
    }

    function collectKnowledgePointCandidateSourcePaths(item, matchedSpans) {
        const candidates = [];
        const seen = new Set();
        const appendPath = function (value) {
            const candidate = String(value || '').trim();
            if (!candidate || seen.has(candidate)) {
                return;
            }
            seen.add(candidate);
            candidates.push(candidate);
        };
        const citation = item && typeof item.citation === 'object' ? item.citation : null;
        appendPath(item && item.sourcePath);
        appendPath(item && item.source_path);
        appendPath(citation && citation.sourcePath);
        appendPath(citation && citation.source_path);
        const citations = Array.isArray(item && item.citations) ? item.citations : [];
        citations.forEach((entry) => {
            appendPath(entry && entry.sourcePath);
            appendPath(entry && entry.source_path);
        });
        const normalizedMatchedSpans = Array.isArray(matchedSpans)
            ? matchedSpans
            : normalizeMatchedSpans(item && item.matchedSpans);
        normalizedMatchedSpans.forEach((span) => {
            appendPath(span && span.sourcePath);
            appendPath(span && span.source_path);
            const spanCitation = span && typeof span.citation === 'object' ? span.citation : null;
            appendPath(spanCitation && spanCitation.sourcePath);
            appendPath(spanCitation && spanCitation.source_path);
        });
        return candidates;
    }

    function buildKnowledgePointMatchedSpans(item) {
        const matchedSpans = normalizeMatchedSpans(item && item.matchedSpans);
        const fallbackTitle = String(item && item.title || '').trim();
        const fallbackSnippet = String(item && (item.evidenceSnippet || item.summary) || '').trim();
        const fallbackSourcePath = collectKnowledgePointCandidateSourcePaths(item, matchedSpans)[0] || '';
        return matchedSpans.map((span) => ({
            ...span,
            title: String(span.title || fallbackTitle).trim(),
            snippet: String(span.snippet || fallbackSnippet).trim(),
            sourcePath: String(span.sourcePath || fallbackSourcePath).trim(),
        }));
    }

    function resolveMarkdownPreviewRuntime() {
        const markdownRuntime = resolveMarkdownRuntime();
        const storageProvider = getStorageProvider();
        if (
            !markdownRuntime
            || typeof markdownRuntime.renderMarkdownInto !== 'function'
            || !storageProvider
            || typeof storageProvider.readContent !== 'function'
        ) {
            return null;
        }
        return {
            markdownRuntime,
            storageProvider,
        };
    }

    function resolveGraphFocusCandidatePaths(payload, matchedSpans) {
        const candidates = [];
        const seen = new Set();
        const appendPath = function (value) {
            const candidate = String(value || '').trim();
            if (!candidate || seen.has(candidate)) {
                return;
            }
            seen.add(candidate);
            candidates.push(candidate);
        };
        appendPath(payload && payload.sourcePath);
        const payloadCandidateSourcePaths = Array.isArray(payload && payload.candidateSourcePaths)
            ? payload.candidateSourcePaths
            : [];
        payloadCandidateSourcePaths.forEach((candidateSourcePath) => {
            appendPath(candidateSourcePath);
        });
        matchedSpans.forEach((span) => {
            appendPath(span && span.sourcePath);
            const citation = span && typeof span.citation === 'object' ? span.citation : null;
            appendPath(citation && citation.sourcePath);
        });
        return candidates;
    }

    function buildGraphFocusDiagnostics(payload, matchedSpans, renderToken) {
        const candidateSourcePaths = resolveGraphFocusCandidatePaths(payload, matchedSpans);
        return {
            renderToken: Number(renderToken || 0),
            title: buildGraphFocusTitle(payload),
            requestedSourcePath: String(payload && payload.sourcePath || '').trim(),
            candidateSourcePaths,
            attemptedSourcePaths: [],
            resolvedSourcePath: '',
            fallbackSourcePathUsed: false,
            matchedSpanCount: matchedSpans.length,
            highlightTermCount: collectGraphFocusHighlightTerms(matchedSpans).length,
            markdownRuntimeAvailable: false,
            storageProviderAvailable: false,
            readSucceeded: false,
            renderSucceeded: false,
            sourceProvenanceBlockCount: 0,
            sourceProvenanceAttributedNodeCount: 0,
            highlightedNodeCount: 0,
            inlineHighlightCount: 0,
            inlineHighlightStrategy: 'none',
            highlightStrategy: 'none',
            usedFallback: false,
            failureReason: '',
        };
    }

    function setLastGraphFocusDiagnostics(diagnostics) {
        state.graphFocusDiagnostics = diagnostics ? JSON.parse(JSON.stringify(diagnostics)) : null;
        window.__NC_LAST_AGENT_GRAPH_FOCUS_DIAGNOSTICS = state.graphFocusDiagnostics;
    }

    function publishGraphFocusDiagnostics(payload, diagnostics) {
        if (
            typeof window.dispatchEvent !== 'function'
            || typeof window.CustomEvent !== 'function'
        ) {
            return;
        }
        window.dispatchEvent(new CustomEvent('noteconnection:agent-graph-focus-diagnostics', {
            detail: {
                payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
                diagnostics: diagnostics ? JSON.parse(JSON.stringify(diagnostics)) : null,
            },
        }));
    }

    function buildGraphFocusTitle(payload) {
        return String(
            payload.title
            || payload.atomId
            || payload.nodeId
            || translate('agentWorkspace.graphFocus.title', 'Graph Focus')
        ).trim();
    }

    function isHostedGraphFocusPayload(payload) {
        const presentationMode = normalizeKnowledgeGraphText(
            payload && (payload.presentationMode || payload.viewMode || payload.focusViewMode)
        );
        return presentationMode === 'focus-mode' || presentationMode === 'runtime-focus';
    }

    function buildGraphFocusEvidenceListHtml(matchedSpans) {
        if (matchedSpans.length <= 0) {
            return '';
        }
        return `
            <div class="agent-focus-hit-list">
                <div class="agent-focus-hit-heading">${escapeHtml(translate('agentWorkspace.knowledge.matchedEvidence', 'Matched evidence'))}</div>
                ${matchedSpans.map((span) => {
                    const spanTitle = String(span.title || '').trim();
                    const spanSourcePath = String(span.sourcePath || '').trim();
                    const spanLocation = spanSourcePath
                        ? `${spanSourcePath}${span.startLine ? `:${span.startLine}` : ''}`
                        : '';
                    return `
                        <article class="agent-focus-hit" data-agent-focus-hit="true">
                            ${spanTitle ? `<div class="agent-focus-hit-title">${escapeHtml(spanTitle)}</div>` : ''}
                            ${spanLocation ? `<div class="agent-focus-hit-meta">${escapeHtml(spanLocation)}</div>` : ''}
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function normalizeKnowledgeGraphText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function resolvePathBasenameWithoutExtension(sourcePath) {
        const normalized = String(sourcePath || '').replace(/\\/g, '/').trim();
        if (!normalized) {
            return '';
        }
        const fileName = normalized.split('/').filter(Boolean).pop() || normalized;
        return fileName.replace(/\.[^/.]+$/, '').trim();
    }

    function resolveKnowledgePointDisplayLabel(item, fallbackAtomId) {
        const citation = item && typeof item.citation === 'object' ? item.citation : null;
        const candidates = [
            item && item.title,
            item && item.label,
            item && item.name,
            citation && citation.title,
            resolvePathBasenameWithoutExtension(resolveKnowledgePointSourcePath(item)),
            fallbackAtomId,
        ];
        for (const candidate of candidates) {
            const label = normalizeKnowledgeGraphText(candidate);
            if (label) {
                return label;
            }
        }
        return '';
    }

    function assignKnowledgeNodeLabel(nodeLabels, nodeId, label) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        if (!normalizedNodeId || !nodeLabels || typeof nodeLabels !== 'object') {
            return;
        }
        const normalizedLabel = normalizeKnowledgeGraphText(label);
        if (normalizedLabel) {
            nodeLabels[normalizedNodeId] = normalizedLabel;
            return;
        }
        if (!nodeLabels[normalizedNodeId]) {
            nodeLabels[normalizedNodeId] = normalizedNodeId;
        }
    }

    function buildKnowledgePointNodeLabels(item, graphTarget) {
        const nodeLabels = {};
        const atomId = resolveKnowledgePointActionAtomId(item);
        const displayLabel = resolveKnowledgePointDisplayLabel(item, atomId);
        assignKnowledgeNodeLabel(nodeLabels, atomId, displayLabel);
        assignKnowledgeNodeLabel(nodeLabels, item && item.documentId, displayLabel);
        assignKnowledgeNodeLabel(nodeLabels, graphTarget && graphTarget.graphNodeId, graphTarget && graphTarget.graphNodeLabel);

        const matchedSpans = Array.isArray(item && item.matchedSpans) ? item.matchedSpans : [];
        matchedSpans.forEach((span) => {
            assignKnowledgeNodeLabel(nodeLabels, span && span.atomId, span && span.title || displayLabel);
            const citation = span && typeof span.citation === 'object' ? span.citation : null;
            assignKnowledgeNodeLabel(nodeLabels, citation && citation.atomId, citation && citation.title || span && span.title || displayLabel);
        });

        const relationPath = Array.isArray(item && item.relationPath) ? item.relationPath : [];
        relationPath.forEach((edge) => {
            assignKnowledgeNodeLabel(nodeLabels, edge && edge.sourceAtomId, edge && edge.sourceTitle);
            assignKnowledgeNodeLabel(nodeLabels, edge && edge.targetAtomId, edge && edge.targetTitle);
        });

        const snapshotNodes = graphTarget && graphTarget.focusModeSnapshot && Array.isArray(graphTarget.focusModeSnapshot.nodes)
            ? graphTarget.focusModeSnapshot.nodes
            : [];
        snapshotNodes.forEach((node) => {
            assignKnowledgeNodeLabel(nodeLabels, node && node.id, node && (node.label || node.title || node.name));
        });

        return nodeLabels;
    }

    function collectKnowledgePointGraphCandidates(item, capability) {
        const candidates = [];
        const seen = new Set();
        const appendCandidate = function (value) {
            const normalized = normalizeKnowledgeGraphText(value);
            if (!normalized || seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            candidates.push(normalized);
        };
        appendCandidate(item && item.graphNodeId);
        appendCandidate(item && item.graphTargetId);
        appendCandidate(capability && capability.graphNodeId);
        appendCandidate(capability && capability.graphTargetId);
        appendCandidate(item && item.nodeId);
        appendCandidate(item && item.documentId);
        if (Array.isArray(item && item.graphNodeIds)) {
            item.graphNodeIds.forEach(appendCandidate);
        }
        if (Array.isArray(item && item.nodeIds)) {
            item.nodeIds.forEach(appendCandidate);
        }
        appendCandidate(resolveKnowledgePointActionAtomId(item));
        return candidates;
    }

    function normalizeRuntimeGraphNode(node) {
        if (!node || typeof node !== 'object') {
            return null;
        }
        const id = normalizeKnowledgeGraphText(node.id || node.nodeId || node.key);
        if (!id) {
            return null;
        }
        return {
            id,
            label: normalizeKnowledgeGraphText(node.label || node.title || node.name || id) || id,
        };
    }

    function buildKnowledgePointGraphLookupPayload(item, capability) {
        const atomId = resolveKnowledgePointActionAtomId(item);
        const title = resolveKnowledgePointDisplayLabel(item, atomId);
        const matchedSpans = buildKnowledgePointMatchedSpans(item);
        return {
            atomId,
            atomIds: Array.isArray(item && item.atomIds)
                ? item.atomIds.map((value) => normalizeKnowledgeGraphText(value)).filter(Boolean)
                : [atomId].filter(Boolean),
            documentId: normalizeKnowledgeGraphText(item && item.documentId),
            nodeId: normalizeKnowledgeGraphText(item && item.nodeId),
            title,
            label: title,
            sourcePath: resolveKnowledgePointSourcePath(item),
            sourceBasename: resolvePathBasenameWithoutExtension(resolveKnowledgePointSourcePath(item)),
            matchedSpans,
            relationPath: Array.isArray(item && item.relationPath) ? item.relationPath.map((edge) => ({ ...edge })) : [],
            capability: capability && typeof capability === 'object' ? { ...capability } : null,
        };
    }

    function resolveRuntimeGraphNodeForKnowledgePoint(item, capability) {
        const graphView = window.NoteConnectionGraphView;
        if (!graphView || typeof graphView !== 'object') {
            return null;
        }
        const lookupPayload = buildKnowledgePointGraphLookupPayload(item, capability);
        if (typeof graphView.resolveNodeByKnowledgePoint === 'function') {
            try {
                const resolvedNode = normalizeRuntimeGraphNode(graphView.resolveNodeByKnowledgePoint(lookupPayload));
                if (resolvedNode) {
                    return resolvedNode;
                }
            } catch (error) {
                console.warn('[AgentWorkspace] graph node resolver rejected knowledge point payload:', error);
            }
        }
        if (typeof graphView.resolveNodeById === 'function') {
            const candidates = collectKnowledgePointGraphCandidates(item, capability);
            for (const candidate of candidates) {
                try {
                    const resolvedNode = normalizeRuntimeGraphNode(graphView.resolveNodeById(candidate));
                    if (resolvedNode) {
                        return resolvedNode;
                    }
                } catch (error) {
                    console.warn('[AgentWorkspace] graph node id resolver rejected candidate:', error);
                }
            }
        }
        return null;
    }

    function normalizeFocusModeSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            return null;
        }
        const rawNodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
        const nodes = rawNodes
            .map((node) => {
                const id = normalizeKnowledgeGraphText(node && (node.id || node.nodeId));
                if (!id) {
                    return null;
                }
                return {
                    id,
                    label: normalizeKnowledgeGraphText(node && (node.label || node.title || node.name || id)) || id,
                    role: normalizeKnowledgeGraphText(node && node.role) || 'related',
                    x: Number(node && node.x),
                    y: Number(node && node.y),
                };
            })
            .filter(Boolean);
        if (nodes.length <= 0) {
            return null;
        }
        const nodeIds = new Set(nodes.map((node) => node.id));
        const edges = (Array.isArray(snapshot.edges) ? snapshot.edges : [])
            .map((edge) => {
                const sourceId = normalizeKnowledgeGraphText(edge && (edge.sourceId || edge.source || edge.from));
                const targetId = normalizeKnowledgeGraphText(edge && (edge.targetId || edge.target || edge.to));
                if (!sourceId || !targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
                    return null;
                }
                return {
                    sourceId,
                    targetId,
                    relationKind: normalizeKnowledgeGraphText(edge && (edge.relationKind || edge.type || edge.kind)),
                    confidence: Number(edge && edge.confidence),
                };
            })
            .filter(Boolean);
        const anchorId = normalizeKnowledgeGraphText(snapshot.anchorId || snapshot.focusNodeId || snapshot.centralId)
            || nodes.find((node) => node.role === 'anchor' || node.role === 'focus')?.id
            || nodes[0].id;
        const anchorNode = nodes.find((node) => node.id === anchorId) || nodes[0];
        return {
            anchorId,
            anchorLabel: normalizeKnowledgeGraphText(snapshot.anchorLabel || anchorNode.label) || anchorId,
            nodes,
            edges,
        };
    }

    function normalizeFocusModeProjection(projection) {
        if (!projection || typeof projection !== 'object') {
            return null;
        }
        const normalizeProjectionNode = function (node, fallbackRole) {
            const id = normalizeKnowledgeGraphText(node && (node.id || node.nodeId));
            const x = Number(node && node.x);
            const y = Number(node && node.y);
            if (!id || !Number.isFinite(x) || !Number.isFinite(y)) {
                return null;
            }
            return {
                id,
                label: normalizeKnowledgeGraphText(node && (node.label || node.title || node.name || id)) || id,
                role: normalizeKnowledgeGraphText(node && node.role) || fallbackRole || 'related',
                x,
                y,
                score: Number(node && node.score),
                inDegree: Number(node && node.inDegree),
                outDegree: Number(node && node.outDegree),
                sourcePath: normalizeKnowledgeGraphText(node && node.sourcePath),
                radius: Number(node && node.radius),
                labelDy: Number(node && node.labelDy),
                labelDx: Number(node && node.labelDx),
            };
        };
        const rawNodes = Array.isArray(projection.nodes) ? projection.nodes : [];
        const nodes = rawNodes
            .map((node) => normalizeProjectionNode(node, 'related'))
            .filter(Boolean);
        if (nodes.length <= 0) {
            return null;
        }
        const nodeIds = new Set(nodes.map((node) => node.id));
        const contextNodes = (Array.isArray(projection.contextNodes) ? projection.contextNodes : [])
            .map((node) => normalizeProjectionNode(node, 'context'))
            .filter((node) => node && !nodeIds.has(node.id));
        const edges = (Array.isArray(projection.edges) ? projection.edges : [])
            .map((edge) => {
                const sourceId = normalizeKnowledgeGraphText(edge && (edge.sourceId || edge.source || edge.from));
                const targetId = normalizeKnowledgeGraphText(edge && (edge.targetId || edge.target || edge.to));
                if (!sourceId || !targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
                    return null;
                }
                return {
                    sourceId,
                    targetId,
                    relationKind: normalizeKnowledgeGraphText(edge && (edge.relationKind || edge.type || edge.kind)),
                    confidence: Number(edge && (edge.confidence || edge.weight)),
                    role: normalizeKnowledgeGraphText(edge && edge.role) || 'related',
                };
            })
            .filter(Boolean);
        const anchorId = normalizeKnowledgeGraphText(projection.anchorId || projection.focusNodeId || projection.centralId)
            || nodes.find((node) => node.role === 'anchor' || node.role === 'focus')?.id
            || nodes[0].id;
        const anchorNode = nodes.find((node) => node.id === anchorId) || nodes[0];
        const labels = (Array.isArray(projection.labels) ? projection.labels : [])
            .map((label) => {
                const text = normalizeKnowledgeGraphText(label && label.text);
                const x = Number(label && label.x);
                const y = Number(label && label.y);
                if (!text || !Number.isFinite(x) || !Number.isFinite(y)) {
                    return null;
                }
                return {
                    text,
                    x,
                    y,
                    role: normalizeKnowledgeGraphText(label && label.role) || '',
                    align: normalizeKnowledgeGraphText(label && label.align) || 'middle',
                };
            })
            .filter(Boolean);
        const normalizeProjectionBounds = function (rawBounds) {
            if (!rawBounds || typeof rawBounds !== 'object') {
                return null;
            }
            return {
                minX: Number(rawBounds.minX),
                maxX: Number(rawBounds.maxX),
                minY: Number(rawBounds.minY),
                maxY: Number(rawBounds.maxY),
            };
        };
        const bounds = normalizeProjectionBounds(projection.bounds);
        const contextBounds = normalizeProjectionBounds(projection.contextBounds);
        const finiteBounds = bounds
            && Number.isFinite(bounds.minX)
            && Number.isFinite(bounds.maxX)
            && Number.isFinite(bounds.minY)
            && Number.isFinite(bounds.maxY)
            ? bounds
            : {
                minX: Math.min(...nodes.map((node) => node.x).concat(labels.map((label) => label.x))),
                maxX: Math.max(...nodes.map((node) => node.x).concat(labels.map((label) => label.x))),
                minY: Math.min(...nodes.map((node) => node.y).concat(labels.map((label) => label.y))),
                maxY: Math.max(...nodes.map((node) => node.y).concat(labels.map((label) => label.y))),
            };
        const finiteContextBounds = contextBounds
            && Number.isFinite(contextBounds.minX)
            && Number.isFinite(contextBounds.maxX)
            && Number.isFinite(contextBounds.minY)
            && Number.isFinite(contextBounds.maxY)
            ? contextBounds
            : finiteBounds;
        return {
            anchorId,
            anchorLabel: normalizeKnowledgeGraphText(projection.anchorLabel || anchorNode.label) || anchorId,
            layoutType: normalizeKnowledgeGraphText(projection.layoutType) || 'horizontal',
            layerGap: Number(projection.layerGap),
            nodeGap: Number(projection.nodeGap),
            nodes,
            edges,
            labels,
            bounds: finiteBounds,
            contextBounds: finiteContextBounds,
            stats: projection.stats && typeof projection.stats === 'object' ? { ...projection.stats } : {},
            controls: projection.controls && typeof projection.controls === 'object' ? { ...projection.controls } : {},
            contextNodes,
        };
    }

    function resolveFocusModeSnapshot(graphNodeId) {
        const normalizedGraphNodeId = normalizeKnowledgeGraphText(graphNodeId);
        const graphView = window.NoteConnectionGraphView;
        if (!normalizedGraphNodeId || !graphView || typeof graphView.getFocusModeSnapshot !== 'function') {
            return null;
        }
        try {
            return normalizeFocusModeSnapshot(graphView.getFocusModeSnapshot(normalizedGraphNodeId));
        } catch (error) {
            console.warn('[AgentWorkspace] focus mode snapshot request failed:', error);
            return null;
        }
    }

    function resolveFocusModeProjection(graphNodeId) {
        const normalizedGraphNodeId = normalizeKnowledgeGraphText(graphNodeId);
        const graphView = window.NoteConnectionGraphView;
        if (!normalizedGraphNodeId || !graphView || typeof graphView !== 'object') {
            return null;
        }
        if (typeof graphView.getFocusModeProjection === 'function') {
            try {
                const projection = normalizeFocusModeProjection(graphView.getFocusModeProjection(normalizedGraphNodeId, {
                    layoutType: 'horizontal',
                }));
                if (projection) {
                    return projection;
                }
            } catch (error) {
                console.warn('[AgentWorkspace] focus mode projection request failed:', error);
            }
        }
        return resolveFocusModeSnapshot(normalizedGraphNodeId);
    }

    function resolveFocusModeGraphPayload(payload) {
        const payloadProjection = normalizeFocusModeProjection(payload && payload.focusModeProjection);
        if (payloadProjection) {
            return payloadProjection;
        }
        const targetId = resolveGraphFocusHostedTargetId(payload || {});
        const runtimeProjection = targetId ? resolveFocusModeProjection(targetId) : null;
        if (runtimeProjection) {
            return runtimeProjection;
        }
        return normalizeFocusModeSnapshot(payload && payload.focusModeSnapshot);
    }

    function resolveKnowledgePointGraphTarget(item, capability, options) {
        const shouldIncludeFocusModeSnapshot = Boolean(options && options.includeFocusModeSnapshot === true);
        const atomId = resolveKnowledgePointActionAtomId(item);
        const displayLabel = resolveKnowledgePointDisplayLabel(item, atomId);
        const runtimeNode = resolveRuntimeGraphNodeForKnowledgePoint(item, capability);
        const explicitGraphNodeId = normalizeKnowledgeGraphText(item && (item.graphNodeId || item.graphTargetId));
        const graphNodeId = runtimeNode && runtimeNode.id
            ? runtimeNode.id
            : explicitGraphNodeId || atomId;
        const graphNodeLabel = runtimeNode && runtimeNode.label
            ? runtimeNode.label
            : displayLabel || graphNodeId;
        const focusModeSnapshot = shouldIncludeFocusModeSnapshot
            ? resolveFocusModeSnapshot(graphNodeId)
            : null;
        const focusModeProjection = shouldIncludeFocusModeSnapshot
            ? resolveFocusModeProjection(graphNodeId)
            : null;
        return {
            atomId,
            graphNodeId,
            graphNodeLabel,
            displayLabel: displayLabel || graphNodeLabel || atomId,
            runtimeResolved: Boolean(runtimeNode),
            focusModeSnapshot,
            focusModeProjection,
            lookupPayload: buildKnowledgePointGraphLookupPayload(item, capability),
        };
    }

    function normalizeGraphFocusRelationPath(payload) {
        return (Array.isArray(payload && payload.relationPath) ? payload.relationPath : [])
            .map((edge) => ({
                sourceAtomId: String(edge && edge.sourceAtomId || '').trim(),
                sourceTitle: String(edge && edge.sourceTitle || '').trim(),
                targetAtomId: String(edge && edge.targetAtomId || '').trim(),
                targetTitle: String(edge && edge.targetTitle || '').trim(),
                relationKind: String(edge && edge.relationKind || '').trim(),
                confidence: Number(edge && edge.confidence),
            }))
            .filter((edge) => edge.sourceAtomId && edge.targetAtomId)
            .slice(0, 8);
    }

    function buildGraphFocusRelationGraphHtml(anchorId, relationPath, nodeLabels) {
        if (!Array.isArray(relationPath) || relationPath.length <= 0) {
            return '';
        }

        const resolvedNodeLabels = nodeLabels && typeof nodeLabels === 'object' ? { ...nodeLabels } : {};
        const addNodeLabel = function (atomId, title) {
            const normalizedAtomId = String(atomId || '').trim();
            if (!normalizedAtomId) {
                return;
            }
            const normalizedTitle = String(title || '').trim();
            resolvedNodeLabels[normalizedAtomId] = normalizedTitle || resolvedNodeLabels[normalizedAtomId] || normalizedAtomId;
        };

        addNodeLabel(anchorId, resolvedNodeLabels[anchorId] || anchorId);
        relationPath.forEach((edge) => {
            addNodeLabel(edge.sourceAtomId, edge.sourceTitle);
            addNodeLabel(edge.targetAtomId, edge.targetTitle);
        });

        const leftIds = [];
        const rightIds = [];
        const appendUnique = function (bucket, atomId) {
            if (atomId && !bucket.includes(atomId)) {
                bucket.push(atomId);
            }
        };

        relationPath.forEach((edge) => {
            if (edge.targetAtomId === anchorId) {
                appendUnique(leftIds, edge.sourceAtomId);
                return;
            }
            if (edge.sourceAtomId === anchorId) {
                appendUnique(rightIds, edge.targetAtomId);
                return;
            }
            appendUnique(leftIds, edge.sourceAtomId);
            appendUnique(rightIds, edge.targetAtomId);
        });

        const coordinates = {};
        if (anchorId) {
            coordinates[anchorId] = { x: 50, y: 50, role: 'anchor' };
        }

        const placeLane = function (ids, x, role) {
            const visibleIds = ids.filter((atomId) => atomId !== anchorId).slice(0, 4);
            const step = 80 / (visibleIds.length + 1);
            visibleIds.forEach((atomId, index) => {
                if (!coordinates[atomId]) {
                    coordinates[atomId] = {
                        x,
                        y: 10 + step * (index + 1),
                        role,
                    };
                }
            });
        };

        placeLane(leftIds, 22, 'source');
        placeLane(rightIds, 78, 'target');

        Object.keys(resolvedNodeLabels).slice(0, 9).forEach((atomId, index) => {
            if (!coordinates[atomId]) {
                coordinates[atomId] = {
                    x: 50,
                    y: 18 + (index % 4) * 18,
                    role: 'related',
                };
            }
        });

        const edgeHtml = relationPath.map((edge) => {
            const source = coordinates[edge.sourceAtomId];
            const target = coordinates[edge.targetAtomId];
            if (!source || !target) {
                return '';
            }
            return `
                <line
                    class="agent-focus-relation-graph-edge"
                    x1="${source.x}"
                    y1="${source.y}"
                    x2="${target.x}"
                    y2="${target.y}"
                    marker-end="url(#agent-focus-relation-arrow)"
                ></line>
            `;
        }).join('');

        const nodeHtml = Object.keys(coordinates).map((atomId) => {
            const point = coordinates[atomId];
            const label = resolvedNodeLabels[atomId] || atomId;
            const nodeClass = [
                'agent-focus-relation-graph-node',
                `agent-focus-relation-graph-node--${point.role}`,
            ].join(' ');
            return `
                <div
                    class="${nodeClass}"
                    style="left: ${point.x}%; top: ${point.y}%;"
                    title="${escapeHtml(label)}"
                >
                    ${escapeHtml(label)}
                </div>
            `;
        }).join('');

        return `
            <div class="agent-focus-relation-graph" data-agent-focus-relation-graph="true">
                <svg class="agent-focus-relation-graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <marker id="agent-focus-relation-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L6,3 L0,6 Z"></path>
                        </marker>
                    </defs>
                    ${edgeHtml}
                </svg>
                ${nodeHtml}
            </div>
        `;
    }

    function buildGraphFocusSnapshotGraphHtml(snapshot, options) {
        const normalizedSnapshot = normalizeFocusModeSnapshot(snapshot);
        if (!normalizedSnapshot) {
            return '';
        }
        const interactive = Boolean(options && options.interactive === true);
        const hideEdges = Boolean(options && options.hideEdges === true);
        const hideContext = Boolean(options && options.hideContext === true);

        const nodeCount = normalizedSnapshot.nodes.length;
        const anchorId = normalizedSnapshot.anchorId;
        const anchorNode = normalizedSnapshot.nodes.find((node) => node.id === anchorId) || normalizedSnapshot.nodes[0];
        const incoming = normalizedSnapshot.nodes.filter((node) => node.id !== anchorId && node.role === 'incoming');
        const outgoing = normalizedSnapshot.nodes.filter((node) => node.id !== anchorId && node.role === 'outgoing');
        const related = normalizedSnapshot.nodes.filter((node) => (
            node.id !== anchorId
            && node.role !== 'incoming'
            && node.role !== 'outgoing'
        ));
        const usedNodeIds = new Set([anchorId]);
        const takeUniqueNodes = function (candidates, limit) {
            const taken = [];
            candidates.forEach((node) => {
                if (taken.length >= limit || usedNodeIds.has(node.id)) {
                    return;
                }
                usedNodeIds.add(node.id);
                taken.push(node);
            });
            return taken;
        };
        const continueNodes = takeUniqueNodes(outgoing.concat(related), 3);
        const supportNodes = takeUniqueNodes(incoming.concat(related), 3);
        if (continueNodes.length <= 0) {
            takeUniqueNodes(incoming.concat(related), 2).forEach((node) => continueNodes.push(node));
        }
        if (supportNodes.length <= 0) {
            takeUniqueNodes(outgoing.concat(related), 2).forEach((node) => supportNodes.push(node));
        }

        const coordinates = {};
        const anchorLabel = normalizedSnapshot.anchorLabel || anchorNode.label || anchorId;
        coordinates[anchorId] = {
            x: 50,
            y: 52,
            role: 'anchor',
            label: anchorLabel,
        };

        const assignClusterCoordinates = function (nodesToPlace, y, role) {
            const step = 70 / (nodesToPlace.length + 1);
            const stagger = role === 'continue' ? [-5, 4, -1] : [5, -4, 1];
            nodesToPlace.forEach((node, index) => {
                coordinates[node.id] = {
                    x: 15 + step * (index + 1),
                    y: Math.max(16, Math.min(86, y + stagger[index % stagger.length])),
                    role,
                    label: node.label || node.id,
                };
            });
        };
        assignClusterCoordinates(continueNodes, 24, 'continue');
        assignClusterCoordinates(supportNodes, 78, 'support');

        const edgeHtml = hideEdges ? '' : normalizedSnapshot.edges.map((edge) => {
            const source = coordinates[edge.sourceId];
            const target = coordinates[edge.targetId];
            if (!source || !target) {
                return '';
            }
            return `
                <line
                    class="agent-focus-mode-edge"
                    x1="${source.x}"
                    y1="${source.y}"
                    x2="${target.x}"
                    y2="${target.y}"
                ></line>
            `;
        }).join('');

        const renderNode = function (nodeId) {
            const point = coordinates[nodeId];
            if (!point) {
                return '';
            }
            const role = point.role === 'anchor' ? 'anchor' : point.role;
            const tagName = interactive ? 'button' : 'div';
            const buttonType = interactive ? ' type="button"' : '';
            const interactiveAttrs = interactive
                ? ` data-agent-focus-mode-node-id="${escapeHtml(nodeId)}" data-agent-focus-mode-anchor="${nodeId === anchorId ? 'true' : 'false'}" aria-label="${escapeHtml(point.label)}"`
                : '';
            return `
                <${tagName}
                    ${buttonType}
                    class="agent-focus-mode-node agent-focus-mode-node--${role}"
                    data-agent-focus-mode-node-role="${escapeHtml(role)}"
                    ${interactiveAttrs}
                    style="left: ${point.x}%; top: ${point.y}%;"
                    title="${escapeHtml(point.label)}"
                >
                    ${escapeHtml(point.label)}
                </${tagName}>
            `;
        };
        const continueHtml = continueNodes.map((node) => renderNode(node.id)).join('');
        const supportHtml = supportNodes.map((node) => renderNode(node.id)).join('');
        const anchorHtml = renderNode(anchorId);
        const contextNodeHtml = hideContext ? '' : normalizedSnapshot.nodes
            .filter((node) => node.id !== anchorId)
            .slice(0, 18)
            .map((node, index) => {
                const x = Number.isFinite(node.x)
                    ? Math.max(8, Math.min(92, node.x))
                    : 8 + ((index * 17) % 84);
                const y = Number.isFinite(node.y)
                    ? Math.max(10, Math.min(90, node.y))
                    : 12 + ((index * 23) % 76);
                return `
                    <span
                        class="agent-focus-mode-context-node"
                        style="left: ${x}%; top: ${y}%;"
                    >${escapeHtml(node.label || node.id)}</span>
                `;
            }).join('');
        const contextLayerHtml = hideContext ? '' : `
                <div class="agent-focus-mode-context" aria-hidden="true">
                    ${contextNodeHtml}
                </div>
            `;

        return `
            <div
                class="agent-focus-mode-preview${hideEdges ? ' agent-focus-mode-preview--edge-hidden agent-focus-mode-preview--hosted' : ''}"
                data-agent-focus-mode-preview="true"
                data-agent-focus-snapshot-graph="true"
                data-agent-focus-mainlike="${hideEdges ? 'true' : 'false'}"
                data-agent-focus-visible-edges="${hideEdges ? 'false' : 'true'}"
                data-focus-mode-anchor-id="${escapeHtml(anchorId)}"
                data-focus-node-count="${nodeCount}"
                data-focus-context-node-count="${hideContext ? 0 : Math.min(18, Math.max(0, normalizedSnapshot.nodes.length - 1))}"
                data-agent-focus-transform-target="true"
            >
                ${contextLayerHtml}
                <div class="agent-focus-mode-cluster-label agent-focus-mode-cluster-label--continue">
                    ${escapeHtml(translate('agentWorkspace.graphFocus.continueCluster', 'Continue exploring'))}
                </div>
                ${hideEdges ? '' : `
                    <svg class="agent-focus-mode-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        ${edgeHtml}
                    </svg>
                `}
                <div class="agent-focus-mode-cluster agent-focus-mode-cluster--continue" data-agent-focus-mode-cluster="continue">
                    ${continueHtml}
                </div>
                ${anchorHtml}
                <div class="agent-focus-mode-cluster agent-focus-mode-cluster--support" data-agent-focus-mode-cluster="support">
                    ${supportHtml}
                </div>
                <div class="agent-focus-mode-cluster-label agent-focus-mode-cluster-label--support">
                    ${escapeHtml(translate('agentWorkspace.graphFocus.supportCluster', 'Helps understanding'))}
                </div>
            </div>
        `;
    }

    function buildGraphFocusProjectionGraphHtml(projection, options) {
        const normalizedProjection = normalizeFocusModeProjection(projection);
        if (!normalizedProjection) {
            return '';
        }
        const hideContext = Boolean(options && options.hideContext === true);
        const nodeCount = normalizedProjection.nodes.length;
        const anchorId = normalizedProjection.anchorId;
        const padding = 8;
        const bounds = normalizedProjection.bounds;
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);
        const contextBounds = normalizedProjection.contextBounds || bounds;
        const contextWidth = Math.max(1, contextBounds.maxX - contextBounds.minX);
        const contextHeight = Math.max(1, contextBounds.maxY - contextBounds.minY);
        const toPercent = function (value, minValue, range) {
            return padding + ((Number(value) - minValue) / range) * (100 - (padding * 2));
        };
        const toContextPercent = function (value, minValue, range) {
            const projected = toPercent(value, minValue, range);
            if (!Number.isFinite(projected)) {
                return 50;
            }
            return Math.max(4, Math.min(96, projected));
        };
        const pointById = new Map(normalizedProjection.nodes.map((node) => [
            node.id,
            {
                x: toPercent(node.x, bounds.minX, width),
                y: toPercent(node.y, bounds.minY, height),
            },
        ]));
        const labelHtml = normalizedProjection.labels.map((label) => {
            const x = toPercent(label.x, bounds.minX, width);
            const y = toPercent(label.y, bounds.minY, height);
            return `
                <div
                    class="agent-focus-mode-cluster-label agent-focus-mode-cluster-label--projection agent-focus-mode-cluster-label--${escapeHtml(label.role || 'related')}"
                    style="left: ${x}%; top: ${y}%;"
                >${escapeHtml(label.text)}</div>
            `;
        }).join('');
        const nodeHtml = normalizedProjection.nodes.map((node) => {
            const point = pointById.get(node.id);
            if (!point) {
                return '';
            }
            const role = node.id === anchorId ? 'anchor' : node.role || 'related';
            const degreeText = [
                Number.isFinite(node.inDegree) ? `In ${node.inDegree}` : '',
                Number.isFinite(node.outDegree) ? `Out ${node.outDegree}` : '',
            ].filter(Boolean).join(' | ');
            return `
                <button
                    type="button"
                    class="agent-focus-mode-node agent-focus-mode-node--projection agent-focus-mode-node--${escapeHtml(role)}"
                    data-agent-focus-mode-node-id="${escapeHtml(node.id)}"
                    data-agent-focus-mode-anchor="${node.id === anchorId ? 'true' : 'false'}"
                    data-agent-focus-mode-node-role="${escapeHtml(role)}"
                    style="left: ${point.x}%; top: ${point.y}%;"
                    title="${escapeHtml(degreeText ? `${node.label} (${degreeText})` : node.label)}"
                    aria-label="${escapeHtml(node.label)}"
                >
                    <span class="agent-focus-mode-node-dot" aria-hidden="true"></span>
                    <span class="agent-focus-mode-node-label">${escapeHtml(node.label || node.id)}</span>
                </button>
            `;
        }).join('');
        const contextHtml = hideContext ? '' : normalizedProjection.contextNodes.map((node) => {
            const x = toContextPercent(node.x, contextBounds.minX, contextWidth);
            const y = toContextPercent(node.y, contextBounds.minY, contextHeight);
            return `
                <span
                    class="agent-focus-mode-context-node agent-focus-mode-context-node--projection"
                    data-agent-focus-context-node-id="${escapeHtml(node.id)}"
                    style="left: ${x}%; top: ${y}%;"
                    title="${escapeHtml(node.label || node.id)}"
                    aria-hidden="true"
                >
                    <span class="agent-focus-mode-context-dot" data-agent-focus-context-node-dot="true"></span>
                    <span class="agent-focus-mode-context-label">${escapeHtml(node.label || node.id)}</span>
                </span>
            `;
        }).join('');
        const contextLayerHtml = hideContext ? '' : `
                <div class="agent-focus-mode-context" aria-hidden="true">
                    ${contextHtml}
                </div>
            `;
        return `
            <div
                class="agent-focus-mode-preview agent-focus-mode-preview--projection agent-focus-mode-preview--hosted agent-focus-mode-preview--edge-hidden"
                data-agent-focus-mode-preview="true"
                data-agent-focus-projection-graph="true"
                data-agent-focus-mainlike="true"
                data-agent-focus-visible-edges="false"
                data-focus-mode-anchor-id="${escapeHtml(anchorId)}"
                data-focus-node-count="${nodeCount}"
                data-focus-context-node-count="${hideContext ? 0 : normalizedProjection.contextNodes.length}"
                data-focus-layout-type="${escapeHtml(normalizedProjection.layoutType)}"
                data-agent-focus-transform-target="true"
            >
                ${contextLayerHtml}
                ${labelHtml}
                ${nodeHtml}
            </div>
        `;
    }

    function rememberHostedFocusAnchor(anchorId, anchorLabel) {
        const normalizedAnchorId = normalizeKnowledgeGraphText(anchorId);
        if (!normalizedAnchorId) {
            return;
        }
        const normalizedLabel = normalizeKnowledgeGraphText(anchorLabel) || normalizedAnchorId;
        state.hostedFocusHistory = state.hostedFocusHistory
            .filter((entry) => normalizeKnowledgeGraphText(entry && entry.nodeId) !== normalizedAnchorId);
        state.hostedFocusHistory.unshift({
            nodeId: normalizedAnchorId,
            label: normalizedLabel,
        });
        state.hostedFocusHistory = state.hostedFocusHistory.slice(0, HOSTED_FOCUS_HISTORY_LIMIT);
    }

    function buildHostedFocusHistoryMenuHtml(currentAnchorId) {
        const normalizedCurrentAnchorId = normalizeKnowledgeGraphText(currentAnchorId);
        const entries = Array.isArray(state.hostedFocusHistory) ? state.hostedFocusHistory : [];
        const itemHtml = entries.length > 0
            ? entries.map((entry) => {
                const nodeId = normalizeKnowledgeGraphText(entry && entry.nodeId);
                const label = normalizeKnowledgeGraphText(entry && entry.label) || nodeId;
                if (!nodeId) {
                    return '';
                }
                return `
                    <button
                        type="button"
                        class="agent-focus-mode-history-item"
                        data-agent-focus-history-item="true"
                        data-agent-focus-history-node-id="${escapeHtml(nodeId)}"
                        data-agent-focus-history-current="${nodeId === normalizedCurrentAnchorId ? 'true' : 'false'}"
                    >
                        ${escapeHtml(label)}
                    </button>
                `;
            }).join('')
            : `<div class="agent-focus-mode-history-empty">${escapeHtml(translate('agentWorkspace.graphFocus.historyEmpty', 'No focus history yet.'))}</div>`;
        return `
            <div class="agent-focus-mode-history-menu" data-agent-focus-history-menu="true" hidden>
                ${itemHtml}
            </div>
        `;
    }

    function buildHostedFocusControlsHtml(currentAnchorId) {
        return `
            <div class="agent-focus-mode-pane-controls" data-agent-focus-pane-controls="true">
                <button
                    type="button"
                    class="agent-focus-mode-icon-button"
                    data-agent-focus-control="reset"
                    title="${escapeHtml(translate('agentWorkspace.graphFocus.resetView', 'Reset view'))}"
                    aria-label="${escapeHtml(translate('agentWorkspace.graphFocus.resetView', 'Reset view'))}"
                >&#8634;</button>
                <div class="agent-focus-mode-history-control">
                    <button
                        type="button"
                        class="agent-focus-mode-icon-button"
                        data-agent-focus-control="history"
                        title="${escapeHtml(translate('agentWorkspace.graphFocus.history', 'Focus history'))}"
                        aria-label="${escapeHtml(translate('agentWorkspace.graphFocus.history', 'Focus history'))}"
                        aria-expanded="false"
                    >&#8630;</button>
                    ${buildHostedFocusHistoryMenuHtml(currentAnchorId)}
                </div>
            </div>
        `;
    }

    function buildHostedFocusViewportHtml(graphHtml, currentAnchorId) {
        return `
            <div
                class="agent-focus-mode-hosted-shell"
                data-agent-focus-hosted-shell="true"
            >
                ${buildHostedFocusControlsHtml(currentAnchorId)}
                <div
                    class="agent-focus-mode-viewport"
                    data-agent-focus-viewport="true"
                    data-agent-focus-zoom="1"
                    data-agent-focus-pan-x="0"
                    data-agent-focus-pan-y="0"
                >
                    ${graphHtml}
                </div>
            </div>
        `;
    }

    function buildGraphFocusRelationMapHtml(payload) {
        const relationPath = normalizeGraphFocusRelationPath(payload);
        const nodeLabels = payload && payload.nodeLabels && typeof payload.nodeLabels === 'object'
            ? payload.nodeLabels
            : {};
        const focusModeGraph = resolveFocusModeGraphPayload(payload || {});
        const developerMode = isDeveloperModeEnabled()
            || Boolean(payload && payload.showDeveloperDetails === true);
        const relationKinds = Array.from(new Set(
            (Array.isArray(payload && payload.relationKinds) ? payload.relationKinds : [])
                .map((kind) => String(kind || '').trim())
                .filter(Boolean)
                .concat(relationPath.map((edge) => edge.relationKind).filter(Boolean))
                .concat(focusModeGraph ? focusModeGraph.edges.map((edge) => edge.relationKind).filter(Boolean) : [])
        ));
        if (relationPath.length <= 0 && relationKinds.length <= 0 && !focusModeGraph) {
            return '';
        }
        const anchorId = String(payload && (payload.atomId || payload.nodeId) || '').trim();
        const anchorLabel = String(
            nodeLabels[anchorId]
            || payload && (payload.graphTargetLabel || payload.title)
            || anchorId
        ).trim();
        const graphHtml = normalizeFocusModeProjection(focusModeGraph)
            ? buildGraphFocusProjectionGraphHtml(focusModeGraph, { hideContext: true })
            : focusModeGraph
                ? buildGraphFocusSnapshotGraphHtml(focusModeGraph, { interactive: true, hideEdges: true, hideContext: true })
            : buildGraphFocusRelationGraphHtml(anchorId, relationPath, nodeLabels);
        if (!developerMode) {
            return `
                <div
                    class="agent-focus-relation-map agent-focus-relation-map--focus-mode"
                    data-agent-focus-relation-map="true"
                    data-agent-focus-developer-mode="false"
                >
                    ${graphHtml || `<div class="agent-focus-relation-empty">${escapeHtml(translate('agentWorkspace.graphFocus.relationEdgesUnavailable', 'No bounded relation edges were returned for this hit.'))}</div>`}
                </div>
            `;
        }
        const nodeEntries = focusModeGraph
            ? focusModeGraph.nodes.slice(0, 10).map((node) => ({
                id: node.id,
                label: node.label,
                anchor: node.id === focusModeGraph.anchorId,
            }))
            : Array.from(new Set(
                [anchorId]
                    .concat(relationPath.flatMap((edge) => [edge.sourceAtomId, edge.targetAtomId]))
                    .filter(Boolean)
            )).slice(0, 10).map((nodeId) => ({
                id: nodeId,
                label: nodeId === anchorId ? anchorLabel || nodeId : nodeLabels[nodeId] || nodeId,
                anchor: nodeId === anchorId,
            }));
        const nodeHtml = nodeEntries.map((entry) => `
            <span class="agent-focus-relation-node${entry.anchor ? ' agent-focus-relation-node--anchor' : ''}">
                ${escapeHtml(entry.anchor
                    ? `${translate('agentWorkspace.graphFocus.relationAnchorNode', 'Anchor')}: ${entry.label}`
                    : entry.label)}
            </span>
        `).join('');
        const snapshotEdgeHtml = focusModeGraph && focusModeGraph.edges.length > 0
            ? focusModeGraph.edges.map((edge) => {
                const sourceLabel = focusModeGraph.nodes.find((node) => node.id === edge.sourceId)?.label || edge.sourceId;
                const targetLabel = focusModeGraph.nodes.find((node) => node.id === edge.targetId)?.label || edge.targetId;
                const confidencePercent = edge.confidence > 1
                    ? Math.min(100, Math.max(0, edge.confidence))
                    : Math.min(100, Math.max(0, edge.confidence * 100));
                const confidence = Number.isFinite(edge.confidence)
                    ? ` - ${Math.round(confidencePercent)}%`
                    : '';
                return `
                    <li class="agent-focus-relation-edge">
                        <span>${escapeHtml(sourceLabel)}</span>
                        <span class="agent-focus-relation-kind">${escapeHtml(edge.relationKind || 'related')}</span>
                        <span>${escapeHtml(targetLabel)}</span>
                        ${confidence ? `<span class="agent-focus-relation-confidence">${escapeHtml(confidence)}</span>` : ''}
                    </li>
                `;
            }).join('')
            : '';
        const relationEdgeHtml = relationPath.length > 0
            ? relationPath.map((edge) => {
                const sourceLabel = edge.sourceTitle || nodeLabels[edge.sourceAtomId] || edge.sourceAtomId;
                const targetLabel = edge.targetTitle || nodeLabels[edge.targetAtomId] || edge.targetAtomId;
                const confidencePercent = edge.confidence > 1
                    ? Math.min(100, Math.max(0, edge.confidence))
                    : Math.min(100, Math.max(0, edge.confidence * 100));
                const confidence = Number.isFinite(edge.confidence)
                    ? ` - ${Math.round(confidencePercent)}%`
                    : '';
                return `
                    <li class="agent-focus-relation-edge">
                        <span>${escapeHtml(sourceLabel)}</span>
                        <span class="agent-focus-relation-kind">${escapeHtml(edge.relationKind || 'related')}</span>
                        <span>${escapeHtml(targetLabel)}</span>
                        ${confidence ? `<span class="agent-focus-relation-confidence">${escapeHtml(confidence)}</span>` : ''}
                    </li>
                `;
            }).join('')
            : `<li class="agent-focus-relation-empty">${escapeHtml(translate('agentWorkspace.graphFocus.relationEdgesUnavailable', 'No bounded relation edges were returned for this hit.'))}</li>`;
        const edgeHtml = focusModeGraph ? snapshotEdgeHtml || relationEdgeHtml : relationEdgeHtml;
        return `
            <div
                class="agent-focus-relation-map"
                data-agent-focus-relation-map="true"
                data-agent-focus-developer-mode="true"
            >
                <div class="agent-focus-hit-heading">${escapeHtml(translate('agentWorkspace.graphFocus.relationMapTitle', 'Relation focus'))}</div>
                ${relationKinds.length > 0 ? `<div class="agent-focus-relation-kinds" data-agent-focus-developer-details="true">${escapeHtml(relationKinds.join(', '))}</div>` : ''}
                ${graphHtml}
                <div data-agent-focus-developer-details="true">
                    ${nodeHtml ? `<div class="agent-focus-relation-nodes">${nodeHtml}</div>` : ''}
                    <ul class="agent-focus-relation-edges">${edgeHtml}</ul>
                </div>
            </div>
        `;
    }

    function buildGraphFocusDiagnosticsHtml(diagnostics) {
        if (!isDeveloperModeEnabled()) {
            return '';
        }
        if (!diagnostics || (!diagnostics.usedFallback && !diagnostics.fallbackSourcePathUsed)) {
            return '';
        }
        const noneLabel = translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const candidateSourcePaths = Array.isArray(diagnostics.candidateSourcePaths)
            ? diagnostics.candidateSourcePaths
            : [];
        const attemptedSourcePaths = Array.isArray(diagnostics.attemptedSourcePaths)
            ? diagnostics.attemptedSourcePaths
            : [];
        const diagnosticsItems = [
            {
                title: translate('agentWorkspace.graphFocus.failureReasonLabel', 'Failure reason'),
                value: String(diagnostics.failureReason || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.graphFocus.resolvedPathLabel', 'Resolved path'),
                value: String(diagnostics.resolvedSourcePath || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.graphFocus.candidatePathsLabel', 'Candidate paths'),
                value: candidateSourcePaths.length > 0 ? candidateSourcePaths.join(', ') : noneLabel,
            },
            {
                title: translate('agentWorkspace.graphFocus.attemptedPathsLabel', 'Attempted paths'),
                value: attemptedSourcePaths.length > 0 ? attemptedSourcePaths.join(', ') : noneLabel,
            },
            {
                title: translate('agentWorkspace.graphFocus.fallbackPathLabel', 'Path fallback'),
                value: diagnostics.fallbackSourcePathUsed
                    ? translate('agentWorkspace.graphFocus.pathFallbackUsed', 'used')
                    : translate('agentWorkspace.graphFocus.pathFallbackNotUsed', 'not used'),
            },
            {
                title: translate('agentWorkspace.graphFocus.highlightedNodesLabel', 'Highlighted nodes'),
                value: String(Number.isFinite(Number(diagnostics.highlightedNodeCount)) ? Number(diagnostics.highlightedNodeCount) : 0),
            },
        ];
        const diagnosticsHtml = diagnosticsItems.map((item) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(item.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(item.value)}</div>
            </li>
        `).join('');
        return `
            <div class="agent-focus-hit-list agent-focus-diagnostics">
                <div class="agent-focus-hit-heading">${escapeHtml(translate('agentWorkspace.graphFocus.diagnosticsTitle', 'Render diagnostics'))}</div>
                <ul class="agent-chat-card-list">${diagnosticsHtml}</ul>
            </div>
        `;
    }

    function buildGraphFocusFallbackHtml(payload, matchedSpans, diagnostics) {
        const summary = String(payload.summary || '').trim();
        return `
            <div class="agent-pane-block">
                <div class="agent-pane-title">${escapeHtml(buildGraphFocusTitle(payload))}</div>
                <div class="agent-pane-meta">${escapeHtml(String(payload.atomId || payload.nodeId || ''))}</div>
                <p class="agent-pane-summary">${escapeHtml(summary || translate('agentWorkspace.graphFocus.noSummary', 'No summary available.'))}</p>
                ${buildGraphFocusRelationMapHtml(payload)}
                ${buildGraphFocusEvidenceListHtml(matchedSpans)}
                ${buildGraphFocusDiagnosticsHtml(diagnostics)}
            </div>
        `;
    }

    function buildGraphFocusLoadingHtml(payload) {
        return `
            <div class="agent-pane-block">
                <div class="agent-pane-title">${escapeHtml(buildGraphFocusTitle(payload))}</div>
                <div class="agent-pane-meta">${escapeHtml(String(payload.sourcePath || payload.atomId || payload.nodeId || ''))}</div>
                <p class="agent-pane-summary">${escapeHtml(translate('reader_loading', 'Loading reader content...'))}</p>
            </div>
        `;
    }

    function resolveGraphFocusHostedTargetId(payload) {
        const candidates = [
            payload && payload.graphTargetId,
            payload && payload.graphNodeId,
            payload && payload.targetId,
            payload && payload.nodeId,
            payload && payload.atomId,
        ];
        for (let index = 0; index < candidates.length; index += 1) {
            const normalized = normalizeKnowledgeGraphText(candidates[index]);
            if (normalized) {
                return normalized;
            }
        }
        return '';
    }

    function resolveGraphFocusHostedSnapshot(payload) {
        const payloadSnapshot = normalizeFocusModeSnapshot(payload && payload.focusModeSnapshot);
        if (payloadSnapshot) {
            return payloadSnapshot;
        }
        const targetId = resolveGraphFocusHostedTargetId(payload || {});
        return targetId ? resolveFocusModeSnapshot(targetId) : null;
    }

    function resolveGraphFocusHostedProjection(payload) {
        const payloadProjection = normalizeFocusModeProjection(payload && payload.focusModeProjection);
        if (payloadProjection) {
            return payloadProjection;
        }
        const targetId = resolveGraphFocusHostedTargetId(payload || {});
        return targetId ? resolveFocusModeProjection(targetId) : resolveGraphFocusHostedSnapshot(payload || {});
    }

    function buildPaneLocalNodeReaderHtml(config) {
        const readerAttribute = config && config.readerAttribute;
        const titleAttribute = config && config.titleAttribute;
        const closeAttribute = config && config.closeAttribute;
        const bodyAttribute = config && config.bodyAttribute;
        if (!readerAttribute || !titleAttribute || !closeAttribute || !bodyAttribute) {
            return '';
        }
        return `
            <section class="agent-focus-pane-reader" ${readerAttribute}="true" hidden>
                <div class="agent-focus-pane-reader-header">
                    <div class="agent-focus-pane-reader-title" ${titleAttribute}="true"></div>
                    <button
                        type="button"
                        class="agent-pane-close-button agent-focus-pane-reader-close"
                        ${closeAttribute}="true"
                        aria-label="${escapeHtml(translate('agentWorkspace.actions.closePane', 'Close pane'))}"
                    >\u00d7</button>
                </div>
                <div class="agent-focus-pane-reader-body" ${bodyAttribute}="true"></div>
            </section>
        `;
    }

    function buildGraphFocusPaneReaderHtml() {
        return buildPaneLocalNodeReaderHtml({
            readerAttribute: 'data-agent-focus-pane-reader',
            titleAttribute: 'data-agent-focus-pane-reader-title',
            closeAttribute: 'data-agent-focus-pane-reader-close',
            bodyAttribute: 'data-agent-focus-pane-reader-body',
        });
    }

    function buildLearningPathPaneReaderHtml() {
        return buildPaneLocalNodeReaderHtml({
            readerAttribute: 'data-agent-learning-path-pane-reader',
            titleAttribute: 'data-agent-learning-path-pane-reader-title',
            closeAttribute: 'data-agent-learning-path-pane-reader-close',
            bodyAttribute: 'data-agent-learning-path-pane-reader-body',
        });
    }

    function buildHostedGraphFocusDeveloperDetailsHtml(payload, snapshot) {
        if (!isDeveloperModeEnabled()) {
            return '';
        }
        const normalizedSnapshot = normalizeFocusModeSnapshot(snapshot);
        const relationPath = normalizeGraphFocusRelationPath(payload || {});
        const relationKinds = Array.from(new Set(
            (Array.isArray(payload && payload.relationKinds) ? payload.relationKinds : [])
                .map((kind) => normalizeKnowledgeGraphText(kind))
                .filter(Boolean)
                .concat(relationPath.map((edge) => edge.relationKind).filter(Boolean))
                .concat(normalizedSnapshot ? normalizedSnapshot.edges.map((edge) => edge.relationKind).filter(Boolean) : [])
        ));
        if (!normalizedSnapshot && relationPath.length <= 0 && relationKinds.length <= 0) {
            return '';
        }
        const nodeHtml = normalizedSnapshot
            ? normalizedSnapshot.nodes.slice(0, 10).map((node) => `
                <span class="agent-focus-relation-node${node.id === normalizedSnapshot.anchorId ? ' agent-focus-relation-node--anchor' : ''}">
                    ${escapeHtml(node.id === normalizedSnapshot.anchorId
                        ? `${translate('agentWorkspace.graphFocus.relationAnchorNode', 'Anchor')}: ${node.label}`
                        : node.label)}
                </span>
            `).join('')
            : '';
        const snapshotEdgeHtml = normalizedSnapshot && normalizedSnapshot.edges.length > 0
            ? normalizedSnapshot.edges.map((edge) => {
                const sourceLabel = normalizedSnapshot.nodes.find((node) => node.id === edge.sourceId)?.label || edge.sourceId;
                const targetLabel = normalizedSnapshot.nodes.find((node) => node.id === edge.targetId)?.label || edge.targetId;
                return `
                    <li class="agent-focus-relation-edge">
                        <span>${escapeHtml(sourceLabel)}</span>
                        <span class="agent-focus-relation-kind">${escapeHtml(edge.relationKind || 'related')}</span>
                        <span>${escapeHtml(targetLabel)}</span>
                    </li>
                `;
            }).join('')
            : '';
        const relationEdgeHtml = relationPath.length > 0
            ? relationPath.map((edge) => {
                const sourceLabel = edge.sourceTitle || edge.sourceAtomId;
                const targetLabel = edge.targetTitle || edge.targetAtomId;
                return `
                    <li class="agent-focus-relation-edge">
                        <span>${escapeHtml(sourceLabel)}</span>
                        <span class="agent-focus-relation-kind">${escapeHtml(edge.relationKind || 'related')}</span>
                        <span>${escapeHtml(targetLabel)}</span>
                    </li>
                `;
            }).join('')
            : '';
        const edgeHtml = snapshotEdgeHtml || relationEdgeHtml || `<li class="agent-focus-relation-empty">${escapeHtml(translate('agentWorkspace.graphFocus.relationEdgesUnavailable', 'No bounded relation edges were returned for this hit.'))}</li>`;
        return `
            <div
                class="agent-focus-relation-map"
                data-agent-focus-relation-map="true"
                data-agent-focus-developer-mode="true"
            >
                <div class="agent-focus-hit-heading">${escapeHtml(translate('agentWorkspace.graphFocus.relationMapTitle', 'Relation focus'))}</div>
                ${relationKinds.length > 0 ? `<div class="agent-focus-relation-kinds" data-agent-focus-developer-details="true">${escapeHtml(relationKinds.join(', '))}</div>` : ''}
                <div data-agent-focus-developer-details="true">
                    ${nodeHtml ? `<div class="agent-focus-relation-nodes">${nodeHtml}</div>` : ''}
                    <ul class="agent-focus-relation-edges">${edgeHtml}</ul>
                </div>
            </div>
        `;
    }

    function buildGraphFocusHostedModeHtml(payload, focusGraph) {
        if (!focusGraph) {
            focusGraph = resolveGraphFocusHostedProjection(payload || {});
        }
        if (!focusGraph) {
            return `
                <div
                    class="agent-pane-block agent-pane-block--graph-focus agent-pane-block--focus-runtime"
                    data-agent-hosted-focus-mode="true"
                >
                    <div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.graphFocus.runtimeUnavailable', 'Main graph runtime is unavailable.'))}</div>
                </div>
            `;
        }
        const normalizedProjection = normalizeFocusModeProjection(focusGraph);
        const normalizedSnapshot = normalizedProjection || normalizeFocusModeSnapshot(focusGraph);
        const developerDetails = buildHostedGraphFocusDeveloperDetailsHtml(payload || {}, normalizedSnapshot);
        const graphHtml = normalizedProjection
            ? buildGraphFocusProjectionGraphHtml(normalizedProjection, { hideContext: true })
            : buildGraphFocusSnapshotGraphHtml(normalizedSnapshot, { interactive: true, hideEdges: true, hideContext: true });
        return `
            <div
                class="agent-pane-block agent-pane-block--graph-focus agent-pane-block--focus-runtime"
                data-agent-hosted-focus-mode="true"
                data-agent-hosted-focus-anchor-id="${escapeHtml(normalizedSnapshot.anchorId)}"
            >
                ${buildHostedFocusViewportHtml(graphHtml, normalizedSnapshot.anchorId)}
                ${buildGraphFocusPaneReaderHtml()}
                ${developerDetails}
            </div>
        `;
    }

    function buildGraphFocusRenderedHtml(payload, matchedSpans) {
        return `
            <div class="agent-pane-block agent-pane-block--graph-focus">
                <div class="agent-pane-title">${escapeHtml(buildGraphFocusTitle(payload))}</div>
                <div class="agent-pane-meta">${escapeHtml(String(payload.sourcePath || payload.atomId || payload.nodeId || ''))}</div>
                ${buildGraphFocusRelationMapHtml(payload)}
                <div class="agent-focus-rendered-markdown" data-agent-focus-rendered-markdown="true"></div>
                ${buildGraphFocusEvidenceListHtml(matchedSpans)}
            </div>
        `;
    }

    function collectGraphFocusHighlightTerms(matchedSpans) {
        return matchedSpans
            .map((span) => String(span && span.snippet || '').replace(/\s+/g, ' ').trim())
            .filter((snippet) => snippet.length >= 8)
            .map((snippet) => snippet.slice(0, 240));
    }

    function normalizeGraphFocusText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function sanitizeGraphFocusSourceLine(line) {
        return normalizeGraphFocusText(
            String(line || '')
                .replace(/^\s{0,3}(?:#{1,6}|>+|[-*+]|(?:\d+)[.)])\s+/u, '')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
                .replace(/[*_~`|]/g, ' ')
        );
    }

    function collectGraphFocusFeatures(value) {
        return normalizeGraphFocusText(value)
            .toLowerCase()
            .split(/[^a-z0-9\u3400-\u9fff]+/u)
            .map((part) => part.trim())
            .filter((part) => part.length >= 2 || /[\u3400-\u9fff]/u.test(part));
    }

    function computeGraphFocusFeatureOverlap(primaryText, secondaryText) {
        const primaryFeatures = collectGraphFocusFeatures(primaryText);
        const secondaryFeatures = new Set(collectGraphFocusFeatures(secondaryText));
        if (primaryFeatures.length <= 0 || secondaryFeatures.size <= 0) {
            return 0;
        }
        const overlapCount = primaryFeatures.filter((feature) => secondaryFeatures.has(feature)).length;
        return Number((overlapCount / primaryFeatures.length).toFixed(4));
    }

    function buildGraphFocusLineWindowText(markdownSource, span) {
        const startLine = Number(span && span.startLine);
        if (!Number.isFinite(startLine) || startLine <= 0) {
            return '';
        }
        const endCandidate = Number(span && span.endLine);
        const endLine = Number.isFinite(endCandidate) && endCandidate >= startLine
            ? Math.trunc(endCandidate)
            : Math.trunc(startLine);
        const lines = String(markdownSource || '').split(/\r?\n/);
        if (lines.length <= 0) {
            return '';
        }
        const boundedEndLine = Math.min(endLine, Math.trunc(startLine) + 4);
        const excerpt = lines
            .slice(Math.max(0, Math.trunc(startLine) - 1), Math.min(lines.length, boundedEndLine))
            .map((line) => sanitizeGraphFocusSourceLine(line))
            .filter(Boolean)
            .join(' ');
        const normalizedExcerpt = normalizeGraphFocusText(excerpt);
        return normalizedExcerpt.length >= 8
            ? normalizedExcerpt.slice(0, 240)
            : '';
    }

    function buildGraphFocusLineStartOffsets(markdownSource) {
        const source = String(markdownSource || '');
        const offsets = [0];
        for (let index = 0; index < source.length; index += 1) {
            if (source[index] === '\n') {
                offsets.push(index + 1);
            }
        }
        return offsets;
    }

    function resolveGraphFocusSourceLineOffsetRange(markdownSource, startLine, endLine) {
        const source = String(markdownSource || '');
        const normalizedStartLine = Number(startLine);
        if (!source || !Number.isFinite(normalizedStartLine) || normalizedStartLine <= 0) {
            return null;
        }
        const lineStartOffsets = buildGraphFocusLineStartOffsets(source);
        const startOffset = lineStartOffsets[Math.trunc(normalizedStartLine) - 1];
        if (!Number.isFinite(startOffset)) {
            return null;
        }
        const normalizedEndLine = Number.isFinite(Number(endLine)) && Number(endLine) >= normalizedStartLine
            ? Math.trunc(Number(endLine))
            : Math.trunc(normalizedStartLine);
        const endOffset = normalizedEndLine < lineStartOffsets.length
            ? lineStartOffsets[normalizedEndLine]
            : source.length;
        return {
            rawStart: Math.max(0, startOffset),
            rawEnd: Math.max(startOffset, endOffset),
        };
    }

    function resolveGraphFocusRenderedSourceRange(candidate) {
        const dataset = candidate && candidate.dataset ? candidate.dataset : null;
        const startLine = Number(dataset && dataset.agentMarkdownSourceStartLine);
        if (!Number.isFinite(startLine) || startLine <= 0) {
            return null;
        }
        const endCandidate = Number(dataset && dataset.agentMarkdownSourceEndLine);
        return {
            startLine: Math.trunc(startLine),
            endLine: Number.isFinite(endCandidate) && endCandidate >= startLine
                ? Math.trunc(endCandidate)
                : Math.trunc(startLine),
        };
    }

    function doGraphFocusLineRangesOverlap(leftStartLine, leftEndLine, rightStartLine, rightEndLine) {
        const normalizedLeftStart = Number(leftStartLine);
        const normalizedLeftEnd = Number.isFinite(Number(leftEndLine)) && Number(leftEndLine) >= normalizedLeftStart
            ? Number(leftEndLine)
            : normalizedLeftStart;
        const normalizedRightStart = Number(rightStartLine);
        const normalizedRightEnd = Number.isFinite(Number(rightEndLine)) && Number(rightEndLine) >= normalizedRightStart
            ? Number(rightEndLine)
            : normalizedRightStart;
        if (
            !Number.isFinite(normalizedLeftStart)
            || !Number.isFinite(normalizedLeftEnd)
            || !Number.isFinite(normalizedRightStart)
            || !Number.isFinite(normalizedRightEnd)
        ) {
            return false;
        }
        return normalizedLeftStart <= normalizedRightEnd && normalizedRightStart <= normalizedLeftEnd;
    }

    function collectGraphFocusHighlightAnchors(matchedSpans, markdownSource) {
        const anchors = [];
        const seen = new Set();
        matchedSpans.forEach((span) => {
            const lineWindowText = buildGraphFocusLineWindowText(markdownSource, span);
            const snippetText = normalizeGraphFocusText(String(span && span.snippet || '')).slice(0, 240);
            const fallbackText = snippetText.length >= 8 ? snippetText : '';
            const shouldTrustLineWindow = !lineWindowText
                || !fallbackText
                || computeGraphFocusFeatureOverlap(fallbackText, lineWindowText) >= 0.45;
            const anchor = lineWindowText && shouldTrustLineWindow
                ? {
                    strategy: 'line_window',
                    text: lineWindowText,
                    fallbackText,
                    startLine: Number.isFinite(Number(span && span.startLine)) ? Math.trunc(Number(span.startLine)) : null,
                    endLine: Number.isFinite(Number(span && span.endLine)) ? Math.trunc(Number(span.endLine)) : null,
                    startOffset: Number.isFinite(Number(span && span.startOffset)) && Number(span.startOffset) >= 0
                        ? Math.trunc(Number(span.startOffset))
                        : null,
                    endOffset: Number.isFinite(Number(span && span.endOffset)) && Number(span.endOffset) >= 0
                        ? Math.trunc(Number(span.endOffset))
                        : null,
                }
                : fallbackText
                    ? {
                        strategy: 'snippet_fallback',
                        text: fallbackText,
                        fallbackText: '',
                        startLine: null,
                        endLine: null,
                        startOffset: null,
                        endOffset: null,
                    }
                    : null;
            if (!anchor) {
                return;
            }
            const key = [
                anchor.strategy,
                anchor.text,
                anchor.fallbackText || '',
                anchor.startLine || '',
                anchor.endLine || '',
                Number.isFinite(Number(anchor.startOffset)) ? Number(anchor.startOffset) : '',
                Number.isFinite(Number(anchor.endOffset)) ? Number(anchor.endOffset) : '',
            ].join('::');
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            anchors.push(anchor);
        });
        return anchors;
    }

    function scoreGraphFocusNodeText(text, terms) {
        const normalizedText = normalizeGraphFocusText(text).toLowerCase();
        if (!normalizedText) {
            return 0;
        }
        let score = 0;
        terms.forEach((term) => {
            const normalizedTerm = normalizeGraphFocusText(term).toLowerCase();
            if (!normalizedTerm) {
                return;
            }
            if (normalizedText.includes(normalizedTerm)) {
                score += normalizedTerm.length + 1000;
                return;
            }
            normalizedTerm
                .split(/[.;,:()[\]{}，。；：]/)
                .map((part) => part.trim())
                .filter((part) => part.length >= 8)
                .forEach((fragment) => {
                    if (normalizedText.includes(fragment)) {
                        score += fragment.length;
                    }
                });
        });
        return score;
    }

    function scoreGraphFocusNodeAgainstAnchor(candidate, anchor) {
        const nodeText = normalizeGraphFocusText(candidate && candidate.textContent || '');
        if (!nodeText || !anchor || !anchor.text) {
            return {
                score: 0,
                strategy: 'none',
            };
        }
        const descendantCandidateCount = typeof candidate.querySelectorAll === 'function'
            ? candidate.querySelectorAll('p, li, blockquote, pre, h1, h2, h3, h4, h5, h6').length
            : 0;
        const specificityBonus = Math.max(0, 200 - Math.abs(nodeText.length - String(anchor.text).length));
        const containerPenalty = descendantCandidateCount > 0
            ? Math.min(400, descendantCandidateCount * 120)
            : 0;
        const renderedSourceRange = resolveGraphFocusRenderedSourceRange(candidate);
        if (
            renderedSourceRange
            && Number.isFinite(Number(anchor.startLine))
            && Number(anchor.startLine) > 0
            && doGraphFocusLineRangesOverlap(
                Number(anchor.startLine),
                Number(anchor.endLine),
                renderedSourceRange.startLine,
                renderedSourceRange.endLine
            )
        ) {
            const provenanceScore = scoreGraphFocusNodeText(
                nodeText,
                [anchor.text, anchor.fallbackText].filter(Boolean)
            );
            if (provenanceScore > 0) {
                return {
                    score: provenanceScore + 8000 + specificityBonus - containerPenalty,
                    strategy: 'source_line_provenance',
                };
            }
        }
        const lineWindowScore = scoreGraphFocusNodeText(nodeText, [anchor.text]);
        if (lineWindowScore > 0) {
            return {
                score: lineWindowScore
                    + (anchor.strategy === 'line_window' ? 5000 : 2500)
                    + specificityBonus
                    - containerPenalty,
                strategy: anchor.strategy,
            };
        }
        if (anchor.fallbackText) {
            const fallbackScore = scoreGraphFocusNodeText(nodeText, [anchor.fallbackText]);
            if (fallbackScore > 0) {
                return {
                    score: fallbackScore + 1500 + specificityBonus - containerPenalty,
                    strategy: 'snippet_fallback',
                };
            }
        }
        return {
            score: 0,
            strategy: 'none',
        };
    }

    function clearGraphFocusInlineHighlights(root) {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return;
        }
        Array.from(root.querySelectorAll('[data-agent-focus-inline-highlight="true"]')).forEach((element) => {
            const parent = element.parentNode;
            if (!parent) {
                return;
            }
            while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
            if (typeof parent.normalize === 'function') {
                parent.normalize();
            }
        });
    }

    function collectGraphFocusInlineCandidateTexts(anchor) {
        const candidates = [];
        const seen = new Set();
        const append = (value) => {
            const normalizedValue = normalizeGraphFocusText(value);
            if (normalizedValue.length < 4) {
                return;
            }
            const lowered = normalizedValue.toLowerCase();
            if (seen.has(lowered)) {
                return;
            }
            seen.add(lowered);
            candidates.push(normalizedValue);
        };
        append(anchor && anchor.fallbackText);
        append(anchor && anchor.text);
        [anchor && anchor.fallbackText, anchor && anchor.text].forEach((value) => {
            normalizeGraphFocusText(value)
                .split(/[.;,:()[\]{}!?，。；：！？]/u)
                .map((fragment) => fragment.trim())
                .filter((fragment) => fragment.length >= 8)
                .forEach((fragment) => append(fragment));
        });
        return candidates.sort((left, right) => right.length - left.length);
    }

    function collectGraphFocusInlineSourceFragmentTexts(anchor) {
        const candidates = [];
        const seen = new Set();
        const append = (value) => {
            const normalizedValue = normalizeGraphFocusText(value);
            if (normalizedValue.length < 4) {
                return;
            }
            const lowered = normalizedValue.toLowerCase();
            if (seen.has(lowered)) {
                return;
            }
            seen.add(lowered);
            candidates.push(normalizedValue);
        };
        append(anchor && anchor.fallbackText);
        normalizeGraphFocusText(anchor && anchor.fallbackText)
            .split(/[.;,:()[\]{}!?，。；：！？]/u)
            .map((fragment) => fragment.trim())
            .filter((fragment) => fragment.length >= 8)
            .forEach((fragment) => append(fragment));
        return candidates;
    }

    function buildGraphFocusNormalizedSearchIndex(rawText) {
        const ranges = [];
        const normalizedCharacters = [];
        const source = String(rawText || '');
        let rawIndex = 0;
        while (rawIndex < source.length) {
            const character = source[rawIndex];
            if (/\s/u.test(character)) {
                const whitespaceStart = rawIndex;
                while (rawIndex < source.length && /\s/u.test(source[rawIndex])) {
                    rawIndex += 1;
                }
                normalizedCharacters.push(' ');
                ranges.push({
                    rawStart: whitespaceStart,
                    rawEnd: rawIndex,
                });
                continue;
            }
            normalizedCharacters.push(character.toLowerCase());
            ranges.push({
                rawStart: rawIndex,
                rawEnd: rawIndex + 1,
            });
            rawIndex += 1;
        }
        return {
            normalizedText: normalizedCharacters.join(''),
            ranges,
        };
    }

    function doGraphFocusRawRangesOverlap(left, right) {
        if (!left || !right) {
            return false;
        }
        return Number(left.rawStart) < Number(right.rawEnd) && Number(right.rawStart) < Number(left.rawEnd);
    }

    function findGraphFocusInlineHighlightRange(root, candidateTexts, occupiedRanges) {
        if (!root || candidateTexts.length <= 0) {
            return null;
        }
        const rawText = String(root.textContent || '');
        if (!rawText) {
            return null;
        }
        const searchIndex = buildGraphFocusNormalizedSearchIndex(rawText);
        if (!searchIndex.normalizedText || searchIndex.ranges.length <= 0) {
            return null;
        }
        const usedRanges = Array.isArray(occupiedRanges) ? occupiedRanges : [];
        for (const candidateText of candidateTexts) {
            const normalizedCandidate = normalizeGraphFocusText(candidateText).toLowerCase();
            if (normalizedCandidate.length < 4) {
                continue;
            }
            let searchStart = 0;
            while (searchStart <= searchIndex.normalizedText.length - normalizedCandidate.length) {
                const matchIndex = searchIndex.normalizedText.indexOf(normalizedCandidate, searchStart);
                if (matchIndex < 0) {
                    break;
                }
                const lastIndex = matchIndex + normalizedCandidate.length - 1;
                const matchRange = {
                    rawStart: searchIndex.ranges[matchIndex].rawStart,
                    rawEnd: searchIndex.ranges[lastIndex].rawEnd,
                };
                if (!usedRanges.some((usedRange) => doGraphFocusRawRangesOverlap(usedRange, matchRange))) {
                    return matchRange;
                }
                searchStart = matchIndex + normalizedCandidate.length;
            }
        }
        return null;
    }

    function findGraphFocusInlineHighlightRangeAtOccurrence(root, candidateTexts, occurrenceIndex, occupiedRanges) {
        if (!root || candidateTexts.length <= 0) {
            return null;
        }
        const rawText = String(root.textContent || '');
        if (!rawText) {
            return null;
        }
        const searchIndex = buildGraphFocusNormalizedSearchIndex(rawText);
        if (!searchIndex.normalizedText || searchIndex.ranges.length <= 0) {
            return null;
        }
        const targetOccurrence = Math.max(0, Math.trunc(Number(occurrenceIndex) || 0));
        const usedRanges = Array.isArray(occupiedRanges) ? occupiedRanges : [];
        for (const candidateText of candidateTexts) {
            const normalizedCandidate = normalizeGraphFocusText(candidateText).toLowerCase();
            if (normalizedCandidate.length < 4) {
                continue;
            }
            let searchStart = 0;
            let occurrenceCursor = 0;
            while (searchStart <= searchIndex.normalizedText.length - normalizedCandidate.length) {
                const matchIndex = searchIndex.normalizedText.indexOf(normalizedCandidate, searchStart);
                if (matchIndex < 0) {
                    break;
                }
                const lastIndex = matchIndex + normalizedCandidate.length - 1;
                const matchRange = {
                    rawStart: searchIndex.ranges[matchIndex].rawStart,
                    rawEnd: searchIndex.ranges[lastIndex].rawEnd,
                };
                if (
                    occurrenceCursor >= targetOccurrence
                    && !usedRanges.some((usedRange) => doGraphFocusRawRangesOverlap(usedRange, matchRange))
                ) {
                    return matchRange;
                }
                occurrenceCursor += 1;
                searchStart = matchIndex + normalizedCandidate.length;
            }
        }
        return null;
    }

    function countGraphFocusSourceOccurrencesBefore(sourceText, candidateText, rawEndExclusive) {
        const normalizedCandidate = normalizeGraphFocusText(candidateText).toLowerCase();
        if (normalizedCandidate.length < 4) {
            return 0;
        }
        const searchIndex = buildGraphFocusNormalizedSearchIndex(sourceText);
        if (!searchIndex.normalizedText || searchIndex.ranges.length <= 0) {
            return 0;
        }
        const boundedEnd = Math.max(0, Math.trunc(Number(rawEndExclusive) || 0));
        let occurrenceCount = 0;
        let searchStart = 0;
        while (searchStart <= searchIndex.normalizedText.length - normalizedCandidate.length) {
            const matchIndex = searchIndex.normalizedText.indexOf(normalizedCandidate, searchStart);
            if (matchIndex < 0) {
                break;
            }
            const lastIndex = matchIndex + normalizedCandidate.length - 1;
            const matchRawEnd = searchIndex.ranges[lastIndex].rawEnd;
            if (matchRawEnd <= boundedEnd) {
                occurrenceCount += 1;
            }
            searchStart = matchIndex + normalizedCandidate.length;
        }
        return occurrenceCount;
    }

    function collectGraphFocusSourceOffsetCandidateTexts(anchor, markdownSource) {
        const candidates = [];
        const seen = new Set();
        const append = (value) => {
            const normalizedValue = sanitizeGraphFocusSourceLine(value);
            if (normalizedValue.length < 4) {
                return;
            }
            const lowered = normalizedValue.toLowerCase();
            if (seen.has(lowered)) {
                return;
            }
            seen.add(lowered);
            candidates.push(normalizedValue);
        };
        const source = String(markdownSource || '');
        const startOffset = Number(anchor && anchor.startOffset);
        const endOffset = Number(anchor && anchor.endOffset);
        if (
            Number.isFinite(startOffset)
            && Number.isFinite(endOffset)
            && startOffset >= 0
            && endOffset > startOffset
            && endOffset <= source.length
        ) {
            append(source.slice(startOffset, endOffset));
        }
        append(anchor && anchor.fallbackText);
        return candidates;
    }

    function resolveGraphFocusSourceOffsetInlineRange(node, anchor, occupiedRanges, markdownSource) {
        const source = String(markdownSource || '');
        const startOffset = Number(anchor && anchor.startOffset);
        const endOffset = Number(anchor && anchor.endOffset);
        if (
            !node
            || !source
            || !Number.isFinite(startOffset)
            || !Number.isFinite(endOffset)
            || startOffset < 0
            || endOffset <= startOffset
            || endOffset > source.length
        ) {
            return null;
        }
        const sourceLineOffsetRange = resolveGraphFocusSourceLineOffsetRange(
            source,
            anchor && anchor.startLine,
            anchor && anchor.endLine
        ) || {
            rawStart: 0,
            rawEnd: source.length,
        };
        if (startOffset < sourceLineOffsetRange.rawStart || startOffset >= sourceLineOffsetRange.rawEnd) {
            return null;
        }
        const sourceLineText = source.slice(sourceLineOffsetRange.rawStart, sourceLineOffsetRange.rawEnd);
        const sourceLocalStart = startOffset - sourceLineOffsetRange.rawStart;
        const candidateTexts = collectGraphFocusSourceOffsetCandidateTexts(anchor, source);
        for (const candidateText of candidateTexts) {
            const occurrenceIndex = countGraphFocusSourceOccurrencesBefore(
                sourceLineText,
                candidateText,
                sourceLocalStart
            );
            const range = findGraphFocusInlineHighlightRangeAtOccurrence(
                node,
                [candidateText],
                occurrenceIndex,
                occupiedRanges
            );
            if (range) {
                return range;
            }
        }
        return null;
    }

    function buildGraphFocusTextNodeIndex(root) {
        if (!root || typeof document.createTreeWalker !== 'function') {
            return [];
        }
        const textNodes = [];
        const showText = window.NodeFilter && Number(window.NodeFilter.SHOW_TEXT)
            ? Number(window.NodeFilter.SHOW_TEXT)
            : 4;
        const walker = document.createTreeWalker(root, showText, null);
        let cursor = 0;
        let currentNode = walker.nextNode();
        while (currentNode) {
            const parentTagName = currentNode.parentNode && currentNode.parentNode.nodeName
                ? String(currentNode.parentNode.nodeName).toLowerCase()
                : '';
            const nodeValue = String(currentNode.nodeValue || '');
            if (nodeValue && parentTagName !== 'script' && parentTagName !== 'style') {
                const start = cursor;
                cursor += nodeValue.length;
                textNodes.push({
                    node: currentNode,
                    start,
                    end: cursor,
                });
            }
            currentNode = walker.nextNode();
        }
        return textNodes;
    }

    function wrapGraphFocusTextNodeSegment(textNode, startOffset, endOffset) {
        const value = String(textNode && textNode.nodeValue || '');
        if (!textNode || startOffset < 0 || endOffset > value.length || startOffset >= endOffset) {
            return null;
        }
        const matchedNode = textNode.splitText(startOffset);
        matchedNode.splitText(endOffset - startOffset);
        const highlight = document.createElement('mark');
        highlight.className = 'agent-focus-inline-highlight';
        highlight.setAttribute('data-agent-focus-inline-highlight', 'true');
        const parent = matchedNode.parentNode;
        if (!parent) {
            return null;
        }
        parent.replaceChild(highlight, matchedNode);
        highlight.appendChild(matchedNode);
        return highlight;
    }

    function applyGraphFocusInlineHighlightRange(root, range) {
        if (!root || !range) {
            return 0;
        }
        const segments = buildGraphFocusTextNodeIndex(root)
            .map((entry) => ({
                node: entry.node,
                startOffset: Math.max(0, Number(range.rawStart) - entry.start),
                endOffset: Math.min(Number(range.rawEnd) - entry.start, entry.end - entry.start),
            }))
            .filter((segment) => segment.startOffset < segment.endOffset)
            .reverse();
        let wrappedCount = 0;
        segments.forEach((segment) => {
            if (wrapGraphFocusTextNodeSegment(segment.node, segment.startOffset, segment.endOffset)) {
                wrappedCount += 1;
            }
        });
        return wrappedCount;
    }

    function resolveGraphFocusInlineHighlightMatch(node, entry, occupiedRanges, markdownSource) {
        if (!node || !entry || !entry.anchor) {
            return null;
        }
        if (entry.strategy === 'source_line_provenance' || entry.strategy === 'line_window') {
            const sourceOffsetRange = resolveGraphFocusSourceOffsetInlineRange(
                node,
                entry.anchor,
                occupiedRanges,
                markdownSource
            );
            if (sourceOffsetRange) {
                return {
                    range: sourceOffsetRange,
                    strategy: 'source_offset_provenance',
                };
            }
            const sourceFragmentRange = findGraphFocusInlineHighlightRange(
                node,
                collectGraphFocusInlineSourceFragmentTexts(entry.anchor),
                occupiedRanges
            );
            if (sourceFragmentRange) {
                return {
                    range: sourceFragmentRange,
                    strategy: 'source_fragment_provenance',
                };
            }
        }
        const searchRange = findGraphFocusInlineHighlightRange(
            node,
            collectGraphFocusInlineCandidateTexts(entry.anchor),
            occupiedRanges
        );
        if (!searchRange) {
            return null;
        }
        return {
            range: searchRange,
            strategy: 'text_search',
        };
    }

    function applyGraphFocusInlineHighlights(selectedEntries, markdownSource) {
        const entries = Array.isArray(selectedEntries) ? selectedEntries : [];
        if (entries.length <= 0) {
            return {
                inlineHighlightCount: 0,
                inlineHighlightStrategy: 'none',
            };
        }
        const entriesByNode = new Map();
        entries.forEach((entry) => {
            if (!entry || !entry.node) {
                return;
            }
            const existingEntries = entriesByNode.get(entry.node) || [];
            existingEntries.push(entry);
            entriesByNode.set(entry.node, existingEntries);
        });
        let inlineHighlightCount = 0;
        let inlineHighlightStrategy = 'none';
        entriesByNode.forEach((nodeEntries, node) => {
            clearGraphFocusInlineHighlights(node);
            const occupiedRanges = [];
            nodeEntries.forEach((entry) => {
                const resolvedHighlight = resolveGraphFocusInlineHighlightMatch(node, entry, occupiedRanges, markdownSource);
                if (!resolvedHighlight || !resolvedHighlight.range) {
                    return;
                }
                const wrappedCount = applyGraphFocusInlineHighlightRange(node, resolvedHighlight.range);
                if (wrappedCount > 0) {
                    occupiedRanges.push(resolvedHighlight.range);
                    inlineHighlightCount += 1;
                    if (resolvedHighlight.strategy === 'source_offset_provenance') {
                        inlineHighlightStrategy = 'source_offset_provenance';
                    } else if (
                        resolvedHighlight.strategy === 'source_fragment_provenance'
                        && inlineHighlightStrategy !== 'source_offset_provenance'
                    ) {
                        inlineHighlightStrategy = 'source_fragment_provenance';
                    } else if (inlineHighlightStrategy === 'none') {
                        inlineHighlightStrategy = 'text_search';
                    }
                }
            });
        });
        return {
            inlineHighlightCount,
            inlineHighlightStrategy,
        };
    }

    function highlightGraphFocusRenderedMarkdown(container, matchedSpans, markdownSource) {
        if (!container) {
            return {
                highlightedNodeCount: 0,
                inlineHighlightCount: 0,
                inlineHighlightStrategy: 'none',
                highlightStrategy: 'none',
            };
        }
        const candidates = Array.from(container.querySelectorAll('p, li, blockquote, pre, .reader-block, h1, h2, h3, h4, h5, h6'));
        candidates.forEach((candidate) => {
            candidate.classList.remove('agent-focus-match');
            candidate.removeAttribute('data-agent-focus-highlight');
        });
        const anchors = collectGraphFocusHighlightAnchors(matchedSpans, markdownSource);
        if (anchors.length <= 0 || candidates.length <= 0) {
            return {
                highlightedNodeCount: 0,
                inlineHighlightCount: 0,
                inlineHighlightStrategy: 'none',
                highlightStrategy: 'none',
            };
        }

        const selectedEntries = [];
        let highlightStrategy = 'none';
        anchors.forEach((anchor) => {
            let bestNode = null;
            let bestScore = 0;
            let bestStrategy = 'none';
            candidates.forEach((candidate) => {
                const scoredCandidate = scoreGraphFocusNodeAgainstAnchor(candidate, anchor);
                if (scoredCandidate.score <= bestScore) {
                    return;
                }
                bestNode = candidate;
                bestScore = scoredCandidate.score;
                bestStrategy = scoredCandidate.strategy;
            });
            if (!bestNode || bestScore <= 0) {
                return;
            }
            selectedEntries.push({
                node: bestNode,
                anchor,
                strategy: bestStrategy,
            });
            if (bestStrategy === 'source_line_provenance') {
                highlightStrategy = 'source_line_provenance';
            } else if (bestStrategy === 'line_window' && highlightStrategy !== 'source_line_provenance') {
                highlightStrategy = 'line_window';
            } else if (highlightStrategy === 'none') {
                highlightStrategy = 'snippet_fallback';
            }
        });

        const dedupedNodes = Array.from(new Set(selectedEntries.map((entry) => entry.node)));
        const prunedNodes = dedupedNodes.filter((candidate) => !dedupedNodes.some((otherCandidate) => (
            otherCandidate !== candidate
            && typeof candidate.contains === 'function'
            && candidate.contains(otherCandidate)
        )));
        const prunedNodeSet = new Set(prunedNodes);
        const prunedEntries = selectedEntries.filter((entry) => prunedNodeSet.has(entry.node));
        prunedNodes.forEach((candidate) => {
            candidate.classList.add('agent-focus-match');
            candidate.setAttribute('data-agent-focus-highlight', 'true');
        });
        const inlineHighlightResult = applyGraphFocusInlineHighlights(prunedEntries, markdownSource);
        revealGraphFocusPrimaryHighlight(container);
        return {
            highlightedNodeCount: prunedNodes.length,
            inlineHighlightCount: Number(inlineHighlightResult && inlineHighlightResult.inlineHighlightCount || 0),
            inlineHighlightStrategy: String(inlineHighlightResult && inlineHighlightResult.inlineHighlightStrategy || 'none'),
            highlightStrategy,
        };
    }

    function revealGraphFocusPrimaryHighlight(container) {
        if (!container || typeof container.querySelector !== 'function') {
            return;
        }
        const firstInlineHighlight = container.querySelector('.agent-focus-inline-highlight');
        const firstBlockHighlight = container.querySelector('[data-agent-focus-highlight="true"]');
        const target = firstInlineHighlight && typeof firstInlineHighlight.closest === 'function'
            ? (firstInlineHighlight.closest('[data-agent-focus-highlight="true"]') || firstInlineHighlight)
            : (firstInlineHighlight || firstBlockHighlight);
        if (!target || typeof target.scrollIntoView !== 'function') {
            return;
        }
        target.setAttribute('data-agent-focus-primary-highlight', 'true');
        const reveal = function () {
            try {
                target.scrollIntoView({ block: 'center', inline: 'nearest' });
            } catch (_error) {
                target.scrollIntoView();
            }
        };
        if (window && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(reveal);
            return;
        }
        window.setTimeout(reveal, 0);
    }

    async function readGraphFocusMarkdownSource(previewRuntime, candidateSourcePaths, diagnostics) {
        const paths = Array.isArray(candidateSourcePaths) ? candidateSourcePaths : [];
        let lastError = null;
        for (const candidateSourcePath of paths) {
            if (diagnostics && !diagnostics.attemptedSourcePaths.includes(candidateSourcePath)) {
                diagnostics.attemptedSourcePaths.push(candidateSourcePath);
            }
            try {
                const markdownSource = await previewRuntime.storageProvider.readContent(candidateSourcePath);
                if (diagnostics) {
                    diagnostics.readSucceeded = true;
                    diagnostics.resolvedSourcePath = candidateSourcePath;
                    diagnostics.fallbackSourcePathUsed = !diagnostics.requestedSourcePath
                        || diagnostics.requestedSourcePath !== candidateSourcePath;
                }
                return {
                    markdownSource,
                    sourcePath: candidateSourcePath,
                };
            } catch (error) {
                lastError = error;
            }
        }
        if (diagnostics && lastError) {
            diagnostics.errorMessage = String(lastError && lastError.message || lastError || '').trim();
        }
        return null;
    }

    async function renderMarkdownPreviewIntoHost(renderedHost, candidateSourcePaths, matchedSpans, renderToken, diagnostics) {
        const previewRuntime = resolveMarkdownPreviewRuntime();
        const normalizedCandidateSourcePaths = Array.isArray(candidateSourcePaths)
            ? candidateSourcePaths
            : [candidateSourcePaths].map((value) => String(value || '').trim()).filter(Boolean);
        if (diagnostics) {
            diagnostics.markdownRuntimeAvailable = Boolean(
                previewRuntime
                && previewRuntime.markdownRuntime
                && typeof previewRuntime.markdownRuntime.renderMarkdownInto === 'function'
            );
            diagnostics.storageProviderAvailable = Boolean(
                previewRuntime
                && previewRuntime.storageProvider
                && typeof previewRuntime.storageProvider.readContent === 'function'
            );
        }
        if (!renderedHost || !previewRuntime || normalizedCandidateSourcePaths.length <= 0) {
            if (diagnostics && !diagnostics.failureReason) {
                diagnostics.failureReason = normalizedCandidateSourcePaths.length <= 0
                    ? 'missing_source_path'
                    : !diagnostics.markdownRuntimeAvailable
                        ? 'missing_markdown_runtime'
                        : !diagnostics.storageProviderAvailable
                            ? 'missing_storage_provider'
                            : 'missing_render_host';
            }
            return false;
        }

        try {
            const resolvedSource = await readGraphFocusMarkdownSource(previewRuntime, normalizedCandidateSourcePaths, diagnostics);
            if (!resolvedSource) {
                if (diagnostics && !diagnostics.failureReason) {
                    diagnostics.failureReason = diagnostics.attemptedSourcePaths.length > 0
                        ? 'source_read_failed'
                        : 'missing_source_path';
                }
                return false;
            }
            if (
                !renderedHost.isConnected
                || String(renderedHost.getAttribute('data-agent-preview-render-token') || '') !== String(renderToken)
            ) {
                return true;
            }
            const renderResult = await previewRuntime.markdownRuntime.renderMarkdownInto(
                renderedHost,
                String(resolvedSource.markdownSource || '')
            );
            if (diagnostics) {
                diagnostics.renderSucceeded = true;
                diagnostics.sourceProvenanceBlockCount = Number(
                    Number.isFinite(Number(renderResult && renderResult.sourceBlockCount))
                        ? Number(renderResult.sourceBlockCount)
                        : 0
                );
                diagnostics.sourceProvenanceAttributedNodeCount = Number(
                    Number.isFinite(Number(renderResult && renderResult.attributedNodeCount))
                        ? Number(renderResult.attributedNodeCount)
                        : 0
                );
            }
            if (
                !renderedHost.isConnected
                || String(renderedHost.getAttribute('data-agent-preview-render-token') || '') !== String(renderToken)
            ) {
                return true;
            }
            if (diagnostics) {
                const highlightResult = highlightGraphFocusRenderedMarkdown(
                    renderedHost,
                    matchedSpans,
                    resolvedSource.markdownSource
                );
                diagnostics.highlightedNodeCount = Number(highlightResult && highlightResult.highlightedNodeCount || 0);
                diagnostics.inlineHighlightCount = Number(highlightResult && highlightResult.inlineHighlightCount || 0);
                diagnostics.inlineHighlightStrategy = String(highlightResult && highlightResult.inlineHighlightStrategy || 'none');
                diagnostics.highlightStrategy = String(highlightResult && highlightResult.highlightStrategy || 'none');
            } else {
                highlightGraphFocusRenderedMarkdown(
                    renderedHost,
                    matchedSpans,
                    resolvedSource.markdownSource
                );
            }
            return true;
        } catch (error) {
            if (diagnostics && !diagnostics.failureReason) {
                diagnostics.failureReason = diagnostics.readSucceeded
                    ? 'markdown_render_failed'
                    : 'source_read_failed';
                diagnostics.errorMessage = String(error && error.message || error || '').trim();
            }
            return false;
        }
    }

    async function renderGraphFocusSourceMarkdown(body, payload, matchedSpans, renderToken, diagnostics) {
        const candidateSourcePaths = resolveGraphFocusCandidatePaths(payload, matchedSpans);
        if (!body || candidateSourcePaths.length <= 0) {
            if (diagnostics && !diagnostics.failureReason) {
                diagnostics.failureReason = !body ? 'missing_graph_focus_body' : 'missing_source_path';
            }
            return false;
        }

        body.innerHTML = buildGraphFocusRenderedHtml(payload, matchedSpans);
        const renderedHost = body.querySelector('[data-agent-focus-rendered-markdown="true"]');
        if (!renderedHost) {
            if (diagnostics && !diagnostics.failureReason) {
                diagnostics.failureReason = 'missing_render_host';
            }
            return false;
        }
        renderedHost.setAttribute('data-agent-preview-render-token', String(renderToken));
        const rendered = await renderMarkdownPreviewIntoHost(renderedHost, candidateSourcePaths, matchedSpans, renderToken, diagnostics);
        if (rendered && (renderToken !== state.graphFocusRenderToken || !state.panes['graph-focus'].open)) {
            return true;
        }
        return rendered;
    }

    async function renderGraphFocusBody(payload) {
        const body = getPaneBodyElement('graph-focus');
        if (!body) {
            return;
        }
        const matchedSpans = normalizeMatchedSpans(payload.matchedSpans);
        state.graphFocusRenderToken += 1;
        const renderToken = state.graphFocusRenderToken;
        const diagnostics = buildGraphFocusDiagnostics(payload, matchedSpans, renderToken);
        if (isHostedGraphFocusPayload(payload)) {
            const focusGraph = resolveGraphFocusHostedProjection(payload || {});
            const normalizedProjection = normalizeFocusModeProjection(focusGraph);
            const normalizedSnapshot = normalizedProjection || normalizeFocusModeSnapshot(focusGraph);
            if (normalizedSnapshot) {
                rememberHostedFocusAnchor(
                    normalizedSnapshot.anchorId,
                    normalizedSnapshot.anchorLabel || normalizedSnapshot.anchorId
                );
            }
            body.innerHTML = buildGraphFocusHostedModeHtml(payload, focusGraph);
            bindHostedGraphFocusMode(body, payload);
            setLastGraphFocusDiagnostics(null);
            return;
        }
        body.innerHTML = buildGraphFocusLoadingHtml(payload);
        const rendered = await renderGraphFocusSourceMarkdown(body, payload, matchedSpans, renderToken, diagnostics);
        if (rendered || renderToken !== state.graphFocusRenderToken || !state.panes['graph-focus'].open) {
            diagnostics.usedFallback = false;
            const diagnosticsHtml = buildGraphFocusDiagnosticsHtml(diagnostics);
            if (diagnosticsHtml && body.isConnected) {
                body.insertAdjacentHTML('beforeend', diagnosticsHtml);
            }
            setLastGraphFocusDiagnostics(diagnostics);
            publishGraphFocusDiagnostics(payload, diagnostics);
            return;
        }
        diagnostics.usedFallback = true;
        if (!diagnostics.failureReason) {
            diagnostics.failureReason = 'graph_focus_fallback';
        }
        body.innerHTML = buildGraphFocusFallbackHtml(payload, matchedSpans, diagnostics);
        setLastGraphFocusDiagnostics(diagnostics);
        publishGraphFocusDiagnostics(payload, diagnostics);
    }

    function resolveGraphNodeForHostedFocus(nodeId) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        const graphView = window.NoteConnectionGraphView;
        if (!normalizedNodeId || !graphView || typeof graphView.resolveNodeById !== 'function') {
            return null;
        }
        try {
            const node = graphView.resolveNodeById(normalizedNodeId);
            return node && typeof node === 'object' ? node : null;
        } catch (error) {
            console.warn('[AgentWorkspace] hosted focus node resolver failed:', error);
            return null;
        }
    }

    function resolveHostedFocusNodeLabel(nodeId, snapshot, node) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        const snapshotNode = snapshot && Array.isArray(snapshot.nodes)
            ? snapshot.nodes.find((candidate) => candidate.id === normalizedNodeId)
            : null;
        return normalizeKnowledgeGraphText(
            snapshotNode && snapshotNode.label
            || node && (node.label || node.title || node.name)
            || normalizedNodeId
        );
    }

    function collectHostedFocusNodeSourcePaths(node, payload, matchedSpans) {
        const paths = [];
        const seen = new Set();
        const appendPath = function (value) {
            const normalized = String(value || '').trim();
            if (!normalized || seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            paths.push(normalized);
        };
        const metadata = node && node.metadata && typeof node.metadata === 'object'
            ? node.metadata
            : {};
        [
            node && node.sourcePath,
            node && node.filepath,
            node && node.filePath,
            metadata.sourcePath,
            metadata.filepath,
            metadata.filePath,
        ].forEach(appendPath);
        normalizeMatchedSpans(matchedSpans).forEach((span) => {
            appendPath(span && span.sourcePath);
            const citation = span && typeof span.citation === 'object' ? span.citation : null;
            appendPath(citation && citation.sourcePath);
        });
        if (paths.length <= 0) {
            resolveGraphFocusCandidatePaths(payload || {}, normalizeMatchedSpans(matchedSpans)).forEach(appendPath);
        }
        return paths;
    }

    async function resolveHostedFocusNodeSourcePaths(nodeId, payload, matchedSpans) {
        const node = resolveGraphNodeForHostedFocus(nodeId);
        const paths = collectHostedFocusNodeSourcePaths(node, payload, matchedSpans);
        if (paths.length > 0) {
            return {
                node,
                paths,
            };
        }
        if (
            window.reader
            && typeof window.reader.resolveNodeTarget === 'function'
            && normalizeKnowledgeGraphText(nodeId)
        ) {
            try {
                const target = await window.reader.resolveNodeTarget(normalizeKnowledgeGraphText(nodeId), '');
                const resolvedPath = String(target && target.filePath || '').trim();
                if (resolvedPath) {
                    return {
                        node,
                        paths: [resolvedPath],
                    };
                }
            } catch (_error) {
                // The pane-local reader can still surface a deterministic empty state below.
            }
        }
        return {
            node,
            paths: [],
        };
    }

    function resolveHostedFocusMatchedSpans(payload, nodeId, nodeLabel) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId).toLowerCase();
        const normalizedNodeLabel = normalizeKnowledgeGraphText(nodeLabel).toLowerCase();
        const matchedSpans = normalizeMatchedSpans(payload && payload.matchedSpans);
        if (matchedSpans.length <= 0) {
            return [];
        }
        const payloadAnchorIds = [
            payload && payload.graphTargetId,
            payload && payload.graphNodeId,
            payload && payload.targetId,
            payload && payload.nodeId,
            payload && payload.atomId,
        ]
            .map((value) => normalizeKnowledgeGraphText(value).toLowerCase())
            .filter(Boolean);
        if (payloadAnchorIds.includes(normalizedNodeId)) {
            return matchedSpans;
        }
        return matchedSpans.filter((span) => {
            const citation = span && typeof span.citation === 'object' ? span.citation : null;
            const candidates = [
                span && span.atomId,
                span && span.title,
                citation && citation.atomId,
                citation && citation.title,
            ]
                .map((value) => normalizeKnowledgeGraphText(value).toLowerCase())
                .filter(Boolean);
            return candidates.includes(normalizedNodeId)
                || (normalizedNodeLabel && candidates.includes(normalizedNodeLabel));
        });
    }

    function resolvePaneLocalNodeReaderConfig(paneKey) {
        if (paneKey === 'graph-focus') {
            return {
                readerAttribute: 'data-agent-focus-pane-reader',
                titleAttribute: 'data-agent-focus-pane-reader-title',
                bodyAttribute: 'data-agent-focus-pane-reader-body',
                closeAttribute: 'data-agent-focus-pane-reader-close',
                tokenKey: 'graphFocusReaderRenderToken',
            };
        }
        if (paneKey === 'learning-path') {
            return {
                readerAttribute: 'data-agent-learning-path-pane-reader',
                titleAttribute: 'data-agent-learning-path-pane-reader-title',
                bodyAttribute: 'data-agent-learning-path-pane-reader-body',
                closeAttribute: 'data-agent-learning-path-pane-reader-close',
                tokenKey: 'learningPathReaderRenderToken',
            };
        }
        return null;
    }

    async function openPaneLocalNodeReader(paneKey, payload, nodeId) {
        const readerConfig = resolvePaneLocalNodeReaderConfig(paneKey);
        const body = getPaneBodyElement(paneKey);
        const readerShell = body && readerConfig ? body.querySelector(`[${readerConfig.readerAttribute}="true"]`) : null;
        const readerTitle = readerShell && readerConfig ? readerShell.querySelector(`[${readerConfig.titleAttribute}="true"]`) : null;
        const readerBody = readerShell && readerConfig ? readerShell.querySelector(`[${readerConfig.bodyAttribute}="true"]`) : null;
        if (!readerShell || !readerBody) {
            return false;
        }
        const snapshot = paneKey === 'graph-focus'
            ? resolveGraphFocusHostedProjection(payload || {})
            : state.godotFuturePath.projection && state.godotFuturePath.projection.treeLayout
                ? { nodes: state.godotFuturePath.projection.treeLayout.nodes || [] }
                : null;
        const node = resolveGraphNodeForHostedFocus(nodeId);
        const nodeLabel = resolveHostedFocusNodeLabel(nodeId, snapshot, node);
        const matchedSpans = resolveHostedFocusMatchedSpans(payload || {}, nodeId, nodeLabel);
        state[readerConfig.tokenKey] += 1;
        const renderToken = state[readerConfig.tokenKey];
        if (readerTitle) {
            readerTitle.textContent = nodeLabel || normalizeKnowledgeGraphText(nodeId);
        }
        readerShell.hidden = false;
        readerBody.innerHTML = `
            <div
                class="agent-focus-pane-reader-markdown"
                data-agent-focus-pane-reader-markdown="true"
                data-agent-preview-render-token="${String(renderToken)}"
            >
                ${escapeHtml(translate('reader_loading', 'Loading reader content...'))}
            </div>
        `;
        const renderedHost = readerBody.querySelector('[data-agent-focus-pane-reader-markdown="true"]');
        const resolved = await resolveHostedFocusNodeSourcePaths(nodeId, payload || {}, matchedSpans);
        if (renderToken !== state[readerConfig.tokenKey] || !state.panes[paneKey].open) {
            return true;
        }
        if (!resolved.paths.length) {
            readerBody.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.knowledge.previewUnavailable', 'Source preview unavailable.'))}</div>`;
            return false;
        }
        const rendered = await renderMarkdownPreviewIntoHost(renderedHost, resolved.paths, matchedSpans, renderToken);
        if (!rendered && renderToken === state[readerConfig.tokenKey] && state.panes[paneKey].open) {
            readerBody.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.knowledge.previewUnavailable', 'Source preview unavailable.'))}</div>`;
        }
        return rendered;
    }

    function openHostedFocusPaneReader(payload, nodeId) {
        return openPaneLocalNodeReader('graph-focus', payload, nodeId);
    }

    function openHostedLearningPathPaneReader(payload, nodeId) {
        return openPaneLocalNodeReader('learning-path', payload, nodeId);
    }

    function switchHostedFocusNode(payload, nodeId) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        if (!normalizedNodeId) {
            return false;
        }
        const focusGraph = resolveFocusModeProjection(normalizedNodeId);
        const node = resolveGraphNodeForHostedFocus(normalizedNodeId);
        const nodeLabel = resolveHostedFocusNodeLabel(normalizedNodeId, focusGraph, node);
        const nextPayload = {
            ...(payload || {}),
            atomId: normalizedNodeId,
            nodeId: normalizedNodeId,
            targetId: normalizedNodeId,
            graphTargetId: normalizedNodeId,
            graphNodeId: normalizedNodeId,
            graphTargetLabel: nodeLabel || normalizedNodeId,
            title: nodeLabel || normalizedNodeId,
            focusModeSnapshot: normalizeFocusModeProjection(focusGraph) ? null : focusGraph,
            focusModeProjection: normalizeFocusModeProjection(focusGraph) ? focusGraph : null,
            presentationMode: 'focus-mode',
        };
        state.panes['graph-focus'].payload = nextPayload;
        renderGraphFocusBody(nextPayload);
        return true;
    }

    function recordHostedFocusModeAction(action) {
        const normalizedAction = action && typeof action === 'object' ? action : {};
        window.__NC_LAST_AGENT_FOCUS_MODE_ACTION = {
            action: normalizeKnowledgeGraphText(normalizedAction.action) || 'noop',
            clickedNodeId: normalizeKnowledgeGraphText(normalizedAction.clickedNodeId),
            currentAnchorId: normalizeKnowledgeGraphText(normalizedAction.currentAnchorId),
            host: 'agent-workspace',
        };
    }

    function publishHostedFocusViewportState(viewport) {
        window.__NC_LAST_AGENT_FOCUS_VIEWPORT_STATE = {
            anchorId: normalizeKnowledgeGraphText(
                viewport && viewport.closest('[data-agent-hosted-focus-anchor-id]')
                    ? viewport.closest('[data-agent-hosted-focus-anchor-id]').getAttribute('data-agent-hosted-focus-anchor-id')
                    : ''
            ),
            zoom: Number(viewport && viewport.getAttribute('data-agent-focus-zoom')) || 1,
            panX: Number(viewport && viewport.getAttribute('data-agent-focus-pan-x')) || 0,
            panY: Number(viewport && viewport.getAttribute('data-agent-focus-pan-y')) || 0,
        };
    }

    function bindHostedGraphFocusViewport(body, payload) {
        const viewport = body && body.querySelector('[data-agent-focus-viewport="true"]');
        const transformTarget = viewport && viewport.querySelector('[data-agent-focus-transform-target="true"]');
        if (!viewport || !transformTarget) {
            return;
        }
        const readTransform = function () {
            return {
                zoom: Number(viewport.getAttribute('data-agent-focus-zoom')) || 1,
                panX: Number(viewport.getAttribute('data-agent-focus-pan-x')) || 0,
                panY: Number(viewport.getAttribute('data-agent-focus-pan-y')) || 0,
            };
        };
        const applyTransform = function (nextTransform) {
            const zoom = Math.min(4, Math.max(0.35, Number(nextTransform.zoom) || 1));
            const panX = Number.isFinite(Number(nextTransform.panX)) ? Number(nextTransform.panX) : 0;
            const panY = Number.isFinite(Number(nextTransform.panY)) ? Number(nextTransform.panY) : 0;
            viewport.setAttribute('data-agent-focus-zoom', String(Number(zoom.toFixed(3))));
            viewport.setAttribute('data-agent-focus-pan-x', String(Number(panX.toFixed(1))));
            viewport.setAttribute('data-agent-focus-pan-y', String(Number(panY.toFixed(1))));
            transformTarget.style.setProperty('--agent-focus-zoom', String(Number(zoom.toFixed(3))));
            transformTarget.style.setProperty('--agent-focus-pan-x', `${Number(panX.toFixed(1))}px`);
            transformTarget.style.setProperty('--agent-focus-pan-y', `${Number(panY.toFixed(1))}px`);
            publishHostedFocusViewportState(viewport);
        };
        const resetTransform = function () {
            applyTransform({ zoom: 1, panX: 0, panY: 0 });
        };
        resetTransform();

        viewport.addEventListener('wheel', function (event) {
            event.preventDefault();
            const current = readTransform();
            const factor = event.deltaY < 0 ? 1.12 : 0.88;
            const nextZoom = Math.min(4, Math.max(0.35, current.zoom * factor));
            const rect = viewport.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;
            const worldX = (localX - current.panX) / current.zoom;
            const worldY = (localY - current.panY) / current.zoom;
            applyTransform({
                zoom: nextZoom,
                panX: localX - (worldX * nextZoom),
                panY: localY - (worldY * nextZoom),
            });
        }, { passive: false });

        let panState = null;
        const finishPan = function () {
            if (!panState) {
                return;
            }
            panState = null;
            viewport.classList.remove('is-panning');
            document.removeEventListener('mousemove', movePan, true);
            document.removeEventListener('mouseup', finishPan, true);
        };
        const movePan = function (event) {
            if (!panState) {
                return;
            }
            applyTransform({
                zoom: panState.zoom,
                panX: panState.panX + (event.clientX - panState.clientX),
                panY: panState.panY + (event.clientY - panState.clientY),
            });
        };
        viewport.addEventListener('mousedown', function (event) {
            if (
                event.button !== 0
                || (
                    event.target
                    && typeof event.target.closest === 'function'
                    && event.target.closest('[data-agent-focus-mode-node-id], [data-agent-focus-pane-controls="true"], [data-agent-focus-history-menu="true"]')
                )
            ) {
                return;
            }
            event.preventDefault();
            const current = readTransform();
            panState = {
                clientX: event.clientX,
                clientY: event.clientY,
                panX: current.panX,
                panY: current.panY,
                zoom: current.zoom,
            };
            viewport.classList.add('is-panning');
            document.addEventListener('mousemove', movePan, true);
            document.addEventListener('mouseup', finishPan, true);
        });

        const resetButton = body.querySelector('[data-agent-focus-control="reset"]');
        if (resetButton) {
            resetButton.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                resetTransform();
            });
        }

        const historyButton = body.querySelector('[data-agent-focus-control="history"]');
        const historyMenu = body.querySelector('[data-agent-focus-history-menu="true"]');
        if (historyButton && historyMenu) {
            historyButton.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                const nextOpen = historyMenu.hidden === true;
                historyMenu.hidden = !nextOpen;
                historyButton.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
            });
            historyMenu.querySelectorAll('[data-agent-focus-history-item="true"]').forEach((itemButton) => {
                itemButton.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const nodeId = normalizeKnowledgeGraphText(itemButton.getAttribute('data-agent-focus-history-node-id'));
                    historyMenu.hidden = true;
                    historyButton.setAttribute('aria-expanded', 'false');
                    if (nodeId) {
                        switchHostedFocusNode(payload || {}, nodeId);
                    }
                });
            });
            document.addEventListener('click', function (event) {
                if (
                    historyMenu.hidden
                    || (
                        event.target
                        && typeof event.target.closest === 'function'
                        && event.target.closest('[data-agent-focus-control="history"], [data-agent-focus-history-menu="true"]')
                    )
                ) {
                    return;
                }
                historyMenu.hidden = true;
                historyButton.setAttribute('aria-expanded', 'false');
            }, { once: true });
        }
    }

    function bindPaneLocalNodeReaderClose(body, paneKey) {
        const readerConfig = resolvePaneLocalNodeReaderConfig(paneKey);
        const readerCloseButton = body && readerConfig ? body.querySelector(`[${readerConfig.closeAttribute}="true"]`) : null;
        const readerShell = body && readerConfig ? body.querySelector(`[${readerConfig.readerAttribute}="true"]`) : null;
        if (readerCloseButton && readerShell) {
            readerCloseButton.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                readerShell.hidden = true;
            });
        }
    }

    function bindHostedGraphFocusMode(body, payload) {
        if (!body) {
            return;
        }
        bindHostedGraphFocusViewport(body, payload || {});
        bindPaneLocalNodeReaderClose(body, 'graph-focus');
        const focusModeHost = body.querySelector('[data-agent-hosted-focus-mode="true"]');
        const currentAnchorId = normalizeKnowledgeGraphText(
            focusModeHost && focusModeHost.getAttribute('data-agent-hosted-focus-anchor-id')
        ) || resolveGraphFocusHostedTargetId(payload || {});
        body.querySelectorAll('[data-agent-focus-mode-node-id]').forEach((nodeButton) => {
            nodeButton.addEventListener('click', function (event) {
                event.stopPropagation();
            });
            nodeButton.addEventListener('dblclick', function (event) {
                event.preventDefault();
                event.stopPropagation();
                const nodeId = normalizeKnowledgeGraphText(nodeButton.getAttribute('data-agent-focus-mode-node-id'));
                if (!nodeId) {
                    return;
                }
                const focusInteractions = window.NoteConnectionFocusModeInteractions;
                const action = focusInteractions && typeof focusInteractions.resolveDoubleClickAction === 'function'
                    ? focusInteractions.resolveDoubleClickAction({
                        currentAnchorId,
                        clickedNodeId: nodeId,
                    })
                    : {
                        action: nodeButton.getAttribute('data-agent-focus-mode-anchor') === 'true'
                            ? 'open-reader'
                            : 'switch-focus',
                        clickedNodeId: nodeId,
                        currentAnchorId,
                    };
                recordHostedFocusModeAction(action);
                if (action.action === 'open-reader') {
                    void openHostedFocusPaneReader(payload || {}, nodeId);
                    return;
                }
                if (action.action === 'switch-focus') {
                    switchHostedFocusNode(payload || {}, nodeId);
                }
            });
        });
    }

    function resolveKnowledgePointSourcePath(item) {
        return collectKnowledgePointCandidateSourcePaths(item)[0] || '';
    }

    function resolveKnowledgePointFileName(item) {
        const sourcePath = resolveKnowledgePointSourcePath(item);
        if (sourcePath) {
            const normalized = sourcePath.replace(/\\/g, '/');
            return normalized.split('/').filter(Boolean).pop() || normalized;
        }
        return String(item && (item.title || item.atomId) || '').trim()
            || translate('agentWorkspace.knowledge.untitled', 'Untitled knowledge point');
    }

    function resolveKnowledgePointActionAtomId(item) {
        const candidates = [];
        const appendCandidate = function (value) {
            const normalized = String(value || '').trim();
            if (normalized) {
                candidates.push(normalized);
            }
        };
        appendCandidate(item && item.atomId);
        if (Array.isArray(item && item.atomIds)) {
            item.atomIds.forEach(appendCandidate);
        }
        const citation = item && typeof item.citation === 'object' ? item.citation : null;
        appendCandidate(citation && citation.atomId);
        if (Array.isArray(item && item.citations)) {
            item.citations.forEach((entry) => {
                appendCandidate(entry && entry.atomId);
            });
        }
        if (Array.isArray(item && item.matchedSpans)) {
            item.matchedSpans.forEach((span) => {
                appendCandidate(span && span.atomId);
            });
        }
        appendCandidate(item && item.documentId);
        return candidates[0] || '';
    }

    function findKnowledgePointCapabilityByActionId(item, actionId) {
        const normalizedActionId = String(actionId || '').trim();
        if (!normalizedActionId) {
            return null;
        }
        const capabilities = resolveCapabilities(item);
        return capabilities.find((capability) => (
            String(capability && capability.actionId || '').trim() === normalizedActionId
        )) || null;
    }

    function buildKnowledgePointLearningPathCapability(item) {
        const existingCapability = findKnowledgePointCapabilityByActionId(item, 'open_learning_path');
        const atomId = resolveKnowledgePointActionAtomId(item);
        if (!atomId) {
            return null;
        }
        const defaultCapability = {
            capabilityId: `cap_learning_path_${atomId}`,
            actionId: 'open_learning_path',
            targetAtomId: atomId,
            label: translate('agentWorkspace.knowledge.learningPathAction', 'Learning Path'),
            labelKey: 'agentWorkspace.knowledge.learningPathAction',
            request: {
                focusAtomIds: [atomId],
                maxMasteryPaths: 4,
                maxDivergencePaths: 2,
                recommendedActionLimit: 8,
            },
            execution: {
                kind: 'knowledge_operation',
                operationId: 'build_learning_path',
                resultPresentation: 'learning_path_pane',
            },
        };
        if (!existingCapability) {
            return defaultCapability;
        }
        const existingExecution = existingCapability.execution && typeof existingCapability.execution === 'object'
            ? existingCapability.execution
            : null;
        return {
            ...defaultCapability,
            ...existingCapability,
            targetAtomId: String(existingCapability.targetAtomId || '').trim() || atomId,
            request: existingCapability.request && typeof existingCapability.request === 'object'
                ? existingCapability.request
                : defaultCapability.request,
            execution: existingExecution && String(existingExecution.kind || '').trim()
                ? existingExecution
                : defaultCapability.execution,
        };
    }

    function invokeKnowledgePointCapability(item, capability, handlers) {
        if (!capability || !handlers || typeof handlers.onCapability !== 'function') {
            return false;
        }
        try {
            const result = handlers.onCapability(item, capability);
            if (result && typeof result.catch === 'function') {
                result.catch((error) => {
                    console.error('[AgentWorkspace] knowledge point action failed:', error);
                });
            }
            return true;
        } catch (error) {
            console.error('[AgentWorkspace] knowledge point action failed:', error);
            return false;
        }
    }

    function openRelatedFocusForKnowledgePoint(item) {
        ensureWorkspaceVisible();
        const graphTarget = resolveKnowledgePointGraphTarget(item, null, {
            includeFocusModeSnapshot: isDeveloperModeEnabled(),
        });
        const payload = buildKnowledgePointFocusPayload(item, graphTarget);
        payload.presentationMode = 'focus-mode';
        if (!payload.focusModeSnapshot && isDeveloperModeEnabled()) {
            payload.focusModeSnapshot = resolveFocusModeSnapshot(graphTarget.graphNodeId);
        }
        api.openGraphFocusPane(payload);
    }

    function openLearningPathForKnowledgePoint(item, handlers) {
        ensureWorkspaceVisible();
        const graphTarget = resolveKnowledgePointGraphTarget(item);
        const capability = buildKnowledgePointLearningPathCapability(item);
        if (invokeKnowledgePointCapability(item, capability, handlers)) {
            return;
        }
        const atomId = resolveKnowledgePointActionAtomId(item);
        const title = String(item && item.title || resolveKnowledgePointFileName(item)).trim();
        api.openLearningPathPane({
            atomId,
            graphTargetId: graphTarget.graphNodeId,
            targetIds: graphTarget.graphNodeId ? [graphTarget.graphNodeId] : [atomId].filter(Boolean),
            graphTargetLabel: graphTarget.graphNodeLabel,
            title: title || atomId || translate('agentWorkspace.learningPath.title', 'Learning Path'),
            sourcePath: resolveKnowledgePointSourcePath(item),
            items: atomId ? [{ atomId, title: title || atomId }] : [],
            relationPath: Array.isArray(item && item.relationPath)
                ? item.relationPath.map((edge) => ({ ...edge }))
                : [],
            relationKinds: Array.isArray(item && item.relationKinds)
                ? item.relationKinds.map((kind) => String(kind || '').trim()).filter(Boolean)
                : [],
            nodeLabels: buildKnowledgePointNodeLabels(item, graphTarget),
        });
    }

    function createKnowledgePointGraphActionButton(actionKind, capabilityActionId, label, ariaLabel, disabled, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'agent-knowledge-action-button';
        button.textContent = label;
        button.disabled = disabled === true;
        button.setAttribute('data-agent-knowledge-action', actionKind);
        button.setAttribute('data-capability-action-id', capabilityActionId);
        button.setAttribute('aria-label', ariaLabel);
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (button.disabled) {
                return;
            }
            onClick();
        });
        return button;
    }

    function buildKnowledgePointGraphActionSpecs(item, handlers, fileName, actionAtomId) {
        return [
            {
                actionKind: 'learning-path',
                capabilityActionId: 'open_learning_path',
                label: translate('agentWorkspace.knowledge.learningPathAction', 'Learning Path'),
                ariaLabel: translate('agentWorkspace.knowledge.learningPathActionLabel', 'Show learning path for {file}', {
                    file: fileName,
                }),
                disabled: !actionAtomId,
                run: () => openLearningPathForKnowledgePoint(item, handlers),
            },
            {
                actionKind: 'related-focus',
                capabilityActionId: 'open_focus_mode',
                label: translate('agentWorkspace.knowledge.relatedFocusAction', 'Focus'),
                ariaLabel: translate('agentWorkspace.knowledge.relatedFocusActionLabel', 'Show focus for {file}', {
                    file: fileName,
                }),
                disabled: false,
                run: () => openRelatedFocusForKnowledgePoint(item),
            },
        ];
    }

    function createKnowledgePointGraphActionButtonFromSpec(spec) {
        return createKnowledgePointGraphActionButton(
            spec.actionKind,
            spec.capabilityActionId,
            spec.label,
            spec.ariaLabel,
            spec.disabled,
            spec.run
        );
    }

    function createKnowledgePointActionStrip(actionSpecs) {
        const actions = document.createElement('div');
        actions.className = 'agent-knowledge-actions';
        actions.setAttribute('data-agent-knowledge-actions', 'true');
        actionSpecs.forEach((spec) => {
            actions.appendChild(createKnowledgePointGraphActionButtonFromSpec(spec));
        });
        return actions;
    }

    function syncKnowledgePointActionMenuExpanded(fileButton, menuButton, expanded) {
        const expandedValue = expanded ? 'true' : 'false';
        if (fileButton) {
            fileButton.setAttribute('aria-expanded', expandedValue);
        }
        if (menuButton) {
            menuButton.setAttribute('aria-expanded', expandedValue);
        }
    }

    function closeKnowledgePointActionMenu(fileButton, menu, menuButton) {
        if (!menu) {
            return;
        }
        menu.hidden = true;
        syncKnowledgePointActionMenuExpanded(fileButton, menuButton, false);
    }

    function openKnowledgePointActionMenu(fileButton, menu, menuButton) {
        if (!menu) {
            return;
        }
        menu.hidden = false;
        syncKnowledgePointActionMenuExpanded(fileButton, menuButton, true);
        const firstAction = menu.querySelector('button:not(:disabled)');
        if (firstAction && typeof firstAction.focus === 'function') {
            firstAction.focus();
        }
    }

    function closeSiblingKnowledgePointActionMenus(activeMenu) {
        document.querySelectorAll('[data-agent-knowledge-action-menu="true"]').forEach((menu) => {
            if (menu === activeMenu) {
                return;
            }
            const ownerId = menu.getAttribute('aria-labelledby');
            const owner = ownerId ? document.getElementById(ownerId) : null;
            const menuButtonId = menu.getAttribute('data-agent-knowledge-menu-button-id');
            const menuButton = menuButtonId ? document.getElementById(menuButtonId) : null;
            closeKnowledgePointActionMenu(owner, menu, menuButton);
        });
    }

    function markKnowledgePointCardSelected(card) {
        document.querySelectorAll('[data-agent-knowledge-card="true"][data-selected="true"]').forEach((node) => {
            if (node !== card) {
                node.setAttribute('data-selected', 'false');
            }
        });
        if (card) {
            card.setAttribute('data-selected', 'true');
        }
    }

    function bindKnowledgePointActionMenu(card, fileButton, menu, menuButton) {
        let longPressTimer = null;
        let suppressNextClick = false;
        const clearLongPressTimer = function () {
            if (longPressTimer !== null) {
                window.clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        const openMenu = function () {
            clearLongPressTimer();
            closeSiblingKnowledgePointActionMenus(menu);
            markKnowledgePointCardSelected(card);
            openKnowledgePointActionMenu(fileButton, menu, menuButton);
        };
        const closeMenu = function () {
            closeKnowledgePointActionMenu(fileButton, menu, menuButton);
        };

        fileButton.addEventListener('pointerdown', function (event) {
            clearLongPressTimer();
            if (event.button !== undefined && event.button !== 0) {
                return;
            }
            longPressTimer = window.setTimeout(function () {
                suppressNextClick = true;
                openMenu();
            }, 520);
        });
        fileButton.addEventListener('pointerup', clearLongPressTimer);
        fileButton.addEventListener('pointerleave', clearLongPressTimer);
        fileButton.addEventListener('pointercancel', clearLongPressTimer);
        fileButton.addEventListener('contextmenu', function (event) {
            event.preventDefault();
            event.stopPropagation();
            suppressNextClick = true;
            openMenu();
        });
        fileButton.addEventListener('keydown', function (event) {
            if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu' || event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                openMenu();
            }
        });
        fileButton.addEventListener('click', function (event) {
            if (!suppressNextClick) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            suppressNextClick = false;
        }, true);
        if (menuButton) {
            menuButton.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (menu.hidden) {
                    openMenu();
                    return;
                }
                closeMenu();
            });
            menuButton.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    event.stopPropagation();
                    openMenu();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeMenu();
                }
            });
        }
        menu.addEventListener('click', function (event) {
            const target = event.target;
            const button = target && typeof target.closest === 'function'
                ? target.closest('button')
                : null;
            if (button && button.disabled !== true) {
                closeMenu();
            }
        }, true);
        menu.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu();
                fileButton.focus();
            }
        });
        document.addEventListener('click', function (event) {
            if (menu.hidden || card.contains(event.target)) {
                return;
            }
            closeMenu();
        });
    }

    function createKnowledgePointActionMenuButton(fileName) {
        const button = document.createElement('button');
        const label = translate('agentWorkspace.knowledge.actionsMenuButtonLabel', 'Open knowledge point actions for {file}', {
            file: fileName,
        });
        button.type = 'button';
        button.className = 'agent-knowledge-menu-button';
        button.textContent = '...';
        button.setAttribute('data-agent-knowledge-menu-button', 'true');
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', label);
        button.title = label;
        return button;
    }

    function createKnowledgePointActionMenu(actionSpecs) {
        const menu = document.createElement('div');
        menu.className = 'agent-knowledge-action-menu';
        menu.setAttribute('data-agent-knowledge-action-menu', 'true');
        menu.setAttribute('role', 'menu');
        menu.setAttribute(
            'aria-label',
            translate('agentWorkspace.knowledge.actionsMenu', 'Knowledge point actions')
        );
        menu.hidden = true;
        actionSpecs.forEach((spec) => {
            menu.appendChild(createKnowledgePointGraphActionButtonFromSpec(spec));
        });
        menu.querySelectorAll('button').forEach((button) => {
            button.setAttribute('role', 'menuitem');
        });
        return menu;
    }

    function dismissActiveKnowledgeHelp() {
        if (typeof state.knowledgePoints.activeHelpDismiss === 'function') {
            state.knowledgePoints.activeHelpDismiss();
        }
        state.knowledgePoints.activeHelpDismiss = null;
    }

    function createKnowledgePointHelpControl() {
        const root = document.createElement('div');
        root.className = 'agent-knowledge-help';
        root.setAttribute('data-agent-knowledge-help', 'true');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'agent-knowledge-help-button';
        button.textContent = '?';
        button.setAttribute('data-agent-knowledge-help-button', 'true');
        button.setAttribute(
            'aria-label',
            translate('agentWorkspace.knowledge.helpLabel', 'Knowledge hit help')
        );
        button.setAttribute('aria-expanded', 'false');

        state.knowledgePoints.helpIdCounter += 1;
        const popover = document.createElement('div');
        const popoverId = `agent-knowledge-help-popover-${state.knowledgePoints.helpIdCounter}`;
        popover.id = popoverId;
        popover.className = 'agent-knowledge-help-popover';
        popover.setAttribute('data-agent-knowledge-help-popover', 'true');
        popover.setAttribute('role', 'tooltip');
        popover.hidden = true;
        const helpText = translate(
            'agentWorkspace.knowledge.clickHint',
            'Left-click a matched file to open the source with highlighted evidence. Use Learning Path or Focus for graph-guided follow-up actions.'
        );
        button.setAttribute('aria-describedby', popoverId);

        let open = false;
        let documentClickHandler = null;
        let documentKeyHandler = null;

        const removeDocumentHandlers = function () {
            if (documentClickHandler) {
                document.removeEventListener('click', documentClickHandler, true);
                documentClickHandler = null;
            }
            if (documentKeyHandler) {
                document.removeEventListener('keydown', documentKeyHandler, true);
                documentKeyHandler = null;
            }
        };

        const hide = function () {
            open = false;
            popover.hidden = true;
            popover.textContent = '';
            root.setAttribute('data-open', 'false');
            button.setAttribute('aria-expanded', 'false');
            removeDocumentHandlers();
            if (state.knowledgePoints.activeHelpDismiss === hide) {
                state.knowledgePoints.activeHelpDismiss = null;
            }
        };

        const show = function () {
            if (open) {
                return;
            }
            dismissActiveKnowledgeHelp();
            open = true;
            popover.textContent = helpText;
            popover.hidden = false;
            root.setAttribute('data-open', 'true');
            button.setAttribute('aria-expanded', 'true');
            documentClickHandler = function (event) {
                if (root.contains(event.target)) {
                    return;
                }
                hide();
            };
            documentKeyHandler = function (event) {
                if (event.key === 'Escape') {
                    hide();
                }
            };
            document.addEventListener('click', documentClickHandler, true);
            document.addEventListener('keydown', documentKeyHandler, true);
            state.knowledgePoints.activeHelpDismiss = hide;
        };

        let pointerFocusPending = false;
        button.addEventListener('pointerdown', function () {
            pointerFocusPending = true;
        });
        button.addEventListener('pointercancel', function () {
            pointerFocusPending = false;
        });
        button.addEventListener('focus', function () {
            if (pointerFocusPending) {
                pointerFocusPending = false;
                return;
            }
            show();
        });
        button.addEventListener('blur', function (event) {
            const relatedTarget = event.relatedTarget;
            if (!relatedTarget || !root.contains(relatedTarget)) {
                hide();
            }
        });
        button.addEventListener('mouseenter', show);
        root.addEventListener('mouseleave', hide);
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            pointerFocusPending = false;
            if (open) {
                hide();
                return;
            }
            show();
        });

        root.appendChild(button);
        root.appendChild(popover);
        return root;
    }

    function createKnowledgePointListHeader() {
        const header = document.createElement('div');
        header.className = 'agent-knowledge-list-header';
        header.setAttribute('data-agent-knowledge-list-header', 'true');

        const title = document.createElement('div');
        title.className = 'agent-knowledge-list-title';
        title.textContent = translate('agentWorkspace.knowledge.hitFilesTitle', 'Matched files');

        header.appendChild(title);
        header.appendChild(createKnowledgePointHelpControl());
        return header;
    }

    function buildKnowledgePointFocusPayload(item, resolvedGraphTarget) {
        const graphTarget = resolvedGraphTarget || resolveKnowledgePointGraphTarget(item);
        const matchedSpans = buildKnowledgePointMatchedSpans(item);
        const candidateSourcePaths = collectKnowledgePointCandidateSourcePaths(item, matchedSpans);
        const atomIds = Array.isArray(item && item.atomIds) && item.atomIds.length > 0
            ? item.atomIds
            : [item && item.atomId].filter(Boolean);
        const nodeLabels = buildKnowledgePointNodeLabels(item, graphTarget);
        return {
            atomId: String(atomIds[0] || item && item.documentId || '').trim(),
            nodeId: String(item && item.documentId || atomIds[0] || '').trim(),
            graphTargetId: graphTarget.graphNodeId,
            graphTargetLabel: graphTarget.graphNodeLabel,
            focusModeSnapshot: graphTarget.focusModeSnapshot || null,
            title: String(item && item.title || resolveKnowledgePointFileName(item)).trim(),
            summary: String(item && (item.summary || item.evidenceSnippet) || '').trim(),
            sourcePath: candidateSourcePaths[0] || '',
            candidateSourcePaths,
            matchedSpans,
            nodeLabels,
            relationPath: Array.isArray(item && item.relationPath)
                ? item.relationPath.map((edge) => ({ ...edge }))
                : [],
            relationPathAtomIds: Array.isArray(item && item.relationPathAtomIds)
                ? item.relationPathAtomIds.map((atomId) => String(atomId || '').trim()).filter(Boolean)
                : [],
            relationKinds: Array.isArray(item && item.relationKinds)
                ? item.relationKinds.map((kind) => String(kind || '').trim()).filter(Boolean)
                : [],
        };
    }

    function buildKnowledgeRunClaimFocusPayload(claim, summary) {
        const sourcePath = String(claim && claim.sourcePath || '').trim();
        const snippet = String(claim && claim.snippet || '').trim();
        return {
            atomId: String(claim && claim.atomId || summary && summary.runId || '').trim(),
            nodeId: String(claim && claim.atomId || summary && summary.runId || '').trim(),
            title: String(claim && claim.title || summary && summary.artifactTitle || summary && summary.runId || '').trim(),
            summary: String(claim && claim.reason || snippet || '').trim(),
            sourcePath,
            matchedSpans: sourcePath
                ? [
                    {
                        atomId: String(claim && claim.atomId || '').trim(),
                        title: String(claim && claim.title || '').trim(),
                        snippet,
                        sourcePath,
                        startLine: Number.isFinite(Number(claim && claim.startLine)) ? Number(claim.startLine) : undefined,
                        endLine: Number.isFinite(Number(claim && claim.endLine)) ? Number(claim.endLine) : undefined,
                    },
                ]
                : [],
        };
    }

    function resolveLearningPathTitle(payload) {
        return String(
            payload && (
                payload.graphTargetLabel
                || payload.title
                || payload.atomId
            )
            || translate('agentWorkspace.learningPath.title', 'Learning Path')
        ).trim();
    }

    function resolveLearningPathItemLabel(payload, item) {
        const nodeLabels = payload && payload.nodeLabels && typeof payload.nodeLabels === 'object'
            ? payload.nodeLabels
            : {};
        const itemId = normalizeKnowledgeGraphText(item && (item.atomId || item.id || item.nodeId));
        return normalizeKnowledgeGraphText(
            itemId && nodeLabels[itemId]
            || item && (item.title || item.label || item.name)
            || itemId
        );
    }

    function buildLearningPathDeveloperDetailsHtml(payload) {
        if (!isDeveloperModeEnabled()) {
            return '';
        }
        const items = Array.isArray(payload && payload.items) ? payload.items : [];
        const listHtml = items.length > 0
            ? items.map((item, index) => `
                <li class="agent-pane-list-item">
                    <span class="agent-pane-list-index">${index + 1}</span>
                    <span class="agent-pane-list-label">${escapeHtml(resolveLearningPathItemLabel(payload, item) || translate('agentWorkspace.reply.knowledgeRunNone', 'none'))}</span>
                </li>
            `).join('')
            : `<li class="agent-pane-list-empty">${escapeHtml(translate('agentWorkspace.learningPath.emptyLoaded', 'No learning path loaded yet.'))}</li>`;
        const runtimeDiagnostics = state.godotFuturePath.runtimeDiagnostics && typeof state.godotFuturePath.runtimeDiagnostics === 'object'
            ? state.godotFuturePath.runtimeDiagnostics
            : null;
        const runtimeDetailsHtml = runtimeDiagnostics
            ? `
                <ul class="agent-pane-list">
                    <li class="agent-pane-list-item">
                        <span class="agent-pane-list-index">R</span>
                        <span class="agent-pane-list-label">${escapeHtml(translate('agentWorkspace.learningPath.runtimeCacheState', 'Runtime cache state'))}: ${escapeHtml(String(runtimeDiagnostics.cacheState || 'none'))}</span>
                    </li>
                    <li class="agent-pane-list-item">
                        <span class="agent-pane-list-index">R</span>
                        <span class="agent-pane-list-label">${escapeHtml(translate('agentWorkspace.learningPath.runtimeCacheCounts', 'Cache hits / misses / builds'))}: ${escapeHtml(`${String(runtimeDiagnostics.cacheHitCount == null ? 0 : runtimeDiagnostics.cacheHitCount)} / ${String(runtimeDiagnostics.cacheMissCount == null ? 0 : runtimeDiagnostics.cacheMissCount)} / ${String(runtimeDiagnostics.runtimeBuildCount == null ? 0 : runtimeDiagnostics.runtimeBuildCount)}`)}</span>
                    </li>
                    <li class="agent-pane-list-item">
                        <span class="agent-pane-list-index">R</span>
                        <span class="agent-pane-list-label">${escapeHtml(translate('agentWorkspace.learningPath.runtimeSourceSize', 'Source nodes / edges'))}: ${escapeHtml(`${String(runtimeDiagnostics.sourceNodeCount == null ? 0 : runtimeDiagnostics.sourceNodeCount)} / ${String(runtimeDiagnostics.sourceEdgeCount == null ? 0 : runtimeDiagnostics.sourceEdgeCount)}`)}</span>
                    </li>
                    <li class="agent-pane-list-item">
                        <span class="agent-pane-list-index">R</span>
                        <span class="agent-pane-list-label">${escapeHtml(translate('agentWorkspace.learningPath.runtimeLatency', 'Resolve ms / build ms'))}: ${escapeHtml(`${String(runtimeDiagnostics.resolveMs == null ? 0 : runtimeDiagnostics.resolveMs)} / ${String(runtimeDiagnostics.buildMs == null ? 0 : runtimeDiagnostics.buildMs)}`)}</span>
                    </li>
                    <li class="agent-pane-list-item">
                        <span class="agent-pane-list-index">R</span>
                        <span class="agent-pane-list-label">${escapeHtml(translate('agentWorkspace.learningPath.runtimeSignature', 'Graph signature'))}: ${escapeHtml(String(runtimeDiagnostics.signature || 'none'))}</span>
                    </li>
                </ul>
            `
            : '';
        return `
            <div
                class="agent-pane-block agent-learning-path-developer-details"
                data-agent-learning-path-developer-details="true"
            >
                <div class="agent-focus-hit-heading">${escapeHtml(translate('agentWorkspace.graphFocus.diagnosticsTitle', 'Render diagnostics'))}</div>
                <ul class="agent-pane-list">${listHtml}</ul>
                ${runtimeDetailsHtml}
            </div>
        `;
    }

    function resolveGodotFuturePathTargetId(payload) {
        const candidates = [
            payload && payload.graphTargetId,
            payload && payload.graphNodeId,
            payload && payload.targetId,
            payload && payload.atomId,
            payload && payload.graphTargetLabel,
            payload && payload.title,
        ];
        for (let index = 0; index < candidates.length; index += 1) {
            const normalized = normalizeKnowledgeGraphText(candidates[index]);
            if (normalized) {
                return normalized;
            }
        }
        return '';
    }

    function buildGodotFuturePathRequest(payload) {
        const targetId = resolveGodotFuturePathTargetId(payload);
        if (!targetId) {
            return null;
        }
        const targetIds = [];
        const seen = new Set();
        const appendTargetId = function (value) {
            const normalized = normalizeKnowledgeGraphText(value);
            if (!normalized || seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            targetIds.push(normalized);
        };
        appendTargetId(targetId);
        []
            .concat(Array.isArray(payload && payload.graphTargetIds) ? payload.graphTargetIds : [])
            .concat(Array.isArray(payload && payload.targetIds) ? payload.targetIds : [])
            .forEach(appendTargetId);
        return {
            mode: 'diffusion',
            strategy: 'core',
            layout: 'orbital',
            targetId,
            target_id: targetId,
            targetIds,
            focus_mode: true,
            language: normalizeKnowledgeGraphText(payload && payload.language) || getActiveWorkspaceLanguage(),
        };
    }

    function resolveHostedFuturePathSourceGraphData() {
        if (typeof graphData !== 'undefined' && graphData && Array.isArray(graphData.nodes)) {
            return graphData;
        }
        if (window.graphData && Array.isArray(window.graphData.nodes)) {
            return window.graphData;
        }
        return null;
    }

    function normalizeHostedFuturePathNodeLabel(node) {
        return normalizeKnowledgeGraphText(node && (node.label || node.title || node.name || node.id));
    }

    function resolveHostedFuturePathTargetNode(config, payload, sourceData) {
        const sourceNodes = sourceData && Array.isArray(sourceData.nodes) ? sourceData.nodes : [];
        const candidates = []
            .concat(config && config.targetId ? [config.targetId] : [])
            .concat(Array.isArray(config && config.targetIds) ? config.targetIds : [])
            .concat([
                payload && payload.graphTargetLabel,
                payload && payload.title,
                payload && payload.atomId,
            ])
            .map((value) => normalizeKnowledgeGraphText(value))
            .filter(Boolean);
        const seen = new Set();
        for (const candidate of candidates) {
            if (seen.has(candidate)) {
                continue;
            }
            seen.add(candidate);
            const exactId = sourceNodes.find((node) => normalizeKnowledgeGraphText(node && node.id) === candidate);
            if (exactId) {
                return exactId;
            }
            const lookupKey = candidate.toLowerCase();
            const labelMatches = sourceNodes.filter((node) => normalizeHostedFuturePathNodeLabel(node).toLowerCase() === lookupKey);
            if (labelMatches.length === 1) {
                return labelMatches[0];
            }
        }
        const graphView = window.NoteConnectionGraphView;
        if (graphView && typeof graphView.resolveNodeById === 'function') {
            for (const candidate of candidates) {
                try {
                    const resolvedNode = graphView.resolveNodeById(candidate);
                    const resolvedId = normalizeKnowledgeGraphText(resolvedNode && resolvedNode.id);
                    if (!resolvedId) {
                        continue;
                    }
                    const exactId = sourceNodes.find((node) => normalizeKnowledgeGraphText(node && node.id) === resolvedId);
                    if (exactId) {
                        return exactId;
                    }
                } catch (_error) {
                    // Fall back to the source graph lookup above.
                }
            }
        }
        return null;
    }

    function createHostedFuturePathGraph(sourceData) {
        const GraphCtor = window.Graph;
        const PathEngineCtor = window.PathEngine;
        if (typeof GraphCtor !== 'function' || typeof PathEngineCtor !== 'function') {
            return null;
        }
        const graph = new GraphCtor();
        const sourceNodes = Array.isArray(sourceData && sourceData.nodes) ? sourceData.nodes : [];
        const sourceEdges = Array.isArray(sourceData && sourceData.edges)
            ? sourceData.edges
            : (Array.isArray(sourceData && sourceData.links) ? sourceData.links : []);
        sourceNodes.forEach((node) => {
            const nodeId = normalizeKnowledgeGraphText(node && node.id);
            if (!nodeId) {
                return;
            }
            graph.addNode({
                ...node,
                id: nodeId,
                label: normalizeHostedFuturePathNodeLabel(node) || nodeId,
                inDegree: Number(node && node.inDegree) || 0,
                outDegree: Number(node && node.outDegree) || 0,
                centrality: Number(node && node.centrality) || 0,
            });
        });
        sourceEdges.forEach((edge) => {
            const sourceId = normalizeKnowledgeGraphText(edge && (typeof edge.source === 'object' ? edge.source.id : edge.source));
            const targetId = normalizeKnowledgeGraphText(edge && (typeof edge.target === 'object' ? edge.target.id : edge.target));
            if (!sourceId || !targetId) {
                return;
            }
            try {
                graph.addEdge(
                    sourceId,
                    targetId,
                    normalizeKnowledgeGraphText(edge && (edge.type || edge.relationKind || edge.kind)) || 'related',
                    Number(edge && edge.weight) || 1
                );
            } catch (_error) {
                // Ignore edges whose endpoints are absent from the bundled graph data.
            }
        });
        return {
            graph,
            engine: new PathEngineCtor(graph),
        };
    }

    function readHostedFuturePathSourceGraphStats(sourceData) {
        const sourceNodes = Array.isArray(sourceData && sourceData.nodes) ? sourceData.nodes : [];
        const sourceEdges = Array.isArray(sourceData && sourceData.edges)
            ? sourceData.edges
            : (Array.isArray(sourceData && sourceData.links) ? sourceData.links : []);
        return {
            nodeCount: sourceNodes.length,
            edgeCount: sourceEdges.length,
        };
    }

    function buildHostedFuturePathGraphSourceSignature(sourceData) {
        const sourceNodes = Array.isArray(sourceData && sourceData.nodes) ? sourceData.nodes : [];
        const sourceEdges = Array.isArray(sourceData && sourceData.edges)
            ? sourceData.edges
            : (Array.isArray(sourceData && sourceData.links) ? sourceData.links : []);
        const nodeSample = sourceNodes
            .slice(0, 4)
            .map((node) => normalizeKnowledgeGraphText(node && node.id))
            .filter(Boolean)
            .join('|');
        const edgeSample = sourceEdges
            .slice(0, 4)
            .map((edge) => {
                const sourceId = normalizeKnowledgeGraphText(edge && (typeof edge.source === 'object' ? edge.source.id : edge.source));
                const targetId = normalizeKnowledgeGraphText(edge && (typeof edge.target === 'object' ? edge.target.id : edge.target));
                const relationKind = normalizeKnowledgeGraphText(edge && (edge.type || edge.relationKind || edge.kind));
                return [sourceId, relationKind, targetId].filter(Boolean).join(':');
            })
            .filter(Boolean)
            .join('|');
        return [
            sourceNodes.length,
            sourceEdges.length,
            nodeSample,
            edgeSample,
        ].join('::');
    }

    function getHostedFuturePathRuntimeManager() {
        if (hostedFuturePathRuntimeManager) {
            return hostedFuturePathRuntimeManager;
        }
        const runtimeModule = window.NoteConnectionHostedFuturePathRuntime;
        const createRuntimeCacheManager = runtimeModule && typeof runtimeModule.createRuntimeCacheManager === 'function'
            ? runtimeModule.createRuntimeCacheManager
            : function (options) {
                let cacheEntry = null;
                let lastDiagnostics = null;
                return {
                    resolve: function (sourceData) {
                        const signature = options.buildSignature(sourceData);
                        const stats = options.readStats(sourceData);
                        if (
                            cacheEntry
                            && cacheEntry.sourceData === sourceData
                            && cacheEntry.signature === signature
                        ) {
                            lastDiagnostics = {
                                cacheLabel: String(options.label || 'hosted-future-path-runtime'),
                                signature,
                                sourceNodeCount: Number(stats && stats.nodeCount || 0),
                                sourceEdgeCount: Number(stats && stats.edgeCount || 0),
                                cacheHit: true,
                                cacheMiss: false,
                                cacheState: 'hit',
                                runtimeBuildCount: 1,
                            cacheHitCount: 1,
                            cacheMissCount: 0,
                            resolveMs: 0,
                            buildMs: 0,
                            reason: 'runtime_reused',
                        };
                            return {
                                runtime: cacheEntry.runtime,
                                diagnostics: cloneJsonPayload(lastDiagnostics),
                            };
                        }
                        const runtime = options.createRuntime(sourceData);
                        cacheEntry = runtime ? { sourceData, signature, runtime } : null;
                        lastDiagnostics = {
                            cacheLabel: String(options.label || 'hosted-future-path-runtime'),
                            signature,
                            sourceNodeCount: Number(stats && stats.nodeCount || 0),
                            sourceEdgeCount: Number(stats && stats.edgeCount || 0),
                            cacheHit: false,
                            cacheMiss: true,
                            cacheState: 'miss_cold',
                            runtimeBuildCount: runtime ? 1 : 0,
                            cacheHitCount: 0,
                            cacheMissCount: 1,
                            resolveMs: 0,
                            buildMs: 0,
                            reason: runtime ? 'runtime_ready' : 'runtime_unavailable',
                        };
                        return {
                            runtime,
                            diagnostics: cloneJsonPayload(lastDiagnostics),
                        };
                    },
                    clear: function () {
                        cacheEntry = null;
                        lastDiagnostics = null;
                    },
                    getDiagnostics: function () {
                        return cloneJsonPayload(lastDiagnostics);
                    },
                    getAggregateSnapshot: function () {
                        return cloneJsonPayload(lastDiagnostics);
                    },
                };
            };
        hostedFuturePathRuntimeManager = createRuntimeCacheManager({
            label: 'hosted-future-path-runtime',
            createRuntime: createHostedFuturePathGraph,
            buildSignature: buildHostedFuturePathGraphSourceSignature,
            readStats: readHostedFuturePathSourceGraphStats,
        });
        return hostedFuturePathRuntimeManager;
    }

    function setHostedFuturePathRuntimeDiagnostics(diagnostics) {
        state.godotFuturePath.runtimeDiagnostics = cloneJsonPayload(diagnostics);
        window.__NC_LAST_AGENT_GODOT_FUTURE_PATH_RUNTIME_DIAGNOSTICS = cloneJsonPayload(diagnostics);
    }

    function getHostedFuturePathGraphRuntime(sourceData) {
        const manager = getHostedFuturePathRuntimeManager();
        const resolved = manager && typeof manager.resolve === 'function'
            ? manager.resolve(sourceData)
            : { runtime: createHostedFuturePathGraph(sourceData), diagnostics: null };
        setHostedFuturePathRuntimeDiagnostics(resolved && resolved.diagnostics ? resolved.diagnostics : null);
        return resolved ? resolved.runtime : null;
    }

    function getHostedFuturePathValidNodeIds(sourceData) {
        const sourceNodes = Array.isArray(sourceData && sourceData.nodes) ? sourceData.nodes : [];
        return new Set(sourceNodes
            .map((node) => normalizeKnowledgeGraphText(node && node.id))
            .filter(Boolean));
    }

    function normalizeHostedFuturePathIdList(value, validNodeIds) {
        const ids = [];
        const seen = new Set();
        const append = function (candidate) {
            const normalized = normalizeKnowledgeGraphText(candidate && typeof candidate === 'object'
                ? (candidate.id || candidate.nodeId || candidate.key || candidate.value)
                : candidate);
            if (!normalized || seen.has(normalized)) {
                return;
            }
            if (validNodeIds && validNodeIds.size > 0 && !validNodeIds.has(normalized)) {
                return;
            }
            seen.add(normalized);
            ids.push(normalized);
        };
        if (Array.isArray(value)) {
            value.forEach(append);
            return ids;
        }
        if (value && typeof value !== 'string' && typeof value[Symbol.iterator] === 'function') {
            Array.from(value).forEach(append);
            return ids;
        }
        append(value);
        return ids;
    }

    function readHostedFuturePathModeState(targetId, validNodeIds) {
        const normalizedTargetId = normalizeKnowledgeGraphText(targetId);
        const pathApp = window.pathApp;
        if (!normalizedTargetId || !pathApp || typeof pathApp !== 'object') {
            return null;
        }
        const runtimeConfig = pathApp.runtimeConfig && typeof pathApp.runtimeConfig === 'object'
            ? pathApp.runtimeConfig
            : {};
        const liveTargetIds = normalizeHostedFuturePathIdList([
            pathApp.currentTargetId,
            runtimeConfig.targetId,
        ], validNodeIds).concat(
            normalizeHostedFuturePathIdList(pathApp.currentTargetIds, validNodeIds),
            normalizeHostedFuturePathIdList(runtimeConfig.targetIds, validNodeIds)
        );
        if (!liveTargetIds.includes(normalizedTargetId)) {
            return null;
        }
        const mode = normalizeKnowledgeGraphText(runtimeConfig.mode).toLowerCase();
        const strategy = normalizeKnowledgeGraphText(runtimeConfig.strategy).toLowerCase();
        if (mode && mode !== 'diffusion') {
            return null;
        }
        if (strategy && strategy !== 'core') {
            return null;
        }
        return {
            expandedNodeIds: normalizeHostedFuturePathIdList(pathApp.expansionOrder, validNodeIds),
            collapsedNodeIds: normalizeHostedFuturePathIdList(pathApp.collapsedNodes, validNodeIds),
            forcedExpansionNodeIds: normalizeHostedFuturePathIdList(pathApp.forcedExpansionNodes, validNodeIds),
            completedNodeIds: normalizeHostedFuturePathIdList(pathApp.completedNodes, validNodeIds),
            stickyClaimEnabled: pathApp.stickyClaimEnabled !== false,
            fromLivePathMode: true,
        };
    }

    function buildHostedFuturePathModeStateSignature(liveState) {
        if (!liveState) {
            return '';
        }
        return JSON.stringify({
            expandedNodeIds: liveState.expandedNodeIds || [],
            collapsedNodeIds: liveState.collapsedNodeIds || [],
            forcedExpansionNodeIds: liveState.forcedExpansionNodeIds || [],
            completedNodeIds: liveState.completedNodeIds || [],
            stickyClaimEnabled: liveState.stickyClaimEnabled !== false,
        });
    }

    function applyHostedFuturePathModeState(targetId, liveState, liveSignature) {
        const normalizedTargetId = normalizeKnowledgeGraphText(targetId);
        const collapsedNodeIds = liveState ? liveState.collapsedNodeIds.slice() : [];
        const collapsedNodeSet = new Set(collapsedNodeIds);
        const expandedNodeIds = liveState
            ? liveState.expandedNodeIds.filter((nodeId) => !collapsedNodeSet.has(nodeId))
            : [];
        const completedNodeIds = liveState ? liveState.completedNodeIds.slice() : [];
        const forcedExpansionIds = new Set((liveState ? liveState.forcedExpansionNodeIds : [])
            .filter((nodeId) => !collapsedNodeSet.has(nodeId)));
        expandedNodeIds.forEach((nodeId) => forcedExpansionIds.add(nodeId));

        const targetExplicitlyCollapsed = collapsedNodeIds.includes(normalizedTargetId);
        if (!targetExplicitlyCollapsed && normalizedTargetId) {
            if (!expandedNodeIds.includes(normalizedTargetId)) {
                expandedNodeIds.unshift(normalizedTargetId);
            }
            forcedExpansionIds.add(normalizedTargetId);
        }

        state.godotFuturePath.expandedNodeIds = expandedNodeIds;
        state.godotFuturePath.collapsedNodeIds = collapsedNodeIds;
        state.godotFuturePath.forcedExpansionNodeIds = Array.from(forcedExpansionIds);
        state.godotFuturePath.completedNodeIds = completedNodeIds;
        state.godotFuturePath.stickyClaimEnabled = !liveState || liveState.stickyClaimEnabled !== false;
        state.godotFuturePath.pathModeStateSignature = liveSignature || '';
        state.godotFuturePath.userMutatedExpansion = false;
        state.godotFuturePath.syncedFromPathMode = Boolean(liveState && liveState.fromLivePathMode === true);
    }

    function ensureHostedFuturePathExpansionState(targetId, sourceData) {
        const normalizedTargetId = normalizeKnowledgeGraphText(targetId);
        if (!normalizedTargetId) {
            state.godotFuturePath.expandedNodeIds = [];
            state.godotFuturePath.collapsedNodeIds = [];
            state.godotFuturePath.forcedExpansionNodeIds = [];
            state.godotFuturePath.completedNodeIds = [];
            state.godotFuturePath.activeTargetId = '';
            state.godotFuturePath.pathModeStateSignature = '';
            state.godotFuturePath.userMutatedExpansion = false;
            state.godotFuturePath.syncedFromPathMode = false;
            return;
        }
        const validNodeIds = getHostedFuturePathValidNodeIds(sourceData);
        const liveState = readHostedFuturePathModeState(normalizedTargetId, validNodeIds);
        const liveSignature = buildHostedFuturePathModeStateSignature(liveState);
        if (state.godotFuturePath.activeTargetId !== normalizedTargetId) {
            state.godotFuturePath.activeTargetId = normalizedTargetId;
            state.godotFuturePath.collapseAllRequested = false;
            applyHostedFuturePathModeState(normalizedTargetId, liveState, liveSignature);
        } else if (
            liveState
            && state.godotFuturePath.userMutatedExpansion !== true
            && state.godotFuturePath.pathModeStateSignature !== liveSignature
        ) {
            applyHostedFuturePathModeState(normalizedTargetId, liveState, liveSignature);
        }
        const targetExplicitlyCollapsed = state.godotFuturePath.collapsedNodeIds.includes(normalizedTargetId);
        if (
            !state.godotFuturePath.collapseAllRequested
            && !targetExplicitlyCollapsed
            && !state.godotFuturePath.expandedNodeIds.includes(normalizedTargetId)
        ) {
            state.godotFuturePath.expandedNodeIds.unshift(normalizedTargetId);
        }
        if (!state.godotFuturePath.collapseAllRequested && !targetExplicitlyCollapsed) {
            const forcedExpansionIds = new Set(state.godotFuturePath.forcedExpansionNodeIds);
            forcedExpansionIds.add(normalizedTargetId);
            state.godotFuturePath.expandedNodeIds.forEach((nodeId) => forcedExpansionIds.add(nodeId));
            state.godotFuturePath.forcedExpansionNodeIds = Array.from(forcedExpansionIds);
        }
        if (!state.godotFuturePath.collapseAllRequested && !targetExplicitlyCollapsed) {
            state.godotFuturePath.collapsedNodeIds = state.godotFuturePath.collapsedNodeIds
                .filter((nodeId) => nodeId !== normalizedTargetId);
        }
    }

    function buildHostedGodotFuturePathProjection(payload, config) {
        const sourceData = resolveHostedFuturePathSourceGraphData();
        if (!sourceData) {
            setHostedFuturePathRuntimeDiagnostics({
                cacheLabel: 'hosted-future-path-runtime',
                signature: '',
                sourceNodeCount: 0,
                sourceEdgeCount: 0,
                cacheHit: false,
                cacheMiss: false,
                cacheState: 'unavailable',
                runtimeBuildCount: 0,
                cacheHitCount: 0,
                cacheMissCount: 0,
                resolveMs: 0,
                buildMs: 0,
                reason: 'missing_graph_data',
            });
            return {
                config,
                available: false,
                reason: 'missing_graph_data',
                treeLayout: null,
                targetId: config && config.targetId || '',
                targetLabel: resolveLearningPathTitle(payload || {}),
            };
        }
        const targetNode = resolveHostedFuturePathTargetNode(config, payload || {}, sourceData);
        if (!targetNode) {
            const graphStats = readHostedFuturePathSourceGraphStats(sourceData);
            setHostedFuturePathRuntimeDiagnostics({
                cacheLabel: 'hosted-future-path-runtime',
                signature: buildHostedFuturePathGraphSourceSignature(sourceData),
                sourceNodeCount: Number(graphStats.nodeCount || 0),
                sourceEdgeCount: Number(graphStats.edgeCount || 0),
                cacheHit: false,
                cacheMiss: false,
                cacheState: 'target_not_found',
                runtimeBuildCount: 0,
                cacheHitCount: 0,
                cacheMissCount: 0,
                resolveMs: 0,
                buildMs: 0,
                reason: 'target_not_found',
            });
            return {
                config,
                available: false,
                reason: 'target_not_found',
                treeLayout: null,
                targetId: config && config.targetId || '',
                targetLabel: resolveLearningPathTitle(payload || {}),
            };
        }
        const targetId = normalizeKnowledgeGraphText(targetNode.id);
        const targetLabel = normalizeHostedFuturePathNodeLabel(targetNode) || targetId;
        const graphRuntime = getHostedFuturePathGraphRuntime(sourceData);
        if (!graphRuntime) {
            return {
                config,
                available: false,
                reason: 'missing_path_core',
                treeLayout: null,
                targetId,
                targetLabel,
            };
        }
        ensureHostedFuturePathExpansionState(targetId, sourceData);
        try {
            const completedSet = new Set(state.godotFuturePath.completedNodeIds);
            const forcedExpansionSet = new Set(state.godotFuturePath.forcedExpansionNodeIds);
            const result = graphRuntime.engine.diffusionLearning(targetId, 'core', completedSet, forcedExpansionSet);
            const collapsedSet = new Set(state.godotFuturePath.collapsedNodeIds);
            const expansionOrder = state.godotFuturePath.expandedNodeIds.slice();
            const stickyClaimEnabled = state.godotFuturePath.stickyClaimEnabled !== false;
            const treeLayout = graphRuntime.engine.getTreeLayout(
                targetId,
                result,
                collapsedSet,
                expansionOrder,
                stickyClaimEnabled,
                { verticalGap: 240 }
            );
            return {
                config: {
                    ...config,
                    targetId,
                    target_id: targetId,
                    targetIds: [targetId].concat((config.targetIds || []).filter((id) => id !== targetId)),
                    collapsedIds: Array.from(collapsedSet),
                    completedIds: Array.from(completedSet),
                    forcedExpansionIds: Array.from(forcedExpansionSet),
                    expansionOrder,
                    stickyClaimEnabled,
                },
                available: Boolean(treeLayout && Array.isArray(treeLayout.nodes) && treeLayout.nodes.length > 0),
                reason: treeLayout ? '' : 'empty_tree_layout',
                treeLayout,
                targetId,
                targetLabel,
                syncedFromPathMode: state.godotFuturePath.syncedFromPathMode === true,
                pathNodeCount: Array.isArray(result && result.nodes) ? result.nodes.length : 0,
                pathEdgeCount: Array.isArray(result && result.edges) ? result.edges.length : 0,
            };
        } catch (error) {
            return {
                config,
                available: false,
                reason: String(error && error.message || error || 'path_engine_failed'),
                treeLayout: null,
                targetId,
                targetLabel,
            };
        }
    }

    function buildHostedFuturePathSurfaceHtml(projection) {
        const targetLabel = normalizeKnowledgeGraphText(projection && projection.targetLabel)
            || normalizeKnowledgeGraphText(projection && projection.targetId)
            || translate('agentWorkspace.learningPath.title', 'Learning Path');
        const treeLayout = projection && projection.treeLayout;
        const godotRenderer = window.NoteConnectionGodotFuturePathRenderer;
        if (godotRenderer && typeof godotRenderer.buildSurfaceHtml === 'function') {
            return godotRenderer.buildSurfaceHtml({
                treeLayout,
                targetId: projection && projection.targetId,
                currentId: projection && projection.targetId,
                targetLabel,
                selectedNodeId: state.godotFuturePath.selectedNodeId,
                lastSignal: state.godotFuturePath.lastSignal,
                reason: normalizeKnowledgeGraphText(projection && projection.reason),
                focusModeEnabled: true,
                unavailableLabel: translate('agentWorkspace.learningPath.godotFuturePathUnavailable', 'Godot Future Path target is unavailable.'),
                statusLabel: translate('agentWorkspace.learningPath.godotFuturePathRequested', 'Godot Future Path requested: Diffusion / Core'),
            });
        }
        const reason = normalizeKnowledgeGraphText(projection && projection.reason) || 'missing_godot_tree_renderer';
        return `
            <div
                class="agent-godot-future-path-shell"
                data-agent-godot-future-path-shell="true"
                data-agent-godot-future-path-hosted="true"
                data-godot-tree-renderer="false"
            >
                <div class="agent-godot-future-path-title">${escapeHtml(targetLabel)}</div>
                <div class="agent-godot-future-path-status" data-agent-godot-future-path-status="true">
                    ${escapeHtml(translate('agentWorkspace.learningPath.godotFuturePathUnavailable', 'Godot Future Path target is unavailable.'))}
                    ${reason ? ` (${escapeHtml(reason)})` : ''}
                </div>
            </div>
        `;
    }

    function buildHostedGodotFuturePathForPayload(payload) {
        const config = buildGodotFuturePathRequest(payload || {});
        if (!config) {
            state.godotFuturePath.request = null;
            state.godotFuturePath.projection = null;
            return null;
        }
        const projection = buildHostedGodotFuturePathProjection(payload || {}, config);
        const effectiveConfig = projection && projection.config ? projection.config : config;
        state.godotFuturePath.request = { ...effectiveConfig };
        state.godotFuturePath.projection = projection ? JSON.parse(JSON.stringify(projection)) : null;
        state.godotFuturePath.lastDispatch = projection
            ? {
                runtime: 'hosted-path-engine',
                targetId: projection.targetId,
                available: projection.available === true,
                reason: projection.reason || '',
                treeNodeCount: projection.treeLayout && Array.isArray(projection.treeLayout.nodes)
                    ? projection.treeLayout.nodes.length
                    : 0,
                runtimeDiagnostics: state.godotFuturePath.runtimeDiagnostics
                    ? cloneJsonPayload(state.godotFuturePath.runtimeDiagnostics)
                    : null,
            }
            : null;
        window.__NC_LAST_AGENT_GODOT_FUTURE_PATH_REQUEST = { ...effectiveConfig };
        window.__NC_LAST_AGENT_GODOT_FUTURE_PATH_LAYOUT = projection && projection.treeLayout
            ? JSON.parse(JSON.stringify(projection.treeLayout))
            : null;
        publishHostedFuturePathExpansionState();
        return projection;
    }

    function publishHostedFuturePathExpansionState() {
        window.__NC_LAST_AGENT_GODOT_FUTURE_PATH_EXPANSION_STATE = {
            activeTargetId: state.godotFuturePath.activeTargetId,
            expandedNodeIds: state.godotFuturePath.expandedNodeIds.slice(),
            collapsedNodeIds: state.godotFuturePath.collapsedNodeIds.slice(),
            forcedExpansionNodeIds: state.godotFuturePath.forcedExpansionNodeIds.slice(),
            completedNodeIds: state.godotFuturePath.completedNodeIds.slice(),
            stickyClaimEnabled: state.godotFuturePath.stickyClaimEnabled !== false,
            collapseAllRequested: state.godotFuturePath.collapseAllRequested === true,
            syncedFromPathMode: state.godotFuturePath.syncedFromPathMode === true,
        };
    }

    function recordHostedGodotTreeSignal(signal, nodeId) {
        const normalizedSignal = normalizeKnowledgeGraphText(signal);
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        const entry = {
            signal: normalizedSignal,
            nodeId: normalizedNodeId,
            host: 'agent-workspace',
        };
        state.godotFuturePath.lastSignal = entry;
        window.__NC_LAST_AGENT_GODOT_TREE_SIGNAL = { ...entry };
        return entry;
    }

    function canToggleHostedFuturePathPrereqs(nodeElement) {
        return nodeElement && (
            nodeElement.getAttribute('data-agent-future-path-node-spine') === 'true'
            || nodeElement.getAttribute('data-godot-tree-node-spine') === 'true'
        );
    }

    function isHostedFuturePathPrereqsExpanded(nodeElement) {
        return nodeElement && (
            nodeElement.getAttribute('data-agent-future-path-node-expanded') === 'true'
            || nodeElement.getAttribute('data-godot-tree-node-expanded') === 'true'
        );
    }

    function applyHostedFuturePathSelection(body, nodeId) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        if (!normalizedNodeId || !body) {
            return;
        }
        state.godotFuturePath.selectedNodeId = normalizedNodeId;
        const shell = body.querySelector('[data-agent-godot-future-path-shell="true"]');
        const surface = body.querySelector('[data-agent-godot-future-path-surface="true"]');
        [shell, surface].forEach((element) => {
            if (element) {
                element.setAttribute('data-godot-tree-selected-node-id', normalizedNodeId);
            }
        });
        body.querySelectorAll('.agent-godot-future-path-node--selected').forEach((node) => {
            node.classList.remove('agent-godot-future-path-node--selected');
        });
        body.querySelectorAll('[data-godot-tree-node-id], [data-agent-future-path-node-id]').forEach((node) => {
            const candidateId = normalizeKnowledgeGraphText(
                node.getAttribute('data-agent-future-path-node-id')
                || node.getAttribute('data-godot-tree-node-id')
            );
            node.classList.toggle('agent-godot-future-path-node--selected', candidateId === normalizedNodeId);
        });
    }

    function setHostedFuturePathExpansion(nodeId, shouldExpand, payload) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        if (!normalizedNodeId) {
            return;
        }
        const expandedNodeIds = new Set(state.godotFuturePath.expandedNodeIds);
        const collapsed = new Set(state.godotFuturePath.collapsedNodeIds);
        const forcedExpansionIds = new Set(state.godotFuturePath.forcedExpansionNodeIds);
        if (shouldExpand === true) {
            expandedNodeIds.add(normalizedNodeId);
            collapsed.delete(normalizedNodeId);
            forcedExpansionIds.add(normalizedNodeId);
        } else {
            expandedNodeIds.delete(normalizedNodeId);
            collapsed.add(normalizedNodeId);
            forcedExpansionIds.delete(normalizedNodeId);
        }
        state.godotFuturePath.collapseAllRequested = false;
        state.godotFuturePath.expandedNodeIds = Array.from(expandedNodeIds);
        state.godotFuturePath.collapsedNodeIds = Array.from(collapsed);
        state.godotFuturePath.forcedExpansionNodeIds = Array.from(forcedExpansionIds);
        state.godotFuturePath.userMutatedExpansion = true;
        state.godotFuturePath.syncedFromPathMode = false;
        publishHostedFuturePathExpansionState();
        renderLearningPathBody(payload || state.panes['learning-path'].payload || {});
    }

    function collapseAllHostedFuturePathNodes(payload) {
        const collapsedIds = state.godotFuturePath.collapsedNodeIds
            .concat(state.godotFuturePath.expandedNodeIds)
            .map((nodeId) => normalizeKnowledgeGraphText(nodeId))
            .filter(Boolean);
        state.godotFuturePath.expandedNodeIds = [];
        state.godotFuturePath.collapsedNodeIds = Array.from(new Set(collapsedIds));
        state.godotFuturePath.forcedExpansionNodeIds = [];
        state.godotFuturePath.collapseAllRequested = true;
        state.godotFuturePath.userMutatedExpansion = true;
        state.godotFuturePath.syncedFromPathMode = false;
        publishHostedFuturePathExpansionState();
        renderLearningPathBody(payload || state.panes['learning-path'].payload || {});
    }

    function switchHostedFuturePathTarget(nodeId, payload) {
        const normalizedNodeId = normalizeKnowledgeGraphText(nodeId);
        if (!normalizedNodeId) {
            return;
        }
        const projection = state.godotFuturePath.projection;
        const treeNodes = projection && projection.treeLayout && Array.isArray(projection.treeLayout.nodes)
            ? projection.treeLayout.nodes
            : [];
        const targetNode = treeNodes.find((node) => (
            normalizeKnowledgeGraphText(node && (node.id || node.nodeId || node.key)) === normalizedNodeId
        ));
        const targetLabel = normalizeKnowledgeGraphText(targetNode && (targetNode.label || targetNode.title || targetNode.name))
            || normalizedNodeId;
        const nextPayload = {
            ...(payload || state.panes['learning-path'].payload || {}),
            atomId: normalizedNodeId,
            nodeId: normalizedNodeId,
            targetId: normalizedNodeId,
            graphTargetId: normalizedNodeId,
            graphNodeId: normalizedNodeId,
            graphTargetLabel: targetLabel,
            title: targetLabel,
        };
        state.panes['learning-path'].payload = nextPayload;
        state.godotFuturePath.activeTargetId = '';
        state.godotFuturePath.selectedNodeId = normalizedNodeId;
        state.godotFuturePath.collapseAllRequested = false;
        renderLearningPathBody(nextPayload);
    }

    function bindHostedFuturePathViewport(body) {
        const viewport = body && body.querySelector('[data-godot-tree-viewport="true"]');
        const surface = body && body.querySelector('[data-godot-tree-transform-target="true"]');
        if (!viewport || !surface) {
            return;
        }
        const readNumericAttribute = function (element, attributeName) {
            const value = Number(element.getAttribute(attributeName));
            return Number.isFinite(value) && value > 0 ? value : 0;
        };
        const readFiniteAttribute = function (element, attributeName) {
            const value = Number(element.getAttribute(attributeName));
            return Number.isFinite(value) ? value : null;
        };
        const readViewportSize = function () {
            const rect = typeof viewport.getBoundingClientRect === 'function'
                ? viewport.getBoundingClientRect()
                : { width: 0, height: 0 };
            return {
                width: Number(viewport.clientWidth) || Number(rect.width) || 760,
                height: Number(viewport.clientHeight) || Number(rect.height) || 460,
            };
        };
        const readSurfaceSize = function () {
            const styleWidth = parseFloat(String(surface.style.width || ''));
            const styleHeight = parseFloat(String(surface.style.height || ''));
            return {
                width: readNumericAttribute(surface, 'data-godot-tree-surface-width') || Number(surface.offsetWidth) || styleWidth || 760,
                height: readNumericAttribute(surface, 'data-godot-tree-surface-height') || Number(surface.offsetHeight) || styleHeight || 460,
            };
        };
        const readTransform = function () {
            return {
                zoom: Number(viewport.getAttribute('data-godot-tree-zoom')) || 1,
                panX: Number(viewport.getAttribute('data-godot-tree-pan-x')) || 0,
                panY: Number(viewport.getAttribute('data-godot-tree-pan-y')) || 0,
            };
        };
        const applyTransform = function (nextTransform) {
            const zoom = Math.min(5, Math.max(0.1, Number(nextTransform.zoom) || 1));
            const panX = Number.isFinite(Number(nextTransform.panX)) ? Number(nextTransform.panX) : 0;
            const panY = Number.isFinite(Number(nextTransform.panY)) ? Number(nextTransform.panY) : 0;
            viewport.setAttribute('data-godot-tree-zoom', String(Number(zoom.toFixed(3))));
            viewport.setAttribute('data-godot-tree-pan-x', String(Number(panX.toFixed(1))));
            viewport.setAttribute('data-godot-tree-pan-y', String(Number(panY.toFixed(1))));
            surface.style.setProperty('--godot-tree-zoom', String(Number(zoom.toFixed(3))));
            surface.style.setProperty('--godot-tree-pan-x', `${Number(panX.toFixed(1))}px`);
            surface.style.setProperty('--godot-tree-pan-y', `${Number(panY.toFixed(1))}px`);
        };
        const resolveInitialTransform = function () {
            const current = readTransform();
            if (viewport.getAttribute('data-godot-tree-auto-fit') !== 'pending') {
                return current;
            }
            const viewportSize = readViewportSize();
            const surfaceSize = readSurfaceSize();
            if (
                !Number.isFinite(viewportSize.width)
                || !Number.isFinite(viewportSize.height)
                || !Number.isFinite(surfaceSize.width)
                || !Number.isFinite(surfaceSize.height)
                || viewportSize.width <= 0
                || viewportSize.height <= 0
                || surfaceSize.width <= 0
                || surfaceSize.height <= 0
            ) {
                return current;
            }
            const margin = 48;
            const availableWidth = Math.max(240, viewportSize.width - margin);
            const availableHeight = Math.max(240, viewportSize.height - margin);
            const fitZoom = Math.min(1, Math.max(0.18, Math.min(
                availableWidth / surfaceSize.width,
                availableHeight / surfaceSize.height
            )));
            const currentX = readFiniteAttribute(surface, 'data-godot-tree-current-x');
            const currentY = readFiniteAttribute(surface, 'data-godot-tree-current-y');
            if (currentX !== null && currentY !== null && currentX > 0 && currentY > 0) {
                return {
                    zoom: fitZoom,
                    panX: (viewportSize.width / 2) - (currentX * fitZoom),
                    panY: (viewportSize.height / 2) - (currentY * fitZoom),
                };
            }
            return {
                zoom: fitZoom,
                panX: (viewportSize.width - (surfaceSize.width * fitZoom)) / 2,
                panY: (viewportSize.height - (surfaceSize.height * fitZoom)) / 2,
            };
        };
        applyTransform(resolveInitialTransform());
        viewport.setAttribute('data-godot-tree-auto-fit', 'done');
        viewport.addEventListener('wheel', function (event) {
            event.preventDefault();
            const current = readTransform();
            const factor = event.deltaY < 0 ? 1.1 : 0.9;
            const nextZoom = Math.min(5, Math.max(0.1, current.zoom * factor));
            const rect = viewport.getBoundingClientRect();
            const localX = event.clientX - rect.left + viewport.scrollLeft;
            const localY = event.clientY - rect.top + viewport.scrollTop;
            const worldX = (localX - current.panX) / current.zoom;
            const worldY = (localY - current.panY) / current.zoom;
            applyTransform({
                zoom: nextZoom,
                panX: localX - (worldX * nextZoom),
                panY: localY - (worldY * nextZoom),
            });
        }, { passive: false });
        let panState = null;
        const finishPan = function () {
            if (!panState) {
                return;
            }
            panState = null;
            viewport.classList.remove('is-panning');
            document.removeEventListener('mousemove', movePan, true);
            document.removeEventListener('mouseup', finishPan, true);
        };
        const movePan = function (event) {
            if (!panState) {
                return;
            }
            applyTransform({
                zoom: panState.zoom,
                panX: panState.panX + (event.clientX - panState.clientX),
                panY: panState.panY + (event.clientY - panState.clientY),
            });
        };
        viewport.addEventListener('mousedown', function (event) {
            if (
                event.button !== 0
                || (
                    event.target
                    && typeof event.target.closest === 'function'
                    && event.target.closest('[data-godot-tree-node-id], [data-agent-future-path-node-id]')
                )
            ) {
                return;
            }
            event.preventDefault();
            const current = readTransform();
            panState = {
                clientX: event.clientX,
                clientY: event.clientY,
                panX: current.panX,
                panY: current.panY,
                zoom: current.zoom,
            };
            viewport.classList.add('is-panning');
            document.addEventListener('mousemove', movePan, true);
            document.addEventListener('mouseup', finishPan, true);
        });
        viewport.addEventListener('contextmenu', function (event) {
            if (!(event.target && typeof event.target.closest === 'function'
                && event.target.closest('[data-godot-tree-node-id], [data-agent-future-path-node-id]'))) {
                event.preventDefault();
            }
        });
    }

    function bindHostedFuturePathSurface(body, payload) {
        if (!body) {
            return;
        }
        bindHostedFuturePathViewport(body);
        const renderer = window.NoteConnectionGodotFuturePathRenderer;
        const treeInteractions = window.NoteConnectionGodotTreeInteractions;
        const projection = state.godotFuturePath.projection;
        const treeLayout = projection && projection.treeLayout;
        const resetActiveHull = function () {
            if (renderer && typeof renderer.resolveActiveHullRoot === 'function' && typeof renderer.updateActiveHullRoot === 'function') {
                renderer.updateActiveHullRoot(body, renderer.resolveActiveHullRoot(treeLayout, ''));
            }
        };
        if (treeInteractions && typeof treeInteractions.bindTreeRenderer === 'function') {
            treeInteractions.bindTreeRenderer(body, {
                nodeClicked: function (nodeId, event) {
                    recordHostedGodotTreeSignal('node_clicked', nodeId);
                    applyHostedFuturePathSelection(body, nodeId);
                    const clickedBadge = event && event.target
                        && typeof event.target.closest === 'function'
                        && event.target.closest('[data-godot-tree-expansion-badge="true"]');
                    const nodeButton = event && event.currentTarget;
                    if (clickedBadge && nodeButton && canToggleHostedFuturePathPrereqs(nodeButton)) {
                        const isExpanded = isHostedFuturePathPrereqsExpanded(nodeButton);
                        recordHostedGodotTreeSignal(
                            isExpanded ? 'node_collapse_prereqs_requested' : 'node_expand_prereqs_requested',
                            nodeId
                        );
                        setHostedFuturePathExpansion(nodeId, !isExpanded, payload || {});
                    }
                },
                nodeExpandPrereqsRequested: function (nodeId) {
                    recordHostedGodotTreeSignal('node_expand_prereqs_requested', nodeId);
                    setHostedFuturePathExpansion(nodeId, true, payload || {});
                },
                nodeCollapsePrereqsRequested: function (nodeId) {
                    recordHostedGodotTreeSignal('node_collapse_prereqs_requested', nodeId);
                    setHostedFuturePathExpansion(nodeId, false, payload || {});
                },
                collapseAllRequested: function () {
                    recordHostedGodotTreeSignal('collapse_all_requested', '');
                    collapseAllHostedFuturePathNodes(payload || {});
                },
                nodeNavigateRequested: function (nodeId) {
                    recordHostedGodotTreeSignal('node_navigate_requested', nodeId);
                    switchHostedFuturePathTarget(nodeId, payload || {});
                },
                nodeReaderRequested: function (nodeId) {
                    recordHostedGodotTreeSignal('node_reader_requested', nodeId);
                    applyHostedFuturePathSelection(body, nodeId);
                    void openHostedLearningPathPaneReader(payload || {}, nodeId);
                },
            });
        }
        body.querySelectorAll('[data-godot-tree-node-id], [data-agent-future-path-node-id]').forEach((nodeButton) => {
            nodeButton.addEventListener('mouseenter', function () {
                if (renderer && typeof renderer.resolveActiveHullRoot === 'function' && typeof renderer.updateActiveHullRoot === 'function') {
                    const nodeId = nodeButton.getAttribute('data-agent-future-path-node-id') || nodeButton.getAttribute('data-godot-tree-node-id');
                    renderer.updateActiveHullRoot(body, renderer.resolveActiveHullRoot(treeLayout, nodeId));
                }
            });
            nodeButton.addEventListener('mouseleave', resetActiveHull);
        });
    }

    function isLearningPathPendingPayload(payload) {
        return String(payload && payload.status || '').trim().toLowerCase() === 'pending';
    }

    function buildLearningPathPendingHtml(payload, options) {
        const title = resolveLearningPathTitle(payload || {});
        const sourcePath = String(payload && payload.sourcePath || '').trim();
        const targetLabel = String(payload && (payload.graphTargetLabel || payload.graphTargetId || payload.atomId) || '').trim();
        const pendingMode = options && options.previewAvailable === true ? 'preview' : 'placeholder';
        return `
            <div class="agent-learning-path-pending" data-agent-learning-path-pending="true" data-agent-learning-path-pending-mode="${escapeHtml(pendingMode)}">
                <div class="agent-learning-path-pending-title">${escapeHtml(translate('agentWorkspace.learningPath.pendingTitle', 'Preparing Learning Path'))}</div>
                <div class="agent-learning-path-pending-copy">${escapeHtml(translate('agentWorkspace.learningPath.pendingCopy', 'Opening the workspace now while the path service builds graph-aware guidance.'))}</div>
                <div class="agent-learning-path-pending-meta">
                    ${targetLabel ? `<span>${escapeHtml(targetLabel)}</span>` : ''}
                    ${sourcePath ? `<span>${escapeHtml(sourcePath)}</span>` : ''}
                    ${title ? `<span>${escapeHtml(title)}</span>` : ''}
                </div>
            </div>
        `;
    }

    function clearHostedGodotFuturePathProjection() {
        state.godotFuturePath.request = null;
        state.godotFuturePath.projection = null;
        state.godotFuturePath.lastDispatch = {
            runtime: 'hosted-path-engine',
            targetId: '',
            available: false,
            reason: 'pending_learning_path',
            treeNodeCount: 0,
            runtimeDiagnostics: state.godotFuturePath.runtimeDiagnostics
                ? cloneJsonPayload(state.godotFuturePath.runtimeDiagnostics)
                : null,
        };
        window.__NC_LAST_AGENT_GODOT_FUTURE_PATH_REQUEST = null;
        window.__NC_LAST_AGENT_GODOT_FUTURE_PATH_LAYOUT = null;
    }

    function renderLearningPathBody(payload) {
        const body = getPaneBodyElement('learning-path');
        if (!body) {
            return;
        }
        if (isLearningPathPendingPayload(payload || {})) {
            const projection = buildHostedGodotFuturePathForPayload(payload || {});
            if (projection && projection.available === true) {
                body.innerHTML = `
                    ${buildLearningPathPendingHtml(payload || {}, { previewAvailable: true })}
                    ${buildHostedFuturePathSurfaceHtml(projection)}
                    ${buildLearningPathPaneReaderHtml()}
                    ${buildLearningPathDeveloperDetailsHtml(payload || {})}
                `;
                bindPaneLocalNodeReaderClose(body, 'learning-path');
                bindHostedFuturePathSurface(body, payload || {});
                return;
            }
            clearHostedGodotFuturePathProjection();
            body.innerHTML = buildLearningPathPendingHtml(payload || {}, { previewAvailable: false });
            return;
        }
        const projection = buildHostedGodotFuturePathForPayload(payload || {});
        body.innerHTML = `
            ${buildHostedFuturePathSurfaceHtml(projection)}
            ${buildLearningPathPaneReaderHtml()}
            ${buildLearningPathDeveloperDetailsHtml(payload || {})}
        `;
        bindPaneLocalNodeReaderClose(body, 'learning-path');
        bindHostedFuturePathSurface(body, payload || {});
    }

    function humanizeEvidenceRelationKind(value) {
        return String(value || '')
            .trim()
            .replace(/_/g, ' ');
    }

    function formatEvidenceConfidence(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        }
        const pctValue = numericValue <= 1
            ? numericValue * 100
            : numericValue;
        return `${String(Number(pctValue.toFixed(1)))}%`;
    }

    function buildEvidenceMetricListHtml(metrics) {
        return metrics.map((metric) => `
            <li class="agent-pane-list-item">
                <span class="agent-pane-list-label">${escapeHtml(metric.title)}</span>
                <span class="agent-pane-meta">${escapeHtml(metric.value)}</span>
            </li>
        `).join('');
    }

    function countRagFragmentsByRole(fragments, role) {
        return fragments.filter((fragment) => String(fragment && fragment.role || '').trim() === role).length;
    }

    function countRagSourceDecisionsByStatus(sourceDecisions, status) {
        return sourceDecisions.filter((decision) => String(decision && decision.status || '').trim() === status).length;
    }

    function translateRagSufficiencyStatus(value) {
        const normalizedValue = String(value || '').trim().toLowerCase();
        if (normalizedValue === 'sufficient') {
            return translate('agentWorkspace.evidence.ragStatusSufficient', 'Sufficient');
        }
        if (normalizedValue === 'borderline') {
            return translate('agentWorkspace.evidence.ragStatusBorderline', 'Borderline');
        }
        if (normalizedValue === 'insufficient') {
            return translate('agentWorkspace.evidence.ragStatusInsufficient', 'Insufficient');
        }
        return humanizeEvidenceRelationKind(value);
    }

    function translateRagDegradationState(value) {
        const normalizedValue = String(value || '').trim().toLowerCase();
        if (!normalizedValue || normalizedValue === 'none') {
            return translate('agentWorkspace.evidence.ragDegradationNone', 'No degradation');
        }
        if (normalizedValue === 'partial_coverage') {
            return translate('agentWorkspace.evidence.ragDegradationPartialCoverage', 'Partial evidence coverage');
        }
        if (normalizedValue === 'conflict') {
            return translate('agentWorkspace.evidence.ragDegradationConflict', 'Conflicting evidence');
        }
        if (normalizedValue === 'insufficient') {
            return translate('agentWorkspace.evidence.ragDegradationInsufficient', 'Insufficient evidence');
        }
        if (normalizedValue === 'stale_evidence') {
            return translate('agentWorkspace.evidence.ragDegradationStaleEvidence', 'Stale evidence');
        }
        return humanizeEvidenceRelationKind(value);
    }

    function translateRagSourceBoundary(value) {
        const normalizedValue = String(value || '').trim().toLowerCase();
        if (normalizedValue === 'full_document') {
            return translate('agentWorkspace.evidence.ragSourceBoundaryFullDocument', 'Full selected document');
        }
        if (normalizedValue === 'source_window') {
            return translate('agentWorkspace.evidence.ragSourceBoundarySourceWindow', 'Selected source window');
        }
        if (normalizedValue === 'snippet_only') {
            return translate('agentWorkspace.evidence.ragSourceBoundarySnippetOnly', 'Snippet only');
        }
        return humanizeEvidenceRelationKind(value);
    }

    function translateRagDiagnosticToken(value) {
        const rawValue = String(value || '').trim();
        const separatorIndex = rawValue.indexOf(':');
        const token = (separatorIndex >= 0 ? rawValue.slice(0, separatorIndex) : rawValue).trim().toLowerCase();
        const detail = separatorIndex >= 0 ? rawValue.slice(separatorIndex + 1).trim() : '';
        let label = '';
        if (token === 'partial_coverage') {
            label = translate('agentWorkspace.evidence.ragReasonPartialCoverage', 'partial coverage');
        } else if (token === 'conflict') {
            label = translate('agentWorkspace.evidence.ragReasonConflict', 'conflict');
        } else if (token === 'insufficient') {
            label = translate('agentWorkspace.evidence.ragReasonInsufficient', 'insufficient evidence');
        } else if (token === 'source_window_unavailable') {
            label = translate('agentWorkspace.evidence.ragReasonSourceWindowUnavailable', 'source window unavailable');
        } else if (token === 'context_budget_limited') {
            label = translate('agentWorkspace.evidence.ragReasonContextBudgetLimited', 'context budget limited');
        } else if (token === 'graph_neighbor_evidence_missing') {
            label = translate('agentWorkspace.evidence.ragReasonGraphNeighborEvidenceMissing', 'graph neighbor evidence missing');
        } else if (token === 'llm_judge_failed') {
            label = translate('agentWorkspace.evidence.ragReasonLlmJudgeFailed', 'LLM judge fallback');
        } else if (token === 'context_assembly') {
            label = translate('agentWorkspace.evidence.ragFailureContextAssembly', 'context assembly');
        } else if (token === 'graph_evidence') {
            label = translate('agentWorkspace.evidence.ragFailureGraphEvidence', 'graph evidence');
        } else if (token === 'parsing_source') {
            label = translate('agentWorkspace.evidence.ragFailureParsingSource', 'source parsing');
        } else if (token === 'generation') {
            label = translate('agentWorkspace.evidence.ragFailureGeneration', 'generation');
        } else if (token === 'release_generation') {
            label = translate('agentWorkspace.evidence.ragFailureReleaseGeneration', 'release review');
        } else {
            label = humanizeEvidenceRelationKind(token);
        }
        return detail ? `${label}: ${detail}` : label;
    }

    function buildRagEvidenceStatusSummary(ragSufficiencyReview, sourceDecisions) {
        const status = translateRagSufficiencyStatus(ragSufficiencyReview && ragSufficiencyReview.status)
            || translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const degradation = translateRagDegradationState(ragSufficiencyReview && ragSufficiencyReview.degradationState);
        const unavailableCount = countRagSourceDecisionsByStatus(sourceDecisions, 'source_window_unavailable');
        const truncatedCount = countRagSourceDecisionsByStatus(sourceDecisions, 'fragment_truncated');
        const droppedCount = countRagSourceDecisionsByStatus(sourceDecisions, 'fragment_dropped');
        const issues = [
            unavailableCount > 0
                ? translate('agentWorkspace.evidence.ragStatusUnavailableSources', '{count} unavailable source window(s)', { count: String(unavailableCount) })
                : '',
            truncatedCount > 0
                ? translate('agentWorkspace.evidence.ragStatusTruncatedFragments', '{count} truncated fragment(s)', { count: String(truncatedCount) })
                : '',
            droppedCount > 0
                ? translate('agentWorkspace.evidence.ragStatusDroppedFragments', '{count} dropped fragment(s)', { count: String(droppedCount) })
                : '',
        ].filter(Boolean);
        return translate('agentWorkspace.evidence.ragStatusSummary', '{status}; {degradation}; {issues}', {
            status,
            degradation,
            issues: issues.length > 0
                ? issues.join(', ')
                : translate('agentWorkspace.evidence.ragStatusNoEvidenceLoss', 'no evidence loss recorded'),
        });
    }

    function formatRagWordList(values, noneLabel) {
        const normalizedValues = Array.isArray(values)
            ? values
                .map((value) => translateRagDiagnosticToken(value))
                .filter(Boolean)
            : [];
        return normalizedValues.length > 0 ? normalizedValues.join(', ') : noneLabel;
    }

    function formatRagCountWithLimit(count, limit) {
        const numericCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
        const numericLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : null;
        return numericLimit && numericLimit > 0
            ? `${String(numericCount)}/${String(numericLimit)}`
            : String(numericCount);
    }

    function buildEvidenceRagContextHtml(payload) {
        const ragContextPack = payload && payload.ragContextPack && typeof payload.ragContextPack === 'object'
            ? payload.ragContextPack
            : null;
        const ragSufficiencyReview = payload && payload.ragSufficiencyReview && typeof payload.ragSufficiencyReview === 'object'
            ? payload.ragSufficiencyReview
            : null;
        const ragRecovery = payload && payload.ragRecovery && typeof payload.ragRecovery === 'object'
            ? payload.ragRecovery
            : null;
        const ragFailureClassifications = Array.isArray(payload && payload.ragFailureClassifications)
            ? payload.ragFailureClassifications.filter((classification) => classification && typeof classification === 'object')
            : [];
        if (!ragContextPack && !ragSufficiencyReview && !ragRecovery && ragFailureClassifications.length <= 0) {
            return '';
        }

        const noneLabel = translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const fragments = Array.isArray(ragContextPack && ragContextPack.fragments)
            ? ragContextPack.fragments.filter((fragment) => fragment && typeof fragment === 'object')
            : [];
        const sourceDecisions = Array.isArray(ragContextPack && ragContextPack.sourceDecisions)
            ? ragContextPack.sourceDecisions.filter((decision) => decision && typeof decision === 'object')
            : [];
        const budget = ragContextPack && ragContextPack.budget && typeof ragContextPack.budget === 'object'
            ? ragContextPack.budget
            : {};
        const reviewScore = Number(ragSufficiencyReview && ragSufficiencyReview.score);
        const reviewStatus = String(ragSufficiencyReview && ragSufficiencyReview.status || '').trim();
        const reviewStatusValue = reviewStatus
            ? [
                translateRagSufficiencyStatus(reviewStatus),
                Number.isFinite(reviewScore) ? `(${formatEvidenceConfidence(reviewScore)})` : '',
            ].filter(Boolean).join(' ')
            : noneLabel;
        const replayId = String(ragContextPack && ragContextPack.replayId || '').trim();
        const failureStages = Array.from(new Set(
            ragFailureClassifications
                .map((classification) => String(classification && classification.stage || '').trim())
                .filter(Boolean)
        ));
        const totalCharCount = Number.isFinite(Number(ragContextPack && ragContextPack.totalCharCount))
            ? Number(ragContextPack.totalCharCount)
            : 0;
        const maxTotalChars = Number.isFinite(Number(budget.maxTotalChars))
            ? Number(budget.maxTotalChars)
            : null;
        const metrics = [
            {
                title: translate('agentWorkspace.evidence.ragStatusSummaryLabel', 'Evidence status'),
                value: buildRagEvidenceStatusSummary(ragSufficiencyReview, sourceDecisions),
            },
            {
                title: translate('agentWorkspace.evidence.ragSufficiencyLabel', 'Sufficiency'),
                value: reviewStatusValue,
            },
            {
                title: translate('agentWorkspace.evidence.ragSourceBoundaryLabel', 'Source boundary'),
                value: translateRagSourceBoundary(ragContextPack && ragContextPack.sourceBoundary) || noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.ragFragmentsLabel', 'Fragments'),
                value: formatRagCountWithLimit(fragments.length, budget.maxFragments),
            },
            {
                title: translate('agentWorkspace.evidence.ragBudgetLabel', 'Context budget'),
                value: maxTotalChars && maxTotalChars > 0
                    ? `${String(totalCharCount)}/${String(maxTotalChars)} chars`
                    : `${String(totalCharCount)} chars`,
            },
            {
                title: translate('agentWorkspace.evidence.ragDirectSupportLabel', 'Direct support'),
                value: String(countRagFragmentsByRole(fragments, 'direct_support')),
            },
            {
                title: translate('agentWorkspace.evidence.ragDocumentAugmentationLabel', 'Document augmentation'),
                value: String(
                    countRagFragmentsByRole(fragments, 'parent_context')
                    + countRagFragmentsByRole(fragments, 'adjacent_context')
                ),
            },
            {
                title: translate('agentWorkspace.evidence.ragGraphNeighborSupportLabel', 'Graph neighbor support'),
                value: String(countRagFragmentsByRole(fragments, 'graph_neighbor_support')),
            },
            {
                title: translate('agentWorkspace.evidence.ragTruncatedFragmentsLabel', 'Truncated fragments'),
                value: String(countRagSourceDecisionsByStatus(sourceDecisions, 'fragment_truncated')),
            },
            {
                title: translate('agentWorkspace.evidence.ragDroppedFragmentsLabel', 'Dropped fragments'),
                value: String(countRagSourceDecisionsByStatus(sourceDecisions, 'fragment_dropped')),
            },
            {
                title: translate('agentWorkspace.evidence.ragUnavailableSourcesLabel', 'Unavailable source windows'),
                value: String(countRagSourceDecisionsByStatus(sourceDecisions, 'source_window_unavailable')),
            },
            {
                title: translate('agentWorkspace.evidence.ragDegradationLabel', 'Degradation'),
                value: translateRagDegradationState(ragSufficiencyReview && ragSufficiencyReview.degradationState) || noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.ragRecoveryLabel', 'Recovery'),
                value: ragRecovery && ragRecovery.attempted
                    ? [
                        translateRagSufficiencyStatus(ragRecovery.beforeStatus),
                        '->',
                        translateRagSufficiencyStatus(ragRecovery.afterStatus),
                        `+${String(Number(ragRecovery.addedFragmentCount || 0))}`,
                    ].filter(Boolean).join(' ')
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.ragReasonsLabel', 'Reasons'),
                value: formatRagWordList(ragSufficiencyReview && ragSufficiencyReview.reasons, noneLabel),
            },
            {
                title: translate('agentWorkspace.evidence.ragFailureStagesLabel', 'Failure stages'),
                value: formatRagWordList(failureStages, noneLabel),
            },
        ];
        if (replayId) {
            metrics.unshift({
                title: translate('agentWorkspace.evidence.ragReplayIdLabel', 'Replay id'),
                value: replayId,
            });
        }

        return `
            <div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.ragContextLabel', 'RAG context'))}</div>
            <ul class="agent-pane-list">${buildEvidenceMetricListHtml(metrics)}</ul>
        `;
    }

    function buildEvidenceGraphContextHtml(payload) {
        const graphContext = payload && typeof payload.graphContext === 'object'
            ? payload.graphContext
            : null;
        if (!graphContext) {
            return '';
        }

        const noneLabel = translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const anchorTitle = String(graphContext.anchorTitle || '').trim() || noneLabel;
        const anchorAtomId = String(graphContext.anchorAtomId || '').trim() || noneLabel;
        const anchorDocumentId = String(graphContext.anchorDocumentId || '').trim() || noneLabel;
        const relationKinds = Array.isArray(graphContext.relationKinds)
            ? graphContext.relationKinds
                .map((item) => humanizeEvidenceRelationKind(item))
                .filter(Boolean)
            : [];
        const supportingTitles = Array.isArray(graphContext.supportingTitles)
            ? graphContext.supportingTitles
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        const supportingAtomIds = Array.isArray(graphContext.supportingAtomIds)
            ? graphContext.supportingAtomIds
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        const relationSummaries = Array.isArray(graphContext.relationSummaries)
            ? graphContext.relationSummaries
                .map((item) => item && typeof item === 'object' ? item : null)
                .filter(Boolean)
            : [];
        const knowledgePointRelations = Array.isArray(graphContext.knowledgePointRelations)
            ? graphContext.knowledgePointRelations
                .map((item) => item && typeof item === 'object' ? item : null)
                .filter(Boolean)
            : [];
        const connectionPaths = Array.isArray(graphContext.connectionPaths)
            ? graphContext.connectionPaths
                .map((item) => item && typeof item === 'object' ? item : null)
                .filter(Boolean)
            : [];
        const predecessorWindow = Array.isArray(graphContext.predecessorWindow)
            ? graphContext.predecessorWindow
                .map((item) => item && typeof item === 'object' ? item : null)
                .filter(Boolean)
            : [];
        const successorWindow = Array.isArray(graphContext.successorWindow)
            ? graphContext.successorWindow
                .map((item) => item && typeof item === 'object' ? item : null)
                .filter(Boolean)
            : [];
        const evidenceSourceRefs = Array.isArray(graphContext.evidenceSourceRefs)
            ? graphContext.evidenceSourceRefs
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        const graphDiagnostics = graphContext.diagnostics && typeof graphContext.diagnostics === 'object'
            ? graphContext.diagnostics
            : null;
        const temporalValidity = graphContext.temporalValidity && typeof graphContext.temporalValidity === 'object'
            ? graphContext.temporalValidity
            : null;

        const contextMetrics = [
            {
                title: translate('agentWorkspace.evidence.graphAnchorLabel', 'Anchor'),
                value: anchorTitle,
            },
            {
                title: translate('agentWorkspace.evidence.graphAnchorAtomIdLabel', 'Anchor atom'),
                value: anchorAtomId,
            },
            {
                title: translate('agentWorkspace.evidence.graphAnchorDocumentLabel', 'Anchor document'),
                value: anchorDocumentId,
            },
            {
                title: translate('agentWorkspace.evidence.graphRelationKindsLabel', 'Relation kinds'),
                value: relationKinds.length > 0 ? relationKinds.join(', ') : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphSupportingTitlesLabel', 'Supporting titles'),
                value: supportingTitles.length > 0 ? supportingTitles.join(', ') : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphSupportingAtomsLabel', 'Supporting atoms'),
                value: supportingAtomIds.length > 0 ? supportingAtomIds.join(', ') : noneLabel,
            },
        ];

        const relationSummaryHtml = relationSummaries.length > 0
            ? relationSummaries.map((summary) => {
                const targetAtomIds = Array.isArray(summary.targetAtomIds)
                    ? summary.targetAtomIds
                        .map((item) => String(item || '').trim())
                        .filter(Boolean)
                    : [];
                const targetSummary = translate(
                    'agentWorkspace.evidence.graphRelationTargetsLabel',
                    'Targets: {count}',
                    { count: String(targetAtomIds.length) }
                );
                const sourceAtomIds = Array.isArray(summary.sourceAtomIds)
                    ? summary.sourceAtomIds
                        .map((item) => String(item || '').trim())
                        .filter(Boolean)
                    : [];
                const sourceSummary = sourceAtomIds.length > 0
                    ? ` | ${escapeHtml(translate('agentWorkspace.evidence.graphRelationSourcesLabel', 'Sources: {sources}', {
                        sources: sourceAtomIds.join(', '),
                    }))}`
                    : '';
                const confidenceSummary = translate(
                    'agentWorkspace.evidence.graphRelationConfidenceLabel',
                    'Avg confidence: {confidence}',
                    { confidence: formatEvidenceConfidence(summary.averageConfidence) }
                );
                return `
                    <li class="agent-pane-list-item">
                        <div>
                            <div class="agent-pane-list-label">${escapeHtml(humanizeEvidenceRelationKind(summary.relationKind))}</div>
                            <div class="agent-pane-summary">${escapeHtml(targetSummary)}${targetAtomIds.length > 0 ? ` | ${escapeHtml(targetAtomIds.join(', '))}` : ''}${sourceSummary}</div>
                        </div>
                        <span class="agent-pane-meta">${escapeHtml(confidenceSummary)}</span>
                    </li>
                `;
            }).join('')
            : `<li class="agent-pane-list-empty">${escapeHtml(noneLabel)}</li>`;
        const knowledgePointRelationHtml = knowledgePointRelations.length > 0
            ? knowledgePointRelations.map((relation) => {
                const relationLabel = `${String(relation.sourceTitle || noneLabel)} -> ${humanizeEvidenceRelationKind(relation.relationKind)} -> ${String(relation.targetTitle || noneLabel)}`;
                const relationAtoms = `${String(relation.sourceAtomId || noneLabel)} -> ${String(relation.targetAtomId || noneLabel)}`;
                return `
                    <li class="agent-pane-list-item">
                        <div>
                            <div class="agent-pane-list-label">${escapeHtml(relationLabel)}</div>
                            <div class="agent-pane-summary">${escapeHtml(relationAtoms)}</div>
                        </div>
                        <span class="agent-pane-meta">${escapeHtml(formatEvidenceConfidence(relation.confidence))}</span>
                    </li>
                `;
            }).join('')
            : '';
        const connectionPathHtml = connectionPaths.length > 0
            ? connectionPaths.map((connectionPath) => {
                const pathTitles = Array.isArray(connectionPath.pathTitles)
                    ? connectionPath.pathTitles.map((item) => String(item || '').trim()).filter(Boolean)
                    : [];
                const pathSummary = pathTitles.length > 0 ? pathTitles.join(' -> ') : noneLabel;
                const pathLengthLabel = translate(
                    'agentWorkspace.evidence.graphConnectionPathLengthLabel',
                    'Length: {length}',
                    { length: String(Number(connectionPath.length || 0)) }
                );
                return `
                    <li class="agent-pane-list-item">
                        <div>
                            <div class="agent-pane-list-label">${escapeHtml(pathSummary)}</div>
                            <div class="agent-pane-summary">${escapeHtml(String(connectionPath.sourceTitle || noneLabel))} -> ${escapeHtml(String(connectionPath.targetTitle || noneLabel))}</div>
                        </div>
                        <span class="agent-pane-meta">${escapeHtml(pathLengthLabel)}</span>
                    </li>
                `;
            }).join('')
            : '';
        const buildWindowHtml = (nodes) => nodes.length > 0
            ? nodes.map((node) => {
                const relationSummary = node.relationKind
                    ? humanizeEvidenceRelationKind(node.relationKind)
                    : noneLabel;
                const confidenceSummary = Number.isFinite(Number(node.confidence))
                    ? formatEvidenceConfidence(node.confidence)
                    : noneLabel;
                return `
                    <li class="agent-pane-list-item">
                        <div>
                            <div class="agent-pane-list-label">${escapeHtml(String(node.title || noneLabel))}</div>
                            <div class="agent-pane-summary">${escapeHtml(String(node.atomId || noneLabel))} | ${escapeHtml(relationSummary)}</div>
                        </div>
                        <span class="agent-pane-meta">${escapeHtml(confidenceSummary)}</span>
                    </li>
                `;
            }).join('')
            : '';
        const predecessorWindowHtml = buildWindowHtml(predecessorWindow);
        const successorWindowHtml = buildWindowHtml(successorWindow);
        const evidenceSourceRefHtml = evidenceSourceRefs.length > 0
            ? evidenceSourceRefs.map((entry) => `
                <li class="agent-pane-list-item">
                    <div class="agent-pane-list-label">${escapeHtml(entry)}</div>
                </li>
            `).join('')
            : '';
        const diagnosticsMetrics = graphDiagnostics
            ? [
                {
                    title: translate('agentWorkspace.evidence.graphDiagnosticsOpsLabel', 'Graph ops'),
                    value: graphDiagnostics.graphOpsAvailable === true
                        ? translate('agentWorkspace.evidence.graphDiagnosticsAvailableLabel', 'available')
                        : translate('agentWorkspace.evidence.graphDiagnosticsUnavailableLabel', 'unavailable'),
                },
                {
                    title: translate('agentWorkspace.evidence.graphDiagnosticsFallbackLabel', 'Fallback'),
                    value: graphDiagnostics.usedFallback === true ? 'true' : 'false',
                },
                {
                    title: translate('agentWorkspace.evidence.graphDiagnosticsAnchorReasonLabel', 'Anchor reason'),
                    value: String(graphDiagnostics.selectedAnchorReason || '').trim() || noneLabel,
                },
                {
                    title: translate('agentWorkspace.evidence.graphDiagnosticsCandidateCountLabel', 'Candidates'),
                    value: String(graphDiagnostics.candidateCount == null ? 0 : graphDiagnostics.candidateCount),
                },
                {
                    title: translate('agentWorkspace.evidence.graphDiagnosticsSupportCountLabel', 'Support nodes'),
                    value: `${String(graphDiagnostics.supportNodeCount == null ? 0 : graphDiagnostics.supportNodeCount)} / ${String(graphDiagnostics.supportNodeLimit == null ? 0 : graphDiagnostics.supportNodeLimit)}`,
                },
                {
                    title: translate('agentWorkspace.evidence.graphDiagnosticsBudgetLabel', 'Path depth budget'),
                    value: String(graphDiagnostics.pathDepthLimit == null ? 0 : graphDiagnostics.pathDepthLimit),
                },
                {
                    title: translate('agentWorkspace.evidence.graphDiagnosticsMissingLookupsLabel', 'Missing graph lookups'),
                    value: [
                        ...(Array.isArray(graphDiagnostics.missingConnectionPathSourceAtomIds) ? graphDiagnostics.missingConnectionPathSourceAtomIds : []),
                        ...(Array.isArray(graphDiagnostics.missingPredecessorAtomIds) ? graphDiagnostics.missingPredecessorAtomIds : []),
                        ...(Array.isArray(graphDiagnostics.missingSuccessorAtomIds) ? graphDiagnostics.missingSuccessorAtomIds : []),
                    ].filter(Boolean).join(', ') || noneLabel,
                },
            ]
            : [];

        const temporalEdgeKinds = temporalValidity && Array.isArray(temporalValidity.edgeKinds)
            ? temporalValidity.edgeKinds
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        const temporalDetails = temporalValidity && Array.isArray(temporalValidity.details)
            ? temporalValidity.details
                .map((item) => item && typeof item === 'object' ? item : null)
                .filter(Boolean)
            : [];
        const temporalMetrics = temporalValidity
            ? [
                {
                    title: translate('agentWorkspace.evidence.graphTemporalStatusLabel', 'Status'),
                    value: temporalValidity.allPointsValid === false
                        ? translate('agentWorkspace.evidence.graphTemporalWarning', 'warning')
                        : translate('agentWorkspace.evidence.graphTemporalValid', 'valid'),
                },
                {
                    title: translate('agentWorkspace.evidence.graphTemporalCheckedAtLabel', 'Checked at'),
                    value: String(temporalValidity.checkedAt || '').trim() || noneLabel,
                },
                {
                    title: translate('agentWorkspace.evidence.graphTemporalReasonsLabel', 'Warning reasons'),
                    value: Array.isArray(temporalValidity.warningReasons) && temporalValidity.warningReasons.length > 0
                        ? temporalValidity.warningReasons.join(', ')
                        : noneLabel,
                },
                {
                    title: translate('agentWorkspace.evidence.graphTemporalInvalidTitlesLabel', 'Invalid knowledge points'),
                    value: Array.isArray(temporalValidity.invalidKnowledgePointTitles) && temporalValidity.invalidKnowledgePointTitles.length > 0
                        ? temporalValidity.invalidKnowledgePointTitles.join(', ')
                        : noneLabel,
                },
                {
                    title: translate('agentWorkspace.evidence.graphTemporalEdgeKindsLabel', 'Temporal edge kinds'),
                    value: temporalEdgeKinds.length > 0
                        ? temporalEdgeKinds.join(', ')
                        : noneLabel,
                },
            ]
            : [];
        const temporalDetailHtml = temporalDetails.length > 0
            ? temporalDetails.map((detail) => `
                <li class="agent-pane-list-item">
                    <div>
                        <div class="agent-pane-list-label">${escapeHtml(String(detail.edgeKind || noneLabel))}</div>
                        <div class="agent-pane-summary">${escapeHtml(String(detail.sourceAtomId || noneLabel))} -> ${escapeHtml(String(detail.targetAtomId || noneLabel))}</div>
                    </div>
                    <span class="agent-pane-meta">${escapeHtml(String(detail.edgeId || noneLabel))}</span>
                </li>
            `).join('')
            : '';

        return `
            <div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphContextLabel', 'Graph context'))}</div>
            <ul class="agent-pane-list">${buildEvidenceMetricListHtml(contextMetrics)}</ul>
            <div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphRelationSummariesLabel', 'Relation summaries'))}</div>
            <ul class="agent-pane-list">${relationSummaryHtml}</ul>
            ${knowledgePointRelationHtml ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphKnowledgePointRelationsLabel', 'Knowledge-point relations'))}</div><ul class="agent-pane-list">${knowledgePointRelationHtml}</ul>` : ''}
            ${connectionPathHtml ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphConnectionPathsLabel', 'Connection paths'))}</div><ul class="agent-pane-list">${connectionPathHtml}</ul>` : ''}
            ${predecessorWindowHtml ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphPredecessorsLabel', 'Immediate predecessors'))}</div><ul class="agent-pane-list">${predecessorWindowHtml}</ul>` : ''}
            ${successorWindowHtml ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphSuccessorsLabel', 'Immediate successors'))}</div><ul class="agent-pane-list">${successorWindowHtml}</ul>` : ''}
            ${evidenceSourceRefHtml ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphEvidenceRefsLabel', 'Source references'))}</div><ul class="agent-pane-list">${evidenceSourceRefHtml}</ul>` : ''}
            ${temporalMetrics.length > 0 ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphTemporalLabel', 'Temporal validity'))}</div><ul class="agent-pane-list">${buildEvidenceMetricListHtml(temporalMetrics)}</ul>` : ''}
            ${temporalDetailHtml ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphTemporalDetailsLabel', 'Temporal edge details'))}</div><ul class="agent-pane-list">${temporalDetailHtml}</ul>` : ''}
            ${diagnosticsMetrics.length > 0 ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphDiagnosticsLabel', 'Graph diagnostics'))}</div><ul class="agent-pane-list">${buildEvidenceMetricListHtml(diagnosticsMetrics)}</ul>` : ''}
        `;
    }

    function renderEvidenceGroundingBody(body, payload) {
        const title = String(
            payload.title
            || translate('agentWorkspace.evidence.groundingTitle', 'Grounding Inspector')
        ).trim();
        const scopeLabel = String(payload.scopeLabel || '').trim()
            || translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const readinessMessage = String(payload.readinessMessage || '').trim();
        const missMessage = String(payload.missMessage || '').trim();
        const metrics = [
            {
                title: translate('agentWorkspace.evidence.scopeLabel', 'Scope'),
                value: scopeLabel,
            },
            {
                title: translate('agentWorkspace.evidence.citationsLabel', 'Citations'),
                value: String(payload.citationCount == null ? 0 : payload.citationCount),
            },
            {
                title: translate('agentWorkspace.evidence.memoriesLabel', 'Recalled memories'),
                value: String(payload.memoryCount == null ? 0 : payload.memoryCount),
            },
            {
                title: translate('agentWorkspace.evidence.memoryActionsLabel', 'Memory actions'),
                value: String(payload.memoryActionCount == null ? 0 : payload.memoryActionCount),
            },
        ];
        const metricsHtml = buildEvidenceMetricListHtml(metrics);
        const ragContextHtml = buildEvidenceRagContextHtml(payload);
        const graphContextHtml = buildEvidenceGraphContextHtml(payload);
        body.innerHTML = `
            <div class="agent-pane-block">
                <div class="agent-pane-title">${escapeHtml(title)}</div>
                <ul class="agent-pane-list">${metricsHtml}</ul>
                ${readinessMessage ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.readinessLabel', 'Workspace readiness'))}</div><div class="agent-pane-summary">${escapeHtml(readinessMessage)}</div>` : ''}
                ${missMessage ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.missLabel', 'Scope recovery'))}</div><div class="agent-pane-summary">${escapeHtml(missMessage)}</div>` : ''}
                ${ragContextHtml}
                ${graphContextHtml}
            </div>
        `;
    }

    function renderEvidenceCardBody(body, payload, renderCard) {
        if (!body || typeof renderCard !== 'function') {
            return;
        }
        body.innerHTML = '';
        const node = document.createElement('div');
        node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
        node.setAttribute('data-agent-workspace-card-kind', String(payload && payload.kind || 'evidence').trim() || 'evidence');
        node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
        body.appendChild(node);
        renderCard(node, payload || {});
    }

    function renderEvidenceBody(payload) {
        const body = getPaneBodyElement('evidence');
        if (!body) {
            return;
        }
        const kind = String(payload && payload.kind || '').trim();
        if (kind === 'grounding') {
            renderEvidenceGroundingBody(body, payload || {});
            return;
        }
        if (kind === 'flashcard_batch') {
            renderEvidenceCardBody(body, payload, renderFlashcardBatchCard);
            return;
        }
        if (kind === 'knowledge_run') {
            renderEvidenceCardBody(body, payload, renderKnowledgeRunCard);
            return;
        }
        if (kind === 'knowledge_run_history') {
            renderEvidenceCardBody(body, payload, renderKnowledgeRunHistoryCard);
            return;
        }
        if (kind === 'knowledge_run_compare') {
            renderEvidenceCardBody(body, payload, renderKnowledgeRunCompareCard);
            return;
        }
        body.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.evidence.emptyIdle', 'Evidence pane is idle.'))}</div>`;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderStudySessionCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.studySession.cardTitle',
            'Study Session Plan'
        );
        const summaryText = translate(
            'agentWorkspace.studySession.summary',
            '{totalActions} actions, about {totalEstimatedMinutes} minutes.',
            {
                totalActions: String(summary.totalActions == null ? 0 : summary.totalActions),
                totalEstimatedMinutes: String(summary.totalEstimatedMinutes == null ? 0 : summary.totalEstimatedMinutes),
            }
        );
        const actionsHeading = translate(
            'agentWorkspace.studySession.actionsHeading',
            'Recommended Actions'
        );
        const emptyText = translate(
            'agentWorkspace.studySession.empty',
            'No study actions returned.'
        );
        const actions = Array.isArray(summary.actions) ? summary.actions : [];
        const actionsHtml = actions.length > 0
            ? actions.map((action, index) => {
                const kind = String(action && action.kind || '').trim();
                const atomId = String(action && action.atomId || '').trim();
                const rationale = String(action && action.rationale || '').trim();
                const titleText = [kind, atomId].filter(Boolean).join(' ');
                return `
                    <li class="agent-chat-card-list-item">
                        <div class="agent-chat-card-list-title">${escapeHtml(titleText || `Action ${index + 1}`)}</div>
                        <div class="agent-chat-card-list-meta">${escapeHtml(rationale)}</div>
                    </li>
                `;
            }).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(emptyText)}</li>`;
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(actionsHeading)}</div>
                <ul class="agent-chat-card-list">${actionsHtml}</ul>
            </div>
        `;
    }

    function renderSessionHistoryCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.sessionHistory.cardTitle',
            'Session History'
        );
        const summaryText = translate(
            'agentWorkspace.sessionHistory.summary',
            '{matchedRecordsBeforeLimit} sessions in last {sinceMinutes} minutes; avg mastery delta {averageMasteryDeltaPct}%.',
            {
                matchedRecordsBeforeLimit: String(summary.matchedRecordsBeforeLimit == null ? 0 : summary.matchedRecordsBeforeLimit),
                sinceMinutes: String(summary.sinceMinutes == null ? 0 : summary.sinceMinutes),
                averageMasteryDeltaPct: String(summary.averageMasteryDeltaPct == null ? 0 : summary.averageMasteryDeltaPct),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.sessionHistory.metricsHeading',
            'Key Metrics'
        );
        const latestExecutedAt = String(summary.latestExecutedAt || '').trim();
        const latestDisplay = latestExecutedAt
            || translate('agentWorkspace.sessionHistory.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.sessionHistory.totalExecutedLabel', 'Total executed actions'),
                value: String(summary.totalExecutedActions == null ? 0 : summary.totalExecutedActions),
            },
            {
                title: translate('agentWorkspace.sessionHistory.updatedMasteryLabel', 'Updated mastery count'),
                value: String(summary.totalUpdatedMasteryCount == null ? 0 : summary.totalUpdatedMasteryCount),
            },
            {
                title: translate('agentWorkspace.sessionHistory.averageTutorConfidenceLabel', 'Average tutor confidence'),
                value: String(summary.averageTutorConfidencePct == null ? 0 : summary.averageTutorConfidencePct) + '%',
            },
            {
                title: translate('agentWorkspace.sessionHistory.latestExecutedAtLabel', 'Latest executed at'),
                value: latestDisplay,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderFlashcardBatchCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.reply.flashcardBatch.cardTitle',
            'Review Card Batch'
        );
        const summaryText = translate(
            'agentWorkspace.reply.flashcardBatch.summary',
            '{returnedArtifacts} artifact(s), {remainingCards}/{totalCards} review card(s) remaining.',
            {
                returnedArtifacts: String(summary.returnedArtifacts == null ? 0 : summary.returnedArtifacts),
                remainingCards: String(summary.remainingCards == null ? 0 : summary.remainingCards),
                totalCards: String(summary.totalCards == null ? 0 : summary.totalCards),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.reply.flashcardBatch.metricsHeading',
            'Key Metrics'
        );
        const noneLabel = translate(
            'agentWorkspace.reply.flashcardBatch.none',
            'none'
        );
        const artifactStatusToken = String(summary.artifactStatus || '').trim().toLowerCase();
        const artifactStatusLabel = artifactStatusToken === 'archived'
            ? translate('agentWorkspace.reply.flashcardBatch.statusArchived', 'archived')
            : artifactStatusToken === 'active'
                ? translate('agentWorkspace.reply.flashcardBatch.statusActive', 'active')
                : (String(summary.artifactStatusLabel || '').trim() || noneLabel);
        const metrics = [
            {
                title: translate(
                    'agentWorkspace.reply.flashcardBatch.artifactKindsLabel',
                    'Artifact kinds'
                ),
                value: String(summary.artifactKinds || '').trim() || noneLabel,
            },
            {
                title: translate(
                    'agentWorkspace.reply.flashcardBatch.topPromptLabel',
                    'Top prompt'
                ),
                value: String(summary.topPrompt || '').trim() || noneLabel,
            },
            {
                title: translate(
                    'agentWorkspace.reply.flashcardBatch.topEvidenceLabel',
                    'Top evidence'
                ),
                value: String(summary.topEvidenceRef || '').trim() || noneLabel,
            },
            {
                title: translate(
                    'agentWorkspace.reply.flashcardBatch.completedLabel',
                    'Completed cards'
                ),
                value: String(summary.completedCards == null ? 0 : summary.completedCards),
            },
            {
                title: translate(
                    'agentWorkspace.reply.flashcardBatch.remainingLabel',
                    'Remaining cards'
                ),
                value: String(summary.remainingCards == null ? 0 : summary.remainingCards),
            },
            {
                title: translate(
                    'agentWorkspace.reply.flashcardBatch.statusLabel',
                    'Artifact status'
                ),
                value: artifactStatusLabel,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        const nextCapability = summary && summary.nextCapability && typeof summary.nextCapability === 'object'
            ? summary.nextCapability
            : null;
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
                ${nextCapability ? `<div class="agent-chat-card-actions"><button type="button" data-agent-flashcard-follow-up="true">${escapeHtml(translate('agentWorkspace.reply.flashcardBatch.reviewNow', 'Review Now'))}</button></div>` : ''}
            </div>
        `;
        if (nextCapability) {
            const followUpButton = node.querySelector('[data-agent-flashcard-follow-up="true"]');
            if (followUpButton && typeof followUpButton.addEventListener === 'function') {
                followUpButton.addEventListener('click', function () {
                    if (!window.NoteConnectionAgentWorkspace || typeof window.NoteConnectionAgentWorkspace.executeCapability !== 'function') {
                        return;
                    }
                    void window.NoteConnectionAgentWorkspace.executeCapability({
                        atomId: String(nextCapability.targetAtomId || '').trim(),
                        title: String(summary.topPrompt || title).trim() || title,
                    }, nextCapability, {
                        conversationCardNode: node,
                    });
                });
            }
        }
    }

    function renderKnowledgeRunCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = String(summary.title || '').trim()
            || translate('agentWorkspace.reply.knowledgeRunCardTitle', 'Knowledge Run Details');
        const qualityStatus = String(summary.qualityStatus || '').trim()
            || translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const qualityScore = Number(summary.qualityScore);
        const summaryText = Number.isFinite(qualityScore)
            ? translate(
                'agentWorkspace.reply.knowledgeRunCardSummary',
                'Run {runId}: {claimCount} claims, quality {qualityStatus}/{qualityScore}.',
                {
                    runId: String(summary.runId || '').trim() || translate('agentWorkspace.reply.knowledgeRunNone', 'none'),
                    claimCount: String(summary.claimCount == null ? 0 : summary.claimCount),
                    qualityStatus,
                    qualityScore: String(qualityScore),
                }
            )
            : translate(
                'agentWorkspace.reply.knowledgeRunCardSummaryNoScore',
                'Run {runId}: {claimCount} claims, quality {qualityStatus}.',
                {
                    runId: String(summary.runId || '').trim() || translate('agentWorkspace.reply.knowledgeRunNone', 'none'),
                    claimCount: String(summary.claimCount == null ? 0 : summary.claimCount),
                    qualityStatus,
                }
            );
        const metricsHeading = translate(
            'agentWorkspace.reply.knowledgeRunMetricsHeading',
            'Key Metrics'
        );
        const noneLabel = translate(
            'agentWorkspace.reply.knowledgeRunNone',
            'none'
        );
        const artifactStatusToken = String(summary.artifactStatus || '').trim().toLowerCase();
        const artifactStatusLabel = artifactStatusToken === 'archived'
            ? translate('agentWorkspace.reply.flashcardBatch.statusArchived', 'archived')
            : artifactStatusToken === 'active'
                ? translate('agentWorkspace.reply.flashcardBatch.statusActive', 'active')
                : (artifactStatusToken || noneLabel);
        const metrics = [
            {
                title: translate('agentWorkspace.reply.knowledgeRun', 'Knowledge Run'),
                value: String(summary.artifactTitle || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunScopeLabel', 'Scope'),
                value: String(summary.scopeLabel || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunScopeSourceLabel', 'Scope source'),
                value: String(summary.scopeSource || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunArtifactStatusLabel', 'Artifact status'),
                value: artifactStatusLabel,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunTopClaimSourceLabel', 'Top claim source'),
                value: String(summary.topClaimSourceRef || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunReviewProgressLabel', 'Review progress'),
                value: `${String(summary.completedReviewCardCount == null ? 0 : summary.completedReviewCardCount)}/${String(summary.reviewCardCount == null ? 0 : summary.reviewCardCount)}`,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        const formatAnswerReleaseDecision = (decisionLike) => {
            const decision = String(decisionLike || '').trim().toLowerCase();
            if (decision === 'release') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRelease', 'release');
            }
            if (decision === 'revise') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRevise', 'revise');
            }
            if (decision === 'abstain') {
                return translate('agentWorkspace.reply.answerReleaseDecisionAbstain', 'abstain');
            }
            if (decision === 'other') {
                return translate('agentWorkspace.reply.answerReleaseDecisionOther', 'other');
            }
            return decision || noneLabel;
        };
        const answerReleaseReview = summary.answerReleaseReview && typeof summary.answerReleaseReview === 'object'
            ? summary.answerReleaseReview
            : null;
        const answerReleaseReviewHeading = translate('agentWorkspace.reply.answerReleaseReviewHeading', 'Answer release review');
        const answerReleaseReviewItems = answerReleaseReview ? [
            {
                title: translate('agentWorkspace.reply.answerReleaseDecisionLabel', 'Decision'),
                value: formatAnswerReleaseDecision(answerReleaseReview.decision),
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseReviewedAtLabel', 'Reviewed at'),
                value: String(answerReleaseReview.reviewedAt || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseRevisedLabel', 'Revised'),
                value: answerReleaseReview.revised === true
                    ? translate('agentWorkspace.reply.answerReleaseBoolYes', 'yes')
                    : translate('agentWorkspace.reply.answerReleaseBoolNo', 'no'),
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseFailedGatesLabel', 'Failed gates'),
                value: Array.isArray(answerReleaseReview.failedGateIds) && answerReleaseReview.failedGateIds.length > 0
                    ? answerReleaseReview.failedGateIds.join(', ')
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseLeakedFragmentsLabel', 'Leaked fragments'),
                value: Array.isArray(answerReleaseReview.leakedInternalFragments) && answerReleaseReview.leakedInternalFragments.length > 0
                    ? answerReleaseReview.leakedInternalFragments.join(', ')
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseReasonLabel', 'Reason'),
                value: String(answerReleaseReview.reason || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseOriginalAnswerLabel', 'Original answer'),
                value: String(answerReleaseReview.originalAnswer || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.answerReleasePublicAnswerLabel', 'Public answer'),
                value: String(answerReleaseReview.publicAnswer || '').trim() || noneLabel,
            },
        ] : [];
        const answerReleaseReviewHtml = answerReleaseReviewItems.length > 0
            ? answerReleaseReviewItems.map((item) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(item.title)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(item.value)}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;
        const answerReleaseReviewGates = Array.isArray(answerReleaseReview && answerReleaseReview.gates)
            ? answerReleaseReview.gates
            : [];
        const answerReleaseReviewGatesHeading = translate('agentWorkspace.reply.answerReleaseReviewGatesLabel', 'Release gates');
        const answerReleaseReviewGatesHtml = answerReleaseReviewGates.length > 0
            ? answerReleaseReviewGates.map((gate) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`${gate.passed ? 'PASS' : 'CHECK'} ${String(gate.gateId || '').trim() || noneLabel}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(gate.message || '').trim() || noneLabel)}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;

        const claims = Array.isArray(summary.claims) ? summary.claims : [];
        const claimsHeading = translate('agentWorkspace.reply.knowledgeRunClaims', 'Evidence claims');
        const claimsHtml = claims.length > 0
            ? claims.map((claim, index) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`${index + 1}. ${String(claim.title || '').trim() || noneLabel} (${String(claim.status || '').trim() || 'unknown'})`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(claim.sourceRef || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(claim.snippet || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(claim.reason || '').trim() || noneLabel)}</div>
                    ${String(claim.sourcePath || '').trim() ? `<div class="agent-chat-card-actions"><button type="button" data-agent-knowledge-run-claim-inspect="${index}">${escapeHtml(translate('agentWorkspace.reply.knowledgeRunInspectEvidence', 'Inspect Evidence'))}</button></div>` : ''}
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;

        const gates = Array.isArray(summary.qualityGates) ? summary.qualityGates : [];
        const gatesHeading = translate('agentWorkspace.reply.knowledgeRunQualityGatesLabel', 'Quality gates');
        const gatesHtml = gates.length > 0
            ? gates.map((gate) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`${gate.passed ? 'PASS' : 'CHECK'} ${String(gate.gateId || '').trim()}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(gate.message || '').trim() || noneLabel)}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;

        const reviewCards = Array.isArray(summary.reviewCards) ? summary.reviewCards : [];
        const reviewCardsHeading = translate('agentWorkspace.reply.knowledgeRunReviewCards', 'Review cards');
        const reviewCardsHtml = reviewCards.length > 0
            ? reviewCards.map((card, index) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`${index + 1}. ${String(card.prompt || '').trim() || noneLabel}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(Array.isArray(card.evidenceRefs) ? card.evidenceRefs.join(', ') : noneLabel)}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;
        const graphContext = summary.graphContext && typeof summary.graphContext === 'object'
            ? summary.graphContext
            : null;
        const graphContextHeading = translate('agentWorkspace.evidence.graphContextLabel', 'Graph context');
        const graphContextItems = graphContext ? [
            {
                title: translate('agentWorkspace.evidence.graphAnchorLabel', 'Anchor'),
                value: String(graphContext.anchorTitle || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphSupportingTitlesLabel', 'Supporting titles'),
                value: Array.isArray(graphContext.supportingTitles) && graphContext.supportingTitles.length > 0
                    ? graphContext.supportingTitles.join(', ')
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphConnectionPathsLabel', 'Connection paths'),
                value: Array.isArray(graphContext.connectionPaths) && graphContext.connectionPaths.length > 0
                    ? graphContext.connectionPaths.join(' | ')
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphPredecessorsLabel', 'Immediate predecessors'),
                value: Number.isFinite(Number(graphContext.predecessorCount))
                    ? String(graphContext.predecessorCount)
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphSuccessorsLabel', 'Immediate successors'),
                value: Number.isFinite(Number(graphContext.successorCount))
                    ? String(graphContext.successorCount)
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphTemporalReasonsLabel', 'Warning reasons'),
                value: Array.isArray(graphContext.temporalWarnings) && graphContext.temporalWarnings.length > 0
                    ? graphContext.temporalWarnings.join(', ')
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphEvidenceRefsLabel', 'Source references'),
                value: Array.isArray(graphContext.evidenceSourceRefs) && graphContext.evidenceSourceRefs.length > 0
                    ? graphContext.evidenceSourceRefs.join(', ')
                    : noneLabel,
            },
        ] : [];
        const graphContextHtml = graphContextItems.length > 0
            ? graphContextItems.map((item) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(item.title)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(item.value)}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;
        const graphDiagnostics = summary.graphDiagnostics && typeof summary.graphDiagnostics === 'object'
            ? summary.graphDiagnostics
            : null;
        const graphDiagnosticsHeading = translate('agentWorkspace.evidence.graphDiagnosticsLabel', 'Graph diagnostics');
        const graphDiagnosticsItems = graphDiagnostics ? [
            {
                title: translate('agentWorkspace.evidence.graphDiagnosticsOpsLabel', 'Graph ops'),
                value: graphDiagnostics.graphOpsAvailable === true
                    ? translate('agentWorkspace.evidence.graphDiagnosticsAvailableLabel', 'available')
                    : translate('agentWorkspace.evidence.graphDiagnosticsUnavailableLabel', 'unavailable'),
            },
            {
                title: translate('agentWorkspace.evidence.graphDiagnosticsFallbackLabel', 'Fallback'),
                value: graphDiagnostics.usedFallback === true ? 'true' : 'false',
            },
            {
                title: translate('agentWorkspace.evidence.graphDiagnosticsAnchorReasonLabel', 'Anchor reason'),
                value: String(graphDiagnostics.selectedAnchorReason || '').trim() || noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphDiagnosticsSupportCountLabel', 'Support nodes'),
                value: Number.isFinite(Number(graphDiagnostics.supportNodeLimit)) && Number(graphDiagnostics.supportNodeLimit) > 0
                    ? `${String(graphDiagnostics.supportNodeCount || 0)}/${String(graphDiagnostics.supportNodeLimit || 0)}`
                    : String(graphDiagnostics.supportNodeCount || 0),
            },
            {
                title: translate('agentWorkspace.evidence.graphDiagnosticsBudgetLabel', 'Path depth budget'),
                value: Number.isFinite(Number(graphDiagnostics.pathDepthLimit))
                    ? String(graphDiagnostics.pathDepthLimit)
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.evidence.graphDiagnosticsMissingLookupsLabel', 'Missing graph lookups'),
                value: String(graphDiagnostics.missingLookupSummary || '').trim() || noneLabel,
            },
        ] : [];
        const graphDiagnosticsHtml = graphDiagnosticsItems.length > 0
            ? graphDiagnosticsItems.map((item) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(item.title)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(item.value)}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;

        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(answerReleaseReviewHeading)}</div>
                <ul class="agent-chat-card-list">${answerReleaseReviewHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(answerReleaseReviewGatesHeading)}</div>
                <ul class="agent-chat-card-list">${answerReleaseReviewGatesHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(graphContextHeading)}</div>
                <ul class="agent-chat-card-list">${graphContextHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(graphDiagnosticsHeading)}</div>
                <ul class="agent-chat-card-list">${graphDiagnosticsHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(claimsHeading)}</div>
                <ul class="agent-chat-card-list">${claimsHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(gatesHeading)}</div>
                <ul class="agent-chat-card-list">${gatesHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(reviewCardsHeading)}</div>
                <ul class="agent-chat-card-list">${reviewCardsHtml}</ul>
            </div>
        `;

        claims.forEach((claim, index) => {
            if (!String(claim && claim.sourcePath || '').trim()) {
                return;
            }
            const inspectButton = node.querySelector(`[data-agent-knowledge-run-claim-inspect="${index}"]`);
            if (inspectButton && typeof inspectButton.addEventListener === 'function') {
                inspectButton.addEventListener('click', function () {
                    ensureWorkspaceVisible();
                    api.openGraphFocusPane(buildKnowledgeRunClaimFocusPayload(claim, summary));
                });
            }
        });
    }

    function renderKnowledgeRunHistoryCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate('agentWorkspace.reply.knowledgeRunHistoryCardTitle', 'Knowledge Run History');
        const summaryText = translate(
            'agentWorkspace.reply.knowledgeRunHistoryCardSummary',
            '{returnedArtifacts} run artifact(s) returned.',
            {
                returnedArtifacts: String(summary.returnedArtifacts == null ? 0 : summary.returnedArtifacts),
            }
        );
        const noneLabel = translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const runsHeading = translate('agentWorkspace.reply.knowledgeRunHistoryRunsHeading', 'Recent Runs');
        const runs = Array.isArray(summary.runs) ? summary.runs : [];
        const latestRun = runs[0] && typeof runs[0] === 'object' ? runs[0] : null;
        const answerReleaseAuditSummary = summary.answerReleaseAuditSummary && typeof summary.answerReleaseAuditSummary === 'object'
            ? summary.answerReleaseAuditSummary
            : {};
        const formatAnswerReleaseDecision = (decisionLike) => {
            const decision = String(decisionLike || '').trim().toLowerCase();
            if (decision === 'release') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRelease', 'release');
            }
            if (decision === 'revise') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRevise', 'revise');
            }
            if (decision === 'abstain') {
                return translate('agentWorkspace.reply.answerReleaseDecisionAbstain', 'abstain');
            }
            if (decision === 'other') {
                return translate('agentWorkspace.reply.answerReleaseDecisionOther', 'other');
            }
            return decision || noneLabel;
        };
        const buildAnswerReleaseHistorySummary = (reviewLike) => {
            const review = reviewLike && typeof reviewLike === 'object'
                ? reviewLike
                : null;
            if (!review) {
                return noneLabel;
            }
            const failedGates = Array.isArray(review.failedGateIds) && review.failedGateIds.length > 0
                ? review.failedGateIds.join(', ')
                : noneLabel;
            return translate(
                'agentWorkspace.reply.answerReleaseHistorySummary',
                '{decision}; revised {revised}; failed {failedGates}',
                {
                    decision: formatAnswerReleaseDecision(review.decision),
                    revised: review.revised === true
                        ? translate('agentWorkspace.reply.answerReleaseBoolYes', 'yes')
                        : translate('agentWorkspace.reply.answerReleaseBoolNo', 'no'),
                    failedGates,
                }
            );
        };
        const decisionCounts = answerReleaseAuditSummary && typeof answerReleaseAuditSummary.decisionCounts === 'object'
            ? answerReleaseAuditSummary.decisionCounts
            : {};
        const failedGateCounts = Array.isArray(answerReleaseAuditSummary.failedGateCounts)
            ? answerReleaseAuditSummary.failedGateCounts.filter((entry) => entry && typeof entry === 'object')
            : [];
        const reviewTrend = answerReleaseAuditSummary && typeof answerReleaseAuditSummary.reviewTrend === 'object'
            ? answerReleaseAuditSummary.reviewTrend
            : {};
        const comparison = answerReleaseAuditSummary && typeof answerReleaseAuditSummary.comparison === 'object'
            ? answerReleaseAuditSummary.comparison
            : {};
        const recentTrendWindow = reviewTrend && typeof reviewTrend.recentWindow === 'object'
            ? reviewTrend.recentWindow
            : {};
        const priorTrendWindow = reviewTrend && typeof reviewTrend.priorWindow === 'object'
            ? reviewTrend.priorWindow
            : {};
        const failedGateAging = Array.isArray(answerReleaseAuditSummary.failedGateAging)
            ? answerReleaseAuditSummary.failedGateAging.filter((entry) => entry && typeof entry === 'object')
            : [];
        const comparisonMetricShifts = Array.isArray(comparison.metricShifts)
            ? comparison.metricShifts.filter((entry) => entry && typeof entry === 'object')
            : [];
        const comparisonGateShifts = Array.isArray(comparison.gateShifts)
            ? comparison.gateShifts.filter((entry) => entry && typeof entry === 'object')
            : [];
        const comparisonLatestPair = comparison.latestPair && typeof comparison.latestPair === 'object'
            ? comparison.latestPair
            : null;
        const totalRuns = Number.isFinite(Number(answerReleaseAuditSummary.totalRuns))
            ? Number(answerReleaseAuditSummary.totalRuns)
            : runs.length;
        const reviewedRunCount = Number.isFinite(Number(answerReleaseAuditSummary.reviewedRunCount))
            ? Number(answerReleaseAuditSummary.reviewedRunCount)
            : 0;
        const unreviewedRunCount = Number.isFinite(Number(answerReleaseAuditSummary.unreviewedRunCount))
            ? Number(answerReleaseAuditSummary.unreviewedRunCount)
            : Math.max(0, totalRuns - reviewedRunCount);
        const auditHeading = translate('agentWorkspace.reply.answerReleaseAuditSummaryHeading', 'Release audit');
        const trendHeading = translate('agentWorkspace.reply.answerReleaseAuditTrendHeading', 'Review trend');
        const comparisonHeading = translate('agentWorkspace.reply.answerReleaseAuditComparisonHeading', 'Review comparison');
        const comparisonLatestPairHeading = translate('agentWorkspace.reply.answerReleaseAuditComparisonLatestPairHeading', 'Latest pair');
        const comparisonGateShiftHeading = translate('agentWorkspace.reply.answerReleaseAuditComparisonGateShiftHeading', 'Gate shifts');
        const gateAgingHeading = translate('agentWorkspace.reply.answerReleaseAuditGateAgingHeading', 'Gate aging');
        const buildDecisionCountsSummary = (countsLike) => {
            const counts = countsLike && typeof countsLike === 'object'
                ? countsLike
                : {};
            return [
                `${translate('agentWorkspace.reply.answerReleaseDecisionRelease', 'release')} ${String(Number.isFinite(Number(counts.release)) ? Number(counts.release) : 0)}`,
                `${translate('agentWorkspace.reply.answerReleaseDecisionRevise', 'revise')} ${String(Number.isFinite(Number(counts.revise)) ? Number(counts.revise) : 0)}`,
                `${translate('agentWorkspace.reply.answerReleaseDecisionAbstain', 'abstain')} ${String(Number.isFinite(Number(counts.abstain)) ? Number(counts.abstain) : 0)}`,
                `${translate('agentWorkspace.reply.answerReleaseDecisionOther', 'other')} ${String(Number.isFinite(Number(counts.other)) ? Number(counts.other) : 0)}`,
            ].join(', ');
        };
        const resolveAnswerReleaseAuditMetricShiftLabel = (metricId) => {
            const normalizedMetricId = String(metricId || '').trim().toLowerCase();
            if (normalizedMetricId === 'reviewed_runs') {
                return translate('agentWorkspace.reply.answerReleaseAuditReviewedRunsLabel', 'Reviewed runs');
            }
            if (normalizedMetricId === 'release_decisions') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRelease', 'release');
            }
            if (normalizedMetricId === 'revise_decisions') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRevise', 'revise');
            }
            if (normalizedMetricId === 'abstain_decisions') {
                return translate('agentWorkspace.reply.answerReleaseDecisionAbstain', 'abstain');
            }
            if (normalizedMetricId === 'other_decisions') {
                return translate('agentWorkspace.reply.answerReleaseDecisionOther', 'other');
            }
            if (normalizedMetricId === 'revised_runs') {
                return translate('agentWorkspace.reply.answerReleaseAuditRevisedRunsLabel', 'Revised runs');
            }
            if (normalizedMetricId === 'failed_gate_runs') {
                return translate('agentWorkspace.reply.answerReleaseAuditComparisonFailedGateRunsLabel', 'Failed-gate runs');
            }
            if (normalizedMetricId === 'leaked_runs') {
                return translate('agentWorkspace.reply.answerReleaseAuditComparisonLeakedRunsLabel', 'Leaked runs');
            }
            return normalizedMetricId || noneLabel;
        };
        const buildTrendWindowSummary = (windowLike) => {
            const windowSummary = windowLike && typeof windowLike === 'object'
                ? windowLike
                : {};
            const windowReviewedRunCount = Number.isFinite(Number(windowSummary.reviewedRunCount))
                ? Number(windowSummary.reviewedRunCount)
                : 0;
            if (windowReviewedRunCount <= 0) {
                return noneLabel;
            }
            return translate(
                'agentWorkspace.reply.answerReleaseAuditTrendWindowSummary',
                '{reviewed} run(s); {decisions}; revised {revised}; failed {failed}; leaked {leaked}; {latest} -> {earliest}',
                {
                    reviewed: String(windowReviewedRunCount),
                    decisions: buildDecisionCountsSummary(windowSummary.decisionCounts),
                    revised: String(Number.isFinite(Number(windowSummary.revisedRunCount)) ? Number(windowSummary.revisedRunCount) : 0),
                    failed: String(Number.isFinite(Number(windowSummary.runsWithFailedGates)) ? Number(windowSummary.runsWithFailedGates) : 0),
                    leaked: String(Number.isFinite(Number(windowSummary.runsWithLeakedInternalFragments)) ? Number(windowSummary.runsWithLeakedInternalFragments) : 0),
                    latest: String(windowSummary.latestReviewedAt || '').trim() || noneLabel,
                    earliest: String(windowSummary.earliestReviewedAt || '').trim() || noneLabel,
                }
            );
        };
        const buildAnswerReleaseGateListSummary = (gateIds) => {
            const safeGateIds = Array.isArray(gateIds)
                ? gateIds
                    .map((gateId) => String(gateId || '').trim())
                    .filter(Boolean)
                : [];
            return safeGateIds.length > 0
                ? safeGateIds.join(', ')
                : noneLabel;
        };
        const auditItems = [
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditReviewedRunsLabel', 'Reviewed runs'),
                value: translate(
                    'agentWorkspace.reply.answerReleaseAuditReviewedRunsSummary',
                    '{reviewed}/{total} reviewed; {unreviewed} unreviewed',
                    {
                        reviewed: String(reviewedRunCount),
                        total: String(totalRuns),
                        unreviewed: String(unreviewedRunCount),
                    }
                ),
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditDecisionCountsLabel', 'Decision counts'),
                value: buildDecisionCountsSummary(decisionCounts),
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditRevisedRunsLabel', 'Revised runs'),
                value: String(Number.isFinite(Number(answerReleaseAuditSummary.revisedRunCount)) ? Number(answerReleaseAuditSummary.revisedRunCount) : 0),
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditLeakSummaryLabel', 'Leak summary'),
                value: translate(
                    'agentWorkspace.reply.answerReleaseAuditLeakSummary',
                    '{runs} run(s); {fragments} fragment(s)',
                    {
                        runs: String(Number.isFinite(Number(answerReleaseAuditSummary.runsWithLeakedInternalFragments)) ? Number(answerReleaseAuditSummary.runsWithLeakedInternalFragments) : 0),
                        fragments: String(Number.isFinite(Number(answerReleaseAuditSummary.leakedInternalFragmentTotalCount)) ? Number(answerReleaseAuditSummary.leakedInternalFragmentTotalCount) : 0),
                    }
                ),
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditFailedGatesLabel', 'Failed gates'),
                value: failedGateCounts.length > 0
                    ? translate(
                        'agentWorkspace.reply.answerReleaseAuditFailedGatesSummary',
                        '{runs} run(s); {gates}',
                        {
                            runs: String(Number.isFinite(Number(answerReleaseAuditSummary.runsWithFailedGates)) ? Number(answerReleaseAuditSummary.runsWithFailedGates) : 0),
                            gates: failedGateCounts.map((entry) => `${String(entry.gateId || '').trim() || noneLabel} (${String(Number.isFinite(Number(entry.count)) ? Number(entry.count) : 0)})`).join(', '),
                        }
                    )
                    : noneLabel,
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditLatestReviewedAtLabel', 'Latest reviewed at'),
                value: String(answerReleaseAuditSummary.latestReviewedAt || '').trim() || noneLabel,
            },
        ];
        const auditHtml = auditItems.map((item) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(item.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(item.value)}</div>
            </li>
        `).join('');
        const trendItems = [
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditTrendRecentWindowLabel', 'Recent reviewed window'),
                value: buildTrendWindowSummary(recentTrendWindow),
            },
            {
                title: translate('agentWorkspace.reply.answerReleaseAuditTrendPriorWindowLabel', 'Prior reviewed window'),
                value: buildTrendWindowSummary(priorTrendWindow),
            },
        ];
        const trendHtml = trendItems.map((item) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(item.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(item.value)}</div>
            </li>
        `).join('');
        const comparisonMetricHtml = comparisonMetricShifts.length > 0
            ? comparisonMetricShifts.map((entry) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(resolveAnswerReleaseAuditMetricShiftLabel(entry.metricId))}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(translate(
                        'agentWorkspace.reply.answerReleaseAuditComparisonMetricSummary',
                        'recent {recent}; prior {prior}; delta {delta}',
                        {
                            recent: String(Number.isFinite(Number(entry.recentValue)) ? Number(entry.recentValue) : 0),
                            prior: String(Number.isFinite(Number(entry.priorValue)) ? Number(entry.priorValue) : 0),
                            delta: formatKnowledgeRunCompareDelta(entry.delta),
                        }
                    ))}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;
        const comparisonLatestPairHtml = comparisonLatestPair
            ? `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`${String(comparisonLatestPair.previousRunId || '').trim() || noneLabel} -> ${String(comparisonLatestPair.latestRunId || '').trim() || noneLabel}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(translate(
                        'agentWorkspace.reply.answerReleaseAuditComparisonLatestPairSummary',
                        'decision {previousDecision} -> {latestDecision}; revised {previousRevised} -> {latestRevised}; leak delta {leakDelta}; new {newlyFailed}; resolved {resolved}; persistent {persistent}',
                        {
                            previousDecision: formatAnswerReleaseDecision(comparisonLatestPair.previousDecision),
                            latestDecision: formatAnswerReleaseDecision(comparisonLatestPair.latestDecision),
                            previousRevised: comparisonLatestPair.previousRevised === true
                                ? translate('agentWorkspace.reply.answerReleaseBoolYes', 'yes')
                                : translate('agentWorkspace.reply.answerReleaseBoolNo', 'no'),
                            latestRevised: comparisonLatestPair.latestRevised === true
                                ? translate('agentWorkspace.reply.answerReleaseBoolYes', 'yes')
                                : translate('agentWorkspace.reply.answerReleaseBoolNo', 'no'),
                            leakDelta: formatKnowledgeRunCompareDelta(comparisonLatestPair.leakedInternalFragmentDelta),
                            newlyFailed: buildAnswerReleaseGateListSummary(comparisonLatestPair.newlyFailedGateIds),
                            resolved: buildAnswerReleaseGateListSummary(comparisonLatestPair.resolvedFailedGateIds),
                            persistent: buildAnswerReleaseGateListSummary(comparisonLatestPair.persistentFailedGateIds),
                        }
                    ))}</div>
                </li>
            `
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;
        const comparisonGateShiftHtml = comparisonGateShifts.length > 0
            ? comparisonGateShifts.map((entry) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(String(entry.gateId || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(translate(
                        'agentWorkspace.reply.answerReleaseAuditComparisonGateShiftSummary',
                        'recent {recent}; prior {prior}; delta {delta}; total {total}; since last failure {runsSince}',
                        {
                            recent: String(Number.isFinite(Number(entry.recentWindowCount)) ? Number(entry.recentWindowCount) : 0),
                            prior: String(Number.isFinite(Number(entry.priorWindowCount)) ? Number(entry.priorWindowCount) : 0),
                            delta: formatKnowledgeRunCompareDelta(entry.delta),
                            total: String(Number.isFinite(Number(entry.failureCount)) ? Number(entry.failureCount) : 0),
                            runsSince: String(Number.isFinite(Number(entry.reviewedRunsSinceLastFailure)) ? Number(entry.reviewedRunsSinceLastFailure) : 0),
                        }
                    ))}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;
        const gateAgingHtml = failedGateAging.length > 0
            ? failedGateAging.map((entry) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(String(entry.gateId || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(translate(
                        'agentWorkspace.reply.answerReleaseAuditGateAgingSummary',
                        '{count} fail(s); recent {latest}; since last failure {runsSince}; recent window {windowCount}',
                        {
                            count: String(Number.isFinite(Number(entry.failureCount)) ? Number(entry.failureCount) : 0),
                            latest: String(entry.latestReviewedAt || '').trim() || noneLabel,
                            runsSince: String(Number.isFinite(Number(entry.reviewedRunsSinceLastFailure)) ? Number(entry.reviewedRunsSinceLastFailure) : 0),
                            windowCount: String(Number.isFinite(Number(entry.occurrencesInRecentWindow)) ? Number(entry.occurrencesInRecentWindow) : 0),
                        }
                    ))}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;
        const runsHtml = runs.length > 0
            ? runs.map((run, index) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`${index + 1}. ${String(run.runId || '').trim() || noneLabel}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(run.artifactTitle || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(run.scopeLabel || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(`claims ${String(run.claimCount == null ? 0 : run.claimCount)}, quality ${String(run.qualityStatus || '').trim() || noneLabel}${Number.isFinite(Number(run.qualityScore)) ? `/${String(run.qualityScore)}` : ''}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(`${translate('agentWorkspace.reply.knowledgeRunHistoryGraphSignalLabel', 'Graph signal')}: ${String(run.graphSignalSummary || '').trim() || noneLabel}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(`${translate('agentWorkspace.reply.answerReleaseHistoryLabel', 'Release review')}: ${buildAnswerReleaseHistorySummary(run.answerReleaseReview)}`)}</div>
                    ${String(run.artifactId || '').trim() ? `<div class="agent-chat-card-actions"><button type="button" data-agent-knowledge-run-history-inspect="${index}">${escapeHtml(translate('agentWorkspace.reply.knowledgeRunHistoryInspectRun', 'Inspect Run'))}</button>${latestRun && index > 0 ? `<button type="button" data-agent-knowledge-run-history-compare="${index}">${escapeHtml(translate('agentWorkspace.reply.knowledgeRunHistoryCompareLatest', 'Compare Latest'))}</button>` : ''}</div>` : ''}
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;

        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(auditHeading)}</div>
                <ul class="agent-chat-card-list">${auditHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(trendHeading)}</div>
                <ul class="agent-chat-card-list">${trendHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(comparisonHeading)}</div>
                <ul class="agent-chat-card-list">${comparisonMetricHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(comparisonLatestPairHeading)}</div>
                <ul class="agent-chat-card-list">${comparisonLatestPairHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(comparisonGateShiftHeading)}</div>
                <ul class="agent-chat-card-list">${comparisonGateShiftHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(gateAgingHeading)}</div>
                <ul class="agent-chat-card-list">${gateAgingHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(runsHeading)}</div>
                <ul class="agent-chat-card-list">${runsHtml}</ul>
            </div>
        `;

        runs.forEach((run, index) => {
            if (!String(run && run.artifactId || '').trim()) {
                return;
            }
            const inspectButton = node.querySelector(`[data-agent-knowledge-run-history-inspect="${index}"]`);
            if (inspectButton && typeof inspectButton.addEventListener === 'function') {
                inspectButton.addEventListener('click', function () {
                    if (!window.NoteConnectionAgentWorkspace || typeof window.NoteConnectionAgentWorkspace.executeCapability !== 'function') {
                        return;
                    }
                    void window.NoteConnectionAgentWorkspace.executeCapability({
                        atomId: '',
                        title: String(run && run.runId || title).trim() || title,
                    }, {
                        capabilityId: `cap_inspect_knowledge_run_history_${String(run.artifactId || '').trim() || index}`,
                        actionId: 'inspect_knowledge_run',
                        label: 'Inspect Run',
                        request: {
                            artifactKinds: ['knowledge_run'],
                            artifactId: String(run && run.artifactId || '').trim() || undefined,
                            runId: String(run && run.runId || '').trim() || undefined,
                            workspaceId: String(run && run.workspaceId || '').trim() || undefined,
                            limit: 1,
                        },
                        execution: {
                            kind: 'knowledge_operation',
                            operationId: 'fetch_workflow_artifacts',
                            resultPresentation: 'knowledge_run_card',
                        },
                    });
                });
            }
            if (latestRun && index > 0) {
                const compareButton = node.querySelector(`[data-agent-knowledge-run-history-compare="${index}"]`);
                if (compareButton && typeof compareButton.addEventListener === 'function') {
                    compareButton.addEventListener('click', function () {
                        api.appendKnowledgeRunCompareCard(buildKnowledgeRunComparePayload(latestRun, run));
                    });
                }
            }
        });
    }

    function formatKnowledgeRunCompareDelta(value) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric === 0) {
            return '0';
        }
        return numeric > 0 ? `+${numeric}` : String(numeric);
    }

    function buildKnowledgeRunComparePayload(latestRun, comparedRun) {
        const safeLatest = latestRun && typeof latestRun === 'object' ? latestRun : {};
        const safeCompared = comparedRun && typeof comparedRun === 'object' ? comparedRun : {};
        const normalizeAnswerReleaseDecision = (decisionLike) => {
            const normalizedDecision = String(decisionLike || '').trim().toLowerCase();
            if (normalizedDecision === 'release' || normalizedDecision === 'revise' || normalizedDecision === 'abstain') {
                return normalizedDecision;
            }
            return normalizedDecision || 'other';
        };
        const latestQualityScore = Number.isFinite(Number(safeLatest.qualityScore)) ? Number(safeLatest.qualityScore) : null;
        const comparedQualityScore = Number.isFinite(Number(safeCompared.qualityScore)) ? Number(safeCompared.qualityScore) : null;
        const latestAnswerReleaseReview = safeLatest.answerReleaseReview && typeof safeLatest.answerReleaseReview === 'object'
            ? safeLatest.answerReleaseReview
            : null;
        const comparedAnswerReleaseReview = safeCompared.answerReleaseReview && typeof safeCompared.answerReleaseReview === 'object'
            ? safeCompared.answerReleaseReview
            : null;
        const latestFailedGateIds = Array.isArray(latestAnswerReleaseReview && latestAnswerReleaseReview.failedGateIds)
            ? latestAnswerReleaseReview.failedGateIds
                .map((gateId) => String(gateId || '').trim())
                .filter(Boolean)
            : [];
        const comparedFailedGateIds = Array.isArray(comparedAnswerReleaseReview && comparedAnswerReleaseReview.failedGateIds)
            ? comparedAnswerReleaseReview.failedGateIds
                .map((gateId) => String(gateId || '').trim())
                .filter(Boolean)
            : [];
        const latestFailedGateSet = new Set(latestFailedGateIds);
        const comparedFailedGateSet = new Set(comparedFailedGateIds);
        const latestLeakedInternalFragmentCount = Array.isArray(latestAnswerReleaseReview && latestAnswerReleaseReview.leakedInternalFragments)
            ? latestAnswerReleaseReview.leakedInternalFragments
                .map((fragment) => String(fragment || '').trim())
                .filter(Boolean)
                .length
            : 0;
        const comparedLeakedInternalFragmentCount = Array.isArray(comparedAnswerReleaseReview && comparedAnswerReleaseReview.leakedInternalFragments)
            ? comparedAnswerReleaseReview.leakedInternalFragments
                .map((fragment) => String(fragment || '').trim())
                .filter(Boolean)
                .length
            : 0;
        return {
            latestRunId: String(safeLatest.runId || '').trim(),
            latestArtifactTitle: String(safeLatest.artifactTitle || '').trim(),
            latestQualityStatus: String(safeLatest.qualityStatus || '').trim(),
            latestQualityScore,
            latestClaimCount: Number.isFinite(Number(safeLatest.claimCount)) ? Number(safeLatest.claimCount) : 0,
            latestWeakClaimCount: Number.isFinite(Number(safeLatest.weakClaimCount)) ? Number(safeLatest.weakClaimCount) : 0,
            latestRemainingReviewCardCount: Number.isFinite(Number(safeLatest.remainingReviewCardCount)) ? Number(safeLatest.remainingReviewCardCount) : 0,
            latestConnectionPathCount: Number.isFinite(Number(safeLatest.connectionPathCount)) ? Number(safeLatest.connectionPathCount) : 0,
            latestTemporalWarningCount: Number.isFinite(Number(safeLatest.temporalWarningCount)) ? Number(safeLatest.temporalWarningCount) : 0,
            latestUsedFallback: safeLatest.usedFallback === true,
            comparedRunId: String(safeCompared.runId || '').trim(),
            comparedArtifactTitle: String(safeCompared.artifactTitle || '').trim(),
            comparedQualityStatus: String(safeCompared.qualityStatus || '').trim(),
            comparedQualityScore,
            comparedClaimCount: Number.isFinite(Number(safeCompared.claimCount)) ? Number(safeCompared.claimCount) : 0,
            comparedWeakClaimCount: Number.isFinite(Number(safeCompared.weakClaimCount)) ? Number(safeCompared.weakClaimCount) : 0,
            comparedRemainingReviewCardCount: Number.isFinite(Number(safeCompared.remainingReviewCardCount)) ? Number(safeCompared.remainingReviewCardCount) : 0,
            comparedConnectionPathCount: Number.isFinite(Number(safeCompared.connectionPathCount)) ? Number(safeCompared.connectionPathCount) : 0,
            comparedTemporalWarningCount: Number.isFinite(Number(safeCompared.temporalWarningCount)) ? Number(safeCompared.temporalWarningCount) : 0,
            comparedUsedFallback: safeCompared.usedFallback === true,
            qualityScoreDelta: latestQualityScore != null && comparedQualityScore != null
                ? Number((comparedQualityScore - latestQualityScore).toFixed(2))
                : null,
            claimCountDelta: (Number.isFinite(Number(safeCompared.claimCount)) ? Number(safeCompared.claimCount) : 0)
                - (Number.isFinite(Number(safeLatest.claimCount)) ? Number(safeLatest.claimCount) : 0),
            weakClaimCountDelta: (Number.isFinite(Number(safeCompared.weakClaimCount)) ? Number(safeCompared.weakClaimCount) : 0)
                - (Number.isFinite(Number(safeLatest.weakClaimCount)) ? Number(safeLatest.weakClaimCount) : 0),
            remainingReviewCardCountDelta: (Number.isFinite(Number(safeCompared.remainingReviewCardCount)) ? Number(safeCompared.remainingReviewCardCount) : 0)
                - (Number.isFinite(Number(safeLatest.remainingReviewCardCount)) ? Number(safeLatest.remainingReviewCardCount) : 0),
            connectionPathCountDelta: (Number.isFinite(Number(safeCompared.connectionPathCount)) ? Number(safeCompared.connectionPathCount) : 0)
                - (Number.isFinite(Number(safeLatest.connectionPathCount)) ? Number(safeLatest.connectionPathCount) : 0),
            temporalWarningCountDelta: (Number.isFinite(Number(safeCompared.temporalWarningCount)) ? Number(safeCompared.temporalWarningCount) : 0)
                - (Number.isFinite(Number(safeLatest.temporalWarningCount)) ? Number(safeLatest.temporalWarningCount) : 0),
            graphFallbackDelta: (safeCompared.usedFallback === true ? 1 : 0)
                - (safeLatest.usedFallback === true ? 1 : 0),
            latestAnswerReleaseReview,
            comparedAnswerReleaseReview,
            answerReleaseDecisionChanged: normalizeAnswerReleaseDecision(latestAnswerReleaseReview && latestAnswerReleaseReview.decision)
                !== normalizeAnswerReleaseDecision(comparedAnswerReleaseReview && comparedAnswerReleaseReview.decision),
            answerReleaseRevisedChanged: (latestAnswerReleaseReview && latestAnswerReleaseReview.revised === true)
                !== (comparedAnswerReleaseReview && comparedAnswerReleaseReview.revised === true),
            latestLeakedInternalFragmentCount,
            comparedLeakedInternalFragmentCount,
            answerReleaseLeakedInternalFragmentDelta: latestLeakedInternalFragmentCount - comparedLeakedInternalFragmentCount,
            newlyFailedGateIds: latestFailedGateIds.filter((gateId) => !comparedFailedGateSet.has(gateId)),
            resolvedFailedGateIds: comparedFailedGateIds.filter((gateId) => !latestFailedGateSet.has(gateId)),
            persistentFailedGateIds: latestFailedGateIds.filter((gateId) => comparedFailedGateSet.has(gateId)),
        };
    }

    function renderKnowledgeRunCompareCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate('agentWorkspace.reply.knowledgeRunCompareCardTitle', 'Knowledge Run Comparison');
        const latestRunId = String(summary.latestRunId || '').trim();
        const comparedRunId = String(summary.comparedRunId || '').trim();
        const summaryText = translate(
            'agentWorkspace.reply.knowledgeRunCompareCardSummary',
            'Comparing {comparedRunId} against latest {latestRunId}.',
            {
                comparedRunId: comparedRunId || translate('agentWorkspace.reply.knowledgeRunNone', 'none'),
                latestRunId: latestRunId || translate('agentWorkspace.reply.knowledgeRunNone', 'none'),
            }
        );
        const noneLabel = translate('agentWorkspace.reply.knowledgeRunNone', 'none');
        const formatAnswerReleaseDecision = (decisionLike) => {
            const normalizedDecision = String(decisionLike || '').trim().toLowerCase();
            if (normalizedDecision === 'release') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRelease', 'release');
            }
            if (normalizedDecision === 'revise') {
                return translate('agentWorkspace.reply.answerReleaseDecisionRevise', 'revise');
            }
            if (normalizedDecision === 'abstain') {
                return translate('agentWorkspace.reply.answerReleaseDecisionAbstain', 'abstain');
            }
            return translate('agentWorkspace.reply.answerReleaseDecisionOther', 'other');
        };
        const metricsHeading = translate('agentWorkspace.reply.knowledgeRunMetricsHeading', 'Key Metrics');
        const releaseHeading = translate('agentWorkspace.reply.knowledgeRunCompareAnswerReleaseHeading', 'Answer release');
        const qualityDelta = summary.qualityScoreDelta == null
            ? noneLabel
            : formatKnowledgeRunCompareDelta(summary.qualityScoreDelta);
        const latestAnswerReleaseReview = summary.latestAnswerReleaseReview && typeof summary.latestAnswerReleaseReview === 'object'
            ? summary.latestAnswerReleaseReview
            : null;
        const comparedAnswerReleaseReview = summary.comparedAnswerReleaseReview && typeof summary.comparedAnswerReleaseReview === 'object'
            ? summary.comparedAnswerReleaseReview
            : null;
        const buildAnswerReleaseCompareSummary = (reviewLike) => {
            const review = reviewLike && typeof reviewLike === 'object'
                ? reviewLike
                : null;
            if (!review) {
                return noneLabel;
            }
            const failedGateIds = Array.isArray(review.failedGateIds)
                ? review.failedGateIds
                    .map((gateId) => String(gateId || '').trim())
                    .filter(Boolean)
                : [];
            return translate(
                'agentWorkspace.reply.answerReleaseHistorySummary',
                '{decision}; revised {revised}; failed {failedGates}',
                {
                    decision: formatAnswerReleaseDecision(review.decision),
                    revised: review.revised === true
                        ? translate('agentWorkspace.reply.answerReleaseBoolYes', 'yes')
                        : translate('agentWorkspace.reply.answerReleaseBoolNo', 'no'),
                    failedGates: failedGateIds.length > 0
                        ? failedGateIds.join(', ')
                        : noneLabel,
                }
            );
        };
        const metrics = [
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareLatestLabel', 'Latest run'),
                value: `${latestRunId || noneLabel} (${String(summary.latestQualityStatus || '').trim() || noneLabel}${summary.latestQualityScore != null ? `/${String(summary.latestQualityScore)}` : ''})`,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareCandidateLabel', 'Compared run'),
                value: `${comparedRunId || noneLabel} (${String(summary.comparedQualityStatus || '').trim() || noneLabel}${summary.comparedQualityScore != null ? `/${String(summary.comparedQualityScore)}` : ''})`,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareQualityDeltaLabel', 'Quality delta'),
                value: qualityDelta,
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareClaimDeltaLabel', 'Claim delta'),
                value: formatKnowledgeRunCompareDelta(summary.claimCountDelta),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareWeakClaimDeltaLabel', 'Weak-claim delta'),
                value: formatKnowledgeRunCompareDelta(summary.weakClaimCountDelta),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareRemainingReviewDeltaLabel', 'Remaining review delta'),
                value: formatKnowledgeRunCompareDelta(summary.remainingReviewCardCountDelta),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunComparePathDeltaLabel', 'Path delta'),
                value: formatKnowledgeRunCompareDelta(summary.connectionPathCountDelta),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareTemporalWarningDeltaLabel', 'Temporal-warning delta'),
                value: formatKnowledgeRunCompareDelta(summary.temporalWarningCountDelta),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareGraphFallbackDeltaLabel', 'Graph fallback delta'),
                value: formatKnowledgeRunCompareDelta(summary.graphFallbackDelta),
            },
        ];
        const releaseItems = [
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareLatestAnswerReleaseLabel', 'Latest release review'),
                value: buildAnswerReleaseCompareSummary(latestAnswerReleaseReview),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareCandidateAnswerReleaseLabel', 'Compared release review'),
                value: buildAnswerReleaseCompareSummary(comparedAnswerReleaseReview),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareAnswerReleaseDeltaLabel', 'Release delta'),
                value: translate(
                    'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseDeltaSummary',
                    'decision {previousDecision} -> {latestDecision}; revised {previousRevised} -> {latestRevised}; leak delta {leakDelta}',
                    {
                        previousDecision: formatAnswerReleaseDecision(comparedAnswerReleaseReview && comparedAnswerReleaseReview.decision),
                        latestDecision: formatAnswerReleaseDecision(latestAnswerReleaseReview && latestAnswerReleaseReview.decision),
                        previousRevised: comparedAnswerReleaseReview && comparedAnswerReleaseReview.revised === true
                            ? translate('agentWorkspace.reply.answerReleaseBoolYes', 'yes')
                            : translate('agentWorkspace.reply.answerReleaseBoolNo', 'no'),
                        latestRevised: latestAnswerReleaseReview && latestAnswerReleaseReview.revised === true
                            ? translate('agentWorkspace.reply.answerReleaseBoolYes', 'yes')
                            : translate('agentWorkspace.reply.answerReleaseBoolNo', 'no'),
                        leakDelta: formatKnowledgeRunCompareDelta(summary.answerReleaseLeakedInternalFragmentDelta),
                    }
                ),
            },
            {
                title: translate('agentWorkspace.reply.knowledgeRunCompareAnswerReleaseGateDeltaLabel', 'Gate delta'),
                value: translate(
                    'agentWorkspace.reply.knowledgeRunCompareAnswerReleaseGateDeltaSummary',
                    'new {newlyFailed}; resolved {resolved}; persistent {persistent}',
                    {
                        newlyFailed: Array.isArray(summary.newlyFailedGateIds) && summary.newlyFailedGateIds.length > 0
                            ? summary.newlyFailedGateIds.join(', ')
                            : noneLabel,
                        resolved: Array.isArray(summary.resolvedFailedGateIds) && summary.resolvedFailedGateIds.length > 0
                            ? summary.resolvedFailedGateIds.join(', ')
                            : noneLabel,
                        persistent: Array.isArray(summary.persistentFailedGateIds) && summary.persistentFailedGateIds.length > 0
                            ? summary.persistentFailedGateIds.join(', ')
                            : noneLabel,
                    }
                ),
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        const releaseHtml = releaseItems.map((item) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(item.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(item.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
                <div class="agent-chat-card-section-title">${escapeHtml(releaseHeading)}</div>
                <ul class="agent-chat-card-list">${releaseHtml}</ul>
            </div>
        `;
    }

    function resolveConversationTurnCacheAlertStatusLabel(status) {
        const normalizedStatus = String(status || '').trim().toLowerCase();
        if (normalizedStatus === 'fail') {
            return translate('agentWorkspace.conversationTurnCacheDiagnostics.statusFail', 'fail');
        }
        if (normalizedStatus === 'warn') {
            return translate('agentWorkspace.conversationTurnCacheDiagnostics.statusWarn', 'warn');
        }
        return translate('agentWorkspace.conversationTurnCacheDiagnostics.statusPass', 'pass');
    }

    function resolveConversationTurnCacheAlertCheckLabel(checkId) {
        const normalizedCheckId = String(checkId || '').trim().toLowerCase();
        if (normalizedCheckId === 'utilization_pct') {
            return translate(
                'agentWorkspace.conversationTurnCacheDiagnostics.checkUtilizationPct',
                'Utilization'
            );
        }
        if (normalizedCheckId === 'execution_failure_ratio_pct') {
            return translate(
                'agentWorkspace.conversationTurnCacheDiagnostics.checkExecutionFailureRatioPct',
                'Execution failure ratio'
            );
        }
        if (normalizedCheckId === 'conflict_count') {
            return translate(
                'agentWorkspace.conversationTurnCacheDiagnostics.checkConflictCount',
                'Conflict count'
            );
        }
        if (normalizedCheckId === 'stale_eligible_entries') {
            return translate(
                'agentWorkspace.conversationTurnCacheDiagnostics.checkStaleEligibleEntries',
                'Stale-eligible entries'
            );
        }
        return normalizedCheckId || translate(
            'agentWorkspace.conversationTurnCacheDiagnostics.none',
            'none'
        );
    }

    function resolveConversationTurnCacheTrendStatusLabel(status) {
        const normalizedStatus = String(status || '').trim().toLowerCase();
        if (normalizedStatus === 'regressing') {
            return translate(
                'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusRegressing',
                'regressing'
            );
        }
        if (normalizedStatus === 'improving') {
            return translate(
                'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusImproving',
                'improving'
            );
        }
        if (normalizedStatus === 'stable') {
            return translate(
                'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusStable',
                'stable'
            );
        }
        return translate(
            'agentWorkspace.conversationTurnCacheAlertTrend.trendStatusInsufficientData',
            'insufficient_data'
        );
    }

    function resolveConversationTurnCacheAlertEscalationLabel(level) {
        const normalizedLevel = String(level || '').trim().toLowerCase();
        if (normalizedLevel === 'critical') {
            return translate(
                'agentWorkspace.conversationTurnCacheAlertTrend.escalationCritical',
                'critical'
            );
        }
        if (normalizedLevel === 'high') {
            return translate(
                'agentWorkspace.conversationTurnCacheAlertTrend.escalationHigh',
                'high'
            );
        }
        if (normalizedLevel === 'watch') {
            return translate(
                'agentWorkspace.conversationTurnCacheAlertTrend.escalationWatch',
                'watch'
            );
        }
        return translate(
            'agentWorkspace.conversationTurnCacheAlertTrend.escalationNormal',
            'normal'
        );
    }

    function renderConversationTurnCacheAlertTrendCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const noneLabel = translate(
            'agentWorkspace.conversationTurnCacheAlertTrend.none',
            'none'
        );
        const title = translate(
            'agentWorkspace.conversationTurnCacheAlertTrend.cardTitle',
            'Conversation Turn-Cache Alert Trend'
        );
        const trendStatusLabel = resolveConversationTurnCacheTrendStatusLabel(summary.trendStatus);
        const escalationLabel = resolveConversationTurnCacheAlertEscalationLabel(summary.recommendedEscalation);
        const summaryText = translate(
            'agentWorkspace.conversationTurnCacheAlertTrend.summary',
            'Trend {trendStatus}, escalation {recommendedEscalation}, records {returnedRecords}/{totalRecords}.',
            {
                trendStatus: trendStatusLabel,
                recommendedEscalation: escalationLabel,
                returnedRecords: String(summary.returnedRecords == null ? 0 : summary.returnedRecords),
                totalRecords: String(summary.totalRecords == null ? 0 : summary.totalRecords),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.conversationTurnCacheAlertTrend.metricsHeading',
            'Key Metrics'
        );
        const latestStatus = resolveConversationTurnCacheAlertStatusLabel(summary.latestSummaryStatus);
        const latestTopCheckId = String(summary.latestTopCheckId || '').trim();
        const latestTopCheckLabel = latestTopCheckId
            ? resolveConversationTurnCacheAlertCheckLabel(latestTopCheckId)
            : noneLabel;
        const latestTopCheckSeverity = resolveConversationTurnCacheAlertStatusLabel(summary.latestTopCheckSeverity);
        const latestTopCheckValue = String(summary.latestTopCheckValue == null ? 0 : summary.latestTopCheckValue);
        const reason = String(summary.reason || '').trim() || noneLabel;
        const latestSampledAt = String(summary.latestSampledAt || '').trim() || noneLabel;
        const storageFilePath = String(summary.storageFilePath || '').trim() || noneLabel;
        const storageLastLoadedAt = String(summary.storageLastLoadedAt || '').trim() || noneLabel;
        const storageLastPersistedAt = String(summary.storageLastPersistedAt || '').trim() || noneLabel;
        const storageLastPersistReason = String(summary.storageLastPersistReason || '').trim() || noneLabel;
        const storageLoadError = String(summary.storageLoadError || '').trim() || noneLabel;
        const storagePersistError = String(summary.storagePersistError || '').trim() || noneLabel;
        const trendIndexEndpointHint = String(summary.trendIndexEndpointHint || '').trim() || noneLabel;
        const trendExportEndpointHint = String(summary.trendExportEndpointHint || '').trim() || noneLabel;
        const metrics = [
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.recordsLabel',
                    'Returned/total records'
                ),
                value: `${String(summary.returnedRecords == null ? 0 : summary.returnedRecords)}/${String(summary.totalRecords == null ? 0 : summary.totalRecords)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.statusCountsLabel',
                    'Status counts (pass/warn/fail)'
                ),
                value: `${String(summary.statusPassCount == null ? 0 : summary.statusPassCount)}/${String(summary.statusWarnCount == null ? 0 : summary.statusWarnCount)}/${String(summary.statusFailCount == null ? 0 : summary.statusFailCount)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.activeStreakLabel',
                    'Active warn/fail streak'
                ),
                value: `${String(summary.activeWarnStreak == null ? 0 : summary.activeWarnStreak)}/${String(summary.activeFailStreak == null ? 0 : summary.activeFailStreak)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.latestStatusLabel',
                    'Latest summary status (active/warn/fail)'
                ),
                value: `${latestStatus} (${String(summary.latestFailingCheckCount == null ? 0 : summary.latestFailingCheckCount)}/${String(summary.latestWarnCheckCount == null ? 0 : summary.latestWarnCheckCount)}/${String(summary.latestFailCheckCount == null ? 0 : summary.latestFailCheckCount)})`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.latestTopCheckLabel',
                    'Latest top check'
                ),
                value: `${latestTopCheckLabel} (${latestTopCheckSeverity}: ${latestTopCheckValue})`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.latestMetricsLabel',
                    'Latest metrics (util/fail-ratio/conflict/stale/entries)'
                ),
                value: `${String(summary.latestUtilizationPct == null ? 0 : summary.latestUtilizationPct)}% / ${String(summary.latestExecutionFailureRatioPct == null ? 0 : summary.latestExecutionFailureRatioPct)}% / ${String(summary.latestConflictCount == null ? 0 : summary.latestConflictCount)} / ${String(summary.latestStaleEligibleEntries == null ? 0 : summary.latestStaleEligibleEntries)} / ${String(summary.latestTotalEntries == null ? 0 : summary.latestTotalEntries)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.trendConfigLabel',
                    'Trend config (limit/window/min-samples/interval)'
                ),
                value: `${String(summary.historyLimit == null ? 0 : summary.historyLimit)} / ${String(summary.trendWindowSize == null ? 0 : summary.trendWindowSize)} / ${String(summary.trendMinSamples == null ? 0 : summary.trendMinSamples)} / ${String(summary.sampleMinIntervalMs == null ? 0 : summary.sampleMinIntervalMs)}ms`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.storageCountsLabel',
                    'Storage records (total/configured/schema)'
                ),
                value: `${String(summary.storageTotalRecords == null ? 0 : summary.storageTotalRecords)} / ${String(summary.storageConfiguredHistoryLimit == null ? 0 : summary.storageConfiguredHistoryLimit)} / v${String(summary.storageSchemaVersion == null ? 0 : summary.storageSchemaVersion)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.storageLifecycleLabel',
                    'Storage load/persist snapshots'
                ),
                value: `${String(summary.storageLastLoadedRecordCount == null ? 0 : summary.storageLastLoadedRecordCount)} @ ${storageLastLoadedAt} / ${String(summary.storageLastPersistedRecordCount == null ? 0 : summary.storageLastPersistedRecordCount)} @ ${storageLastPersistedAt}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.storagePersistReasonLabel',
                    'Storage last persist reason'
                ),
                value: storageLastPersistReason,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.storagePathLabel',
                    'Storage file path'
                ),
                value: storageFilePath,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.storageErrorsLabel',
                    'Storage errors (load/persist)'
                ),
                value: `${storageLoadError} / ${storagePersistError}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.escalationLabel',
                    'Escalation recommendation'
                ),
                value: `${escalationLabel} (${reason})`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.endpointHintsLabel',
                    'Drilldown endpoints (index/export)'
                ),
                value: `${trendIndexEndpointHint} | ${trendExportEndpointHint}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheAlertTrend.latestSampledAtLabel',
                    'Latest sampled at'
                ),
                value: latestSampledAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderConversationTurnCacheDiagnosticsCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const noneLabel = translate(
            'agentWorkspace.conversationTurnCacheDiagnostics.none',
            'none'
        );
        const title = translate(
            'agentWorkspace.conversationTurnCacheDiagnostics.cardTitle',
            'Conversation Turn-Cache Diagnostics'
        );
        const summaryText = translate(
            'agentWorkspace.conversationTurnCacheDiagnostics.summary',
            'Entries {totalEntries}/{maxEntries}, cache hit ratio {cacheHitRatioPct}%.',
            {
                totalEntries: String(summary.totalEntries == null ? 0 : summary.totalEntries),
                maxEntries: String(summary.maxEntries == null ? 0 : summary.maxEntries),
                cacheHitRatioPct: String(summary.cacheHitRatioPct == null ? 0 : summary.cacheHitRatioPct),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.conversationTurnCacheDiagnostics.metricsHeading',
            'Key Metrics'
        );
        const lastPrunedAt = String(summary.lastPrunedAt || '').trim() || noneLabel;
        const lastConflictAt = String(summary.lastConflictAt || '').trim() || noneLabel;
        const generatedAt = String(summary.generatedAt || '').trim() || noneLabel;
        const alertSummaryStatus = resolveConversationTurnCacheAlertStatusLabel(summary.alertSummaryStatus);
        const alertFailCount = String(summary.alertFailCheckCount == null ? 0 : summary.alertFailCheckCount);
        const alertWarnCount = String(summary.alertWarnCheckCount == null ? 0 : summary.alertWarnCheckCount);
        const alertFailingCheckCount = String(summary.alertFailingCheckCount == null ? 0 : summary.alertFailingCheckCount);
        const alertTopCheckId = String(summary.alertTopCheckId || '').trim();
        const alertTopCheckLabel = alertTopCheckId
            ? resolveConversationTurnCacheAlertCheckLabel(alertTopCheckId)
            : noneLabel;
        const alertTopCheckSeverity = resolveConversationTurnCacheAlertStatusLabel(summary.alertTopCheckSeverity);
        const alertTopCheckValue = String(summary.alertTopCheckValue == null ? 0 : summary.alertTopCheckValue);
        const thresholdProfile = [
            `util=${String(summary.utilizationWarnPct == null ? 0 : summary.utilizationWarnPct)}/${String(summary.utilizationFailPct == null ? 0 : summary.utilizationFailPct)}%`,
            `failRatio=${String(summary.executionFailureRatioWarnPct == null ? 0 : summary.executionFailureRatioWarnPct)}/${String(summary.executionFailureRatioFailPct == null ? 0 : summary.executionFailureRatioFailPct)}%`,
            `conflict=${String(summary.conflictWarnCount == null ? 0 : summary.conflictWarnCount)}/${String(summary.conflictFailCount == null ? 0 : summary.conflictFailCount)}`,
            `stale=${String(summary.staleEligibleWarnCount == null ? 0 : summary.staleEligibleWarnCount)}/${String(summary.staleEligibleFailCount == null ? 0 : summary.staleEligibleFailCount)}`,
        ].join(' | ');
        const metrics = [
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.configLabel',
                    'TTL / max entries / max events'
                ),
                value: `${String(summary.ttlMs == null ? 0 : summary.ttlMs)}ms / ${String(summary.maxEntries == null ? 0 : summary.maxEntries)} / ${String(summary.maxEventsPerTurn == null ? 0 : summary.maxEventsPerTurn)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.alertSummaryLabel',
                    'Alert summary (status/fail/warn/active)'
                ),
                value: `${alertSummaryStatus} / ${alertFailCount} / ${alertWarnCount} / ${alertFailingCheckCount}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.alertTopCheckLabel',
                    'Top alert check'
                ),
                value: `${alertTopCheckLabel} (${alertTopCheckSeverity}: ${alertTopCheckValue})`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.thresholdProfileLabel',
                    'Threshold profile (warn/fail)'
                ),
                value: thresholdProfile,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.stateLabel',
                    'Running/completed/failed/in-flight'
                ),
                value: `${String(summary.runningEntries == null ? 0 : summary.runningEntries)}/${String(summary.completedEntries == null ? 0 : summary.completedEntries)}/${String(summary.failedEntries == null ? 0 : summary.failedEntries)}/${String(summary.inFlightEntries == null ? 0 : summary.inFlightEntries)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.utilizationLabel',
                    'Utilization / stale-eligible'
                ),
                value: `${String(summary.utilizationPct == null ? 0 : summary.utilizationPct)}% / ${String(summary.staleEligibleEntries == null ? 0 : summary.staleEligibleEntries)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.ageLabel',
                    'Oldest/newest age'
                ),
                value: `${String(summary.oldestEntryAgeMs == null ? 0 : summary.oldestEntryAgeMs)}ms / ${String(summary.newestEntryAgeMs == null ? 0 : summary.newestEntryAgeMs)}ms`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.cacheLabel',
                    'Cache hits/misses/hit ratio'
                ),
                value: `${String(summary.cacheHitCount == null ? 0 : summary.cacheHitCount)}/${String(summary.cacheMissCount == null ? 0 : summary.cacheMissCount)} (${String(summary.cacheHitRatioPct == null ? 0 : summary.cacheHitRatioPct)}%)`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.replayLabel',
                    'Replay responses/events'
                ),
                value: `${String(summary.replayResponseCount == null ? 0 : summary.replayResponseCount)}/${String(summary.replayedEventCount == null ? 0 : summary.replayedEventCount)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.executionLabel',
                    'Execution start/success/failure'
                ),
                value: `${String(summary.executionStartCount == null ? 0 : summary.executionStartCount)}/${String(summary.executionSuccessCount == null ? 0 : summary.executionSuccessCount)}/${String(summary.executionFailureCount == null ? 0 : summary.executionFailureCount)} (${String(summary.executionFailureRatioPct == null ? 0 : summary.executionFailureRatioPct)}%)`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.lifecycleLabel',
                    'Conflicts / in-flight joins / sync reuse'
                ),
                value: `${String(summary.conflictCount == null ? 0 : summary.conflictCount)} / ${String(summary.inFlightJoinCount == null ? 0 : summary.inFlightJoinCount)} / ${String(summary.syncReuseCount == null ? 0 : summary.syncReuseCount)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.evictionLabel',
                    'TTL/capacity evictions'
                ),
                value: `${String(summary.evictedByTtlCount == null ? 0 : summary.evictedByTtlCount)}/${String(summary.evictedByCapacityCount == null ? 0 : summary.evictedByCapacityCount)}`,
            },
            {
                title: translate(
                    'agentWorkspace.conversationTurnCacheDiagnostics.timestampsLabel',
                    'Last prune / last conflict / generated at'
                ),
                value: `${lastPrunedAt} / ${lastConflictAt} / ${generatedAt}`,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderQueryBackendComparisonCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.queryBackendComparison.cardTitle',
            'Backend Comparison'
        );
        const summaryText = translate(
            'agentWorkspace.queryBackendComparison.summary',
            'Query "{query}" (topK={topK}): {leftBackend} vs {rightBackend}, preferred {preferredBackendLabel}.',
            {
                query: String(summary.query || ''),
                topK: String(summary.topK == null ? 0 : summary.topK),
                leftBackend: String(summary.leftBackend || 'left'),
                rightBackend: String(summary.rightBackend || 'right'),
                preferredBackendLabel: String(summary.preferredBackendLabel || 'tie'),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.queryBackendComparison.metricsHeading',
            'Key Metrics'
        );
        const reasonText = String(summary.preferredReason || '').trim()
            || translate('agentWorkspace.queryBackendComparison.none', 'none');
        const metrics = [
            {
                title: translate(
                    'agentWorkspace.queryBackendComparison.overlapRatioLabel',
                    'Overlap ratio'
                ),
                value: String(summary.overlapRatioPct == null ? 0 : summary.overlapRatioPct) + '%',
            },
            {
                title: translate(
                    'agentWorkspace.queryBackendComparison.latencyDeltaLabel',
                    'Latency delta (left-right)'
                ),
                value: String(summary.latencyDeltaMs == null ? 0 : summary.latencyDeltaMs) + 'ms',
            },
            {
                title: translate(
                    'agentWorkspace.queryBackendComparison.evidenceCoverageLabel',
                    'Evidence coverage (left/right)'
                ),
                value: `${String(summary.leftEvidenceCoveragePct == null ? 0 : summary.leftEvidenceCoveragePct)}% / ${String(summary.rightEvidenceCoveragePct == null ? 0 : summary.rightEvidenceCoveragePct)}%`,
            },
            {
                title: translate(
                    'agentWorkspace.queryBackendComparison.relationCoverageLabel',
                    'Relation-path coverage (left/right)'
                ),
                value: `${String(summary.leftRelationPathCoveragePct == null ? 0 : summary.leftRelationPathCoveragePct)}% / ${String(summary.rightRelationPathCoveragePct == null ? 0 : summary.rightRelationPathCoveragePct)}%`,
            },
            {
                title: translate(
                    'agentWorkspace.queryBackendComparison.temporalPassLabel',
                    'Temporal pass (left/right)'
                ),
                value: `${String(summary.leftTemporalValidityPassPct == null ? 0 : summary.leftTemporalValidityPassPct)}% / ${String(summary.rightTemporalValidityPassPct == null ? 0 : summary.rightTemporalValidityPassPct)}%`,
            },
            {
                title: translate(
                    'agentWorkspace.queryBackendComparison.reasonLabel',
                    'Reason'
                ),
                value: reasonText,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderQueryBackendDiagnosticsCard(node, payload) {
        const resolveStatusChipClass = (tokenLike) => {
            const token = String(tokenLike || '').trim().toLowerCase();
            const allowed = new Set([
                'available',
                'unavailable',
                'unknown',
                'fresh',
                'warn',
                'stale',
            ]);
            if (!allowed.has(token)) {
                return '';
            }
            return `status-chip status-${token}`;
        };
        const summary = payload && typeof payload === 'object' ? payload : {};
        const backendId = String(summary.backendId || '').trim()
            || translate('agentWorkspace.queryBackendDiagnostics.none', 'none');
        const configuredBackend = String(summary.configuredBackend || '').trim()
            || translate('agentWorkspace.queryBackendDiagnostics.none', 'none');
        const summaryText = translate(
            'agentWorkspace.queryBackendDiagnostics.summary',
            'Backend {backendId} configured as {configuredBackend}; fallback count {fallbackCount}.',
            {
                backendId,
                configuredBackend,
                fallbackCount: String(summary.fallbackCount == null ? 0 : summary.fallbackCount),
            }
        );
        const title = translate(
            'agentWorkspace.queryBackendDiagnostics.cardTitle',
            'Query Backend Diagnostics'
        );
        const metricsHeading = translate(
            'agentWorkspace.queryBackendDiagnostics.metricsHeading',
            'Key Metrics'
        );
        const noneLabel = translate('agentWorkspace.queryBackendDiagnostics.none', 'none');
        const fallbackBackendId = String(summary.fallbackBackendId || '').trim()
            || noneLabel;
        const lastError = String(summary.lastError || '').trim()
            || noneLabel;
        const runtimeLastError = String(summary.runtimeLastError || '').trim()
            || noneLabel;
        const configuredVectorAccelerationProvider = String(
            summary.configuredVectorAccelerationProvider || ''
        ).trim() || noneLabel;
        const configuredVectorAccelerationFailureMode = String(
            summary.configuredVectorAccelerationFailureMode || ''
        ).trim() || noneLabel;
        const configuredVectorAccelerationRepresentationStrict = summary.configuredVectorAccelerationRepresentationStrict === true
            ? translate('agentWorkspace.queryBackendDiagnostics.boolEnabled', 'enabled')
            : (
                summary.configuredVectorAccelerationRepresentationStrict === false
                    ? translate('agentWorkspace.queryBackendDiagnostics.boolDisabled', 'disabled')
                    : translate('agentWorkspace.queryBackendDiagnostics.annPrefilterUnknown', 'unknown')
            );
        const queryVectorAnnPrefilterStatus = summary.queryVectorAnnPrefilterEnabled === true
            ? translate('agentWorkspace.queryBackendDiagnostics.annPrefilterEnabled', 'enabled')
            : (
                summary.queryVectorAnnPrefilterEnabled === false
                    ? translate('agentWorkspace.queryBackendDiagnostics.annPrefilterDisabled', 'disabled')
                    : translate('agentWorkspace.queryBackendDiagnostics.annPrefilterUnknown', 'unknown')
            );
        const rolloutMode = String(summary.rolloutMode || '').trim() || noneLabel;
        const graphvizRuntimeStatusToken = summary.graphvizRuntimeAvailable === true
            ? 'available'
            : (summary.graphvizRuntimeAvailable === false ? 'unavailable' : 'unknown');
        const graphvizRuntimeStatus = graphvizRuntimeStatusToken === 'available'
            ? translate('agentWorkspace.queryBackendDiagnostics.statusAvailable', 'available')
            : (
                graphvizRuntimeStatusToken === 'unavailable'
                    ? translate('agentWorkspace.queryBackendDiagnostics.statusUnavailable', 'unavailable')
                    : translate('agentWorkspace.queryBackendDiagnostics.statusUnknown', 'unknown')
            );
        const graphvizDotBinary = String(summary.graphvizDotBinary || '').trim()
            || translate('agentWorkspace.queryBackendDiagnostics.none', 'none');
        const graphvizRuntimeReason = String(summary.graphvizRuntimeReason || '').trim()
            || translate('agentWorkspace.queryBackendDiagnostics.none', 'none');
        const graphvizCheckedAtMs = Number(summary.graphvizCheckedAtMs || 0);
        const graphvizCheckedAt = graphvizCheckedAtMs > 0
            ? new Date(graphvizCheckedAtMs).toISOString()
            : translate('agentWorkspace.queryBackendDiagnostics.none', 'none');
        const graphvizProbeCacheTtlMs = Number(summary.graphvizProbeCacheTtlMs || 0);
        const graphvizProbeAgeMs = graphvizCheckedAtMs > 0
            ? Math.max(0, Date.now() - graphvizCheckedAtMs)
            : -1;
        const graphvizFreshnessToken = (() => {
            if (graphvizCheckedAtMs <= 0 || graphvizProbeCacheTtlMs <= 0 || graphvizProbeAgeMs < 0) {
                return 'unknown';
            }
            if (graphvizProbeAgeMs <= graphvizProbeCacheTtlMs) {
                return 'fresh';
            }
            if (graphvizProbeAgeMs <= graphvizProbeCacheTtlMs * 2) {
                return 'warn';
            }
            return 'stale';
        })();
        const graphvizFreshnessStatus = graphvizFreshnessToken === 'fresh'
            ? translate('agentWorkspace.queryBackendDiagnostics.freshnessFresh', 'fresh')
            : (
                graphvizFreshnessToken === 'warn'
                    ? translate('agentWorkspace.queryBackendDiagnostics.freshnessWarn', 'warn')
                    : (
                        graphvizFreshnessToken === 'stale'
                            ? translate('agentWorkspace.queryBackendDiagnostics.freshnessStale', 'stale')
                            : translate('agentWorkspace.queryBackendDiagnostics.freshnessUnknown', 'unknown')
                    )
            );
        const metrics = [
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.comparisonsLabel', 'Comparisons'),
                value: `${String(summary.totalComparisons == null ? 0 : summary.totalComparisons)} (overlap ${String(summary.averageOverlapRatioPct == null ? 0 : summary.averageOverlapRatioPct)}%)`,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.preferredCountsLabel', 'Preferred counts (left/right/tie)'),
                value: `${String(summary.leftPreferredCount == null ? 0 : summary.leftPreferredCount)}/${String(summary.rightPreferredCount == null ? 0 : summary.rightPreferredCount)}/${String(summary.tieCount == null ? 0 : summary.tieCount)}`,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.latencyDeltaLabel', 'Average latency delta'),
                value: `${String(summary.averageLatencyDeltaMs == null ? 0 : summary.averageLatencyDeltaMs)}ms`,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.runtimeReadyLabel', 'Runtime ready'),
                value: summary.runtimeReady ? 'true' : 'false',
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.graphvizRuntimeLabel', 'Graphviz runtime'),
                value: graphvizRuntimeStatus,
                statusToken: graphvizRuntimeStatusToken,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.graphvizDotBinaryLabel', 'Graphviz dot binary'),
                value: graphvizDotBinary,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.graphvizReasonLabel', 'Graphviz runtime reason'),
                value: graphvizRuntimeReason,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.graphvizCheckedAtLabel', 'Graphviz checked at/cache ttl'),
                value: `${graphvizCheckedAt} / ${String(graphvizProbeCacheTtlMs)}ms`,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.graphvizFreshnessLabel', 'Graphviz probe freshness'),
                value: graphvizProbeAgeMs >= 0
                    ? `${graphvizFreshnessStatus} (${String(graphvizProbeAgeMs)}ms)`
                    : graphvizFreshnessStatus,
                statusToken: graphvizFreshnessToken,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.vectorIndexLabel', 'Vector index status/atoms'),
                value: `${String(summary.vectorIndexStatus || 'unknown')} / ${String(summary.vectorIndexAtomCount == null ? 0 : summary.vectorIndexAtomCount)}`,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.accelerationLabel', 'Acceleration mode/selection'),
                value: `${String(summary.vectorAccelerationMode || 'unknown')} / ${String(summary.vectorAccelerationSelectionMode || 'unknown')}`,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.healthLabel', 'Acceleration health/circuit'),
                value: `${String(summary.vectorAccelerationHealthStatus || 'unknown')} / ${String(summary.vectorAccelerationCircuitState || 'unknown')}`,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.rolloutModeLabel', 'Rollout profile mode'),
                value: rolloutMode,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.accelerationProviderLabel', 'Configured acceleration provider'),
                value: configuredVectorAccelerationProvider,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.accelerationFailureModeLabel', 'Configured acceleration failure mode'),
                value: configuredVectorAccelerationFailureMode,
            },
            {
                title: translate(
                    'agentWorkspace.queryBackendDiagnostics.accelerationRepresentationStrictLabel',
                    'Configured acceleration representation strict mode'
                ),
                value: configuredVectorAccelerationRepresentationStrict,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.annPrefilterLabel', 'ANN prefilter rollout'),
                value: queryVectorAnnPrefilterStatus,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.fallbackBackendLabel', 'Fallback backend'),
                value: fallbackBackendId,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.lastErrorLabel', 'Last error'),
                value: lastError,
            },
            {
                title: translate('agentWorkspace.queryBackendDiagnostics.runtimeLastErrorLabel', 'Runtime last error'),
                value: runtimeLastError,
            },
        ];
        const metricsHtml = metrics.map((metric) => {
            const statusClass = resolveStatusChipClass(metric.statusToken);
            const metaClass = statusClass
                ? `agent-chat-card-list-meta ${statusClass}`
                : 'agent-chat-card-list-meta';
            return `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="${metaClass}">${escapeHtml(metric.value)}</div>
            </li>
        `;
        }).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderQueryBackendComparisonHistoryCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.queryBackendComparisonHistory.cardTitle',
            'Backend Comparison History'
        );
        const summaryText = translate(
            'agentWorkspace.queryBackendComparisonHistory.summary',
            '{returnedRecords}/{totalRecords} records, avg overlap {averageOverlapRatioPct}%, avg latency delta {averageLatencyDeltaMs}ms.',
            {
                returnedRecords: String(summary.returnedRecords == null ? 0 : summary.returnedRecords),
                totalRecords: String(summary.totalRecords == null ? 0 : summary.totalRecords),
                averageOverlapRatioPct: String(summary.averageOverlapRatioPct == null ? 0 : summary.averageOverlapRatioPct),
                averageLatencyDeltaMs: String(summary.averageLatencyDeltaMs == null ? 0 : summary.averageLatencyDeltaMs),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.queryBackendComparisonHistory.metricsHeading',
            'Key Metrics'
        );
        const latestComparedAt = String(summary.latestComparedAt || '').trim()
            || translate('agentWorkspace.queryBackendComparisonHistory.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.queryBackendComparisonHistory.preferredCountsLabel', 'Preferred counts (left/right/tie)'),
                value: `${String(summary.leftPreferredCount == null ? 0 : summary.leftPreferredCount)}/${String(summary.rightPreferredCount == null ? 0 : summary.rightPreferredCount)}/${String(summary.tieCount == null ? 0 : summary.tieCount)}`,
            },
            {
                title: translate('agentWorkspace.queryBackendComparisonHistory.evidenceCoverageLabel', 'Average evidence coverage (left/right)'),
                value: `${String(summary.averageLeftEvidenceCoveragePct == null ? 0 : summary.averageLeftEvidenceCoveragePct)}% / ${String(summary.averageRightEvidenceCoveragePct == null ? 0 : summary.averageRightEvidenceCoveragePct)}%`,
            },
            {
                title: translate('agentWorkspace.queryBackendComparisonHistory.latestComparedAtLabel', 'Latest compared at'),
                value: latestComparedAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderQueryBackendComparisonTrendCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.queryBackendComparisonTrend.cardTitle',
            'Backend Comparison Trend'
        );
        const summaryText = translate(
            'agentWorkspace.queryBackendComparisonTrend.summary',
            'Status {status} (confidence {confidencePct}%, score {score}).',
            {
                status: String(summary.status || 'unknown'),
                confidencePct: String(summary.confidencePct == null ? 0 : summary.confidencePct),
                score: String(summary.score == null ? 0 : summary.score),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.queryBackendComparisonTrend.metricsHeading',
            'Key Metrics'
        );
        const reason = String(summary.reason || '').trim()
            || translate('agentWorkspace.queryBackendComparisonTrend.none', 'none');
        const latestComparedAt = String(summary.latestComparedAt || '').trim()
            || translate('agentWorkspace.queryBackendComparisonTrend.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.queryBackendComparisonTrend.recordsLabel', 'Evaluated records'),
                value: `${String(summary.evaluatedRecords == null ? 0 : summary.evaluatedRecords)}/${String(summary.totalRecords == null ? 0 : summary.totalRecords)}`,
            },
            {
                title: translate('agentWorkspace.queryBackendComparisonTrend.overlapDeltaLabel', 'Overlap delta'),
                value: `${String(summary.overlapDeltaPct == null ? 0 : summary.overlapDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.queryBackendComparisonTrend.explainabilityDeltaLabel', 'Explainability gap delta'),
                value: `${String(summary.explainabilityGapDeltaPct == null ? 0 : summary.explainabilityGapDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.queryBackendComparisonTrend.reasonLabel', 'Reason'),
                value: reason,
            },
            {
                title: translate('agentWorkspace.queryBackendComparisonTrend.latestComparedAtLabel', 'Latest compared at'),
                value: latestComparedAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderLearningQualityTrendCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.learningQualityTrend.cardTitle',
            'Learning Quality Trend'
        );
        const summaryText = translate(
            'agentWorkspace.learningQualityTrend.summary',
            'Status {status} (confidence {confidencePct}%, score {score}).',
            {
                status: String(summary.status || 'unknown'),
                confidencePct: String(summary.confidencePct == null ? 0 : summary.confidencePct),
                score: String(summary.score == null ? 0 : summary.score),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.learningQualityTrend.metricsHeading',
            'Key Metrics'
        );
        const reason = String(summary.reason || '').trim()
            || translate('agentWorkspace.learningQualityTrend.none', 'none');
        const latestSampledAt = String(summary.latestSampledAt || '').trim()
            || translate('agentWorkspace.learningQualityTrend.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.learningQualityTrend.recordsLabel', 'Evaluated records'),
                value: `${String(summary.evaluatedRecords == null ? 0 : summary.evaluatedRecords)}/${String(summary.totalRecords == null ? 0 : summary.totalRecords)}`,
            },
            {
                title: translate('agentWorkspace.learningQualityTrend.retestDeltaLabel', 'Retest pass delta'),
                value: `${String(summary.retestPassRateDeltaPct == null ? 0 : summary.retestPassRateDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityTrend.evidenceDeltaLabel', 'Evidence-backed delta'),
                value: `${String(summary.evidenceBackedSuggestionDeltaPct == null ? 0 : summary.evidenceBackedSuggestionDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityTrend.misconceptionDeltaLabel', 'Misconception recurrence delta'),
                value: `${String(summary.misconceptionRecurrenceDeltaPct == null ? 0 : summary.misconceptionRecurrenceDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityTrend.fallbackDeltaLabel', 'Query fallback delta'),
                value: `${String(summary.queryBackendFallbackDeltaPct == null ? 0 : summary.queryBackendFallbackDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityTrend.reasonLabel', 'Reason'),
                value: reason,
            },
            {
                title: translate('agentWorkspace.learningQualityTrend.latestSampledAtLabel', 'Latest sampled at'),
                value: latestSampledAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderSessionPlanQualityTrendCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.sessionPlanQualityTrend.cardTitle',
            'Session Plan Quality Trend'
        );
        const summaryText = translate(
            'agentWorkspace.sessionPlanQualityTrend.summary',
            'Status {status} (confidence {confidencePct}%, score {score}).',
            {
                status: String(summary.status || 'unknown'),
                confidencePct: String(summary.confidencePct == null ? 0 : summary.confidencePct),
                score: String(summary.score == null ? 0 : summary.score),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.sessionPlanQualityTrend.metricsHeading',
            'Key Metrics'
        );
        const reason = String(summary.reason || '').trim()
            || translate('agentWorkspace.sessionPlanQualityTrend.none', 'none');
        const latestEvaluatedAt = String(summary.latestEvaluatedAt || '').trim()
            || translate('agentWorkspace.sessionPlanQualityTrend.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.recordsLabel', 'Evaluated records'),
                value: `${String(summary.evaluatedRecords == null ? 0 : summary.evaluatedRecords)}/${String(summary.totalRecords == null ? 0 : summary.totalRecords)}`,
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.passRateDeltaLabel', 'Pass-rate delta'),
                value: `${String(summary.passRateDeltaPct == null ? 0 : summary.passRateDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.evidenceDeltaLabel', 'Evidence coverage delta'),
                value: `${String(summary.evidenceCoverageDeltaPct == null ? 0 : summary.evidenceCoverageDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.budgetDeltaLabel', 'Budget deviation delta'),
                value: String(summary.budgetDeviationDeltaActions == null ? 0 : summary.budgetDeviationDeltaActions),
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.recoveryDeltaLabel', 'Recovery-share delta'),
                value: `${String(summary.recoveryShareDeltaPct == null ? 0 : summary.recoveryShareDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.divergenceDeltaLabel', 'Divergence-share delta'),
                value: `${String(summary.divergenceShareDeltaPct == null ? 0 : summary.divergenceShareDeltaPct)}%`,
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.reasonLabel', 'Reason'),
                value: reason,
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityTrend.latestEvaluatedAtLabel', 'Latest evaluated at'),
                value: latestEvaluatedAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderLearningQualityHistoryCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.learningQualityHistory.cardTitle',
            'Learning Quality History'
        );
        const summaryText = translate(
            'agentWorkspace.learningQualityHistory.summary',
            '{returnedRecords}/{totalRecords} records available.',
            {
                returnedRecords: String(summary.returnedRecords == null ? 0 : summary.returnedRecords),
                totalRecords: String(summary.totalRecords == null ? 0 : summary.totalRecords),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.learningQualityHistory.metricsHeading',
            'Key Metrics'
        );
        const latestSampledAt = String(summary.latestSampledAt || '').trim()
            || translate('agentWorkspace.learningQualityHistory.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.learningQualityHistory.latestRetestPassRateLabel', 'Latest retest pass rate'),
                value: `${String(summary.latestRetestPassRatePct == null ? 0 : summary.latestRetestPassRatePct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityHistory.latestEvidenceRatioLabel', 'Latest evidence-backed ratio'),
                value: `${String(summary.latestEvidenceBackedSuggestionRatioPct == null ? 0 : summary.latestEvidenceBackedSuggestionRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityHistory.latestMisconceptionRecurrenceLabel', 'Latest misconception recurrence'),
                value: `${String(summary.latestMisconceptionRecurrenceRatePct == null ? 0 : summary.latestMisconceptionRecurrenceRatePct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityHistory.latestQueryFallbackLabel', 'Latest query fallback ratio'),
                value: `${String(summary.latestQueryBackendFallbackRatioPct == null ? 0 : summary.latestQueryBackendFallbackRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.learningQualityHistory.latestSampledAtLabel', 'Latest sampled at'),
                value: latestSampledAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderLearningQualityBaselineEvaluationCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.learningQualityBaselineEvaluation.cardTitle',
            'Learning Quality Baseline Evaluation'
        );
        const summaryText = translate(
            'agentWorkspace.learningQualityBaselineEvaluation.summary',
            'User {userId}: overall {overallStatus}, failed gates {failedGateCount}.',
            {
                userId: String(summary.userId || 'unknown'),
                overallStatus: summary.overallPassed ? 'PASS' : 'FAIL',
                failedGateCount: String(summary.failedGateCount == null ? 0 : summary.failedGateCount),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.learningQualityBaselineEvaluation.metricsHeading',
            'Key Metrics'
        );
        const noneLabel = translate(
            'agentWorkspace.learningQualityBaselineEvaluation.none',
            'none'
        );
        const metrics = [
            {
                title: translate(
                    'agentWorkspace.learningQualityBaselineEvaluation.baselineLabel',
                    'Baseline retest/evidence'
                ),
                value: `${String(summary.baselineRetestPassRatePct == null ? 0 : summary.baselineRetestPassRatePct)}% / `
                    + `${String(summary.baselineEvidenceBackedSuggestionRatioPct == null ? 0 : summary.baselineEvidenceBackedSuggestionRatioPct)}%`,
            },
            {
                title: translate(
                    'agentWorkspace.learningQualityBaselineEvaluation.currentLabel',
                    'Current retest/evidence'
                ),
                value: `${String(summary.currentRetestPassRatePct == null ? 0 : summary.currentRetestPassRatePct)}% / `
                    + `${String(summary.currentEvidenceBackedSuggestionRatioPct == null ? 0 : summary.currentEvidenceBackedSuggestionRatioPct)}%`,
            },
            {
                title: translate(
                    'agentWorkspace.learningQualityBaselineEvaluation.failedGateLabel',
                    'First failed gate'
                ),
                value: summary.firstFailedGateId
                    ? `${String(summary.firstFailedGateId)} (${String(summary.firstFailedGateObserved)} / ${String(summary.firstFailedGateThreshold)})`
                    : noneLabel,
            },
            {
                title: translate(
                    'agentWorkspace.learningQualityBaselineEvaluation.timestampsLabel',
                    'Baseline stored / current sampled / evaluated'
                ),
                value: `${String(summary.baselineStoredAt || noneLabel)} | ${String(summary.currentSampledAt || noneLabel)} | ${String(summary.evaluatedAt || noneLabel)}`,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderSessionPlanQualityHistoryCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.sessionPlanQualityHistory.cardTitle',
            'Session Plan Quality History'
        );
        const summaryText = translate(
            'agentWorkspace.sessionPlanQualityHistory.summary',
            '{returnedRecords}/{totalRecords} records, pass rate {returnedPassRatePct}% (overall {overallPassRatePct}%).',
            {
                returnedRecords: String(summary.returnedRecords == null ? 0 : summary.returnedRecords),
                totalRecords: String(summary.totalRecords == null ? 0 : summary.totalRecords),
                returnedPassRatePct: String(summary.returnedPassRatePct == null ? 0 : summary.returnedPassRatePct),
                overallPassRatePct: String(summary.overallPassRatePct == null ? 0 : summary.overallPassRatePct),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.sessionPlanQualityHistory.metricsHeading',
            'Key Metrics'
        );
        const latestEvaluatedAt = String(summary.latestEvaluatedAt || '').trim()
            || translate('agentWorkspace.sessionPlanQualityHistory.none', 'none');
        const topFailedGateId = String(summary.topFailedGateId || '').trim()
            || translate('agentWorkspace.sessionPlanQualityHistory.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.sessionPlanQualityHistory.consecutiveFailureCountLabel', 'Consecutive failure count'),
                value: String(summary.consecutiveFailureCount == null ? 0 : summary.consecutiveFailureCount),
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityHistory.averageBudgetDeviationLabel', 'Average budget deviation'),
                value: String(summary.averageBudgetDeviationActions == null ? 0 : summary.averageBudgetDeviationActions),
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityHistory.topFailedGateLabel', 'Top failed gate'),
                value: `${topFailedGateId}${Number(summary.topFailedGateCount || 0) > 0 ? ` (${String(summary.topFailedGateCount)})` : ''}`,
            },
            {
                title: translate('agentWorkspace.sessionPlanQualityHistory.latestEvaluatedAtLabel', 'Latest evaluated at'),
                value: latestEvaluatedAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderRuntimeCapabilityRunbookVerifyCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.runtimeRunbookVerify.cardTitle',
            'Runtime Runbook Verify'
        );
        const selectedCheckId = String(summary.selectedCheckId || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const summaryText = translate(
            'agentWorkspace.runtimeRunbookVerify.summary',
            'Check {selectedCheckId}: status {selectedCheckStatus}, escalation {selectedCheckEscalation}.',
            {
                selectedCheckId: selectedCheckId,
                selectedCheckStatus: String(summary.selectedCheckStatus || 'unknown'),
                selectedCheckEscalation: String(summary.selectedCheckEscalation || 'normal'),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.runtimeRunbookVerify.metricsHeading',
            'Key Metrics'
        );
        const topRiskCheckId = String(summary.topRiskCheckId || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const autoFocusSummary = summary.autoFocusApplied
            ? translate(
                'agentWorkspace.runtimeRunbookVerify.autoFocusApplied',
                'applied ({reason})',
                {
                    reason: String(summary.autoFocusReason || 'none'),
                }
            )
            : translate('agentWorkspace.runtimeRunbookVerify.autoFocusNotApplied', 'not applied');
        const firstEscalationAction = String(summary.firstEscalationAction || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annCircuitState = String(summary.annCircuitState || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annCircuitBudgetStatus = String(summary.annCircuitBudgetStatus || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annIndexSyncStatus = String(summary.annIndexSyncStatus || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annIndexLastSyncAt = String(summary.annIndexLastSyncAt || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annTraceabilityCoverage = String(summary.annTraceabilityCoverage || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annTraceabilityMissingFields = Array.isArray(summary.annTraceabilityMissingFields)
            ? summary.annTraceabilityMissingFields
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        const annPrefilterSelectionMode = String(summary.annPrefilterSelectionMode || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annPrefilterBudgetStatus = String(summary.annPrefilterBudgetStatus || '').trim()
            || translate('agentWorkspace.runtimeRunbookVerify.none', 'none');
        const annCircuitThresholdsMissing = (
            Number(summary.annCircuitWarnBudgetShortCircuitCountLt || 0) <= 0
            && Number(summary.annCircuitWarnBudgetShortCircuitRatioPctLt || 0) <= 0
            && Number(summary.annCircuitFailBudgetShortCircuitCountLt || 0) <= 0
            && Number(summary.annCircuitFailBudgetShortCircuitRatioPctLt || 0) <= 0
        );
        const annCircuitThresholdsSummary = annCircuitThresholdsMissing
            ? translate('agentWorkspace.runtimeRunbookVerify.none', 'none')
            : [
                `warn count<${String(summary.annCircuitWarnBudgetShortCircuitCountLt == null ? 0 : summary.annCircuitWarnBudgetShortCircuitCountLt)}`,
                `ratio<${String(summary.annCircuitWarnBudgetShortCircuitRatioPctLt == null ? 0 : summary.annCircuitWarnBudgetShortCircuitRatioPctLt)}%`,
                `failStreak<${String(summary.annCircuitWarnBudgetConsecutiveFailuresLt == null ? 0 : summary.annCircuitWarnBudgetConsecutiveFailuresLt)}`,
                `halfOpen>=${String(summary.annCircuitWarnBudgetHalfOpenSuccessRatePctGte == null ? 0 : summary.annCircuitWarnBudgetHalfOpenSuccessRatePctGte)}%`,
            ].join(' ');
        const annCircuitFailThresholdsSummary = annCircuitThresholdsMissing
            ? ''
            : [
                `fail count<${String(summary.annCircuitFailBudgetShortCircuitCountLt == null ? 0 : summary.annCircuitFailBudgetShortCircuitCountLt)}`,
                `ratio<${String(summary.annCircuitFailBudgetShortCircuitRatioPctLt == null ? 0 : summary.annCircuitFailBudgetShortCircuitRatioPctLt)}%`,
                `failStreak<${String(summary.annCircuitFailBudgetConsecutiveFailuresLt == null ? 0 : summary.annCircuitFailBudgetConsecutiveFailuresLt)}`,
                `halfOpen>=${String(summary.annCircuitFailBudgetHalfOpenSuccessRatePctGte == null ? 0 : summary.annCircuitFailBudgetHalfOpenSuccessRatePctGte)}%`,
            ].join(' ');
        const annTraceabilitySignalsSummary = `requests ${String(summary.annTraceabilityRequestCount == null ? 0 : summary.annTraceabilityRequestCount)} | short circuits ${String(summary.annTraceabilityShortCircuitCount == null ? 0 : summary.annTraceabilityShortCircuitCount)} | consecutive failures ${String(summary.annTraceabilityConsecutiveFailures == null ? 0 : summary.annTraceabilityConsecutiveFailures)}`;
        const annCircuitBudgetFlagsSummary = `warn ${summary.annCircuitWarnBudgetExceeded ? 'exceeded' : 'clear'} | fail ${summary.annCircuitFailBudgetExceeded ? 'exceeded' : 'clear'}`;
        const annPrefilterThresholdsSummary = Number(summary.annPrefilterMinRequestSampleGte || 0) <= 0
            && Number(summary.annPrefilterWarnCandidateRatioPctLt || 0) <= 0
            && Number(summary.annPrefilterFailCandidateRatioPctLt || 0) <= 0
            ? translate('agentWorkspace.runtimeRunbookVerify.none', 'none')
            : `sample>=${String(summary.annPrefilterMinRequestSampleGte == null ? 0 : summary.annPrefilterMinRequestSampleGte)} | warn ratio<${String(summary.annPrefilterWarnCandidateRatioPctLt == null ? 0 : summary.annPrefilterWarnCandidateRatioPctLt)}% | fail ratio<${String(summary.annPrefilterFailCandidateRatioPctLt == null ? 0 : summary.annPrefilterFailCandidateRatioPctLt)}%`;
        const annPrefilterCalibrationMissing = (
            Number(summary.annPrefilterMinRequestSampleGte || 0) <= 0
            && !summary.annPrefilterSelectionMode
            && !summary.annPrefilterBudgetStatus
        );
        const annPrefilterCalibrationSummary = annPrefilterCalibrationMissing
            ? translate('agentWorkspace.runtimeRunbookVerify.none', 'none')
            : `sample ${summary.annPrefilterSampleReady ? 'ready' : 'pending'} | selection ${summary.annPrefilterSelectionActive ? 'active' : 'inactive'} | connector ${summary.annPrefilterStableConnector ? 'stable' : 'unstable'} | ratio ${summary.annPrefilterCanEvaluateCandidateRatio ? 'evaluable' : 'blocked'} | warn ${summary.annPrefilterWarnBudgetExceeded ? 'exceeded' : 'clear'} | fail ${summary.annPrefilterFailBudgetExceeded ? 'exceeded' : 'clear'}`;
        const annCalibrationSummary = !summary.annCalibrationStatus
            ? translate('agentWorkspace.runtimeRunbookVerify.none', 'none')
            : (
                summary.annCalibrationStatus === 'pass'
                && String(summary.annCalibrationMode || '').trim() !== 'ann_prefilter'
            )
                ? `${String(summary.annCalibrationStatus || 'unknown')} (mode ${String(summary.annCalibrationMode || '').trim() || translate('agentWorkspace.runtimeRunbookVerify.none', 'none')}, out_of_scope)`
                : (
                    summary.annCalibrationStatus === 'pass'
                    && !summary.annCalibrationExternalConnector
                )
                    ? `${String(summary.annCalibrationStatus || 'unknown')} (local_adapter_path)`
                    : `${String(summary.annCalibrationStatus || 'unknown')} (sync ${summary.annCalibrationSyncReady ? 'ready' : 'pending'} | sample ${summary.annCalibrationSampleReady ? 'ready' : 'pending'} | selection ${summary.annCalibrationSelectionActive ? 'active' : 'inactive'} | connector ${summary.annCalibrationStableConnector ? 'stable' : 'unstable'} | ratio ${summary.annCalibrationCanEvaluateCandidateRatio ? 'evaluable' : 'blocked'} | traceability ${summary.annCalibrationTraceabilityReady ? 'ready' : 'pending'} | circuit ${String(summary.annCalibrationCircuitBudgetStatus || 'unknown') || 'unknown'} | prefilter ${String(summary.annCalibrationPrefilterBudgetStatus || 'unknown') || 'unknown'})`;
        const metrics = [
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.topRiskLabel', 'Top risk check'),
                value: `${topRiskCheckId} (${String(summary.topRiskStatus || 'none')})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.traceErrorLabel', 'Trace errors'),
                value: `${String(summary.traceErrorRequests == null ? 0 : summary.traceErrorRequests)}/${String(summary.traceReturnedRecords == null ? 0 : summary.traceReturnedRecords)} (${String(summary.traceErrorRatioPct == null ? 0 : summary.traceErrorRatioPct)}%)`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.traceP95Label', 'Trace p95 duration'),
                value: `${String(summary.traceP95DurationMs == null ? 0 : summary.traceP95DurationMs)}ms`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.historyStreakLabel', 'Risk/fail streak'),
                value: `${String(summary.historyRiskStreak == null ? 0 : summary.historyRiskStreak)}/${String(summary.historyFailStreak == null ? 0 : summary.historyFailStreak)}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.historyTrendLabel', 'History trend'),
                value: String(summary.historyTrendStatus || 'insufficient_data'),
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.remediationRiskRatioLabel', 'Remediation risk ratio'),
                value: `${String(summary.remediationRiskRatioPct == null ? 0 : summary.remediationRiskRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.autoFocusLabel', 'Auto focus'),
                value: autoFocusSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.firstEscalationActionLabel', 'Top escalation action'),
                value: firstEscalationAction,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annIndexSyncLabel', 'ANN sync health'),
                value: `${annIndexSyncStatus} (${String(summary.annIndexSyncMessage || '').trim() || translate('agentWorkspace.runtimeRunbookVerify.none', 'none')})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annIndexSyncCountsLabel', 'ANN sync counts'),
                value: `${String(summary.annIndexSyncRequestCount == null ? 0 : summary.annIndexSyncRequestCount)}/${String(summary.annIndexSyncSuccessCount == null ? 0 : summary.annIndexSyncSuccessCount)}/${String(summary.annIndexSyncFailureCount == null ? 0 : summary.annIndexSyncFailureCount)} | atoms ${String(summary.annIndexSyncedAtomCount == null ? 0 : summary.annIndexSyncedAtomCount)} | ${annIndexLastSyncAt}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annCircuitLabel', 'ANN circuit budget'),
                value: `${annCircuitState} (${String(summary.annCircuitHealthStatus || '').trim() || translate('agentWorkspace.runtimeRunbookVerify.none', 'none')}, ${String(summary.annCircuitShortCircuitRatioPct == null ? 0 : summary.annCircuitShortCircuitRatioPct)}%, ${annCircuitBudgetStatus})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annCircuitThresholdsLabel', 'ANN circuit thresholds'),
                value: annCircuitThresholdsMissing
                    ? annCircuitThresholdsSummary
                    : `${annCircuitThresholdsSummary} | ${annCircuitFailThresholdsSummary}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annCircuitBudgetFlagsLabel', 'ANN circuit budget flags'),
                value: annCircuitBudgetFlagsSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annTraceabilityLabel', 'ANN traceability'),
                value: `${annTraceabilityCoverage} (${annTraceabilityMissingFields.length > 0 ? annTraceabilityMissingFields.join(', ') : (String(summary.annTraceabilityLastRequestId || '').trim() || translate('agentWorkspace.runtimeRunbookVerify.none', 'none'))})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annTraceabilitySignalsLabel', 'ANN traceability signals'),
                value: annTraceabilitySignalsSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annPrefilterLabel', 'ANN prefilter'),
                value: `${annPrefilterSelectionMode} (${String(summary.annPrefilterCandidateRatioPct == null ? 0 : summary.annPrefilterCandidateRatioPct)}%, ${annPrefilterBudgetStatus}${summary.annPrefilterFullScanFallback ? ', full_scan' : ''})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annPrefilterThresholdsLabel', 'ANN prefilter thresholds'),
                value: annPrefilterThresholdsSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annPrefilterCalibrationLabel', 'ANN prefilter calibration'),
                value: annPrefilterCalibrationSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookVerify.annCalibrationReadinessLabel', 'ANN calibration readiness'),
                value: annCalibrationSummary,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderRuntimeCapabilityRunbookHistoryCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.runtimeRunbookHistory.cardTitle',
            'Runtime Runbook History'
        );
        const checkIdLabel = String(summary.checkId || '').trim()
            || translate('agentWorkspace.runtimeRunbookHistory.allChecks', 'all checks');
        const summaryText = translate(
            'agentWorkspace.runtimeRunbookHistory.summary',
            '{returnedRecords}/{matchedRecords} records for {checkId} in {sinceMinutes} minutes; trend {trendStatus}.',
            {
                returnedRecords: String(summary.returnedRecords == null ? 0 : summary.returnedRecords),
                matchedRecords: String(summary.matchedRecords == null ? 0 : summary.matchedRecords),
                checkId: checkIdLabel,
                sinceMinutes: String(summary.sinceMinutes == null ? 0 : summary.sinceMinutes),
                trendStatus: String(summary.trendStatus || 'insufficient_data'),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.runtimeRunbookHistory.metricsHeading',
            'Key Metrics'
        );
        const latestVerifiedAt = String(summary.latestVerifiedAt || '').trim()
            || translate('agentWorkspace.runtimeRunbookHistory.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.runtimeRunbookHistory.statusCountsLabel', 'Status counts (pass/warn/fail/unknown)'),
                value: `${String(summary.statusPassCount == null ? 0 : summary.statusPassCount)}/${String(summary.statusWarnCount == null ? 0 : summary.statusWarnCount)}/${String(summary.statusFailCount == null ? 0 : summary.statusFailCount)}/${String(summary.statusUnknownCount == null ? 0 : summary.statusUnknownCount)}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookHistory.activeStreakLabel', 'Active risk/fail streak'),
                value: `${String(summary.activeRiskStreak == null ? 0 : summary.activeRiskStreak)}/${String(summary.activeFailStreak == null ? 0 : summary.activeFailStreak)}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookHistory.averageErrorRatioLabel', 'Average error ratio'),
                value: `${String(summary.averageErrorRatioPct == null ? 0 : summary.averageErrorRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookHistory.averageP95Label', 'Average p95 duration'),
                value: `${String(summary.averageP95DurationMs == null ? 0 : summary.averageP95DurationMs)}ms`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookHistory.deltaLabel', 'Severity/error/p95 delta'),
                value: `${String(summary.severityDelta == null ? 0 : summary.severityDelta)} / ${String(summary.errorRatioDeltaPct == null ? 0 : summary.errorRatioDeltaPct)}% / ${String(summary.p95DurationDeltaMs == null ? 0 : summary.p95DurationDeltaMs)}ms`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookHistory.latestVerifiedAtLabel', 'Latest verified at'),
                value: latestVerifiedAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderRuntimeCapabilityRunbookChecksCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.runtimeRunbookChecks.cardTitle',
            'Runtime Runbook Checks'
        );
        const recommendedFocusCheckId = String(summary.recommendedFocusCheckId || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const summaryText = translate(
            'agentWorkspace.runtimeRunbookChecks.summary',
            '{returnedChecks}/{matchedRecords} checks in {sinceMinutes} minutes; recommended focus {recommendedFocusCheckId}.',
            {
                returnedChecks: String(summary.returnedChecks == null ? 0 : summary.returnedChecks),
                matchedRecords: String(summary.matchedRecords == null ? 0 : summary.matchedRecords),
                sinceMinutes: String(summary.sinceMinutes == null ? 0 : summary.sinceMinutes),
                recommendedFocusCheckId: recommendedFocusCheckId,
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.runtimeRunbookChecks.metricsHeading',
            'Key Metrics'
        );
        const firstCheckId = String(summary.firstCheckId || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const firstCheckStatus = String(summary.firstCheckStatus || '').trim() || 'unknown';
        const firstCheckTrendStatus = String(summary.firstCheckTrendStatus || '').trim() || 'insufficient_data';
        const firstCheckAnnIndexSyncStatus = String(summary.firstCheckAnnIndexSyncStatus || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const firstCheckAnnIndexSyncCounts = String(summary.firstCheckAnnIndexSyncCounts || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const annCircuitState = String(summary.annCircuitState || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const annCircuitBudgetStatus = String(summary.annCircuitBudgetStatus || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const annTraceabilityCoverage = String(summary.annTraceabilityCoverage || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const annPrefilterSelectionMode = String(summary.annPrefilterSelectionMode || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const annPrefilterBudgetStatus = String(summary.annPrefilterBudgetStatus || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const annCircuitThresholdsMissing = (
            Number(summary.annCircuitWarnBudgetShortCircuitCountLt || 0) <= 0
            && Number(summary.annCircuitWarnBudgetShortCircuitRatioPctLt || 0) <= 0
            && Number(summary.annCircuitFailBudgetShortCircuitCountLt || 0) <= 0
            && Number(summary.annCircuitFailBudgetShortCircuitRatioPctLt || 0) <= 0
        );
        const annCircuitThresholdsSummary = annCircuitThresholdsMissing
            ? translate('agentWorkspace.runtimeRunbookChecks.none', 'none')
            : [
                `warn count<${String(summary.annCircuitWarnBudgetShortCircuitCountLt == null ? 0 : summary.annCircuitWarnBudgetShortCircuitCountLt)}`,
                `ratio<${String(summary.annCircuitWarnBudgetShortCircuitRatioPctLt == null ? 0 : summary.annCircuitWarnBudgetShortCircuitRatioPctLt)}%`,
                `failStreak<${String(summary.annCircuitWarnBudgetConsecutiveFailuresLt == null ? 0 : summary.annCircuitWarnBudgetConsecutiveFailuresLt)}`,
                `halfOpen>=${String(summary.annCircuitWarnBudgetHalfOpenSuccessRatePctGte == null ? 0 : summary.annCircuitWarnBudgetHalfOpenSuccessRatePctGte)}%`,
            ].join(' ');
        const annCircuitFailThresholdsSummary = annCircuitThresholdsMissing
            ? ''
            : [
                `fail count<${String(summary.annCircuitFailBudgetShortCircuitCountLt == null ? 0 : summary.annCircuitFailBudgetShortCircuitCountLt)}`,
                `ratio<${String(summary.annCircuitFailBudgetShortCircuitRatioPctLt == null ? 0 : summary.annCircuitFailBudgetShortCircuitRatioPctLt)}%`,
                `failStreak<${String(summary.annCircuitFailBudgetConsecutiveFailuresLt == null ? 0 : summary.annCircuitFailBudgetConsecutiveFailuresLt)}`,
                `halfOpen>=${String(summary.annCircuitFailBudgetHalfOpenSuccessRatePctGte == null ? 0 : summary.annCircuitFailBudgetHalfOpenSuccessRatePctGte)}%`,
            ].join(' ');
        const annTraceabilitySignalsSummary = `requests ${String(summary.annTraceabilityRequestCount == null ? 0 : summary.annTraceabilityRequestCount)} | short circuits ${String(summary.annTraceabilityShortCircuitCount == null ? 0 : summary.annTraceabilityShortCircuitCount)} | consecutive failures ${String(summary.annTraceabilityConsecutiveFailures == null ? 0 : summary.annTraceabilityConsecutiveFailures)}`;
        const annCircuitBudgetFlagsSummary = (
            Number(summary.annCircuitWarnBudgetShortCircuitCountLt || 0) <= 0
            && Number(summary.annCircuitFailBudgetShortCircuitCountLt || 0) <= 0
            && !summary.annCircuitWarnBudgetExceeded
            && !summary.annCircuitFailBudgetExceeded
        )
            ? translate('agentWorkspace.runtimeRunbookChecks.none', 'none')
            : `warn ${summary.annCircuitWarnBudgetExceeded ? 'exceeded' : 'clear'} | fail ${summary.annCircuitFailBudgetExceeded ? 'exceeded' : 'clear'}`;
        const annPrefilterThresholdsSummary = Number(summary.annPrefilterMinRequestSampleGte || 0) <= 0
            && Number(summary.annPrefilterWarnCandidateRatioPctLt || 0) <= 0
            && Number(summary.annPrefilterFailCandidateRatioPctLt || 0) <= 0
            ? translate('agentWorkspace.runtimeRunbookChecks.none', 'none')
            : `sample>=${String(summary.annPrefilterMinRequestSampleGte == null ? 0 : summary.annPrefilterMinRequestSampleGte)} | warn ratio<${String(summary.annPrefilterWarnCandidateRatioPctLt == null ? 0 : summary.annPrefilterWarnCandidateRatioPctLt)}% | fail ratio<${String(summary.annPrefilterFailCandidateRatioPctLt == null ? 0 : summary.annPrefilterFailCandidateRatioPctLt)}%`;
        const annPrefilterCalibrationMissing = (
            Number(summary.annPrefilterMinRequestSampleGte || 0) <= 0
            && !summary.annPrefilterSelectionMode
            && !summary.annPrefilterBudgetStatus
        );
        const annPrefilterCalibrationSummary = annPrefilterCalibrationMissing
            ? translate('agentWorkspace.runtimeRunbookChecks.none', 'none')
            : `sample ${summary.annPrefilterSampleReady ? 'ready' : 'pending'} | selection ${summary.annPrefilterSelectionActive ? 'active' : 'inactive'} | connector ${summary.annPrefilterStableConnector ? 'stable' : 'unstable'} | ratio ${summary.annPrefilterCanEvaluateCandidateRatio ? 'evaluable' : 'blocked'} | warn ${summary.annPrefilterWarnBudgetExceeded ? 'exceeded' : 'clear'} | fail ${summary.annPrefilterFailBudgetExceeded ? 'exceeded' : 'clear'}`;
        const annCalibrationSummary = !summary.annCalibrationStatus
            ? translate('agentWorkspace.runtimeRunbookChecks.none', 'none')
            : (
                summary.annCalibrationStatus === 'pass'
                && String(summary.annCalibrationMode || '').trim() !== 'ann_prefilter'
            )
                ? `${String(summary.annCalibrationStatus || 'unknown')} (mode ${String(summary.annCalibrationMode || '').trim() || translate('agentWorkspace.runtimeRunbookChecks.none', 'none')}, out_of_scope)`
                : (
                    summary.annCalibrationStatus === 'pass'
                    && !summary.annCalibrationExternalConnector
                )
                    ? `${String(summary.annCalibrationStatus || 'unknown')} (local_adapter_path)`
                    : `${String(summary.annCalibrationStatus || 'unknown')} (sync ${summary.annCalibrationSyncReady ? 'ready' : 'pending'} | sample ${summary.annCalibrationSampleReady ? 'ready' : 'pending'} | selection ${summary.annCalibrationSelectionActive ? 'active' : 'inactive'} | connector ${summary.annCalibrationStableConnector ? 'stable' : 'unstable'} | ratio ${summary.annCalibrationCanEvaluateCandidateRatio ? 'evaluable' : 'blocked'} | traceability ${summary.annCalibrationTraceabilityReady ? 'ready' : 'pending'} | circuit ${String(summary.annCalibrationCircuitBudgetStatus || 'unknown') || 'unknown'} | prefilter ${String(summary.annCalibrationPrefilterBudgetStatus || 'unknown') || 'unknown'})`;
        const latestRemediationAt = String(summary.remediationLatestRecordedAt || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const topAction = String(summary.recommendedFocusTopAction || '').trim()
            || translate('agentWorkspace.runtimeRunbookChecks.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.trendCountsLabel', 'Trend counts (regressing/improving/stable/insufficient)'),
                value: `${String(summary.regressingChecks == null ? 0 : summary.regressingChecks)}/${String(summary.improvingChecks == null ? 0 : summary.improvingChecks)}/${String(summary.stableChecks == null ? 0 : summary.stableChecks)}/${String(summary.insufficientDataChecks == null ? 0 : summary.insufficientDataChecks)}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.recommendedFocusLabel', 'Recommended focus reason'),
                value: String(summary.recommendedFocusReason || '').trim() || translate('agentWorkspace.runtimeRunbookChecks.none', 'none'),
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.recommendedEscalationLabel', 'Recommended escalation'),
                value: String(summary.recommendedFocusEscalation || '').trim() || translate('agentWorkspace.runtimeRunbookChecks.none', 'none'),
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.actionQueueLabel', 'Action queue (total/p0/p1/p2)'),
                value: `${String(summary.actionQueueTotal == null ? 0 : summary.actionQueueTotal)}/${String(summary.actionQueueP0 == null ? 0 : summary.actionQueueP0)}/${String(summary.actionQueueP1 == null ? 0 : summary.actionQueueP1)}/${String(summary.actionQueueP2 == null ? 0 : summary.actionQueueP2)}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.remediationRiskRatioLabel', 'Remediation risk ratio'),
                value: `${String(summary.remediationRiskRatioPct == null ? 0 : summary.remediationRiskRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.firstCheckLabel', 'First check snapshot'),
                value: `${firstCheckId} (${firstCheckStatus}/${firstCheckTrendStatus})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.topActionLabel', 'Top focus action'),
                value: topAction,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.firstCheckAnnIndexSyncLabel', 'First check ANN sync'),
                value: `${firstCheckAnnIndexSyncStatus} (${firstCheckAnnIndexSyncCounts})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annCircuitLabel', 'ANN circuit snapshot'),
                value: `${annCircuitState} (${String(summary.annCircuitShortCircuitRatioPct == null ? 0 : summary.annCircuitShortCircuitRatioPct)}%, ${annCircuitBudgetStatus})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annCircuitThresholdsLabel', 'ANN circuit threshold snapshot'),
                value: annCircuitThresholdsMissing
                    ? annCircuitThresholdsSummary
                    : `${annCircuitThresholdsSummary} | ${annCircuitFailThresholdsSummary}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annCircuitBudgetFlagsLabel', 'ANN circuit budget flag snapshot'),
                value: annCircuitBudgetFlagsSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annTraceabilityLabel', 'ANN traceability snapshot'),
                value: `${annTraceabilityCoverage} (${String(summary.annTraceabilityMissingFieldCount == null ? 0 : summary.annTraceabilityMissingFieldCount)} missing)`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annTraceabilitySignalsLabel', 'ANN traceability signal snapshot'),
                value: annTraceabilitySignalsSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annPrefilterLabel', 'ANN prefilter snapshot'),
                value: `${annPrefilterSelectionMode} (${String(summary.annPrefilterCandidateRatioPct == null ? 0 : summary.annPrefilterCandidateRatioPct)}%, ${annPrefilterBudgetStatus})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annPrefilterThresholdsLabel', 'ANN prefilter threshold snapshot'),
                value: annPrefilterThresholdsSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annPrefilterCalibrationLabel', 'ANN prefilter calibration snapshot'),
                value: annPrefilterCalibrationSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.annCalibrationReadinessLabel', 'ANN calibration readiness snapshot'),
                value: annCalibrationSummary,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookChecks.latestRemediationLabel', 'Latest remediation record'),
                value: latestRemediationAt,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderRuntimeCapabilityRunbookActionQueueCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.runtimeRunbookActionQueue.cardTitle',
            'Runtime Action Queue'
        );
        const summaryText = translate(
            'agentWorkspace.runtimeRunbookActionQueue.summary',
            '{returnedQueueItems}/{filteredQueueItems} queue items (limit {queueLimit}); p0={queueP0}.',
            {
                returnedQueueItems: String(summary.returnedQueueItems == null ? 0 : summary.returnedQueueItems),
                filteredQueueItems: String(summary.filteredQueueItems == null ? 0 : summary.filteredQueueItems),
                queueLimit: String(summary.queueLimit == null ? 0 : summary.queueLimit),
                queueP0: String(summary.queueP0 == null ? 0 : summary.queueP0),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.runtimeRunbookActionQueue.metricsHeading',
            'Key Metrics'
        );
        const firstCheckId = String(summary.firstCheckId || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const firstActionId = String(summary.firstActionId || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const firstPriority = String(summary.firstPriority || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const firstCategory = String(summary.firstCategory || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const firstInstruction = String(summary.firstInstruction || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const firstEndpointHint = String(summary.firstEndpointHint || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const firstAutomationHint = String(summary.firstAutomationHint || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const recommendedFocusCheckId = String(summary.recommendedFocusCheckId || '').trim()
            || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.priorityCountsLabel', 'Priority counts (p0/p1/p2)'),
                value: `${String(summary.queueP0 == null ? 0 : summary.queueP0)}/${String(summary.queueP1 == null ? 0 : summary.queueP1)}/${String(summary.queueP2 == null ? 0 : summary.queueP2)}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.filtersLabel', 'Filters (priority/category/remediation)'),
                value: `${String(summary.priorityFilter || 'all')}/${String(summary.categoryFilter || 'all')}/${String(summary.remediationStatusFilter || 'all')}/${String(summary.remediationTrendFilter || 'all')}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.remediationRiskLabel', 'Remediation risk queue'),
                value: `${String(summary.remediationRiskQueueItems == null ? 0 : summary.remediationRiskQueueItems)} (regressing ${String(summary.remediationRegressingQueueItems == null ? 0 : summary.remediationRegressingQueueItems)}, avg ${String(summary.remediationAverageRiskRatioPct == null ? 0 : summary.remediationAverageRiskRatioPct)}%)`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.recommendedFocusLabel', 'Recommended focus'),
                value: `${recommendedFocusCheckId} (${String(summary.recommendedFocusEscalation || '') || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none')})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.firstQueueItemLabel', 'First queue item'),
                value: `${firstCheckId} / ${firstActionId} (${firstPriority}, ${firstCategory})`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.firstRemediationLabel', 'First item remediation'),
                value: `${String(summary.firstRemediationStatus || '').trim() || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none')} / ${String(summary.firstRemediationTrend || '').trim() || translate('agentWorkspace.runtimeRunbookActionQueue.none', 'none')}`,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.firstInstructionLabel', 'First instruction'),
                value: firstInstruction,
            },
            {
                title: translate('agentWorkspace.runtimeRunbookActionQueue.firstEndpointLabel', 'First item endpoint/automation'),
                value: `${firstEndpointHint} (${firstAutomationHint})`,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderTutorAdapterTelemetryCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.tutorAdapterTelemetry.cardTitle',
            'Tutor Adapter Telemetry'
        );
        const summaryText = translate(
            'agentWorkspace.tutorAdapterTelemetry.summary',
            '{activeAdapters}/{totalAdapters} adapters active, {totalRequests} requests.',
            {
                activeAdapters: String(summary.activeAdapters == null ? 0 : summary.activeAdapters),
                totalAdapters: String(summary.totalAdapters == null ? 0 : summary.totalAdapters),
                totalRequests: String(summary.totalRequests == null ? 0 : summary.totalRequests),
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.tutorAdapterTelemetry.metricsHeading',
            'Key Metrics'
        );
        const firstAdapterId = String(summary.firstAdapterId || '').trim()
            || translate('agentWorkspace.tutorAdapterTelemetry.none', 'none');
        const firstAdapterLastError = String(summary.firstAdapterLastError || '').trim()
            || translate('agentWorkspace.tutorAdapterTelemetry.none', 'none');
        const lastRoutingStrategy = String(summary.lastRoutingStrategy || '').trim()
            || translate('agentWorkspace.tutorAdapterTelemetry.none', 'none');
        const preferredMode = String(summary.lastRoutingDynamicPreferredMode || '').trim()
            || translate('agentWorkspace.tutorAdapterTelemetry.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.acceptedFailedLabel', 'Accepted/failed responses'),
                value: `${String(summary.acceptedResponses == null ? 0 : summary.acceptedResponses)}/${String(summary.failedResponses == null ? 0 : summary.failedResponses)}`,
            },
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.fallbackRatioLabel', 'Provider fallback ratio'),
                value: `${String(summary.providerFallbackRatioPct == null ? 0 : summary.providerFallbackRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.averageAttemptsLabel', 'Average provider attempts'),
                value: String(summary.averageProviderAttemptCount == null ? 0 : summary.averageProviderAttemptCount),
            },
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.averageConfidenceLabel', 'Average confidence'),
                value: `${String(summary.averageConfidencePct == null ? 0 : summary.averageConfidencePct)}%`,
            },
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.routingLabel', 'Routing strategy / preferred mode'),
                value: `${lastRoutingStrategy} / ${preferredMode}`,
            },
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.firstAdapterLabel', 'Top adapter'),
                value: `${firstAdapterId} (${String(summary.firstAdapterMode || 'unknown')}, req=${String(summary.firstAdapterTotalRequests == null ? 0 : summary.firstAdapterTotalRequests)})`,
            },
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.firstAdapterFallbackLabel', 'Top adapter fallback ratio'),
                value: `${String(summary.firstAdapterFallbackRatioPct == null ? 0 : summary.firstAdapterFallbackRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.tutorAdapterTelemetry.firstAdapterLastErrorLabel', 'Top adapter last error'),
                value: firstAdapterLastError,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function renderTutorTraceDiagnosticsCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = translate(
            'agentWorkspace.tutorTraceDiagnostics.cardTitle',
            'Tutor Trace Diagnostics'
        );
        const source = String(summary.source || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const actionKind = String(summary.actionKind || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const summaryText = translate(
            'agentWorkspace.tutorTraceDiagnostics.summary',
            '{returnedTraces}/{matchedTraces} traces (source {source}, action {actionKind}).',
            {
                returnedTraces: String(summary.returnedTraces == null ? 0 : summary.returnedTraces),
                matchedTraces: String(summary.matchedTraces == null ? 0 : summary.matchedTraces),
                source,
                actionKind,
            }
        );
        const metricsHeading = translate(
            'agentWorkspace.tutorTraceDiagnostics.metricsHeading',
            'Key Metrics'
        );
        const topProviderName = String(summary.topProviderName || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const topProviderLastSeenAt = String(summary.topProviderLastSeenAt || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const firstRecordActionKind = String(summary.firstRecordActionKind || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const firstRecordVerificationStatus = String(summary.firstRecordVerificationStatus || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const firstRecordProviderName = String(summary.firstRecordProviderName || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const latestCreatedAt = String(summary.latestCreatedAt || '').trim()
            || translate('agentWorkspace.tutorTraceDiagnostics.none', 'none');
        const metrics = [
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.sourceCountsLabel', 'Source counts (llm/rule)'),
                value: `${String(summary.llmAdapterTraces == null ? 0 : summary.llmAdapterTraces)}/${String(summary.ruleEngineTraces == null ? 0 : summary.ruleEngineTraces)}`,
            },
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.verificationLabel', 'Verification (verified/pending)'),
                value: `${String(summary.verifiedTraces == null ? 0 : summary.verifiedTraces)}/${String(summary.pendingVerificationTraces == null ? 0 : summary.pendingVerificationTraces)}`,
            },
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.fallbackRatioLabel', 'Fallback ratio'),
                value: `${String(summary.fallbackRatioPct == null ? 0 : summary.fallbackRatioPct)}%`,
            },
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.averageAttemptsLabel', 'Average provider attempts'),
                value: String(summary.averageProviderAttemptCount == null ? 0 : summary.averageProviderAttemptCount),
            },
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.topProviderLabel', 'Top provider'),
                value: `${topProviderName} (${String(summary.topProviderTraces == null ? 0 : summary.topProviderTraces)} traces, fallback ${String(summary.topProviderFallbackTraces == null ? 0 : summary.topProviderFallbackTraces)}, failed ${String(summary.topProviderFailedTraces == null ? 0 : summary.topProviderFailedTraces)})`,
            },
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.topProviderConfidenceLabel', 'Top provider average confidence'),
                value: `${String(summary.topProviderAverageConfidencePct == null ? 0 : summary.topProviderAverageConfidencePct)}%`,
            },
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.firstRecordLabel', 'First trace snapshot'),
                value: `${firstRecordActionKind} / ${firstRecordVerificationStatus} / ${firstRecordProviderName}`,
            },
            {
                title: translate('agentWorkspace.tutorTraceDiagnostics.timestampsLabel', 'Latest trace / top provider seen'),
                value: `${latestCreatedAt} / ${topProviderLastSeenAt}`,
            },
        ];
        const metricsHtml = metrics.map((metric) => `
            <li class="agent-chat-card-list-item">
                <div class="agent-chat-card-list-title">${escapeHtml(metric.title)}</div>
                <div class="agent-chat-card-list-meta">${escapeHtml(metric.value)}</div>
            </li>
        `).join('');
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
            </div>
        `;
    }

    function resolveTutorActionTitle(actionKind) {
        const normalizedActionKind = String(actionKind || '').trim().toLowerCase();
        if (normalizedActionKind === 'generate_quiz') {
            return translate('agentWorkspace.tutorAction.quizTitle', 'Quiz Prompt');
        }
        if (normalizedActionKind === 'recap') {
            return translate('agentWorkspace.tutorAction.recapTitle', 'Recap');
        }
        if (normalizedActionKind === 'follow_up') {
            return translate('agentWorkspace.tutorAction.followUpTitle', 'Follow Up');
        }
        if (normalizedActionKind === 'analyze_answer') {
            return translate('agentWorkspace.tutorAction.analysisTitle', 'Answer Analysis');
        }
        if (normalizedActionKind === 'generate_transfer') {
            return translate('agentWorkspace.tutorAction.transferTitle', 'Transfer Challenge');
        }
        if (normalizedActionKind === 'generate_counterexample') {
            return translate('agentWorkspace.tutorAction.counterexampleTitle', 'Counterexample');
        }
        return translate('agentWorkspace.tutorAction.cardTitle', 'Tutor Action');
    }

    function renderTutorActionCard(node, payload) {
        const summary = payload && typeof payload === 'object' ? payload : {};
        const title = resolveTutorActionTitle(summary.actionKind);
        const message = String(summary.message || '').trim();
        const evidenceHeading = translate(
            'agentWorkspace.tutorAction.evidenceHeading',
            'Evidence'
        );
        const emptyEvidence = translate(
            'agentWorkspace.tutorAction.emptyEvidence',
            'No evidence spans returned.'
        );
        const evidenceSnippets = Array.isArray(summary.evidenceSnippets)
            ? summary.evidenceSnippets
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : [];
        const evidenceHtml = evidenceSnippets.length > 0
            ? evidenceSnippets.map((snippet, index) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`Evidence ${index + 1}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(snippet)}</div>
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(emptyEvidence)}</li>`;
        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(message || translate('agentWorkspace.messages.noResponse', 'No response.'))}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(evidenceHeading)}</div>
                <ul class="agent-chat-card-list">${evidenceHtml}</ul>
            </div>
        `;
    }

    function resolveCapabilities(item) {
        return Array.isArray(item && item.capabilities) ? item.capabilities : [];
    }

    const state = {
        initialized: false,
        promotionPane: null,
        graphFocusRenderToken: 0,
        graphFocusReaderRenderToken: 0,
        learningPathReaderRenderToken: 0,
        graphFocusDiagnostics: null,
        hostedFocusHistory: [],
        godotFuturePath: {
            request: null,
            lastDispatch: null,
            runtimeDiagnostics: null,
            expandedNodeIds: [],
            collapsedNodeIds: [],
            forcedExpansionNodeIds: [],
            completedNodeIds: [],
            stickyClaimEnabled: true,
            pathModeStateSignature: '',
            syncedFromPathMode: false,
            userMutatedExpansion: false,
            selectedNodeId: '',
            lastSignal: null,
            collapseAllRequested: false,
            projection: null,
        },
        panes: {
            'graph-focus': {
                open: false,
                fullscreen: false,
                payload: null,
            },
            'evidence': {
                open: false,
                fullscreen: false,
                payload: null,
            },
            'learning-path': {
                open: false,
                fullscreen: false,
                payload: null,
            },
        },
        knowledgePoints: {
            items: [],
            handlers: null,
            expandedByKey: {},
            previewRenderToken: 0,
            resultSetKey: '',
            activeHelpDismiss: null,
            helpIdCounter: 0,
        },
    };

    function buildKnowledgePointPreviewKey(item, index) {
        const sourcePath = resolveKnowledgePointSourcePath(item);
        if (sourcePath) {
            return `source:${sourcePath.toLowerCase()}`;
        }
        const atomId = String(item && item.atomId || item && item.documentId || '').trim();
        return `atom:${atomId || index}`;
    }

    function isKnowledgePointPreviewExpanded(item, index) {
        const previewKey = buildKnowledgePointPreviewKey(item, index);
        return state.knowledgePoints.expandedByKey[previewKey] === true;
    }

    function setKnowledgePointPreviewExpanded(item, index, expanded) {
        const previewKey = buildKnowledgePointPreviewKey(item, index);
        if (expanded) {
            state.knowledgePoints.expandedByKey[previewKey] = true;
            return;
        }
        delete state.knowledgePoints.expandedByKey[previewKey];
    }

    function buildKnowledgePointResultSetKey(items, handlers) {
        const explicitKey = String(handlers && handlers.resultSetKey || '').trim();
        if (explicitKey) {
            return explicitKey;
        }
        if (!Array.isArray(items) || items.length <= 0) {
            return '';
        }
        return items
            .slice(0, 8)
            .map((item, index) => {
                const previewKey = buildKnowledgePointPreviewKey(item, index);
                const title = String(item && item.title || '').trim();
                const matchCount = Number.isFinite(Number(item && item.matchCount)) ? Number(item.matchCount) : 0;
                return `${previewKey}|${title}|${matchCount}`;
            })
            .join('||');
    }

    function resolveKnowledgePointAutoExpandedKeys(items) {
        const firstPreviewableIndex = Array.isArray(items)
            ? items.findIndex((item) => Boolean(resolveKnowledgePointSourcePath(item)))
            : -1;
        if (firstPreviewableIndex < 0) {
            return {};
        }
        const firstItem = items[firstPreviewableIndex];
        return {
            [buildKnowledgePointPreviewKey(firstItem, firstPreviewableIndex)]: true,
        };
    }

    function shouldAutoExpandKnowledgePreview(handlers) {
        return Boolean(handlers && handlers.autoExpandFirstPreview === true);
    }

    function buildKnowledgePointPreviewLoadingHtml(sourcePath) {
        return `
            <div class="agent-knowledge-preview-loading">
                ${escapeHtml(translate('agentWorkspace.knowledge.previewLoading', 'Loading source preview...'))}
                ${sourcePath ? `<div class="agent-knowledge-preview-path">${escapeHtml(sourcePath)}</div>` : ''}
            </div>
        `;
    }

    function buildKnowledgePointPreviewFallbackHtml(item) {
        const sourcePath = resolveKnowledgePointSourcePath(item);
        const summary = String(item && (item.summary || item.evidenceSnippet) || '').trim();
        return `
            <div class="agent-knowledge-preview-fallback">
                <div class="agent-knowledge-preview-fallback-text">${escapeHtml(summary || translate('agentWorkspace.knowledge.previewUnavailable', 'Source preview unavailable.'))}</div>
                ${sourcePath ? `<div class="agent-knowledge-preview-path">${escapeHtml(sourcePath)}</div>` : ''}
            </div>
        `;
    }

    async function renderKnowledgePointPreview(previewBody, item) {
        const sourcePath = resolveKnowledgePointSourcePath(item);
        const matchedSpans = normalizeMatchedSpans(item && item.matchedSpans);
        if (!previewBody || !sourcePath) {
            previewBody.innerHTML = buildKnowledgePointPreviewFallbackHtml(item);
            return false;
        }
        state.knowledgePoints.previewRenderToken += 1;
        const renderToken = state.knowledgePoints.previewRenderToken;
        previewBody.innerHTML = `
            <div class="agent-knowledge-rendered-markdown" data-agent-knowledge-rendered-markdown="true" data-agent-preview-render-token="${String(renderToken)}">
                ${buildKnowledgePointPreviewLoadingHtml(sourcePath)}
            </div>
        `;
        const renderedHost = previewBody.querySelector('[data-agent-knowledge-rendered-markdown="true"]');
        const rendered = await renderMarkdownPreviewIntoHost(renderedHost, sourcePath, matchedSpans, renderToken);
        if (!rendered && renderedHost && renderedHost.isConnected) {
            previewBody.innerHTML = buildKnowledgePointPreviewFallbackHtml(item);
        }
        return rendered;
    }

    function syncPaneState(paneKey) {
        const paneState = state.panes[paneKey];
        setPaneAttribute(paneKey, 'data-open', paneState.open);
        setPaneAttribute(paneKey, 'data-fullscreen', paneState.fullscreen);
    }

    function refreshRenderedState() {
        updatePaneControlLabels();
        if (state.panes['graph-focus'].open) {
            renderGraphFocusBody(state.panes['graph-focus'].payload || {});
        }
        if (state.panes['evidence'].open) {
            renderEvidenceBody(state.panes['evidence'].payload || {});
        } else {
            const body = getPaneBodyElement('evidence');
            if (body) {
                body.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.evidence.emptyIdle', 'Evidence pane is idle.'))}</div>`;
            }
        }
        if (state.panes['learning-path'].open) {
            renderLearningPathBody(state.panes['learning-path'].payload || {});
        } else {
            const body = getPaneBodyElement('learning-path');
            if (body) {
                body.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.learningPath.emptyIdle', 'Learning path pane is idle.'))}</div>`;
            }
        }
        if (Array.isArray(state.knowledgePoints.items)) {
            api.renderKnowledgePoints(state.knowledgePoints.items, state.knowledgePoints.handlers);
        }
        updateConversationMessageTranslations();
    }

    function resolveMarkdownRuntime() {
        const runtime = window.NoteConnectionMarkdownRuntime;
        if (!runtime || typeof runtime !== 'object') {
            return null;
        }
        return runtime;
    }

    function revealLatestConversationMessage(container, node) {
        if (!container || !node) {
            return;
        }
        const reveal = function () {
            if (typeof container.scrollHeight === 'number') {
                container.scrollTop = container.scrollHeight;
            }
            if (typeof node.scrollIntoView === 'function') {
                try {
                    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                } catch (_error) {
                    node.scrollIntoView();
                }
            }
        };
        if (window && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(reveal);
            return;
        }
        window.setTimeout(reveal, 0);
    }

    function createHtmlArtifactPreview(block) {
        const wrapper = document.createElement('div');
        wrapper.className = 'agent-chat-inline-artifact';

        const title = document.createElement('div');
        title.className = 'agent-chat-inline-artifact-title';
        title.textContent = String(
            block && block.title
            || translate('agentWorkspace.reply.htmlArtifact', 'HTML Artifact')
        ).trim();
        wrapper.appendChild(title);

        const summaryText = String(block && block.summary || '').trim();
        if (summaryText) {
            const summary = document.createElement('div');
            summary.className = 'agent-chat-inline-artifact-summary';
            summary.textContent = summaryText;
            wrapper.appendChild(summary);
        }

        const htmlSource = String(block && block.html || '').trim();
        if (!htmlSource) {
            const empty = document.createElement('div');
            empty.className = 'agent-chat-inline-artifact-summary';
            empty.textContent = translate('agentWorkspace.reply.htmlArtifactEmpty', 'No HTML content was returned.');
            wrapper.appendChild(empty);
            return wrapper;
        }

        const details = document.createElement('details');
        details.className = 'agent-chat-inline-artifact-details';
        const summary = document.createElement('summary');
        summary.textContent = translate('agentWorkspace.reply.preview', 'Preview');
        details.appendChild(summary);

        const frame = document.createElement('iframe');
        frame.className = 'agent-chat-inline-artifact-frame';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        frame.setAttribute('loading', 'lazy');
        frame.srcdoc = htmlSource;
        details.appendChild(frame);

        wrapper.appendChild(details);
        return wrapper;
    }

    async function createStructuredAnswerBlockNode(block, markdownRuntime) {
        const wrapper = document.createElement('div');
        wrapper.className = 'agent-chat-inline-card agent-chat-structured-answer-card';

        const title = document.createElement('div');
        title.className = 'agent-chat-inline-card-title';
        title.textContent = String(
            block && block.title
            || translate('agentWorkspace.reply.structuredAnswer', 'Grounded Answer')
        ).trim();
        wrapper.appendChild(title);

        const directAnswer = String(block && block.directAnswer || '').trim();
        if (directAnswer) {
            const summary = document.createElement('div');
            summary.className = 'agent-chat-inline-card-summary agent-chat-structured-answer-direct';
            summary.textContent = directAnswer;
            summary.setAttribute('data-structured-answer-section', 'directAnswer');
            wrapper.appendChild(summary);
        }

        return wrapper;
    }

    function createCitationsBlockNode(block) {
        const wrapper = document.createElement('div');
        wrapper.className = 'agent-chat-inline-card';

        const title = document.createElement('div');
        title.className = 'agent-chat-inline-card-title';
        title.textContent = String(
            block && block.title
            || translate('agentWorkspace.reply.citations', 'Citations')
        ).trim();
        wrapper.appendChild(title);

        const citations = Array.isArray(block && block.citations) ? block.citations : [];
        if (citations.length <= 0) {
            const empty = document.createElement('div');
            empty.className = 'agent-chat-inline-card-summary';
            empty.textContent = translate('agentWorkspace.reply.citationsEmpty', 'No citations were returned.');
            wrapper.appendChild(empty);
            return wrapper;
        }

        const list = document.createElement('ul');
        list.className = 'agent-chat-inline-card-list';
        citations.forEach((citation, index) => {
            const item = document.createElement('li');
            item.className = 'agent-chat-inline-card-item';

            const label = document.createElement('div');
            label.className = 'agent-chat-inline-card-item-title';
            label.textContent = `${index + 1}. ${String(citation && citation.title || '').trim() || translate('agentWorkspace.reply.citationUntitled', 'Untitled citation')}`;
            item.appendChild(label);

            const meta = document.createElement('div');
            meta.className = 'agent-chat-inline-card-summary';
            const sourcePath = String(citation && citation.sourcePath || '').trim();
            const startLine = Number(citation && citation.startLine);
            meta.textContent = sourcePath
                ? `${sourcePath}${Number.isFinite(startLine) && startLine > 0 ? `:${startLine}` : ''}`
                : translate('agentWorkspace.reply.citationSourceUnavailable', 'Source path unavailable');
            item.appendChild(meta);

            const snippet = String(citation && citation.snippet || '').trim();
            if (snippet) {
                const snippetNode = document.createElement('div');
                snippetNode.className = 'agent-chat-inline-card-summary';
                snippetNode.textContent = snippet;
                item.appendChild(snippetNode);
            }

            list.appendChild(item);
        });
        wrapper.appendChild(list);
        return wrapper;
    }

    function createKnowledgeActionsBlockNode(block) {
        const wrapper = document.createElement('div');
        wrapper.className = 'agent-chat-inline-card';

        const title = document.createElement('div');
        title.className = 'agent-chat-inline-card-title';
        title.textContent = String(
            block && block.title
            || translate('agentWorkspace.reply.knowledgeActions', 'Knowledge Actions')
        ).trim();
        wrapper.appendChild(title);

        const atomIds = Array.isArray(block && block.atomIds) ? block.atomIds.filter(Boolean) : [];
        const summary = document.createElement('div');
        summary.className = 'agent-chat-inline-card-summary';
        summary.textContent = atomIds.length > 0
            ? translate(
                'agentWorkspace.reply.knowledgeActionsSummary',
                'Open the scoped knowledge cards below to continue with focus mode or guided learning for {count} node(s).',
                { count: String(atomIds.length) }
            )
            : translate('agentWorkspace.reply.knowledgeActionsEmpty', 'No actionable knowledge nodes were returned.');
        wrapper.appendChild(summary);
        return wrapper;
    }

    function formatKnowledgeRunSourceRef(value) {
        const sourcePath = String(value && value.sourcePath || '').trim();
        if (!sourcePath) {
            return '';
        }
        const startLine = Number(value && value.startLine);
        return Number.isFinite(startLine) && startLine > 0
            ? `${sourcePath}:${startLine}`
            : sourcePath;
    }

    function createKnowledgeRunSummaryBlockNode(block) {
        const wrapper = document.createElement('div');
        wrapper.className = 'agent-chat-inline-card agent-chat-knowledge-run-card';
        const run = block && block.knowledgeRun && typeof block.knowledgeRun === 'object'
            ? block.knowledgeRun
            : {};
        const quality = run.quality && typeof run.quality === 'object' ? run.quality : {};

        const title = document.createElement('div');
        title.className = 'agent-chat-inline-card-title';
        title.textContent = String(
            block && block.title
            || translate('agentWorkspace.reply.knowledgeRun', 'Knowledge Run')
        ).trim();
        wrapper.appendChild(title);

        const status = String(run.status || quality.status || 'unknown').trim();
        const score = Number(quality.score);
        const summary = document.createElement('div');
        summary.className = 'agent-chat-inline-card-summary';
        summary.textContent = Number.isFinite(score)
            ? translate(
                'agentWorkspace.reply.knowledgeRunSummary',
                'Status: {status}. Quality score: {score}.',
                { status, score: String(score) }
            )
            : translate(
                'agentWorkspace.reply.knowledgeRunStatusOnly',
                'Status: {status}.',
                { status }
            );
        wrapper.appendChild(summary);

        const gates = Array.isArray(quality.gates) ? quality.gates : [];
        if (gates.length > 0) {
            const gateList = document.createElement('ul');
            gateList.className = 'agent-chat-inline-card-list agent-chat-knowledge-run-gates';
            gates.forEach((gate) => {
                const item = document.createElement('li');
                item.className = 'agent-chat-inline-card-item';
                const label = document.createElement('div');
                label.className = 'agent-chat-inline-card-item-title';
                label.textContent = `${gate && gate.passed ? 'PASS' : 'CHECK'} ${String(gate && gate.gateId || '').trim()}`;
                item.appendChild(label);
                const message = String(gate && gate.message || '').trim();
                if (message) {
                    const messageNode = document.createElement('div');
                    messageNode.className = 'agent-chat-inline-card-summary';
                    messageNode.textContent = message;
                    item.appendChild(messageNode);
                }
                gateList.appendChild(item);
            });
            wrapper.appendChild(gateList);
        }

        const claims = Array.isArray(run.evidenceClaims) ? run.evidenceClaims : [];
        if (claims.length > 0) {
            const claimsTitle = document.createElement('div');
            claimsTitle.className = 'agent-chat-inline-card-summary';
            claimsTitle.textContent = translate('agentWorkspace.reply.knowledgeRunClaims', 'Evidence claims');
            wrapper.appendChild(claimsTitle);

            const claimList = document.createElement('ul');
            claimList.className = 'agent-chat-inline-card-list agent-chat-knowledge-run-claims';
            claims.slice(0, 3).forEach((claim, index) => {
                const item = document.createElement('li');
                item.className = 'agent-chat-inline-card-item';
                const label = document.createElement('div');
                label.className = 'agent-chat-inline-card-item-title';
                label.textContent = `${index + 1}. ${String(claim && claim.title || '').trim() || translate('agentWorkspace.reply.knowledgeRunClaimUntitled', 'Untitled claim')} (${String(claim && claim.status || 'unknown').trim()})`;
                item.appendChild(label);
                const ref = formatKnowledgeRunSourceRef(claim);
                if (ref) {
                    const refNode = document.createElement('div');
                    refNode.className = 'agent-chat-inline-card-summary';
                    refNode.textContent = ref;
                    item.appendChild(refNode);
                }
                const snippet = String(claim && (claim.snippet || claim.statement) || '').trim();
                if (snippet) {
                    const snippetNode = document.createElement('div');
                    snippetNode.className = 'agent-chat-inline-card-summary';
                    snippetNode.textContent = snippet;
                    item.appendChild(snippetNode);
                }
                claimList.appendChild(item);
            });
            wrapper.appendChild(claimList);
        }

        const reviewCards = Array.isArray(run.reviewCards) ? run.reviewCards : [];
        if (reviewCards.length > 0) {
            const reviewTitle = document.createElement('div');
            reviewTitle.className = 'agent-chat-inline-card-summary';
            reviewTitle.textContent = translate('agentWorkspace.reply.knowledgeRunReviewCards', 'Review cards');
            wrapper.appendChild(reviewTitle);

            const reviewList = document.createElement('ul');
            reviewList.className = 'agent-chat-inline-card-list agent-chat-knowledge-run-review-cards';
            reviewCards.slice(0, 3).forEach((card, index) => {
                const item = document.createElement('li');
                item.className = 'agent-chat-inline-card-item';
                const prompt = document.createElement('div');
                prompt.className = 'agent-chat-inline-card-item-title';
                prompt.textContent = `${index + 1}. ${String(card && card.prompt || '').trim() || translate('agentWorkspace.reply.knowledgeRunReviewPrompt', 'Review the cited claim.')}`;
                item.appendChild(prompt);
                const refs = Array.isArray(card && card.evidenceRefs) ? card.evidenceRefs.filter(Boolean) : [];
                if (refs.length > 0) {
                    const refsNode = document.createElement('div');
                    refsNode.className = 'agent-chat-inline-card-summary';
                    refsNode.textContent = refs.join(', ');
                    item.appendChild(refsNode);
                }
                reviewList.appendChild(item);
            });
            wrapper.appendChild(reviewList);
        }

        const artifactId = String(block && block.artifactId || '').trim();
        const runId = String(run && run.runId || '').trim();
        const workspaceId = String(run && run.scope && run.scope.workspaceId || '').trim();
        if (artifactId || runId) {
            const actions = document.createElement('div');
            actions.className = 'agent-chat-card-actions';
            const inspectButton = document.createElement('button');
            inspectButton.type = 'button';
            inspectButton.textContent = translate('agentWorkspace.reply.knowledgeRunInspectRun', 'Inspect Run');
            inspectButton.setAttribute('data-agent-knowledge-run-inspect', 'true');
            inspectButton.addEventListener('click', function () {
                if (!window.NoteConnectionAgentWorkspace || typeof window.NoteConnectionAgentWorkspace.executeCapability !== 'function') {
                    return;
                }
                void window.NoteConnectionAgentWorkspace.executeCapability({
                    atomId: String((run.evidenceClaims && run.evidenceClaims[0] && run.evidenceClaims[0].atomId) || '').trim(),
                    title: String(block && block.title || 'Knowledge Run').trim(),
                }, {
                    capabilityId: `cap_inspect_knowledge_run_${artifactId || runId || 'unknown'}`,
                    actionId: 'inspect_knowledge_run',
                    label: 'Inspect Run',
                    request: {
                        artifactKinds: ['knowledge_run'],
                        artifactId: artifactId || undefined,
                        runId: runId || undefined,
                        workspaceId: String(run.scope && run.scope.workspaceId || '').trim() || undefined,
                        sessionId: undefined,
                        limit: 1,
                    },
                    execution: {
                        kind: 'knowledge_operation',
                        operationId: 'fetch_workflow_artifacts',
                        resultPresentation: 'knowledge_run_card',
                    },
                });
            });
            actions.appendChild(inspectButton);
            if (workspaceId) {
                const historyButton = document.createElement('button');
                historyButton.type = 'button';
                historyButton.textContent = translate('agentWorkspace.reply.knowledgeRunBrowseRuns', 'Recent Runs');
                historyButton.setAttribute('data-agent-knowledge-run-history', 'true');
                historyButton.addEventListener('click', function () {
                    if (!window.NoteConnectionAgentWorkspace || typeof window.NoteConnectionAgentWorkspace.executeCapability !== 'function') {
                        return;
                    }
                    void window.NoteConnectionAgentWorkspace.executeCapability({
                        atomId: String((run.evidenceClaims && run.evidenceClaims[0] && run.evidenceClaims[0].atomId) || '').trim(),
                        title: String(block && block.title || 'Knowledge Run').trim(),
                    }, {
                        capabilityId: `cap_browse_knowledge_runs_${workspaceId}`,
                        actionId: 'browse_knowledge_runs',
                        label: 'Recent Runs',
                        request: {
                            artifactKinds: ['knowledge_run'],
                            workspaceId,
                            limit: 6,
                        },
                        execution: {
                            kind: 'knowledge_operation',
                            operationId: 'fetch_workflow_artifacts',
                            resultPresentation: 'knowledge_run_history_card',
                        },
                    });
                });
                actions.appendChild(historyButton);
            }
            wrapper.appendChild(actions);
        }

        return wrapper;
    }

    async function renderConversationBlocksIntoNode(node, entry) {
        const blocks = Array.isArray(entry && entry.blocks) ? entry.blocks : [];
        const markdownRuntime = resolveMarkdownRuntime();
        node.textContent = '';
        if (blocks.length <= 0) {
            node.textContent = String(entry && (entry.fallbackMessage || entry.message) || '').trim();
            return;
        }

        for (const block of blocks) {
            if (!block || typeof block !== 'object') {
                continue;
            }
            const type = String(block.type || '').trim();
            const blockNode = document.createElement('div');
            blockNode.className = `agent-chat-render-block agent-chat-render-block-${type || 'unknown'}`;
            blockNode.setAttribute('data-agent-workspace-block-type', type || 'unknown');
            node.appendChild(blockNode);

            if (type === 'structured_answer') {
                blockNode.appendChild(await createStructuredAnswerBlockNode(block, markdownRuntime));
                continue;
            }
            if (type === 'main_markdown') {
                blockNode.classList.add('agent-chat-markdown');
                const markdown = String(block.markdown || '').trim();
                if (markdownRuntime && typeof markdownRuntime.renderMarkdownInto === 'function') {
                    await markdownRuntime.renderMarkdownInto(blockNode, markdown);
                } else {
                    blockNode.textContent = markdown;
                }
                continue;
            }
            if (type === 'system_notice') {
                blockNode.textContent = String(block.text || '').trim();
                continue;
            }
            if (type === 'html_artifact') {
                blockNode.appendChild(createHtmlArtifactPreview(block));
                continue;
            }
            if (type === 'citations') {
                blockNode.appendChild(createCitationsBlockNode(block));
                continue;
            }
            if (type === 'knowledge_actions') {
                blockNode.appendChild(createKnowledgeActionsBlockNode(block));
                continue;
            }
            if (type === 'knowledge_run_summary') {
                blockNode.appendChild(createKnowledgeRunSummaryBlockNode(block));
                continue;
            }
            blockNode.textContent = String(entry && entry.fallbackMessage || '').trim();
        }

        if (!node.textContent.trim() && String(entry && entry.fallbackMessage || '').trim()) {
            node.textContent = String(entry.fallbackMessage || '').trim();
        }
    }

    function clearPaneByKey(paneKey) {
        if (paneKey === 'graph-focus') {
            api.clearGraphFocusPane();
            return;
        }
        if (paneKey === 'evidence') {
            api.clearEvidencePane();
            return;
        }
        if (paneKey === 'learning-path') {
            api.clearLearningPathPane();
        }
    }

    function bindPaneCloseButton(paneKey) {
        const button = getCloseButtonElement(paneKey);
        if (!button || typeof button.addEventListener !== 'function') {
            return;
        }
        button.addEventListener('click', function () {
            clearPaneByKey(paneKey);
        });
    }

    function init() {
        if (state.initialized) {
            return api;
        }
        state.initialized = true;
        if (document.body) {
            document.body.setAttribute('data-agent-workspace-layout', 'split');
        }
        PANE_KEYS.forEach((paneKey) => {
            syncPaneState(paneKey);
        });

        const graphFullscreenButton = getElement('btn-agent-graph-focus-fullscreen');
        if (graphFullscreenButton && typeof graphFullscreenButton.addEventListener === 'function') {
            graphFullscreenButton.addEventListener('click', function () {
                api.setPaneFullscreen('graph-focus', !state.panes['graph-focus'].fullscreen);
            });
        }

        const evidenceFullscreenButton = getElement('btn-agent-evidence-fullscreen');
        if (evidenceFullscreenButton && typeof evidenceFullscreenButton.addEventListener === 'function') {
            evidenceFullscreenButton.addEventListener('click', function () {
                api.setPaneFullscreen('evidence', !state.panes.evidence.fullscreen);
            });
        }

        const learningFullscreenButton = getElement('btn-agent-learning-path-fullscreen');
        if (learningFullscreenButton && typeof learningFullscreenButton.addEventListener === 'function') {
            learningFullscreenButton.addEventListener('click', function () {
                api.setPaneFullscreen('learning-path', !state.panes['learning-path'].fullscreen);
            });
        }

        PANE_KEYS.forEach((paneKey) => {
            bindPaneCloseButton(paneKey);
        });

        const pathExitButton = getElement('btn-exit-path');
        if (pathExitButton && typeof pathExitButton.addEventListener === 'function') {
            pathExitButton.addEventListener('click', function () {
                api.clearLearningPathPane();
            });
        }

        if (typeof window.addEventListener === 'function') {
            window.addEventListener('noteconnection:learning-path-exit', function () {
                api.clearLearningPathPane();
            });
            window.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && state.promotionPane) {
                    api.setPaneFullscreen(state.promotionPane, false);
                }
            });
        }

        if (window.i18n && typeof window.i18n.onLanguageChange === 'function') {
            window.i18n.onLanguageChange(function () {
                refreshRenderedState();
            });
        }

        refreshRenderedState();

        return api;
    }

    const api = {
        init: init,
        getState: function () {
            return JSON.parse(JSON.stringify(state));
        },
        getLastGraphFocusDiagnostics: function () {
            return state.graphFocusDiagnostics ? JSON.parse(JSON.stringify(state.graphFocusDiagnostics)) : null;
        },
        getHostedFuturePathRuntimeDiagnostics: function () {
            return state.godotFuturePath.runtimeDiagnostics ? cloneJsonPayload(state.godotFuturePath.runtimeDiagnostics) : null;
        },
        resolveKnowledgePointGraphTarget: function (item, capability) {
            return resolveKnowledgePointGraphTarget(item, capability);
        },
        buildKnowledgePointFocusPayload: function (item, graphTarget) {
            return buildKnowledgePointFocusPayload(item, graphTarget);
        },
        openGraphFocusPane: function (payload) {
            ensureWorkspaceVisible();
            state.panes['graph-focus'].open = true;
            state.panes['graph-focus'].payload = payload || null;
            renderGraphFocusBody(payload || {});
            syncPaneState('graph-focus');
        },
        openEvidencePane: function (payload) {
            ensureWorkspaceVisible();
            state.panes.evidence.open = true;
            state.panes.evidence.payload = payload || null;
            renderEvidenceBody(payload || {});
            syncPaneState('evidence');
            updatePaneControlLabels();
        },
        clearGraphFocusPane: function () {
            if (state.promotionPane === 'graph-focus') {
                state.promotionPane = null;
                syncBodyPromotionState();
            }
            state.panes['graph-focus'].open = false;
            state.panes['graph-focus'].fullscreen = false;
            state.panes['graph-focus'].payload = null;
            state.graphFocusDiagnostics = null;
            window.__NC_LAST_AGENT_GRAPH_FOCUS_DIAGNOSTICS = null;
            const body = getPaneBodyElement('graph-focus');
            if (body) {
                body.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.graphFocus.emptyIdle', 'Graph focus pane is idle.'))}</div>`;
            }
            syncPaneState('graph-focus');
            updatePaneControlLabels();
        },
        clearEvidencePane: function () {
            if (state.promotionPane === 'evidence') {
                state.promotionPane = null;
                syncBodyPromotionState();
            }
            state.panes.evidence.open = false;
            state.panes.evidence.fullscreen = false;
            state.panes.evidence.payload = null;
            const body = getPaneBodyElement('evidence');
            if (body) {
                body.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.evidence.emptyIdle', 'Evidence pane is idle.'))}</div>`;
            }
            syncPaneState('evidence');
            updatePaneControlLabels();
        },
        openLearningPathPane: function (payload) {
            ensureWorkspaceVisible();
            state.panes['learning-path'].open = true;
            state.panes['learning-path'].payload = payload || null;
            if (godotFuturePathRetryTimer) {
                clearTimeout(godotFuturePathRetryTimer);
                godotFuturePathRetryTimer = null;
            }
            godotFuturePathRetryCount = 0;
            renderLearningPathBody(payload || {});
            syncPaneState('learning-path');
            updatePaneControlLabels();
        },
        clearLearningPathPane: function () {
            if (state.promotionPane === 'learning-path') {
                state.promotionPane = null;
                syncBodyPromotionState();
            }
            if (godotFuturePathRetryTimer) {
                clearTimeout(godotFuturePathRetryTimer);
                godotFuturePathRetryTimer = null;
            }
            godotFuturePathRetryCount = 0;
            state.panes['learning-path'].open = false;
            state.panes['learning-path'].fullscreen = false;
            state.panes['learning-path'].payload = null;
            const body = getPaneBodyElement('learning-path');
            if (body) {
                body.innerHTML = `<div class="agent-pane-empty">${escapeHtml(translate('agentWorkspace.learningPath.emptyIdle', 'Learning path pane is idle.'))}</div>`;
            }
            syncPaneState('learning-path');
            updatePaneControlLabels();
        },
        setPaneFullscreen: function (paneKey, fullscreen) {
            if (!Object.prototype.hasOwnProperty.call(state.panes, paneKey)) {
                return;
            }
            if (fullscreen === true) {
                PANE_KEYS.forEach((candidateKey) => {
                    state.panes[candidateKey].fullscreen = candidateKey === paneKey;
                    syncPaneState(candidateKey);
                });
                state.promotionPane = paneKey;
                syncBodyPromotionState();
                updatePaneControlLabels();
                return;
            }
            state.panes[paneKey].fullscreen = fullscreen === true;
            if (state.promotionPane === paneKey) {
                state.promotionPane = null;
                syncBodyPromotionState();
            }
            syncPaneState(paneKey);
            updatePaneControlLabels();
        },
        appendConversationMessage: function (entry) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const role = String(entry && entry.role || 'assistant').trim() || 'assistant';
            const message = String(entry && entry.message || '').trim();
            const node = document.createElement('div');
            node.className = `agent-chat-message agent-chat-message-${role}`;
            node.textContent = message;
            if (entry && typeof entry.messageKey === 'string' && entry.messageKey.trim()) {
                node.setAttribute('data-agent-workspace-message-key', entry.messageKey.trim());
                if (entry.params && typeof entry.params === 'object') {
                    node.setAttribute(
                        'data-agent-workspace-message-params',
                        JSON.stringify(entry.params)
                    );
                }
            }
            container.appendChild(node);
            revealLatestConversationMessage(container, node);
            return node;
        },
        appendConversationBlocks: async function (entry) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const role = String(entry && entry.role || 'assistant').trim() || 'assistant';
            const node = document.createElement('div');
            node.className = `agent-chat-message agent-chat-message-${role} agent-chat-message-rendered`;
            node.setAttribute(
                'data-agent-workspace-rendered-block-payload',
                JSON.stringify({
                    role,
                    blocks: Array.isArray(entry && entry.blocks) ? entry.blocks : [],
                    fallbackMessage: String(entry && entry.fallbackMessage || entry && entry.message || ''),
                })
            );
            container.appendChild(node);
            revealLatestConversationMessage(container, node);
            await renderConversationBlocksIntoNode(node, entry || {});
            revealLatestConversationMessage(container, node);
            return node;
        },
        appendStudySessionCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'study-session');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderStudySessionCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendTutorActionCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'tutor-action');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderTutorActionCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendSessionHistoryCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'session-history');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderSessionHistoryCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendConversationTurnCacheDiagnosticsCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'conversation-turn-cache-diagnostics');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderConversationTurnCacheDiagnosticsCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendConversationTurnCacheAlertTrendCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'conversation-turn-cache-alert-trend');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderConversationTurnCacheAlertTrendCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendQueryBackendComparisonCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'query-backend-comparison');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderQueryBackendComparisonCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendQueryBackendDiagnosticsCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'query-backend-diagnostics');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderQueryBackendDiagnosticsCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendQueryBackendComparisonHistoryCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'query-backend-comparison-history');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderQueryBackendComparisonHistoryCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendQueryBackendComparisonTrendCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'query-backend-comparison-trend');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderQueryBackendComparisonTrendCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendTutorAdapterTelemetryCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'tutor-adapter-telemetry');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderTutorAdapterTelemetryCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendTutorTraceDiagnosticsCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'tutor-trace-diagnostics');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderTutorTraceDiagnosticsCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendLearningQualityTrendCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'learning-quality-trend');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderLearningQualityTrendCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendSessionPlanQualityTrendCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'session-plan-quality-trend');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderSessionPlanQualityTrendCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendLearningQualityHistoryCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'learning-quality-history');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderLearningQualityHistoryCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendLearningQualityBaselineEvaluationCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'learning-quality-baseline-evaluation');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderLearningQualityBaselineEvaluationCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendFlashcardBatchCard: function (payload) {
            const panePayload = Object.assign({ kind: 'flashcard_batch' }, payload || {});
            api.openEvidencePane(panePayload);
            return getPaneBodyElement('evidence');
        },
        appendKnowledgeRunCard: function (payload) {
            const panePayload = Object.assign({ kind: 'knowledge_run' }, payload || {});
            api.openEvidencePane(panePayload);
            return getPaneBodyElement('evidence');
        },
        appendKnowledgeRunHistoryCard: function (payload) {
            const panePayload = Object.assign({ kind: 'knowledge_run_history' }, payload || {});
            api.openEvidencePane(panePayload);
            return getPaneBodyElement('evidence');
        },
        appendKnowledgeRunCompareCard: function (payload) {
            const panePayload = Object.assign({ kind: 'knowledge_run_compare' }, payload || {});
            api.openEvidencePane(panePayload);
            return getPaneBodyElement('evidence');
        },
        updateFlashcardBatchCard: function (node, payload) {
            const panePayload = Object.assign({ kind: 'flashcard_batch' }, payload || {});
            api.openEvidencePane(panePayload);
            return getPaneBodyElement('evidence');
        },
        appendSessionPlanQualityHistoryCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'session-plan-quality-history');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderSessionPlanQualityHistoryCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendRuntimeCapabilityRunbookVerifyCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'runtime-capability-runbook-verify');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderRuntimeCapabilityRunbookVerifyCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendRuntimeCapabilityRunbookHistoryCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'runtime-capability-runbook-history');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderRuntimeCapabilityRunbookHistoryCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendRuntimeCapabilityRunbookChecksCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'runtime-capability-runbook-checks');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderRuntimeCapabilityRunbookChecksCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        appendRuntimeCapabilityRunbookActionQueueCard: function (payload) {
            const container = getElement('agent-workspace-chat-messages');
            if (!container) {
                return null;
            }
            const node = document.createElement('div');
            node.className = 'agent-chat-message agent-chat-message-assistant agent-chat-message-card';
            node.setAttribute('data-agent-workspace-card-kind', 'runtime-capability-runbook-action-queue');
            node.setAttribute('data-agent-workspace-card-payload', JSON.stringify(payload || {}));
            renderRuntimeCapabilityRunbookActionQueueCard(node, payload || {});
            container.appendChild(node);
            return node;
        },
        renderKnowledgePoints: function (items, handlers) {
            const container = getElement('agent-workspace-knowledge-points');
            if (!container) {
                return;
            }
            const normalizedItems = Array.isArray(items) ? items : [];
            const resultSetKey = buildKnowledgePointResultSetKey(normalizedItems, handlers);
            if (resultSetKey !== state.knowledgePoints.resultSetKey) {
                state.knowledgePoints.resultSetKey = resultSetKey;
                state.knowledgePoints.expandedByKey = shouldAutoExpandKnowledgePreview(handlers)
                    ? resolveKnowledgePointAutoExpandedKeys(normalizedItems)
                    : {};
            }
            state.knowledgePoints.items = normalizedItems.slice();
            state.knowledgePoints.handlers = handlers || null;
            dismissActiveKnowledgeHelp();
            container.setAttribute('data-agent-knowledge-scrollable', 'true');
            if (normalizedItems.length <= 0) {
                state.knowledgePoints.resultSetKey = '';
                state.knowledgePoints.expandedByKey = {};
                container.innerHTML = `<div class="agent-knowledge-empty">${escapeHtml(translate('agentWorkspace.knowledge.empty', 'No scoped knowledge matches.'))}</div>`;
                return;
            }
            container.innerHTML = '';
            container.appendChild(createKnowledgePointListHeader());
            normalizedItems.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'agent-knowledge-card';
                const fileName = resolveKnowledgePointFileName(item);
                card.setAttribute('data-agent-knowledge-card', 'true');
                const actionAtomId = resolveKnowledgePointActionAtomId(item);
                const header = document.createElement('div');
                header.className = 'agent-knowledge-card-header';
                card.appendChild(header);

                const fileButton = document.createElement('button');
                fileButton.type = 'button';
                fileButton.className = 'agent-knowledge-file-button';
                fileButton.textContent = fileName;
                const fileButtonId = `agent-knowledge-file-${state.knowledgePoints.resultSetKey.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'hit'}-${String(container.children.length)}`;
                fileButton.id = fileButtonId;
                fileButton.setAttribute('aria-haspopup', 'menu');
                fileButton.setAttribute('aria-expanded', 'false');
                fileButton.setAttribute(
                    'aria-label',
                    translate('agentWorkspace.knowledge.openFile', 'Open matched knowledge point: {file}', {
                        file: fileName,
                    })
                );
                fileButton.title = translate('agentWorkspace.knowledge.openFile', 'Open matched knowledge point: {file}', {
                    file: fileName,
                });
                header.appendChild(fileButton);
                const menuButton = createKnowledgePointActionMenuButton(fileName);
                menuButton.id = `${fileButtonId}-actions`;
                header.appendChild(menuButton);
                const actionSpecs = buildKnowledgePointGraphActionSpecs(item, handlers, fileName, actionAtomId);
                const actionStrip = createKnowledgePointActionStrip(actionSpecs);
                card.appendChild(actionStrip);
                const actionMenu = createKnowledgePointActionMenu(actionSpecs);
                const actionMenuId = `${fileButtonId}-menu`;
                actionMenu.id = actionMenuId;
                actionMenu.setAttribute('aria-labelledby', fileButtonId);
                actionMenu.setAttribute('data-agent-knowledge-menu-button-id', menuButton.id);
                fileButton.setAttribute('aria-controls', actionMenuId);
                menuButton.setAttribute('aria-controls', actionMenuId);
                card.appendChild(actionMenu);
                bindKnowledgePointActionMenu(card, fileButton, actionMenu, menuButton);
                fileButton.addEventListener('click', function () {
                    markKnowledgePointCardSelected(card);
                    ensureWorkspaceVisible();
                    closeKnowledgePointActionMenu(fileButton, actionMenu, menuButton);
                    api.openGraphFocusPane(buildKnowledgePointFocusPayload(item));
                });
                fileButton.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileButton.click();
                    }
                });

                container.appendChild(card);
            });
        },
    };

    window.NoteConnectionWorkspacePanes = api;
}());
