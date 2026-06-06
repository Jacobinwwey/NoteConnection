#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_SERVER_ENTRY = path.join(REPO_ROOT, 'dist', 'src', 'server.js');
const DIST_FRONTEND_DIR = path.join(REPO_ROOT, 'dist', 'src', 'frontend');
const OUTPUT_ROOT = path.join(REPO_ROOT, 'output', 'verification', 'foundation-ann-runtime');
const LOOPBACK_HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 30000;
const SHUTDOWN_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_SCALE = Number.isFinite(Number(process.env.NOTE_CONNECTION_FOUNDATION_ANN_TIMEOUT_SCALE))
    ? Math.max(0.5, Number(process.env.NOTE_CONNECTION_FOUNDATION_ANN_TIMEOUT_SCALE))
    : 1;
const RELEASE_THRESHOLD_DEFAULTS = Object.freeze({
    maxStartupP95Ms: 18000,
    maxIngestP95Ms: 90000,
    maxDiagnosticsP95Ms: 9000,
    maxQueryP95Ms: 12000,
    maxQueryMaxMs: 20000,
    minExpectedRecall: 1,
    packagedModeMultiplier: 1.5,
});
const WORKLOAD_PROFILES = {
    smoke: {
        profileId: 'smoke',
        documentCount: 40,
        minSyncedAtomCount: 40,
        genericQuery: 'retrieval mastery diagnostics semantic transfer',
        genericTopK: 5,
        minGenericResultCount: 5,
    },
    medium: {
        profileId: 'medium',
        documentCount: 140,
        minSyncedAtomCount: 140,
        genericQuery: 'retrieval mastery diagnostics semantic transfer',
        genericTopK: 8,
        minGenericResultCount: 8,
    },
    heavy: {
        profileId: 'heavy',
        documentCount: 260,
        minSyncedAtomCount: 260,
        genericQuery: 'retrieval mastery diagnostics semantic transfer',
        genericTopK: 10,
        minGenericResultCount: 10,
    },
};

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function parseOptionalPositiveNumber(rawValue) {
    if (rawValue === null || typeof rawValue === 'undefined' || rawValue === '') {
        return null;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function roundMetric(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return 0;
    }
    return Number(numeric.toFixed(4));
}

function computePercentile(sortedSamples, percentile) {
    if (sortedSamples.length === 0) {
        return 0;
    }
    if (sortedSamples.length === 1) {
        return sortedSamples[0];
    }
    const clampedPercentile = Math.min(1, Math.max(0, percentile));
    const rank = (sortedSamples.length - 1) * clampedPercentile;
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) {
        return sortedSamples[lower];
    }
    const weight = rank - lower;
    return (sortedSamples[lower] * (1 - weight)) + (sortedSamples[upper] * weight);
}

function summarizeDurations(samplesMs) {
    const sanitized = samplesMs
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((left, right) => left - right);
    if (sanitized.length === 0) {
        return {
            count: 0,
            minMs: 0,
            p50Ms: 0,
            p95Ms: 0,
            p99Ms: 0,
            maxMs: 0,
            meanMs: 0,
        };
    }
    const sum = sanitized.reduce((accumulator, value) => accumulator + value, 0);
    return {
        count: sanitized.length,
        minMs: roundMetric(sanitized[0]),
        p50Ms: roundMetric(computePercentile(sanitized, 0.5)),
        p95Ms: roundMetric(computePercentile(sanitized, 0.95)),
        p99Ms: roundMetric(computePercentile(sanitized, 0.99)),
        maxMs: roundMetric(sanitized[sanitized.length - 1]),
        meanMs: roundMetric(sum / sanitized.length),
    };
}

function buildReleaseThresholds() {
    return {
        maxStartupP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_ANN_MAX_STARTUP_P95_MS)
            ?? RELEASE_THRESHOLD_DEFAULTS.maxStartupP95Ms,
        maxIngestP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_ANN_MAX_INGEST_P95_MS)
            ?? RELEASE_THRESHOLD_DEFAULTS.maxIngestP95Ms,
        maxDiagnosticsP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_ANN_MAX_DIAGNOSTICS_P95_MS)
            ?? RELEASE_THRESHOLD_DEFAULTS.maxDiagnosticsP95Ms,
        maxQueryP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_ANN_MAX_QUERY_P95_MS)
            ?? RELEASE_THRESHOLD_DEFAULTS.maxQueryP95Ms,
        maxQueryMaxMs: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_ANN_MAX_QUERY_MAX_MS)
            ?? RELEASE_THRESHOLD_DEFAULTS.maxQueryMaxMs,
        minExpectedRecall: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_ANN_MIN_EXPECTED_RECALL)
            ?? RELEASE_THRESHOLD_DEFAULTS.minExpectedRecall,
        packagedModeMultiplier: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_ANN_RELEASE_PACKAGED_MODE_MULTIPLIER)
            ?? RELEASE_THRESHOLD_DEFAULTS.packagedModeMultiplier,
    };
}

