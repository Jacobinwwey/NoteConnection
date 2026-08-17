#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.join(REPO_ROOT, 'dist', 'src', 'server.js');
const FRONTEND_DIR = path.join(REPO_ROOT, 'dist', 'src', 'frontend');
const LEGACY_EQUIVALENT_PROBES = [
    { method: 'GET', path: '/api/notemd/settings' },
    { method: 'GET', path: '/api/folders' },
    { method: 'GET', path: '/api/available-targets' },
    { method: 'GET', path: '/api/kb-path' },
    { method: 'POST', path: '/api/knowledge/ingest', body: '{}' },
    { method: 'POST', path: '/api/knowledge/query', body: '{}' },
    { method: 'POST', path: '/api/knowledge/query', body: '{' },
    {
        method: 'POST',
        path: '/api/knowledge/ingest',
        write: true,
        body: JSON.stringify({
            documents: [{
                documentId: 'shadow-doc',
                sourcePath: 'shadow.md',
                content: '# Shadow\n\nregistry parity fixture',
                language: 'en',
            }],
        }),
    },
    { method: 'POST', path: '/api/knowledge/query-backend-config', body: '{}' },
    { method: 'POST', path: '/api/markdown/index', body: '{}' },
    { method: 'POST', path: '/api/markdown/index', body: '{"forceRebuild":true}' },
    { method: 'POST', path: '/api/build', body: '{"relationRecomputeMode":"unsupported"}' },
    { method: 'POST', path: '/api/render/math', body: '{}' },
    { method: 'POST', path: '/api/render/mermaid', body: '{}' },
    { method: 'POST', path: '/api/render/graphviz', body: '{}' },
    { method: 'POST', path: '/api/clipboard/image', body: '{}' },
    { method: 'POST', path: '/api/clipboard/image-binary', body: '{}', contentType: 'image/png' },
];

// These routes are intentionally registry-only. They prove migration progress,
// but must not be included in legacy-vs-registry equivalence assertions.
const REGISTRY_ONLY_PROBES = [
    { method: 'GET', path: '/api/knowledge/state', expectedRegistryStatus: 200, expectedLegacyStatus: 404 },
    { method: 'GET', path: '/api/knowledge/store-diagnostics', expectedRegistryStatus: 200, expectedLegacyStatus: 404 },
    { method: 'GET', path: '/api/knowledge/query-backend-config', expectedRegistryStatus: 200, expectedLegacyStatus: 404 },
    { method: 'GET', path: '/api/knowledge/runtime-capability-matrix', expectedRegistryStatus: 200, expectedLegacyStatus: 404 },
    { method: 'GET', path: '/api/notemd/capability-manifest', expectedRegistryStatus: 200, expectedLegacyStatus: 404 },
    { method: 'GET', path: '/api/notemd/invocation-contract', expectedRegistryStatus: 200, expectedLegacyStatus: 404 },
];

const VOLATILE_KEYS = new Set([
    'requestId', 'traceId', 'timestamp', 'createdAt', 'updatedAt', 'savedAt',
    'loadedAt', 'lastLoadAt', 'lastSaveAt', 'fileMtime', 'startedAt', 'checkedAt',
    'durationMs', 'latencyMs', 'uptimeMs', 'pid', 'port', 'bridgePort', 'asOf', 'checkedAtMs',
    'relationRecomputeLatencyMs',
    'localVectorIndexPath',
]);

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value)
        .filter((key) => !VOLATILE_KEYS.has(key))
        .sort()
        .reduce((result, key) => {
            result[key] = stableValue(value[key]);
            return result;
        }, {});
}

function stableBody(body) {
    try {
        return JSON.stringify(stableValue(JSON.parse(body)));
    } catch {
        return body;
    }
}

function stableHeaders(headers) {
    const ignored = new Set(['connection', 'content-length', 'date', 'keep-alive', 'transfer-encoding', 'x-request-id']);
    return Object.keys(headers)
        .filter((key) => !ignored.has(key.toLowerCase()))
        .sort()
        .reduce((result, key) => {
            result[key.toLowerCase()] = String(headers[key]);
            return result;
        }, {});
}

function hashFile(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function snapshotDirectory(root) {
    if (!fs.existsSync(root)) return [];
    const entries = [];
    const walk = (current) => {
        for (const name of fs.readdirSync(current).sort()) {
            if (name.endsWith('-wal') || name.endsWith('-shm')) continue;
            const filePath = path.join(current, name);
            const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                walk(filePath);
                continue;
            }
            const content = path.extname(filePath).toLowerCase() === '.json'
                ? stableBody(fs.readFileSync(filePath, 'utf8'))
                : hashFile(filePath);
            entries.push({ path: relativePath, bytes: stat.size, content });
        }
    };
    walk(root);
    return entries;
}

