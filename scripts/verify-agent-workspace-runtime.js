const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { copyProjectAssets } = require('./copy-assets');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 20000;
const LOOPBACK_HOST = '127.0.0.1';

function createLogger(logger) {
    return logger || console;
}

function makeTempProject(prefix = 'noteconnection-agent-runtime') {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
    const projectRoot = path.join(root, 'project');
    const frontendDir = path.join(projectRoot, 'dist', 'src', 'frontend');
    const runtimeDataDir = path.join(projectRoot, 'runtime_data');
    const kbRoot = path.join(projectRoot, 'Knowledge_Base');
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(runtimeDataDir, { recursive: true });
    fs.mkdirSync(kbRoot, { recursive: true });
    return {
        root,
        projectRoot,
        frontendDir,
        runtimeDataDir,
        kbRoot,
        cleanup() {
            fs.rmSync(root, { recursive: true, force: true });
        },
    };
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

function httpGetText(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(body);
                    return;
                }
                reject(new Error(`HTTP ${response.statusCode || 0} for ${url}`));
            });
        });
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Timed out after ${timeoutMs}ms for ${url}`));
        });
        request.once('error', reject);
    });
}

async function waitForServer(url, timeoutMs) {
    const startedAt = Date.now();
    let lastError = null;
    while ((Date.now() - startedAt) < timeoutMs) {
        try {
            await httpGetText(url, Math.min(1500, timeoutMs));
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
    throw lastError || new Error(`Timed out waiting for ${url}`);
}

function spawnRuntimeServer(options) {
    const {
        port,
        bridgePort,
        projectRoot,
        frontendDir,
        runtimeDataDir,
        kbRoot,
        logger,
    } = options;
    const bufferedLogs = [];
    const child = spawn(
        process.execPath,
        ['-r', 'ts-node/register', 'src/server.ts'],
        {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                NOTE_CONNECTION_PROJECT_ROOT: projectRoot,
                NOTE_CONNECTION_FRONTEND_DIR: frontendDir,
                NOTE_CONNECTION_RUNTIME_DATA_DIR: runtimeDataDir,
                NOTE_CONNECTION_KB_ROOT: kbRoot,
                NOTE_CONNECTION_PORT: String(port),
                NOTE_CONNECTION_BRIDGE_PORT: String(bridgePort),
                PORT: String(port),
                NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK: '0',
                NOTE_CONNECTION_AUTH_TOKEN: '',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        }
    );

    const capture = (chunk) => {
        const line = String(chunk || '');
        bufferedLogs.push(line);
        if (bufferedLogs.length > 200) {
            bufferedLogs.shift();
        }
    };

    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', (error) => {
        logger.error('[agent-workspace-runtime] Failed to spawn runtime server:', error);
    });

    return {
        child,
        getLogs() {
            return bufferedLogs.join('');
        },
    };
}

async function stopRuntimeServer(child) {
    if (!child || child.killed || child.exitCode !== null) {
        return;
    }

    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (child.exitCode === null) {
        child.kill('SIGKILL');
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}

async function verifyAgentWorkspaceRuntime(options = {}) {
    const logger = createLogger(options.logger);
    const fixture = makeTempProject();
    const port = typeof options.port === 'number' ? options.port : await getFreePort();
    const bridgePort = typeof options.bridgePort === 'number' ? options.bridgePort : await getFreePort();
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    const sourceFrontendDir = path.join(REPO_ROOT, 'src', 'frontend');

    copyProjectAssets({
        src: sourceFrontendDir,
        dest: fixture.frontendDir,
        logger: {
            log: (..._args) => {},
            warn: (..._args) => {},
            error: (..._args) => {},
        },
    });

    const runtime = spawnRuntimeServer({
        port,
        bridgePort,
        projectRoot: fixture.projectRoot,
        frontendDir: fixture.frontendDir,
        runtimeDataDir: fixture.runtimeDataDir,
        kbRoot: fixture.kbRoot,
        logger,
    });
    const baseUrl = `http://${LOOPBACK_HOST}:${port}`;

    try {
        await waitForServer(`${baseUrl}/`, timeoutMs);
        const rootHtml = await httpGetText(`${baseUrl}/`, timeoutMs);
        const zhLocale = JSON.parse(await httpGetText(`${baseUrl}/locales/zh.json`, timeoutMs));

        const report = {
            port,
            bridgePort,
            rootHtmlChecks: {
                hasAgentWorkspaceShell: rootHtml.includes('agent-workspace-shell'),
                hasAgentChatPane: rootHtml.includes('agent-chat-pane'),
                hasGraphFocusPane: rootHtml.includes('agent-graph-focus-pane'),
                hasLearningPathPane: rootHtml.includes('agent-learning-path-pane'),
                hasAgentWorkspaceI18nKey: rootHtml.includes('data-i18n="agentWorkspace.title"'),
            },
            localeChecks: {
                hasAgentWorkspaceNamespace: !!(zhLocale && zhLocale.agentWorkspace),
                focusLabel: String(zhLocale?.agentWorkspace?.actions?.focus || ''),
                localNodeUnavailableTemplate: String(
                    zhLocale?.agentWorkspace?.messages?.localNodeUnavailable || ''
                ),
                queryBackendDiagnosticsRolloutModeLabel: String(
                    zhLocale?.agentWorkspace?.queryBackendDiagnostics?.rolloutModeLabel || ''
                ),
                queryBackendDiagnosticsAccelerationProviderLabel: String(
                    zhLocale?.agentWorkspace?.queryBackendDiagnostics?.accelerationProviderLabel || ''
                ),
                queryBackendDiagnosticsAccelerationFailureModeLabel: String(
                    zhLocale?.agentWorkspace?.queryBackendDiagnostics?.accelerationFailureModeLabel || ''
                ),
                queryBackendDiagnosticsAccelerationRepresentationStrictLabel: String(
                    zhLocale?.agentWorkspace?.queryBackendDiagnostics?.accelerationRepresentationStrictLabel || ''
                ),
                queryBackendDiagnosticsAnnPrefilterLabel: String(
                    zhLocale?.agentWorkspace?.queryBackendDiagnostics?.annPrefilterLabel || ''
                ),
            },
        };

        const failures = [];
        Object.entries(report.rootHtmlChecks).forEach(([key, value]) => {
            if (value !== true) {
                failures.push(`rootHtmlChecks.${key}=false`);
            }
        });
        if (report.localeChecks.hasAgentWorkspaceNamespace !== true) {
            failures.push('localeChecks.hasAgentWorkspaceNamespace=false');
        }
        if (report.localeChecks.focusLabel !== '聚焦') {
            failures.push(`localeChecks.focusLabel='${report.localeChecks.focusLabel}'`);
        }
        if (!report.localeChecks.localNodeUnavailableTemplate.includes('{nodeId}')) {
            failures.push('localeChecks.localNodeUnavailableTemplate missing {nodeId}');
        }
        if (report.localeChecks.queryBackendDiagnosticsRolloutModeLabel !== '发布策略模式') {
            failures.push(
                `localeChecks.queryBackendDiagnosticsRolloutModeLabel='${report.localeChecks.queryBackendDiagnosticsRolloutModeLabel}'`
            );
        }
        if (report.localeChecks.queryBackendDiagnosticsAccelerationProviderLabel !== '加速提供方配置') {
            failures.push(
                `localeChecks.queryBackendDiagnosticsAccelerationProviderLabel='${report.localeChecks.queryBackendDiagnosticsAccelerationProviderLabel}'`
            );
        }
        if (report.localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel !== '加速失败模式配置') {
            failures.push(
                `localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel='${report.localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel}'`
            );
        }
        if (
            report.localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel
            !== '加速表示一致性严格模式配置'
        ) {
            failures.push(
                `localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel='${report.localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel}'`
            );
        }
        if (report.localeChecks.queryBackendDiagnosticsAnnPrefilterLabel !== 'ANN 预筛选发布状态') {
            failures.push(
                `localeChecks.queryBackendDiagnosticsAnnPrefilterLabel='${report.localeChecks.queryBackendDiagnosticsAnnPrefilterLabel}'`
            );
        }

        if (failures.length > 0) {
            throw new Error(
                `[agent-workspace-runtime] Smoke verification failed: ${failures.join(', ')}\n` +
                runtime.getLogs()
            );
        }

        return report;
    } finally {
        await stopRuntimeServer(runtime.child);
        fixture.cleanup();
    }
}

async function main() {
    try {
        const report = await verifyAgentWorkspaceRuntime();
        console.log('[agent-workspace-runtime] PASS', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('[agent-workspace-runtime] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    void main();
}

module.exports = {
    verifyAgentWorkspaceRuntime,
    LOOPBACK_HOST,
    waitForServer,
    httpGetText,
    spawnRuntimeServer,
    stopRuntimeServer,
    makeTempProject,
    getFreePort,
};
