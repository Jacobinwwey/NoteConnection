/**
 * Reader Module
 * Handles rendering of Markdown, Math, Mermaid, and window management.
 */

class Reader {
    constructor() {
        this.window = document.getElementById('reading-window');
        this.contentBox = document.getElementById('reading-content-box');
        this.body = document.getElementById('reading-body');
        this.title = document.getElementById('reading-title');
        this._touchZoomBoundBody = null;
        
        this.isLocked = true;
        this.currentZoom = 0.5;
        this._protocolRenderState = null;
        this._protocolScrollHandler = null;
        this._mermaidInitialized = false;
        this._mermaidRenderStats = {
            frontendRender: 0,
            frontendRun: 0,
            backendPng: 0,
            failed: 0,
        };

        this.init();
    }

    init() {
        // Close Button
        document.getElementById('btn-reader-close').addEventListener('click', () => {
            this.close();
        });

        // Close on overlay click
        this.window.addEventListener('click', (e) => {
            if (e.target === this.window) this.close();
        });

        // Lock Toggle
        document.getElementById('btn-reader-lock').addEventListener('click', () => {
            this.toggleLock();
        });

        // Zoom Controls
        document.getElementById('btn-reader-zoom-in').addEventListener('click', () => this.zoom(0.1));
        document.getElementById('btn-reader-zoom-out').addEventListener('click', () => this.zoom(-0.1));

        // Initialize Mermaid
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        }
        
