(function () {
    const PANE_KEYS = ['graph-focus', 'evidence', 'learning-path'];
    const PROMOTION_ATTRIBUTE = 'data-agent-workspace-promotion';
    const LEARNING_PATH_WORKSPACE_ELEMENT_IDS = [
        'path-container',
        'learning-history-sidebar',
        'learning-workbench-sidebar',
    ];

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

    function getLearningPathWorkspaceHost() {
        return getElement('agent-learning-path-workspace-host');
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

    function updatePaneControlLabels() {
        PANE_KEYS.forEach((paneKey) => {
            const button = getFullscreenButtonElement(paneKey);
            if (!button) {
                return;
            }
            const isFullscreen = state.panes[paneKey].fullscreen === true;
            button.textContent = isFullscreen
                ? translate('agentWorkspace.actions.restore', 'Restore')
                : translate('agentWorkspace.actions.fullscreen', 'Fullscreen');
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
        return Array.isArray(spans)
            ? spans
                .map((span) => span && typeof span === 'object' ? span : null)
                .filter(Boolean)
            : [];
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

    function buildGraphFocusTitle(payload) {
        return String(
            payload.title
            || payload.atomId
            || payload.nodeId
            || translate('agentWorkspace.graphFocus.title', 'Graph Focus')
        ).trim();
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

    function buildGraphFocusFallbackHtml(payload, matchedSpans) {
        const summary = String(payload.summary || '').trim();
        return `
            <div class="agent-pane-block">
                <div class="agent-pane-title">${escapeHtml(buildGraphFocusTitle(payload))}</div>
                <div class="agent-pane-meta">${escapeHtml(String(payload.atomId || payload.nodeId || ''))}</div>
                <p class="agent-pane-summary">${escapeHtml(summary || translate('agentWorkspace.graphFocus.noSummary', 'No summary available.'))}</p>
                ${buildGraphFocusEvidenceListHtml(matchedSpans)}
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

    function buildGraphFocusRenderedHtml(payload, matchedSpans) {
        return `
            <div class="agent-pane-block agent-pane-block--graph-focus">
                <div class="agent-pane-title">${escapeHtml(buildGraphFocusTitle(payload))}</div>
                <div class="agent-pane-meta">${escapeHtml(String(payload.sourcePath || payload.atomId || payload.nodeId || ''))}</div>
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

    function scoreGraphFocusNodeText(text, terms) {
        const normalizedText = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!normalizedText) {
            return 0;
        }
        let score = 0;
        terms.forEach((term) => {
            const normalizedTerm = String(term || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!normalizedTerm) {
                return;
            }
            if (normalizedText.includes(normalizedTerm)) {
                score += normalizedTerm.length + 1000;
                return;
            }
            normalizedTerm
                .split(/[.;,:()[\]{}]/)
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

    function highlightGraphFocusRenderedMarkdown(container, matchedSpans) {
        if (!container) {
            return 0;
        }
        const highlightTerms = collectGraphFocusHighlightTerms(matchedSpans);
        if (highlightTerms.length <= 0) {
            return 0;
        }
        const candidates = Array.from(container.querySelectorAll('p, li, blockquote, pre, .reader-block, h1, h2, h3, h4, h5, h6'));
        let highlighted = 0;
        candidates.forEach((candidate) => {
            candidate.classList.remove('agent-focus-match');
            candidate.removeAttribute('data-agent-focus-highlight');
            const score = scoreGraphFocusNodeText(candidate.textContent || '', highlightTerms);
            if (score <= 0) {
                return;
            }
            candidate.classList.add('agent-focus-match');
            candidate.setAttribute('data-agent-focus-highlight', 'true');
            highlighted += 1;
        });
        return highlighted;
    }

    async function renderMarkdownPreviewIntoHost(renderedHost, sourcePath, matchedSpans, renderToken) {
        const previewRuntime = resolveMarkdownPreviewRuntime();
        if (!renderedHost || !sourcePath || !previewRuntime) {
            return false;
        }

        try {
            const markdownSource = await previewRuntime.storageProvider.readContent(sourcePath);
            if (
                !renderedHost.isConnected
                || String(renderedHost.getAttribute('data-agent-preview-render-token') || '') !== String(renderToken)
            ) {
                return true;
            }
            await previewRuntime.markdownRuntime.renderMarkdownInto(renderedHost, String(markdownSource || ''));
            if (
                !renderedHost.isConnected
                || String(renderedHost.getAttribute('data-agent-preview-render-token') || '') !== String(renderToken)
            ) {
                return true;
            }
            highlightGraphFocusRenderedMarkdown(renderedHost, matchedSpans);
            return true;
        } catch (_error) {
            return false;
        }
    }

    async function renderGraphFocusSourceMarkdown(body, payload, matchedSpans, renderToken) {
        const sourcePath = String(payload.sourcePath || '').trim();
        if (!body || !sourcePath) {
            return false;
        }

        body.innerHTML = buildGraphFocusRenderedHtml(payload, matchedSpans);
        const renderedHost = body.querySelector('[data-agent-focus-rendered-markdown="true"]');
        if (!renderedHost) {
            return false;
        }
        renderedHost.setAttribute('data-agent-preview-render-token', String(renderToken));
        const rendered = await renderMarkdownPreviewIntoHost(renderedHost, sourcePath, matchedSpans, renderToken);
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
        body.innerHTML = buildGraphFocusLoadingHtml(payload);
        const rendered = await renderGraphFocusSourceMarkdown(body, payload, matchedSpans, renderToken);
        if (rendered || renderToken !== state.graphFocusRenderToken || !state.panes['graph-focus'].open) {
            return;
        }
        body.innerHTML = buildGraphFocusFallbackHtml(payload, matchedSpans);
    }

    function resolveKnowledgePointSourcePath(item) {
        const sourcePath = String(item && item.sourcePath || '').trim();
        if (sourcePath) {
            return sourcePath;
        }
        const citation = item && typeof item.citation === 'object' ? item.citation : null;
        const citationPath = String(citation && citation.sourcePath || '').trim();
        if (citationPath) {
            return citationPath;
        }
        const matchedSpans = Array.isArray(item && item.matchedSpans) ? item.matchedSpans : [];
        const firstMatchedSpanPath = String(matchedSpans[0] && matchedSpans[0].sourcePath || '').trim();
        return firstMatchedSpanPath;
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

    function buildKnowledgePointFocusPayload(item) {
        const matchedSpans = Array.isArray(item && item.matchedSpans)
            ? item.matchedSpans
                .map((span) => span && typeof span === 'object' ? span : null)
                .filter(Boolean)
            : [];
        const atomIds = Array.isArray(item && item.atomIds) && item.atomIds.length > 0
            ? item.atomIds
            : [item && item.atomId].filter(Boolean);
        return {
            atomId: String(atomIds[0] || item && item.documentId || '').trim(),
            nodeId: String(item && item.documentId || atomIds[0] || '').trim(),
            title: String(item && item.title || resolveKnowledgePointFileName(item)).trim(),
            summary: String(item && (item.summary || item.evidenceSnippet) || '').trim(),
            sourcePath: resolveKnowledgePointSourcePath(item),
            matchedSpans,
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

    function renderLearningPathBody(payload) {
        const body = getPaneBodyElement('learning-path');
        if (!body) {
            return;
        }
        const title = String(
            payload.title
            || payload.atomId
            || translate('agentWorkspace.learningPath.title', 'Learning Path')
        ).trim();
        const items = Array.isArray(payload.items) ? payload.items : [];
        const listHtml = items.length > 0
            ? items.map((item, index) => `
                <li class="agent-pane-list-item">
                    <span class="agent-pane-list-index">${index + 1}</span>
                    <span class="agent-pane-list-label">${escapeHtml(String(item.title || item.atomId || ''))}</span>
                </li>
            `).join('')
            : `<li class="agent-pane-list-empty">${escapeHtml(translate('agentWorkspace.learningPath.emptyLoaded', 'No learning path loaded yet.'))}</li>`;
        body.innerHTML = `
            <div class="agent-pane-block">
                <div class="agent-pane-title">${escapeHtml(title)}</div>
                <ul class="agent-pane-list">${listHtml}</ul>
            </div>
            <div id="agent-learning-path-workspace-host" class="agent-learning-path-workspace-host"></div>
        `;
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
            ${temporalMetrics.length > 0 ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphTemporalLabel', 'Temporal validity'))}</div><ul class="agent-pane-list">${buildEvidenceMetricListHtml(temporalMetrics)}</ul>` : ''}
            ${temporalDetailHtml ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.graphTemporalDetailsLabel', 'Temporal edge details'))}</div><ul class="agent-pane-list">${temporalDetailHtml}</ul>` : ''}
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
        const graphContextHtml = buildEvidenceGraphContextHtml(payload);
        body.innerHTML = `
            <div class="agent-pane-block">
                <div class="agent-pane-title">${escapeHtml(title)}</div>
                <ul class="agent-pane-list">${metricsHtml}</ul>
                ${readinessMessage ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.readinessLabel', 'Workspace readiness'))}</div><div class="agent-pane-summary">${escapeHtml(readinessMessage)}</div>` : ''}
                ${missMessage ? `<div class="agent-pane-section-title">${escapeHtml(translate('agentWorkspace.evidence.missLabel', 'Scope recovery'))}</div><div class="agent-pane-summary">${escapeHtml(missMessage)}</div>` : ''}
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

        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
                <div class="agent-chat-card-section-title">${escapeHtml(metricsHeading)}</div>
                <ul class="agent-chat-card-list">${metricsHtml}</ul>
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
        const runsHtml = runs.length > 0
            ? runs.map((run, index) => `
                <li class="agent-chat-card-list-item">
                    <div class="agent-chat-card-list-title">${escapeHtml(`${index + 1}. ${String(run.runId || '').trim() || noneLabel}`)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(run.artifactTitle || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(String(run.scopeLabel || '').trim() || noneLabel)}</div>
                    <div class="agent-chat-card-list-meta">${escapeHtml(`claims ${String(run.claimCount == null ? 0 : run.claimCount)}, quality ${String(run.qualityStatus || '').trim() || noneLabel}${Number.isFinite(Number(run.qualityScore)) ? `/${String(run.qualityScore)}` : ''}`)}</div>
                    ${String(run.artifactId || '').trim() ? `<div class="agent-chat-card-actions"><button type="button" data-agent-knowledge-run-history-inspect="${index}">${escapeHtml(translate('agentWorkspace.reply.knowledgeRunHistoryInspectRun', 'Inspect Run'))}</button>${latestRun && index > 0 ? `<button type="button" data-agent-knowledge-run-history-compare="${index}">${escapeHtml(translate('agentWorkspace.reply.knowledgeRunHistoryCompareLatest', 'Compare Latest'))}</button>` : ''}</div>` : ''}
                </li>
            `).join('')
            : `<li class="agent-chat-card-list-empty">${escapeHtml(noneLabel)}</li>`;

        node.innerHTML = `
            <div class="agent-chat-card">
                <div class="agent-chat-card-title">${escapeHtml(title)}</div>
                <div class="agent-chat-card-summary">${escapeHtml(summaryText)}</div>
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
        const latestQualityScore = Number.isFinite(Number(safeLatest.qualityScore)) ? Number(safeLatest.qualityScore) : null;
        const comparedQualityScore = Number.isFinite(Number(safeCompared.qualityScore)) ? Number(safeCompared.qualityScore) : null;
        return {
            latestRunId: String(safeLatest.runId || '').trim(),
            latestArtifactTitle: String(safeLatest.artifactTitle || '').trim(),
            latestQualityStatus: String(safeLatest.qualityStatus || '').trim(),
            latestQualityScore,
            latestClaimCount: Number.isFinite(Number(safeLatest.claimCount)) ? Number(safeLatest.claimCount) : 0,
            latestWeakClaimCount: Number.isFinite(Number(safeLatest.weakClaimCount)) ? Number(safeLatest.weakClaimCount) : 0,
            latestRemainingReviewCardCount: Number.isFinite(Number(safeLatest.remainingReviewCardCount)) ? Number(safeLatest.remainingReviewCardCount) : 0,
            comparedRunId: String(safeCompared.runId || '').trim(),
            comparedArtifactTitle: String(safeCompared.artifactTitle || '').trim(),
            comparedQualityStatus: String(safeCompared.qualityStatus || '').trim(),
            comparedQualityScore,
            comparedClaimCount: Number.isFinite(Number(safeCompared.claimCount)) ? Number(safeCompared.claimCount) : 0,
            comparedWeakClaimCount: Number.isFinite(Number(safeCompared.weakClaimCount)) ? Number(safeCompared.weakClaimCount) : 0,
            comparedRemainingReviewCardCount: Number.isFinite(Number(safeCompared.remainingReviewCardCount)) ? Number(safeCompared.remainingReviewCardCount) : 0,
            qualityScoreDelta: latestQualityScore != null && comparedQualityScore != null
                ? Number((comparedQualityScore - latestQualityScore).toFixed(2))
                : null,
            claimCountDelta: (Number.isFinite(Number(safeCompared.claimCount)) ? Number(safeCompared.claimCount) : 0)
                - (Number.isFinite(Number(safeLatest.claimCount)) ? Number(safeLatest.claimCount) : 0),
            weakClaimCountDelta: (Number.isFinite(Number(safeCompared.weakClaimCount)) ? Number(safeCompared.weakClaimCount) : 0)
                - (Number.isFinite(Number(safeLatest.weakClaimCount)) ? Number(safeLatest.weakClaimCount) : 0),
            remainingReviewCardCountDelta: (Number.isFinite(Number(safeCompared.remainingReviewCardCount)) ? Number(safeCompared.remainingReviewCardCount) : 0)
                - (Number.isFinite(Number(safeLatest.remainingReviewCardCount)) ? Number(safeLatest.remainingReviewCardCount) : 0),
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
        const metricsHeading = translate('agentWorkspace.reply.knowledgeRunMetricsHeading', 'Key Metrics');
        const qualityDelta = summary.qualityScoreDelta == null
            ? noneLabel
            : formatKnowledgeRunCompareDelta(summary.qualityScoreDelta);
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
        learningPathWorkspace: {
            mounted: false,
            nodes: {},
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

    function rememberLearningPathWorkspaceNode(id) {
        if (Object.prototype.hasOwnProperty.call(state.learningPathWorkspace.nodes, id)) {
            return state.learningPathWorkspace.nodes[id];
        }
        const node = getElement(id);
        if (!node) {
            return null;
        }
        const parent = node.parentNode;
        const nextSibling = node.nextSibling;
        const snapshot = {
            node,
            parent,
            nextSibling,
        };
        state.learningPathWorkspace.nodes[id] = snapshot;
        return snapshot;
    }

    function mountLearningPathWorkspace() {
        const host = getLearningPathWorkspaceHost();
        if (!host) {
            return false;
        }
        LEARNING_PATH_WORKSPACE_ELEMENT_IDS.forEach((id) => {
            const snapshot = rememberLearningPathWorkspaceNode(id);
            if (!snapshot || !snapshot.node) {
                return;
            }
            host.appendChild(snapshot.node);
            if (id === 'path-container') {
                snapshot.node.style.display = 'block';
            }
        });
        state.learningPathWorkspace.mounted = true;
        return true;
    }

    function restoreLearningPathWorkspace() {
        LEARNING_PATH_WORKSPACE_ELEMENT_IDS.forEach((id) => {
            const snapshot = state.learningPathWorkspace.nodes[id];
            if (!snapshot || !snapshot.node || !snapshot.parent) {
                return;
            }
            if (snapshot.nextSibling && snapshot.nextSibling.parentNode === snapshot.parent) {
                snapshot.parent.insertBefore(snapshot.node, snapshot.nextSibling);
            } else {
                snapshot.parent.appendChild(snapshot.node);
            }
            snapshot.node.style.display = 'none';
        });
        state.learningPathWorkspace.mounted = false;
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
            if (state.learningPathWorkspace.mounted) {
                mountLearningPathWorkspace();
            }
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

    async function renderStructuredAnswerMarkdownSection(container, markdownRuntime, markdown) {
        const normalizedMarkdown = String(markdown || '').trim();
        if (!normalizedMarkdown) {
            return false;
        }
        if (markdownRuntime && typeof markdownRuntime.renderMarkdownInto === 'function') {
            await markdownRuntime.renderMarkdownInto(container, normalizedMarkdown);
        } else {
            container.textContent = normalizedMarkdown;
        }
        return true;
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
            wrapper.appendChild(summary);
            return wrapper;
        }

        const sections = [
            {
                key: 'overviewMarkdown',
                className: 'agent-chat-structured-answer-overview',
            },
            {
                key: 'explanationMarkdown',
                className: 'agent-chat-structured-answer-explanation',
            },
            {
                key: 'evidenceMarkdown',
                className: 'agent-chat-structured-answer-evidence',
            },
            {
                key: 'nextActionsMarkdown',
                className: 'agent-chat-structured-answer-next-actions',
            },
        ];

        for (const section of sections) {
            const markdown = String(block && block[section.key] || '').trim();
            if (!markdown) {
                continue;
            }
            const sectionNode = document.createElement('div');
            sectionNode.className = `agent-chat-markdown agent-chat-structured-answer-section ${section.className}`;
            sectionNode.setAttribute('data-structured-answer-section', section.key);
            await renderStructuredAnswerMarkdownSection(sectionNode, markdownRuntime, markdown);
            wrapper.appendChild(sectionNode);
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
            renderLearningPathBody(payload || {});
            mountLearningPathWorkspace();
            syncPaneState('learning-path');
            updatePaneControlLabels();
        },
        clearLearningPathPane: function () {
            if (state.promotionPane === 'learning-path') {
                state.promotionPane = null;
                syncBodyPromotionState();
            }
            restoreLearningPathWorkspace();
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
            await renderConversationBlocksIntoNode(node, entry || {});
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
            if (normalizedItems.length <= 0) {
                state.knowledgePoints.resultSetKey = '';
                state.knowledgePoints.expandedByKey = {};
                container.innerHTML = `<div class="agent-knowledge-empty">${escapeHtml(translate('agentWorkspace.knowledge.empty', 'No scoped knowledge matches.'))}</div>`;
                return;
            }
            container.innerHTML = '';
            normalizedItems.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'agent-knowledge-card';
                const fileName = resolveKnowledgePointFileName(item);
                card.setAttribute('data-agent-knowledge-card', 'true');
                const sourcePath = resolveKnowledgePointSourcePath(item);
                const fileButton = document.createElement('button');
                fileButton.type = 'button';
                fileButton.className = 'agent-knowledge-file-button';
                fileButton.textContent = fileName;
                fileButton.setAttribute(
                    'aria-label',
                    translate('agentWorkspace.knowledge.togglePreview', 'Open matched knowledge: {file}', {
                        file: fileName,
                    })
                );
                card.appendChild(fileButton);
                fileButton.addEventListener('click', function () {
                    ensureWorkspaceVisible();
                    api.openGraphFocusPane(buildKnowledgePointFocusPayload(item));
                });
                fileButton.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileButton.click();
                    }
                });
                if (sourcePath) {
                    const pathNode = document.createElement('div');
                    pathNode.className = 'agent-knowledge-source-path';
                    pathNode.textContent = sourcePath;
                    card.appendChild(pathNode);
                }
                container.appendChild(card);
            });
        },
    };

    window.NoteConnectionWorkspacePanes = api;
}());
