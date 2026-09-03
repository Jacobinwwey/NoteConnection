const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { copyProjectAssets } = require('./copy-assets');
const {
    LOOPBACK_HOST,
    getFreePort,
    makeTempProject,
    spawnRuntimeServer,
    stopRuntimeServer,
    waitForServer,
} = require('./verify-agent-workspace-runtime');

const DEFAULT_CDP_PORT = 9223;
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'output', 'browser-research');
const BROWSER_FORMULA_PROBE_DOCUMENT = [
    '# Water Glass',
    '',
    String.raw`Water glass is a bounded physical system whose temperature field follows $$\frac{\partial T}{\partial t}=\alpha\nabla^2 T$$, where $T$ is temperature and $\alpha$ is thermal diffusivity, and whose refractive relation is $n_1\sin(\theta_1)=n_2\sin(\theta_2)$ across the interface.`,
].join('\n');

function parsePositivePort(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function parseArgs(args) {
    const options = {
        cdpPort: parsePositivePort(process.env.NOTE_CONNECTION_BROWSER_CDP_PORT, DEFAULT_CDP_PORT),
        serverPort: 0,
        realWaterglass: process.env.NOTE_CONNECTION_BROWSER_REAL_WATERGLASS === '1',
        responseMode: 'slim',
        responseBudgetMode: 'adaptive',
    };
    for (let index = 0; index < args.length; index += 1) {
        const value = String(args[index] || '');
        if (value === '--cdp-port') {
            options.cdpPort = parsePositivePort(args[++index], options.cdpPort);
        } else if (value === '--server-port') {
            options.serverPort = parsePositivePort(args[++index], 0);
        } else if (value === '--real-waterglass') {
            options.realWaterglass = true;
        } else if (value === '--response-mode') {
            const responseMode = String(args[++index] || '').trim().toLowerCase();
            if (responseMode !== 'slim' && responseMode !== 'full') {
                throw new Error(`Unsupported response mode: ${responseMode}`);
            }
            options.responseMode = responseMode;
        } else if (value === '--response-budget') {
            const responseBudgetMode = String(args[++index] || '').trim().toLowerCase();
            if (responseBudgetMode !== 'adaptive' && responseBudgetMode !== 'unbounded') {
                throw new Error(`Unsupported response budget mode: ${responseBudgetMode}`);
            }
            options.responseBudgetMode = responseBudgetMode;
        } else {
            throw new Error(`Unknown argument: ${value}`);
        }
    }
    return options;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMathExpression(value) {
    return String(value || '').replace(/\s+/gu, '');
}

async function getJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.json();
}

class CdpConnection {
    constructor(webSocketUrl) {
        this.webSocketUrl = webSocketUrl;
        this.requestId = 0;
        this.pending = new Map();
        this.socket = null;
    }

    static async connect(cdpPort) {
        const metadata = await getJson(`http://127.0.0.1:${cdpPort}/json/version`);
        const endpoint = new URL(String(metadata.webSocketDebuggerUrl || ''));
        if (endpoint.hostname !== '127.0.0.1' || Number(endpoint.port) !== cdpPort) {
            throw new Error(`Unexpected CDP endpoint: ${metadata.webSocketDebuggerUrl}`);
        }
        const connection = new CdpConnection(metadata.webSocketDebuggerUrl);
        await connection.open();
        return connection;
    }

    open() {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(this.webSocketUrl, { perMessageDeflate: false });
            this.socket = socket;
            const timeout = setTimeout(() => reject(new Error('CDP connection timed out')), 10000);
            socket.once('open', () => {
                clearTimeout(timeout);
                resolve();
            });
            socket.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            socket.on('message', (raw) => {
                const message = JSON.parse(String(raw));
                if (!message.id) {
                    return;
                }
                const pending = this.pending.get(message.id);
                if (!pending) {
                    return;
                }
                clearTimeout(pending.timeout);
                this.pending.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(`${message.error.message} (${message.error.code})`));
                    return;
                }
                pending.resolve(message.result || {});
            });
            socket.on('close', () => {
                this.pending.forEach((pending) => {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error('CDP socket closed'));
                });
                this.pending.clear();
            });
        });
    }

    request(method, params = {}, sessionId) {
        const id = ++this.requestId;
        const payload = { id, method, params };
        if (sessionId) {
            payload.sessionId = sessionId;
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP request timed out: ${method}`));
            }, 60000);
            this.pending.set(id, { resolve, reject, timeout });
            this.socket.send(JSON.stringify(payload), (error) => {
                if (error) {
                    clearTimeout(timeout);
                    this.pending.delete(id);
                    reject(error);
                }
            });
        });
    }

    close() {
        this.socket?.close();
    }
}

async function evaluate(connection, sessionId, expression) {
    const result = await connection.request('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
    }, sessionId);
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    }
    return result.result?.value;
}

async function waitFor(connection, sessionId, predicate, description) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 30000) {
        if (await evaluate(connection, sessionId, predicate)) {
            return;
        }
        await delay(150);
    }
    throw new Error(`Timed out waiting for ${description}`);
}

function buildProbeExpression(options = {}) {
    const realWaterglass = options.realWaterglass === true;
    const query = realWaterglass ? '什么是waterglass?' : 'What is waterglass?';
    const answerLanguage = realWaterglass ? 'zh' : 'en';
    const responseMode = options.responseMode === 'full' ? 'full' : 'slim';
    const responseBudgetMode = options.responseBudgetMode === 'unbounded' ? 'unbounded' : 'adaptive';
    const documentContent = BROWSER_FORMULA_PROBE_DOCUMENT;
    const documentSetup = realWaterglass
        ? `
            const buildResponse = await fetch('/api/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: scopeId, relationRecomputeMode: 'none' }),
            });
            if (!buildResponse.ok) {
                throw new Error('real waterglass build failed: ' + buildResponse.status);
            }
            const buildPayload = await buildResponse.json();
            if (!buildPayload || buildPayload.success !== true) {
                throw new Error('real waterglass build was not successful: ' + JSON.stringify(buildPayload));
            }
            const restoreResponse = await fetch('/api/restore-cache?target=' + encodeURIComponent(scopeId) + '&relationRecomputeMode=none');
            if (!restoreResponse.ok) {
                throw new Error('real waterglass restore failed: ' + restoreResponse.status);
            }
            const restorePayload = await restoreResponse.json();
            if (!restorePayload || restorePayload.success !== true) {
                throw new Error('real waterglass restore was not successful: ' + JSON.stringify(restorePayload));
            }
            window.__NC_BROWSER_INGEST_RESULT = {
                mode: 'real-waterglass',
                build: buildPayload,
                restore: restorePayload,
            };
        `
        : `
            const ingest = await fetch('/api/knowledge/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incremental: true,
                    documents: [{
                        documentId,
                        sourcePath,
                        workspaceId: scopeId,
                        corpusId: scopeId,
                        language: 'en',
                        content: documentContent,
                    }],
                }),
            });
            if (!ingest.ok) {
                throw new Error('ingest failed: ' + ingest.status);
            }
            const ingestPayload = await ingest.json();
            window.__NC_BROWSER_INGEST_RESULT = ingestPayload;
            if (!ingestPayload || ingestPayload.success !== true) {
                throw new Error('ingest response was not successful: ' + JSON.stringify(ingestPayload));
            }
        `;
    return `(() => {
        const scopeId = 'waterglass';
        const documentId = 'browser_waterglass_formula_probe_doc';
        const sourcePath = 'Knowledge_Base/waterglass/water-glass-formula-quality.md';
        const documentContent = ${JSON.stringify(documentContent)};
        return (async () => {
            ${documentSetup}
            const runtimeBaseUrl = window.NoteConnectionRuntime
                && typeof window.NoteConnectionRuntime.getBaseUrl === 'function'
                ? window.NoteConnectionRuntime.getBaseUrl()
                : '';
            const providerFolders = window.NoteConnectionStorage
                && typeof window.NoteConnectionStorage.createProvider === 'function'
                ? await window.NoteConnectionStorage.createProvider({
                    runtimeCaps: window.__NC_RUNTIME_CAPS || {},
                }).listFolders()
                : [];
            const stateResponse = await fetch('/api/knowledge/state');
            const statePayload = await stateResponse.json();
            const storeResponse = await fetch('/api/knowledge/store-diagnostics');
            const storePayload = await storeResponse.json();
            const workspaceResponse = await fetch('/api/knowledge/workspace-readiness', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: ${JSON.stringify(query)},
                    scope: {
                        workspaceId: scopeId,
                        corpusId: scopeId,
                        sourcePathPrefixes: ['Knowledge_Base/' + scopeId],
                    },
                }),
            });
            const workspacePayload = await workspaceResponse.json();
            window.__NC_BROWSER_RUNTIME_DIAGNOSTICS = {
                runtimeBaseUrl,
                locationOrigin: window.location.origin,
                providerFolders,
                statePayload,
                storePayload,
                workspacePayload,
                ingestEndpoint: new URL('/api/knowledge/ingest', window.location.href).toString(),
                conversationEndpoint: new URL('/api/knowledge/conversation', window.location.href).toString(),
            };
            const folderSelect = document.getElementById('folder-select');
            const messageInput = document.getElementById('agent-workspace-chat-input');
            const sendButton = document.getElementById('btn-agent-workspace-send');
            const workspaceOpenButton = document.getElementById('btn-open-agent-workspace');
            if (!messageInput || !sendButton || !workspaceOpenButton) {
                throw new Error('agent workspace controls unavailable');
            }
            // The first-run language dialog is created asynchronously after
            // DOMContentLoaded and can consume the drawer click. Close it
            // before opening the workspace so the probe does not remain idle.
            const languageDialogStartedAt = Date.now();
            const languageModalWasPresent = Boolean(document.getElementById('language-selector-modal'));
            while (Date.now() - languageDialogStartedAt < 5000) {
                const languageModal = document.getElementById('language-selector-modal');
                if (!languageModal) {
                    break;
                }
                const languageConfirm = Array.from(languageModal.querySelectorAll('button'))
                    .find((button) => /^(?:Confirm|确认)$/u.test(String(button.textContent || '').trim()));
                if (languageConfirm) {
                    languageConfirm.click();
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            const languageDialogClosedAt = Date.now();
            while (document.getElementById('language-selector-modal') && Date.now() - languageDialogClosedAt < 5000) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            if (languageModalWasPresent && document.getElementById('language-selector-modal')) {
                throw new Error('first-run language dialog did not close');
            }
            workspaceOpenButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            if (!document.body.classList.contains('agent-workspace-open') && window.NoteConnectionAgentWorkspaceUi && typeof window.NoteConnectionAgentWorkspaceUi.open === 'function') {
                window.NoteConnectionAgentWorkspaceUi.open();
            }
            const workspaceOpenedAt = Date.now();
            while (!document.body.classList.contains('agent-workspace-open') && Date.now() - workspaceOpenedAt < 5000) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            if (!document.body.classList.contains('agent-workspace-open')) {
                throw new Error('agent workspace drawer did not open');
            }
            const scopeSelect = document.getElementById('agent-workspace-scope-select');
            const languageSelect = document.getElementById('agent-workspace-answer-language-select');
            const responseModeSelect = document.getElementById('agent-workspace-response-mode-select');
            const responseBudgetSelect = document.getElementById('agent-workspace-response-budget-select');
            if (!scopeSelect || !languageSelect || !responseModeSelect || !responseBudgetSelect) {
                throw new Error('agent workspace scoped controls unavailable');
            }
            const folderApiResponse = await fetch('/api/folders');
            const folderApiPayload = await folderApiResponse.json();
            if (!Array.isArray(folderApiPayload.folders) || !folderApiPayload.folders.includes(scopeId)) {
                throw new Error('folder API did not expose waterglass: ' + JSON.stringify(folderApiPayload));
            }
            const scopeHydrationStartedAt = Date.now();
            while (!Array.from(scopeSelect.options).some((candidate) => candidate.value === scopeId)
                && Date.now() - scopeHydrationStartedAt < 10000) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            if (!Array.from(scopeSelect.options).some((candidate) => candidate.value === scopeId)) {
                throw new Error('agent workspace scope selector did not hydrate waterglass');
            }
            // Keep the UI interaction real, but publish the same active-target
            // contract used by the application before the selector redraws.
            window.__NC_ACTIVE_SOURCE_TARGET = {
                target: scopeId,
                source: 'agent-answer-browser-probe',
                scope: {
                    workspaceId: scopeId,
                    corpusId: scopeId,
                    sourcePathPrefixes: ['Knowledge_Base/' + scopeId],
                },
            };
            localStorage.setItem('nc_last_target', scopeId);
            if (folderSelect && folderSelect.options
                && !Array.from(folderSelect.options).some((candidate) => candidate.value === scopeId)) {
                throw new Error('global folder selector did not hydrate waterglass');
            }
            scopeSelect.value = scopeId;
            scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            languageSelect.value = ${JSON.stringify(answerLanguage)};
            languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
            responseModeSelect.value = ${JSON.stringify(responseMode)};
            responseModeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            responseBudgetSelect.value = ${JSON.stringify(responseBudgetMode)};
            responseBudgetSelect.dispatchEvent(new Event('change', { bubbles: true }));
            messageInput.value = ${JSON.stringify(query)};
            window.__NC_BROWSER_PRE_SEND = {
                runtime: window.__NC_SIDECAR_RUNTIME || null,
                runtimeBridge: window.NoteConnectionRuntime
                    && typeof window.NoteConnectionRuntime.getRuntimeConfig === 'function'
                    ? window.NoteConnectionRuntime.getRuntimeConfig()
                    : null,
                activeTarget: window.__NC_ACTIVE_SOURCE_TARGET || null,
                folderValue: folderSelect && folderSelect.value,
                scopeValue: scopeSelect.value,
                responseMode: responseModeSelect.value,
                responseBudgetMode: responseBudgetSelect.value,
                scopeOptions: Array.from(scopeSelect.options).map((option) => option.value),
            };
            sendButton.click();
            return true;
        })();
    })()`;
}

function injectRuntimeBootstrapConfig(frontendDir, config) {
    const indexPath = path.join(frontendDir, 'index.html');
    const bootstrapFilename = 'runtime_bootstrap.js';
    const bootstrapTag = `<script src="${bootstrapFilename}"></script>`;
    const html = fs.readFileSync(indexPath, 'utf8');
    const runtimePayload = {
        host: LOOPBACK_HOST,
        port: config.serverPort,
        bridgePort: config.bridgePort,
        baseUrl: `http://${LOOPBACK_HOST}:${config.serverPort}`,
        bridgeWsUrl: `ws://${LOOPBACK_HOST}:${config.bridgePort}`,
        authToken: '',
    };
    fs.writeFileSync(
        path.join(frontendDir, bootstrapFilename),
        `window.__NC_SIDECAR_RUNTIME = ${JSON.stringify(runtimePayload)};\n`,
        'utf8'
    );
    if (!html.includes(bootstrapTag)) {
        fs.writeFileSync(
            indexPath,
            html.replace('</head>', `${bootstrapTag}</head>`),
            'utf8'
        );
    }
}

