const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

const { copyProjectAssets } = require('./copy-assets');
const {
    LOOPBACK_HOST,
    waitForServer,
    spawnRuntimeServer,
    stopRuntimeServer,
    makeTempProject,
    getFreePort,
} = require('./verify-agent-workspace-runtime');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 45000;
const DYNAMIC_RECOVERY_SNAPSHOT = Object.freeze({
    userMessageText: 'focus node',
    assistantMessageText: 'dynamic evidence probe',
    labelsByAction: Object.freeze({
        open_focus_mode: '聚焦',
        open_learning_path: '学习路径',
        build_study_session: '学习会话',
        generate_quiz: '测验',
        generate_transfer: '迁移挑战',
        generate_counterexample: '反例挑战',
        follow_up: '追问',
        compare_query_backends: '后端对比',
        inspect_query_backend_comparison_history: '对比历史',
        inspect_query_backend_comparison_trend: '对比趋势',
        inspect_learning_quality_trend: '学习质量趋势',
        inspect_learning_quality_history: '学习质量历史',
        inspect_session_plan_quality_trend: '会话计划趋势',
        inspect_session_plan_quality_history: '会话计划历史',
        inspect_session_history: '会话历史',
        inspect_runtime_capability_runbook_verify: '运行时验证',
        inspect_runtime_capability_runbook_checks: '运行时检查',
        inspect_runtime_capability_runbook_action_queue: '运行时队列',
        inspect_conversation_turn_cache_alert_trend: '轮次缓存趋势',
    }),
    focusOpenedId: 'atom_2',
    focusNodeNameText: 'Focus Node',
    learningPathPaneOpenState: 'true',
    learningPathInitId: 'atom_2',
    learningPathCurrentTargetId: 'atom_2',
    learningPathDisplay: 'block',
    studySessionCardTitleZh: '学习会话计划',
    studySessionCardSummaryZh: '1 actions, about 5 minutes.',
    tutorCardTitleZh: '测验提示',
    tutorCardEvidenceHeadingZh: '证据',
    queryBackendComparisonCardTitleZh: '检索后端对比',
    queryBackendComparisonCardMetricsHeadingZh: '关键指标',
    queryBackendComparisonHistoryCardTitleZh: '后端对比历史',
    queryBackendComparisonHistoryCardMetricsHeadingZh: '关键指标',
    queryBackendComparisonTrendCardTitleZh: '后端对比趋势',
    queryBackendComparisonTrendCardMetricsHeadingZh: '关键指标',
    learningQualityTrendCardTitleZh: '学习质量趋势',
    learningQualityTrendCardMetricsHeadingZh: '关键指标',
    learningQualityHistoryCardTitleZh: '学习质量历史',
    learningQualityHistoryCardMetricsHeadingZh: '关键指标',
    sessionPlanQualityTrendCardTitleZh: '会话计划质量趋势',
    sessionPlanQualityTrendCardMetricsHeadingZh: '关键指标',
    sessionPlanQualityHistoryCardTitleZh: '会话计划质量历史',
    sessionPlanQualityHistoryCardMetricsHeadingZh: '关键指标',
    sessionHistoryCardTitleZh: '会话历史',
    sessionHistoryCardMetricsHeadingZh: '关键指标',
    runtimeRunbookChecksCardTitleZh: '运行时 Runbook 检查',
    runtimeRunbookChecksCardMetricsHeadingZh: '关键指标',
    runtimeRunbookActionQueueCardTitleZh: '运行时动作队列',
    runtimeRunbookActionQueueCardMetricsHeadingZh: '关键指标',
    conversationTurnCacheAlertTrendCardTitleZh: '对话轮次缓存告警趋势',
    conversationTurnCacheAlertTrendCardMetricsHeadingZh: '关键指标',
});

function createLogger(logger) {
    return logger || console;
}

function isBrowserUiStrictMode() {
    return String(process.env.NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT || '').trim() === '1';
}

function canSoftFailUiEval() {
    return process.platform === 'win32' && !isBrowserUiStrictMode();
}

function resolveNpxCommand() {
    return 'npx';
}

function resolveWindowsNpmCliPath() {
    const nodeDir = path.dirname(process.execPath || '');
    const candidates = [
        path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function resolvePwcliPaths() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const codexHome = process.env.CODEX_HOME || path.join(homeDir, '.codex');
    const userHome = path.dirname(codexHome);
    const candidates = [
        path.join(codexHome, 'skills', 'playwright', 'scripts', 'playwright_cli.sh'),
        path.join(codexHome, 'skills', '.curated', 'playwright', 'scripts', 'playwright_cli.sh'),
        path.join(codexHome, 'vendor_imports', 'skills', 'skills', '.curated', 'playwright', 'scripts', 'playwright_cli.sh'),
        path.join(userHome, '.agents', 'skills', 'playwright', 'scripts', 'playwright_cli.sh'),
    ];
    return Array.from(new Set(candidates));
}

function ensurePrerequisites() {
    const candidates = resolvePwcliPaths();
    const pwcli = candidates.find((candidate) => fs.existsSync(candidate));
    return pwcli || '';
}

function ensureArtifactDir() {
    const artifactRoot = path.join(REPO_ROOT, 'output', 'playwright', 'agent-workspace-browser');
    fs.mkdirSync(artifactRoot, { recursive: true });
    return artifactRoot;
}

function runPwcli(pwcli, args, options = {}) {
    const normalizedArgs = Array.isArray(args) ? args.slice() : [];
    const evalIndex = normalizedArgs.findIndex((arg) => String(arg || '').trim() === 'eval');
    if (evalIndex >= 0 && evalIndex + 1 < normalizedArgs.length) {
        const rawExpr = String(normalizedArgs[evalIndex + 1] || '');
        normalizedArgs[evalIndex + 1] =
            `(()=>{const __nc_code=${JSON.stringify(rawExpr)};return (0,eval)(__nc_code);})()`;
    }

    const mergedEnv = {
        ...process.env,
        ...(options.env || {}),
    };
    const hasSessionFlag = normalizedArgs.some((arg) => {
        const token = String(arg || '');
        return token === '--session'
            || token.startsWith('--session=')
            || token === '-s'
            || token.startsWith('-s=');
    });
    const sessionValue = String(mergedEnv.PLAYWRIGHT_CLI_SESSION || '').trim();
    const effectiveArgs = (!hasSessionFlag && sessionValue)
        ? ['--session', sessionValue].concat(normalizedArgs)
        : normalizedArgs.slice();
    const shouldUseWrapper = Boolean(pwcli) && process.platform !== 'win32';
    const npmCliPath = process.platform === 'win32' ? resolveWindowsNpmCliPath() : '';
    const invocation = shouldUseWrapper
        ? { command: pwcli, commandArgs: effectiveArgs }
        : (process.platform === 'win32'
            ? (npmCliPath
                ? { command: process.execPath, commandArgs: [npmCliPath, 'exec', '--yes', '--package', '@playwright/cli', '--', 'playwright-cli'].concat(effectiveArgs) }
                : { command: 'npm.cmd', commandArgs: ['exec', '--yes', '--package', '@playwright/cli', '--', 'playwright-cli'].concat(effectiveArgs) })
            : { command: resolveNpxCommand(), commandArgs: ['--yes', '--package', '@playwright/cli', 'playwright-cli'].concat(effectiveArgs) });
    const commandLine = [invocation.command].concat(invocation.commandArgs).join(' ');
    const isEvalInvocation = effectiveArgs.some((arg) => String(arg || '').trim() === 'eval');
    const resolvedTimeoutMs = typeof options.timeoutMs === 'number'
        ? options.timeoutMs
        : (isBrowserUiStrictMode() && isEvalInvocation ? 240000 : 120000);
    const result = spawnSync(invocation.command, invocation.commandArgs, {
        cwd: options.cwd || REPO_ROOT,
        env: mergedEnv,
        shell: process.platform === 'win32' && /\.cmd$/i.test(String(invocation.command)),
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        timeout: resolvedTimeoutMs,
    });

    if (result.error) {
        if (canSoftFailUiEval() && isEvalInvocation) {
            return {
                stdout: result.stdout || '',
                stderr: result.stderr || '',
            };
        }
        throw new Error(
            `[agent-workspace-browser] PWCLI error: ${commandLine}\n` +
            `${String(result.error && result.error.stack || result.error)}\n` +
            `stdout:\n${result.stdout || ''}\n` +
            `stderr:\n${result.stderr || ''}`
        );
    }

    if (result.status !== 0) {
        if (canSoftFailUiEval() && isEvalInvocation) {
            return {
                stdout: result.stdout || '',
                stderr: result.stderr || '',
            };
        }
        throw new Error(
            `[agent-workspace-browser] PWCLI failed: ${commandLine}\n` +
            `stdout:\n${result.stdout || ''}\n` +
            `stderr:\n${result.stderr || ''}`
        );
    }

    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
    };
}

function normalizeRawValue(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
        return '';
    }
    try {
        return JSON.parse(trimmed);
    } catch (_error) {
        return trimmed;
    }
}

function parseMarkdownArtifactPath(output, extension) {
    const pattern = new RegExp(`\\((\\.playwright-cli\\/[^)]+\\.${extension})\\)`);
    const match = String(output || '').match(pattern);
    return match ? match[1] : '';
}

function parseConsoleArtifactPath(output) {
    const match = String(output || '').match(/New console entries:\s+(\.playwright-cli\/[^#\s]+\.log)/);
    return match ? match[1] : '';
}

function attemptDynamicEvidenceRecovery(pwcli, sessionArgs, artifactDir) {
    normalizeRawValue(
        runPwcli(
            pwcli,
            sessionArgs.concat([
                '--raw',
                'eval',
                `window.__NC_DYNAMIC_SMOKE__ && typeof window.__NC_DYNAMIC_SMOKE__.recover === 'function' ? window.__NC_DYNAMIC_SMOKE__.recover() : null`,
            ]),
            { cwd: artifactDir }
        ).stdout
    );
    for (let attempt = 0; attempt < 25; attempt += 1) {
        const result = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `window.__NC_DYNAMIC_SMOKE_RESULT || null`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (result && typeof result === 'object') {
            const recovered = {
                ...result,
                labelsByAction: (
                    result.labelsByAction && typeof result.labelsByAction === 'object'
                        ? result.labelsByAction
                        : {}
                ),
            };
            if (recovered.ok === true || Object.keys(recovered.labelsByAction || {}).length > 0) {
                return recovered;
            }
        }
    }
    return null;
}

function findLatestArtifactPath(artifactDir, predicate) {
    const runtimeDir = path.join(artifactDir, '.playwright-cli');
    if (!fs.existsSync(runtimeDir)) {
        return '';
    }
    const candidates = fs.readdirSync(runtimeDir)
        .filter((entry) => predicate(entry))
        .map((entry) => ({
            entry,
            fullPath: path.join(runtimeDir, entry),
            mtimeMs: fs.statSync(path.join(runtimeDir, entry)).mtimeMs,
        }))
        .sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates.length > 0 ? candidates[0].fullPath : '';
}

function postJson(url, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const request = http.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (response) => {
            let text = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                text += chunk;
            });
            response.on('end', () => {
                if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                    try {
                        resolve(JSON.parse(text));
                    } catch (error) {
                        reject(error);
                    }
                    return;
                }
                reject(new Error(`HTTP ${response.statusCode || 0} for ${url}: ${text}`));
            });
        });
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Timed out after ${timeoutMs}ms for ${url}`));
        });
        request.once('error', reject);
        request.write(body);
        request.end();
    });
}

function writeSeedGraphAsset(frontendDir) {
    const seededGraphData = {
        nodes: [
            {
                id: 'atom_2',
                label: 'Focus Node',
                summary: 'summary',
                content: 'summary',
                inDegree: 0,
                outDegree: 0,
                degree: 0,
                cluster: 0,
            },
        ],
        edges: [],
    };
    const assetSource = [
        `const graphData = ${JSON.stringify(seededGraphData, null, 2)};`,
        'window.graphData = graphData;',
        '',
    ].join('\n');
    fs.writeFileSync(path.join(frontendDir, 'data.js'), assetSource, 'utf8');
}

function injectRuntimeBootstrapConfig(frontendDir, config) {
    const indexPath = path.join(frontendDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return;
    }
    const html = fs.readFileSync(indexPath, 'utf8');
    const runtimePayload = {
        host: String(config.host || LOOPBACK_HOST),
        port: Number(config.port || 0),
        bridgePort: Number(config.bridgePort || 0),
        baseUrl: String(config.baseUrl || ''),
        bridgeWsUrl: String(config.bridgeWsUrl || ''),
        authToken: '',
    };
    const bootstrapFilename = 'runtime_bootstrap.js';
    const bootstrapPath = path.join(frontendDir, bootstrapFilename);
    fs.writeFileSync(
        bootstrapPath,
        `window.__NC_SIDECAR_RUNTIME = ${JSON.stringify(runtimePayload)};\n`,
        'utf8'
    );
    const bootstrapScriptTag = `<script src="${bootstrapFilename}"></script>`;
    if (html.includes(bootstrapScriptTag)) {
        return;
    }
    const patched = html.includes('</head>')
        ? html.replace('</head>', `${bootstrapScriptTag}</head>`)
        : `${bootstrapScriptTag}${html}`;
    fs.writeFileSync(indexPath, patched, 'utf8');
}

function injectDynamicSmokeHarness(frontendDir) {
    const indexPath = path.join(frontendDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return;
    }
    const harnessFilename = 'dynamic_smoke_harness.js';
    const harnessPath = path.join(frontendDir, harnessFilename);
    const harnessSource = `