        // Touch Gestures (Pinch to Zoom)
        this.bindTouchZoomSurface();
    }

    refreshDomRefs() {
        this.window = document.getElementById('reading-window');
        this.contentBox = document.getElementById('reading-content-box');
        this.body = document.getElementById('reading-body');
        this.title = document.getElementById('reading-title');
    }

    ensureReaderStructure() {
        this.refreshDomRefs();
        if (!this.window || !this.contentBox || !this.title) {
            throw new Error('Reader shell structure is unavailable in the current document.');
        }

        const existingBody = document.getElementById('reading-body');
        const bodyDetached = !!(existingBody && !this.contentBox.contains(existingBody));
        if (!existingBody || bodyDetached) {
            const replacementBody = document.createElement('div');
            replacementBody.id = 'reading-body';
            replacementBody.className = `reading-body ${this.isLocked ? 'locked' : 'unlocked'}`;
            replacementBody.style.fontSize = `${this.currentZoom}rem`;
            this.contentBox.appendChild(replacementBody);
            this.body = replacementBody;
        } else {
            this.body = existingBody;
        }

        this.bindTouchZoomSurface();
        return this.body;
    }

    bindTouchZoomSurface() {
        const body = this.ensureReaderStructureBodyOnly();
        if (!body || this._touchZoomBoundBody === body) {
            return;
        }
        this._touchZoomBoundBody = body;

        let initialDistance = 0;
        let initialZoom = 1.0;

        body.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialZoom = this.currentZoom;
                e.preventDefault(); // Prevent default browser zoom if possible
            }
        }, { passive: false });

        body.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                
                if (initialDistance > 0) {
                    const scale = currentDistance / initialDistance;
                    // Apply relative to initial zoom of this gesture
                    // We directly update currentZoom but might want to debounce render
                    const newZoom = initialZoom * scale;
                    // Clamp
                    this.currentZoom = Math.max(0.5, Math.min(4.0, newZoom));
                    this.updateZoom();
                }
                e.preventDefault();
            }
        }, { passive: false });

        body.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDistance = 0;
            }
        });
    }

    ensureReaderStructureBodyOnly() {
        this.refreshDomRefs();
        return this.body || null;
    }

    isMermaidErrorArtifactText(text) {
        const normalized = String(text || '').toLowerCase();
        if (!normalized) {
            return false;
        }
        return (
            normalized.includes('syntax error in text') ||
            normalized.includes('lexical error on line') ||
            normalized.includes('parse error on line') ||
            normalized.includes('mermaid version') ||
            normalized.includes('diagram syntax error')
        );
    }

    resolveMermaidErrorArtifactHost(node) {
        if (!node || typeof node.closest !== 'function') {
            return node;
        }
        return (
            node.closest('.mermaid-render-host-offscreen') ||
            node.closest('.mermaid') ||
            node.closest('.mermaid-render-failed') ||
            node.closest('.reader-block') ||
            node.closest('svg') ||
            node
        );
    }

    isProtectedMermaidSuppressionHost(host) {
        if (!host || host.nodeType !== Node.ELEMENT_NODE) {
            return true;
        }
        return (
            host === document.body ||
            host === document.documentElement ||
            host === document.head ||
            host.id === 'graph-wrapper' ||
            host.id === 'path-container' ||
            host.id === 'reading-window' ||
            host.id === 'reading-content-box' ||
            host.id === 'reading-body'
        );
    }

    collectMermaidErrorArtifactHosts(root) {
        const hosts = [];
        const hostSet = new Set();
        const candidates = [];
        if (!root) {
            return hosts;
        }
        if (
            root.nodeType === Node.ELEMENT_NODE &&
            root !== document.body &&
            root !== document.documentElement &&
            root !== document.head
        ) {
            candidates.push(root);
        }
        if (typeof root.querySelectorAll === 'function') {
            root.querySelectorAll('svg, .mermaid, div, section, article, aside, img, foreignObject').forEach((node) => {
                candidates.push(node);
            });
        }
        candidates.forEach((candidate) => {
            if (!candidate || candidate.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            const text = String(
                candidate.textContent ||
                candidate.getAttribute?.('alt') ||
                candidate.getAttribute?.('aria-label') ||
                ''
            ).trim();
            const hasErrorClass = Boolean(
                candidate.classList?.contains('error-icon') ||
                candidate.querySelector?.('.error-icon')
            );
            if (!hasErrorClass && !this.isMermaidErrorArtifactText(text)) {
                return;
            }
            const host = this.resolveMermaidErrorArtifactHost(candidate);
            if (!host || hostSet.has(host) || this.isProtectedMermaidSuppressionHost(host)) {
                return;
            }
            hostSet.add(host);
            hosts.push(host);
        });
        return hosts;
    }

    suppressLeakedMermaidErrorArtifacts(options = {}) {
        const root = options.root || document.body;
        const preserveNode = options.preserveNode || null;
        const hosts = this.collectMermaidErrorArtifactHosts(root);
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

    createOffscreenMermaidRenderHost(widthHint) {
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
        const mountRoot = (
            (this.window && this.window.ownerDocument && this.window.ownerDocument.body) ||
            document.body ||
            document.documentElement
        );
        if (!mountRoot || typeof mountRoot.appendChild !== 'function') {
            throw new Error('Reader Mermaid offscreen host mount root is unavailable.');
        }
        mountRoot.appendChild(host);
        return host;
    }

    async open(node) {
        this.ensureReaderStructure();
        const nodeLike = this.normalizeNodeInput(node);
        this.title.innerText = nodeLike.label;

        const mode = window.settingsManager ? window.settingsManager.get('reading', 'mode') : 'window';
        this.contentBox.className = `reading-box ${mode === 'fullscreen' ? 'fullscreen-mode' : 'window-mode'}`;
        this.window.style.display = 'flex';
        this.body.innerHTML = '<div style="padding: 20px; text-align: center; color: #aaa;">Loading content...</div>';

        if (!this._sessionId) this._sessionId = 0;
        this._sessionId += 1;
        const sessionId = this._sessionId;
        this.cleanupProtocolState();

        let resolvedTarget = nodeLike.__readerResolveTarget || null;
        let filePath = this.extractNodeFilePath(nodeLike);

        if (!filePath && nodeLike.id) {
            try {
                resolvedTarget = await this.resolveNodeTarget(nodeLike.id, '');
                filePath = resolvedTarget && resolvedTarget.filePath ? resolvedTarget.filePath : '';
            } catch (_error) {
                filePath = '';
            }
        }

        let rendered = false;
        if (filePath) {
            rendered = await this.tryRenderViaMarkdownProtocol(nodeLike, filePath, resolvedTarget, sessionId);
            if (rendered && this.isReaderBodyVisiblyEmpty()) {
                console.warn('[Reader] Markdown protocol path completed without visible content. Falling back to raw markdown render.', {
                    nodeId: nodeLike.id,
                    filePath,
                });
                rendered = false;
            }
        }
        if (!rendered) {
            const rawContent = await this.loadRawContentFallback(nodeLike);
            if (sessionId !== this._sessionId) return;
            await this.renderRawMarkdown(rawContent, this.extractNodeFilePath(nodeLike), sessionId);
        }

        this.isLocked = true;
        this.currentZoom = 0.5;
        this.updateLockState();
        this.updateZoom();
    }

    normalizeNodeInput(nodeLike) {
        if (typeof nodeLike === 'string') {
            nodeLike = {
                id: nodeLike,
                label: nodeLike,
                content: '',
                metadata: {},
            };
        }
        const safeNode = (nodeLike && typeof nodeLike === 'object') ? nodeLike : {};
        const nodeId = String(safeNode.id || safeNode.label || 'unknown-node');
        const hydratedNode = this.lookupNodeDataById(nodeId);
        const hydratedMetadata = (hydratedNode && hydratedNode.metadata && typeof hydratedNode.metadata === 'object')
            ? hydratedNode.metadata
            : {};
        const safeMetadata = (safeNode.metadata && typeof safeNode.metadata === 'object') ? safeNode.metadata : {};
        return {
            ...(hydratedNode && typeof hydratedNode === 'object' ? hydratedNode : {}),
            ...safeNode,
            id: nodeId,
            label: String(safeNode.label || hydratedNode?.label || nodeId),
            content: typeof safeNode.content === 'string' ? safeNode.content : '',
            metadata: {
                ...hydratedMetadata,
                ...safeMetadata,
            },
        };
    }

    lookupNodeDataById(nodeId) {
        const normalizedNodeId = String(nodeId || '').trim();
        if (!normalizedNodeId) {
            return null;
        }
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        if (!sourceData || !Array.isArray(sourceData.nodes)) {
            return null;
        }
        const matchedNode = sourceData.nodes.find((item) => (
            item &&
            (String(item.id || '').trim() === normalizedNodeId ||
             String(item.label || '').trim() === normalizedNodeId)
        ));
        return matchedNode && typeof matchedNode === 'object' ? matchedNode : null;
    }

    extractNodeFilePath(nodeLike) {
        if (!nodeLike || typeof nodeLike !== 'object') return '';
        const metadata = (nodeLike.metadata && typeof nodeLike.metadata === 'object') ? nodeLike.metadata : {};
        const fromMetadata = String(metadata.filepath || metadata.filePath || '').trim();
        if (fromMetadata) return fromMetadata;
        return String(nodeLike.filepath || nodeLike.filePath || '').trim();
    }

    isReaderBodyVisiblyEmpty() {
        if (!this.body) {
            return true;
        }
        return (
            this.body.children.length === 0 &&
            String(this.body.textContent || '').trim().length === 0
        );
    }

    getRuntimeBaseUrl() {
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.getBaseUrl === 'function') {
            return window.NoteConnectionRuntime.getBaseUrl();
        }
        return `${window.location.protocol}//${window.location.host}`;
    }

    buildRuntimeUrl(resourcePath) {
        const normalized = String(resourcePath || '').replace(/^\/+/, '');
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildUrl === 'function') {
            return window.NoteConnectionRuntime.buildUrl(normalized);
        }
        return new URL(normalized, `${this.getRuntimeBaseUrl()}/`).toString();
    }

    buildRuntimeFetchOptions(init) {
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildFetchOptions === 'function') {
            return window.NoteConnectionRuntime.buildFetchOptions(init);
        }
        return init;
    }

    getReadingProtocolConfig() {
        const defaultConfig = {
            markdownEngine: 'auto',
            chunkBlockSize: 36,
            prefetchBlocks: 8,
        };
        if (!window.settingsManager || typeof window.settingsManager.get !== 'function') {
            return defaultConfig;
        }
        return {
            markdownEngine: String(window.settingsManager.get('reading', 'markdownEngine') || defaultConfig.markdownEngine),
            chunkBlockSize: Number(window.settingsManager.get('reading', 'chunkBlockSize') || defaultConfig.chunkBlockSize),
            prefetchBlocks: Number(window.settingsManager.get('reading', 'prefetchBlocks') || defaultConfig.prefetchBlocks),
        };
    }

    async postMarkdownApi(endpoint, payload) {
        const response = await fetch(
            this.buildRuntimeUrl(endpoint),
            this.buildRuntimeFetchOptions({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload || {}),
            })
        );

        const body = await response.json().catch(() => null);
        if (!response.ok || !body || body.success !== true) {
            const message = body && body.error ? body.error : `Request failed (${endpoint} ${response.status})`;
            throw new Error(String(message));
        }
        return body;
    }

    async resolveNodeTarget(nodeId, currentFilePath) {
        return this.postMarkdownApi('/api/markdown/resolve-node', {
            nodeId,
            currentFilePath: currentFilePath || undefined,
        });
    }

    normalizeMermaidDefinition(source) {
        if (window.pathModules && window.pathModules.utils && typeof window.pathModules.utils.normalizeBridgeMermaidDefinition === 'function') {
            return window.pathModules.utils.normalizeBridgeMermaidDefinition(source);
        }
        return String(source || '').trim();
    }

    getMermaidDefinitionCandidates(source) {
        const candidates = [];
        const normalized = this.normalizeMermaidDefinition(source);
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

    async canParseMermaidDefinition(definition) {
        if (!window.mermaid || typeof mermaid.parse !== 'function') {
            return true;
        }
        try {
            await mermaid.parse(definition);
            return true;
        } catch (_error) {
            return false;
        }
    }

    isMermaidErrorSvgMarkup(markup) {
        const text = String(markup || '').toLowerCase();
        if (!text) {
            return false;
        }
        return (
            text.includes('syntax error in text') ||
            text.includes('lexical error on line') ||
            text.includes('parse error on line') ||
            text.includes('mermaid version') ||
            text.includes('class="error-icon"') ||
            text.includes('id="error-icon"')
        );
    }

    renderCompactMermaidFailure(wrapper, error, source) {
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

    async tryRenderViaMarkdownProtocol(nodeLike, filePath, resolvedTarget, sessionId) {
        const config = this.getReadingProtocolConfig();
        if (String(config.markdownEngine || 'auto').toLowerCase() === 'legacy') {
            return false;
        }

        try {
            this.cleanupProtocolState();
            const indexPayload = await this.postMarkdownApi('/api/markdown/index', {
                filePath,
            });
            if (sessionId !== this._sessionId) return true;

            let resolved = resolvedTarget;
            if (!resolved && nodeLike.id) {
                try {
                    resolved = await this.resolveNodeTarget(nodeLike.id, filePath);
                } catch (_error) {
                    resolved = null;
                }
            }

            const targetBlockId = resolved && Number.isFinite(Number(resolved.targetBlockId))
                ? Number(resolved.targetBlockId)
                : -1;
            const chunkSize = Math.max(1, Math.min(4096, Number(config.chunkBlockSize) || 36));
            this.body.innerHTML = '';
            const totalBlocks = Math.max(
                0,
                Number(indexPayload?.blocksSummary?.totalBlocks) || 0
            );
            const initialStartBlock = targetBlockId >= 0
                ? Math.max(0, targetBlockId - Math.floor(chunkSize / 2))
                : 0;

            const initialPayload = await this.postMarkdownApi('/api/markdown/chunk', {
                indexId: indexPayload.indexId,
                startBlock: initialStartBlock,
                blockCount: chunkSize,
            });
            if (sessionId !== this._sessionId) return true;

            const initialBlocks = Array.isArray(initialPayload.blocks) ? initialPayload.blocks : [];
            const initialRangeEnd = initialStartBlock + initialBlocks.length;
            await this.renderProtocolBlocks(initialBlocks, 'append', filePath, sessionId);
            if (sessionId !== this._sessionId) return true;

            this._protocolRenderState = {
                indexId: String(indexPayload.indexId || ''),
                filePath,
                chunkSize,
                totalBlocks,
                nextStartBlock: Number(initialPayload.nextStartBlock) || initialRangeEnd,
                prevStartBlock: initialStartBlock,
                hasMoreNext: initialPayload.hasMore === true,
                hasMorePrev: initialStartBlock > 0,
                loading: false,
                sessionId,
            };

            if (targetBlockId >= 0) {
                this.scrollToProtocolBlock(targetBlockId);
            } else if (this.body.firstElementChild) {
                this.body.firstElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            this.attachProtocolScrollLoader(filePath, sessionId);
            const prefetchBlocks = Math.max(0, Math.min(1024, Number(config.prefetchBlocks) || 0));
            if (prefetchBlocks > 0) {
                await this.prefetchProtocolChunks(prefetchBlocks, filePath, sessionId);
            }

            return true;
        } catch (error) {
            console.warn('[Reader] Markdown protocol rendering failed. Falling back to legacy markdown rendering.', error);
            return false;
        }
    }

    cleanupProtocolState() {
        this._protocolRenderState = null;
        if (this._protocolScrollHandler && this.body) {
            this.body.removeEventListener('scroll', this._protocolScrollHandler);
            this._protocolScrollHandler = null;
        }
    }

    async renderProtocolBlocks(blocks, position, currentFilePath, sessionId) {
        this.ensureReaderStructure();
        if (!Array.isArray(blocks) || blocks.length === 0) {
            return;
        }
        const fragment = document.createDocumentFragment();
        const insertedNodes = [];
        for (const block of blocks) {
            if (sessionId !== this._sessionId) return;
            const section = document.createElement('section');
            section.className = 'reader-block';
            section.dataset.blockId = String(block.id);
            const normalizedBlock = this.normalizeProtocolBlock(block);
            section.dataset.blockType = normalizedBlock.type;
            if (normalizedBlock.codeLanguage) {
                section.dataset.codeLanguage = normalizedBlock.codeLanguage;
            }
            const markdownText = this.transformWikiLinks(normalizedBlock.markdown);
            section.innerHTML = marked.parse(markdownText);
            fragment.appendChild(section);
            insertedNodes.push(section);
        }

        if (position === 'prepend' && this.body.firstChild) {
            this.body.insertBefore(fragment, this.body.firstChild);
        } else {
            this.body.appendChild(fragment);
        }

        for (const blockElement of insertedNodes) {
            this.bindWikiLinks(blockElement, currentFilePath);
            this.renderMathInContainer(blockElement);
            // Mermaid rendering is async and expensive; render block-by-block after insertion.
            await this.renderMermaidInContainer(blockElement);
        }
        this.enforceRenderedBlockBudget(position);
    }

    enforceRenderedBlockBudget(position) {
        const MAX_RENDERED_BLOCKS = 240;
        const state = this._protocolRenderState;
        const renderedBlocks = Array.from(this.body.querySelectorAll('.reader-block'));
        if (renderedBlocks.length <= MAX_RENDERED_BLOCKS) {
            return;
        }

        const overflow = renderedBlocks.length - MAX_RENDERED_BLOCKS;
        if (overflow <= 0) {
            return;
        }

        if (position === 'append') {
            let removedHeight = 0;
            for (let index = 0; index < overflow; index += 1) {
                const target = renderedBlocks[index];
                if (!target || !target.parentNode) continue;
                removedHeight += target.offsetHeight || 0;
                target.parentNode.removeChild(target);
            }
            this.body.scrollTop = Math.max(0, this.body.scrollTop - removedHeight);
        } else {
            for (let index = renderedBlocks.length - 1; index >= renderedBlocks.length - overflow; index -= 1) {
                const target = renderedBlocks[index];
                if (target && target.parentNode) {
                    target.parentNode.removeChild(target);
                }
            }
        }

        if (!state) {
            return;
        }

        const remainingBlocks = Array.from(this.body.querySelectorAll('.reader-block'));
        if (remainingBlocks.length === 0) {
            return;
        }
        const firstBlockId = Number(remainingBlocks[0].dataset.blockId);
        const lastBlockId = Number(remainingBlocks[remainingBlocks.length - 1].dataset.blockId);
        if (Number.isFinite(firstBlockId)) {
            state.prevStartBlock = Math.max(0, firstBlockId);
            state.hasMorePrev = state.prevStartBlock > 0;
        }
        if (Number.isFinite(lastBlockId)) {
            state.nextStartBlock = Math.max(0, lastBlockId + 1);
            state.hasMoreNext = state.nextStartBlock < Math.max(0, Number(state.totalBlocks) || 0);
        }
    }

    scrollToProtocolBlock(targetBlockId) {
        const selector = `.reader-block[data-block-id="${String(targetBlockId)}"]`;
        const targetElement = this.body.querySelector(selector);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    async loadNextProtocolChunk(currentFilePath, sessionId) {
        const state = this._protocolRenderState;
        if (!state || state.loading || !state.hasMoreNext || sessionId !== this._sessionId) {
            return;
        }
        state.loading = true;
        try {
            const payload = await this.postMarkdownApi('/api/markdown/chunk', {
                indexId: state.indexId,
                startBlock: state.nextStartBlock,
                blockCount: state.chunkSize,
            });
            if (sessionId !== this._sessionId) return;
            const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
            if (blocks.length === 0) {
                state.hasMoreNext = false;
                return;
            }
            await this.renderProtocolBlocks(blocks, 'append', currentFilePath, sessionId);
            if (sessionId !== this._sessionId) return;
            state.nextStartBlock = Number(payload.nextStartBlock) || (state.nextStartBlock + blocks.length);
            state.hasMoreNext = payload.hasMore === true;
        } finally {
            state.loading = false;
        }
    }

    async loadPrevProtocolChunk(currentFilePath, sessionId) {
        const state = this._protocolRenderState;
        if (!state || state.loading || !state.hasMorePrev || sessionId !== this._sessionId) {
            return;
        }
        const startBlock = Math.max(0, state.prevStartBlock - state.chunkSize);
        if (startBlock >= state.prevStartBlock) {
            state.hasMorePrev = false;
            return;
        }
        state.loading = true;
        const previousHeight = this.body.scrollHeight;
        try {
            const payload = await this.postMarkdownApi('/api/markdown/chunk', {
                indexId: state.indexId,
                startBlock,
                blockCount: state.prevStartBlock - startBlock,
            });
            if (sessionId !== this._sessionId) return;
            const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
            if (blocks.length === 0) {
                state.hasMorePrev = false;
                return;
            }
            await this.renderProtocolBlocks(blocks, 'prepend', currentFilePath, sessionId);
            if (sessionId !== this._sessionId) return;
            const nextHeight = this.body.scrollHeight;
            this.body.scrollTop += Math.max(0, nextHeight - previousHeight);
            state.prevStartBlock = startBlock;
            state.hasMorePrev = startBlock > 0;
        } finally {
            state.loading = false;
        }
    }

    async prefetchProtocolChunks(prefetchBlocks, currentFilePath, sessionId) {
        const state = this._protocolRenderState;
        if (!state || sessionId !== this._sessionId) {
            return;
        }
        const prefetchChunkCount = Math.max(
            0,
            Math.min(4, Math.ceil(prefetchBlocks / Math.max(1, state.chunkSize)))
        );
        for (let index = 0; index < prefetchChunkCount; index += 1) {
            if (!state.hasMoreNext || sessionId !== this._sessionId) {
                break;
            }
            await this.loadNextProtocolChunk(currentFilePath, sessionId);
        }
    }

    attachProtocolScrollLoader(currentFilePath, sessionId) {
        if (this._protocolScrollHandler) {
            this.body.removeEventListener('scroll', this._protocolScrollHandler);
            this._protocolScrollHandler = null;
        }
        this._protocolScrollHandler = async () => {
            const state = this._protocolRenderState;
            if (!state || state.sessionId !== sessionId || sessionId !== this._sessionId) {
                return;
            }
            const threshold = Math.max(120, Math.round(this.body.clientHeight * 0.45));
            const nearBottom = this.body.scrollTop + this.body.clientHeight >= this.body.scrollHeight - threshold;
            const nearTop = this.body.scrollTop <= threshold * 0.6;
            if (nearBottom) {
                await this.loadNextProtocolChunk(currentFilePath, sessionId);
            } else if (nearTop) {
                await this.loadPrevProtocolChunk(currentFilePath, sessionId);
            }
        };
        this.body.addEventListener('scroll', this._protocolScrollHandler, { passive: true });
    }

    autoFixInlineMermaidFenceAfterBlockMath(markdownText) {
        const source = String(markdownText || '');
        if (!source) {
            return source;
        }
        if (!source.includes('```mermaid') || !source.includes('$$')) {
            return source;
        }
        return source.replace(/\$\$[ \t]*```mermaid\b/g, '$$\n```mermaid');
    }

    normalizeProtocolBlock(block) {
        const source = this.autoFixInlineMermaidFenceAfterBlockMath(
            String(block && block.text ? block.text : '')
        );
        const type = String(block && block.type ? block.type : '').trim().toLowerCase();
        const normalizedType = type || 'paragraph';
        if (!source) {
            return {
                markdown: '',
                type: normalizedType,
                codeLanguage: '',
            };
        }

        if (!/(^|[_/-])code([_/-]|$)/i.test(normalizedType)) {
            return {
                markdown: source,
                type: normalizedType,
                codeLanguage: '',
            };
        }

        const trimmed = source.trimStart();
        const alreadyFenced = trimmed.startsWith('```') || trimmed.startsWith('~~~');
        const detectedCodeLanguage = this.detectProtocolCodeLanguage(block, source);
        if (alreadyFenced) {
            return {
                markdown: source,
                type: normalizedType,
                codeLanguage: detectedCodeLanguage,
            };
        }

        const fenceBody = source.replace(/\s+$/, '');
        const infoString = detectedCodeLanguage ? detectedCodeLanguage : '';
        const fencedMarkdown = infoString
            ? `\`\`\`${infoString}\n${fenceBody}\n\`\`\``
            : `\`\`\`\n${fenceBody}\n\`\`\``;

        return {
            markdown: fencedMarkdown,
            type: normalizedType,
            codeLanguage: detectedCodeLanguage,
        };
    }

    detectProtocolCodeLanguage(block, sourceText) {
        const rawType = String(block && block.type ? block.type : '').trim().toLowerCase();
        const typeLanguageMatch = rawType.match(/(?:^|[_/:.-])code[_/:.-]([a-z0-9_+-]+)$/i);
        if (typeLanguageMatch && typeLanguageMatch[1]) {
            return String(typeLanguageMatch[1]).toLowerCase();
        }
        if (rawType.includes('mermaid')) {
            return 'mermaid';
        }

        const firstNonEmptyLine = String(sourceText || '')
            .split(/\r?\n/)
            .map((line) => String(line || '').trim())
            .find((line) => line.length > 0) || '';
        if (!firstNonEmptyLine) {
            return '';
        }

        const mermaidHeaderPattern = /^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey(?:-beta)?|packet(?:-beta)?)\b/i;
        if (mermaidHeaderPattern.test(firstNonEmptyLine)) {
            return 'mermaid';
        }

        return '';
    }

    transformWikiLinks(markdownText) {
        const source = String(markdownText || '');
        return source.replace(/\[\[([^\]|#]+?)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_match, fileTarget, heading, alias) => {
            const target = heading ? `${fileTarget}#${heading}` : fileTarget;
            const label = alias || (heading ? `${fileTarget}#${heading}` : fileTarget);
            return `[${label}](wiki:${target})`;
        });
    }

    bindWikiLinks(container, currentFilePath) {
        const anchors = container.querySelectorAll('a[href^="wiki:"]');
        anchors.forEach((anchor) => {
            if (anchor.dataset && anchor.dataset.readerWikiBound === '1') {
                return;
            }
            if (anchor.dataset) {
                anchor.dataset.readerWikiBound = '1';
            }
            anchor.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const href = String(anchor.getAttribute('href') || '').trim();
                const wikiTarget = href.replace(/^wiki:/, '').trim();
                if (!wikiTarget) return;
                try {
                    const resolved = await this.postMarkdownApi('/api/markdown/resolve-wiki', {
                        wikiTarget,
                        currentFilePath,
                    });
                    await this.open({
                        id: wikiTarget,
                        label: this.deriveNodeLabelFromPath(resolved.filePath),
                        metadata: {
                            filepath: resolved.filePath,
                        },
                        __readerResolveTarget: resolved,
                    });
                } catch (error) {
                    console.error('[Reader] Wiki resolution failed:', error);
                }
            });
        });
    }

    deriveNodeLabelFromPath(filePath) {
        const normalized = String(filePath || '').replace(/\\/g, '/');
        const basename = normalized.split('/').pop() || 'Untitled';
        return basename.replace(/\.(md|markdown)$/i, '') || basename;
    }

    async loadRawContentFallback(nodeLike) {
        let rawContent = String(nodeLike.content || '');
        if (rawContent) return rawContent;

        const nodeFilePath = this.extractNodeFilePath(nodeLike);
        if (!nodeFilePath) return '*No content available.*';

        const runtimeCaps = (typeof window !== 'undefined' && window.__NC_RUNTIME_CAPS)
            ? window.__NC_RUNTIME_CAPS
            : null;
        const isCapacitorNativeRuntime = (() => {
            if (typeof window === 'undefined' || !window.Capacitor) {
                return false;
            }
            try {
                if (typeof window.Capacitor.getPlatform === 'function') {
                    const p = window.Capacitor.getPlatform();
                    return Boolean(p && p !== 'web');
                }
                if (typeof window.Capacitor.isNativePlatform === 'function') {
                    return Boolean(window.Capacitor.isNativePlatform());
                }
            } catch (_err) {
                return false;
            }
            return false;
        })();
        const runtimeSupportsContentApi = runtimeCaps
            ? runtimeCaps.supports_content_api !== false
            : !isCapacitorNativeRuntime;
        const canUseTauriContentCommand = Boolean(
            window.__TAURI__ &&
            window.__TAURI__.core &&
            typeof window.__TAURI__.core.invoke === 'function'
        );
        const getStorageProvider = () => {
            if (typeof window === 'undefined' || !window.NoteConnectionStorage || typeof window.NoteConnectionStorage.createProvider !== 'function') {
                throw new Error('Storage provider is unavailable. Ensure storage_provider.js is loaded before reader.js.');
            }
            return window.NoteConnectionStorage.createProvider({ runtimeCaps });
        };

        if (!runtimeSupportsContentApi) {
            const msg = window.i18n
                ? window.i18n.t('source.error.contentUnavailableMobile')
                : 'Content loading from local files is not available on this runtime.';
            return `*${msg}*`;
        }

        try {
            const storageProvider = getStorageProvider();
            const content = await storageProvider.readContent(nodeFilePath);
            if (typeof content === 'string' && content.length > 0) {
                return content;
            }
            if (canUseTauriContentCommand) {
                const fallback = await window.__TAURI__.core.invoke('read_node_content', {
                    filePath: nodeFilePath,
                });
                if (typeof fallback === 'string' && fallback.length > 0) {
                    return fallback;
                }
            }
            return '*No content available.*';
        } catch (error) {
            console.error('Content load error:', error);
            if (canUseTauriContentCommand) {
                try {
                    const fallback = await window.__TAURI__.core.invoke('read_node_content', {
                        filePath: nodeFilePath,
                    });
                    if (typeof fallback === 'string' && fallback.length > 0) {
                        return fallback;
                    }
                } catch (_tauriErr) {
                    // Fallback ignored.
                }
            }
            return `*Error loading content: ${String(error && error.message ? error.message : error)}*`;
        }
    }

    async renderRawMarkdown(rawContent, currentFilePath, sessionId) {
        this.ensureReaderStructure();
        const sanitizedMarkdown = this.autoFixInlineMermaidFenceAfterBlockMath(
            String(rawContent || '*No content available.*')
        );
        const markdownText = this.transformWikiLinks(sanitizedMarkdown);
        this.body.innerHTML = marked.parse(markdownText);
        this.bindWikiLinks(this.body, currentFilePath || this.getRuntimeBaseUrl());
        this.renderMathInContainer(this.body);
        await this.renderMermaidInContainer(this.body);
        if (sessionId !== this._sessionId) return;
        this.initMermaidZoom();
    }

    renderMathInContainer(container) {
        if (!window.renderMathInElement) {
            return;
        }
        renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
            ],
        });
    }

    async renderMermaidInContainer(container) {
        const hasFrontendMermaid = Boolean(window.mermaid);
        if (hasFrontendMermaid && !this._mermaidInitialized) {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'loose',
                htmlLabels: true,
            });
            this._mermaidInitialized = true;
        }

        this.suppressLeakedMermaidErrorArtifacts({ root: document.body });

        let mermaidBlocks = Array.from(container.querySelectorAll('pre code.language-mermaid, pre code.lang-mermaid'));
        if (mermaidBlocks.length === 0 && container.dataset && container.dataset.codeLanguage === 'mermaid') {
            const fallbackBlock = container.querySelector('pre code');
            if (fallbackBlock) {
                mermaidBlocks = [fallbackBlock];
            }
        }
        if (!this._mermaidRenderCounter) this._mermaidRenderCounter = 0;
        for (const block of mermaidBlocks) {
            const txt = document.createElement('textarea');
            txt.innerHTML = block.innerHTML;
            const candidateDefinitions = this.getMermaidDefinitionCandidates(txt.value);
            const graphDefinition = candidateDefinitions[0] || '';
            const parentPre = block.parentElement;
            if (!parentPre || !parentPre.parentNode) continue;

            this._mermaidRenderCounter += 1;
            const renderId = `reader-mermaid-${this._mermaidRenderCounter}`;
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid';
            parentPre.parentNode.replaceChild(wrapper, parentPre);
            let rendered = false;
            const renderErrors = [];
            let renderSource = '';
            const section = wrapper.closest('.reader-block');
            const blockId = section && section.dataset ? String(section.dataset.blockId || '').trim() : '';

            if (hasFrontendMermaid) {
                for (let candidateIndex = 0; candidateIndex < candidateDefinitions.length; candidateIndex += 1) {
                    const candidate = candidateDefinitions[candidateIndex];
                    const offscreenHost = this.createOffscreenMermaidRenderHost(
                        wrapper.clientWidth || parentPre.clientWidth || container.clientWidth || 960
                    );
                    try {
                        wrapper.innerHTML = '';
                        const renderedResult = await mermaid.render(`${renderId}-${candidateIndex}`, candidate, offscreenHost);
                        if (renderedResult && typeof renderedResult.svg === 'string' && renderedResult.svg.trim()) {
                            if (this.isMermaidErrorSvgMarkup(renderedResult.svg)) {
                                throw new Error('Mermaid frontend renderer returned an error SVG instead of a diagram.');
                            }
                            wrapper.innerHTML = renderedResult.svg;
                        }
                        if (/<svg[\s>]/i.test(String(wrapper.innerHTML || ''))) {
                            rendered = true;
                            renderSource = 'frontend-render';
                            this._mermaidRenderStats.frontendRender += 1;
                            break;
                        }
                    } catch (error) {
                        renderErrors.push(error);
                        wrapper.innerHTML = '';
                        this.suppressLeakedMermaidErrorArtifacts({
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
                    const canParse = await this.canParseMermaidDefinition(candidate);
                    if (!canParse) {
                        continue;
                    }
                    try {
                        wrapper.innerHTML = '';
                        wrapper.textContent = candidate;
                        await mermaid.run({ nodes: [wrapper] });
                        rendered = /<svg[\s>]/i.test(String(wrapper.innerHTML || '')) &&
                            !this.isMermaidErrorSvgMarkup(String(wrapper.innerHTML || ''));
                        if (rendered) {
                            renderSource = 'frontend-run';
                            this._mermaidRenderStats.frontendRun += 1;
                            break;
                        }
                    } catch (error) {
                        renderErrors.push(error);
                        wrapper.innerHTML = '';
                        this.suppressLeakedMermaidErrorArtifacts({
                            root: document.body,
                            preserveNode: wrapper,
                        });
                    }
                }
            }

            if (!rendered) {
                wrapper.innerHTML = '';
                const backendRendered = await this.renderMermaidViaBackend(graphDefinition);
                if (backendRendered && backendRendered.pngBase64) {
                    const altRenderer = backendRendered.renderer ? ` (${backendRendered.renderer})` : '';
                    wrapper.innerHTML = `<img class="mermaid-fallback-image" src="data:image/png;base64,${backendRendered.pngBase64}" alt="Mermaid diagram${altRenderer}" />`;
                    rendered = true;
                    renderSource = backendRendered.renderer ? `backend-${backendRendered.renderer}` : 'backend-png';
                    this._mermaidRenderStats.backendPng += 1;
                }
            }

            if (!rendered) {
                const lastError = renderErrors.length > 0 ? renderErrors[renderErrors.length - 1] : null;
                this.renderCompactMermaidFailure(wrapper, lastError, graphDefinition);
                if (lastError) {
                    console.error('Mermaid error:', lastError);
                }
                renderSource = 'failed';
                this._mermaidRenderStats.failed += 1;
            }

            this.suppressLeakedMermaidErrorArtifacts({
                root: document.body,
                preserveNode: wrapper,
            });

            if (renderSource) {
                wrapper.dataset.renderSource = renderSource;
                const blockSuffix = blockId ? ` block=${blockId}` : '';
                console.info(`[Reader] Mermaid render source: ${renderSource}${blockSuffix}`);
            }
        }
        if (mermaidBlocks.length > 0) {
            console.info(
                `[Reader] Mermaid render stats: frontend-render=${this._mermaidRenderStats.frontendRender}, frontend-run=${this._mermaidRenderStats.frontendRun}, backend-png=${this._mermaidRenderStats.backendPng}, failed=${this._mermaidRenderStats.failed}`
            );
            this.initMermaidZoom();
        }
    }

    async renderMermaidViaBackend(graphDefinition) {
        const source = this.normalizeMermaidDefinition(graphDefinition || '');
        if (!source) {
            return null;
        }
        try {
            const response = await fetch(
                this.buildRuntimeUrl('/api/render/mermaid'),
                this.buildRuntimeFetchOptions({
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
        } catch (error) {
            console.warn('[Reader] Mermaid backend fallback failed:', error);
            return null;
        }
    }

    initMermaidZoom() {
        if (!this.body) {
            return;
        }
        const mermaidDivs = this.body.querySelectorAll('.mermaid');
        mermaidDivs.forEach(div => {
            if (div.dataset && div.dataset.readerZoomBound === '1') {
                return;
            }
            div.style.cursor = 'zoom-in';
            if (div.dataset) {
                div.dataset.readerZoomBound = '1';
            }
            div.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent Reader close
                this.openMermaidOverlay(div.innerHTML);
            });
        });
    }

    openMermaidOverlay(svgContent) {
        const existingOverlay = document.getElementById('mermaid-zoom-overlay');
        if (existingOverlay && existingOverlay.parentNode) {
            existingOverlay.parentNode.removeChild(existingOverlay);
        }

        // Create Overlay
        const overlay = document.createElement('div');
        overlay.id = 'mermaid-zoom-overlay';
        overlay.className = 'mermaid-overlay';
        
        // Container for transform
        const container = document.createElement('div');
        container.className = 'mermaid-zoom-container';
        container.innerHTML = svgContent;
        container.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        overlay.appendChild(container);

        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.className = 'mermaid-close-btn';
        closeBtn.onclick = (event) => {
            event.stopPropagation();
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };
        overlay.appendChild(closeBtn);

        overlay.addEventListener('click', () => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });

        document.body.appendChild(overlay);

        // Pan/Zoom State
        let scale = 1;
        let panning = false;
        let pointX = 0;
        let pointY = 0;
        let startX = 0;
        let startY = 0;

        const setTransform = () => {
            container.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        };

        // Mouse Events
        overlay.onmousedown = (e) => {
            e.preventDefault();
            startPanning(e.clientX, e.clientY);
        };

        overlay.onmouseup = () => {
            panning = false;
        };

        overlay.onmousemove = (e) => {
            e.preventDefault();
            if (!panning) return;
            pan(e.clientX, e.clientY);
        };

        overlay.onwheel = (e) => {
            e.preventDefault();
            const xs = (e.clientX - pointX) / scale;
            const ys = (e.clientY - pointY) / scale;
            const delta = -e.deltaY;
            
            (delta > 0) ? (scale *= 1.2) : (scale /= 1.2);
            scale = Math.max(0.1, Math.min(scale, 10)); // Limit zoom

            pointX = e.clientX - xs * scale;
            pointY = e.clientY - ys * scale;

            setTransform();
        };

        // Touch Events
        let lastTouchDistance = 0;
        let lastTouchCenter = { x: 0, y: 0 };
        
        const getDistance = (touches) => {
            return Math.hypot(
                touches[0].pageX - touches[1].pageX,
                touches[0].pageY - touches[1].pageY
            );
        };

        const getCenter = (touches) => {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
        };

        overlay.ontouchstart = (e) => {
            if (e.touches.length === 1) {
                startPanning(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                lastTouchDistance = getDistance(e.touches);
                lastTouchCenter = getCenter(e.touches);
            }
        };

        overlay.ontouchend = () => {
            panning = false;
        };

        overlay.ontouchmove = (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && panning) {
                pan(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                const dist = getDistance(e.touches);
                const center = getCenter(e.touches);

                if (lastTouchDistance > 0) {
                    const zoomFactor = dist / lastTouchDistance;
                    const newScale = scale * zoomFactor;
                    
                    // Limit zoom
                    if (newScale >= 0.1 && newScale <= 10) {
                        // Calculate new translation to keep the center stationary
                        // Formula: newPos = center - (center - oldPos) * factor
                        pointX = center.x - (center.x - pointX) * zoomFactor;
                        pointY = center.y - (center.y - pointY) * zoomFactor;
                        scale = newScale;
                        setTransform();
                    }
                }
                lastTouchDistance = dist;
                lastTouchCenter = center;
            }
        };

        function startPanning(x, y) {
            startX = x - pointX;
            startY = y - pointY;
            panning = true;
        }

        function pan(x, y) {
            pointX = x - startX;
            pointY = y - startY;
            setTransform();
        }
    }

    close() {
        if (!this._sessionId) this._sessionId = 0;
        this._sessionId += 1;
        this.cleanupProtocolState();
        if (this.window) {
            this.window.style.display = 'none';
        }
    }

    toggleLock() {
        this.isLocked = !this.isLocked;
        this.updateLockState();
    }

    updateLockState() {
        this.ensureReaderStructure();
        const btn = document.getElementById('btn-reader-lock');
        const zoomBtns = document.querySelectorAll('#btn-reader-zoom-in, #btn-reader-zoom-out');
        
        if (this.isLocked) {
            this.body.classList.add('locked');
            this.body.classList.remove('unlocked');
            btn.innerText = "🔒";
            btn.title = "Locked: Sizing fixed";
            zoomBtns.forEach(b => b.disabled = true);
        } else {
            this.body.classList.add('unlocked');
            this.body.classList.remove('locked');
            btn.innerText = "🔓";
            btn.title = "Unlocked: Adjust size enabled";
            zoomBtns.forEach(b => b.disabled = false);
        }
    }

    zoom(delta) {
        if (this.isLocked) return;
        this.currentZoom = Math.max(0.5, Math.min(3.0, this.currentZoom + delta));
        this.updateZoom();
    }

    updateZoom() {
        this.ensureReaderStructure();
        this.body.style.fontSize = `${this.currentZoom}rem`;
        // Scale images if needed, but CSS 'resize' handles explicit image resizing in unlocked mode.
        // Font size scaling handles text content scaling.
    }
}

const reader = new Reader();
window.reader = reader;


