#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_SERVER_ENTRY = path.join(REPO_ROOT, 'dist', 'src', 'server.js');
const DIST_FRONTEND_DIR = path.join(REPO_ROOT, 'dist', 'src', 'frontend');
const OUTPUT_ROOT = path.join(REPO_ROOT, 'output', 'verification', 'foundation-sqlite-runtime');
const SQLITE_FILENAME = 'knowledge_graph_store.graphdb.v1.sqlite';
const LOOPBACK_HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 30000;
const SHUTDOWN_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_SCALE = Number.isFinite(Number(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_TIMEOUT_SCALE))
    ? Math.max(0.5, Number(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_TIMEOUT_SCALE))
    : 1;
const SOAK_THRESHOLD_DEFAULTS = Object.freeze({
    maxStartupP95Ms: 12000,
    maxStartupMaxMs: 18000,
    maxIngestP95Ms: 18000,
    maxIngestMaxMs: 32000,
    maxReadinessP95Ms: 4500,
    maxDiagnosticsP95Ms: 4500,
    maxQueryP95Ms: 2500,
    maxQueryMaxMs: 6000,
    packagedModeMultiplier: 1.25,
});
const WORKLOAD_PROFILES = {
    smoke: {
        profileId: 'smoke',
        documentCount: 1,
        minDocumentCount: 1,
        minAtomCount: 1,
        genericQuery: 'persist graph content restart sqlite proof',
        genericTopK: 3,
        minGenericResultCount: 1,
    },
    medium: {
        profileId: 'medium',
        documentCount: 60,
        minDocumentCount: 60,
        minAtomCount: 60,
        genericQuery: 'sqlite medium workload continuity shared retrieval token',
        genericTopK: 8,
        minGenericResultCount: 6,
    },
    heavy: {
        profileId: 'heavy',
        documentCount: 180,
        minDocumentCount: 180,
        minAtomCount: 180,
        genericQuery: 'sqlite heavy workload continuity shared retrieval token',
        genericTopK: 10,
        minGenericResultCount: 5,
    },
};

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function parsePositiveInt(rawValue, fallback, minimum, maximum) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    const rounded = Math.floor(parsed);
    return Math.min(maximum, Math.max(minimum, rounded));
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

function normalizeProfileKey(rawValue, fallback = 'smoke') {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(WORKLOAD_PROFILES, normalized)
        ? normalized
        : fallback;
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

function buildSoakThresholds() {
    return {
        maxStartupP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_STARTUP_P95_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxStartupP95Ms,
        maxStartupMaxMs: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_STARTUP_MAX_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxStartupMaxMs,
        maxIngestP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_INGEST_P95_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxIngestP95Ms,
        maxIngestMaxMs: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_INGEST_MAX_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxIngestMaxMs,
        maxReadinessP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_READINESS_P95_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxReadinessP95Ms,
        maxDiagnosticsP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_DIAGNOSTICS_P95_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxDiagnosticsP95Ms,
        maxQueryP95Ms: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_QUERY_P95_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxQueryP95Ms,
        maxQueryMaxMs: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_MAX_QUERY_MAX_MS)
            ?? SOAK_THRESHOLD_DEFAULTS.maxQueryMaxMs,
        packagedModeMultiplier: parseOptionalPositiveNumber(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_SOAK_PACKAGED_MODE_MULTIPLIER)
            ?? SOAK_THRESHOLD_DEFAULTS.packagedModeMultiplier,
    };
}

