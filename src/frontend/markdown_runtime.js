(function () {
    const state = {
        mermaidInitialized: false,
        mermaidRenderCounter: 0,
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeMarkdownSource(markdownText) {
        const source = String(markdownText || '');
        if (!source.includes('```mermaid') || !source.includes('$$')) {
            return source;
        }
        return source.replace(/\$\$[ \t]*```mermaid\b/g, '$$\n```mermaid');
    }

    function normalizeMarkdownBlockText(value) {
        return String(value || '')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
            .replace(/<br\s*\/?>/giu, ' ')
            .replace(/&nbsp;/giu, ' ')
            .replace(/[*_~`|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function stripMarkdownBlockPrefix(line) {
        return String(line || '')
            .replace(/^\s{0,3}>+\s?/u, '')
            .replace(/^\s{0,3}#{1,6}\s+/u, '')
            .replace(/^\s{0,3}(?:[-*+]|(?:\d+)[.)])\s+/u, '')
            .trim();
    }

    function isBlankMarkdownLine(line) {
        return String(line || '').trim().length <= 0;
    }

    function getMarkdownIndentWidth(line) {
        const match = String(line || '').match(/^\s*/u);
        return match ? match[0].length : 0;
    }

    function isMarkdownFenceLine(line) {
        return /^\s*(?:```+|~~~+)/u.test(String(line || ''));
    }

    function isMarkdownHeadingLine(line) {
        return /^\s{0,3}#{1,6}\s+/u.test(String(line || ''));
    }

    function isMarkdownBlockquoteLine(line) {
        return /^\s{0,3}>/u.test(String(line || ''));
    }

    function isMarkdownListItemLine(line) {
        return /^\s{0,3}(?:[-*+]|(?:\d+)[.)])\s+/u.test(String(line || ''));
    }

    function buildMarkdownSourceBlock(kind, startLine, endLine, text) {
        const normalizedText = normalizeMarkdownBlockText(text);
        if (!normalizedText) {
            return null;
        }
        return {
            kind,
            startLine: Math.max(1, Number(startLine) || 1),
            endLine: Math.max(Math.max(1, Number(startLine) || 1), Number(endLine) || Number(startLine) || 1),
            text: normalizedText,
        };
    }

    function collectMarkdownSourceBlocks(markdownText) {
        const lines = String(markdownText || '').split(/\r?\n/u);
        const blocks = [];
        let lineIndex = 0;
        while (lineIndex < lines.length) {
            const currentLine = String(lines[lineIndex] || '');
            if (isBlankMarkdownLine(currentLine)) {
                lineIndex += 1;
                continue;
            }

            if (isMarkdownFenceLine(currentLine)) {
                const startLine = lineIndex + 1;
                const fenceMarkerMatch = currentLine.match(/^\s*(```+|~~~+)/u);
                const fenceMarker = fenceMarkerMatch ? fenceMarkerMatch[1] : '```';
                const bodyLines = [];
                lineIndex += 1;
                let endLine = startLine;
                while (lineIndex < lines.length) {
                    const candidateLine = String(lines[lineIndex] || '');
                    endLine = lineIndex + 1;
                    if (new RegExp(`^\\s*${fenceMarker}\\s*$`, 'u').test(candidateLine)) {
                        lineIndex += 1;
                        break;
                    }
                    bodyLines.push(candidateLine);
                    lineIndex += 1;
                }
                const preBlock = buildMarkdownSourceBlock('pre', startLine, endLine, bodyLines.join(' '));
                if (preBlock) {
                    blocks.push(preBlock);
                }
                continue;
            }

            if (isMarkdownHeadingLine(currentLine)) {
                const headingBlock = buildMarkdownSourceBlock(
                    'heading',
                    lineIndex + 1,
                    lineIndex + 1,
                    stripMarkdownBlockPrefix(currentLine)
                );
                if (headingBlock) {
                    blocks.push(headingBlock);
                }
                lineIndex += 1;
                continue;
            }

            if (isMarkdownBlockquoteLine(currentLine)) {
                const startLine = lineIndex + 1;
                const bodyLines = [];
                let endLine = startLine;
                while (lineIndex < lines.length && isMarkdownBlockquoteLine(lines[lineIndex])) {
                    bodyLines.push(stripMarkdownBlockPrefix(lines[lineIndex]));
                    endLine = lineIndex + 1;
                    lineIndex += 1;
                }
                const blockquoteBlock = buildMarkdownSourceBlock('blockquote', startLine, endLine, bodyLines.join(' '));
                if (blockquoteBlock) {
                    blocks.push(blockquoteBlock);
                }
                continue;
            }

            if (isMarkdownListItemLine(currentLine)) {
                const startLine = lineIndex + 1;
                const startIndent = getMarkdownIndentWidth(currentLine);
                const bodyLines = [stripMarkdownBlockPrefix(currentLine)];
                let endLine = startLine;
                lineIndex += 1;
                while (lineIndex < lines.length) {
                    const candidateLine = String(lines[lineIndex] || '');
                    if (isBlankMarkdownLine(candidateLine)) {
                        break;
                    }
                    if (
                        isMarkdownFenceLine(candidateLine)
                        || isMarkdownHeadingLine(candidateLine)
                        || isMarkdownBlockquoteLine(candidateLine)
                    ) {
                        break;
                    }
                    if (
                        isMarkdownListItemLine(candidateLine)
                        && getMarkdownIndentWidth(candidateLine) <= startIndent
                    ) {
                        break;
                    }
                    bodyLines.push(stripMarkdownBlockPrefix(candidateLine));
                    endLine = lineIndex + 1;
                    lineIndex += 1;
                }
                const listItemBlock = buildMarkdownSourceBlock('list_item', startLine, endLine, bodyLines.join(' '));
                if (listItemBlock) {
                    blocks.push(listItemBlock);
                }
                continue;
            }

            const startLine = lineIndex + 1;
            const bodyLines = [currentLine];
            let endLine = startLine;
            lineIndex += 1;
            while (lineIndex < lines.length) {
                const candidateLine = String(lines[lineIndex] || '');
                if (
                    isBlankMarkdownLine(candidateLine)
                    || isMarkdownFenceLine(candidateLine)
                    || isMarkdownHeadingLine(candidateLine)
                    || isMarkdownBlockquoteLine(candidateLine)
                    || isMarkdownListItemLine(candidateLine)
                ) {
                    break;
                }
                bodyLines.push(candidateLine);
                endLine = lineIndex + 1;
                lineIndex += 1;
            }
            const paragraphBlock = buildMarkdownSourceBlock('paragraph', startLine, endLine, bodyLines.join(' '));
            if (paragraphBlock) {
                blocks.push(paragraphBlock);
            }
        }
        return blocks;
    }

    function collectMarkdownBlockFeatures(value) {
        return normalizeMarkdownBlockText(value)
            .toLowerCase()
            .split(/[^a-z0-9\u3400-\u9fff]+/u)
            .map((part) => part.trim())
            .filter((part) => part.length >= 2 || /[\u3400-\u9fff]/u.test(part));
    }

    function computeMarkdownBlockTextScore(renderedText, sourceText) {
        const normalizedRendered = normalizeMarkdownBlockText(renderedText).toLowerCase();
        const normalizedSource = normalizeMarkdownBlockText(sourceText).toLowerCase();
        if (!normalizedRendered || !normalizedSource) {
            return 0;
        }
        if (normalizedRendered === normalizedSource) {
            return 10000;
        }
        if (
            normalizedRendered.includes(normalizedSource)
            || normalizedSource.includes(normalizedRendered)
        ) {
            return 8000 - Math.abs(normalizedRendered.length - normalizedSource.length);
        }
        const renderedFeatures = collectMarkdownBlockFeatures(normalizedRendered);
        const sourceFeatures = new Set(collectMarkdownBlockFeatures(normalizedSource));
        if (renderedFeatures.length <= 0 || sourceFeatures.size <= 0) {
            return 0;
        }
        const overlapCount = renderedFeatures.filter((feature) => sourceFeatures.has(feature)).length;
        const overlapRatio = overlapCount / renderedFeatures.length;
        if (overlapRatio < 0.6) {
            return 0;
        }
        return Math.round(overlapRatio * 1000);
    }

    function resolveRenderedMarkdownBlockKind(element) {
        const tagName = String(element && element.tagName || '').toLowerCase();
        if (/^h[1-6]$/u.test(tagName)) {
            return 'heading';
        }
        if (tagName === 'p') {
            return 'paragraph';
        }
        if (tagName === 'li') {
            return 'list_item';
        }
        if (tagName === 'blockquote') {
            return 'blockquote';
        }
        if (tagName === 'pre') {
            return 'pre';
        }
        return '';
    }

    function collectRenderedMarkdownBlockCandidates(container) {
        if (!container || typeof container.querySelectorAll !== 'function') {
            return [];
        }
        return Array.from(container.querySelectorAll('p, li, blockquote, pre, h1, h2, h3, h4, h5, h6'));
    }

    function clearRenderedMarkdownBlockProvenance(container) {
        collectRenderedMarkdownBlockCandidates(container).forEach((element) => {
            element.removeAttribute('data-agent-markdown-source-start-line');
            element.removeAttribute('data-agent-markdown-source-end-line');
            element.removeAttribute('data-agent-markdown-source-kind');
        });
    }

    function annotateRenderedMarkdownBlocks(container, rawMarkdown) {
        const renderedCandidates = collectRenderedMarkdownBlockCandidates(container);
        const sourceBlocks = collectMarkdownSourceBlocks(rawMarkdown);
        clearRenderedMarkdownBlockProvenance(container);
        if (renderedCandidates.length <= 0 || sourceBlocks.length <= 0) {
            return {
                sourceBlockCount: sourceBlocks.length,
                attributedNodeCount: 0,
            };
        }
        let sourceCursor = 0;
        let attributedNodeCount = 0;
        renderedCandidates.forEach((candidate) => {
            const renderedKind = resolveRenderedMarkdownBlockKind(candidate);
            const renderedText = normalizeMarkdownBlockText(candidate && candidate.textContent || '');
            if (!renderedKind || !renderedText) {
                return;
            }
            let bestMatchIndex = -1;
            let bestMatchScore = 0;
            const searchEnd = Math.min(sourceBlocks.length, sourceCursor + 24);
            for (let index = sourceCursor; index < searchEnd; index += 1) {
                const sourceBlock = sourceBlocks[index];
                if (!sourceBlock || sourceBlock.kind !== renderedKind) {
                    continue;
                }
                const score = computeMarkdownBlockTextScore(renderedText, sourceBlock.text);
                if (score <= bestMatchScore) {
                    continue;
                }
                bestMatchIndex = index;
                bestMatchScore = score;
            }
            if (bestMatchIndex < 0 || bestMatchScore < 600) {
                return;
            }
            const matchedSourceBlock = sourceBlocks[bestMatchIndex];
            candidate.setAttribute('data-agent-markdown-source-start-line', String(matchedSourceBlock.startLine));
            candidate.setAttribute('data-agent-markdown-source-end-line', String(matchedSourceBlock.endLine));
            candidate.setAttribute('data-agent-markdown-source-kind', matchedSourceBlock.kind);
            sourceCursor = bestMatchIndex + 1;
            attributedNodeCount += 1;
        });
        return {
            sourceBlockCount: sourceBlocks.length,
            attributedNodeCount,
        };
    }

    function getRuntimeUrl(resourcePath) {
        const runtime = window.NoteConnectionRuntime;
        if (runtime && typeof runtime.buildUrl === 'function') {
            return runtime.buildUrl(resourcePath);
        }
        return resourcePath;
    }

    function getRuntimeFetchOptions(init) {
        const runtime = window.NoteConnectionRuntime;
        if (runtime && typeof runtime.buildFetchOptions === 'function') {
            return runtime.buildFetchOptions(init || {});
        }
        return init || {};
    }

    function isSafeAssistantUrl(tagName, attrName, rawValue) {
        const value = String(rawValue || '').trim();
        if (!value) {
            return true;
        }
        const lowered = value.toLowerCase();
        if (
            tagName === 'img'
            && attrName === 'src'
            && (
                lowered.startsWith('data:image/png')
                || lowered.startsWith('data:image/jpeg')
                || lowered.startsWith('data:image/jpg')
                || lowered.startsWith('data:image/gif')
                || lowered.startsWith('data:image/webp')
                || lowered.startsWith('data:image/svg+xml')
            )
        ) {
            return true;
        }
        if (
            lowered.startsWith('javascript:')
            || lowered.startsWith('vbscript:')
            || lowered.startsWith('data:text/html')
        ) {
            return false;
        }
        return true;
    }

    function sanitizeRenderedHtml(container) {
        if (!container || typeof container.querySelectorAll !== 'function') {
            return;
        }

        container.querySelectorAll('script, iframe, object, embed, form, style').forEach((node) => {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });

        container.querySelectorAll('*').forEach((element) => {
            if (!element || typeof element.getAttributeNames !== 'function') {
                return;
            }
            const tagName = String(element.tagName || '').toLowerCase();
            element.getAttributeNames().forEach((attributeName) => {
                const normalizedName = String(attributeName || '').toLowerCase();
                const attributeValue = element.getAttribute(attributeName);
                if (normalizedName.startsWith('on') || normalizedName === 'style') {
                    element.removeAttribute(attributeName);
                    return;
                }
                if (
                    (normalizedName === 'href' || normalizedName === 'src' || normalizedName === 'xlink:href')
                    && !isSafeAssistantUrl(tagName, normalizedName, attributeValue)
                ) {
                    element.removeAttribute(attributeName);
                }
            });
            if (tagName === 'a') {
                element.setAttribute('target', '_blank');
                element.setAttribute('rel', 'noopener noreferrer');
            }
            if (tagName === 'img') {
                element.setAttribute('loading', 'lazy');
            }
        });
    }

    function renderMathInContainer(container) {
        if (!window.renderMathInElement) {
            return;
        }
        window.renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
            ],
        });
    }

    function isMermaidErrorArtifactText(text) {
        const normalized = String(text || '').toLowerCase();
        if (!normalized) {
            return false;
        }
        return (
            normalized.includes('syntax error in text')
            || normalized.includes('lexical error on line')
            || normalized.includes('parse error on line')
            || normalized.includes('mermaid version')
            || normalized.includes('diagram syntax error')
        );
    }

    function resolveMermaidErrorArtifactHost(node) {
        if (!node || typeof node.closest !== 'function') {
            return node;
        }
        return (
            node.closest('.mermaid-render-host-offscreen')
            || node.closest('.mermaid')
            || node.closest('.mermaid-render-failed')
            || node.closest('.agent-chat-message')
            || node.closest('svg')
            || node
        );
    }

    function isProtectedMermaidSuppressionHost(host) {
        if (!host || host.nodeType !== 1) {
            return true;
        }
        return (
            host === document.body
            || host === document.documentElement
            || host === document.head
            || host.id === 'graph-wrapper'
            || host.id === 'path-container'
            || host.id === 'reading-window'
            || host.id === 'reading-content-box'
            || host.id === 'reading-body'
        );
    }

    function collectMermaidErrorArtifactHosts(root) {
        const hosts = [];
        const seen = new Set();
        const candidates = [];
        if (!root) {
            return hosts;
        }
        if (root.nodeType === 1 && root !== document.body && root !== document.documentElement && root !== document.head) {
            candidates.push(root);
        }
        if (typeof root.querySelectorAll === 'function') {
            root.querySelectorAll('svg, .mermaid, div, section, article, aside, img, foreignObject').forEach((node) => {
                candidates.push(node);
            });
        }
        candidates.forEach((candidate) => {
            if (!candidate || candidate.nodeType !== 1) {
                return;
            }
            const text = String(
                candidate.textContent
                || candidate.getAttribute?.('alt')
                || candidate.getAttribute?.('aria-label')
                || ''
            ).trim();
            const hasErrorClass = Boolean(
                candidate.classList?.contains('error-icon')
                || candidate.querySelector?.('.error-icon')
            );
            if (!hasErrorClass && !isMermaidErrorArtifactText(text)) {
                return;
            }
            const host = resolveMermaidErrorArtifactHost(candidate);
            if (!host || seen.has(host) || isProtectedMermaidSuppressionHost(host)) {
                return;
            }
            seen.add(host);
            hosts.push(host);
        });
        return hosts;
    }

    function suppressLeakedMermaidErrorArtifacts(options) {
        const root = options && options.root ? options.root : document.body;
        const preserveNode = options && options.preserveNode ? options.preserveNode : null;
        const hosts = collectMermaidErrorArtifactHosts(root);
        hosts.forEach((host) => {
            if (!host || host.closest?.('.mermaid-render-failed')) {
                return;
            }
            if (preserveNode && (host === preserveNode || preserveNode.contains(host) || host.contains(preserveNode))) {
                return;
            }
            if (host.parentNode) {
                host.parentNode.removeChild(host);
            } else if (host.style) {
                host.style.display = 'none';
            }
        });
        return hosts.length;
    }

    function createOffscreenMermaidRenderHost(widthHint) {
        const hostWidth = Math.max(480, Number(widthHint) || 960);
        const host = document.createElement('div');
        host.className = 'mermaid-render-host-offscreen';
        host.style.position = 'fixed';
        host.style.left = '-20000px';
        host.style.top = '0';
        host.style.width = String(hostWidth) + 'px';
        host.style.minWidth = String(hostWidth) + 'px';
        host.style.height = 'auto';
        host.style.overflow = 'visible';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        host.style.background = 'transparent';
        host.style.fontFamily = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif';
        (document.body || document.documentElement).appendChild(host);
        return host;
    }

    function normalizeMermaidDefinition(source) {
        if (
            window.pathModules
            && window.pathModules.utils
            && typeof window.pathModules.utils.normalizeBridgeMermaidDefinition === 'function'
        ) {
            return window.pathModules.utils.normalizeBridgeMermaidDefinition(source);
        }
        return String(source || '').trim();
    }

    function getMermaidDefinitionCandidates(source) {
        const candidates = [];
        const normalized = normalizeMermaidDefinition(source);
        const raw = String(source || '').replace(/\r\n?/g, '\n').trim();
        [normalized, raw].forEach((candidate) => {
            const next = String(candidate || '').trim();
            if (!next || candidates.includes(next)) {
                return;
            }
            candidates.push(next);
        });
        return candidates;
    }

    async function canParseMermaidDefinition(definition) {
        if (!window.mermaid || typeof window.mermaid.parse !== 'function') {
            return true;
        }
        try {
            await window.mermaid.parse(definition);
            return true;
        } catch (_error) {
            return false;
        }
    }

    function isMermaidErrorSvgMarkup(markup) {
        const text = String(markup || '').toLowerCase();
        if (!text) {
            return false;
        }
        return (
            text.includes('syntax error in text')
            || text.includes('lexical error on line')
            || text.includes('parse error on line')
            || text.includes('mermaid version')
            || text.includes('class="error-icon"')
            || text.includes('id="error-icon"')
        );
    }

    function renderCompactMermaidFailure(wrapper, error, source) {
        wrapper.classList.add('mermaid-render-failed');
        wrapper.innerHTML = '';

        const notice = document.createElement('div');
        notice.className = 'mermaid-render-notice';

        const title = document.createElement('div');
        title.className = 'mermaid-render-notice-title';
        title.textContent = 'Mermaid diagram unavailable.';
        notice.appendChild(title);

        const summary = document.createElement('div');
        summary.className = 'mermaid-render-notice-summary';
        summary.textContent = 'Rendering failed in the current runtime. Details are available on demand.';
        notice.appendChild(summary);

        const details = document.createElement('details');
        details.className = 'mermaid-render-notice-details';

        const detailsSummary = document.createElement('summary');
        detailsSummary.textContent = 'Render details';
        details.appendChild(detailsSummary);

        const detailText = document.createElement('pre');
        detailText.className = 'mermaid-render-notice-code';
        const errorMessage = String(error && error.message ? error.message : error || 'Unknown error').trim();
        const sourceSnippet = String(source || '').trim().slice(0, 320);
        detailText.textContent = errorMessage + (sourceSnippet ? `\n\n${sourceSnippet}` : '');
        details.appendChild(detailText);

        notice.appendChild(details);
        wrapper.appendChild(notice);
    }

    async function renderMermaidViaBackend(graphDefinition) {
        const source = normalizeMermaidDefinition(graphDefinition || '');
        if (!source) {
            return null;
        }
        try {
            const response = await fetch(
                getRuntimeUrl('/api/render/mermaid'),
                getRuntimeFetchOptions({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        source,
                        renderer: 'auto',
                    }),
                })
            );
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload || typeof payload.pngBase64 !== 'string' || !payload.pngBase64.trim()) {
                return null;
            }
            return {
                pngBase64: payload.pngBase64.trim(),
                renderer: typeof payload.renderer === 'string' ? payload.renderer.trim() : '',
            };
        } catch (_error) {
            return null;
        }
    }

    async function renderMermaidInContainer(container) {
        const hasFrontendMermaid = Boolean(window.mermaid);
        if (hasFrontendMermaid && !state.mermaidInitialized) {
            window.mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'loose',
                htmlLabels: true,
            });
            state.mermaidInitialized = true;
        }

        suppressLeakedMermaidErrorArtifacts({ root: document.body });

        let mermaidBlocks = Array.from(container.querySelectorAll('pre code.language-mermaid, pre code.lang-mermaid'));
        if (mermaidBlocks.length === 0 && container.dataset && container.dataset.codeLanguage === 'mermaid') {
            const fallbackBlock = container.querySelector('pre code');
            if (fallbackBlock) {
                mermaidBlocks = [fallbackBlock];
            }
        }

        for (const block of mermaidBlocks) {
            const txt = document.createElement('textarea');
            txt.innerHTML = block.innerHTML;
            const candidateDefinitions = getMermaidDefinitionCandidates(txt.value);
            const graphDefinition = candidateDefinitions[0] || '';
            const parentPre = block.parentElement;
            if (!parentPre || !parentPre.parentNode) {
                continue;
            }

            state.mermaidRenderCounter += 1;
            const renderId = `agent-mermaid-${state.mermaidRenderCounter}`;
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid';
            parentPre.parentNode.replaceChild(wrapper, parentPre);
            let rendered = false;
            const renderErrors = [];

            if (hasFrontendMermaid) {
                for (let candidateIndex = 0; candidateIndex < candidateDefinitions.length; candidateIndex += 1) {
                    const candidate = candidateDefinitions[candidateIndex];
                    const offscreenHost = createOffscreenMermaidRenderHost(
                        wrapper.clientWidth || parentPre.clientWidth || container.clientWidth || 960
                    );
                    try {
                        wrapper.innerHTML = '';
                        const renderedResult = await window.mermaid.render(`${renderId}-${candidateIndex}`, candidate, offscreenHost);
                        if (renderedResult && typeof renderedResult.svg === 'string' && renderedResult.svg.trim()) {
                            if (isMermaidErrorSvgMarkup(renderedResult.svg)) {
                                throw new Error('Mermaid frontend renderer returned an error SVG instead of a diagram.');
                            }
                            wrapper.innerHTML = renderedResult.svg;
                        }
                        if (/<svg[\s>]/i.test(String(wrapper.innerHTML || ''))) {
                            rendered = true;
                            break;
                        }
                    } catch (error) {
                        renderErrors.push(error);
                        wrapper.innerHTML = '';
                        suppressLeakedMermaidErrorArtifacts({
                            root: document.body,
                            preserveNode: wrapper,
                        });
                    } finally {
                        offscreenHost.remove();
                    }
                }
            } else {
                renderErrors.push(new Error('Mermaid runtime is unavailable in current webview.'));
            }

            if (!rendered && hasFrontendMermaid) {
                for (let candidateIndex = 0; candidateIndex < candidateDefinitions.length; candidateIndex += 1) {
                    const candidate = candidateDefinitions[candidateIndex];
                    const canParse = await canParseMermaidDefinition(candidate);
                    if (!canParse) {
                        continue;
                    }
                    try {
                        wrapper.innerHTML = '';
                        wrapper.textContent = candidate;
                        await window.mermaid.run({ nodes: [wrapper] });
                        rendered = /<svg[\s>]/i.test(String(wrapper.innerHTML || ''))
                            && !isMermaidErrorSvgMarkup(String(wrapper.innerHTML || ''));
                        if (rendered) {
                            break;
                        }
                    } catch (error) {
                        renderErrors.push(error);
                        wrapper.innerHTML = '';
                        suppressLeakedMermaidErrorArtifacts({
                            root: document.body,
                            preserveNode: wrapper,
                        });
                    }
                }
            }

            if (!rendered) {
                wrapper.innerHTML = '';
                const backendRendered = await renderMermaidViaBackend(graphDefinition);
                if (backendRendered && backendRendered.pngBase64) {
                    const altRenderer = backendRendered.renderer ? ` (${backendRendered.renderer})` : '';
                    wrapper.innerHTML = `<img class="mermaid-fallback-image" src="data:image/png;base64,${backendRendered.pngBase64}" alt="Mermaid diagram${altRenderer}" />`;
                    rendered = true;
                }
            }

            if (!rendered) {
                const lastError = renderErrors.length > 0 ? renderErrors[renderErrors.length - 1] : null;
                renderCompactMermaidFailure(wrapper, lastError, graphDefinition);
            }

            suppressLeakedMermaidErrorArtifacts({
                root: document.body,
                preserveNode: wrapper,
            });
        }
    }

    function renderPlainTextInto(container, text) {
        container.innerHTML = '';
        const paragraph = document.createElement('p');
        paragraph.style.whiteSpace = 'pre-wrap';
        paragraph.textContent = String(text || '');
        container.appendChild(paragraph);
    }

    async function renderMarkdownInto(container, rawMarkdown) {
        if (!container) {
            return {
                sourceBlockCount: 0,
                attributedNodeCount: 0,
            };
        }
        const source = sanitizeMarkdownSource(rawMarkdown);
        if (!window.marked || typeof window.marked.parse !== 'function') {
            renderPlainTextInto(container, source);
            return annotateRenderedMarkdownBlocks(container, source);
        }
        container.innerHTML = window.marked.parse(source);
        sanitizeRenderedHtml(container);
        renderMathInContainer(container);
        await renderMermaidInContainer(container);
        return annotateRenderedMarkdownBlocks(container, source);
    }

    window.NoteConnectionMarkdownRuntime = {
        escapeHtml,
        sanitizeMarkdownSource,
        renderMathInContainer,
        renderMermaidInContainer,
        renderMarkdownInto,
        renderPlainTextInto,
    };
}());