function parseCliOptions(argv) {
    const options = {
        suiteKind: 'single',
        profileKeys: ['smoke'],
        releaseGates: String(process.env.NOTE_CONNECTION_FOUNDATION_ANN_RELEASE_GATES || '').trim() === '1',
        releaseThresholds: buildReleaseThresholds(),
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--matrix') {
            options.suiteKind = 'matrix';
            options.profileKeys = ['smoke', 'medium', 'heavy'];
            continue;
        }
        if (arg === '--release-gates') {
            options.releaseGates = true;
            continue;
        }
        if (arg === '--heavy') {
            options.suiteKind = 'single';
            options.profileKeys = ['heavy'];
            continue;
        }
        if (arg === '--medium') {
            options.suiteKind = 'single';
            options.profileKeys = ['medium'];
            continue;
        }
        if (arg === '--smoke') {
            options.suiteKind = 'single';
            options.profileKeys = ['smoke'];
        }
    }

    return options;
}

function resolveHostSidecarBinaryPath() {
    const binDir = path.join(REPO_ROOT, 'src-tauri', 'bin');
    if (process.platform === 'win32' && process.arch === 'x64') {
        return path.join(binDir, 'server-x86_64-pc-windows-msvc.exe');
    }
    if (process.platform === 'linux' && process.arch === 'x64') {
        return path.join(binDir, 'server-x86_64-unknown-linux-gnu');
    }
    if (process.platform === 'darwin' && process.arch === 'arm64') {
        return path.join(binDir, 'server-aarch64-apple-darwin');
    }
    if (process.platform === 'darwin' && process.arch === 'x64') {
        return path.join(binDir, 'server-x86_64-apple-darwin');
    }
    return '';
}

function createTempProject(prefix) {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
    const projectRoot = path.join(root, 'project');
    const runtimeDataDir = path.join(projectRoot, 'runtime_data');
    const kbRoot = path.join(projectRoot, 'Knowledge_Base');
    const configDir = path.join(projectRoot, 'config');
    const configPath = path.join(configDir, 'app_config.toml');
    fs.mkdirSync(runtimeDataDir, { recursive: true });
    fs.mkdirSync(kbRoot, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
        configPath,
        [
            `knowledge_base_path = "${kbRoot.replace(/\\/g, '\\\\')}"`,
            'user_language = "en"',
            '',
            '[notemd]',
            'developer_mode = true',
            'language = "en"',
            '',
        ].join('\n'),
        'utf8'
    );
    return {
        root,
        projectRoot,
        runtimeDataDir,
        kbRoot,
        configPath,
        cleanup() {
            fs.rmSync(root, { recursive: true, force: true });
        },
    };
}

function createReferenceAnnState() {
    return {
        syncRequestCount: 0,
        selectRequestCount: 0,
        syncedIndexSignature: '',
        syncedAtomCount: 0,
        representationVersion: '',
        embeddingModelId: '',
        embeddingDimension: 0,
        tokenToAtomIds: new Map(),
        signatureBuckets: new Map(),
    };
}

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const probe = http.createServer();
        probe.once('error', reject);
        probe.listen(0, LOOPBACK_HOST, () => {
            const address = probe.address();
            if (!address || typeof address !== 'object') {
                probe.close(() => reject(new Error('Failed to allocate a free port.')));
                return;
            }
            probe.close((closeError) => {
                if (closeError) {
                    reject(closeError);
                    return;
                }
                resolve(address.port);
            });
        });
    });
}

function computeRequestTimeoutMs(context = {}) {
    const requestPath = String(context.requestPath || '').trim();
    const workloadProfile = context.workloadProfile || { documentCount: 1 };
    const documentCount = Math.max(1, Math.floor(Number(workloadProfile.documentCount || 1)));
    const mode = String(context.mode || '').trim();
    let timeoutMs = 6000;

    if (requestPath === '/api/knowledge/ingest') {
        timeoutMs = Math.max(20000, documentCount * 450);
    } else if (requestPath === '/api/knowledge/query') {
        timeoutMs = Math.max(8000, documentCount * 60);
    } else if (requestPath === '/api/knowledge/query-backend-diagnostics') {
        timeoutMs = Math.max(6000, documentCount * 30);
    }

    if (mode === 'packaged_sidecar') {
        timeoutMs = Math.round(timeoutMs * 2);
    }

    return Math.max(2000, Math.round(timeoutMs * REQUEST_TIMEOUT_SCALE));
}