function parseCliOptions(argv) {
    const options = {
        suiteKind: 'single',
        selectedProfileKey: 'smoke',
        soakProfileKey: normalizeProfileKey(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_SOAK_PROFILE, 'heavy'),
        soakCycles: parsePositiveInt(process.env.NOTE_CONNECTION_FOUNDATION_SQLITE_SOAK_CYCLES, 5, 1, 20),
        soakThresholds: buildSoakThresholds(),
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--matrix') {
            options.suiteKind = 'matrix';
            continue;
        }
        if (arg === '--soak') {
            options.suiteKind = 'soak';
            continue;
        }
        if (arg === '--smoke' || arg === '--medium' || arg === '--heavy') {
            options.selectedProfileKey = arg.slice(2);
            continue;
        }
        if (arg === '--soak-profile' && argv[index + 1]) {
            options.soakProfileKey = normalizeProfileKey(argv[index + 1], options.soakProfileKey);
            index += 1;
            continue;
        }
        if (arg === '--soak-cycles' && argv[index + 1]) {
            options.soakCycles = parsePositiveInt(argv[index + 1], options.soakCycles, 1, 20);
            index += 1;
        }
    }

    return {
        suiteKind: options.suiteKind,
        profileKeys: options.suiteKind === 'matrix'
            ? ['smoke', 'medium', 'heavy']
            : [options.suiteKind === 'soak' ? options.soakProfileKey : options.selectedProfileKey],
        soakCycles: options.soakCycles,
        soakThresholds: options.soakThresholds,
    };
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

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function computeRequestTimeoutMs(context = {}) {
    const requestPath = String(context.requestPath || '').trim();
    const workloadProfile = context.workloadProfile || { documentCount: 1 };
    const documentCount = Math.max(1, Math.floor(Number(workloadProfile.documentCount || 1)));
    const mode = String(context.mode || '').trim();
    let timeoutMs = 4000;

    if (requestPath === '/api/knowledge/ingest') {
        timeoutMs = Math.max(20000, documentCount * 400);
    } else if (requestPath === '/api/knowledge/query') {
        timeoutMs = Math.max(6000, documentCount * 50);
    } else if (requestPath === '/api/knowledge/store-diagnostics' || requestPath === '/api/knowledge/foundation/readiness') {
        timeoutMs = Math.max(4000, documentCount * 20);
    }

    if (mode === 'packaged_sidecar') {
        timeoutMs = Math.round(timeoutMs * 1.35);
    }

    return Math.max(2000, Math.round(timeoutMs * REQUEST_TIMEOUT_SCALE));
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

function requestJson(port, method, requestPath, body, timeoutMs = 2000) {
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

async function waitForServer(port, timeoutMs) {
    const startedAt = Date.now();
    let lastError = null;
    let probeCount = 0;
    while ((Date.now() - startedAt) < timeoutMs) {
        probeCount += 1;
        try {
            const response = await requestJson(port, 'GET', '/api/knowledge/store-diagnostics');
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

function assertStoreDiagnostics(response, mode, phase) {
    assertCondition(response.status === 200, `[${mode}] ${phase}: store-diagnostics status=${response.status}`);
    const body = response.body || {};
    const store = body.store || {};
    assertCondition(body.success === true, `[${mode}] ${phase}: store-diagnostics success!=true`);
    assertCondition(store.storeType === 'graphdb', `[${mode}] ${phase}: storeType=${store.storeType}`);
    assertCondition(store.storageEngine === 'sqlite', `[${mode}] ${phase}: storageEngine=${store.storageEngine}`);
    assertCondition(store.requestedProvider === 'sqlite', `[${mode}] ${phase}: requestedProvider=${store.requestedProvider}`);
    assertCondition(store.resolvedProvider === 'sqlite', `[${mode}] ${phase}: resolvedProvider=${store.resolvedProvider}`);
    assertCondition(!store.fallbackReason, `[${mode}] ${phase}: fallbackReason=${store.fallbackReason || ''}`);
    assertCondition(store.backendReady === true, `[${mode}] ${phase}: backendReady=${store.backendReady}`);
    assertCondition(store.usingFallback !== true, `[${mode}] ${phase}: usingFallback unexpectedly true`);
    return {
        storeType: String(store.storeType || ''),
        storageEngine: String(store.storageEngine || ''),
        requestedProvider: String(store.requestedProvider || ''),
        resolvedProvider: String(store.resolvedProvider || ''),
        fallbackReason: String(store.fallbackReason || ''),
        backendReady: Boolean(store.backendReady),
        usingFallback: Boolean(store.usingFallback),
        location: String(store.location || ''),
        snapshotMetadata: store.graphDbLastSnapshotMetadata && typeof store.graphDbLastSnapshotMetadata === 'object'
            ? store.graphDbLastSnapshotMetadata
            : {},
    };
}

function assertFoundationReadiness(response, mode, phase) {
    assertCondition(response.status === 200, `[${mode}] ${phase}: foundation/readiness status=${response.status}`);
    const body = response.body || {};
    const readiness = body.readiness || {};
    const baseline = readiness.baseline || {};
    assertCondition(body.success === true, `[${mode}] ${phase}: foundation/readiness success!=true`);
    assertCondition(readiness.status === 'integrated', `[${mode}] ${phase}: readiness.status=${readiness.status}`);
    assertCondition(readiness.decision === 'go', `[${mode}] ${phase}: readiness.decision=${readiness.decision}`);
    assertCondition(baseline.storeType === 'sqlite', `[${mode}] ${phase}: baseline.storeType=${baseline.storeType}`);
    assertCondition(
        baseline.storageRequestedProvider === 'sqlite',
        `[${mode}] ${phase}: baseline.storageRequestedProvider=${baseline.storageRequestedProvider}`
    );
    assertCondition(
        baseline.storageResolvedProvider === 'sqlite',
        `[${mode}] ${phase}: baseline.storageResolvedProvider=${baseline.storageResolvedProvider}`
    );
    assertCondition(
        baseline.storageSupportsSqlite === true,
        `[${mode}] ${phase}: baseline.storageSupportsSqlite=${baseline.storageSupportsSqlite}`
    );
    assertCondition(
        baseline.graphBackendSignalKind === 'embedded_graphdb',
        `[${mode}] ${phase}: baseline.graphBackendSignalKind=${baseline.graphBackendSignalKind}`
    );
    assertCondition(
        baseline.graphBackendIndependent === true,
        `[${mode}] ${phase}: baseline.graphBackendIndependent=${baseline.graphBackendIndependent}`
    );
    return {
        status: String(readiness.status || ''),
        decision: String(readiness.decision || ''),
        storeType: String(baseline.storeType || ''),
        storageRequestedProvider: String(baseline.storageRequestedProvider || ''),
        storageResolvedProvider: String(baseline.storageResolvedProvider || ''),
        graphBackendSignalKind: String(baseline.graphBackendSignalKind || ''),
        graphBackendIndependent: Boolean(baseline.graphBackendIndependent),
    };
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
    if (expectedDocumentId) {
        const matched = items.find((item) => String(item && item.atom && item.atom.documentId || '') === expectedDocumentId);
        assertCondition(Boolean(matched), `[${mode}] ${phase}: expected documentId ${expectedDocumentId} not found in query results`);
    }
    return {
        itemCount: items.length,
        matchedDocumentId: expectedDocumentId || '',
    };
}

function buildWorkloadDocuments(mode, workloadProfile) {
    if (workloadProfile.profileId === 'smoke') {
        const documentId = `doc_restart_runtime_${mode}`;
        return [
            {
                documentId,
                sourcePath: documentId + '.md',
                language: 'en',
                content: '# Restart Runtime\n\nPersist this graph content across server restart for sqlite proof.',
            },
        ];
    }

    return Array.from({ length: workloadProfile.documentCount }, (_unused, index) => {
        const documentId = `doc_heavy_runtime_${mode}_${index}`;
        const clusterId = index % 9;
        const bandId = Math.floor(index / 30);
        return {
            documentId,
            sourcePath: documentId + '.md',
            language: 'en',
            content: [
                `# Heavy Runtime ${index}`,
                '',
                `sqlite heavy workload continuity shared retrieval token cluster_${clusterId} band_${bandId}`,
                `heavy_runtime_anchor_${index} runtime_sqlite_restart continuity_band_${bandId} graph_backend_sqlite`,
                `shared narrative ${index}: embedded sqlite graph backend should survive restart and preserve retrieval continuity under heavier workload slices.`,
                `workload checksum ${index} ${index + 17} ${index + 37}`,
            ].join('\n\n'),
        };
    });
}

function buildWorkloadQueries(mode, workloadProfile) {
    if (workloadProfile.profileId === 'smoke') {
        return [
            {
                phaseId: 'targeted',
                request: {
                    query: workloadProfile.genericQuery,
                    topK: workloadProfile.genericTopK,
                },
                expectedDocumentId: `doc_restart_runtime_${mode}`,
                minItemCount: 1,
            },
        ];
    }

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
                query: `heavy_runtime_anchor_${index}`,
                topK: 3,
            },
            expectedDocumentId: `doc_heavy_runtime_${mode}_${index}`,
            minItemCount: 1,
        })),
    ];
}