async function waitForStableRuntimeFiles(root) {
    const deadline = Date.now() + 5000;
    const pollIntervalMs = 75;
    const requiredStableSamples = 3;
    let previous = JSON.stringify(snapshotDirectory(root));
    let stableSamples = 0;

    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        const current = JSON.stringify(snapshotDirectory(root));
        if (current === previous) {
            stableSamples += 1;
            if (stableSamples >= requiredStableSamples) {
                return JSON.parse(current);
            }
        } else {
            previous = current;
            stableSamples = 0;
        }
    }

    return snapshotDirectory(root);
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address !== 'object') {
                server.close();
                reject(new Error('Failed to allocate an ephemeral port.'));
                return;
            }
            const port = address.port;
            server.close(() => resolve(port));
        });
    });
}

function request(port, probe) {
    return new Promise((resolve, reject) => {
        const body = probe.body || '';
        const request = http.request({
            host: '127.0.0.1',
            port,
            path: probe.path,
            method: probe.method,
            headers: {
                Accept: 'application/json',
                ...(body ? {
                    'Content-Type': probe.contentType || 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                } : {}),
            },
            timeout: 10000,
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve({
                statusCode: response.statusCode || 0,
                headers: stableHeaders(response.headers),
                body: Buffer.concat(chunks).toString('utf8'),
            }));
        });
        request.on('timeout', () => request.destroy(new Error(`Timed out: ${probe.method} ${probe.path}`)));
        request.on('error', reject);
        if (body) request.write(body);
        request.end();
    });
}

async function waitForServer(port, child, logs) {
    const deadline = Date.now() + 30000;
    let lastError = null;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Server exited before readiness: ${logs.join('').slice(-4000)}`);
        }
        try {
            const response = await request(port, { method: 'GET', path: '/api/knowledge/state' });
            if (response.statusCode > 0) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Server did not become ready: ${lastError ? lastError.message : 'unknown error'}\n${logs.join('').slice(-4000)}`);
}