function requestJson(port, method, requestPath, body, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
        const startedAtMs = Date.now();
        const payload = typeof body === 'undefined'
            ? null
            : Buffer.from(JSON.stringify(body), 'utf8');
        const req = http.request(
            {
                host: LOOPBACK_HOST,
                port,
                path: requestPath,
                method,
                headers: payload
                    ? {
                        'Content-Type': 'application/json',
                        'Content-Length': String(payload.length),
                    }
                    : undefined,
            },
            (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    text += chunk;
                });
                res.on('end', () => {
                    let parsed = text;
                    if (text.length > 0) {
                        try {
                            parsed = JSON.parse(text);
                        } catch {
                            parsed = text;
                        }
                    }
                    resolve({
                        status: res.statusCode || 0,
                        body: parsed,
                        durationMs: Date.now() - startedAtMs,
                    });
                });
            }
        );

        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Timed out requesting ${requestPath}`));
        });
        req.once('error', reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

function normalizeArrayMapEntries(rawValue) {
    const normalized = new Map();
    if (!Array.isArray(rawValue)) {
        return normalized;
    }
    rawValue.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length < 2) {
            return;
        }
        const key = String(entry[0] || '').trim().toLowerCase();
        if (!key) {
            return;
        }
        const values = Array.isArray(entry[1])
            ? entry[1].map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        normalized.set(key, values);
    });
    return normalized;
}

async function shutdownServerInstance(instance) {
    if (!instance) {
        return;
    }
    if (typeof instance.closeAllConnections === 'function') {
        instance.closeAllConnections();
    }
    await new Promise((resolve, reject) => {
        instance.close((err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

async function startReferenceAnnService(port, state) {
    const server = http.createServer(async (req, res) => {
        const method = String(req.method || 'GET').toUpperCase();
        const requestPath = String(req.url || '').split('?')[0];
        const requestId = String(req.headers['x-request-id'] || '').trim() || 'reference-ann-service';
        res.setHeader('x-request-id', requestId);

        if (method === 'POST' && requestPath === '/sync-index') {
            const payload = await readJsonBody(req);
            state.syncRequestCount += 1;
            state.syncedIndexSignature = String(payload.indexSignature || '').trim();
            state.syncedAtomCount = Math.max(0, Math.floor(Number(payload.atomCount || 0)));
            state.representationVersion = String(payload.representationVersion || '').trim();
            state.embeddingModelId = String(payload.embeddingModelId || '').trim();
            state.embeddingDimension = Math.max(0, Math.floor(Number(payload.embeddingDimension || 0)));
            state.tokenToAtomIds = normalizeArrayMapEntries(payload.tokenToAtomIds);
            state.signatureBuckets = normalizeArrayMapEntries(payload.signatureBuckets);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                synced: true,
                atomCount: state.syncedAtomCount,
                indexSignature: state.syncedIndexSignature,
                representationVersion: state.representationVersion,
                embeddingModelId: state.embeddingModelId,
                embeddingDimension: state.embeddingDimension,
                representationStatus: 'aligned',
            }));
            return;
        }

        if (method === 'POST' && requestPath === '/select-candidates') {
            const payload = await readJsonBody(req);
            state.selectRequestCount += 1;
            if (!state.syncedIndexSignature) {
                res.writeHead(409, {
                    'Content-Type': 'application/json',
                    'x-error-code': 'index_not_synced',
                });
                res.end(JSON.stringify({ error: 'index_not_synced' }));
                return;
            }

            const queryTokens = Array.isArray(payload.queryTokens)
                ? payload.queryTokens.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
                : [];
            const topK = Math.max(1, Math.floor(Number(payload.topK || 1)));
            const targetCandidateCount = Math.max(64, topK * 32);
            const candidateAtomIds = new Set();

            queryTokens.forEach((token) => {
                const postingList = state.tokenToAtomIds.get(token) || [];
                postingList.forEach((atomId) => {
                    if (candidateAtomIds.size >= targetCandidateCount) {
                        return;
                    }
                    candidateAtomIds.add(atomId);
                });
            });

            const used = candidateAtomIds.size > 0;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                used,
                mode: used ? 'token_prefilter' : 'full_scan',
                candidateAtomIds: used ? Array.from(candidateAtomIds) : [],
                representationVersion: state.representationVersion,
                embeddingModelId: state.embeddingModelId,
                embeddingDimension: state.embeddingDimension,
                indexSignature: state.syncedIndexSignature,
                representationStatus: 'aligned',
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, LOOPBACK_HOST, () => {
            resolve();
        });
    });
    return server;
}

async function waitForServer(port, timeoutMs, context = {}) {
    const startedAt = Date.now();
    let lastError = null;
    let probeCount = 0;
    while ((Date.now() - startedAt) < timeoutMs) {
        probeCount += 1;
        try {
            const response = await requestJson(
                port,
                'GET',
                '/api/knowledge/query-backend-diagnostics',
                undefined,
                computeRequestTimeoutMs({
                    ...context,
                    requestPath: '/api/knowledge/query-backend-diagnostics',
                })
            );
            if (response.status >= 200 && response.status < 500) {
                return {
                    startupDurationMs: Date.now() - startedAt,
                    probeCount,
                };
            }
            lastError = new Error(`Unexpected status ${response.status} while waiting for server.`);
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw lastError || new Error(`Timed out waiting for runtime server on port ${port}.`);
}

function buildRuntimeEnv(context) {
    return {
        ...process.env,
        NOTE_CONNECTION_PROJECT_ROOT: context.fixture.projectRoot,
        NOTE_CONNECTION_FRONTEND_DIR: DIST_FRONTEND_DIR,
        NOTE_CONNECTION_RUNTIME_DATA_DIR: context.fixture.runtimeDataDir,
        NOTE_CONNECTION_KB_ROOT: context.fixture.kbRoot,
        NOTE_CONNECTION_CONFIG_PATH: context.fixture.configPath,
        NOTE_CONNECTION_PORT: String(context.port),
        NOTE_CONNECTION_BRIDGE_PORT: String(context.bridgePort),
        PORT: String(context.port),
        NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK: '0',
        NOTE_CONNECTION_AUTH_TOKEN: '',
        NOTE_CONNECTION_GPU: '',
        NOTE_CONNECTION_STATIC: '',
        NOTE_CONNECTION_QUERY_BACKEND: 'local_vector',
        NOTE_CONNECTION_QUERY_VECTOR_ANN_PREFILTER: 'true',
        NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_PROVIDER: 'external_http',
        NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT: `http://${LOOPBACK_HOST}:${context.connectorPort}`,
        NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE: 'fail_closed',
        NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT: 'true',
        npm_config_path: '',
        npm_config_gpu: '',
        npm_config_workers: '',
        npm_config_static: '',
    };
}

