#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_SERVER_ENTRY = path.join(REPO_ROOT, 'dist', 'src', 'server.js');
const DIST_FRONTEND_DIR = path.join(REPO_ROOT, 'dist', 'src', 'frontend');
const SQLITE_FILENAME = 'knowledge_graph_store.graphdb.v1.sqlite';
const LOOPBACK_HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 30000;
const SHUTDOWN_TIMEOUT_MS = 8000;
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

function parseCliOptions(argv) {
    const args = new Set(argv);
    if (args.has('--matrix')) {
        return {
            suiteKind: 'matrix',
            profileKeys: ['smoke', 'medium', 'heavy'],
        };
    }
    if (args.has('--heavy')) {
        return {
            suiteKind: 'single',
            profileKeys: ['heavy'],
        };
    }
    if (args.has('--medium')) {
        return {
            suiteKind: 'single',
            profileKeys: ['medium'],
        };
    }
    return {
        suiteKind: 'single',
        profileKeys: ['smoke'],
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

function requestJson(port, method, requestPath, body) {
    return new Promise((resolve, reject) => {
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
                    });
                });
            }
        );

        req.setTimeout(2000, () => {
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
    while ((Date.now() - startedAt) < timeoutMs) {
        try {
            const response = await requestJson(port, 'GET', '/api/knowledge/store-diagnostics');
            if (response.status >= 200 && response.status < 500) {
                return;
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
    assertCondition(store.backendReady === true, `[${mode}] ${phase}: backendReady=${store.backendReady}`);
    assertCondition(store.usingFallback !== true, `[${mode}] ${phase}: usingFallback unexpectedly true`);
    return {
        storeType: String(store.storeType || ''),
        storageEngine: String(store.storageEngine || ''),
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
        const queryResponse = await requestJson(port, 'POST', '/api/knowledge/query', queryPlan.request);
        queryResults.push({
            phaseId: queryPlan.phaseId,
            ...assertQueryResponse(queryResponse, mode, `${phase}:${queryPlan.phaseId}`, {
                expectedDocumentId: queryPlan.expectedDocumentId,
                minItemCount: queryPlan.minItemCount,
            }),
        });
    }
    return queryResults;
}

async function runScenario(mode, workloadProfile) {
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

    let runtime = null;
    let port = await getFreePort();
    let bridgePort = await getFreePort();
    const result = {
        mode,
        profileId: workloadProfile.profileId,
        ingestedDocuments: documents.length,
        sqlitePath,
        firstPass: null,
        restartPass: null,
    };

    try {
        runtime = spawnRuntime(mode, { port, bridgePort, fixture });
        await waitForServer(port, STARTUP_TIMEOUT_MS);

        const ingestResponse = await requestJson(port, 'POST', '/api/knowledge/ingest', ingestPayload);
        assertCondition(ingestResponse.status === 200, `[${mode}] ingest status=${ingestResponse.status}`);
        assertCondition(ingestResponse.body && ingestResponse.body.success === true, `[${mode}] ingest success!=true`);
        assertCondition(fs.existsSync(sqlitePath), `[${mode}] sqlite store not created at ${sqlitePath}`);

        const firstQueries = await runQueries(port, mode, 'first_pass', workloadQueries);
        const readinessResponse = await requestJson(port, 'GET', '/api/knowledge/foundation/readiness');
        const diagnosticsResponse = await requestJson(port, 'GET', '/api/knowledge/store-diagnostics');
        const firstDiagnostics = assertStoreDiagnostics(diagnosticsResponse, mode, 'first_pass');
        result.firstPass = {
            diagnostics: {
                ...firstDiagnostics,
                snapshotMetadata: assertSnapshotMetadata(firstDiagnostics, mode, 'first_pass', workloadProfile),
            },
            readiness: assertFoundationReadiness(readinessResponse, mode, 'first_pass'),
            queries: firstQueries,
        };

        await stopRuntime(runtime);
        await assertPortFree(port);
        runtime = null;

        port = await getFreePort();
        bridgePort = await getFreePort();
        runtime = spawnRuntime(mode, { port, bridgePort, fixture });
        await waitForServer(port, STARTUP_TIMEOUT_MS);

        const restartQueries = await runQueries(port, mode, 'restart_pass', workloadQueries);
        const restartReadinessResponse = await requestJson(port, 'GET', '/api/knowledge/foundation/readiness');
        const restartDiagnosticsResponse = await requestJson(port, 'GET', '/api/knowledge/store-diagnostics');
        const restartDiagnostics = assertStoreDiagnostics(restartDiagnosticsResponse, mode, 'restart_pass');
        result.restartPass = {
            diagnostics: {
                ...restartDiagnostics,
                snapshotMetadata: assertSnapshotMetadata(restartDiagnostics, mode, 'restart_pass', workloadProfile),
            },
            readiness: assertFoundationReadiness(restartReadinessResponse, mode, 'restart_pass'),
            queries: restartQueries,
        };

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
                await runScenario('dist_node_runtime', workloadProfile),
                await runScenario('packaged_sidecar', workloadProfile),
            ],
        });
    }

    console.log(JSON.stringify(report, null, 2));
    console.log('[foundation-sqlite-runtime] PASS');
}

main().catch((error) => {
    console.error(`[foundation-sqlite-runtime] FAIL: ${String(error && error.stack ? error.stack : error)}`);
    process.exit(1);
});