async function startMode(mode, fixtureRoot) {
    const port = await getFreePort();
    const bridgePort = await getFreePort();
    const runtimeDataDir = path.join(fixtureRoot, `runtime-${mode}`);
    const configDir = path.join(runtimeDataDir, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    const logs = [];
    const child = spawn(process.execPath, [SERVER_ENTRY], {
        cwd: REPO_ROOT,
        env: {
            ...process.env,
            NOTE_CONNECTION_PROJECT_ROOT: REPO_ROOT,
            NOTE_CONNECTION_FRONTEND_DIR: FRONTEND_DIR,
            NOTE_CONNECTION_KB_ROOT: path.join(fixtureRoot, 'Knowledge_Base'),
            NOTE_CONNECTION_RUNTIME_DATA_DIR: runtimeDataDir,
            NOTE_CONNECTION_CONFIG_DIR: configDir,
            NOTE_CONNECTION_PORT: String(port),
            PORT: String(port),
            NOTE_CONNECTION_BRIDGE_PORT: String(bridgePort),
            NOTE_CONNECTION_AUTH_TOKEN: '',
            NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK: '0',
            NOTE_CONNECTION_ROUTE_DISPATCH_MODE: mode,
            NOTE_CONNECTION_STRICT_REGISTRY: '0',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => logs.push(String(chunk)));
    child.stderr.on('data', (chunk) => logs.push(String(chunk)));
    await waitForServer(port, child, logs);
    return { mode, port, child, runtimeDataDir, logs };
}

function stopMode(server) {
    return new Promise((resolve) => {
        if (server.child.exitCode !== null) {
            resolve();
            return;
        }
        server.child.once('exit', () => resolve());
        server.child.kill();
        setTimeout(() => resolve(), 5000);
    });
}

async function runMode(mode, fixtureRoot, probes) {
    const server = await startMode(mode, fixtureRoot);
    try {
        await request(server.port, { method: 'GET', path: '/api/knowledge/state' });
        // Readiness may precede the async SQLite initialization flush. Wait for
        // a stable manifest so a timing difference is not reported as a route side effect.
        await waitForStableRuntimeFiles(server.runtimeDataDir);
        const before = snapshotDirectory(server.runtimeDataDir);
        let beforeWrite = null;
        const responses = [];
        for (let index = 0; index < probes.length; index += 1) {
            const probe = probes[index];
            if (probe.write === true && beforeWrite === null) {
                beforeWrite = snapshotDirectory(server.runtimeDataDir);
            }
            responses.push({ probe, response: await request(server.port, probe) });
        }
        if (beforeWrite === null) beforeWrite = snapshotDirectory(server.runtimeDataDir);
        const after = snapshotDirectory(server.runtimeDataDir);
        return {
            mode,
            responses,
            before,
            beforeWrite,
            after,
            readOnlySideEffects: JSON.stringify(before) !== JSON.stringify(beforeWrite),
        };
    } finally {
        await stopMode(server);
    }
}

function compareResults(left, right) {
    if (left.responses.length !== right.responses.length) {
        throw new Error(`Probe count mismatch: ${left.responses.length} vs ${right.responses.length}`);
    }
    if (left.readOnlySideEffects || right.readOnlySideEffects) {
        throw new Error(
            `Read-only/invalid probes changed runtime files unexpectedly: legacy=${left.readOnlySideEffects} registry=${right.readOnlySideEffects}`
            + `\nlegacyBefore=${JSON.stringify(left.before)}\nlegacyBeforeWrite=${JSON.stringify(left.beforeWrite)}`
            + `\nregistryBefore=${JSON.stringify(right.before)}\nregistryBeforeWrite=${JSON.stringify(right.beforeWrite)}`
        );
    }
    if (JSON.stringify(left.after) !== JSON.stringify(right.after)) {
        throw new Error(`Final persistence manifest mismatch:\nlegacy=${JSON.stringify(left.after)}\nregistry=${JSON.stringify(right.after)}`);
    }
    left.responses.forEach((leftItem, index) => {
        const rightItem = right.responses[index];
        const leftResponse = leftItem.response;
        const rightResponse = rightItem.response;
        const label = `${leftItem.probe.method} ${leftItem.probe.path}#${index}`;
        if (leftResponse.statusCode !== rightResponse.statusCode) {
            throw new Error(
                `${label} status mismatch: ${leftResponse.statusCode} vs ${rightResponse.statusCode}`
                + `\nlegacy=${stableBody(leftResponse.body)}\nregistry=${stableBody(rightResponse.body)}`
            );
        }
        if (JSON.stringify(leftResponse.headers) !== JSON.stringify(rightResponse.headers)) {
            throw new Error(`${label} header mismatch:\nlegacy=${JSON.stringify(leftResponse.headers)}\nregistry=${JSON.stringify(rightResponse.headers)}`);
        }
        if (stableBody(leftResponse.body) !== stableBody(rightResponse.body)) {
            throw new Error(`${label} body mismatch:\nlegacy=${stableBody(leftResponse.body)}\nregistry=${stableBody(rightResponse.body)}`);
        }
    });
}

function compareRegistryOnly(legacy, registry) {
    if (legacy.responses.length !== registry.responses.length) {
        throw new Error(`Registry-only probe count mismatch: ${legacy.responses.length} vs ${registry.responses.length}`);
    }
    legacy.responses.forEach((legacyItem, index) => {
        const registryItem = registry.responses[index];
        const label = `${legacyItem.probe.method} ${legacyItem.probe.path}#${index}`;
        const expectedRegistryStatus = Number(legacyItem.probe.expectedRegistryStatus || 200);
        const expectedLegacyStatus = Number(legacyItem.probe.expectedLegacyStatus || 404);
        if (legacyItem.response.statusCode !== expectedLegacyStatus) {
            throw new Error(`${label} legacy expected ${expectedLegacyStatus}, got ${legacyItem.response.statusCode}`);
        }
        if (registryItem.response.statusCode !== expectedRegistryStatus) {
            throw new Error(`${label} registry expected ${expectedRegistryStatus}, got ${registryItem.response.statusCode}`);
        }
    });
}

async function main() {
    if (!fs.existsSync(SERVER_ENTRY)) throw new Error(`Missing ${SERVER_ENTRY}; run npm run build:mini first.`);
    fs.mkdirSync(FRONTEND_DIR, { recursive: true });
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-route-shadow-'));
    const knowledgeBase = path.join(fixtureRoot, 'Knowledge_Base');
    fs.mkdirSync(knowledgeBase, { recursive: true });
    fs.writeFileSync(path.join(knowledgeBase, 'alpha.md'), '# Alpha\n\n[[beta]]\n', 'utf8');
    fs.writeFileSync(path.join(knowledgeBase, 'beta.md'), '# Beta\n', 'utf8');

    try {
        const legacyEquivalent = await runMode('legacy', fixtureRoot, LEGACY_EQUIVALENT_PROBES);
        const registryEquivalent = await runMode('registry', fixtureRoot, LEGACY_EQUIVALENT_PROBES);
        compareResults(legacyEquivalent, registryEquivalent);

        const legacyOnly = await runMode('legacy', fixtureRoot, REGISTRY_ONLY_PROBES);
        const registryOnly = await runMode('registry', fixtureRoot, REGISTRY_ONLY_PROBES);
        compareRegistryOnly(legacyOnly, registryOnly);

        console.log(
            `[Route Shadow] PASS equivalent=${LEGACY_EQUIVALENT_PROBES.length} registryOnly=${REGISTRY_ONLY_PROBES.length} `
            + 'status/body/header/side-effect parity and migration-surface expectations verified.'
        );
    } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(`[Route Shadow] FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});