async function runVerification(options) {
    const fixture = makeTempProject('noteconnection-agent-answer-browser');
    // /api/folders is filesystem-backed. Keep the scope directory present in
    // both fixture and real-corpus modes so the async source-manager refresh
    // cannot overwrite the intended scope with ALL_FOLDERS.
    const waterglassRoot = path.join(fixture.kbRoot, 'waterglass');
    if (options.realWaterglass) {
        fs.cpSync(path.join(REPO_ROOT, 'Knowledge_Base', 'waterglass'), waterglassRoot, {
            recursive: true,
        });
    } else {
        fs.mkdirSync(waterglassRoot, { recursive: true });
        fs.writeFileSync(
            path.join(waterglassRoot, 'water-glass-formula-quality.md'),
            BROWSER_FORMULA_PROBE_DOCUMENT,
            'utf8'
        );
    }
    const serverPort = options.serverPort || await getFreePort();
    const bridgePort = await getFreePort();
    copyProjectAssets({
        src: path.join(REPO_ROOT, 'src', 'frontend'),
        dest: fixture.frontendDir,
        logger: { log() {}, warn() {}, error() {} },
    });
    injectRuntimeBootstrapConfig(fixture.frontendDir, { serverPort, bridgePort });
    const runtime = spawnRuntimeServer({
        port: serverPort,
        bridgePort,
        projectRoot: fixture.projectRoot,
        frontendDir: fixture.frontendDir,
        runtimeDataDir: fixture.runtimeDataDir,
        kbRoot: fixture.kbRoot,
        logger: console,
    });
    let connection = null;
    let targetId = '';
    try {
        await waitForServer(`http://${LOOPBACK_HOST}:${serverPort}/`, 30000);
        connection = await CdpConnection.connect(options.cdpPort);
        const created = await connection.request('Target.createTarget', { url: 'about:blank' });
        targetId = String(created.targetId || '');
        const attached = await connection.request('Target.attachToTarget', { targetId, flatten: true });
        const sessionId = String(attached.sessionId || '');
        await connection.request('Page.enable', {}, sessionId);
        await connection.request('Runtime.enable', {}, sessionId);
        await connection.request('Page.navigate', { url: `http://${LOOPBACK_HOST}:${serverPort}/` }, sessionId);
        await waitFor(
            connection,
            sessionId,
            `Boolean(document.querySelector('#agent-workspace-shell') && window.NoteConnectionAgentWorkspace)`,
            'agent workspace bootstrap'
        );
        try {
            await evaluate(connection, sessionId, buildProbeExpression(options));
        } catch (error) {
            throw new Error(`probe setup failed: ${error.message || String(error)}`);
        }
        try {
            await waitFor(
                connection,
                sessionId,
                `Boolean(document.querySelector('.agent-chat-structured-answer-card [data-structured-answer-section="directAnswer"]'))`,
                'grounded answer card'
            );
        } catch (error) {
            const diagnostic = await evaluate(connection, sessionId, `JSON.stringify((() => ({
                title: document.title,
                activeTarget: window.__NC_ACTIVE_SOURCE_TARGET || null,
                scopeOptions: Array.from(document.querySelectorAll('#agent-workspace-scope-select option')).map((option) => ({ value: option.value, label: option.textContent })),
                apiState: document.querySelector('#agent-workspace-api-status')?.getAttribute('data-api-state') || '',
                apiText: document.querySelector('#agent-workspace-api-status')?.textContent || '',
                runtime: window.__NC_SIDECAR_RUNTIME || null,
                ingestResult: window.__NC_BROWSER_INGEST_RESULT || null,
                runtimeDiagnostics: window.__NC_BROWSER_RUNTIME_DIAGNOSTICS || null,
                folderSelectOptions: Array.from(document.querySelectorAll('#folder-select option')).map((option) => ({ value: option.value, label: option.textContent })),
                messages: document.querySelector('#agent-workspace-chat-messages')?.innerText || '',
                bodyText: document.body?.innerText?.slice(-5000) || '',
                lastResult: window.__NC_LAST_AGENT_CONVERSATION_RESULT || null,
                workspaceOpen: document.body?.classList.contains('agent-workspace-open') || false,
            }))())`);
            const diagnosticPath = path.join(OUTPUT_DIR, 'agent-answer-browser-failure-latest.json');
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
            fs.writeFileSync(diagnosticPath, `${JSON.stringify({
                browser: JSON.parse(String(diagnostic || '{}')),
                runtimeLogs: runtime.getLogs(),
            }, null, 2)}\n`, 'utf8');
            throw new Error(`${error.message || String(error)}; diagnostic=${diagnosticPath}`);
        }
        await waitFor(
            connection,
            sessionId,
            `document.querySelector('#agent-workspace-api-status')?.getAttribute('data-api-state') !== 'loading'`,
            'conversation completion'
        );
        await delay(300);
        const reportJson = await evaluate(connection, sessionId, `JSON.stringify((() => {
            const card = document.querySelector('.agent-chat-structured-answer-card');
            const direct = card?.querySelector('[data-structured-answer-section="directAnswer"]');
            const toggle = card?.querySelector('[data-structured-answer-next-actions-toggle]');
            const hiddenSections = ['overviewMarkdown', 'explanationMarkdown', 'evidenceMarkdown']
                .filter((section) => card?.querySelector('[data-structured-answer-section="' + section + '"]'));
            return {
                title: card?.querySelector('.agent-chat-inline-card-title')?.textContent?.trim() || '',
                directText: direct?.textContent?.replace(/\\s+/g, ' ').trim() || '',
                directHtml: direct?.innerHTML || '',
                katexCount: direct?.querySelectorAll('.katex').length || 0,
                texAnnotations: Array.from(direct?.querySelectorAll('.katex annotation[encoding="application/x-tex"]') || [])
                    .map((annotation) => annotation.textContent || ''),
                rawMathDelimiterCount: (direct?.textContent?.match(/(?<!\\\\)\\$/g) || []).length,
                hiddenSections,
                visibleKnowledgeRunCount: card?.querySelectorAll('.agent-chat-knowledge-run-card').length || 0,
                visibleKnowledgeActions: (card?.textContent || '').includes('Knowledge Actions'),
                nextActionsExpanded: toggle?.getAttribute('aria-expanded') || '',
                nextActionsPanelPresent: Boolean(card?.querySelector('[data-structured-answer-next-actions-panel]')),
                apiState: document.querySelector('#agent-workspace-api-status')?.getAttribute('data-api-state') || '',
                ingestResult: window.__NC_BROWSER_INGEST_RESULT || null,
                runtimeDiagnostics: window.__NC_BROWSER_RUNTIME_DIAGNOSTICS || null,
                preSend: window.__NC_BROWSER_PRE_SEND || null,
                lastResultAnswer: window.__NC_LAST_AGENT_CONVERSATION_RESULT?.answer || '',
                lastResultTrace: window.__NC_LAST_AGENT_CONVERSATION_RESULT?.trace || null,
                lastResultBudget: window.__NC_LAST_AGENT_CONVERSATION_RESULT?.responseBudget || null,
                publicPlanStatements: window.__NC_LAST_AGENT_CONVERSATION_RESULT?.answerReleaseReview?.publicGraphAnswerPlan?.claims
                    ?.map((claim) => claim.statement) || [],
                auditPlanStatements: window.__NC_LAST_AGENT_CONVERSATION_RESULT?.answerReleaseReview?.auditGraphAnswerPlan?.claims
                    ?.map((claim) => claim.statement) || [],
                ragFragments: window.__NC_LAST_AGENT_CONVERSATION_RESULT?.trace?.ragContextPack?.fragments
                    ?.map((fragment) => ({ role: fragment.role, text: fragment.text, truncated: fragment.truncated })) || [],
            };
        })())`);
        const report = JSON.parse(String(reportJson || '{}'));
        await evaluate(connection, sessionId, `document.querySelector('.agent-chat-structured-answer-card [data-structured-answer-section="directAnswer"]')?.scrollIntoView({ block: 'center', inline: 'nearest' })`);
        await delay(150);
        const screenshot = await connection.request('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
        }, sessionId);
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        const responseModeSuffix = options.responseMode === 'full'
            ? `-full-${options.responseBudgetMode === 'unbounded' ? 'unbounded' : 'adaptive'}`
            : '';
        const screenshotPath = path.join(
            OUTPUT_DIR,
            options.realWaterglass
                ? `agent-answer-real-waterglass${responseModeSuffix}-latest.png`
                : `agent-answer-formula-render${responseModeSuffix}-latest.png`
        );
        fs.writeFileSync(screenshotPath, Buffer.from(String(screenshot.data || ''), 'base64'));
        const reportPath = path.join(
            OUTPUT_DIR,
            options.realWaterglass
                ? `agent-answer-real-waterglass${responseModeSuffix}-latest.json`
                : `agent-answer-formula-render${responseModeSuffix}-latest.json`
        );
        fs.writeFileSync(reportPath, `${JSON.stringify({
            requestedUrl: `http://${LOOPBACK_HOST}:${serverPort}/`,
            verifiedCdpPort: options.cdpPort,
            capturedAt: new Date().toISOString(),
            realWaterglass: options.realWaterglass === true,
            responseMode: options.responseMode,
            responseBudgetMode: options.responseBudgetMode,
            sourceDocumentCount: options.realWaterglass ? 214 : 1,
            ...report,
            screenshotPath,
        }, null, 2)}\n`, 'utf8');
        const failures = [];
        const expectedTitle = options.realWaterglass ? '可信回答' : 'Grounded Answer';
        if (report.title !== expectedTitle) failures.push(`title=${report.title}`);
        if (report.katexCount < 2) failures.push(`katexCount=${report.katexCount}`);
        const normalizedTexAnnotations = report.texAnnotations.map(normalizeMathExpression);
        if (!normalizedTexAnnotations.some((value) => value.includes(normalizeMathExpression('\\frac{\\partial T}{\\partial t}=\\alpha\\nabla^2 T')))) {
            failures.push('thermalTexAnnotationMissing');
        }
        if (!normalizedTexAnnotations.some((value) => value.includes('n_1\\sin(\\theta_1)=n_2\\sin(\\theta_2)'))) {
            failures.push('opticalTexAnnotationMissing');
        }
        if (report.rawMathDelimiterCount !== 0) failures.push(`rawMathDelimiterCount=${report.rawMathDelimiterCount}`);
        if (report.hiddenSections.length > 0) failures.push(`hiddenSections=${report.hiddenSections.join(',')}`);
        if (report.visibleKnowledgeRunCount !== 0) failures.push(`visibleKnowledgeRunCount=${report.visibleKnowledgeRunCount}`);
        if (report.visibleKnowledgeActions) failures.push('visibleKnowledgeActions=true');
        if (report.nextActionsExpanded !== 'false') failures.push(`nextActionsExpanded=${report.nextActionsExpanded}`);
        if (report.nextActionsPanelPresent) failures.push('nextActionsPanelPresent=true');
        if (report.directText.length < 140) failures.push(`directTextLength=${report.directText.length}`);
        if (options.realWaterglass && options.responseMode === 'slim') {
            if ((report.lastResultAnswer.match(/此处的“水杯”被定义为/gu) || []).length !== 1) {
                failures.push('duplicatePublicDefinition');
            }
            if (/库朗数|特征速度|网格尺寸/u.test(report.lastResultAnswer)) {
                failures.push('unrelatedCflGlossaryReleased');
            }
        } else if (options.responseMode === 'slim') {
            if ((report.lastResultAnswer.match(/Water glass is a bounded physical system/gu) || []).length !== 1) {
                failures.push('duplicatePublicDefinition');
            }
            if (/\bacross\s+t\s+Water glass\b/u.test(report.lastResultAnswer)) {
                failures.push('truncatedDefinitionPrefix');
            }
        }
        if (options.responseMode === 'full') {
            const actualBudgetMode = String(report.lastResultBudget?.mode || '');
            if (actualBudgetMode !== (options.responseBudgetMode === 'unbounded' ? 'unbounded' : 'adaptive')) {
                failures.push(`responseBudgetMode=${actualBudgetMode}`);
            }
            if (options.realWaterglass) {
                if (report.directText.length < 1000) failures.push(`fullDirectTextLength=${report.directText.length}`);
                if (!/热力学|Thermal/u.test(report.lastResultAnswer)) failures.push('fullThermalSectionMissing');
                if (!/光学|Optical|斯涅尔|Snell/u.test(report.lastResultAnswer)) failures.push('fullOpticalSectionMissing');
                if (!/静水压力|威布尔|性能特征|技术规格/u.test(report.lastResultAnswer)) {
                    failures.push('fullWaterglassTechnicalSectionsMissing');
                }
            }
            if (/遵从您的指示|仅基于标题|所有推理过程|最终输出|```mermaid/iu.test(report.lastResultAnswer)) {
                failures.push('fullInternalPromptOrMermaidLeakage');
            }
        }
        if (!report.lastResultAnswer || !report.lastResultAnswer.includes('\\frac{\\partial T}{\\partial t}')) {
            failures.push('releasedThermalFormulaMissing');
        }
        if (failures.length > 0) {
            throw new Error(`Agent answer browser verification failed: ${failures.join(', ')}`);
        }
        return { report, reportPath, screenshotPath };
    } finally {
        if (connection && targetId) {
            await connection.request('Target.closeTarget', { targetId }).catch(() => undefined);
        }
        connection?.close();
        await stopRuntimeServer(runtime.child);
        fixture.cleanup();
    }
}

async function main() {
    const outcome = await runVerification(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({
        success: true,
        reportPath: outcome.reportPath,
        screenshotPath: outcome.screenshotPath,
        katexCount: outcome.report.katexCount,
        directTextLength: outcome.report.directText.length,
    }, null, 2));
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`[agent-answer-browser] FAIL ${error.message || String(error)}`);
        process.exitCode = 1;
    });
}

module.exports = { runVerification };