function spawnRuntime(mode, context) {
    const bufferedLogs = [];
    const capture = (chunk) => {
        const line = String(chunk || '');
        bufferedLogs.push(line);
        if (bufferedLogs.length > 200) {
            bufferedLogs.shift();
        }
    };

    let child;
    if (mode === 'dist_node_runtime') {
        assertCondition(
            fs.existsSync(DIST_SERVER_ENTRY),
            `Missing dist runtime entry: ${DIST_SERVER_ENTRY}. Run npm run build first.`
        );
        child = spawn(process.execPath, [DIST_SERVER_ENTRY], {
            cwd: REPO_ROOT,
            env: buildRuntimeEnv(context),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
    } else if (mode === 'packaged_sidecar') {
        const binaryPath = resolveHostSidecarBinaryPath();
        assertCondition(binaryPath, `Unsupported host platform/arch: ${process.platform}/${process.arch}`);
        assertCondition(
            fs.existsSync(binaryPath),
            `Missing host sidecar binary: ${binaryPath}. Run npm run build:sidecar first.`
        );
        child = spawn(binaryPath, [], {
            cwd: REPO_ROOT,
            env: buildRuntimeEnv(context),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
    } else {
        throw new Error(`Unsupported runtime verification mode: ${mode}`);
    }

    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', (error) => {
        capture(`[spawn-error] ${String(error && error.stack ? error.stack : error)}`);
    });

    return {
        child,
        getLogs() {
            return bufferedLogs.join('');
        },
    };
}

function waitForExit(child, timeoutMs) {
    if (!child || child.exitCode !== null) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            reject(new Error(`Timed out waiting for process ${child.pid} to exit.`));
        }, timeoutMs);

        child.once('exit', () => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve();
        });
    });
}

function forceKillProcessTree(pid) {
    if (!Number.isFinite(pid) || pid <= 0) {
        return;
    }
    if (process.platform === 'win32') {
        spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
        });
        return;
    }
    try {
        process.kill(pid, 'SIGKILL');
    } catch {
    }
}

async function stopRuntime(runtime) {
    if (!runtime || !runtime.child || runtime.child.exitCode !== null || runtime.child.killed) {
        return;
    }
    try {
        runtime.child.kill('SIGTERM');
    } catch {
    }
    try {
        await waitForExit(runtime.child, SHUTDOWN_TIMEOUT_MS);
    } catch {
        forceKillProcessTree(runtime.child.pid);
        await waitForExit(runtime.child, SHUTDOWN_TIMEOUT_MS);
    }
}