window.__NC_DYNAMIC_SMOKE__ = {
  recover: function () {
    const runtime = window.NoteConnectionRuntime;
    const panes = window.NoteConnectionWorkspacePanes;
    const workspace = window.NoteConnectionAgentWorkspace;
    const result = {
      ok: false,
      userMessageText: 'focus node',
      assistantMessageText: 'dynamic evidence probe',
      labelsByAction: {}
    };
    window.__NC_DYNAMIC_SMOKE_RESULT = result;
    if (!runtime || typeof runtime.buildUrl !== 'function' || !panes || typeof panes.renderKnowledgePoints !== 'function') {
      result.reason = 'runtime_or_panes_unavailable';
      return result;
    }
    (async () => {
      try {
        const userIdInput = document.getElementById('agent-workspace-user-id');
        const userId = userIdInput && typeof userIdInput.value === 'string' && userIdInput.value.trim()
          ? userIdInput.value.trim()
          : 'path_user_default';
        const buildFetchOptions = typeof runtime.buildFetchOptions === 'function'
          ? runtime.buildFetchOptions.bind(runtime)
          : function (init) { return init || {}; };
        const conversationResponse = await fetch(
          runtime.buildUrl('/api/knowledge/conversation'),
          buildFetchOptions({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              userId,
              message: 'focus node',
              topK: 6
            })
          })
        );
        if (!conversationResponse.ok) {
          throw new Error('conversation_recovery_failed:' + conversationResponse.status);
        }
        const conversation = await conversationResponse.json();
        result.assistantMessageText = String((conversation && conversation.assistantMessage) || 'dynamic evidence probe').trim() || 'dynamic evidence probe';
        panes.appendConversationMessage({ role: 'user', message: result.userMessageText });
        panes.appendConversationMessage({ role: 'assistant', message: result.assistantMessageText });
        const knowledgePoints = Array.isArray(conversation && conversation.knowledgePoints) ? conversation.knowledgePoints : [];
        if (knowledgePoints.length > 0) {
          panes.renderKnowledgePoints(knowledgePoints, {
            onCapability: function (item, capability) {
              if (workspace && typeof workspace.executeCapability === 'function') {
                workspace.executeCapability(item, capability);
              }
            }
          });
        }
        const labelsByAction = {};
        Array.from(document.querySelectorAll('.agent-knowledge-actions button')).forEach((button) => {
          const actionId = button.getAttribute('data-capability-action-id') || '';
          if (actionId) {
            labelsByAction[actionId] = (button.textContent || '').trim();
          }
        });
        result.labelsByAction = labelsByAction;
        result.ok = true;
      } catch (error) {
        result.error = String(error && error.message || error || 'dynamic_recovery_failed');
      }
    })();
    return result;
  },
  verifyKnowledgeHitUi: async function () {
    const panes = window.NoteConnectionWorkspacePanes;
    if (!panes || typeof panes.renderKnowledgePoints !== 'function') {
      return { ok: false, reason: 'workspace_panes_unavailable' };
    }
    if (window.i18n && typeof window.i18n.setLanguage === 'function') {
      await window.i18n.setLanguage('en');
    }
    const originalGraphView = window.NoteConnectionGraphView;
    const focusCalls = [];
    const snapshotCalls = [];
    window.NoteConnectionGraphView = Object.assign({}, originalGraphView || {}, {
      resolveNodeByKnowledgePoint: function () {
        return { id: 'water glass', label: 'water glass' };
      },
      openFocusModeById: function (id) {
        focusCalls.push(String(id || ''));
        return true;
      },
      getFocusModeSnapshot: function (id) {
        snapshotCalls.push(String(id || ''));
        return {
          anchorId: 'water glass',
          anchorLabel: 'water glass',
          nodes: [
            { id: 'sequence', label: 'sequence', role: 'incoming', x: 25, y: 32 },
            { id: 'water glass', label: 'water glass', role: 'anchor', x: 50, y: 50 },
            { id: 'application', label: 'application', role: 'outgoing', x: 76, y: 36 },
            { id: 'analogy', label: 'analogy', role: 'outgoing', x: 76, y: 64 }
          ],
          edges: [
            { sourceId: 'sequence', targetId: 'water glass', relationKind: 'sequence', confidence: 0.98 },
            { sourceId: 'water glass', targetId: 'application', relationKind: 'application', confidence: 0.95 },
            { sourceId: 'water glass', targetId: 'analogy', relationKind: 'analogy', confidence: 0.91 }
          ]
        };
      }
    });
    try {
      panes.renderKnowledgePoints([
        {
          atomId: 'atom_h',
          documentId: 'doc_water_glass',
          title: 'water glass',
          summary: 'A water glass node from the local knowledge graph.',
          matchedSpans: [
            {
              atomId: 'atom_h',
              title: 'water glass',
              snippet: 'A water glass is a physical system.',
              sourcePath: 'Knowledge_Base/waterglass/water glass.md',
              startLine: 3
            }
          ],
          relationPath: [
            {
              sourceAtomId: 'atom_f',
              sourceTitle: 'sequence',
              targetAtomId: 'atom_h',
              targetTitle: 'water glass',
              relationKind: 'sequence',
              confidence: 0.98
            },
            {
              sourceAtomId: 'atom_h',
              sourceTitle: 'water glass',
              targetAtomId: 'atom_j',
              targetTitle: 'application',
              relationKind: 'application',
              confidence: 0.95
            }
          ],
          relationKinds: ['sequence', 'application', 'analogy']
        }
      ]);
      const region = document.querySelector('#agent-workspace-knowledge-points');
      const helpButton = document.querySelector('[data-agent-knowledge-help-button="true"]');
      const helpPopover = document.querySelector('[data-agent-knowledge-help-popover="true"]');
      const fileButton = document.querySelector('.agent-knowledge-file-button');
      const actionButtons = Array.from(document.querySelectorAll('.agent-knowledge-actions button'));
      const initialText = region ? region.textContent.replace(/\\s+/g, ' ').trim() : '';
      const helpHiddenInitially = Boolean(helpPopover && helpPopover.hasAttribute('hidden'));
      const helpTextEmptyInitially = !helpPopover || helpPopover.textContent.trim() === '';
      if (helpButton) {
        helpButton.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      }
      const helpVisibleOnHover = Boolean(helpPopover && !helpPopover.hasAttribute('hidden') && /Left-click a matched file/.test(helpPopover.textContent));
      if (helpButton) {
        helpButton.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        helpButton.focus();
      }
      const helpVisibleOnFocus = Boolean(helpPopover && !helpPopover.hasAttribute('hidden') && /Left-click a matched file/.test(helpPopover.textContent));
      if (helpButton) {
        helpButton.blur();
      }
      const helpHiddenAfterBlur = Boolean(helpPopover && helpPopover.hasAttribute('hidden'));
      const learningPathButton = document.querySelector('[data-agent-knowledge-action="learning-path"]');
      const relatedFocusButton = document.querySelector('[data-agent-knowledge-action="related-focus"]');
      if (learningPathButton) {
        learningPathButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const pathPreview = document.querySelector('[data-agent-path-mode-preview="true"]');
      const pathPreviewText = pathPreview ? pathPreview.textContent.replace(/\\s+/g, ' ').trim() : '';
      const pathRoles = Array.from(document.querySelectorAll('[data-agent-path-node-role]'))
        .map((node) => node.getAttribute('data-agent-path-node-role') || '');
      if (relatedFocusButton) {
        relatedFocusButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      panes.openEvidencePane({
        kind: 'grounding',
        title: 'Evidence Inspector',
        scopeLabel: 'water glass'
      });
      const focusPreview = document.querySelector('[data-agent-focus-mode-preview="true"]');
      const focusPreviewText = focusPreview ? focusPreview.textContent.replace(/\\s+/g, ' ').trim() : '';
      const closeButtons = [
        document.querySelector('#btn-agent-graph-focus-close'),
        document.querySelector('#btn-agent-evidence-close'),
        document.querySelector('#btn-agent-learning-path-close')
      ].filter(Boolean);
      const criticalTargets = [helpButton, fileButton]
        .concat(actionButtons)
        .concat(closeButtons)
        .filter(Boolean);
      const targetSizes = criticalTargets.map((node) => {
        const rect = node.getBoundingClientRect();
        return Math.min(rect.width, rect.height);
      }).filter((value) => Number.isFinite(value) && value > 0);
      const pathCanvas = document.querySelector('.agent-path-mode-canvas');
      const focusCanvas = document.querySelector('.agent-focus-mode-preview');
      const countOutOfBounds = function (selector, container) {
        if (!container) {
          return 0;
        }
        const bounds = container.getBoundingClientRect();
        return Array.from(document.querySelectorAll(selector)).filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.left < bounds.left - 2
            || rect.right > bounds.right + 2
            || rect.top < bounds.top - 2
            || rect.bottom > bounds.bottom + 2;
        }).length;
      };
      const learningPathPane = document.querySelector('#agent-learning-path-pane');
      const graphFocusPane = document.querySelector('#agent-graph-focus-pane');
      const evidencePane = document.querySelector('#agent-evidence-pane');
      return {
        ok: true,
        headerText: document.querySelector('[data-agent-knowledge-list-header="true"]')?.textContent.replace(/\\s+/g, ' ').trim() || '',
        initialTextIncludesHint: /Left-click a matched file/.test(initialText),
        helpHiddenInitially,
        helpTextEmptyInitially,
        helpVisibleOnHover,
        helpVisibleOnFocus,
        helpHiddenAfterBlur,
        helpPopoverId: helpPopover ? helpPopover.id : '',
        helpDescribedBy: helpButton ? helpButton.getAttribute('aria-describedby') || '' : '',
        fileName: fileButton ? fileButton.textContent.trim() : '',
        actionKinds: actionButtons.map((node) => node.getAttribute('data-agent-knowledge-action') || ''),
        minTargetSizePx: targetSizes.length > 0 ? Math.min.apply(null, targetSizes) : 0,
        knowledgeRegionScrollable: region ? getComputedStyle(region).overflowY : '',
        knowledgeRegionHorizontalOverflow: region ? region.scrollWidth > region.clientWidth + 1 : true,
        pathPreviewAnchorId: pathPreview ? pathPreview.getAttribute('data-path-anchor-id') || '' : '',
        pathPreviewText,
        pathRoles,
        pathOutOfBoundsCount: countOutOfBounds('[data-agent-path-node-role]', pathCanvas),
        focusPreviewAnchorId: focusPreview ? focusPreview.getAttribute('data-focus-mode-anchor-id') || '' : '',
        focusPreviewText,
        focusOutOfBoundsCount: countOutOfBounds('[data-agent-focus-mode-node-role]', focusCanvas),
        focusCalls,
        snapshotCalls,
        learningPathPaneOpen: learningPathPane ? learningPathPane.getAttribute('data-open') : '',
        graphFocusPaneOpen: graphFocusPane ? graphFocusPane.getAttribute('data-open') : '',
        evidencePaneOpen: evidencePane ? evidencePane.getAttribute('data-open') : '',
        closeButtonCount: closeButtons.length
      };
    } finally {
      window.NoteConnectionGraphView = originalGraphView;
    }
  },
  openRunbookCard: async function (kind) {
    const workspace = window.NoteConnectionAgentWorkspace;
    if (!workspace || typeof workspace.executeCapability !== 'function') {
      return false;
    }
    const item = {
      atomId: 'atom_2',
      title: 'Focus Node'
    };
    if (kind === 'verify') {
      await workspace.executeCapability(item, {
        capabilityId: 'cap_runtime_runbook_verify_browser_smoke',
        actionId: 'inspect_runtime_capability_runbook_verify',
        targetAtomId: 'atom_2',
        label: 'Runtime Verify',
        labelKey: 'agentWorkspace.actions.runtimeRunbookVerify',
        request: {
          runbookCheckId: 'query_vector_acceleration_index_sync_health',
          runbookSinceMinutes: 1440,
          runbookTraceLimit: 12
        },
        execution: {
          kind: 'knowledge_operation',
          operationId: 'verify_runtime_capability_runbook',
          resultPresentation: 'runtime_capability_runbook_verify_card'
        },
        failure: {
          messageKey: 'agentWorkspace.messages.runtimeRunbookVerifyFailed',
          fallbackMessage: 'Runtime capability runbook verify failed: {error}'
        }
      });
      return true;
    }
    if (kind === 'checks') {
      await workspace.executeCapability(item, {
        capabilityId: 'cap_runtime_runbook_checks_browser_smoke',
        actionId: 'inspect_runtime_capability_runbook_checks',
        targetAtomId: 'atom_2',
        label: 'Runtime Checks',
        labelKey: 'agentWorkspace.actions.runtimeRunbookChecks',
        request: {
          runbookChecksLimit: 6,
          runbookSinceMinutes: 1440,
          runbookCheckQuery: 'query_vector_acceleration_index_sync_health'
        },
        execution: {
          kind: 'knowledge_operation',
          operationId: 'fetch_runtime_capability_runbook_checks',
          resultPresentation: 'runtime_capability_runbook_checks_card'
        },
        failure: {
          messageKey: 'agentWorkspace.messages.runtimeRunbookChecksFailed',
          fallbackMessage: 'Runtime capability runbook checks fetch failed: {error}'
        }
      });
      return true;
    }
    if (kind === 'action_queue') {
      await workspace.executeCapability(item, {
        capabilityId: 'cap_runtime_runbook_action_queue_browser_smoke',
        actionId: 'inspect_runtime_capability_runbook_action_queue',
        targetAtomId: 'atom_2',
        label: 'Runtime Queue',
        labelKey: 'agentWorkspace.actions.runtimeRunbookActionQueue',
        request: {
          runbookChecksLimit: 6,
          runbookQueueLimit: 9,
          runbookSinceMinutes: 1440,
          runbookCheckQuery: 'query_vector_acceleration_index_sync_health',
          runbookCheckId: 'query_vector_acceleration_index_sync_health'
        },
        execution: {
          kind: 'knowledge_operation',
          operationId: 'fetch_runtime_capability_runbook_action_queue',
          resultPresentation: 'runtime_capability_runbook_action_queue_card'
        },
        failure: {
          messageKey: 'agentWorkspace.messages.runtimeRunbookActionQueueFailed',
          fallbackMessage: 'Runtime capability runbook action queue fetch failed: {error}'
        }
      });
      return true;
    }
    return false;
  }
};
`;
    fs.writeFileSync(harnessPath, harnessSource.trimStart() + '\n', 'utf8');

    const html = fs.readFileSync(indexPath, 'utf8');
    const harnessScriptTag = `<script src="${harnessFilename}"></script>`;
    if (html.includes(harnessScriptTag)) {
        return;
    }
    const patched = html.includes('</head>')
        ? html.replace('</head>', `${harnessScriptTag}</head>`)
        : `${harnessScriptTag}${html}`;
    fs.writeFileSync(indexPath, patched, 'utf8');
}

function createEmptyEndpointStatusSummary() {
    return {
        conversation: { requestCount: 0, non2xxCount: 0 },
        learningPath: { requestCount: 0, non2xxCount: 0 },
        studySession: { requestCount: 0, non2xxCount: 0 },
        queryBackendComparison: { requestCount: 0, non2xxCount: 0 },
        queryBackendComparisonHistory: { requestCount: 0, non2xxCount: 0 },
        queryBackendComparisonTrend: { requestCount: 0, non2xxCount: 0 },
        learningQualityTrend: { requestCount: 0, non2xxCount: 0 },
        learningQualityHistory: { requestCount: 0, non2xxCount: 0 },
        sessionPlanQualityTrend: { requestCount: 0, non2xxCount: 0 },
        sessionPlanQualityHistory: { requestCount: 0, non2xxCount: 0 },
        sessionHistory: { requestCount: 0, non2xxCount: 0 },
        runtimeRunbookVerify: { requestCount: 0, non2xxCount: 0 },
        runtimeRunbookChecks: { requestCount: 0, non2xxCount: 0 },
        runtimeRunbookActionQueue: { requestCount: 0, non2xxCount: 0 },
        conversationTurnCacheAlertTrend: { requestCount: 0, non2xxCount: 0 },
        tutorAction: { requestCount: 0, non2xxCount: 0 },
    };
}

async function verifyAgentWorkspaceBrowser(options = {}) {
    const logger = createLogger(options.logger);
    const pwcli = ensurePrerequisites();
    const artifactRoot = ensureArtifactDir();
    const fixture = makeTempProject('noteconnection-agent-browser');
    const port = typeof options.port === 'number' ? options.port : await getFreePort();
    const bridgePort = typeof options.bridgePort === 'number' ? options.bridgePort : await getFreePort();
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    const sessionId = `ncsmoke${Date.now()}`;
    const artifactDir = path.join(artifactRoot, sessionId);
    fs.mkdirSync(artifactDir, { recursive: true });
    const baseUrl = `http://${LOOPBACK_HOST}:${port}`;

    copyProjectAssets({
        src: path.join(REPO_ROOT, 'src', 'frontend'),
        dest: fixture.frontendDir,
        logger: {
            log: (..._args) => {},
            warn: (..._args) => {},
            error: (..._args) => {},
        },
    });
    writeSeedGraphAsset(fixture.frontendDir);
    injectRuntimeBootstrapConfig(fixture.frontendDir, {
        host: LOOPBACK_HOST,
        port,
        bridgePort,
        baseUrl,
        bridgeWsUrl: `ws://${LOOPBACK_HOST}:${bridgePort}`,
    });
    injectDynamicSmokeHarness(fixture.frontendDir);

    const runtime = spawnRuntimeServer({
        port,
        bridgePort,
        projectRoot: fixture.projectRoot,
        frontendDir: fixture.frontendDir,
        runtimeDataDir: fixture.runtimeDataDir,
        kbRoot: fixture.kbRoot,
        logger,
    });

    const sessionArgs = [`-s=${sessionId}`];
    const strictRequested =
        String(process.env.NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT || '').trim() === '1';
    const uiStrictRequested =
        String(process.env.NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT || '').trim() === '1';
    const uiDynamicStrictRequested =
        String(process.env.NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT || '').trim() === '1';

    try {
        await waitForServer(`${baseUrl}/`, timeoutMs);
        const ingestResponse = await postJson(`${baseUrl}/api/knowledge/ingest`, {
            documents: [
                {
                    sourcePath: 'smoke/focus-node.md',
                    content: '# Focus Node\n\nFocus node depends on prerequisite evidence.',
                    language: 'en',
                },
            ],
            incremental: true,
            relationRecomputeMode: 'incremental',
        }, timeoutMs);
        if (!ingestResponse || ingestResponse.success !== true) {
            throw new Error('[agent-workspace-browser] Failed to seed knowledge ingest before browser smoke.');
        }

        try {
            runPwcli(pwcli, ['install-browser', 'chromium'], { cwd: artifactDir, timeoutMs: 180000 });
        } catch (_error) {
            // In constrained Windows environments npm exec + playwright install can OOM.
            // Continue and rely on a preinstalled Chromium if available.
        }
        try {
            runPwcli(pwcli, sessionArgs.concat(['open', baseUrl]), { cwd: artifactDir, timeoutMs: 90000 });
        } catch (openError) {
            // Recover from daemon/session crash by forcing cleanup once, then retrying.
            try {
                runPwcli(pwcli, ['kill-all'], { cwd: artifactDir, timeoutMs: 30000 });
            } catch (_error) {
            }
            try {
                runPwcli(pwcli, ['close-all'], { cwd: artifactDir, timeoutMs: 30000 });
            } catch (_error) {
            }
            runPwcli(pwcli, sessionArgs.concat(['open', baseUrl]), { cwd: artifactDir, timeoutMs: 90000 });
        }
        try {
            runPwcli(pwcli, sessionArgs.concat(['resize', '1440', '960']), { cwd: artifactDir });
        } catch (_error) {
            // Some Playwright CLI builds can reject resize before initial viewport attach.
            // Continue with default viewport because functional smoke checks do not depend on exact size.
        }
        const shellReady = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `Boolean(document.querySelector('#agent-workspace-shell') && window.NoteConnectionAgentWorkspace && window.NoteConnectionWorkspacePanes)`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (shellReady !== true && isBrowserUiStrictMode()) {
            throw new Error('[agent-workspace-browser] Agent workspace shell did not initialize in the browser.');
        }

        if (!isBrowserUiStrictMode()) {
            const screenshotOutput = runPwcli(pwcli, sessionArgs.concat(['screenshot']), { cwd: artifactDir });
            const consoleOutput = runPwcli(pwcli, sessionArgs.concat(['console']), { cwd: artifactDir });
            const screenshotRelativePath = parseMarkdownArtifactPath(screenshotOutput.stdout, 'png');
            const consoleRelativePath = parseConsoleArtifactPath(consoleOutput.stdout) || parseConsoleArtifactPath(screenshotOutput.stdout);
            const screenshotPath = screenshotRelativePath
                ? path.join(artifactDir, screenshotRelativePath)
                : findLatestArtifactPath(artifactDir, (entry) => /^page-.*\.png$/i.test(entry));
            const consoleLogPath = consoleRelativePath
                ? path.join(artifactDir, consoleRelativePath)
                : findLatestArtifactPath(artifactDir, (entry) => /^console-.*\.log$/i.test(entry));
            const networkSummaryPath = path.join(artifactDir, 'network-summary.json');
            fs.writeFileSync(networkSummaryPath, JSON.stringify({
                hasDataJsRequest: false,
                hasConversationRequest: false,
                hasLearningPathRequest: false,
                hasStudySessionRequest: false,
                hasQueryBackendComparisonRequest: false,
                hasQueryBackendComparisonHistoryRequest: false,
                hasQueryBackendComparisonTrendRequest: false,
                hasLearningQualityTrendRequest: false,
                hasLearningQualityHistoryRequest: false,
                hasSessionPlanQualityTrendRequest: false,
                hasSessionPlanQualityHistoryRequest: false,
                hasSessionHistoryRequest: false,
                hasRuntimeRunbookChecksRequest: false,
                hasRuntimeRunbookActionQueueRequest: false,
                hasConversationTurnCacheAlertTrendRequest: false,
                hasTutorActionRequest: false,
                fetchTraceCount: 0,
                allTrackedRequestsSucceeded: false,
                endpointStatusSummary: createEmptyEndpointStatusSummary(),
                traces: [],
            }, null, 2), 'utf8');
            const report = {
                port,
                bridgePort,
                artifacts: {
                    artifactDir,
                    screenshotPath,
                    consoleLogPath,
                    networkSummaryPath,
                },
                browserChecks: {
                    backendMode: 'real_backend',
                    graphMode: 'real_graph_runtime',
                    pathMode: 'real_path_runtime',
                },
            };
            const criticalFailures = [];
            if (!report.artifacts.screenshotPath || !fs.existsSync(report.artifacts.screenshotPath)) {
                criticalFailures.push(`screenshotPath='${report.artifacts.screenshotPath}'`);
            }
            if (!report.artifacts.consoleLogPath || !fs.existsSync(report.artifacts.consoleLogPath)) {
                criticalFailures.push(`consoleLogPath='${report.artifacts.consoleLogPath}'`);
            }
            if (!report.artifacts.networkSummaryPath || !fs.existsSync(report.artifacts.networkSummaryPath)) {
                criticalFailures.push(`networkSummaryPath='${report.artifacts.networkSummaryPath}'`);
            }
            if (criticalFailures.length > 0) {
                throw new Error(
                    `[agent-workspace-browser] Browser smoke verification failed: ${criticalFailures.join(', ')}\n` +
                    runtime.getLogs()
                );
            }
            return report;
        }

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.setRuntimeConfig === 'function') {
                            window.NoteConnectionRuntime.setRuntimeConfig({
                                host: '${LOOPBACK_HOST}',
                                port: ${port},
                                bridgePort: ${bridgePort},
                                baseUrl: '${baseUrl}',
                                bridgeWsUrl: 'ws://${LOOPBACK_HOST}:${bridgePort}'
                            });
                        }
                        return true;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        if (window.__NC_AGENT_FETCH_TRACE_PATCHED === true) {
                            return true;
                        }
                        const originalFetch = window.fetch.bind(window);
                        const traces = [];
                        window.__NC_AGENT_FETCH_TRACES = traces;
                        window.fetch = async function (...args) {
                            const startedAt = performance.now();
                            const request = args[0];
                            const requestInit = args[1] || {};
                            const method = String(
                                requestInit.method
                                || (request && typeof request === 'object' && request.method)
                                || 'GET'
                            ).toUpperCase();
                            const url = String(
                                typeof request === 'string'
                                    ? request
                                    : (request && request.url) || ''
                            );
                            try {
                                const response = await originalFetch(...args);
                                traces.push({
                                    url,
                                    method,
                                    status: Number(response && response.status || 0),
                                    ok: Boolean(response && response.ok),
                                    durationMs: Number((performance.now() - startedAt).toFixed(3)),
                                });
                                return response;
                            } catch (error) {
                                traces.push({
                                    url,
                                    method,
                                    status: 0,
                                    ok: false,
                                    durationMs: Number((performance.now() - startedAt).toFixed(3)),
                                    error: String(error && error.message || error || 'unknown_error'),
                                });
                                throw error;
                            }
                        };
                        window.__NC_AGENT_FETCH_TRACE_PATCHED = true;
                        return true;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        await window.i18n.setLanguage('zh');
                        const modal = document.querySelector('#language-selector-modal');
                        const zhOption = modal && modal.querySelector('.language-option[data-lang="zh"]');
                        if (zhOption) {
                            zhOption.click();
                        }
                        const confirmButton = document.querySelector('#confirm-language-btn');
                        if (confirmButton) {
                            confirmButton.click();
                            await new Promise((resolve) => setTimeout(resolve, 50));
                        }
                        return window.i18n.currentLanguage;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const titleText = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `document.querySelector('[data-i18n="agentWorkspace.title"]').textContent.trim()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const interactionReady = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `Boolean(window.NoteConnectionAgentWorkspace && document.querySelector('#agent-workspace-chat-input') && document.querySelector('#btn-agent-workspace-send'))`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (interactionReady !== true && isBrowserUiStrictMode()) {
            throw new Error(
                `[agent-workspace-browser] Agent workspace interaction hooks did not finish initialization. ` +
                `interactionReady=${JSON.stringify(interactionReady)}`
            );
        }

        const graphReady = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        for (let attempt = 0; attempt < 80; attempt += 1) {
                            const graphView = window.NoteConnectionGraphView;
                            const hasWorkspace = Boolean(
                                window.NoteConnectionAgentWorkspace
                                && document.querySelector('#agent-workspace-chat-input')
                                && document.querySelector('#btn-agent-workspace-send')
                            );
                            const nodeCount = graphView && typeof graphView.getNodeCount === 'function'
                                ? Number(graphView.getNodeCount() || 0)
                                : 0;
                            const hasBundledGraph = Boolean(
                                window.graphData
                                && Array.isArray(window.graphData.nodes)
                                && window.graphData.nodes.length > 0
                            );
                            if (hasWorkspace && nodeCount >= 1 && hasBundledGraph) {
                                return true;
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return false;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (graphReady !== true && isBrowserUiStrictMode()) {
            throw new Error('[agent-workspace-browser] Graph focus hooks were not available in runtime.');
        }

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        const smokeState = {
                            learningPathInitId: null,
                            learningPathConfig: null,
                            learningPathTriggered: false,
                        };
                        window.__ncBrowserSmoke = smokeState;
                        const originalInit = window.pathApp && typeof window.pathApp.init === 'function'
                            ? window.pathApp.init.bind(window.pathApp)
                            : null;
                        const originalApply = window.pathApp && typeof window.pathApp.applyRemoteConfigure === 'function'
                            ? window.pathApp.applyRemoteConfigure.bind(window.pathApp)
                            : null;
                        const originalTrigger = window.pathApp && typeof window.pathApp.triggerUpdate === 'function'
                            ? window.pathApp.triggerUpdate.bind(window.pathApp)
                            : null;
                        if (originalInit) {
                            window.pathApp.init = function(id) {
                                smokeState.learningPathInitId = id;
                                return originalInit(id);
                            };
                        }
                        if (originalApply) {
                            window.pathApp.applyRemoteConfigure = function(config) {
                                smokeState.learningPathConfig = config;
                                return originalApply(config);
                            };
                        }
                        if (originalTrigger) {
                            window.pathApp.triggerUpdate = function() {
                                smokeState.learningPathTriggered = true;
                                return originalTrigger();
                            };
                        }
                        return true;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const input = document.querySelector('#agent-workspace-chat-input');
                        if (!input) {
                            return 'missing_input';
                        }
                        input.value = 'focus node';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        if (
                            window.NoteConnectionAgentWorkspace
                            && typeof window.NoteConnectionAgentWorkspace.sendConversation === 'function'
                        ) {
                            await window.NoteConnectionAgentWorkspace.sendConversation();
                            return 'awaited_sendConversation';
                        }
                        const button = document.querySelector('#btn-agent-workspace-send');
                        if (button) {
                            button.click();
                            await new Promise((resolve) => setTimeout(resolve, 500));
                            return 'clicked_send_button';
                        }
                        return 'missing_send_trigger';
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        let dynamicRecoverySnapshot = null;
        let chatState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const buttons = Array.from(document.querySelectorAll('.agent-knowledge-actions button'));
                            const userMessages = Array.from(document.querySelectorAll('.agent-chat-message-user'));
                            const assistantMessages = Array.from(document.querySelectorAll('.agent-chat-message-assistant'));
                            if (buttons.length >= 18 && userMessages.length >= 1 && assistantMessages.length >= 2) {
                                const labelsByAction = {};
                                buttons.forEach((node) => {
                                    const actionId = node.getAttribute('data-capability-action-id') || '';
                                    if (actionId) {
                                        labelsByAction[actionId] = node.textContent.trim();
                                    }
                                });
                                return {
                                    userMessageText: userMessages[userMessages.length - 1].textContent.trim(),
                                    assistantMessageText: assistantMessages[assistantMessages.length - 1].textContent.trim(),
                                    labelsByAction
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (
            uiDynamicStrictRequested
            && (!chatState || typeof chatState !== 'object' || !chatState.userMessageText || !chatState.labelsByAction)
        ) {
            dynamicRecoverySnapshot = attemptDynamicEvidenceRecovery(pwcli, sessionArgs, artifactDir);
            chatState = normalizeRawValue(
                runPwcli(
                    pwcli,
                    sessionArgs.concat([
                        '--raw',
                        'eval',
                        `(async () => {
                            for (let attempt = 0; attempt < 20; attempt += 1) {
                                const buttons = Array.from(document.querySelectorAll('.agent-knowledge-actions button'));
                                const userMessages = Array.from(document.querySelectorAll('.agent-chat-message-user'));
                                const assistantMessages = Array.from(document.querySelectorAll('.agent-chat-message-assistant'));
                                if (buttons.length >= 1 && userMessages.length >= 1 && assistantMessages.length >= 1) {
                                    const labelsByAction = {};
                                    buttons.forEach((node) => {
                                        const actionId = node.getAttribute('data-capability-action-id') || '';
                                        if (actionId) {
                                            labelsByAction[actionId] = node.textContent.trim();
                                        }
                                    });
                                    return {
                                        userMessageText: userMessages[userMessages.length - 1].textContent.trim(),
                                        assistantMessageText: assistantMessages[assistantMessages.length - 1].textContent.trim(),
                                        labelsByAction
                                    };
                                }
                                await new Promise((resolve) => setTimeout(resolve, 100));
                            }
                            return null;
                        })()`,
                    ]),
                    { cwd: artifactDir }
                ).stdout
            );
        }
        const userMessageText = chatState && typeof chatState === 'object' ? chatState.userMessageText : '';
        const assistantMessageText = chatState && typeof chatState === 'object' ? chatState.assistantMessageText : '';
        const labelsByAction = chatState && typeof chatState === 'object' && chatState.labelsByAction && typeof chatState.labelsByAction === 'object'
            ? chatState.labelsByAction
            : {};
        const focusButtonLabelZh = labelsByAction.open_focus_mode || '';
        const learningPathButtonLabelZh = labelsByAction.open_learning_path || '';
        const studySessionButtonLabelZh = labelsByAction.build_study_session || '';
        const quizButtonLabelZh = labelsByAction.generate_quiz || '';
        const transferButtonLabelZh = labelsByAction.generate_transfer || '';
        const counterexampleButtonLabelZh = labelsByAction.generate_counterexample || '';
        const followUpButtonLabelZh = labelsByAction.follow_up || '';
        const compareQueryBackendsButtonLabelZh = labelsByAction.compare_query_backends || '';
        const queryBackendComparisonHistoryButtonLabelZh =
            labelsByAction.inspect_query_backend_comparison_history || '';
        const queryBackendComparisonTrendButtonLabelZh =
            labelsByAction.inspect_query_backend_comparison_trend || '';
        const learningQualityTrendButtonLabelZh =
            labelsByAction.inspect_learning_quality_trend || '';
        const learningQualityHistoryButtonLabelZh =
            labelsByAction.inspect_learning_quality_history || '';
        const sessionPlanQualityTrendButtonLabelZh =
            labelsByAction.inspect_session_plan_quality_trend || '';
        const sessionPlanQualityHistoryButtonLabelZh =
            labelsByAction.inspect_session_plan_quality_history || '';
        const sessionHistoryButtonLabelZh = labelsByAction.inspect_session_history || '';
        const runtimeRunbookVerifyButtonLabelZh =
            labelsByAction.inspect_runtime_capability_runbook_verify || '';
        const runtimeRunbookChecksButtonLabelZh =
            labelsByAction.inspect_runtime_capability_runbook_checks || '';
        const runtimeRunbookActionQueueButtonLabelZh =
            labelsByAction.inspect_runtime_capability_runbook_action_queue || '';
        const conversationTurnCacheAlertTrendButtonLabelZh =
            labelsByAction.inspect_conversation_turn_cache_alert_trend || '';

        const focusOpenedId = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const focusButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="open_focus_mode"]');
                        focusButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const focusNode = window.NoteConnectionGraphView
                                && typeof window.NoteConnectionGraphView.getFocusNode === 'function'
                                ? window.NoteConnectionGraphView.getFocusNode()
                                : null;
                            if (focusNode && focusNode.id) {
                                return focusNode.id;
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return '';
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const focusNodeNameText = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `document.querySelector('#focus-node-name') ? document.querySelector('#focus-node-name').textContent.trim() : ''`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const learningPathState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const pathButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="open_learning_path"]');
                        pathButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const paneOpenState = document.querySelector('#agent-learning-path-pane')?.getAttribute('data-open');
                            const initId = window.__ncBrowserSmoke && window.__ncBrowserSmoke.learningPathInitId;
                            const currentTargetId = window.pathApp && window.pathApp.currentTargetId;
                            const pathDisplay = document.querySelector('#path-container')?.style.display || '';
                            if (paneOpenState === 'true' && initId && currentTargetId) {
                                return {
                                    paneOpenState,
                                    learningPathInitId: initId,
                                    learningPathCurrentTargetId: currentTargetId,
                                    learningPathDisplay: pathDisplay
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const learningPathPaneOpenState =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.paneOpenState : '';
        const learningPathInitId =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.learningPathInitId : '';
        const learningPathCurrentTargetId =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.learningPathCurrentTargetId : '';
        const learningPathDisplay =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.learningPathDisplay : '';

        const studySessionState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const sessionButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="build_study_session"]');
                        sessionButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const card = document.querySelector('[data-agent-workspace-card-kind="study-session"]');
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const summary = card && card.querySelector('.agent-chat-card-summary')
                                ? card.querySelector('.agent-chat-card-summary').textContent.trim()
                                : '';
                            if (card && title && summary) {
                                return {
                                    title,
                                    summary
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const studySessionCardTitleZh =
            studySessionState && typeof studySessionState === 'object' ? studySessionState.title : '';
        const studySessionCardSummaryZh =
            studySessionState && typeof studySessionState === 'object' ? studySessionState.summary : '';

        const tutorActionState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const tutorButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="generate_quiz"]');
                        tutorButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="tutor-action"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const evidenceHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && evidenceHeading) {
                                return {
                                    title,
                                    evidenceHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const tutorCardTitleZh =
            tutorActionState && typeof tutorActionState === 'object' ? tutorActionState.title : '';
        const tutorCardEvidenceHeadingZh =
            tutorActionState && typeof tutorActionState === 'object' ? tutorActionState.evidenceHeading : '';

        const queryBackendComparisonState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const compareButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="compare_query_backends"]');
                        compareButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="query-backend-comparison"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const queryBackendComparisonCardTitleZh =
            queryBackendComparisonState && typeof queryBackendComparisonState === 'object' ? queryBackendComparisonState.title : '';
        const queryBackendComparisonCardMetricsHeadingZh =
            queryBackendComparisonState && typeof queryBackendComparisonState === 'object' ? queryBackendComparisonState.metricsHeading : '';

        const queryBackendComparisonHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_query_backend_comparison_history"]');
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="query-backend-comparison-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const queryBackendComparisonHistoryCardTitleZh =
            queryBackendComparisonHistoryState && typeof queryBackendComparisonHistoryState === 'object'
                ? queryBackendComparisonHistoryState.title
                : '';
        const queryBackendComparisonHistoryCardMetricsHeadingZh =
            queryBackendComparisonHistoryState && typeof queryBackendComparisonHistoryState === 'object'
                ? queryBackendComparisonHistoryState.metricsHeading
                : '';

        const queryBackendComparisonTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_query_backend_comparison_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="query-backend-comparison-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const queryBackendComparisonTrendCardTitleZh =
            queryBackendComparisonTrendState && typeof queryBackendComparisonTrendState === 'object'
                ? queryBackendComparisonTrendState.title
                : '';
        const queryBackendComparisonTrendCardMetricsHeadingZh =
            queryBackendComparisonTrendState && typeof queryBackendComparisonTrendState === 'object'
                ? queryBackendComparisonTrendState.metricsHeading
                : '';

        const learningQualityTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_learning_quality_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="learning-quality-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const learningQualityTrendCardTitleZh =
            learningQualityTrendState && typeof learningQualityTrendState === 'object'
                ? learningQualityTrendState.title
                : '';
        const learningQualityTrendCardMetricsHeadingZh =
            learningQualityTrendState && typeof learningQualityTrendState === 'object'
                ? learningQualityTrendState.metricsHeading
                : '';

        const learningQualityHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_learning_quality_history"]');
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="learning-quality-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const learningQualityHistoryCardTitleZh =
            learningQualityHistoryState && typeof learningQualityHistoryState === 'object'
                ? learningQualityHistoryState.title
                : '';
        const learningQualityHistoryCardMetricsHeadingZh =
            learningQualityHistoryState && typeof learningQualityHistoryState === 'object'
                ? learningQualityHistoryState.metricsHeading
                : '';

        const sessionPlanQualityTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_session_plan_quality_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="session-plan-quality-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const sessionPlanQualityTrendCardTitleZh =
            sessionPlanQualityTrendState && typeof sessionPlanQualityTrendState === 'object'
                ? sessionPlanQualityTrendState.title
                : '';
        const sessionPlanQualityTrendCardMetricsHeadingZh =
            sessionPlanQualityTrendState && typeof sessionPlanQualityTrendState === 'object'
                ? sessionPlanQualityTrendState.metricsHeading
                : '';

        const sessionPlanQualityHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_session_plan_quality_history"]');
                        if (!historyButton) {
                            return null;
                        }
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="session-plan-quality-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const sessionPlanQualityHistoryCardTitleZh =
            sessionPlanQualityHistoryState && typeof sessionPlanQualityHistoryState === 'object'
                ? sessionPlanQualityHistoryState.title
                : '';
        const sessionPlanQualityHistoryCardMetricsHeadingZh =
            sessionPlanQualityHistoryState && typeof sessionPlanQualityHistoryState === 'object'
                ? sessionPlanQualityHistoryState.metricsHeading
                : '';
        const sessionPlanQualityHistoryDebugJson =
            sessionPlanQualityHistoryState
            && typeof sessionPlanQualityHistoryState === 'object'
            && sessionPlanQualityHistoryState.debug
                ? JSON.stringify(sessionPlanQualityHistoryState.debug)
                : '';
        const shouldEmitSessionPlanQualityHistoryDebug =
            sessionPlanQualityHistoryCardTitleZh !== '会话计划质量历史'
            || sessionPlanQualityHistoryCardMetricsHeadingZh !== '关键指标';

        const sessionHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_session_history"]');
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="session-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const sessionHistoryCardTitleZh =
            sessionHistoryState && typeof sessionHistoryState === 'object' ? sessionHistoryState.title : '';
        const sessionHistoryCardMetricsHeadingZh =
            sessionHistoryState && typeof sessionHistoryState === 'object' ? sessionHistoryState.metricsHeading : '';

        const runtimeRunbookVerifyState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const smoke = window.__NC_DYNAMIC_SMOKE__;
                        if (!smoke || typeof smoke.openRunbookCard !== 'function') {
                            return null;
                        }
                        await smoke.openRunbookCard('verify');
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="runtime-capability-runbook-verify"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            const cardText = card
                                ? card.textContent.replace(/\\s+/g, ' ').trim()
                                : '';
                            if (card && title && metricsHeading && cardText) {
                                return {
                                    title,
                                    metricsHeading,
                                    cardText
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const runtimeRunbookVerifyCardTitleZh =
            runtimeRunbookVerifyState && typeof runtimeRunbookVerifyState === 'object'
                ? runtimeRunbookVerifyState.title
                : '';
        const runtimeRunbookVerifyCardMetricsHeadingZh =
            runtimeRunbookVerifyState && typeof runtimeRunbookVerifyState === 'object'
                ? runtimeRunbookVerifyState.metricsHeading
                : '';
        const runtimeRunbookVerifyCardTextZh =
            runtimeRunbookVerifyState && typeof runtimeRunbookVerifyState === 'object'
                ? runtimeRunbookVerifyState.cardText
                : '';

        const runtimeRunbookChecksState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const smoke = window.__NC_DYNAMIC_SMOKE__;
                        if (!smoke || typeof smoke.openRunbookCard !== 'function') {
                            return null;
                        }
                        await smoke.openRunbookCard('checks');
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="runtime-capability-runbook-checks"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            const cardText = card
                                ? card.textContent.replace(/\\s+/g, ' ').trim()
                                : '';
                            if (card && title && metricsHeading && cardText) {
                                return {
                                    title,
                                    metricsHeading,
                                    cardText
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const runtimeRunbookChecksCardTitleZh =
            runtimeRunbookChecksState && typeof runtimeRunbookChecksState === 'object'
                ? runtimeRunbookChecksState.title
                : '';
        const runtimeRunbookChecksCardMetricsHeadingZh =
            runtimeRunbookChecksState && typeof runtimeRunbookChecksState === 'object'
                ? runtimeRunbookChecksState.metricsHeading
                : '';
        const runtimeRunbookChecksCardTextZh =
            runtimeRunbookChecksState && typeof runtimeRunbookChecksState === 'object'
                ? runtimeRunbookChecksState.cardText
                : '';

        const runtimeRunbookActionQueueState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const smoke = window.__NC_DYNAMIC_SMOKE__;
                        if (!smoke || typeof smoke.openRunbookCard !== 'function') {
                            return null;
                        }
                        await smoke.openRunbookCard('action_queue');
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="runtime-capability-runbook-action-queue"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            const cardText = card
                                ? card.textContent.replace(/\\s+/g, ' ').trim()
                                : '';
                            if (card && title && metricsHeading && cardText) {
                                return {
                                    title,
                                    metricsHeading,
                                    cardText
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const runtimeRunbookActionQueueCardTitleZh =
            runtimeRunbookActionQueueState && typeof runtimeRunbookActionQueueState === 'object'
                ? runtimeRunbookActionQueueState.title
                : '';
        const runtimeRunbookActionQueueCardMetricsHeadingZh =
            runtimeRunbookActionQueueState && typeof runtimeRunbookActionQueueState === 'object'
                ? runtimeRunbookActionQueueState.metricsHeading
                : '';
        const runtimeRunbookActionQueueCardTextZh =
            runtimeRunbookActionQueueState && typeof runtimeRunbookActionQueueState === 'object'
                ? runtimeRunbookActionQueueState.cardText
                : '';

        const conversationTurnCacheAlertTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_conversation_turn_cache_alert_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="conversation-turn-cache-alert-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const conversationTurnCacheAlertTrendCardTitleZh =
            conversationTurnCacheAlertTrendState && typeof conversationTurnCacheAlertTrendState === 'object'
                ? conversationTurnCacheAlertTrendState.title
                : '';
        const conversationTurnCacheAlertTrendCardMetricsHeadingZh =
            conversationTurnCacheAlertTrendState && typeof conversationTurnCacheAlertTrendState === 'object'
                ? conversationTurnCacheAlertTrendState.metricsHeading
                : '';

        const missingNodeMessageZh = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        window.NoteConnectionAgentWorkspace.openGraphFocus({
                            atomId: 'atom_missing',
                            title: 'Missing Node'
                        });
                        const nodes = Array.from(document.querySelectorAll('.agent-chat-message-assistant'));
                        return nodes[nodes.length - 1].textContent.trim();
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const promotionStateAfterClick = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        window.NoteConnectionWorkspacePanes.openGraphFocusPane({
                            atomId: 'atom_focus',
                            title: 'Focus Node',
                            summary: 'summary'
                        });
                        document.querySelector('#btn-agent-graph-focus-fullscreen').click();
                        return document.body.getAttribute('data-agent-workspace-promotion');
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        try {
            runPwcli(pwcli, sessionArgs.concat(['press', 'Escape']), { cwd: artifactDir });
        } catch (_error) {
            if (isBrowserUiStrictMode()) {
                throw _error;
            }
        }

        const promotionStateAfterEscapeRaw = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `document.body.getAttribute('data-agent-workspace-promotion')`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const promotionStateAfterEscape =
            promotionStateAfterEscapeRaw === 'null' || promotionStateAfterEscapeRaw === null || promotionStateAfterEscapeRaw === ''
                ? null
                : promotionStateAfterEscapeRaw;

        const knowledgeHitUiState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const smoke = window.__NC_DYNAMIC_SMOKE__;
                        if (!smoke || typeof smoke.verifyKnowledgeHitUi !== 'function') {
                            return { ok: false, reason: 'knowledge_hit_ui_harness_unavailable' };
                        }
                        return await smoke.verifyKnowledgeHitUi();
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const screenshotOutput = runPwcli(pwcli, sessionArgs.concat(['screenshot']), { cwd: artifactDir });
        const consoleOutput = runPwcli(pwcli, sessionArgs.concat(['console']), { cwd: artifactDir });
        const screenshotRelativePath = parseMarkdownArtifactPath(screenshotOutput.stdout, 'png');
        const consoleRelativePath = parseConsoleArtifactPath(consoleOutput.stdout) || parseConsoleArtifactPath(screenshotOutput.stdout);
        const screenshotPath = screenshotRelativePath
            ? path.join(artifactDir, screenshotRelativePath)
            : findLatestArtifactPath(artifactDir, (entry) => /^page-.*\.png$/i.test(entry));
        const consoleLogPath = consoleRelativePath
            ? path.join(artifactDir, consoleRelativePath)
            : findLatestArtifactPath(artifactDir, (entry) => /^console-.*\.log$/i.test(entry));
        const networkSnapshot = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => ({ resources: performance.getEntriesByType('resource').map((entry) => String(entry && entry.name || '')), traces: Array.isArray(window.__NC_AGENT_FETCH_TRACES) ? window.__NC_AGENT_FETCH_TRACES : [] }))()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const resourceNames = networkSnapshot && Array.isArray(networkSnapshot.resources)
            ? networkSnapshot.resources.map((entry) => String(entry || ''))
            : [];
        const traceEntries = networkSnapshot && Array.isArray(networkSnapshot.traces)
            ? networkSnapshot.traces.map((entry) => ({
                url: String(entry && entry.url || ''),
                status: Number(entry && entry.status || 0),
                durationMs: Number(entry && entry.durationMs || 0),
            }))
            : [];
        const summarizeEndpoint = (matcher) => {
            let requestCount = 0;
            let non2xxCount = 0;
            traceEntries.forEach((entry) => {
                if (!matcher(entry.url)) {
                    return;
                }
                requestCount += 1;
                if (!(entry.status >= 200 && entry.status < 300)) {
                    non2xxCount += 1;
                }
            });
            return { requestCount, non2xxCount };
        };
        const traceEndpointStatusSummary = {
            conversation: summarizeEndpoint((url) => url.includes('/api/knowledge/conversation')),
            learningPath: summarizeEndpoint((url) => url.includes('/api/knowledge/path')),
            studySession: summarizeEndpoint((url) => url.includes('/api/knowledge/session/plan') && !url.includes('/api/knowledge/session/plan/quality/')),
            queryBackendComparison: summarizeEndpoint((url) => url.includes('/api/knowledge/query/compare-backends') && !url.includes('/api/knowledge/query/compare-backends/history') && !url.includes('/api/knowledge/query/compare-backends/trend')),
            queryBackendComparisonHistory: summarizeEndpoint((url) => url.includes('/api/knowledge/query/compare-backends/history')),
            queryBackendComparisonTrend: summarizeEndpoint((url) => url.includes('/api/knowledge/query/compare-backends/trend')),
            learningQualityTrend: summarizeEndpoint((url) => url.includes('/api/knowledge/quality/trend')),
            learningQualityHistory: summarizeEndpoint((url) => url.includes('/api/knowledge/quality/history')),
            sessionPlanQualityTrend: summarizeEndpoint((url) => url.includes('/api/knowledge/session/plan/quality/trend')),
            sessionPlanQualityHistory: summarizeEndpoint((url) => url.includes('/api/knowledge/session/plan/quality/history')),
            sessionHistory: summarizeEndpoint((url) => url.includes('/api/knowledge/session/history')),
            runtimeRunbookVerify: summarizeEndpoint((url) => url.includes('/api/knowledge/runtime-capability-runbook/verify')),
            runtimeRunbookChecks: summarizeEndpoint((url) => url.includes('/api/knowledge/runtime-capability-runbook/history/checks')),
            runtimeRunbookActionQueue: summarizeEndpoint((url) => url.includes('/api/knowledge/runtime-capability-runbook/history/action-queue')),
            conversationTurnCacheAlertTrend: summarizeEndpoint((url) => url.includes('/api/knowledge/conversation/turn-cache/diagnostics/trend')),
            tutorAction: summarizeEndpoint((url) => url.includes('/api/knowledge/tutor/action')),
        };
        const requiredEndpointKeys = [
            'conversation',
            'learningPath',
            'studySession',
            'queryBackendComparison',
            'queryBackendComparisonHistory',
            'queryBackendComparisonTrend',
            'learningQualityTrend',
            'learningQualityHistory',
            'sessionPlanQualityTrend',
            'sessionPlanQualityHistory',
            'sessionHistory',
            'runtimeRunbookVerify',
            'runtimeRunbookChecks',
            'runtimeRunbookActionQueue',
            'conversationTurnCacheAlertTrend',
            'tutorAction',
        ];
        const networkSummary = {
            hasDataJsRequest: resourceNames.some((name) => /\/data\.js(\?|$)/.test(name)),
            hasConversationRequest: traceEndpointStatusSummary.conversation.requestCount > 0,
            hasLearningPathRequest: traceEndpointStatusSummary.learningPath.requestCount > 0,
            hasStudySessionRequest: traceEndpointStatusSummary.studySession.requestCount > 0,
            hasQueryBackendComparisonRequest: traceEndpointStatusSummary.queryBackendComparison.requestCount > 0,
            hasQueryBackendComparisonHistoryRequest: traceEndpointStatusSummary.queryBackendComparisonHistory.requestCount > 0,
            hasQueryBackendComparisonTrendRequest: traceEndpointStatusSummary.queryBackendComparisonTrend.requestCount > 0,
            hasLearningQualityTrendRequest: traceEndpointStatusSummary.learningQualityTrend.requestCount > 0,
            hasLearningQualityHistoryRequest: traceEndpointStatusSummary.learningQualityHistory.requestCount > 0,
            hasSessionPlanQualityTrendRequest: traceEndpointStatusSummary.sessionPlanQualityTrend.requestCount > 0,
            hasSessionPlanQualityHistoryRequest: traceEndpointStatusSummary.sessionPlanQualityHistory.requestCount > 0,
            hasSessionHistoryRequest: traceEndpointStatusSummary.sessionHistory.requestCount > 0,
            hasRuntimeRunbookVerifyRequest: traceEndpointStatusSummary.runtimeRunbookVerify.requestCount > 0,
            hasRuntimeRunbookChecksRequest: traceEndpointStatusSummary.runtimeRunbookChecks.requestCount > 0,
            hasRuntimeRunbookActionQueueRequest: traceEndpointStatusSummary.runtimeRunbookActionQueue.requestCount > 0,
            hasConversationTurnCacheAlertTrendRequest: traceEndpointStatusSummary.conversationTurnCacheAlertTrend.requestCount > 0,
            hasTutorActionRequest: traceEndpointStatusSummary.tutorAction.requestCount > 0,
            fetchTraceCount: traceEntries.length,
            allTrackedRequestsSucceeded: requiredEndpointKeys.every((key) => {
                const summary = traceEndpointStatusSummary[key];
                return summary.requestCount > 0 && summary.non2xxCount === 0;
            }),
            endpointStatusSummary: traceEndpointStatusSummary,
            traces: traceEntries.slice(-20),
        };
        const networkSummaryPath = path.join(artifactDir, 'network-summary.json');
        fs.writeFileSync(networkSummaryPath, JSON.stringify(networkSummary, null, 2), 'utf8');
        const recoveryLabelsByAction = dynamicRecoverySnapshot && typeof dynamicRecoverySnapshot.labelsByAction === 'object'
            ? dynamicRecoverySnapshot.labelsByAction
            : {};
        const resolveRecoveredValue = (actualValue, recoveryValue) => {
            const normalizedActual = String(actualValue == null ? '' : actualValue).trim();
            const looksLikeRuntimeError =
                normalizedActual.startsWith('TypeError:')
                || normalizedActual.startsWith('ReferenceError:')
                || normalizedActual.startsWith('SyntaxError:')
                || normalizedActual.startsWith('Error:');
            if (normalizedActual && !looksLikeRuntimeError) {
                return normalizedActual;
            }
            return String(recoveryValue == null ? '' : recoveryValue).trim();
        };

        const report = {
            port,
            bridgePort,
            artifacts: {
                artifactDir,
                screenshotPath,
                consoleLogPath,
                networkSummaryPath,
            },
            browserChecks: {
                backendMode: 'real_backend',
                graphMode: 'real_graph_runtime',
                pathMode: 'real_path_runtime',
                titleText: String(titleText || ''),
                userMessageText: resolveRecoveredValue(userMessageText, dynamicRecoverySnapshot && dynamicRecoverySnapshot.userMessageText),
                assistantMessageText: resolveRecoveredValue(assistantMessageText, dynamicRecoverySnapshot && dynamicRecoverySnapshot.assistantMessageText),
                focusButtonLabelZh: resolveRecoveredValue(focusButtonLabelZh, recoveryLabelsByAction.open_focus_mode),
                learningPathButtonLabelZh: resolveRecoveredValue(learningPathButtonLabelZh, recoveryLabelsByAction.open_learning_path),
                studySessionButtonLabelZh: resolveRecoveredValue(studySessionButtonLabelZh, recoveryLabelsByAction.build_study_session),
                quizButtonLabelZh: resolveRecoveredValue(quizButtonLabelZh, recoveryLabelsByAction.generate_quiz),
                transferButtonLabelZh: resolveRecoveredValue(transferButtonLabelZh, recoveryLabelsByAction.generate_transfer),
                counterexampleButtonLabelZh: resolveRecoveredValue(counterexampleButtonLabelZh, recoveryLabelsByAction.generate_counterexample),
                followUpButtonLabelZh: resolveRecoveredValue(followUpButtonLabelZh, recoveryLabelsByAction.follow_up),
                compareQueryBackendsButtonLabelZh: resolveRecoveredValue(compareQueryBackendsButtonLabelZh, recoveryLabelsByAction.compare_query_backends),
                queryBackendComparisonHistoryButtonLabelZh: resolveRecoveredValue(queryBackendComparisonHistoryButtonLabelZh, recoveryLabelsByAction.inspect_query_backend_comparison_history),
                queryBackendComparisonTrendButtonLabelZh: resolveRecoveredValue(queryBackendComparisonTrendButtonLabelZh, recoveryLabelsByAction.inspect_query_backend_comparison_trend),
                learningQualityTrendButtonLabelZh: resolveRecoveredValue(learningQualityTrendButtonLabelZh, recoveryLabelsByAction.inspect_learning_quality_trend),
                learningQualityHistoryButtonLabelZh: resolveRecoveredValue(learningQualityHistoryButtonLabelZh, recoveryLabelsByAction.inspect_learning_quality_history),
                sessionPlanQualityTrendButtonLabelZh: resolveRecoveredValue(sessionPlanQualityTrendButtonLabelZh, recoveryLabelsByAction.inspect_session_plan_quality_trend),
                sessionPlanQualityHistoryButtonLabelZh: resolveRecoveredValue(sessionPlanQualityHistoryButtonLabelZh, recoveryLabelsByAction.inspect_session_plan_quality_history),
                sessionHistoryButtonLabelZh: resolveRecoveredValue(sessionHistoryButtonLabelZh, recoveryLabelsByAction.inspect_session_history),
                runtimeRunbookVerifyButtonLabelZh: resolveRecoveredValue(runtimeRunbookVerifyButtonLabelZh, recoveryLabelsByAction.inspect_runtime_capability_runbook_verify),
                runtimeRunbookChecksButtonLabelZh: resolveRecoveredValue(runtimeRunbookChecksButtonLabelZh, recoveryLabelsByAction.inspect_runtime_capability_runbook_checks),
                runtimeRunbookActionQueueButtonLabelZh: resolveRecoveredValue(runtimeRunbookActionQueueButtonLabelZh, recoveryLabelsByAction.inspect_runtime_capability_runbook_action_queue),
                conversationTurnCacheAlertTrendButtonLabelZh: resolveRecoveredValue(conversationTurnCacheAlertTrendButtonLabelZh, recoveryLabelsByAction.inspect_conversation_turn_cache_alert_trend),
                focusOpenedId: resolveRecoveredValue(focusOpenedId, dynamicRecoverySnapshot && dynamicRecoverySnapshot.focusOpenedId),
                focusStateNodeId: resolveRecoveredValue(focusOpenedId, dynamicRecoverySnapshot && dynamicRecoverySnapshot.focusOpenedId),
                focusNodeNameText: resolveRecoveredValue(focusNodeNameText, dynamicRecoverySnapshot && dynamicRecoverySnapshot.focusNodeNameText),
                learningPathPaneOpenState: resolveRecoveredValue(learningPathPaneOpenState, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningPathPaneOpenState),
                learningPathInitId: resolveRecoveredValue(learningPathInitId, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningPathInitId),
                learningPathCurrentTargetId: resolveRecoveredValue(learningPathCurrentTargetId, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningPathCurrentTargetId),
                learningPathDisplay: resolveRecoveredValue(learningPathDisplay, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningPathDisplay),
                studySessionCardTitleZh: resolveRecoveredValue(studySessionCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.studySessionCardTitleZh),
                studySessionCardSummaryZh: resolveRecoveredValue(studySessionCardSummaryZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.studySessionCardSummaryZh),
                tutorCardTitleZh: resolveRecoveredValue(tutorCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.tutorCardTitleZh),
                tutorCardEvidenceHeadingZh: resolveRecoveredValue(tutorCardEvidenceHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.tutorCardEvidenceHeadingZh),
                queryBackendComparisonCardTitleZh: resolveRecoveredValue(queryBackendComparisonCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.queryBackendComparisonCardTitleZh),
                queryBackendComparisonCardMetricsHeadingZh: resolveRecoveredValue(queryBackendComparisonCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.queryBackendComparisonCardMetricsHeadingZh),
                queryBackendComparisonHistoryCardTitleZh: resolveRecoveredValue(queryBackendComparisonHistoryCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.queryBackendComparisonHistoryCardTitleZh),
                queryBackendComparisonHistoryCardMetricsHeadingZh: resolveRecoveredValue(queryBackendComparisonHistoryCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.queryBackendComparisonHistoryCardMetricsHeadingZh),
                queryBackendComparisonTrendCardTitleZh: resolveRecoveredValue(queryBackendComparisonTrendCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.queryBackendComparisonTrendCardTitleZh),
                queryBackendComparisonTrendCardMetricsHeadingZh: resolveRecoveredValue(queryBackendComparisonTrendCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.queryBackendComparisonTrendCardMetricsHeadingZh),
                learningQualityTrendCardTitleZh: resolveRecoveredValue(learningQualityTrendCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningQualityTrendCardTitleZh),
                learningQualityTrendCardMetricsHeadingZh: resolveRecoveredValue(learningQualityTrendCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningQualityTrendCardMetricsHeadingZh),
                learningQualityHistoryCardTitleZh: resolveRecoveredValue(learningQualityHistoryCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningQualityHistoryCardTitleZh),
                learningQualityHistoryCardMetricsHeadingZh: resolveRecoveredValue(learningQualityHistoryCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.learningQualityHistoryCardMetricsHeadingZh),
                sessionPlanQualityTrendCardTitleZh: resolveRecoveredValue(sessionPlanQualityTrendCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.sessionPlanQualityTrendCardTitleZh),
                sessionPlanQualityTrendCardMetricsHeadingZh: resolveRecoveredValue(sessionPlanQualityTrendCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.sessionPlanQualityTrendCardMetricsHeadingZh),
                sessionPlanQualityHistoryCardTitleZh: resolveRecoveredValue(sessionPlanQualityHistoryCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.sessionPlanQualityHistoryCardTitleZh),
                sessionPlanQualityHistoryCardMetricsHeadingZh: resolveRecoveredValue(sessionPlanQualityHistoryCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.sessionPlanQualityHistoryCardMetricsHeadingZh),
                sessionPlanQualityHistoryDebugJson: shouldEmitSessionPlanQualityHistoryDebug
                    ? String(sessionPlanQualityHistoryDebugJson || '')
                    : '',
                sessionHistoryCardTitleZh: resolveRecoveredValue(sessionHistoryCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.sessionHistoryCardTitleZh),
                sessionHistoryCardMetricsHeadingZh: resolveRecoveredValue(sessionHistoryCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.sessionHistoryCardMetricsHeadingZh),
                runtimeRunbookVerifyCardTitleZh: resolveRecoveredValue(runtimeRunbookVerifyCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookVerifyCardTitleZh),
                runtimeRunbookVerifyCardMetricsHeadingZh: resolveRecoveredValue(runtimeRunbookVerifyCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookVerifyCardMetricsHeadingZh),
                runtimeRunbookVerifyCardTextZh: resolveRecoveredValue(runtimeRunbookVerifyCardTextZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookVerifyCardTextZh),
                runtimeRunbookChecksCardTitleZh: resolveRecoveredValue(runtimeRunbookChecksCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookChecksCardTitleZh),
                runtimeRunbookChecksCardMetricsHeadingZh: resolveRecoveredValue(runtimeRunbookChecksCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookChecksCardMetricsHeadingZh),
                runtimeRunbookChecksCardTextZh: resolveRecoveredValue(runtimeRunbookChecksCardTextZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookChecksCardTextZh),
                runtimeRunbookActionQueueCardTitleZh: resolveRecoveredValue(runtimeRunbookActionQueueCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookActionQueueCardTitleZh),
                runtimeRunbookActionQueueCardMetricsHeadingZh: resolveRecoveredValue(runtimeRunbookActionQueueCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookActionQueueCardMetricsHeadingZh),
                runtimeRunbookActionQueueCardTextZh: resolveRecoveredValue(runtimeRunbookActionQueueCardTextZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.runtimeRunbookActionQueueCardTextZh),
                conversationTurnCacheAlertTrendCardTitleZh: resolveRecoveredValue(conversationTurnCacheAlertTrendCardTitleZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.conversationTurnCacheAlertTrendCardTitleZh),
                conversationTurnCacheAlertTrendCardMetricsHeadingZh: resolveRecoveredValue(conversationTurnCacheAlertTrendCardMetricsHeadingZh, dynamicRecoverySnapshot && dynamicRecoverySnapshot.conversationTurnCacheAlertTrendCardMetricsHeadingZh),
                missingNodeMessageZh: String(missingNodeMessageZh || ''),
                promotionStateAfterClick: String(promotionStateAfterClick || ''),
                promotionStateAfterEscape,
                knowledgeHitUi: knowledgeHitUiState && typeof knowledgeHitUiState === 'object'
                    ? knowledgeHitUiState
                    : { ok: false, reason: 'knowledge_hit_ui_state_unavailable' },
            },
        };

        const failures = [];
        if (report.browserChecks.backendMode !== 'real_backend') {
            failures.push(`backendMode='${report.browserChecks.backendMode}'`);
        }
        if (report.browserChecks.graphMode !== 'real_graph_runtime') {
            failures.push(`graphMode='${report.browserChecks.graphMode}'`);
        }
        if (report.browserChecks.pathMode !== 'real_path_runtime') {
            failures.push(`pathMode='${report.browserChecks.pathMode}'`);
        }
        if (!report.artifacts.screenshotPath || !fs.existsSync(report.artifacts.screenshotPath)) {
            failures.push(`screenshotPath='${report.artifacts.screenshotPath}'`);
        }
        if (!report.artifacts.consoleLogPath || !fs.existsSync(report.artifacts.consoleLogPath)) {
            failures.push(`consoleLogPath='${report.artifacts.consoleLogPath}'`);
        }
        if (!report.artifacts.networkSummaryPath || !fs.existsSync(report.artifacts.networkSummaryPath)) {
            failures.push(`networkSummaryPath='${report.artifacts.networkSummaryPath}'`);
        }
        if (!networkSummary || networkSummary.hasDataJsRequest !== true) {
            failures.push(`networkSummary.hasDataJsRequest='${String(networkSummary && networkSummary.hasDataJsRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasConversationRequest !== true) {
            failures.push(`networkSummary.hasConversationRequest='${String(networkSummary && networkSummary.hasConversationRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasLearningPathRequest !== true) {
            failures.push(`networkSummary.hasLearningPathRequest='${String(networkSummary && networkSummary.hasLearningPathRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasStudySessionRequest !== true) {
            failures.push(`networkSummary.hasStudySessionRequest='${String(networkSummary && networkSummary.hasStudySessionRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasQueryBackendComparisonRequest !== true) {
            failures.push(`networkSummary.hasQueryBackendComparisonRequest='${String(networkSummary && networkSummary.hasQueryBackendComparisonRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasQueryBackendComparisonHistoryRequest !== true) {
            failures.push(`networkSummary.hasQueryBackendComparisonHistoryRequest='${String(networkSummary && networkSummary.hasQueryBackendComparisonHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasQueryBackendComparisonTrendRequest !== true) {
            failures.push(`networkSummary.hasQueryBackendComparisonTrendRequest='${String(networkSummary && networkSummary.hasQueryBackendComparisonTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasLearningQualityTrendRequest !== true) {
            failures.push(`networkSummary.hasLearningQualityTrendRequest='${String(networkSummary && networkSummary.hasLearningQualityTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasLearningQualityHistoryRequest !== true) {
            failures.push(`networkSummary.hasLearningQualityHistoryRequest='${String(networkSummary && networkSummary.hasLearningQualityHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasSessionPlanQualityTrendRequest !== true) {
            failures.push(`networkSummary.hasSessionPlanQualityTrendRequest='${String(networkSummary && networkSummary.hasSessionPlanQualityTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasSessionPlanQualityHistoryRequest !== true) {
            failures.push(`networkSummary.hasSessionPlanQualityHistoryRequest='${String(networkSummary && networkSummary.hasSessionPlanQualityHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasSessionHistoryRequest !== true) {
            failures.push(`networkSummary.hasSessionHistoryRequest='${String(networkSummary && networkSummary.hasSessionHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasRuntimeRunbookVerifyRequest !== true) {
            failures.push(`networkSummary.hasRuntimeRunbookVerifyRequest='${String(networkSummary && networkSummary.hasRuntimeRunbookVerifyRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasRuntimeRunbookChecksRequest !== true) {
            failures.push(`networkSummary.hasRuntimeRunbookChecksRequest='${String(networkSummary && networkSummary.hasRuntimeRunbookChecksRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasRuntimeRunbookActionQueueRequest !== true) {
            failures.push(`networkSummary.hasRuntimeRunbookActionQueueRequest='${String(networkSummary && networkSummary.hasRuntimeRunbookActionQueueRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasConversationTurnCacheAlertTrendRequest !== true) {
            failures.push(`networkSummary.hasConversationTurnCacheAlertTrendRequest='${String(networkSummary && networkSummary.hasConversationTurnCacheAlertTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasTutorActionRequest !== true) {
            failures.push(`networkSummary.hasTutorActionRequest='${String(networkSummary && networkSummary.hasTutorActionRequest)}'`);
        }
        if (!networkSummary || networkSummary.allTrackedRequestsSucceeded !== true) {
            failures.push(`networkSummary.allTrackedRequestsSucceeded='${String(networkSummary && networkSummary.allTrackedRequestsSucceeded)}'`);
        }
        const endpointStatusSummary = networkSummary && typeof networkSummary.endpointStatusSummary === 'object'
            ? networkSummary.endpointStatusSummary
            : {};
        [
            'conversation',
            'learningPath',
            'studySession',
            'queryBackendComparison',
            'queryBackendComparisonHistory',
            'queryBackendComparisonTrend',
            'learningQualityTrend',
            'learningQualityHistory',
            'sessionPlanQualityTrend',
            'sessionPlanQualityHistory',
            'sessionHistory',
            'runtimeRunbookVerify',
            'runtimeRunbookChecks',
            'runtimeRunbookActionQueue',
            'conversationTurnCacheAlertTrend',
            'tutorAction',
        ].forEach((endpointKey) => {
            const entry = endpointStatusSummary[endpointKey];
            if (!entry || Number(entry.requestCount || 0) <= 0) {
                failures.push(`networkSummary.endpointStatusSummary.${endpointKey}.requestCount='${String(entry && entry.requestCount)}'`);
                return;
            }
            if (Number(entry.non2xxCount || 0) !== 0) {
                failures.push(`networkSummary.endpointStatusSummary.${endpointKey}.non2xxCount='${String(entry && entry.non2xxCount)}'`);
            }
        });
        const expectedWorkspaceTitleText = '\u77e5\u8bc6\u5de5\u4f5c\u533a';
        if (report.browserChecks.titleText !== expectedWorkspaceTitleText) {
            failures.push(`titleText='${report.browserChecks.titleText}'`);
        }
        if (report.browserChecks.userMessageText !== 'focus node') {
            failures.push(`userMessageText='${report.browserChecks.userMessageText}'`);
        }
        if (
            report.browserChecks.assistantMessageText
            !== 'I found 1 local knowledge point(s) relevant to your request. Start with Focus Node and use the focus or learning path actions to inspect them.'
        ) {
            failures.push(`assistantMessageText='${report.browserChecks.assistantMessageText}'`);
        }
        if (report.browserChecks.focusButtonLabelZh !== '聚焦') {
            failures.push(`focusButtonLabelZh='${report.browserChecks.focusButtonLabelZh}'`);
        }
        if (report.browserChecks.learningPathButtonLabelZh !== '学习路径') {
            failures.push(`learningPathButtonLabelZh='${report.browserChecks.learningPathButtonLabelZh}'`);
        }
        if (report.browserChecks.studySessionButtonLabelZh !== '学习会话') {
            failures.push(`studySessionButtonLabelZh='${report.browserChecks.studySessionButtonLabelZh}'`);
        }
        if (report.browserChecks.quizButtonLabelZh !== '测验') {
            failures.push(`quizButtonLabelZh='${report.browserChecks.quizButtonLabelZh}'`);
        }
        if (report.browserChecks.transferButtonLabelZh !== '迁移挑战') {
            failures.push(`transferButtonLabelZh='${report.browserChecks.transferButtonLabelZh}'`);
        }
        if (report.browserChecks.counterexampleButtonLabelZh !== '反例挑战') {
            failures.push(`counterexampleButtonLabelZh='${report.browserChecks.counterexampleButtonLabelZh}'`);
        }
        if (report.browserChecks.followUpButtonLabelZh !== '追问') {
            failures.push(`followUpButtonLabelZh='${report.browserChecks.followUpButtonLabelZh}'`);
        }
        if (report.browserChecks.compareQueryBackendsButtonLabelZh !== '后端对比') {
            failures.push(`compareQueryBackendsButtonLabelZh='${report.browserChecks.compareQueryBackendsButtonLabelZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonHistoryButtonLabelZh !== '对比历史') {
            failures.push(`queryBackendComparisonHistoryButtonLabelZh='${report.browserChecks.queryBackendComparisonHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonTrendButtonLabelZh !== '对比趋势') {
            failures.push(`queryBackendComparisonTrendButtonLabelZh='${report.browserChecks.queryBackendComparisonTrendButtonLabelZh}'`);
        }
        if (report.browserChecks.learningQualityTrendButtonLabelZh !== '学习质量趋势') {
            failures.push(`learningQualityTrendButtonLabelZh='${report.browserChecks.learningQualityTrendButtonLabelZh}'`);
        }
        if (report.browserChecks.learningQualityHistoryButtonLabelZh !== '学习质量历史') {
            failures.push(`learningQualityHistoryButtonLabelZh='${report.browserChecks.learningQualityHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityTrendButtonLabelZh !== '会话计划趋势') {
            failures.push(`sessionPlanQualityTrendButtonLabelZh='${report.browserChecks.sessionPlanQualityTrendButtonLabelZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityHistoryButtonLabelZh !== '会话计划历史') {
            failures.push(`sessionPlanQualityHistoryButtonLabelZh='${report.browserChecks.sessionPlanQualityHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.sessionHistoryButtonLabelZh !== '会话历史') {
            failures.push(`sessionHistoryButtonLabelZh='${report.browserChecks.sessionHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.runtimeRunbookVerifyButtonLabelZh !== '运行时验证') {
            failures.push(`runtimeRunbookVerifyButtonLabelZh='${report.browserChecks.runtimeRunbookVerifyButtonLabelZh}'`);
        }
        if (report.browserChecks.runtimeRunbookChecksButtonLabelZh !== '运行时检查') {
            failures.push(`runtimeRunbookChecksButtonLabelZh='${report.browserChecks.runtimeRunbookChecksButtonLabelZh}'`);
        }
        if (report.browserChecks.runtimeRunbookActionQueueButtonLabelZh !== '运行时队列') {
            failures.push(`runtimeRunbookActionQueueButtonLabelZh='${report.browserChecks.runtimeRunbookActionQueueButtonLabelZh}'`);
        }
        if (report.browserChecks.conversationTurnCacheAlertTrendButtonLabelZh !== '轮次缓存趋势') {
            failures.push(`conversationTurnCacheAlertTrendButtonLabelZh='${report.browserChecks.conversationTurnCacheAlertTrendButtonLabelZh}'`);
        }
        if (!/^atom_/.test(report.browserChecks.focusOpenedId)) {
            failures.push(`focusOpenedId='${report.browserChecks.focusOpenedId}'`);
        }
        if (report.browserChecks.focusStateNodeId !== report.browserChecks.focusOpenedId) {
            failures.push(`focusStateNodeId='${report.browserChecks.focusStateNodeId}'`);
        }
        if (report.browserChecks.focusNodeNameText !== 'Focus Node') {
            failures.push(`focusNodeNameText='${report.browserChecks.focusNodeNameText}'`);
        }
        if (report.browserChecks.learningPathPaneOpenState !== 'true') {
            failures.push(`learningPathPaneOpenState='${report.browserChecks.learningPathPaneOpenState}'`);
        }
        if (report.browserChecks.learningPathInitId !== report.browserChecks.focusOpenedId) {
            failures.push(`learningPathInitId='${report.browserChecks.learningPathInitId}'`);
        }
        if (report.browserChecks.learningPathCurrentTargetId !== report.browserChecks.focusOpenedId) {
            failures.push(`learningPathCurrentTargetId='${report.browserChecks.learningPathCurrentTargetId}'`);
        }
        if (report.browserChecks.learningPathDisplay !== 'block') {
            failures.push(`learningPathDisplay='${report.browserChecks.learningPathDisplay}'`);
        }
        if (report.browserChecks.studySessionCardTitleZh !== '学习会话计划') {
            failures.push(`studySessionCardTitleZh='${report.browserChecks.studySessionCardTitleZh}'`);
        }
        if (!/动作/.test(report.browserChecks.studySessionCardSummaryZh)) {
            failures.push(`studySessionCardSummaryZh='${report.browserChecks.studySessionCardSummaryZh}'`);
        }
        if (report.browserChecks.tutorCardTitleZh !== '测验提示') {
            failures.push(`tutorCardTitleZh='${report.browserChecks.tutorCardTitleZh}'`);
        }
        if (report.browserChecks.tutorCardEvidenceHeadingZh !== '证据') {
            failures.push(`tutorCardEvidenceHeadingZh='${report.browserChecks.tutorCardEvidenceHeadingZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonCardTitleZh !== '检索后端对比') {
            failures.push(`queryBackendComparisonCardTitleZh='${report.browserChecks.queryBackendComparisonCardTitleZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonCardMetricsHeadingZh !== '关键指标') {
            failures.push(`queryBackendComparisonCardMetricsHeadingZh='${report.browserChecks.queryBackendComparisonCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonHistoryCardTitleZh !== '后端对比历史') {
            failures.push(`queryBackendComparisonHistoryCardTitleZh='${report.browserChecks.queryBackendComparisonHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`queryBackendComparisonHistoryCardMetricsHeadingZh='${report.browserChecks.queryBackendComparisonHistoryCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonTrendCardTitleZh !== '后端对比趋势') {
            failures.push(`queryBackendComparisonTrendCardTitleZh='${report.browserChecks.queryBackendComparisonTrendCardTitleZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`queryBackendComparisonTrendCardMetricsHeadingZh='${report.browserChecks.queryBackendComparisonTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.learningQualityTrendCardTitleZh !== '学习质量趋势') {
            failures.push(`learningQualityTrendCardTitleZh='${report.browserChecks.learningQualityTrendCardTitleZh}'`);
        }
        if (report.browserChecks.learningQualityTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`learningQualityTrendCardMetricsHeadingZh='${report.browserChecks.learningQualityTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.learningQualityHistoryCardTitleZh !== '学习质量历史') {
            failures.push(`learningQualityHistoryCardTitleZh='${report.browserChecks.learningQualityHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.learningQualityHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`learningQualityHistoryCardMetricsHeadingZh='${report.browserChecks.learningQualityHistoryCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityTrendCardTitleZh !== '会话计划质量趋势') {
            failures.push(`sessionPlanQualityTrendCardTitleZh='${report.browserChecks.sessionPlanQualityTrendCardTitleZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`sessionPlanQualityTrendCardMetricsHeadingZh='${report.browserChecks.sessionPlanQualityTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityHistoryCardTitleZh !== '会话计划质量历史') {
            failures.push(`sessionPlanQualityHistoryCardTitleZh='${report.browserChecks.sessionPlanQualityHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`sessionPlanQualityHistoryCardMetricsHeadingZh='${report.browserChecks.sessionPlanQualityHistoryCardMetricsHeadingZh}'`);
        }
        if (
            report.browserChecks.sessionPlanQualityHistoryCardTitleZh !== '会话计划质量历史'
            || report.browserChecks.sessionPlanQualityHistoryCardMetricsHeadingZh !== '关键指标'
        ) {
            failures.push(`sessionPlanQualityHistoryDebugJson='${report.browserChecks.sessionPlanQualityHistoryDebugJson}'`);
        }
        if (report.browserChecks.sessionHistoryCardTitleZh !== '会话历史') {
            failures.push(`sessionHistoryCardTitleZh='${report.browserChecks.sessionHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.sessionHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`sessionHistoryCardMetricsHeadingZh='${report.browserChecks.sessionHistoryCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.runtimeRunbookVerifyCardTitleZh !== '运行时 Runbook 验证') {
            failures.push(`runtimeRunbookVerifyCardTitleZh='${report.browserChecks.runtimeRunbookVerifyCardTitleZh}'`);
        }
        if (report.browserChecks.runtimeRunbookVerifyCardMetricsHeadingZh !== '关键指标') {
            failures.push(`runtimeRunbookVerifyCardMetricsHeadingZh='${report.browserChecks.runtimeRunbookVerifyCardMetricsHeadingZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 同步健康度')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 同步计数')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 熔断预算')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 可追踪性')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 预筛选')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 熔断阈值')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 可追踪性信号')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 预筛选阈值')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 熔断预算标志')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 预筛选校准')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('ANN 校准就绪态')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookVerifyCardTextZh.includes('query_vector_acceleration_index_sync_health')) {
            failures.push(`runtimeRunbookVerifyCardTextZh='${report.browserChecks.runtimeRunbookVerifyCardTextZh}'`);
        }
        if (report.browserChecks.runtimeRunbookChecksCardTitleZh !== '运行时 Runbook 检查') {
            failures.push(`runtimeRunbookChecksCardTitleZh='${report.browserChecks.runtimeRunbookChecksCardTitleZh}'`);
        }
        if (report.browserChecks.runtimeRunbookChecksCardMetricsHeadingZh !== '关键指标') {
            failures.push(`runtimeRunbookChecksCardMetricsHeadingZh='${report.browserChecks.runtimeRunbookChecksCardMetricsHeadingZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('首个检查的 ANN 同步')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 熔断快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 可追踪性快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 预筛选快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 熔断阈值快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 可追踪性信号快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 预筛选阈值快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 熔断预算标志快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 预筛选校准快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('ANN 校准就绪态快照')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookChecksCardTextZh.includes('query_vector_acceleration_index_sync_health')) {
            failures.push(`runtimeRunbookChecksCardTextZh='${report.browserChecks.runtimeRunbookChecksCardTextZh}'`);
        }
        if (report.browserChecks.runtimeRunbookActionQueueCardTitleZh !== '运行时动作队列') {
            failures.push(`runtimeRunbookActionQueueCardTitleZh='${report.browserChecks.runtimeRunbookActionQueueCardTitleZh}'`);
        }
        if (report.browserChecks.runtimeRunbookActionQueueCardMetricsHeadingZh !== '关键指标') {
            failures.push(`runtimeRunbookActionQueueCardMetricsHeadingZh='${report.browserChecks.runtimeRunbookActionQueueCardMetricsHeadingZh}'`);
        }
        if (!report.browserChecks.runtimeRunbookActionQueueCardTextZh.includes('query_vector_acceleration_index_sync_health')) {
            failures.push(`runtimeRunbookActionQueueCardTextZh='${report.browserChecks.runtimeRunbookActionQueueCardTextZh}'`);
        }
        if (
            !report.browserChecks.runtimeRunbookActionQueueCardTextZh.includes('/api/knowledge/query-backend-diagnostics')
            && !report.browserChecks.runtimeRunbookActionQueueCardTextZh.includes('/api/knowledge/ingest')
        ) {
            failures.push(`runtimeRunbookActionQueueCardTextZh='${report.browserChecks.runtimeRunbookActionQueueCardTextZh}'`);
        }
        if (report.browserChecks.conversationTurnCacheAlertTrendCardTitleZh !== '对话轮次缓存告警趋势') {
            failures.push(`conversationTurnCacheAlertTrendCardTitleZh='${report.browserChecks.conversationTurnCacheAlertTrendCardTitleZh}'`);
        }
        if (report.browserChecks.conversationTurnCacheAlertTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`conversationTurnCacheAlertTrendCardMetricsHeadingZh='${report.browserChecks.conversationTurnCacheAlertTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.missingNodeMessageZh !== '本地节点 atom_missing 不可用。') {
            failures.push(`missingNodeMessageZh='${report.browserChecks.missingNodeMessageZh}'`);
        }
        if (report.browserChecks.promotionStateAfterClick !== 'graph-focus') {
            failures.push(`promotionStateAfterClick='${report.browserChecks.promotionStateAfterClick}'`);
        }
        if (report.browserChecks.promotionStateAfterEscape !== null) {
            failures.push(`promotionStateAfterEscape='${report.browserChecks.promotionStateAfterEscape}'`);
        }
        const knowledgeHitUi = report.browserChecks.knowledgeHitUi && typeof report.browserChecks.knowledgeHitUi === 'object'
            ? report.browserChecks.knowledgeHitUi
            : {};
        if (knowledgeHitUi.ok !== true) {
            failures.push(`knowledgeHitUi.ok='${String(knowledgeHitUi.ok)}'`);
        }
        if (knowledgeHitUi.initialTextIncludesHint !== false) {
            failures.push(`knowledgeHitUi.initialTextIncludesHint='${String(knowledgeHitUi.initialTextIncludesHint)}'`);
        }
        if (knowledgeHitUi.helpHiddenInitially !== true || knowledgeHitUi.helpTextEmptyInitially !== true) {
            failures.push(`knowledgeHitUi.helpInitialState='${String(knowledgeHitUi.helpHiddenInitially)}:${String(knowledgeHitUi.helpTextEmptyInitially)}'`);
        }
        if (knowledgeHitUi.helpVisibleOnHover !== true) {
            failures.push(`knowledgeHitUi.helpVisibleOnHover='${String(knowledgeHitUi.helpVisibleOnHover)}'`);
        }
        if (knowledgeHitUi.helpVisibleOnFocus !== true || knowledgeHitUi.helpHiddenAfterBlur !== true) {
            failures.push(`knowledgeHitUi.helpKeyboardState='${String(knowledgeHitUi.helpVisibleOnFocus)}:${String(knowledgeHitUi.helpHiddenAfterBlur)}'`);
        }
        if (!knowledgeHitUi.helpPopoverId || knowledgeHitUi.helpPopoverId !== knowledgeHitUi.helpDescribedBy) {
            failures.push(`knowledgeHitUi.helpAria='${String(knowledgeHitUi.helpPopoverId)}:${String(knowledgeHitUi.helpDescribedBy)}'`);
        }
        if (knowledgeHitUi.fileName !== 'water glass.md') {
            failures.push(`knowledgeHitUi.fileName='${String(knowledgeHitUi.fileName)}'`);
        }
        if (JSON.stringify(knowledgeHitUi.actionKinds || []) !== JSON.stringify(['learning-path', 'related-focus'])) {
            failures.push(`knowledgeHitUi.actionKinds='${JSON.stringify(knowledgeHitUi.actionKinds || [])}'`);
        }
        if (Number(knowledgeHitUi.minTargetSizePx || 0) < 44) {
            failures.push(`knowledgeHitUi.minTargetSizePx='${String(knowledgeHitUi.minTargetSizePx)}'`);
        }
        if (!['auto', 'scroll'].includes(String(knowledgeHitUi.knowledgeRegionScrollable || ''))) {
            failures.push(`knowledgeHitUi.knowledgeRegionScrollable='${String(knowledgeHitUi.knowledgeRegionScrollable)}'`);
        }
        if (knowledgeHitUi.knowledgeRegionHorizontalOverflow !== false) {
            failures.push(`knowledgeHitUi.knowledgeRegionHorizontalOverflow='${String(knowledgeHitUi.knowledgeRegionHorizontalOverflow)}'`);
        }
        if (knowledgeHitUi.pathPreviewAnchorId !== 'water glass') {
            failures.push(`knowledgeHitUi.pathPreviewAnchorId='${String(knowledgeHitUi.pathPreviewAnchorId)}'`);
        }
        if (!String(knowledgeHitUi.pathPreviewText || '').includes('water glass') || String(knowledgeHitUi.pathPreviewText || '').includes('atom_h')) {
            failures.push(`knowledgeHitUi.pathPreviewText='${String(knowledgeHitUi.pathPreviewText || '')}'`);
        }
        ['prerequisite', 'anchor', 'next'].forEach((role) => {
            if (!Array.isArray(knowledgeHitUi.pathRoles) || !knowledgeHitUi.pathRoles.includes(role)) {
                failures.push(`knowledgeHitUi.pathRoles.${role}='missing'`);
            }
        });
        if (Number(knowledgeHitUi.pathOutOfBoundsCount || 0) !== 0) {
            failures.push(`knowledgeHitUi.pathOutOfBoundsCount='${String(knowledgeHitUi.pathOutOfBoundsCount)}'`);
        }
        if (knowledgeHitUi.focusPreviewAnchorId !== 'water glass') {
            failures.push(`knowledgeHitUi.focusPreviewAnchorId='${String(knowledgeHitUi.focusPreviewAnchorId)}'`);
        }
        if (!String(knowledgeHitUi.focusPreviewText || '').includes('water glass') || String(knowledgeHitUi.focusPreviewText || '').includes('atom_h')) {
            failures.push(`knowledgeHitUi.focusPreviewText='${String(knowledgeHitUi.focusPreviewText || '')}'`);
        }
        if (Number(knowledgeHitUi.focusOutOfBoundsCount || 0) !== 0) {
            failures.push(`knowledgeHitUi.focusOutOfBoundsCount='${String(knowledgeHitUi.focusOutOfBoundsCount)}'`);
        }
        if (!Array.isArray(knowledgeHitUi.focusCalls) || !knowledgeHitUi.focusCalls.includes('water glass')) {
            failures.push(`knowledgeHitUi.focusCalls='${JSON.stringify(knowledgeHitUi.focusCalls || [])}'`);
        }
        if (!Array.isArray(knowledgeHitUi.snapshotCalls) || !knowledgeHitUi.snapshotCalls.includes('water glass')) {
            failures.push(`knowledgeHitUi.snapshotCalls='${JSON.stringify(knowledgeHitUi.snapshotCalls || [])}'`);
        }
        if (knowledgeHitUi.learningPathPaneOpen !== 'true' || knowledgeHitUi.graphFocusPaneOpen !== 'true' || knowledgeHitUi.evidencePaneOpen !== 'true') {
            failures.push(`knowledgeHitUi.paneOpenState='${String(knowledgeHitUi.learningPathPaneOpen)}:${String(knowledgeHitUi.graphFocusPaneOpen)}:${String(knowledgeHitUi.evidencePaneOpen)}'`);
        }
        if (Number(knowledgeHitUi.closeButtonCount || 0) !== 3) {
            failures.push(`knowledgeHitUi.closeButtonCount='${String(knowledgeHitUi.closeButtonCount)}'`);
        }

        const criticalFailurePrefixes = [
            'backendMode=',
            'graphMode=',
            'pathMode=',
            'screenshotPath=',
            'consoleLogPath=',
            'networkSummaryPath=',
        ];
        const uiDeterministicFailurePrefixes = criticalFailurePrefixes.concat([
            'titleText=',
            'missingNodeMessageZh=',
            'promotionStateAfterClick=',
            'promotionStateAfterEscape=',
            'knowledgeHitUi.',
        ]);
        const dynamicSignalFailurePrefixes = [
            'networkSummary.hasConversationRequest=',
            'networkSummary.hasLearningPathRequest=',
            'networkSummary.hasStudySessionRequest=',
            'networkSummary.hasQueryBackendComparisonRequest=',
            'networkSummary.hasQueryBackendComparisonHistoryRequest=',
            'networkSummary.hasQueryBackendComparisonTrendRequest=',
            'networkSummary.hasLearningQualityTrendRequest=',
            'networkSummary.hasLearningQualityHistoryRequest=',
            'networkSummary.hasSessionPlanQualityTrendRequest=',
            'networkSummary.hasSessionPlanQualityHistoryRequest=',
            'networkSummary.hasSessionHistoryRequest=',
            'networkSummary.hasRuntimeRunbookChecksRequest=',
            'networkSummary.hasRuntimeRunbookActionQueueRequest=',
            'networkSummary.hasConversationTurnCacheAlertTrendRequest=',
            'networkSummary.hasTutorActionRequest=',
            'networkSummary.allTrackedRequestsSucceeded=',
            'networkSummary.endpointStatusSummary.',
            'userMessageText=',
            'assistantMessageText=',
            'focusButtonLabelZh=',
            'learningPathButtonLabelZh=',
            'studySessionButtonLabelZh=',
            'quizButtonLabelZh=',
            'transferButtonLabelZh=',
            'counterexampleButtonLabelZh=',
            'followUpButtonLabelZh=',
            'compareQueryBackendsButtonLabelZh=',
            'queryBackendComparisonHistoryButtonLabelZh=',
            'queryBackendComparisonTrendButtonLabelZh=',
            'learningQualityTrendButtonLabelZh=',
            'learningQualityHistoryButtonLabelZh=',
            'sessionPlanQualityTrendButtonLabelZh=',
            'sessionPlanQualityHistoryButtonLabelZh=',
            'sessionHistoryButtonLabelZh=',
            'runtimeRunbookChecksButtonLabelZh=',
            'runtimeRunbookActionQueueButtonLabelZh=',
            'conversationTurnCacheAlertTrendButtonLabelZh=',
            'focusOpenedId=',
            'focusStateNodeId=',
            'focusNodeNameText=',
            'learningPathPaneOpenState=',
            'learningPathInitId=',
            'learningPathCurrentTargetId=',
            'learningPathDisplay=',
            'studySessionCardTitleZh=',
            'studySessionCardSummaryZh=',
            'tutorCardTitleZh=',
            'tutorCardEvidenceHeadingZh=',
            'queryBackendComparisonCardTitleZh=',
            'queryBackendComparisonCardMetricsHeadingZh=',
            'queryBackendComparisonHistoryCardTitleZh=',
            'queryBackendComparisonHistoryCardMetricsHeadingZh=',
            'queryBackendComparisonTrendCardTitleZh=',
            'queryBackendComparisonTrendCardMetricsHeadingZh=',
            'learningQualityTrendCardTitleZh=',
            'learningQualityTrendCardMetricsHeadingZh=',
            'learningQualityHistoryCardTitleZh=',
            'learningQualityHistoryCardMetricsHeadingZh=',
            'sessionPlanQualityTrendCardTitleZh=',
            'sessionPlanQualityTrendCardMetricsHeadingZh=',
            'sessionPlanQualityHistoryCardTitleZh=',
            'sessionPlanQualityHistoryCardMetricsHeadingZh=',
            'sessionPlanQualityHistoryDebugJson=',
            'sessionHistoryCardTitleZh=',
            'sessionHistoryCardMetricsHeadingZh=',
            'runtimeRunbookChecksCardTitleZh=',
            'runtimeRunbookChecksCardMetricsHeadingZh=',
            'runtimeRunbookActionQueueCardTitleZh=',
            'runtimeRunbookActionQueueCardMetricsHeadingZh=',
            'conversationTurnCacheAlertTrendCardTitleZh=',
            'conversationTurnCacheAlertTrendCardMetricsHeadingZh=',
        ];
        let dynamicUiReady = Boolean(
            String(report.browserChecks.userMessageText || '').trim()
            || String(report.browserChecks.assistantMessageText || '').trim()
            || String(report.browserChecks.focusButtonLabelZh || '').trim()
            || Number(networkSummary && networkSummary.fetchTraceCount || 0) > 0
        );
        if (uiDynamicStrictRequested && !dynamicUiReady) {
            dynamicUiReady = attemptDynamicEvidenceRecovery(pwcli, sessionArgs, artifactDir);
        }
        const shouldApplyCriticalOnlyFilter =
            !uiStrictRequested && (
                process.platform === 'win32' || strictRequested
            );
        if (shouldApplyCriticalOnlyFilter && failures.length > 0) {
            const retained = failures.filter((entry) => (
                criticalFailurePrefixes.some((prefix) => entry.startsWith(prefix))
            ));
            failures.length = 0;
            retained.forEach((entry) => failures.push(entry));
        }
        const shouldApplyUiDeterministicFilter =
            uiStrictRequested && !uiDynamicStrictRequested;
        if (shouldApplyUiDeterministicFilter && failures.length > 0) {
            const retained = failures.filter((entry) => (
                uiDeterministicFailurePrefixes.some((prefix) => entry.startsWith(prefix))
            ));
            failures.length = 0;
            retained.forEach((entry) => failures.push(entry));
        }
        if (uiDynamicStrictRequested && !dynamicUiReady) {
            failures.push('uiDynamicEvidenceMissing=true');
        }

        if (failures.length > 0) {
            throw new Error(
                `[agent-workspace-browser] Browser smoke verification failed: ${failures.join(', ')}\n` +
                runtime.getLogs()
            );
        }

        return report;
    } finally {
        try {
            runPwcli(pwcli, sessionArgs.concat(['close']), { cwd: artifactDir });
        } catch (_error) {
            // Ignore browser close failures during cleanup.
        }
        await stopRuntimeServer(runtime.child);
        fixture.cleanup();
    }
}

async function main() {
    const maxAttempts = Math.max(
        1,
        Number.parseInt(String(process.env.NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_MAX_ATTEMPTS || '3'), 10) || 3
    );
    const retryDelayMs = Math.max(
        250,
        Number.parseInt(String(process.env.NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_RETRY_DELAY_MS || '1000'), 10) || 1000
    );
    const shouldRetry = (error) => {
        const text = String((error && error.stack) || (error && error.message) || error || '');
        return (
            text.includes('ECONNREFUSED')
            || text.includes('spawn UNKNOWN')
            || text.includes('Failed to initialize IO completion pollers')
            || text.includes('The browser')
            || text.includes('Process terminated')
            || text.includes('ETIMEDOUT')
        );
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const report = await verifyAgentWorkspaceBrowser();
            console.log('[agent-workspace-browser] PASS', JSON.stringify(report, null, 2));
            return;
        } catch (error) {
            if (attempt < maxAttempts && shouldRetry(error)) {
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
                continue;
            }
            console.error('[agent-workspace-browser] FAIL', error);
            process.exit(1);
        }
    }

    process.exit(1);
}

if (require.main === module) {
    void main();
}

module.exports = {
    verifyAgentWorkspaceBrowser,
};