function assertSnapshotMetadata(diagnosticsSummary, mode, phase, workloadProfile) {
    const metadata = diagnosticsSummary && diagnosticsSummary.snapshotMetadata
        ? diagnosticsSummary.snapshotMetadata
        : {};
    const documentCount = Math.max(0, Math.floor(Number(metadata.documentCount || 0)));
    const atomCount = Math.max(0, Math.floor(Number(metadata.atomCount || 0)));
    assertCondition(documentCount >= workloadProfile.minDocumentCount, `[${mode}] ${phase}: snapshot documentCount=${documentCount}, expected >= ${workloadProfile.minDocumentCount}`);
    assertCondition(atomCount >= workloadProfile.minAtomCount, `[${mode}] ${phase}: snapshot atomCount=${atomCount}, expected >= ${workloadProfile.minAtomCount}`);
    return {
        documentCount,
        atomCount,
        relationEdgeCount: Math.max(0, Math.floor(Number(metadata.relationEdgeCount || 0))),
        temporalEdgeCount: Math.max(0, Math.floor(Number(metadata.temporalEdgeCount || 0))),
    };
}

async function runQueries(port, mode, phase, workloadQueries) {
    const queryResults = [];
    for (const queryPlan of workloadQueries) {
        const queryResponse = await requestJson(
            port,
            'POST',
            '/api/knowledge/query',
            queryPlan.request,
            computeRequestTimeoutMs({ requestPath: '/api/knowledge/query', mode, workloadProfile: queryPlan.workloadProfile })
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
    const initialPass = result.firstPass || {};
    const restartCycles = Array.isArray(result.restartCycles) ? result.restartCycles : [];
    const startupSamples = [
        Number(initialPass.startupDurationMs || 0),
        ...restartCycles.map((cycle) => Number(cycle.startupDurationMs || 0)),
    ];
    const ingestSamples = [Number(initialPass.ingestDurationMs || 0)];
    const readinessSamples = [
        Number(initialPass.readiness && initialPass.readiness.durationMs || 0),
        ...restartCycles.map((cycle) => Number(cycle.readiness && cycle.readiness.durationMs || 0)),
    ];
    const diagnosticsSamples = [
        Number(initialPass.diagnostics && initialPass.diagnostics.durationMs || 0),
        ...restartCycles.map((cycle) => Number(cycle.diagnostics && cycle.diagnostics.durationMs || 0)),
    ];
    const querySamples = [
        ...(Array.isArray(initialPass.queries) ? initialPass.queries : []).map((query) => Number(query.durationMs || 0)),
        ...restartCycles.flatMap((cycle) => (Array.isArray(cycle.queries) ? cycle.queries : []).map((query) => Number(query.durationMs || 0))),
    ];

    return {
        startupDurationMs: summarizeDurations(startupSamples),
        ingestDurationMs: summarizeDurations(ingestSamples),
        readinessDurationMs: summarizeDurations(readinessSamples),
        diagnosticsDurationMs: summarizeDurations(diagnosticsSamples),
        queryDurationMs: summarizeDurations(querySamples),
    };
}

function resolveSoakThreshold(soakThresholds, key, mode) {
    const raw = Number(soakThresholds[key] || 0);
    const multiplier = mode === 'packaged_sidecar'
        ? Number(soakThresholds.packagedModeMultiplier || 1)
        : 1;
    return roundMetric(raw * multiplier);
}

function createSoakGateResult(gateId, label, observedMs, maxAllowedMs, sampleCount) {
    const observed = roundMetric(observedMs);
    const allowed = roundMetric(maxAllowedMs);
    return {
        gateId,
        label,
        passed: sampleCount > 0 && observed <= allowed,
        observedMs: observed,
        maxAllowedMs: allowed,
        sampleCount,
    };
}

function buildSoakPerformanceSummary(mode, workloadProfile, performance, soakThresholds, restartCycleCount) {
    const gates = [
        createSoakGateResult(
            'startup_p95',
            'Startup p95 must stay within soak budget.',
            performance.startupDurationMs.p95Ms,
            resolveSoakThreshold(soakThresholds, 'maxStartupP95Ms', mode),
            performance.startupDurationMs.count
        ),
        createSoakGateResult(
            'startup_max',
            'Startup max must stay within soak budget.',
            performance.startupDurationMs.maxMs,
            resolveSoakThreshold(soakThresholds, 'maxStartupMaxMs', mode),
            performance.startupDurationMs.count
        ),
        createSoakGateResult(
            'ingest_p95',
            'Ingest p95 must stay within soak budget.',
            performance.ingestDurationMs.p95Ms,
            resolveSoakThreshold(soakThresholds, 'maxIngestP95Ms', mode),
            performance.ingestDurationMs.count
        ),
        createSoakGateResult(
            'ingest_max',
            'Ingest max must stay within soak budget.',
            performance.ingestDurationMs.maxMs,
            resolveSoakThreshold(soakThresholds, 'maxIngestMaxMs', mode),
            performance.ingestDurationMs.count
        ),
        createSoakGateResult(
            'readiness_p95',
            'Foundation readiness p95 must stay within soak budget.',
            performance.readinessDurationMs.p95Ms,
            resolveSoakThreshold(soakThresholds, 'maxReadinessP95Ms', mode),
            performance.readinessDurationMs.count
        ),
        createSoakGateResult(
            'diagnostics_p95',
            'Store diagnostics p95 must stay within soak budget.',
            performance.diagnosticsDurationMs.p95Ms,
            resolveSoakThreshold(soakThresholds, 'maxDiagnosticsP95Ms', mode),
            performance.diagnosticsDurationMs.count
        ),
        createSoakGateResult(
            'query_p95',
            'Query p95 must stay within soak budget.',
            performance.queryDurationMs.p95Ms,
            resolveSoakThreshold(soakThresholds, 'maxQueryP95Ms', mode),
            performance.queryDurationMs.count
        ),
        createSoakGateResult(
            'query_max',
            'Query max must stay within soak budget.',
            performance.queryDurationMs.maxMs,
            resolveSoakThreshold(soakThresholds, 'maxQueryMaxMs', mode),
            performance.queryDurationMs.count
        ),
    ];

    return {
        profileId: workloadProfile.profileId,
        restartCycleCount,
        thresholds: {
            maxStartupP95Ms: resolveSoakThreshold(soakThresholds, 'maxStartupP95Ms', mode),
            maxStartupMaxMs: resolveSoakThreshold(soakThresholds, 'maxStartupMaxMs', mode),
            maxIngestP95Ms: resolveSoakThreshold(soakThresholds, 'maxIngestP95Ms', mode),
            maxIngestMaxMs: resolveSoakThreshold(soakThresholds, 'maxIngestMaxMs', mode),
            maxReadinessP95Ms: resolveSoakThreshold(soakThresholds, 'maxReadinessP95Ms', mode),
            maxDiagnosticsP95Ms: resolveSoakThreshold(soakThresholds, 'maxDiagnosticsP95Ms', mode),
            maxQueryP95Ms: resolveSoakThreshold(soakThresholds, 'maxQueryP95Ms', mode),
            maxQueryMaxMs: resolveSoakThreshold(soakThresholds, 'maxQueryMaxMs', mode),
        },
        metrics: performance,
        gates,
        pass: gates.every((gate) => gate.passed),
    };
}

function writeStructuredReport(report) {
    ensureDir(OUTPUT_ROOT);
    const timestamp = toFilenameTimestamp(report.verifiedAt);
    const latestPath = path.join(OUTPUT_ROOT, 'foundation-sqlite-runtime-report-latest.json');
    const datedPath = path.join(OUTPUT_ROOT, `foundation-sqlite-runtime-report-${timestamp}.json`);
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(latestPath, serialized, 'utf8');
    fs.writeFileSync(datedPath, serialized, 'utf8');
    return { latestPath, datedPath };
}

async function runScenario(mode, workloadProfile, cliOptions) {
    const fixture = createTempProject(`noteconnection-foundation-${mode}`);
    const sqlitePath = path.join(fixture.runtimeDataDir, SQLITE_FILENAME);
    const documents = buildWorkloadDocuments(mode, workloadProfile).map((document) => ({
        ...document,
        sourcePath: path.join(fixture.kbRoot, document.sourcePath),
    }));
    const workloadQueries = buildWorkloadQueries(mode, workloadProfile);
    const ingestPayload = {
        incremental: true,
        documents,
    };
    const restartCycleCount = cliOptions.suiteKind === 'soak' ? cliOptions.soakCycles : 1;

    let runtime = null;
    let port = await getFreePort();
    let bridgePort = await getFreePort();
    const result = {
        mode,
        profileId: workloadProfile.profileId,
        suiteKind: cliOptions.suiteKind,
        restartCycleCount,
        ingestedDocuments: documents.length,
        sqlitePath,
        firstPass: null,
        restartPass: null,
        restartCycles: [],
        performance: null,
        soak: null,
    };

    try {
        runtime = spawnRuntime(mode, { port, bridgePort, fixture });
        const firstStartup = await waitForServer(port, STARTUP_TIMEOUT_MS);

        const ingestResponse = await requestJson(
            port,
            'POST',
            '/api/knowledge/ingest',
            ingestPayload,
            computeRequestTimeoutMs({ requestPath: '/api/knowledge/ingest', mode, workloadProfile })
        );
        assertCondition(ingestResponse.status === 200, `[${mode}] ingest status=${ingestResponse.status}`);
        assertCondition(ingestResponse.body && ingestResponse.body.success === true, `[${mode}] ingest success!=true`);
        assertCondition(fs.existsSync(sqlitePath), `[${mode}] sqlite store not created at ${sqlitePath}`);

        const timedWorkloadQueries = workloadQueries.map((queryPlan) => ({ ...queryPlan, workloadProfile }));
        const firstQueries = await runQueries(port, mode, 'first_pass', timedWorkloadQueries);
        const readinessResponse = await requestJson(
            port,
            'GET',
            '/api/knowledge/foundation/readiness',
            undefined,
            computeRequestTimeoutMs({ requestPath: '/api/knowledge/foundation/readiness', mode, workloadProfile })
        );
        const diagnosticsResponse = await requestJson(
            port,
            'GET',
            '/api/knowledge/store-diagnostics',
            undefined,
            computeRequestTimeoutMs({ requestPath: '/api/knowledge/store-diagnostics', mode, workloadProfile })
        );
        const firstDiagnostics = assertStoreDiagnostics(diagnosticsResponse, mode, 'first_pass');
        result.firstPass = {
            startupDurationMs: roundMetric(firstStartup.startupDurationMs),
            startupProbeCount: firstStartup.probeCount,
            ingestDurationMs: roundMetric(ingestResponse.durationMs),
            diagnostics: {
                ...firstDiagnostics,
                durationMs: roundMetric(diagnosticsResponse.durationMs),
                snapshotMetadata: assertSnapshotMetadata(firstDiagnostics, mode, 'first_pass', workloadProfile),
            },
            readiness: {
                ...assertFoundationReadiness(readinessResponse, mode, 'first_pass'),
                durationMs: roundMetric(readinessResponse.durationMs),
            },
            queries: firstQueries,
        };

        await stopRuntime(runtime);
        await assertPortFree(port);
        runtime = null;

        for (let cycleIndex = 1; cycleIndex <= restartCycleCount; cycleIndex += 1) {
            port = await getFreePort();
            bridgePort = await getFreePort();
            runtime = spawnRuntime(mode, { port, bridgePort, fixture });
            const restartStartup = await waitForServer(port, STARTUP_TIMEOUT_MS);

            const restartQueries = await runQueries(port, mode, `restart_cycle_${cycleIndex}`, timedWorkloadQueries);
            const restartReadinessResponse = await requestJson(
                port,
                'GET',
                '/api/knowledge/foundation/readiness',
                undefined,
                computeRequestTimeoutMs({ requestPath: '/api/knowledge/foundation/readiness', mode, workloadProfile })
            );
            const restartDiagnosticsResponse = await requestJson(
                port,
                'GET',
                '/api/knowledge/store-diagnostics',
                undefined,
                computeRequestTimeoutMs({ requestPath: '/api/knowledge/store-diagnostics', mode, workloadProfile })
            );
            const restartDiagnostics = assertStoreDiagnostics(restartDiagnosticsResponse, mode, `restart_cycle_${cycleIndex}`);
            const restartCycle = {
                cycleIndex,
                startupDurationMs: roundMetric(restartStartup.startupDurationMs),
                startupProbeCount: restartStartup.probeCount,
                diagnostics: {
                    ...restartDiagnostics,
                    durationMs: roundMetric(restartDiagnosticsResponse.durationMs),
                    snapshotMetadata: assertSnapshotMetadata(restartDiagnostics, mode, `restart_cycle_${cycleIndex}`, workloadProfile),
                },
                readiness: {
                    ...assertFoundationReadiness(restartReadinessResponse, mode, `restart_cycle_${cycleIndex}`),
                    durationMs: roundMetric(restartReadinessResponse.durationMs),
                },
                queries: restartQueries,
            };
            result.restartCycles.push(restartCycle);
            if (cycleIndex === 1) {
                result.restartPass = restartCycle;
            }

            await stopRuntime(runtime);
            await assertPortFree(port);
            runtime = null;
        }

        result.performance = collectScenarioPerformance(result);
        if (cliOptions.suiteKind === 'soak') {
            result.soak = buildSoakPerformanceSummary(
                mode,
                workloadProfile,
                result.performance,
                cliOptions.soakThresholds,
                restartCycleCount
            );
            assertCondition(
                result.soak.pass,
                `[${mode}] soak performance gates failed: ${result.soak.gates.filter((gate) => !gate.passed).map((gate) => gate.gateId).join(', ')}`
            );
        }

        return result;
    } catch (error) {
        const detail = String(error && error.stack ? error.stack : error);
        const logs = runtime ? runtime.getLogs() : '';
        throw new Error(`[${mode}] verification failed\n${detail}\n${logs}`);
    } finally {
        await stopRuntime(runtime);
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
        soakCycles: cliOptions.soakCycles,
        profileRuns: [],
    };

    for (const profileKey of cliOptions.profileKeys) {
        const workloadProfile = WORKLOAD_PROFILES[profileKey];
        assertCondition(Boolean(workloadProfile), `Unknown workload profile: ${profileKey}`);
        report.profileRuns.push({
            workloadProfile: {
                profileId: workloadProfile.profileId,
                documentCount: workloadProfile.documentCount,
                minDocumentCount: workloadProfile.minDocumentCount,
                minAtomCount: workloadProfile.minAtomCount,
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
        `[foundation-sqlite-runtime] Report written: ${path.relative(REPO_ROOT, reportPaths.latestPath).replace(/\\/g, '/')}`
    );
    console.log(
        `[foundation-sqlite-runtime] Timestamped report written: ${path.relative(REPO_ROOT, reportPaths.datedPath).replace(/\\/g, '/')}`
    );
    console.log('[foundation-sqlite-runtime] PASS');
}

main().catch((error) => {
    console.error(`[foundation-sqlite-runtime] FAIL: ${String(error && error.stack ? error.stack : error)}`);
    process.exit(1);
});