async function assertPortFree(port) {
    const probe = http.createServer();
    await new Promise((resolve, reject) => {
        probe.once('error', reject);
        probe.listen(port, LOOPBACK_HOST, resolve);
    });
    await new Promise((resolve, reject) => {
        probe.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

function buildAnnDocumentId(mode, workloadProfile, index) {
    return `doc_external_ann_${mode}_${workloadProfile.profileId}_${index}`;
}

function buildWorkloadDocuments(mode, workloadProfile, kbRoot) {
    return Array.from({ length: workloadProfile.documentCount }, (_unused, index) => {
        const clusterId = index % 9;
        const bandId = Math.floor(index / 30);
        const documentId = buildAnnDocumentId(mode, workloadProfile, index);
        return {
            documentId,
            sourcePath: path.join(kbRoot, `${documentId}.md`),
            language: 'en',
            content: [
                `# Retrieval Topic ${index}`,
                '',
                `retrieval mastery diagnostics semantic transfer cluster${clusterId} band${bandId}`,
                `focus branch retrieval diagnostics depth mastery branch retrieval similarity depth`,
                `anchorkey${index} external http ann runtime proof ${workloadProfile.profileId}`,
            ].join('\n\n'),
        };
    });
}

function buildWorkloadQueries(mode, workloadProfile) {
    const targetIndexes = [0, Math.floor(workloadProfile.documentCount / 2), workloadProfile.documentCount - 1];
    return [
        {
            phaseId: 'generic',
            request: {
                query: workloadProfile.genericQuery,
                topK: workloadProfile.genericTopK,
            },
            expectedDocumentId: '',
            minItemCount: workloadProfile.minGenericResultCount,
        },
        ...targetIndexes.map((index) => ({
            phaseId: `anchor_${index}`,
            request: {
                query: `anchorkey${index}`,
                topK: 3,
            },
            expectedDocumentId: buildAnnDocumentId(mode, workloadProfile, index),
            minItemCount: 1,
        })),
    ];
}

function assertQueryResponse(response, mode, phase, options) {
    assertCondition(response.status === 200, `[${mode}] ${phase}: query status=${response.status}`);
    const body = response.body || {};
    const items = body && body.result && Array.isArray(body.result.items)
        ? body.result.items
        : [];
    assertCondition(body.success === true, `[${mode}] ${phase}: query success!=true`);
    const minItemCount = Math.max(1, Number(options && options.minItemCount || 1));
    assertCondition(items.length >= minItemCount, `[${mode}] ${phase}: query returned ${items.length} items, expected >= ${minItemCount}`);
    const expectedDocumentId = String(options && options.expectedDocumentId || '').trim();
    let targetMatched = false;
    if (expectedDocumentId) {
        const matched = items.find((item) => String(item && item.atom && item.atom.documentId || '') === expectedDocumentId);
        targetMatched = Boolean(matched);
        assertCondition(Boolean(matched), `[${mode}] ${phase}: expected documentId ${expectedDocumentId} not found in query results`);
    }
    return {
        itemCount: items.length,
        expectedDocumentId,
        matchedDocumentId: targetMatched ? expectedDocumentId : '',
        targetMatched,
    };
}

function assertDiagnostics(response, mode, phase, workloadProfile, minRequestCount) {
    assertCondition(response.status === 200, `[${mode}] ${phase}: query-backend-diagnostics status=${response.status}`);
    const body = response.body || {};
    const diagnostics = body.queryBackendDiagnostics || {};
    const runtime = diagnostics.runtime || {};
    const vectorIndex = runtime.vectorIndex || {};
    const acceleration = vectorIndex.acceleration || {};

    assertCondition(body.success === true, `[${mode}] ${phase}: query-backend-diagnostics success!=true`);
    assertCondition(String(diagnostics.configuredBackend || '') === 'local_vector', `[${mode}] ${phase}: configuredBackend=${diagnostics.configuredBackend}`);
    assertCondition(runtime.ready === true, `[${mode}] ${phase}: runtime.ready=${runtime.ready}`);
    assertCondition(String(runtime.backendId || '') === 'local-vector-v1', `[${mode}] ${phase}: runtime.backendId=${runtime.backendId}`);
    assertCondition(String(vectorIndex.status || '') === 'ready', `[${mode}] ${phase}: vectorIndex.status=${vectorIndex.status}`);
    assertCondition(vectorIndex.persisted === true, `[${mode}] ${phase}: vectorIndex.persisted=${vectorIndex.persisted}`);
    assertCondition(String(acceleration.mode || '') === 'ann_prefilter', `[${mode}] ${phase}: acceleration.mode=${acceleration.mode}`);
    assertCondition(
        String(acceleration.lastSelectionMode || '') === 'token_prefilter'
        || String(acceleration.lastSelectionMode || '') === 'token_signature_prefilter',
        `[${mode}] ${phase}: acceleration.lastSelectionMode=${acceleration.lastSelectionMode}`
    );
    assertCondition(Number(acceleration.lastCandidateCount || 0) > 0, `[${mode}] ${phase}: acceleration.lastCandidateCount=${acceleration.lastCandidateCount}`);
    assertCondition(String(acceleration.adapterId || '') === 'external-http-vector-acceleration-v1', `[${mode}] ${phase}: acceleration.adapterId=${acceleration.adapterId}`);
    assertCondition(String(acceleration.failureMode || '') === 'fail_closed', `[${mode}] ${phase}: acceleration.failureMode=${acceleration.failureMode}`);
    assertCondition(acceleration.representationStrictMode === true, `[${mode}] ${phase}: acceleration.representationStrictMode=${acceleration.representationStrictMode}`);
    assertCondition(String(acceleration.healthStatus || '') === 'ready', `[${mode}] ${phase}: acceleration.healthStatus=${acceleration.healthStatus}`);
    assertCondition(String(acceleration.indexSyncStatus || '') === 'ready', `[${mode}] ${phase}: acceleration.indexSyncStatus=${acceleration.indexSyncStatus}`);
    assertCondition(Number(acceleration.syncRequestCount || 0) >= 1, `[${mode}] ${phase}: acceleration.syncRequestCount=${acceleration.syncRequestCount}`);
    assertCondition(Number(acceleration.syncSuccessCount || 0) >= 1, `[${mode}] ${phase}: acceleration.syncSuccessCount=${acceleration.syncSuccessCount}`);
    assertCondition(Number(acceleration.requestCount || 0) >= minRequestCount, `[${mode}] ${phase}: acceleration.requestCount=${acceleration.requestCount}, expected >= ${minRequestCount}`);
    assertCondition(String(acceleration.syncedIndexSignature || '').trim().length > 0, `[${mode}] ${phase}: acceleration.syncedIndexSignature missing`);
    assertCondition(Number(acceleration.syncedAtomCount || 0) >= workloadProfile.minSyncedAtomCount, `[${mode}] ${phase}: acceleration.syncedAtomCount=${acceleration.syncedAtomCount}, expected >= ${workloadProfile.minSyncedAtomCount}`);
    assertCondition(String(acceleration.representationStatus || '') === 'aligned', `[${mode}] ${phase}: acceleration.representationStatus=${acceleration.representationStatus}`);
    assertCondition(String(acceleration.lastRequestId || '').includes('nc-vector-accel-'), `[${mode}] ${phase}: acceleration.lastRequestId=${acceleration.lastRequestId}`);
    assertCondition(Number(acceleration.embeddingDimension || 0) > 0, `[${mode}] ${phase}: acceleration.embeddingDimension=${acceleration.embeddingDimension}`);

    return {
        configuredBackend: String(diagnostics.configuredBackend || ''),
        backendId: String(runtime.backendId || ''),
        runtimeReady: Boolean(runtime.ready),
        vectorIndexStatus: String(vectorIndex.status || ''),
        vectorIndexPersisted: Boolean(vectorIndex.persisted),
        accelerationMode: String(acceleration.mode || ''),
        lastSelectionMode: String(acceleration.lastSelectionMode || ''),
        lastCandidateCount: Math.max(0, Math.floor(Number(acceleration.lastCandidateCount || 0))),
        healthStatus: String(acceleration.healthStatus || ''),
        indexSyncStatus: String(acceleration.indexSyncStatus || ''),
        syncRequestCount: Math.max(0, Math.floor(Number(acceleration.syncRequestCount || 0))),
        syncSuccessCount: Math.max(0, Math.floor(Number(acceleration.syncSuccessCount || 0))),
        requestCount: Math.max(0, Math.floor(Number(acceleration.requestCount || 0))),
        syncedIndexSignature: String(acceleration.syncedIndexSignature || ''),
        syncedAtomCount: Math.max(0, Math.floor(Number(acceleration.syncedAtomCount || 0))),
        representationStatus: String(acceleration.representationStatus || ''),
        lastRequestId: String(acceleration.lastRequestId || ''),
    };
}

function assertAnnState(state, mode, phase, workloadProfile, minSelectCount) {
    assertCondition(state.syncRequestCount >= 1, `[${mode}] ${phase}: annState.syncRequestCount=${state.syncRequestCount}`);
    assertCondition(state.selectRequestCount >= minSelectCount, `[${mode}] ${phase}: annState.selectRequestCount=${state.selectRequestCount}, expected >= ${minSelectCount}`);
    assertCondition(state.syncedAtomCount >= workloadProfile.minSyncedAtomCount, `[${mode}] ${phase}: annState.syncedAtomCount=${state.syncedAtomCount}, expected >= ${workloadProfile.minSyncedAtomCount}`);
    assertCondition(String(state.syncedIndexSignature || '').trim().length > 0, `[${mode}] ${phase}: annState.syncedIndexSignature missing`);
    assertCondition(state.tokenToAtomIds.size > 0, `[${mode}] ${phase}: annState.tokenToAtomIds empty`);
    return {
        syncRequestCount: state.syncRequestCount,
        selectRequestCount: state.selectRequestCount,
        syncedAtomCount: state.syncedAtomCount,
        syncedIndexSignature: state.syncedIndexSignature,
        tokenPostingCount: state.tokenToAtomIds.size,
    };
}

async function runQueries(port, mode, phase, workloadProfile, workloadQueries) {
    const queryResults = [];
    for (const queryPlan of workloadQueries) {
        const queryResponse = await requestJson(
            port,
            'POST',
            '/api/knowledge/query',
            queryPlan.request,
            computeRequestTimeoutMs({
                requestPath: '/api/knowledge/query',
                workloadProfile,
                mode,
            })
        );
        queryResults.push({
            phaseId: queryPlan.phaseId,
            ...assertQueryResponse(queryResponse, mode, `${phase}:${queryPlan.phaseId}`, {
                expectedDocumentId: queryPlan.expectedDocumentId,
                minItemCount: queryPlan.minItemCount,
            }),
            durationMs: roundMetric(queryResponse.durationMs),
        });
    }
    return queryResults;
}

function collectScenarioPerformance(result) {
    const firstPass = result.firstPass || {};
    const restartPass = result.restartPass || {};
    const startupSamples = [
        Number(firstPass.startupDurationMs || 0),
        Number(restartPass.startupDurationMs || 0),
    ];
    const ingestSamples = [Number(firstPass.ingestDurationMs || 0)];
    const diagnosticsSamples = [
        Number(firstPass.diagnostics && firstPass.diagnostics.durationMs || 0),
        Number(restartPass.diagnostics && restartPass.diagnostics.durationMs || 0),
    ];
    const querySamples = [
        ...(Array.isArray(firstPass.queries) ? firstPass.queries : []).map((query) => Number(query.durationMs || 0)),
        ...(Array.isArray(restartPass.queries) ? restartPass.queries : []).map((query) => Number(query.durationMs || 0)),
    ];

    return {
        startupDurationMs: summarizeDurations(startupSamples),
        ingestDurationMs: summarizeDurations(ingestSamples),
        diagnosticsDurationMs: summarizeDurations(diagnosticsSamples),
        queryDurationMs: summarizeDurations(querySamples),
    };
}

function computeExpectedRecall(result) {
    const queryResults = [
        ...(Array.isArray(result.firstPass && result.firstPass.queries) ? result.firstPass.queries : []),
        ...(Array.isArray(result.restartPass && result.restartPass.queries) ? result.restartPass.queries : []),
    ];
    const expectedQueries = queryResults.filter((query) => String(query.expectedDocumentId || '').trim().length > 0);
    const matchedQueries = expectedQueries.filter((query) => query.targetMatched === true);
    const expectedQueryCount = expectedQueries.length;
    const matchedQueryCount = matchedQueries.length;
    return {
        expectedQueryCount,
        matchedQueryCount,
        ratio: expectedQueryCount > 0
            ? roundMetric(matchedQueryCount / expectedQueryCount)
            : 0,
    };
}

function resolveReleaseThreshold(releaseThresholds, key, mode) {
    const raw = Number(releaseThresholds[key] || 0);
    const multiplier = mode === 'packaged_sidecar'
        ? Number(releaseThresholds.packagedModeMultiplier || 1)
        : 1;
    return roundMetric(raw * multiplier);
}

function createReleaseGateResult(gateId, label, observedValue, requiredValue, comparison, sampleCount) {
    const observed = roundMetric(observedValue);
    const required = roundMetric(requiredValue);
    return {
        gateId,
        label,
        comparison,
        passed: sampleCount > 0 && (comparison === 'gte' ? observed >= required : observed <= required),
        observed,
        required,
        sampleCount,
    };
}

function buildReleaseGateSummary(mode, workloadProfile, performance, expectedRecall, releaseThresholds) {
    const gates = [
        createReleaseGateResult(
            'startup_p95',
            'Startup p95 must stay within release budget.',
            performance.startupDurationMs.p95Ms,
            resolveReleaseThreshold(releaseThresholds, 'maxStartupP95Ms', mode),
            'lte',
            performance.startupDurationMs.count
        ),
        createReleaseGateResult(
            'ingest_p95',
            'Ingest p95 must stay within release budget.',
            performance.ingestDurationMs.p95Ms,
            resolveReleaseThreshold(releaseThresholds, 'maxIngestP95Ms', mode),
            'lte',
            performance.ingestDurationMs.count
        ),
        createReleaseGateResult(
            'diagnostics_p95',
            'Query-backend diagnostics p95 must stay within release budget.',
            performance.diagnosticsDurationMs.p95Ms,
            resolveReleaseThreshold(releaseThresholds, 'maxDiagnosticsP95Ms', mode),
            'lte',
            performance.diagnosticsDurationMs.count
        ),
        createReleaseGateResult(
            'query_p95',
            'Query p95 must stay within release budget.',
            performance.queryDurationMs.p95Ms,
            resolveReleaseThreshold(releaseThresholds, 'maxQueryP95Ms', mode),
            'lte',
            performance.queryDurationMs.count
        ),
        createReleaseGateResult(
            'query_max',
            'Query max must stay within release budget.',
            performance.queryDurationMs.maxMs,
            resolveReleaseThreshold(releaseThresholds, 'maxQueryMaxMs', mode),
            'lte',
            performance.queryDurationMs.count
        ),
        createReleaseGateResult(
            'expected_recall',
            'Targeted ANN queries must retrieve their expected documents.',
            expectedRecall.ratio,
            releaseThresholds.minExpectedRecall,
            'gte',
            expectedRecall.expectedQueryCount
        ),
    ];

    return {
        profileId: workloadProfile.profileId,
        thresholds: {
            maxStartupP95Ms: resolveReleaseThreshold(releaseThresholds, 'maxStartupP95Ms', mode),
            maxIngestP95Ms: resolveReleaseThreshold(releaseThresholds, 'maxIngestP95Ms', mode),
            maxDiagnosticsP95Ms: resolveReleaseThreshold(releaseThresholds, 'maxDiagnosticsP95Ms', mode),
            maxQueryP95Ms: resolveReleaseThreshold(releaseThresholds, 'maxQueryP95Ms', mode),
            maxQueryMaxMs: resolveReleaseThreshold(releaseThresholds, 'maxQueryMaxMs', mode),
            minExpectedRecall: roundMetric(releaseThresholds.minExpectedRecall),
        },
        metrics: performance,
        expectedRecall,
        gates,
        pass: gates.every((gate) => gate.passed),
    };
}

function writeStructuredReport(report) {
    ensureDir(OUTPUT_ROOT);
    const timestamp = toFilenameTimestamp(report.verifiedAt);
    const latestPath = path.join(OUTPUT_ROOT, 'foundation-ann-runtime-report-latest.json');
    const datedPath = path.join(OUTPUT_ROOT, `foundation-ann-runtime-report-${timestamp}.json`);
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(latestPath, serialized, 'utf8');
    fs.writeFileSync(datedPath, serialized, 'utf8');
    return { latestPath, datedPath };
}

async function runScenario(mode, workloadProfile, cliOptions) {
    const fixture = createTempProject(`noteconnection-foundation-ann-${mode}`);
    const state = createReferenceAnnState();
    const connectorPort = await getFreePort();
    const annService = await startReferenceAnnService(connectorPort, state);
    const workloadQueries = buildWorkloadQueries(mode, workloadProfile);
    const documents = buildWorkloadDocuments(mode, workloadProfile, fixture.kbRoot);
    const ingestPayload = {
        incremental: true,
        documents,
    };

    let runtime = null;
    let port = await getFreePort();
    let bridgePort = await getFreePort();
    const result = {
        mode,
        profileId: workloadProfile.profileId,
        ingestedDocuments: documents.length,
        firstPass: null,
        restartPass: null,
        performance: null,
        releaseGates: null,
    };

    try {
        runtime = spawnRuntime(mode, { port, bridgePort, connectorPort, fixture });
        const firstStartup = await waitForServer(port, STARTUP_TIMEOUT_MS, { workloadProfile, mode });

        const ingestResponse = await requestJson(
            port,
            'POST',
            '/api/knowledge/ingest',
            ingestPayload,
            computeRequestTimeoutMs({
                requestPath: '/api/knowledge/ingest',
                workloadProfile,
                mode,
            })
        );
        assertCondition(ingestResponse.status === 200, `[${mode}] ingest status=${ingestResponse.status}`);
        assertCondition(ingestResponse.body && ingestResponse.body.success === true, `[${mode}] ingest success!=true`);

        const firstQueries = await runQueries(port, mode, 'first_pass', workloadProfile, workloadQueries);
        const firstDiagnosticsResponse = await requestJson(
            port,
            'GET',
            '/api/knowledge/query-backend-diagnostics',
            undefined,
            computeRequestTimeoutMs({
                requestPath: '/api/knowledge/query-backend-diagnostics',
                workloadProfile,
                mode,
            })
        );
        const firstDiagnostics = assertDiagnostics(
            firstDiagnosticsResponse,
            mode,
            'first_pass',
            workloadProfile,
            workloadQueries.length
        );
        const firstAnnState = assertAnnState(state, mode, 'first_pass', workloadProfile, workloadQueries.length);
        result.firstPass = {
            startupDurationMs: roundMetric(firstStartup.startupDurationMs),
            startupProbeCount: firstStartup.probeCount,
            ingestDurationMs: roundMetric(ingestResponse.durationMs),
            diagnostics: {
                ...firstDiagnostics,
                durationMs: roundMetric(firstDiagnosticsResponse.durationMs),
            },
            queries: firstQueries,
            annState: firstAnnState,
        };

        await stopRuntime(runtime);
        await assertPortFree(port);
        runtime = null;

        const restartSelectBaseline = state.selectRequestCount;
        port = await getFreePort();
        bridgePort = await getFreePort();
        runtime = spawnRuntime(mode, { port, bridgePort, connectorPort, fixture });
        const restartStartup = await waitForServer(port, STARTUP_TIMEOUT_MS, { workloadProfile, mode });

        const restartQueries = await runQueries(port, mode, 'restart_pass', workloadProfile, workloadQueries);
        const restartDiagnosticsResponse = await requestJson(
            port,
            'GET',
            '/api/knowledge/query-backend-diagnostics',
            undefined,
            computeRequestTimeoutMs({
                requestPath: '/api/knowledge/query-backend-diagnostics',
                workloadProfile,
                mode,
            })
        );
        const restartDiagnostics = assertDiagnostics(
            restartDiagnosticsResponse,
            mode,
            'restart_pass',
            workloadProfile,
            workloadQueries.length
        );
        const restartAnnState = assertAnnState(
            state,
            mode,
            'restart_pass',
            workloadProfile,
            restartSelectBaseline + workloadQueries.length
        );
        result.restartPass = {
            startupDurationMs: roundMetric(restartStartup.startupDurationMs),
            startupProbeCount: restartStartup.probeCount,
            diagnostics: {
                ...restartDiagnostics,
                durationMs: roundMetric(restartDiagnosticsResponse.durationMs),
            },
            queries: restartQueries,
            annState: restartAnnState,
        };
        result.performance = collectScenarioPerformance(result);
        result.expectedRecall = computeExpectedRecall(result);
        if (cliOptions.releaseGates) {
            result.releaseGates = buildReleaseGateSummary(
                mode,
                workloadProfile,
                result.performance,
                result.expectedRecall,
                cliOptions.releaseThresholds
            );
            assertCondition(
                result.releaseGates.pass,
                `[${mode}] release gates failed: ${result.releaseGates.gates.filter((gate) => !gate.passed).map((gate) => gate.gateId).join(', ')}`
            );
        }

        return result;
    } catch (error) {
        const detail = String(error && error.stack ? error.stack : error);
        const logs = runtime ? runtime.getLogs() : '';
        throw new Error(`[${mode}] verification failed\n${detail}\n${logs}`);
    } finally {
        await stopRuntime(runtime);
        await shutdownServerInstance(annService);
        fixture.cleanup();
    }
}

async function main() {
    const cliOptions = parseCliOptions(process.argv.slice(2));
    assertCondition(
        fs.existsSync(DIST_FRONTEND_DIR),
        `Missing dist frontend directory: ${DIST_FRONTEND_DIR}. Run npm run build first.`
    );

    const report = {
        verifiedAt: new Date().toISOString(),
        host: {
            platform: process.platform,
            arch: process.arch,
        },
        suiteKind: cliOptions.suiteKind,
        releaseGatesEnabled: cliOptions.releaseGates,
        releaseThresholds: cliOptions.releaseThresholds,
        profileRuns: [],
    };

    for (const profileKey of cliOptions.profileKeys) {
        const workloadProfile = WORKLOAD_PROFILES[profileKey];
        assertCondition(Boolean(workloadProfile), `Unknown workload profile: ${profileKey}`);
        report.profileRuns.push({
            workloadProfile: {
                profileId: workloadProfile.profileId,
                documentCount: workloadProfile.documentCount,
                minSyncedAtomCount: workloadProfile.minSyncedAtomCount,
            },
            modes: [
                await runScenario('dist_node_runtime', workloadProfile, cliOptions),
                await runScenario('packaged_sidecar', workloadProfile, cliOptions),
            ],
        });
    }

    const reportPaths = writeStructuredReport(report);
    console.log(JSON.stringify(report, null, 2));
    console.log(
        `[foundation-ann-runtime] Report written: ${path.relative(REPO_ROOT, reportPaths.latestPath).replace(/\\/g, '/')}`
    );
    console.log(
        `[foundation-ann-runtime] Timestamped report written: ${path.relative(REPO_ROOT, reportPaths.datedPath).replace(/\\/g, '/')}`
    );
    console.log('[foundation-ann-runtime] PASS');
}

main().catch((error) => {
    console.error(`[foundation-ann-runtime] FAIL: ${String(error && error.stack ? error.stack : error)}`);
    process.exit(1);
});
