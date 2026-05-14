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

function assertQueryResponse(response, mode, phase, expectedDocumentId) {
    assertCondition(response.status === 200, `[${mode}] ${phase}: query status=${response.status}`);
    const body = response.body || {};
    const items = body && body.result && Array.isArray(body.result.items)
        ? body.result.items
        : [];
    assertCondition(body.success === true, `[${mode}] ${phase}: query success!=true`);
    assertCondition(items.length > 0, `[${mode}] ${phase}: query returned no items`);
    const matched = items.find((item) => String(item && item.atom && item.atom.documentId || '') === expectedDocumentId);
    assertCondition(Boolean(matched), `[${mode}] ${phase}: expected documentId ${expectedDocumentId} not found in query results`);
    return {
        itemCount: items.length,
        matchedDocumentId: expectedDocumentId,
    };
}

async function runScenario(mode) {
    const fixture = createTempProject(`noteconnection-foundation-${mode}`);
    const sqlitePath = path.join(fixture.runtimeDataDir, SQLITE_FILENAME);
    const documentId = `doc_restart_runtime_${mode}`;
    const sourcePath = path.join(fixture.kbRoot, `${documentId}.md`);
    const ingestPayload = {
        incremental: true,
        documents: [
            {
                documentId,
                sourcePath,
                language: 'en',
                content: '# Restart Runtime\n\nPersist this graph content across server restart for sqlite proof.',
            },
        ],
    };
    const queryPayload = {
        query: 'persist graph content restart sqlite proof',
        topK: 3,
    };

    let runtime = null;
    let port = await getFreePort();
    let bridgePort = await getFreePort();
    const result = {
        mode,
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

        const diagnosticsResponse = await requestJson(port, 'GET', '/api/knowledge/store-diagnostics');
        const readinessResponse = await requestJson(port, 'GET', '/api/knowledge/foundation/readiness');
        const queryResponse = await requestJson(port, 'POST', '/api/knowledge/query', queryPayload);
        result.firstPass = {
            diagnostics: assertStoreDiagnostics(diagnosticsResponse, mode, 'first_pass'),
            readiness: assertFoundationReadiness(readinessResponse, mode, 'first_pass'),
            query: assertQueryResponse(queryResponse, mode, 'first_pass', documentId),
        };

        await stopRuntime(runtime);
        await assertPortFree(port);
        runtime = null;

        port = await getFreePort();
        bridgePort = await getFreePort();
        runtime = spawnRuntime(mode, { port, bridgePort, fixture });
        await waitForServer(port, STARTUP_TIMEOUT_MS);

        const restartDiagnosticsResponse = await requestJson(port, 'GET', '/api/knowledge/store-diagnostics');
        const restartReadinessResponse = await requestJson(port, 'GET', '/api/knowledge/foundation/readiness');
        const restartQueryResponse = await requestJson(port, 'POST', '/api/knowledge/query', queryPayload);
        result.restartPass = {
            diagnostics: assertStoreDiagnostics(restartDiagnosticsResponse, mode, 'restart_pass'),
            readiness: assertFoundationReadiness(restartReadinessResponse, mode, 'restart_pass'),
            query: assertQueryResponse(restartQueryResponse, mode, 'restart_pass', documentId),
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
        modes: [],
    };

    report.modes.push(await runScenario('dist_node_runtime'));
    report.modes.push(await runScenario('packaged_sidecar'));

    console.log(JSON.stringify(report, null, 2));
    console.log('[foundation-sqlite-runtime] PASS');
}

main().catch((error) => {
    console.error(`[foundation-sqlite-runtime] FAIL: ${String(error && error.stack ? error.stack : error)}`);
    process.exit(1);
});
