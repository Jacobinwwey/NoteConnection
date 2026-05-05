import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

type MockElement = {
  value: string;
  innerHTML: string;
  textContent: string;
  addEventListener: jest.Mock;
  setAttribute: jest.Mock;
  removeAttribute: jest.Mock;
  getAttribute: jest.Mock;
  closest: jest.Mock;
};

function createMockElement(): MockElement {
  return {
    value: '',
    innerHTML: '',
    textContent: '',
    addEventListener: jest.fn(),
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    getAttribute: jest.fn(() => ''),
    closest: jest.fn(() => null),
  };
}

function loadPathAppHarness() {
  const repoRoot = path.resolve(__dirname, '..');
  const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');
  const source = fs.readFileSync(pathAppPath, 'utf8');
  const elements = new Map<string, MockElement>([
    ['learning-api-trace-path-prefix', createMockElement()],
    ['learning-api-trace-status-min', createMockElement()],
    ['learning-api-trace-method', createMockElement()],
    ['learning-api-trace-error-code', createMockElement()],
    ['learning-api-trace-request-id', createMockElement()],
    ['btn-refresh-learning-session-history-now', createMockElement()],
    ['learning-session-history-auto-refresh-enabled', createMockElement()],
    ['learning-session-history-auto-refresh-interval', createMockElement()],
  ]);

  const mockStorage = new Map<string, string>();
  const documentStub = {
    getElementById: jest.fn((id: string) => elements.get(id) || null),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    addEventListener: jest.fn(),
    createElement: jest.fn(() => createMockElement()),
    hidden: false,
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
    },
  };

  const storageStub = {
    getItem: jest.fn((key: string) => (mockStorage.has(key) ? String(mockStorage.get(key)) : null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, String(value));
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
    }),
  };

  const sandbox: Record<string, any> = {
    console: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
    window: {},
    document: documentStub,
    localStorage: storageStub,
    sessionStorage: storageStub,
    navigator: { userAgent: 'JestNode' },
    URLSearchParams,
    URL,
    Math,
    Date,
    JSON,
    Promise,
    setTimeout: jest.fn(() => 1),
    clearTimeout: jest.fn(),
    requestAnimationFrame: jest.fn(() => 1),
    cancelAnimationFrame: jest.fn(),
    fetch: jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: () => '',
      },
      json: async () => ({}),
      text: async () => '',
    })),
    WebSocket: function WebSocketMock(this: Record<string, any>) {
      this.readyState = 3;
      this.send = jest.fn();
      this.close = jest.fn();
    },
    performance: {
      now: () => 0,
    },
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
  };
  sandbox.window = {
    __NC_RUNTIME_CAPS: { supports_sidecar: false },
    __NC_SIDECAR_RUNTIME: {},
    NoteConnectionRuntimeBridge: {
      whenReady: () => Promise.resolve(),
      getRuntimeCapabilities: () => ({ supports_sidecar: false }),
      getRuntimeConfig: () => ({}),
      buildUrl: (endpoint: string) => endpoint,
      getBridgeWsUrl: () => '',
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    location: { href: '' },
    navigator: sandbox.navigator,
    document: documentStub,
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.localStorage = storageStub;
  sandbox.window.sessionStorage = storageStub;
  sandbox.window.setTimeout = sandbox.setTimeout;
  sandbox.window.clearTimeout = sandbox.clearTimeout;
  sandbox.window.fetch = sandbox.fetch;
  sandbox.window.WebSocket = sandbox.WebSocket;
  sandbox.window.performance = sandbox.performance;
  sandbox.window.console = sandbox.console;

  const context = vm.createContext(sandbox);
  new vm.Script(source, { filename: 'path_app.js' }).runInContext(context);
  const pathApp = sandbox.window.pathApp;
  if (!pathApp || typeof pathApp !== 'object') {
    throw new Error('Failed to load window.pathApp from path_app.js');
  }

  return {
    pathApp,
    elements,
    storageStub,
    setFetch: (nextFetch: (...args: any[]) => Promise<any>) => {
      sandbox.fetch = nextFetch;
      sandbox.window.fetch = nextFetch;
    },
    timers: {
      setTimeout: sandbox.setTimeout as jest.Mock,
      clearTimeout: sandbox.clearTimeout as jest.Mock,
    },
    documentStub,
  };
}

function buildFetchResponse(options: {
  ok: boolean;
  status: number;
  body?: any;
  headers?: Record<string, string>;
}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(options.headers || {}).map(([key, value]) => [
      String(key || '').toLowerCase(),
      String(value || ''),
    ])
  );
  return {
    ok: options.ok,
    status: options.status,
    headers: {
      get: (name: string) => normalizedHeaders[String(name || '').toLowerCase()] || '',
    },
    text: async () => (typeof options.body === 'undefined' ? '' : JSON.stringify(options.body)),
  };
}

describe('path app runtime trace filter behavior', () => {
  test('applies runtime check debugTraceHint into runtime-request-trace query parameters', async () => {
    const { pathApp, elements } = loadPathAppHarness();
    const persistSpy = jest
      .spyOn(pathApp, '_persistLearningWorkbenchPreferences')
      .mockImplementation(() => undefined);
    const renderSpy = jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    const refreshSpy = jest
      .spyOn(pathApp, 'refreshLearningWorkbenchApiTrace')
      .mockResolvedValue(undefined);
    const runbookSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbook')
      .mockResolvedValue(null);
    const runbookVerifySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerification')
      .mockResolvedValue(null);

    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      checks: [
        {
          checkId: 'api_invalid_request_hotspots',
          debugTraceHint: {
            pathPrefix: 'POST /api/knowledge/mastery/diagnose',
            statusAtLeast: 499,
            method: '',
            errorCode: 'INVALID_REQUEST',
          },
        },
      ],
    };

    await pathApp._applyLearningApiTraceSuggestionFromCapabilityCheck('api_invalid_request_hotspots');

    expect(pathApp.learningWorkbench.apiTracePathPrefix).toBe('/api/knowledge/mastery/diagnose');
    expect(pathApp.learningWorkbench.apiTraceStatusAtLeast).toBe(400);
    expect(pathApp.learningWorkbench.apiTraceMethod).toBe('POST');
    expect(pathApp.learningWorkbench.apiTraceErrorCode).toBe('invalid_request');
    expect(elements.get('learning-api-trace-path-prefix')?.value).toBe('/api/knowledge/mastery/diagnose');
    expect(elements.get('learning-api-trace-status-min')?.value).toBe('400');
    expect(elements.get('learning-api-trace-method')?.value).toBe('POST');
    expect(elements.get('learning-api-trace-error-code')?.value).toBe('invalid_request');
    expect(elements.get('learning-api-trace-request-id')?.value).toBe('');

    const query = pathApp._buildLearningApiTraceQueryString();
    const params = new URLSearchParams(query);
    expect(params.get('pathPrefix')).toBe('/api/knowledge/mastery/diagnose');
    expect(params.get('statusAtLeast')).toBe('400');
    expect(params.get('method')).toBe('POST');
    expect(params.get('errorCode')).toBe('invalid_request');
    expect(params.get('requestId')).toBeNull();
    expect(params.get('limit')).toBe(String(pathApp.learningWorkbench.apiTraceServerLimit));

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('api_invalid_request_hotspots')
    );
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(runbookSpy).toHaveBeenCalledWith({ checkId: 'api_invalid_request_hotspots' });
    expect(runbookVerifySpy).toHaveBeenCalledWith({ checkId: 'api_invalid_request_hotspots' });
  });

  test('runtime check click handler normalizes check id before applying trace suggestion', () => {
    const { pathApp } = loadPathAppHarness();
    const applySpy = jest
      .spyOn(pathApp, '_applyLearningApiTraceSuggestionFromCapabilityCheck')
      .mockResolvedValue(undefined);

    const handled = pathApp._handleLearningRuntimeCheckDebugTraceClick({
      target: {
        closest: () => ({
          getAttribute: () => 'API_SERVER_ERROR_RATIO',
        }),
      },
    });
    expect(handled).toBe(true);
    expect(applySpy).toHaveBeenCalledWith('api_server_error_ratio');

    const ignored = pathApp._handleLearningRuntimeCheckDebugTraceClick({
      target: {
        closest: () => null,
      },
    });
    expect(ignored).toBe(false);
  });

  test('builds runtime-request-trace query with normalized requestId filter', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.apiTracePathPrefix = '/api/knowledge';
    pathApp.learningWorkbench.apiTraceStatusAtLeast = 400;
    pathApp.learningWorkbench.apiTraceMethod = 'GET';
    pathApp.learningWorkbench.apiTraceErrorCode = 'invalid_request';
    pathApp.learningWorkbench.apiTraceRequestId = '  req@abc#123  ';

    const query = pathApp._buildLearningApiTraceQueryString();
    const params = new URLSearchParams(query);
    expect(params.get('pathPrefix')).toBe('/api/knowledge');
    expect(params.get('statusAtLeast')).toBe('400');
    expect(params.get('method')).toBe('GET');
    expect(params.get('errorCode')).toBe('invalid_request');
    expect(params.get('requestId')).toBe('reqabc123');
  });

  test('runbook check summary formatter renders structured vector acceleration circuit budget diagnostics', () => {
    const { pathApp } = loadPathAppHarness();
    const text = pathApp._formatLearningRuntimeRunbookVerificationCheckSummaryText({
      summary: {
        totalRecords: 2,
        matchedRecords: 2,
        returnedChecks: 1,
        sinceMinutes: 1440,
        status: '',
        checkQuery: 'query_vector_acceleration_circuit_state',
        generatedAt: '2026-04-11T10:00:00.000Z',
        dynamicModeAlignmentRecords: 0,
        dynamicModeAlignmentLatestStatus: '',
        dynamicModeAlignmentConflictStreak: 0,
        dynamicModeAlignmentFailStreak: 0,
        pathStrategyAlignmentRecords: 0,
        pathStrategyAlignmentLatestStatus: '',
        pathStrategyAlignmentConflictStreak: 0,
        pathStrategyAlignmentFailStreak: 0,
        regressingChecks: 1,
        improvingChecks: 0,
        stableChecks: 0,
        insufficientDataChecks: 0,
        recommendedFocusCheckId: 'query_vector_acceleration_circuit_state',
        recommendedFocusLatestStatus: 'fail',
        recommendedFocusTrendStatus: 'regressing',
        recommendedFocusReason: 'latest_failure_risk',
        recommendedFocusEscalation: 'critical',
        recommendedFocusTopAction: 'Stabilize connector',
        actionQueueTotal: 1,
        actionQueueP0: 1,
        actionQueueP1: 0,
        actionQueueP2: 0,
        remediationRecords: 0,
        remediationChecksWithEvents: 0,
        remediationChecksRegressing: 0,
        remediationChecksImproving: 0,
        remediationChecksStable: 0,
        remediationChecksInsufficientData: 0,
        remediationAppliedRatioPct: 0,
        remediationCooldownRatioPct: 0,
        remediationErrorRatioPct: 0,
        remediationRiskRatioPct: 0,
        remediationLatestRecordedAt: '',
        recommendedFocusRemediationStatus: '',
        recommendedFocusRemediationTrendStatus: '',
        queryVectorAccelerationCircuitBudget: {
          checkId: 'query_vector_acceleration_circuit_state',
          mode: 'ann_prefilter',
          healthStatus: 'degraded',
          circuitState: 'open',
          shortCircuitRatioPct: 50,
          warnBudgetExceeded: true,
          failBudgetExceeded: true,
          budgetStatus: 'fail',
          budget: {
            warn: {
              shortCircuitCountLt: 2,
              shortCircuitRatioPctLt: 9,
              consecutiveFailuresLt: 1,
              halfOpenSuccessRatePctGte: 82,
            },
            fail: {
              shortCircuitCountLt: 6,
              shortCircuitRatioPctLt: 24,
              consecutiveFailuresLt: 4,
              halfOpenSuccessRatePctGte: 58,
            },
          },
        },
        queryVectorAccelerationTraceability: {
          checkId: 'query_vector_acceleration_traceability',
          mode: 'ann_prefilter',
          healthStatus: 'degraded',
          circuitState: 'open',
          adapterId: 'external-http-vector-acceleration-v1',
          externalConnector: true,
          requestCount: 12,
          consecutiveFailures: 3,
          shortCircuitCount: 6,
          lastRequestId: 'connector-runbook-req-001',
          lastErrorCode: 'http_503',
          lastRetryAfterMs: 240,
          hasCorrelationSignals: true,
          correlationCoverage: 'full',
          missingFields: [],
        },
        queryVectorAccelerationPrefilter: {
          checkId: 'query_vector_acceleration_prefilter_effectiveness',
          mode: 'ann_prefilter',
          healthStatus: 'degraded',
          circuitState: 'open',
          selectionMode: 'full_scan',
          requestCount: 12,
          candidateCount: 124,
          atomCount: 128,
          candidateRatioPct: 96.875,
          sampleReady: true,
          selectionActive: false,
          stableConnector: false,
          fullScanFallback: true,
          canEvaluateCandidateRatio: true,
          warnBudgetExceeded: true,
          failBudgetExceeded: false,
          budgetStatus: 'warn',
          budget: {
            minRequestSampleGte: 7,
            warnCandidateRatioPctLt: 89,
            failCandidateRatioPctLt: 97,
          },
        },
      },
      checks: [
        {
          checkId: 'query_vector_acceleration_circuit_state',
          latestStatus: 'fail',
          latestEscalation: 'critical',
          records: 2,
          trendStatus: 'regressing',
          activeRiskStreak: 2,
          activeFailStreak: 2,
          averageErrorRatioPct: 0,
          averageP95DurationMs: 0,
          errorRatioDeltaPct: 0,
          p95DurationDeltaMs: 0,
          topRiskMatchRatioPct: 100,
          queryVectorAccelerationCircuitBudget: {
            checkId: 'query_vector_acceleration_circuit_state',
            mode: 'ann_prefilter',
            healthStatus: 'degraded',
            circuitState: 'open',
            shortCircuitRatioPct: 50,
            warnBudgetExceeded: true,
            failBudgetExceeded: true,
            budgetStatus: 'fail',
            budget: {
              warn: {
                shortCircuitCountLt: 2,
                shortCircuitRatioPctLt: 9,
                consecutiveFailuresLt: 1,
                halfOpenSuccessRatePctGte: 82,
              },
              fail: {
                shortCircuitCountLt: 6,
                shortCircuitRatioPctLt: 24,
                consecutiveFailuresLt: 4,
                halfOpenSuccessRatePctGte: 58,
              },
            },
          },
          remediation: {
            returnedRecords: 0,
            latestStatus: '',
            trendStatus: 'insufficient_data',
            activeRiskStreak: 0,
            activeCooldownStreak: 0,
            activeErrorStreak: 0,
            appliedRatioPct: 0,
            cooldownRatioPct: 0,
            errorRatioPct: 0,
            statusCounts: {
              applied: 0,
              not_applied: 0,
              cooldown: 0,
              error: 0,
              ignored: 0,
            },
          },
          escalationActionItems: [],
          escalationActions: [],
        },
        {
          checkId: 'query_vector_acceleration_traceability',
          latestStatus: 'warn',
          latestEscalation: 'watch',
          records: 2,
          trendStatus: 'regressing',
          activeRiskStreak: 1,
          activeFailStreak: 0,
          averageErrorRatioPct: 0,
          averageP95DurationMs: 0,
          errorRatioDeltaPct: 0,
          p95DurationDeltaMs: 0,
          topRiskMatchRatioPct: 0,
          queryVectorAccelerationTraceability: {
            checkId: 'query_vector_acceleration_traceability',
            mode: 'ann_prefilter',
            healthStatus: 'degraded',
            circuitState: 'open',
            adapterId: 'external-http-vector-acceleration-v1',
            externalConnector: true,
            requestCount: 12,
            consecutiveFailures: 3,
            shortCircuitCount: 6,
            lastRequestId: 'connector-runbook-req-001',
            lastErrorCode: 'http_503',
            lastRetryAfterMs: 240,
            hasCorrelationSignals: true,
            correlationCoverage: 'full',
            missingFields: [],
          },
          remediation: {
            returnedRecords: 0,
            latestStatus: '',
            trendStatus: 'insufficient_data',
            activeRiskStreak: 0,
            activeCooldownStreak: 0,
            activeErrorStreak: 0,
            appliedRatioPct: 0,
            cooldownRatioPct: 0,
            errorRatioPct: 0,
            statusCounts: {
              applied: 0,
              not_applied: 0,
              cooldown: 0,
              error: 0,
              ignored: 0,
            },
          },
          escalationActionItems: [],
          escalationActions: [],
        },
        {
          checkId: 'query_vector_acceleration_prefilter_effectiveness',
          latestStatus: 'warn',
          latestEscalation: 'watch',
          records: 2,
          trendStatus: 'regressing',
          activeRiskStreak: 1,
          activeFailStreak: 0,
          averageErrorRatioPct: 0,
          averageP95DurationMs: 0,
          errorRatioDeltaPct: 0,
          p95DurationDeltaMs: 0,
          topRiskMatchRatioPct: 0,
          queryVectorAccelerationPrefilter: {
            checkId: 'query_vector_acceleration_prefilter_effectiveness',
            mode: 'ann_prefilter',
            healthStatus: 'degraded',
            circuitState: 'open',
            selectionMode: 'full_scan',
            requestCount: 12,
            candidateCount: 124,
            atomCount: 128,
            candidateRatioPct: 96.875,
            sampleReady: true,
            selectionActive: false,
            stableConnector: false,
            fullScanFallback: true,
            canEvaluateCandidateRatio: true,
            warnBudgetExceeded: true,
            failBudgetExceeded: false,
            budgetStatus: 'warn',
            budget: {
              minRequestSampleGte: 7,
              warnCandidateRatioPctLt: 89,
              failCandidateRatioPctLt: 97,
            },
          },
          remediation: {
            returnedRecords: 0,
            latestStatus: '',
            trendStatus: 'insufficient_data',
            activeRiskStreak: 0,
            activeCooldownStreak: 0,
            activeErrorStreak: 0,
            appliedRatioPct: 0,
            cooldownRatioPct: 0,
            errorRatioPct: 0,
            statusCounts: {
              applied: 0,
              not_applied: 0,
              cooldown: 0,
              error: 0,
              ignored: 0,
            },
          },
          escalationActionItems: [],
          escalationActions: [],
        },
      ],
      actionQueue: [],
    });

    expect(text).toContain('vectorAccelerationCircuitBudget(check=query_vector_acceleration_circuit_state');
    expect(text).toContain('vectorAccelerationTraceability(check=query_vector_acceleration_traceability');
    expect(text).toContain('vectorAccelerationPrefilter(check=query_vector_acceleration_prefilter_effectiveness');
    expect(text).toContain('budget=fail');
    expect(text).toContain('warnExceeded=true');
    expect(text).toContain('failExceeded=true');
    expect(text).toContain('1. query_vector_acceleration_circuit_state latest=fail');
    expect(text).toContain('2. query_vector_acceleration_traceability latest=warn');
    expect(text).toContain('3. query_vector_acceleration_prefilter_effectiveness latest=warn');
    expect(text).toContain('circuitBudget(mode=ann_prefilter');
    expect(text).toContain('traceability(adapter=external-http-vector-acceleration-v1');
    expect(text).toContain('prefilter(mode=ann_prefilter');
  });

  test('vector acceleration governance drilldown formatter surfaces structured runtime budget and actions', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {
        queryVectorIndexAccelerationMode: 'ann_prefilter',
        queryVectorIndexAccelerationHealthStatus: 'degraded',
        queryVectorIndexAccelerationCircuitState: 'open',
        queryVectorIndexAccelerationLastRequestId: 'connector-signal-fallback',
        queryVectorIndexAccelerationLastErrorCode: 'http_503',
        queryVectorIndexAccelerationLastRetryAfterMs: 240,
        queryVectorIndexAccelerationLastSelectionMode: 'token_signature_prefilter',
        queryVectorIndexAccelerationLastCandidateCount: 48,
        queryVectorIndexAccelerationRequestCount: 12,
        queryVectorIndexAccelerationRetryCount: 0,
        queryVectorIndexAccelerationShortCircuitCount: 6,
        queryVectorIndexAccelerationConsecutiveFailures: 3,
        queryVectorIndexAccelerationSuccessCount: 3,
        queryVectorIndexAccelerationFailureCount: 3,
        queryVectorIndexAccelerationHalfOpenProbeCount: 1,
        queryVectorIndexAccelerationHalfOpenSuccessRatePct: 0,
        queryVectorIndexAccelerationShortCircuitRatioPct: 50,
        queryVectorIndexAccelerationCircuitWarnBudgetExceeded: true,
        queryVectorIndexAccelerationCircuitFailBudgetExceeded: true,
        queryVectorIndexAccelerationCircuitBudgetStatus: 'fail',
        queryVectorIndexAtomCount: 128,
      },
      thresholds: {
        queryVectorAccelerationShortCircuitWarnCount: 2,
        queryVectorAccelerationShortCircuitWarnRatioPct: 9,
        queryVectorAccelerationConsecutiveFailuresWarnCount: 1,
        queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 82,
        queryVectorAccelerationShortCircuitFailCount: 6,
        queryVectorAccelerationShortCircuitFailRatioPct: 24,
        queryVectorAccelerationConsecutiveFailuresFailCount: 4,
        queryVectorAccelerationHalfOpenSuccessFailRatioPct: 58,
        queryVectorAccelerationPrefilterMinRequestSample: 8,
        queryVectorAccelerationPrefilterWarnCandidateRatioPct: 90,
        queryVectorAccelerationPrefilterFailCandidateRatioPct: 97,
      },
      checks: [
        {
          checkId: 'query_vector_acceleration_circuit_state',
          status: 'fail',
        },
        {
          checkId: 'query_vector_acceleration_traceability',
          status: 'warn',
        },
        {
          checkId: 'query_vector_acceleration_prefilter_effectiveness',
          status: 'warn',
        },
      ],
    };
    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        queryVectorAccelerationCircuitBudget: {
          checkId: 'query_vector_acceleration_circuit_state',
          mode: 'ann_prefilter',
          healthStatus: 'degraded',
          circuitState: 'open',
          lastRequestId: 'connector-runbook-req-001',
          lastErrorCode: 'http_503',
          lastRetryAfterMs: 240,
          shortCircuitRatioPct: 50,
          warnBudgetExceeded: true,
          failBudgetExceeded: true,
          budgetStatus: 'fail',
          budget: {
            warn: {
              shortCircuitCountLt: 2,
              shortCircuitRatioPctLt: 9,
              consecutiveFailuresLt: 1,
              halfOpenSuccessRatePctGte: 82,
            },
            fail: {
              shortCircuitCountLt: 6,
              shortCircuitRatioPctLt: 24,
              consecutiveFailuresLt: 4,
              halfOpenSuccessRatePctGte: 58,
            },
          },
        },
        queryVectorAccelerationTraceability: {
          checkId: 'query_vector_acceleration_traceability',
          mode: 'ann_prefilter',
          healthStatus: 'degraded',
          circuitState: 'open',
          adapterId: 'external-http-vector-acceleration-v1',
          externalConnector: true,
          requestCount: 12,
          consecutiveFailures: 3,
          shortCircuitCount: 6,
          lastRequestId: 'connector-runbook-req-001',
          lastErrorCode: 'http_503',
          lastRetryAfterMs: 240,
          hasCorrelationSignals: true,
          correlationCoverage: 'full',
          missingFields: [],
        },
        queryVectorAccelerationPrefilter: {
          checkId: 'query_vector_acceleration_prefilter_effectiveness',
          mode: 'ann_prefilter',
          healthStatus: 'degraded',
          circuitState: 'open',
          selectionMode: 'full_scan',
          requestCount: 12,
          candidateCount: 124,
          atomCount: 128,
          candidateRatioPct: 96.875,
          sampleReady: true,
          selectionActive: false,
          stableConnector: false,
          fullScanFallback: true,
          canEvaluateCandidateRatio: true,
          warnBudgetExceeded: true,
          failBudgetExceeded: false,
          budgetStatus: 'warn',
          budget: {
            minRequestSampleGte: 7,
            warnCandidateRatioPctLt: 89,
            failCandidateRatioPctLt: 97,
          },
        },
      },
      checks: [
        {
          checkId: 'query_vector_acceleration_circuit_state',
          latestStatus: 'fail',
          latestEscalation: 'critical',
          activeRiskStreak: 3,
          activeFailStreak: 2,
          escalationActionItems: [
            {
              actionId: 'stabilize_vector_acceleration_connector',
              priority: 'p0',
              category: 'stabilize',
              instruction: 'stabilize connector and verify endpoint health',
              endpointHint: '/api/knowledge/query-backend-diagnostics',
            },
          ],
        },
        {
          checkId: 'query_vector_acceleration_traceability',
          latestStatus: 'warn',
          latestEscalation: 'watch',
          activeRiskStreak: 1,
          activeFailStreak: 0,
          queryVectorAccelerationTraceability: {
            checkId: 'query_vector_acceleration_traceability',
            mode: 'ann_prefilter',
            healthStatus: 'degraded',
            circuitState: 'open',
            adapterId: 'external-http-vector-acceleration-v1',
            externalConnector: true,
            requestCount: 12,
            consecutiveFailures: 3,
            shortCircuitCount: 6,
            lastRequestId: 'connector-runbook-req-001',
            lastErrorCode: 'http_503',
            lastRetryAfterMs: 240,
            hasCorrelationSignals: true,
            correlationCoverage: 'full',
            missingFields: [],
          },
          escalationActionItems: [
            {
              actionId: 'collect_vector_acceleration_connector_correlation',
              priority: 'p1',
              category: 'evidence',
              instruction: 'collect connector correlation fields for troubleshooting',
              endpointHint: '/api/knowledge/query-backend-diagnostics',
            },
          ],
        },
        {
          checkId: 'query_vector_acceleration_prefilter_effectiveness',
          latestStatus: 'warn',
          latestEscalation: 'watch',
          activeRiskStreak: 1,
          activeFailStreak: 0,
          escalationActionItems: [
            {
              actionId: 'inspect_ann_prefilter_selection_telemetry',
              priority: 'p1',
              category: 'evidence',
              instruction: 'inspect prefilter selection mode and candidate telemetry',
              endpointHint: '/api/knowledge/query-backend-diagnostics',
            },
          ],
        },
      ],
    };
    pathApp.learningWorkbench.runtimeRunbookVerification = {
      selectedCheckId: 'query_vector_acceleration_circuit_state',
      selectedCheckStatus: 'fail',
      selectedCheckEscalation: 'critical',
      selectedCheckHistory: {
        activeRiskStreak: 3,
        activeFailStreak: 2,
      },
      selectedCheckEscalationActionItems: [
        {
          actionId: 'stabilize_vector_acceleration_connector',
          priority: 'p0',
          category: 'stabilize',
          instruction: 'stabilize connector and verify endpoint health',
          endpointHint: '/api/knowledge/query-backend-diagnostics',
        },
      ],
    };

    const text = pathApp._formatLearningRuntimeVectorAccelerationGovernanceDrilldownText();
    expect(text).toContain('status(check=query_vector_acceleration_circuit_state,result=fail,escalation=critical');
    expect(text).toContain('runtime(mode=ann_prefilter,health=degraded,circuit=open)');
    expect(text).toContain('budget=fail');
    expect(text).toContain('connector(lastRequestId=connector-runbook-req-001,lastErrorCode=http_503,lastRetryAfterMs=240)');
    expect(text).toContain('flags(warnExceeded=true,failExceeded=true)');
    expect(text).toContain('actions=1.p0/stabilize/stabilize_vector_acceleration_connector');
    expect(text).toContain('/api/knowledge/query-backend-diagnostics');
    expect(text).toContain('traceability(check=query_vector_acceleration_traceability,result=warn,escalation=watch');
    expect(text).toContain('traceabilityConnector(adapter=external-http-vector-acceleration-v1,external=true');
    expect(text).toContain('traceabilityActions=1.p1/evidence/collect_vector_acceleration_connector_correlation');
    expect(text).toContain('prefilter(check=query_vector_acceleration_prefilter_effectiveness,result=warn,escalation=watch');
    expect(text).toContain('lastSelectionMode=full_scan');
    expect(text).toContain('budget=warn');
    expect(text).toContain('warnExceeded=true');
    expect(text).toContain('failExceeded=false');
    expect(text).toContain('prefilterThresholds(minSample>=7,candidateRatio<89%(warn)/<97%(fail))');
    expect(text).toContain('prefilterActions=1.p1/evidence/inspect_ann_prefilter_selection_telemetry');
  });

  test('session history source chip click normalizes source and triggers targeted history refresh', () => {
    const { pathApp } = loadPathAppHarness();
    const persistSpy = jest
      .spyOn(pathApp, '_persistLearningWorkbenchPreferences')
      .mockImplementation(() => undefined);
    const refreshSpy = jest
      .spyOn(pathApp, 'refreshLearningWorkbenchSessionHistory')
      .mockResolvedValue(null);

    const handled = pathApp._handleLearningSessionHistorySourceChipClick({
      target: {
        closest: () => ({
          getAttribute: () => 'STRATEGY_TREND',
        }),
      },
    });

    expect(handled).toBe(true);
    expect(pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource).toBe('strategy_trend');
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith({ force: true, refreshSource: 'manual' });

    const ignored = pathApp._handleLearningSessionHistorySourceChipClick({
      target: {
        closest: () => null,
      },
    });
    expect(ignored).toBe(false);
  });

  test('session history strategy chip click normalizes strategy and triggers targeted history refresh', () => {
    const { pathApp } = loadPathAppHarness();
    const persistSpy = jest
      .spyOn(pathApp, '_persistLearningWorkbenchPreferences')
      .mockImplementation(() => undefined);
    const refreshSpy = jest
      .spyOn(pathApp, 'refreshLearningWorkbenchSessionHistory')
      .mockResolvedValue(null);

    const handled = pathApp._handleLearningSessionHistoryStrategyChipClick({
      target: {
        closest: () => ({
          getAttribute: () => 'EXPLORATION_BOOST',
        }),
      },
    });

    expect(handled).toBe(true);
    expect(pathApp.learningWorkbench.sessionHistoryPathStrategy).toBe('exploration_boost');
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith({ force: true, refreshSource: 'manual' });

    const ignored = pathApp._handleLearningSessionHistoryStrategyChipClick({
      target: {
        closest: () => null,
      },
    });
    expect(ignored).toBe(false);
  });

  test('runtime check sort mode is normalized when persisting and restoring workbench preferences', () => {
    const { pathApp, storageStub } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCheckSortMode = 'STATUS';
    pathApp.learningWorkbench.runtimeCheckStatusFilter = 'WARN_FAIL';
    pathApp.learningWorkbench.runtimeCheckQueryFilter = '  API_SERVER_ERROR  ';
    pathApp.learningWorkbench.pathStrategy = 'EXPLORATION_BOOST';
    pathApp.learningWorkbench.pathRecommendedActionLimit = 61;
    pathApp.learningWorkbench.runtimeRunbookActionQueuePriorityFilter = 'P0';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCategoryFilter = 'VERIFY';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCheckFilter = '  API_SERVER_ERROR_RATIO ';
    pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationStatusFilter = 'ERROR';
    pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationTrendFilter = 'REGRESSING';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = '2000.4';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'COOLDOWN';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = '  LEARNING_WORKBENCH_REFRESH ';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = '  API_LATENCY_P95 ';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = '66.7';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit = '8.9';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode = 'ALL';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun = 'TRUE';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy = 'RISK_STREAK_DESC';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct = '42.678';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleEnabled = 'TRUE';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleIntervalMinutes = '17.8';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerPolicy = 'RISK_RATIO_OR_STREAK';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskRatioPct = '63.333';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskStreak = '4.9';
    pathApp.learningWorkbench.runtimeRunbookAutoFocusRegressingEnabled = 'FALSE';
    pathApp.learningWorkbench.apiTraceRequestId = '  REQ::trace@@001  ';
    pathApp.learningWorkbench.tutorRoutingAdapterTimeoutMs = 36000;
    pathApp.learningWorkbench.sessionHistorySinceMinutes = '2000.8';
    pathApp.learningWorkbench.sessionHistoryPathStrategy = 'MASTERY_RECOVERY';
    pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource = 'STRATEGY_TREND';
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = 'TRUE';
    pathApp.learningWorkbench.sessionHistoryAutoRefreshIntervalSeconds = '7';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount = '5.8';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt = '2026-04-10T01:00:01.000Z';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied = true;
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason = '  cooldown_active:90s  ';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId = '  API_LATENCY_P95  ';

    pathApp._persistLearningWorkbenchPreferences();
    const persistedRaw = storageStub.getItem('nc_learning_workbench_prefs');
    const persisted = persistedRaw ? JSON.parse(String(persistedRaw)) : {};
    expect(persisted.runtimeCheckSortMode).toBe('status');
    expect(persisted.runtimeCheckStatusFilter).toBe('warn_fail');
    expect(persisted.runtimeCheckQueryFilter).toBe('api_server_error');
    expect(persisted.pathStrategy).toBe('exploration_boost');
    expect(persisted.pathRecommendedActionLimit).toBe(48);
    expect(persisted.runtimeRunbookActionQueuePriorityFilter).toBe('p0');
    expect(persisted.runtimeRunbookActionQueueCategoryFilter).toBe('verify');
    expect(persisted.runtimeRunbookActionQueueCheckFilter).toBe('api_server_error_ratio');
    expect(persisted.runtimeRunbookActionQueueRemediationStatusFilter).toBe('error');
    expect(persisted.runtimeRunbookActionQueueRemediationTrendFilter).toBe('regressing');
    expect(persisted.runtimeRunbookRemediationHistorySinceMinutes).toBe(2000);
    expect(persisted.runtimeRunbookRemediationHistoryStatusFilter).toBe('cooldown');
    expect(persisted.runtimeRunbookRemediationHistorySourceFilter).toBe('learning_workbench_refresh');
    expect(persisted.runtimeRunbookRemediationHistoryCheckFilter).toBe('api_latency_p95');
    expect(persisted.runtimeRunbookRemediationHistoryLimit).toBe(66);
    expect(persisted.runtimeRunbookRemediationReplayLimit).toBe(8);
    expect(persisted.runtimeRunbookRemediationReplayMode).toBe('all');
    expect(persisted.runtimeRunbookRemediationReplayDryRun).toBe(true);
    expect(persisted.runtimeRunbookRemediationReplaySelectionPolicy).toBe('risk_streak_desc');
    expect(persisted.runtimeRunbookRemediationReplayMinRiskRatioPct).toBe(42.678);
    expect(persisted.runtimeRunbookRemediationReplayScheduleEnabled).toBe(true);
    expect(persisted.runtimeRunbookRemediationReplayScheduleIntervalMinutes).toBe(17);
    expect(persisted.runtimeRunbookRemediationReplayScheduleTriggerPolicy).toBe('risk_ratio_or_streak');
    expect(persisted.runtimeRunbookRemediationReplayScheduleTriggerMinRiskRatioPct).toBe(63.333);
    expect(persisted.runtimeRunbookRemediationReplayScheduleTriggerMinRiskStreak).toBe(4);
    expect(persisted.runtimeRunbookAutoFocusRegressingEnabled).toBe(false);
    expect(persisted.apiTraceRequestId).toBe('REQ::trace001');
    expect(persisted.tutorRoutingAdapterTimeoutMs).toBe(36000);
    expect(persisted.sessionHistorySinceMinutes).toBe(2000);
    expect(persisted.sessionHistoryPathStrategy).toBe('mastery_recovery');
    expect(persisted.sessionHistoryPathStrategySelectionSource).toBe('strategy_trend');
    expect(persisted.sessionHistoryAutoRefreshEnabled).toBe(true);
    expect(persisted.sessionHistoryAutoRefreshIntervalSeconds).toBe(15);
    expect(persisted.workbenchRefreshAutoRemediationCount).toBe(5);
    expect(persisted.workbenchRefreshAutoRemediationAt).toBe('2026-04-10T01:00:01.000Z');
    expect(persisted.workbenchRefreshAutoRemediationApplied).toBe(true);
    expect(persisted.workbenchRefreshAutoRemediationReason).toBe('cooldown_active:90s');
    expect(persisted.workbenchRefreshAutoRemediationCheckId).toBe('api_latency_p95');

    storageStub.setItem(
      'nc_learning_workbench_prefs',
      JSON.stringify({
        runtimeCheckSortMode: 'non_existing_mode',
        runtimeCheckStatusFilter: 'FAIL',
        runtimeCheckQueryFilter: '  Query With Space  ',
        pathStrategy: 'invalid_strategy',
        pathRecommendedActionLimit: '2',
        runtimeRunbookActionQueuePriorityFilter: 'P9',
        runtimeRunbookActionQueueCategoryFilter: 'UNSUPPORTED',
        runtimeRunbookActionQueueCheckFilter: '  API_LATENCY_P95 ',
        runtimeRunbookActionQueueRemediationStatusFilter: 'oops',
        runtimeRunbookActionQueueRemediationTrendFilter: 'badtrend',
        runtimeRunbookRemediationHistorySinceMinutes: '-20',
        runtimeRunbookRemediationHistoryStatusFilter: 'bad',
        runtimeRunbookRemediationHistorySourceFilter: '  learning_workbench_refresh ',
        runtimeRunbookRemediationHistoryCheckFilter: '  API_SERVER_ERROR_RATIO ',
        runtimeRunbookRemediationHistoryLimit: '999',
        runtimeRunbookRemediationReplayLimit: '999',
        runtimeRunbookRemediationReplayMode: 'unsupported_mode',
        runtimeRunbookRemediationReplayDryRun: 'unsupported_bool',
        runtimeRunbookRemediationReplaySelectionPolicy: 'unsupported_policy',
        runtimeRunbookRemediationReplayMinRiskRatioPct: '-25',
        runtimeRunbookRemediationReplayScheduleEnabled: 'maybe',
        runtimeRunbookRemediationReplayScheduleIntervalMinutes: '9999',
        runtimeRunbookRemediationReplayScheduleTriggerPolicy: 'unsupported_policy',
        runtimeRunbookRemediationReplayScheduleTriggerMinRiskRatioPct: '-10',
        runtimeRunbookRemediationReplayScheduleTriggerMinRiskStreak: '0',
        runtimeRunbookAutoFocusRegressingEnabled: '0',
        apiTraceRequestId: '  req@trace#restore ',
        tutorRoutingAdapterTimeoutMs: 500000,
        sessionHistorySinceMinutes: '-20',
        sessionHistoryPathStrategy: 'invalid_strategy',
        sessionHistoryPathStrategySelectionSource: 'invalid_source',
        sessionHistoryAutoRefreshEnabled: 'maybe',
        sessionHistoryAutoRefreshIntervalSeconds: '9999',
        workbenchRefreshAutoRemediationCount: '-3',
        workbenchRefreshAutoRemediationAt: 'invalid-date',
        workbenchRefreshAutoRemediationApplied: '1',
        workbenchRefreshAutoRemediationReason: '  cooldown_active:10s  ',
        workbenchRefreshAutoRemediationCheckId: '  API_SERVER_ERROR_RATIO  ',
      })
    );
    pathApp.learningWorkbench.runtimeCheckSortMode = 'priority';
    pathApp.learningWorkbench.runtimeCheckStatusFilter = 'all';
    pathApp.learningWorkbench.runtimeCheckQueryFilter = '';
    pathApp.learningWorkbench.pathStrategy = 'balanced';
    pathApp.learningWorkbench.pathRecommendedActionLimit = 24;
    pathApp.learningWorkbench.runtimeRunbookActionQueuePriorityFilter = 'all';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCategoryFilter = 'all';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCheckFilter = '';
    pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationStatusFilter = 'all';
    pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationTrendFilter = 'all';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'all';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = '';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = '';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = 12;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit = 6;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode = 'risk_only';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun = true;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy = 'history_order';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct = 10;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleEnabled = false;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleIntervalMinutes = 60;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerPolicy = 'always';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskRatioPct = 50;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskStreak = 2;
    pathApp.learningWorkbench.runtimeRunbookAutoFocusRegressingEnabled = true;
    pathApp.learningWorkbench.apiTraceRequestId = 'existing_req';
    pathApp.learningWorkbench.tutorRoutingAdapterTimeoutMs = 15000;
    pathApp.learningWorkbench.sessionHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.sessionHistoryPathStrategy = 'balanced';
    pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource = 'mode_fallback';
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = false;
    pathApp.learningWorkbench.sessionHistoryAutoRefreshIntervalSeconds = 60;
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount = 7;
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt = '2026-04-10T02:00:00.000Z';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied = true;
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason = 'focused';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId = 'api_latency_p95';

    pathApp._restoreLearningWorkbenchPreferences();
    expect(pathApp.learningWorkbench.runtimeCheckSortMode).toBe('priority');
    expect(pathApp.learningWorkbench.runtimeCheckStatusFilter).toBe('fail');
    expect(pathApp.learningWorkbench.runtimeCheckQueryFilter).toBe('query with space');
    expect(pathApp.learningWorkbench.pathStrategy).toBe('balanced');
    expect(pathApp.learningWorkbench.pathRecommendedActionLimit).toBe(4);
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueuePriorityFilter).toBe('all');
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueCategoryFilter).toBe('all');
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueCheckFilter).toBe('api_latency_p95');
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationStatusFilter).toBe('all');
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationTrendFilter).toBe('all');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes).toBe(0);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter).toBe('all');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter).toBe('learning_workbench_refresh');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter).toBe('api_server_error_ratio');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit).toBe(100);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit).toBe(24);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode).toBe('risk_only');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun).toBe(false);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy).toBe('history_order');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct).toBe(0);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleEnabled).toBe(false);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleIntervalMinutes).toBe(1440);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerPolicy).toBe('always');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskRatioPct).toBe(0);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskStreak).toBe(1);
    expect(pathApp.learningWorkbench.runtimeRunbookAutoFocusRegressingEnabled).toBe(false);
    expect(pathApp.learningWorkbench.apiTraceRequestId).toBe('reqtracerestore');
    expect(pathApp.learningWorkbench.tutorRoutingAdapterTimeoutMs).toBe(120000);
    expect(pathApp.learningWorkbench.sessionHistorySinceMinutes).toBe(0);
    expect(pathApp.learningWorkbench.sessionHistoryPathStrategy).toBe('all');
    expect(pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource).toBe('all');
    expect(pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled).toBe(false);
    expect(pathApp.learningWorkbench.sessionHistoryAutoRefreshIntervalSeconds).toBe(600);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount).toBe(0);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason).toBe('cooldown_active:10s');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId).toBe('api_server_error_ratio');
  });

  test('refresh session history performs targeted GET request with normalized filters', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.userId = '  demo_user ';
    pathApp.learningWorkbench.sessionHistorySinceMinutes = '2000.8';
    pathApp.learningWorkbench.sessionHistoryPathStrategy = 'MASTERY_RECOVERY';
    pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource = 'STRATEGY_TREND';
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;

    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const scheduleSpy = jest
      .spyOn(pathApp, '_scheduleLearningSessionHistoryAutoRefresh')
      .mockImplementation(() => undefined);
    const requestApiSpy = jest
      .spyOn(pathApp, '_requestLearningApi')
      .mockImplementation(async (...args: unknown[]) => {
        throw new Error(`Unexpected learning API call: ${String(args[0] || '')}`);
      });
    const requestedEndpoints: string[] = [];
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint.startsWith('/api/knowledge/session/history?')) {
        requestedEndpoints.push(endpoint);
        return {
          success: true,
          result: {
            userId: 'demo_user',
            records: [],
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 2000,
                pathStrategy: 'mastery_recovery',
                pathStrategySelectionSource: 'strategy_trend',
              },
            },
          },
        };
      }
      return null;
    });

    const result = await pathApp.refreshLearningWorkbenchSessionHistory({ force: true });

    expect(requestApiSpy).not.toHaveBeenCalled();
    expect(requestedEndpoints).toHaveLength(1);
    const query = requestedEndpoints[0].split('?')[1] || '';
    const params = new URLSearchParams(query);
    expect(params.get('userId')).toBe('demo_user');
    expect(params.get('limit')).toBe('8');
    expect(params.get('sinceMinutes')).toBe('2000');
    expect(params.get('pathStrategy')).toBe('mastery_recovery');
    expect(params.get('pathStrategySelectionSource')).toBe('strategy_trend');
    expect(pathApp.learningWorkbench.loading).toBe(false);
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(pathApp.learningWorkbench.sessionHistory?.summary?.appliedFilters).toEqual(
      expect.objectContaining({
        limit: 8,
        sinceMinutes: 2000,
        pathStrategy: 'mastery_recovery',
        pathStrategySelectionSource: 'strategy_trend',
      })
    );
    expect(result).toEqual(pathApp.learningWorkbench.sessionHistory);
  });

  test('session history query string includes refreshSource when provided', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.userId = 'path_user_default';

    const query = pathApp._buildLearningSessionHistoryQueryString({
      userId: ' path_user_default ',
      limit: 8,
      refreshSource: 'AUTO-REFRESH',
    });
    const params = new URLSearchParams(query);

    expect(params.get('userId')).toBe('path_user_default');
    expect(params.get('limit')).toBe('8');
    expect(params.get('refreshSource')).toBe('auto_refresh');
  });

  test('queues session history refresh while loading and applies latest queued request when current call finishes', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.userId = 'path_user_default';
    pathApp.learningWorkbench.sessionHistorySinceMinutes = 60;
    pathApp.learningWorkbench.sessionHistoryPathStrategy = 'balanced';
    pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource = 'all';
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_scheduleLearningSessionHistoryAutoRefresh').mockImplementation(() => undefined);

    const firstFetchDeferred: { resolve: (value: any) => void } = {
      resolve: () => undefined,
    };
    const fetchSpy = jest
      .spyOn(pathApp, '_fetchLearningWorkbenchSessionHistory')
      .mockImplementationOnce(async (...args: unknown[]) => {
        const requestState = (args[0] as Record<string, unknown> | undefined) || {};
        expect(requestState).toEqual(
          expect.objectContaining({
            userId: 'path_user_default',
            limit: 8,
            sinceMinutes: 60,
            pathStrategy: 'balanced',
            pathStrategySelectionSource: 'all',
          })
        );
        return new Promise((resolve) => {
          firstFetchDeferred.resolve = resolve as (value: any) => void;
        });
      })
      .mockImplementationOnce(async (...args: unknown[]) => {
        const requestState = (args[0] as Record<string, unknown> | undefined) || {};
        expect(requestState).toEqual(
          expect.objectContaining({
            userId: 'path_user_default',
            limit: 8,
            sinceMinutes: 1440,
            pathStrategy: 'mastery_recovery',
            pathStrategySelectionSource: 'strategy_trend',
          })
        );
        return {
          userId: 'path_user_default',
          records: [],
          summary: {
            totalRecords: 0,
            matchedRecordsBeforeLimit: 0,
            appliedFilters: {
              limit: 8,
              sinceMinutes: 1440,
              pathStrategy: 'mastery_recovery',
              pathStrategySelectionSource: 'strategy_trend',
            },
          },
        };
      });

    const firstRefreshPromise = pathApp.refreshLearningWorkbenchSessionHistory({
      sinceMinutes: 60,
      pathStrategy: 'balanced',
      pathStrategySelectionSource: 'all',
      force: true,
    });

    const queuedRefreshResult = await pathApp.refreshLearningWorkbenchSessionHistory({
      sinceMinutes: 1440,
      pathStrategy: 'mastery_recovery',
      pathStrategySelectionSource: 'strategy_trend',
      force: true,
    });

    expect(queuedRefreshResult).toBeNull();
    expect(pathApp._learningSessionHistoryQueuedRequestState).toEqual(
      expect.objectContaining({
        userId: 'path_user_default',
        sinceMinutes: 1440,
        pathStrategy: 'mastery_recovery',
        pathStrategySelectionSource: 'strategy_trend',
      })
    );
    firstFetchDeferred.resolve({
      userId: 'path_user_default',
      records: [],
      summary: {
        totalRecords: 0,
        matchedRecordsBeforeLimit: 0,
        appliedFilters: {
          limit: 8,
          sinceMinutes: 60,
          pathStrategy: 'balanced',
          pathStrategySelectionSource: 'all',
        },
      },
    });
    await firstRefreshPromise;
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(pathApp._learningSessionHistoryQueuedRequestState).toBeNull();
    expect(pathApp.learningWorkbench.sessionHistory?.summary?.appliedFilters).toEqual(
      expect.objectContaining({
        limit: 8,
        sinceMinutes: 1440,
        pathStrategy: 'mastery_recovery',
        pathStrategySelectionSource: 'strategy_trend',
      })
    );
  });

  test('does not trigger duplicate queued session history refresh when queued request matches in-flight request', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.userId = 'path_user_default';
    pathApp.learningWorkbench.sessionHistorySinceMinutes = 60;
    pathApp.learningWorkbench.sessionHistoryPathStrategy = 'balanced';
    pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource = 'all';
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_scheduleLearningSessionHistoryAutoRefresh').mockImplementation(() => undefined);

    const firstFetchDeferred: { resolve: (value: any) => void } = {
      resolve: () => undefined,
    };
    const fetchSpy = jest
      .spyOn(pathApp, '_fetchLearningWorkbenchSessionHistory')
      .mockImplementationOnce(async () => new Promise((resolve) => {
        firstFetchDeferred.resolve = resolve as (value: any) => void;
      }));

    const firstRefreshPromise = pathApp.refreshLearningWorkbenchSessionHistory({
      sinceMinutes: 60,
      pathStrategy: 'balanced',
      pathStrategySelectionSource: 'all',
      force: true,
    });

    await pathApp.refreshLearningWorkbenchSessionHistory({
      sinceMinutes: 60,
      pathStrategy: 'balanced',
      pathStrategySelectionSource: 'all',
      force: true,
    });

    expect(pathApp._learningSessionHistoryQueuedRequestState).toEqual(
      expect.objectContaining({
        sinceMinutes: 60,
        pathStrategy: 'balanced',
        pathStrategySelectionSource: 'all',
      })
    );
    firstFetchDeferred.resolve({
      userId: 'path_user_default',
      records: [],
      summary: {
        totalRecords: 0,
        matchedRecordsBeforeLimit: 0,
        appliedFilters: {
          limit: 8,
          sinceMinutes: 60,
          pathStrategy: 'balanced',
          pathStrategySelectionSource: 'all',
        },
      },
    });
    await firstRefreshPromise;
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(pathApp._learningSessionHistoryQueuedRequestState).toBeNull();
  });

  test('schedules session history auto refresh with normalized interval when enabled', () => {
    const { pathApp, timers } = loadPathAppHarness();
    timers.setTimeout.mockClear();
    timers.clearTimeout.mockClear();
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    pathApp.learningWorkbench.sessionHistoryAutoRefreshIntervalSeconds = '9';
    jest.spyOn(pathApp, '_isLearningWorkbenchSidebarVisible').mockReturnValue(true);

    pathApp._scheduleLearningSessionHistoryAutoRefresh();

    expect(pathApp.learningWorkbench.sessionHistoryAutoRefreshIntervalSeconds).toBe(15);
    expect(timers.setTimeout).toHaveBeenCalledTimes(1);
    expect(timers.setTimeout).toHaveBeenCalledWith(expect.any(Function), 15000);
    expect(pathApp._learningSessionHistoryAutoRefreshTimer).toBe(1);
  });

  test('schedules session history auto refresh with exponential backoff after repeated failures', () => {
    const { pathApp, timers } = loadPathAppHarness();
    timers.setTimeout.mockClear();
    timers.clearTimeout.mockClear();
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    pathApp.learningWorkbench.sessionHistoryAutoRefreshIntervalSeconds = 30;
    pathApp._learningSessionHistoryAutoRefreshFailureCount = 2;
    jest.spyOn(pathApp, '_isLearningWorkbenchSidebarVisible').mockReturnValue(true);

    pathApp._scheduleLearningSessionHistoryAutoRefresh();

    expect(pathApp._learningSessionHistoryAutoRefreshLastDelaySeconds).toBe(120);
    expect(timers.setTimeout).toHaveBeenCalledTimes(1);
    expect(timers.setTimeout).toHaveBeenCalledWith(expect.any(Function), 120000);
  });

  test('session history auto refresh tick skips request when document is hidden', async () => {
    const { pathApp, documentStub } = loadPathAppHarness();
    documentStub.hidden = true;
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    jest.spyOn(pathApp, '_isLearningWorkbenchSidebarVisible').mockReturnValue(true);
    const scheduleSpy = jest
      .spyOn(pathApp, '_scheduleLearningSessionHistoryAutoRefresh')
      .mockImplementation(() => undefined);
    const refreshSpy = jest
      .spyOn(pathApp, 'refreshLearningWorkbenchSessionHistory')
      .mockResolvedValue(null);

    await pathApp._runLearningSessionHistoryAutoRefreshTick();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
  });

  test('session history auto refresh tick skips request when workbench is loading', async () => {
    const { pathApp, documentStub } = loadPathAppHarness();
    documentStub.hidden = false;
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    pathApp.learningWorkbench.loading = true;
    jest.spyOn(pathApp, '_isLearningWorkbenchSidebarVisible').mockReturnValue(true);
    const scheduleSpy = jest
      .spyOn(pathApp, '_scheduleLearningSessionHistoryAutoRefresh')
      .mockImplementation(() => undefined);
    const refreshSpy = jest
      .spyOn(pathApp, 'refreshLearningWorkbenchSessionHistory')
      .mockResolvedValue(null);

    await pathApp._runLearningSessionHistoryAutoRefreshTick();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
  });

  test('visibility change handler clears session history auto refresh timer when document becomes hidden', () => {
    const { pathApp, documentStub } = loadPathAppHarness();
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    pathApp._learningSessionHistoryAutoRefreshTimer = 42;
    jest.spyOn(pathApp, '_isLearningWorkbenchSidebarVisible').mockReturnValue(true);
    const clearSpy = jest
      .spyOn(pathApp, '_clearLearningSessionHistoryAutoRefreshTimer')
      .mockImplementation(() => {
        pathApp._learningSessionHistoryAutoRefreshTimer = null;
      });
    documentStub.hidden = true;

    pathApp._handleLearningSessionHistoryVisibilityChange();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(pathApp._learningSessionHistoryAutoRefreshTimer).toBeNull();
  });

  test('visibility change handler triggers immediate session history refresh when document becomes visible', () => {
    const { pathApp, documentStub } = loadPathAppHarness();
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    pathApp.learningWorkbench.loading = false;
    jest.spyOn(pathApp, '_isLearningWorkbenchSidebarVisible').mockReturnValue(true);
    const refreshSpy = jest
      .spyOn(pathApp, 'refreshLearningWorkbenchSessionHistory')
      .mockResolvedValue(null);
    documentStub.hidden = false;

    pathApp._handleLearningSessionHistoryVisibilityChange();

    expect(refreshSpy).toHaveBeenCalledWith({
      force: true,
      autoRefreshTick: true,
      refreshSource: 'visibility_resume',
    });
  });

  test('auto-refresh session history failure increments failure counter and records last error', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_scheduleLearningSessionHistoryAutoRefresh').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_fetchLearningWorkbenchSessionHistory').mockRejectedValue(
      new Error('temporary outage')
    );

    const result = await pathApp.refreshLearningWorkbenchSessionHistory({
      force: true,
      autoRefreshTick: true,
    });

    expect(result).toBeNull();
    expect(pathApp._learningSessionHistoryAutoRefreshFailureCount).toBe(1);
    expect(pathApp._learningSessionHistoryAutoRefreshLastError).toContain('temporary outage');
  });

  test('successful session history refresh clears auto-refresh failure state', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.sessionHistoryAutoRefreshEnabled = true;
    pathApp._learningSessionHistoryAutoRefreshFailureCount = 3;
    pathApp._learningSessionHistoryAutoRefreshLastError = 'previous_error';
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_scheduleLearningSessionHistoryAutoRefresh').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_fetchLearningWorkbenchSessionHistory').mockResolvedValue({
      userId: 'path_user_default',
      records: [],
      summary: {
        totalRecords: 0,
        matchedRecordsBeforeLimit: 0,
        appliedFilters: {
          limit: 8,
          sinceMinutes: 0,
          pathStrategy: 'all',
          pathStrategySelectionSource: 'all',
        },
      },
    });

    await pathApp.refreshLearningWorkbenchSessionHistory({
      force: true,
      autoRefreshTick: true,
    });

    expect(pathApp._learningSessionHistoryAutoRefreshFailureCount).toBe(0);
    expect(pathApp._learningSessionHistoryAutoRefreshLastError).toBe('');
    expect(String(pathApp._learningSessionHistoryAutoRefreshLastSuccessAt || '')).not.toBe('');
  });

  test('manual session history refresh clears queued request and triggers immediate refresh', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp._learningSessionHistoryQueuedRequestState = {
      userId: 'path_user_default',
      limit: 8,
      sinceMinutes: 60,
      pathStrategy: 'balanced',
      pathStrategySelectionSource: 'all',
    };
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const clearTimerSpy = jest
      .spyOn(pathApp, '_clearLearningSessionHistoryAutoRefreshTimer')
      .mockImplementation(() => undefined);
    const refreshSpy = jest
      .spyOn(pathApp, 'refreshLearningWorkbenchSessionHistory')
      .mockResolvedValue({
        userId: 'path_user_default',
        records: [],
        summary: {
          totalRecords: 0,
        },
      });

    await pathApp.refreshLearningWorkbenchSessionHistoryNow();

    expect(pathApp._learningSessionHistoryQueuedRequestState).toBeNull();
    expect(clearTimerSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledWith({ force: true, refreshSource: 'manual' });
  });

  test('suggests transient-error trace filter based on runtime scope defaults', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {
        apiTraceScopePathPrefix: '/api/knowledge',
        apiTraceScopeMethod: 'GET',
      },
      checks: [],
    };

    const suggestion = pathApp._suggestLearningApiTraceFilterForCapabilityCheck('api_transient_error_ratio');
    expect(suggestion.pathPrefix).toBe('/api/knowledge');
    expect(suggestion.statusAtLeast).toBe(400);
    expect(suggestion.method).toBe('GET');
    expect(suggestion.errorCode).toBe('');
  });

  test('suggests latency trace filter with statusAtLeast=0 for slow-route diagnostics', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {
        apiTraceScopePathPrefix: '/api/knowledge',
        apiTraceScopeMethod: 'POST',
      },
      checks: [],
    };

    const suggestion = pathApp._suggestLearningApiTraceFilterForCapabilityCheck('api_latency_hotspots');
    expect(suggestion.pathPrefix).toBe('/api/knowledge');
    expect(suggestion.statusAtLeast).toBe(0);
    expect(suggestion.method).toBe('POST');
    expect(suggestion.errorCode).toBe('');
  });

  test('suggests dynamic tutor routing alignment trace filter for provider history diagnostics', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {},
      checks: [],
    };

    const suggestion = pathApp._suggestLearningApiTraceFilterForCapabilityCheck(
      'tutor_routing_dynamic_mode_alignment'
    );
    expect(suggestion.pathPrefix).toBe('/api/knowledge/tutor/trace-diagnostics/providers/history');
    expect(suggestion.statusAtLeast).toBe(0);
    expect(suggestion.method).toBe('GET');
    expect(suggestion.errorCode).toBe('');
  });

  test('suggests vector acceleration governance trace filter for connector diagnostics endpoint', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {
        queryVectorIndexAccelerationLastRequestId: 'connector-req-001',
      },
      checks: [],
    };

    const suggestion = pathApp._suggestLearningApiTraceFilterForCapabilityCheck(
      'query_vector_acceleration_circuit_state'
    );
    expect(suggestion.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
    expect(suggestion.statusAtLeast).toBe(0);
    expect(suggestion.method).toBe('GET');
    expect(suggestion.errorCode).toBe('');
    expect(suggestion.requestId).toBe('');
  });

  test('suggests vector acceleration traceability filter for connector diagnostics endpoint', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {},
      checks: [],
    };

    const suggestion = pathApp._suggestLearningApiTraceFilterForCapabilityCheck(
      'query_vector_acceleration_traceability'
    );
    expect(suggestion.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
    expect(suggestion.statusAtLeast).toBe(0);
    expect(suggestion.method).toBe('GET');
    expect(suggestion.errorCode).toBe('');
    expect(suggestion.requestId).toBe('');
  });

  test('suggests vector acceleration prefilter effectiveness filter for connector diagnostics endpoint', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {},
      checks: [],
    };

    const suggestion = pathApp._suggestLearningApiTraceFilterForCapabilityCheck(
      'query_vector_acceleration_prefilter_effectiveness'
    );
    expect(suggestion.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
    expect(suggestion.statusAtLeast).toBe(0);
    expect(suggestion.method).toBe('GET');
    expect(suggestion.errorCode).toBe('');
    expect(suggestion.requestId).toBe('');
  });

  test('selects top runtime risk check by priority and applies trace filter', async () => {
    const { pathApp } = loadPathAppHarness();
    const applySpy = jest
      .spyOn(pathApp, '_applyLearningApiTraceSuggestionFromCapabilityCheck')
      .mockResolvedValue(undefined);

    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      checks: [
        { checkId: 'query_fallback_ratio', status: 'warn', priorityScore: 210 },
        { checkId: 'api_server_error_hotspots', status: 'fail', priorityScore: 360 },
        { checkId: 'quality_trend_direction', status: 'pass', priorityScore: 500 },
      ],
    };

    const topRisk = pathApp._selectLearningTopRuntimeRiskCheck();
    expect(String(topRisk?.checkId || '')).toBe('api_server_error_hotspots');

    await pathApp._applyLearningApiTraceSuggestionFromTopRuntimeRisk();
    expect(applySpy).toHaveBeenCalledWith('api_server_error_hotspots');
  });

  test('resolves top regressing runtime check from recommended focus and applies trace filter', async () => {
    const { pathApp } = loadPathAppHarness();
    const applySpy = jest
      .spyOn(pathApp, '_applyLearningApiTraceSuggestionFromCapabilityCheck')
      .mockResolvedValue(undefined);
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({
        summary: {
          recommendedFocusCheckId: 'api_latency_p95',
        },
        checks: [],
      });

    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        recommendedFocusCheckId: 'api_server_error_ratio',
      },
      checks: [
        {
          checkId: 'api_server_error_ratio',
          trendStatus: 'regressing',
          latestStatus: 'fail',
          records: 3,
        },
      ],
    };

    expect(pathApp._resolveLearningTopRegressingRuntimeCheckId()).toBe('api_server_error_ratio');
    await pathApp._applyLearningApiTraceSuggestionFromTopRegressingRuntimeCheck();
    expect(applySpy).toHaveBeenCalledWith('api_server_error_ratio');
  });

  test('resolves top regressing runtime check from dynamic mode alignment conflict streak when recommended focus is missing', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        recommendedFocusCheckId: '',
        dynamicModeAlignmentConflictStreak: 3,
        dynamicModeAlignmentLatestStatus: 'warn',
      },
      checks: [],
    };

    expect(pathApp._resolveLearningTopRegressingRuntimeCheckId()).toBe(
      'tutor_routing_dynamic_mode_alignment'
    );
  });

  test('resolves top regressing runtime check from path strategy alignment conflict streak when recommended focus is missing', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        recommendedFocusCheckId: '',
        dynamicModeAlignmentConflictStreak: 1,
        dynamicModeAlignmentLatestStatus: 'pass',
        pathStrategyAlignmentConflictStreak: 3,
        pathStrategyAlignmentLatestStatus: 'warn',
      },
      checks: [],
    };

    expect(pathApp._resolveLearningTopRegressingRuntimeCheckId()).toBe(
      'orchestration_path_strategy_alignment'
    );
  });

  test('resolves runtime check focus from escalated checks when no regressing trend exists', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        recommendedFocusCheckId: '',
        dynamicModeAlignmentConflictStreak: 0,
        dynamicModeAlignmentLatestStatus: 'pass',
      },
      checks: [
        {
          checkId: 'api_server_error_ratio',
          trendStatus: 'stable',
          latestStatus: 'warn',
          latestEscalation: 'high',
          records: 3,
        },
        {
          checkId: 'api_latency_p95',
          trendStatus: 'stable',
          latestStatus: 'fail',
          latestEscalation: 'watch',
          records: 6,
        },
      ],
    };

    expect(pathApp._resolveLearningTopRegressingRuntimeCheckId()).toBe('api_server_error_ratio');
  });

  test('auto-focuses verification to recommended regressing check when enabled', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookAutoFocusRegressingEnabled = true;
    pathApp.learningWorkbench.runtimeRunbookVerification = {
      selectedCheckId: 'api_latency_p95',
    };
    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        recommendedFocusCheckId: 'api_server_error_ratio',
      },
      checks: [],
    };
    const verifySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerification')
      .mockResolvedValue({
        selectedCheckId: 'api_server_error_ratio',
      });

    const result = await pathApp._maybeAutoFocusLearningRuntimeRunbookVerification({
      skipHistoryRefresh: true,
      skipCheckSummaryRefresh: true,
      silent: true,
    });

    expect(verifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: 'auto',
        focus: 'recommended',
        focusLimit: 8,
        sinceMinutes: 360,
        status: 'all',
        skipHistoryRefresh: true,
        skipCheckSummaryRefresh: true,
        silent: true,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        applied: true,
        reason: 'focused',
        checkId: 'api_server_error_ratio',
      })
    );
  });

  test('does not auto-focus verification when regressing auto-focus is disabled', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookAutoFocusRegressingEnabled = false;
    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        recommendedFocusCheckId: 'api_server_error_ratio',
      },
      checks: [],
    };
    const verifySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerification')
      .mockResolvedValue({
        selectedCheckId: 'api_server_error_ratio',
      });

    const result = await pathApp._maybeAutoFocusLearningRuntimeRunbookVerification({
      silent: true,
    });

    expect(verifySpy).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        applied: false,
        reason: 'disabled',
      })
    );
  });

  test('refresh workbench auto-focuses recommended regressing check when enabled', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookAutoFocusRegressingEnabled = true;
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        return { summary: { totalActions: 0 }, actions: [] };
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [] };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (String(endpoint).startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
              },
            },
            records: [],
          },
        };
      }
      if (String(endpoint).startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: {
            selectedCheckId: 'api_latency_p95',
            selectedCheckStatus: 'warn',
            runbook: {
              selectedCheck: {
                checkId: 'api_latency_p95',
              },
            },
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return {
          success: true,
          runbook: {
            selectedCheck: {
              checkId: 'api_latency_p95',
            },
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return {
          success: true,
          matrix: {
            checks: [],
            signals: {},
          },
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockImplementation(async () => {
        const payload = {
          summary: {
            recommendedFocusCheckId: 'api_server_error_ratio',
          },
          checks: [],
        };
        pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = payload;
        return payload;
      });
    const verifySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerification')
      .mockImplementation(async (...args: unknown[]) => {
        const options = (args[0] as Record<string, unknown> | undefined) || {};
        const checkId = String(options.checkId || '');
        const resolvedCheckId = checkId === 'auto'
          ? 'api_server_error_ratio'
          : checkId;
        const verification = {
          selectedCheckId: resolvedCheckId,
          selectedCheckStatus: 'fail',
        };
        pathApp.learningWorkbench.runtimeRunbookVerification = verification;
        return verification;
      });
    const historySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory')
      .mockResolvedValue(null);

    await pathApp.refreshLearningWorkbench({ force: true });

    expect(verifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: 'auto',
        focus: 'recommended',
        focusLimit: 8,
        sinceMinutes: 360,
        status: 'all',
        skipHistoryRefresh: true,
        skipCheckSummaryRefresh: true,
        silent: true,
      })
    );
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: 'api_server_error_ratio',
      })
    );
  });

  test('refresh workbench keeps current runbook verification when regressing auto-focus is disabled', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookAutoFocusRegressingEnabled = false;
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        return { summary: { totalActions: 0 }, actions: [] };
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [] };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (String(endpoint).startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
              },
            },
            records: [],
          },
        };
      }
      if (String(endpoint).startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: {
            selectedCheckId: 'api_latency_p95',
            selectedCheckStatus: 'warn',
            runbook: {
              selectedCheck: {
                checkId: 'api_latency_p95',
              },
            },
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return {
          success: true,
          runbook: {
            selectedCheck: {
              checkId: 'api_latency_p95',
            },
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return {
          success: true,
          matrix: {
            checks: [],
            signals: {},
          },
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockImplementation(async () => {
        const payload = {
          summary: {
            recommendedFocusCheckId: 'api_server_error_ratio',
          },
          checks: [],
        };
        pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = payload;
        return payload;
      });
    const verifySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerification')
      .mockResolvedValue({
        selectedCheckId: 'api_server_error_ratio',
      });
    const historySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory')
      .mockResolvedValue(null);

    await pathApp.refreshLearningWorkbench({ force: true });

    expect(verifySpy).not.toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: 'api_latency_p95',
      })
    );
  });

  test('refresh workbench forwards path strategy controls into session plan request', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.pathStrategy = 'EXPLORATION_BOOST';
    pathApp.learningWorkbench.pathRecommendedActionLimit = '39';
    pathApp.learningWorkbench.sessionHistorySinceMinutes = '1440';
    pathApp.learningWorkbench.sessionHistoryPathStrategy = 'MASTERY_RECOVERY';
    pathApp.learningWorkbench.sessionHistoryPathStrategySelectionSource = 'STRATEGY_TREND';

    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    const sessionPlanPayloads: Array<Record<string, unknown>> = [];
    const sessionPlanCallOptions: Array<Record<string, unknown>> = [];
    const misconceptionsCallOptions: Array<Record<string, unknown>> = [];
    const sessionPlanEvaluateCallOptions: Array<Record<string, unknown>> = [];
    const sessionHistoryEndpoints: string[] = [];
    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      const payload = (args[1] && typeof args[1] === 'object')
        ? (args[1] as Record<string, unknown>)
        : {};
      const options = (args[3] && typeof args[3] === 'object')
        ? (args[3] as Record<string, unknown>)
        : {};
      if (endpoint === '/api/knowledge/session/plan') {
        sessionPlanPayloads.push(payload);
        sessionPlanCallOptions.push(options);
        return {
          summary: { totalActions: 1 },
          actions: [{ id: 'action_1', atomId: 'atom_1', kind: 'review' }],
        };
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        misconceptionsCallOptions.push(options);
        return { misconceptions: [] };
      }
      if (endpoint === '/api/knowledge/session/plan/evaluate') {
        sessionPlanEvaluateCallOptions.push(options);
        return { summary: { pass: true } };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (String(endpoint).startsWith('/api/knowledge/session/history?')) {
        sessionHistoryEndpoints.push(endpoint);
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 1440,
                pathStrategy: 'mastery_recovery',
                pathStrategySelectionSource: 'strategy_trend',
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return { success: true, runbook: { selectedCheck: { checkId: 'api_latency_p95' } } };
      }
      if (String(endpoint).startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: {
            selectedCheckId: 'api_latency_p95',
            selectedCheckStatus: 'warn',
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return {
          success: true,
          matrix: {
            checks: [],
            signals: {},
          },
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({ summary: {}, checks: [] });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue').mockResolvedValue(null);
    jest.spyOn(pathApp, '_maybeAutoFocusLearningRuntimeRunbookVerification').mockResolvedValue({
      applied: false,
      reason: 'disabled',
      checkId: 'api_latency_p95',
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory')
      .mockResolvedValue(null);

    await pathApp.refreshLearningWorkbench({ force: true });

    expect(sessionPlanPayloads).toHaveLength(1);
    expect(sessionPlanPayloads[0]).toEqual(
      expect.objectContaining({
        pathStrategy: 'exploration_boost',
        pathRecommendedActionLimit: 39,
      })
    );
    expect(pathApp.learningWorkbench.pathStrategy).toBe('exploration_boost');
    expect(pathApp.learningWorkbench.pathRecommendedActionLimit).toBe(39);
    expect(sessionHistoryEndpoints).toHaveLength(1);
    const sessionHistoryQuery = sessionHistoryEndpoints[0].split('?')[1] || '';
    const sessionHistoryParams = new URLSearchParams(sessionHistoryQuery);
    expect(sessionHistoryParams.get('userId')).toBe('path_user_default');
    expect(sessionHistoryParams.get('limit')).toBe('8');
    expect(sessionHistoryParams.get('sinceMinutes')).toBe('1440');
    expect(sessionHistoryParams.get('pathStrategy')).toBe('mastery_recovery');
    expect(sessionHistoryParams.get('pathStrategySelectionSource')).toBe('strategy_trend');
    expect(sessionHistoryParams.get('refreshSource')).toBe('workbench_refresh');
    expect(sessionPlanCallOptions).toEqual([
      expect.objectContaining({
        maxRetries: 2,
        retryable: true,
        timeoutMs: 22000,
      }),
    ]);
    expect(misconceptionsCallOptions).toEqual([
      expect.objectContaining({
        maxRetries: 2,
        retryable: true,
        timeoutMs: 22000,
      }),
    ]);
    expect(sessionPlanEvaluateCallOptions).toEqual([
      expect.objectContaining({
        maxRetries: 1,
        retryable: true,
        timeoutMs: 26000,
      }),
    ]);
    expect(pathApp.learningWorkbench.workbenchRefreshDegraded).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshFailureSources).toEqual([]);
    expect(pathApp.learningWorkbench.workbenchRefreshFailureCount).toBe(0);
    expect(pathApp.learningWorkbench.workbenchRefreshLastFailureSummary).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshRecoveredSources).toEqual([]);
    expect(pathApp.learningWorkbench.workbenchRefreshRecoveredCount).toBe(0);
    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(0);
    expect(Number(pathApp.learningWorkbench.workbenchRefreshLastDurationMs || 0)).toBeGreaterThanOrEqual(0);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount).toBe(0);
    expect(String(pathApp.learningWorkbench.workbenchRefreshLastSuccessAt || '')).not.toBe('');
  });

  test('refresh workbench degrades gracefully when required session plan request fails', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.sessionPlan = {
      userId: 'path_user_default',
      generatedAt: '2026-04-10T00:00:00.000Z',
      actions: [],
      summary: {
        totalActions: 2,
      },
    };
    pathApp.learningWorkbench.qualitySnapshot = { snapshot: { before: true } };
    pathApp.learningWorkbench.misconceptions = { misconceptions: [] };

    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        throw new Error('session plan unavailable');
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: { after: true } };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [{ atomId: 'atom_a', count: 1 }] };
      }
      if (endpoint === '/api/knowledge/session/plan/evaluate') {
        return { summary: { pass: true } };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint.startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
                refreshSource: 'workbench_refresh',
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return { success: true, matrix: { checks: [], signals: {} } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return { success: true, runbook: { selectedCheck: { checkId: 'api_latency_p95' } } };
      }
      if (endpoint.startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: { selectedCheckId: 'api_latency_p95', selectedCheckStatus: 'warn' },
        };
      }
      if (endpoint.startsWith('/api/runtime-request-trace?')) {
        return { success: true, result: { traces: [] } };
      }
      return { success: true, result: null };
    });

    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({ summary: {}, checks: [] });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue').mockResolvedValue(null);
    jest.spyOn(pathApp, '_maybeAutoFocusLearningRuntimeRunbookVerification').mockResolvedValue({
      applied: false,
      reason: 'disabled',
      checkId: '',
    });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory').mockResolvedValue(null);

    await pathApp.refreshLearningWorkbench({ force: true });

    expect(pathApp.learningWorkbench.loading).toBe(false);
    expect(pathApp.learningWorkbench.sessionPlan).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalActions: 2,
        }),
      })
    );
    expect(pathApp.learningWorkbench.qualitySnapshot).toEqual(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          after: true,
        }),
      })
    );
    expect(pathApp.learningWorkbench.misconceptions).toEqual(
      expect.objectContaining({
        misconceptions: expect.any(Array),
      })
    );
    expect(pathApp.learningWorkbench.workbenchRefreshDegraded).toBe(true);
    expect(pathApp.learningWorkbench.workbenchRefreshFailureSources).toContain('session_plan');
    expect(Number(pathApp.learningWorkbench.workbenchRefreshFailureCount || 0)).toBeGreaterThanOrEqual(1);
    expect(String(pathApp.learningWorkbench.workbenchRefreshLastFailureSummary || '')).toContain('session_plan');
    expect(pathApp.learningWorkbench.workbenchRefreshRecoveredSources).toEqual([]);
    expect(pathApp.learningWorkbench.workbenchRefreshRecoveredCount).toBe(0);
    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(1);
    expect(Number(pathApp.learningWorkbench.workbenchRefreshLastDurationMs || 0)).toBeGreaterThanOrEqual(0);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount).toBe(0);
    expect(String(pathApp.learningWorkbench.workbenchRefreshLastSuccessAt || '')).not.toBe('');
    expect(String(pathApp.learningWorkbench.lastError || '')).toContain('session_plan');
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('degraded data'),
      true
    );
  });

  test('refresh workbench tracks recovered sources when a step succeeds after retries', async () => {
    const { pathApp } = loadPathAppHarness();
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        pathApp._appendLearningApiRequestTrace({
          requestId: `mock-trace-session-plan-${Date.now()}`,
          endpoint,
          method: 'POST',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 10,
          succeeded: true,
          status: 200,
          serverRequestId: 'srv-session-plan-recovered',
          errorCode: '',
          attemptCount: 2,
          payload: {},
          attempts: [],
        });
        return {
          summary: { totalActions: 1 },
          actions: [{ id: 'action_1', atomId: 'atom_1', kind: 'review' }],
        };
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [] };
      }
      if (endpoint === '/api/knowledge/session/plan/evaluate') {
        return { summary: { pass: true } };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint.startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
                refreshSource: 'workbench_refresh',
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return { success: true, matrix: { checks: [], signals: {} } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return { success: true, runbook: { selectedCheck: { checkId: 'api_latency_p95' } } };
      }
      if (endpoint.startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: { selectedCheckId: 'api_latency_p95', selectedCheckStatus: 'warn' },
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({ summary: {}, checks: [] });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue').mockResolvedValue(null);
    jest.spyOn(pathApp, '_maybeAutoFocusLearningRuntimeRunbookVerification').mockResolvedValue({
      applied: false,
      reason: 'disabled',
      checkId: '',
    });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory').mockResolvedValue(null);

    await pathApp.refreshLearningWorkbench({ force: true });

    expect(pathApp.learningWorkbench.workbenchRefreshDegraded).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshRecoveredSources).toContain('session_plan');
    expect(Number(pathApp.learningWorkbench.workbenchRefreshRecoveredCount || 0)).toBeGreaterThanOrEqual(1);
    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(0);
  });

  test('refresh workbench tracks consecutive degraded count across repeated degraded refreshes', async () => {
    const { pathApp } = loadPathAppHarness();
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        throw new Error('session plan unstable');
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [] };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint.startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
                refreshSource: 'workbench_refresh',
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return { success: true, matrix: { checks: [], signals: {} } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return { success: true, runbook: { selectedCheck: { checkId: 'api_latency_p95' } } };
      }
      if (endpoint.startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: { selectedCheckId: 'api_latency_p95', selectedCheckStatus: 'warn' },
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({ summary: {}, checks: [] });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue').mockResolvedValue(null);
    jest.spyOn(pathApp, '_maybeAutoFocusLearningRuntimeRunbookVerification').mockResolvedValue({
      applied: false,
      reason: 'disabled',
      checkId: '',
    });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory').mockResolvedValue(null);

    await pathApp.refreshLearningWorkbench({ force: true });
    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(1);

    await pathApp.refreshLearningWorkbench({ force: true });
    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(2);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount).toBe(0);
  });

  test('refresh workbench triggers auto remediation at degraded streak threshold and records metadata', async () => {
    const { pathApp } = loadPathAppHarness();
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const remediationEventPayloads: Array<Record<string, unknown>> = [];

    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        throw new Error('session plan unstable');
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [] };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint.startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
                refreshSource: 'workbench_refresh',
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return { success: true, matrix: { checks: [], signals: {} } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return { success: true, runbook: { selectedCheck: { checkId: 'api_latency_p95' } } };
      }
      if (endpoint.startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: { selectedCheckId: 'api_latency_p95', selectedCheckStatus: 'warn' },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook/history/remediation-events?limit=12&sinceMinutes=1440') {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecords: 0,
              returnedRecords: 0,
              statusCounts: {
                applied: 0,
                not_applied: 0,
                cooldown: 0,
                error: 0,
                ignored: 0,
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook/remediation-event') {
        const options = (args[1] && typeof args[1] === 'object')
          ? (args[1] as Record<string, unknown>)
          : {};
        const payload = (options.payload && typeof options.payload === 'object')
          ? (options.payload as Record<string, unknown>)
          : {};
        remediationEventPayloads.push(payload);
        return {
          success: true,
          result: { record: payload },
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({ summary: {}, checks: [] });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue').mockResolvedValue(null);
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory').mockResolvedValue(null);
    jest.spyOn(pathApp, '_maybeAutoFocusLearningRuntimeRunbookVerification').mockResolvedValue({
      applied: true,
      reason: 'focused',
      checkId: 'api_latency_p95',
      verification: { selectedCheckId: 'api_latency_p95' },
    });
    const traceSuggestionSpy = jest
      .spyOn(pathApp, '_applyLearningApiTraceSuggestionFromTopRegressingRuntimeCheck')
      .mockResolvedValue(undefined);

    await pathApp.refreshLearningWorkbench({ force: true });
    await pathApp.refreshLearningWorkbench({ force: true });
    await pathApp.refreshLearningWorkbench({ force: true });

    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(3);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied).toBe(true);
    expect(String(pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt || '')).not.toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason).toContain('focused');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId).toBe('api_latency_p95');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount).toBe(1);
    expect(traceSuggestionSpy).toHaveBeenCalledTimes(1);
    expect(remediationEventPayloads).toHaveLength(1);
    expect(remediationEventPayloads[0]).toEqual(
      expect.objectContaining({
        source: 'learning_workbench_refresh',
        status: 'applied',
        checkId: 'api_latency_p95',
      })
    );
    expect(statusSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('AutoRemediation=applied'),
      true
    );
  });

  test('refresh workbench keeps degraded flow when auto remediation focus call fails', async () => {
    const { pathApp } = loadPathAppHarness();
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        throw new Error('session plan unstable');
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [] };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint.startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
                refreshSource: 'workbench_refresh',
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return { success: true, matrix: { checks: [], signals: {} } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return { success: true, runbook: { selectedCheck: { checkId: 'api_latency_p95' } } };
      }
      if (endpoint.startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: { selectedCheckId: 'api_latency_p95', selectedCheckStatus: 'warn' },
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({ summary: {}, checks: [] });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue').mockResolvedValue(null);
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory').mockResolvedValue(null);
    jest
      .spyOn(pathApp, '_maybeAutoFocusLearningRuntimeRunbookVerification')
      .mockResolvedValueOnce({ applied: false, reason: 'disabled', checkId: '' })
      .mockResolvedValueOnce({ applied: false, reason: 'disabled', checkId: '' })
      .mockResolvedValueOnce({ applied: false, reason: 'disabled', checkId: '' })
      .mockRejectedValueOnce(new Error('auto remediation focus failed'));
    const traceSuggestionSpy = jest
      .spyOn(pathApp, '_applyLearningApiTraceSuggestionFromTopRegressingRuntimeCheck')
      .mockResolvedValue(undefined);

    await pathApp.refreshLearningWorkbench({ force: true });
    await pathApp.refreshLearningWorkbench({ force: true });
    await pathApp.refreshLearningWorkbench({ force: true });

    expect(pathApp.learningWorkbench.loading).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshDegraded).toBe(true);
    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(3);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason).toContain('auto_focus_error');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId).toBe('');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount).toBe(0);
    expect(String(pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt || '')).not.toBe('');
    expect(traceSuggestionSpy).not.toHaveBeenCalled();
  });

  test('refresh workbench skips repeated auto remediation within cooldown window', async () => {
    const { pathApp } = loadPathAppHarness();
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_persistLearningWorkbenchPreferences').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const remediationEventPayloads: Array<Record<string, unknown>> = [];

    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint === '/api/knowledge/session/plan') {
        throw new Error('session plan unstable');
      }
      if (endpoint === '/api/knowledge/quality/snapshot') {
        return { snapshot: {} };
      }
      if (endpoint === '/api/knowledge/mastery/misconceptions') {
        return { misconceptions: [] };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });
    jest.spyOn(pathApp, '_requestLearningApiOptional').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      if (endpoint.startsWith('/api/knowledge/session/history?')) {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecordsBeforeLimit: 0,
              appliedFilters: {
                limit: 8,
                sinceMinutes: 0,
                pathStrategy: '',
                pathStrategySelectionSource: '',
                refreshSource: 'workbench_refresh',
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/state') {
        return {
          success: true,
          configuredBackends: { store: 'file', query: 'local_hybrid' },
          runtimeCapabilityMatrix: { checks: [], signals: {} },
          queryBackendDiagnostics: {},
          store: {},
        };
      }
      if (endpoint === '/api/knowledge/store-diagnostics') {
        return { success: true, store: {}, configuredBackend: 'file' };
      }
      if (endpoint === '/api/knowledge/query-backend-diagnostics') {
        return { success: true, diagnostics: {}, configuredBackend: 'local_hybrid' };
      }
      if (endpoint === '/api/knowledge/query-backend-config') {
        return { success: true, result: { configuredBackend: 'local_hybrid' } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-matrix') {
        return { success: true, matrix: { checks: [], signals: {} } };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook') {
        return { success: true, runbook: { selectedCheck: { checkId: 'api_latency_p95' } } };
      }
      if (endpoint.startsWith('/api/knowledge/runtime-capability-runbook/verify?')) {
        return {
          success: true,
          result: { selectedCheckId: 'api_latency_p95', selectedCheckStatus: 'warn' },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook/history/remediation-events?limit=12&sinceMinutes=1440') {
        return {
          success: true,
          result: {
            summary: {
              totalRecords: 0,
              matchedRecords: 0,
              returnedRecords: 0,
              statusCounts: {
                applied: 0,
                not_applied: 0,
                cooldown: 0,
                error: 0,
                ignored: 0,
              },
            },
            records: [],
          },
        };
      }
      if (endpoint === '/api/knowledge/runtime-capability-runbook/remediation-event') {
        const options = (args[1] && typeof args[1] === 'object')
          ? (args[1] as Record<string, unknown>)
          : {};
        const payload = (options.payload && typeof options.payload === 'object')
          ? (options.payload as Record<string, unknown>)
          : {};
        remediationEventPayloads.push(payload);
        return {
          success: true,
          result: { record: payload },
        };
      }
      return { success: true, result: null };
    });
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({ summary: {}, checks: [] });
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue').mockResolvedValue(null);
    jest.spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory').mockResolvedValue(null);
    jest.spyOn(pathApp, '_maybeAutoFocusLearningRuntimeRunbookVerification').mockResolvedValue({
      applied: true,
      reason: 'focused',
      checkId: 'api_latency_p95',
      verification: { selectedCheckId: 'api_latency_p95' },
    });
    const traceSuggestionSpy = jest
      .spyOn(pathApp, '_applyLearningApiTraceSuggestionFromTopRegressingRuntimeCheck')
      .mockResolvedValue(undefined);

    await pathApp.refreshLearningWorkbench({ force: true });
    await pathApp.refreshLearningWorkbench({ force: true });
    await pathApp.refreshLearningWorkbench({ force: true });
    await pathApp.refreshLearningWorkbench({ force: true });

    expect(pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount).toBe(4);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied).toBe(false);
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason).toContain('cooldown_active');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId).toBe('api_latency_p95');
    expect(pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount).toBe(1);
    expect(traceSuggestionSpy).toHaveBeenCalledTimes(1);
    expect(remediationEventPayloads).toHaveLength(2);
    expect(remediationEventPayloads[0]).toEqual(
      expect.objectContaining({
        status: 'applied',
      })
    );
    expect(remediationEventPayloads[1]).toEqual(
      expect.objectContaining({
        status: 'cooldown',
        checkId: 'api_latency_p95',
      })
    );
  });

  test('run workbench session forwards normalized path strategy controls into execute request', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.pathStrategy = 'MASTERY_RECOVERY';
    pathApp.learningWorkbench.pathRecommendedActionLimit = '41';
    pathApp.learningWorkbench.sessionPlan = {
      userId: 'demo-user',
      generatedAt: '2026-04-10T00:00:00.000Z',
      actions: [
        {
          id: 'action_demo_1',
          atomId: 'atom_demo_1',
          kind: 'review',
          source: 'mastery_path',
          priority: 110,
          expectedGain: 0.42,
          rationale: 'demo rationale',
          evidenceSpanIds: ['evidence_demo_1'],
          relationPathAtomIds: ['atom_demo_1'],
          estimatedMinutes: 5,
        },
      ],
      signals: {
        misconceptions: [],
        dueRetrainAtoms: [],
        masteryPathTargets: ['atom_demo_1'],
        divergenceTargets: [],
      },
      summary: {
        totalActions: 1,
        totalEstimatedMinutes: 5,
        evidenceCoverageRatio: 1,
      },
    };

    jest.spyOn(pathApp, '_hasLearningTutorCatalog').mockReturnValue(true);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    const executePayloads: Array<Record<string, unknown>> = [];
    jest.spyOn(pathApp, '_requestLearningApi').mockImplementation(async (...args: unknown[]) => {
      const endpoint = String(args[0] || '');
      const payload = (args[1] && typeof args[1] === 'object')
        ? (args[1] as Record<string, unknown>)
        : {};
      if (endpoint === '/api/knowledge/session/execute') {
        executePayloads.push(payload);
        return {
          summary: {
            executedCount: 1,
            attemptedActions: 1,
            updatedMasteryCount: 0,
            analyzedAnswerCount: 0,
          },
          items: [],
          retestPlan: {
            summary: {
              totalActions: 0,
            },
            actions: [],
          },
        };
      }
      throw new Error(`Unexpected learning API endpoint: ${endpoint}`);
    });

    await pathApp.runLearningWorkbenchSession({ actionLimit: 1 });

    expect(executePayloads).toHaveLength(1);
    expect(executePayloads[0]).toEqual(
      expect.objectContaining({
        pathStrategy: 'mastery_recovery',
        pathRecommendedActionLimit: 41,
      })
    );
    expect(pathApp.learningWorkbench.pathStrategy).toBe('mastery_recovery');
    expect(pathApp.learningWorkbench.pathRecommendedActionLimit).toBe(41);
  });

  test('top runtime risk trace apply reports status when no warn/fail check exists', async () => {
    const { pathApp } = loadPathAppHarness();
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);

    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      checks: [
        { checkId: 'query_fallback_ratio', status: 'pass', priorityScore: 120 },
      ],
    };

    await pathApp._applyLearningApiTraceSuggestionFromTopRuntimeRisk();
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('No warn/fail runtime capability checks available')
    );
  });

  test('top regressing trace apply reports status when no regressing check exists', async () => {
    const { pathApp } = loadPathAppHarness();
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue({
        summary: {},
        checks: [],
      });

    pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary = {
      summary: {
        recommendedFocusCheckId: '',
      },
      checks: [],
    };

    await pathApp._applyLearningApiTraceSuggestionFromTopRegressingRuntimeCheck();
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('No regressing runtime verification check available')
    );
  });

  test('resolves top runtime runbook action queue item and applies trace suggestion by check id', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookActionQueue = {
      summary: {
        returnedQueueItems: 2,
      },
      actionQueue: [
        {
          queueId: 'queue_1',
          checkId: 'api_latency_p95',
          checkLatestStatus: 'warn',
          checkLatestEscalation: 'watch',
          checkTrendStatus: 'stable',
          actionId: 'monitor_latency',
          priority: 'p1',
          category: 'monitor',
          instruction: 'Monitor latency trend before escalation.',
          endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
        },
        {
          queueId: 'queue_2',
          checkId: 'api_server_error_ratio',
          checkLatestStatus: 'fail',
          checkLatestEscalation: 'critical',
          checkTrendStatus: 'regressing',
          actionId: 'mitigate_immediately',
          priority: 'p0',
          category: 'stabilize',
          instruction: 'Trigger immediate mitigation.',
          endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
        },
      ],
    };
    const applySpy = jest
      .spyOn(pathApp, '_applyLearningApiTraceSuggestionFromCapabilityCheck')
      .mockResolvedValue(undefined);

    const topQueueItem = pathApp._resolveLearningTopRunbookActionQueueItem();
    expect(topQueueItem).toEqual(
      expect.objectContaining({
        checkId: 'api_server_error_ratio',
        priority: 'p0',
      })
    );
    await pathApp._applyLearningApiTraceSuggestionFromTopRunbookActionQueue();
    expect(applySpy).toHaveBeenCalledWith('api_server_error_ratio');
  });

  test('prefilter risk boost prioritizes prefilter action queue item over remediation-heavy peers at same priority', () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookActionQueue = {
      summary: {
        returnedQueueItems: 2,
      },
      actionQueue: [
        {
          queueId: 'queue_api_1',
          checkId: 'api_server_error_ratio',
          checkLatestStatus: 'fail',
          checkLatestEscalation: 'critical',
          checkTrendStatus: 'regressing',
          remediationLatestStatus: 'error',
          remediationTrendStatus: 'regressing',
          remediationActiveRiskStreak: 12,
          remediationRiskRatioPct: 100,
          actionId: 'collect_runtime_trace_evidence',
          priority: 'p1',
          category: 'evidence',
          instruction: 'Collect runtime trace evidence for api_server_error_ratio.',
          endpointHint: '/api/runtime-request-trace',
        },
        {
          queueId: 'queue_prefilter_1',
          checkId: 'query_vector_acceleration_prefilter_effectiveness',
          checkLatestStatus: 'fail',
          checkLatestEscalation: 'high',
          checkTrendStatus: 'regressing',
          remediationLatestStatus: 'applied',
          remediationTrendStatus: 'improving',
          remediationActiveRiskStreak: 0,
          remediationRiskRatioPct: 0,
          actionId: 'inspect_ann_prefilter_selection_telemetry',
          priority: 'p1',
          category: 'evidence',
          instruction: 'Inspect ANN prefilter selection telemetry and candidate counters.',
          endpointHint: '/api/knowledge/query-backend-diagnostics',
        },
      ],
    };

    const topQueueItem = pathApp._resolveLearningTopRunbookActionQueueItem();
    expect(topQueueItem).toEqual(
      expect.objectContaining({
        checkId: 'query_vector_acceleration_prefilter_effectiveness',
        actionId: 'inspect_ann_prefilter_selection_telemetry',
        priority: 'p1',
      })
    );
  });

  test('top action queue trace apply reports status when queue is empty', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookActionQueue = null;
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue')
      .mockResolvedValue(null);

    await pathApp._applyLearningApiTraceSuggestionFromTopRunbookActionQueue();

    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('No runtime runbook action queue item available')
    );
  });

  test('runtime top-risk summary includes first actionable recommendation', () => {
    const { pathApp } = loadPathAppHarness();
    const summary = pathApp._summarizeLearningRuntimeTopRisk({
      checks: [
        {
          checkId: 'api_latency_p95',
          status: 'warn',
          priorityScore: 220,
          recommendedActions: ['Tune p95 budget for /api/knowledge/session/execute endpoint.'],
        },
        {
          checkId: 'api_server_error_hotspots',
          status: 'fail',
          priorityScore: 360,
          recommendedActions: ['Investigate 5xx hotspot route and capture requestId-linked logs.'],
        },
      ],
    });
    expect(summary).toContain('topRisk=api_server_error_hotspots:fail@360');
    expect(summary).toContain('next=Investigate 5xx hotspot route');
  });

  test('summarizes runtime runbook check trends with recommended escalation token', () => {
    const { pathApp } = loadPathAppHarness();
    const summaryText = pathApp._summarizeLearningRuntimeRunbookCheckTrends({
      summary: {
        regressingChecks: 1,
        improvingChecks: 0,
        stableChecks: 2,
        insufficientDataChecks: 0,
        recommendedFocusCheckId: 'api_server_error_ratio',
        recommendedFocusReason: 'regressing_trend',
        recommendedFocusEscalation: 'high',
      },
      checks: [
        {
          checkId: 'api_server_error_ratio',
          trendStatus: 'regressing',
          latestStatus: 'warn',
          latestEscalation: 'high',
        },
      ],
    });

    expect(summaryText).toContain('checkTrends(regress/improve/stable/insufficient)=1/0/2/0');
    expect(summaryText).toContain('topRegressing=api_server_error_ratio:warn');
    expect(summaryText).toContain('recommended=api_server_error_ratio(regressing_trend|high)');
  });

  test('runtime top-risk summary returns none when all checks pass', () => {
    const { pathApp } = loadPathAppHarness();
    const summary = pathApp._summarizeLearningRuntimeTopRisk({
      checks: [
        {
          checkId: 'query_fallback_ratio',
          status: 'pass',
          priorityScore: 100,
          recommendedActions: ['No action needed.'],
        },
      ],
    });
    expect(summary).toBe('topRisk=none');
  });

  test('runtime top-risk summary prefers server-provided topRisk signals when present', () => {
    const { pathApp } = loadPathAppHarness();
    const summary = pathApp._summarizeLearningRuntimeTopRisk({
      signals: {
        topRiskCheckId: 'memory_policy_health',
        topRiskStatus: 'fail',
        topRiskPriorityScore: 340,
        topRiskRecommendedActions: [
          'Run memory cleanup and retraining before enabling adaptive routing.',
        ],
      },
      checks: [
        {
          checkId: 'query_fallback_ratio',
          status: 'warn',
          priorityScore: 220,
          recommendedActions: ['Fallback ratio warning action.'],
        },
      ],
    });
    expect(summary).toContain('topRisk=memory_policy_health:fail@340');
    expect(summary).toContain('next=Run memory cleanup and retraining');
  });

  test('runtime summary renders workbench auto remediation telemetry fields', () => {
    const { pathApp, elements } = loadPathAppHarness();
    const runtimeSummaryEl = createMockElement();
    elements.set('learning-runtime-summary', runtimeSummaryEl);

    pathApp.learningWorkbench.workbenchRefreshDegraded = true;
    pathApp.learningWorkbench.workbenchRefreshFailureSources = ['session_plan'];
    pathApp.learningWorkbench.workbenchRefreshFailureCount = 1;
    pathApp.learningWorkbench.workbenchRefreshLastFailureSummary = 'session_plan@attempts=2:unstable';
    pathApp.learningWorkbench.workbenchRefreshRecoveredSources = ['mastery_misconceptions'];
    pathApp.learningWorkbench.workbenchRefreshRecoveredCount = 1;
    pathApp.learningWorkbench.workbenchRefreshConsecutiveDegradedCount = 4;
    pathApp.learningWorkbench.workbenchRefreshLastDurationMs = 143;
    pathApp.learningWorkbench.workbenchRefreshAttemptedAt = '2026-04-10T01:00:00.000Z';
    pathApp.learningWorkbench.workbenchRefreshLastSuccessAt = '2026-04-10T00:58:00.000Z';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationAt = '2026-04-10T01:00:01.000Z';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationApplied = false;
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationReason = 'cooldown_active:120s';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationCheckId = 'api_latency_p95';
    pathApp.learningWorkbench.workbenchRefreshAutoRemediationCount = 2;
    pathApp.learningWorkbench.runtimeRunbookRemediationEvents = {
      summary: {
        totalRecords: 9,
        matchedRecords: 6,
        returnedRecords: 6,
        lastRecordedAt: '2026-04-10T01:00:01.000Z',
        statusCounts: {
          applied: 2,
          not_applied: 1,
          cooldown: 2,
          error: 1,
          ignored: 0,
        },
      },
      records: [],
    };

    pathApp._renderLearningWorkbenchState();
    const text = String(runtimeSummaryEl.textContent || '');

    expect(text).toContain('workbenchRefresh(');
    expect(text).toContain('gate=warn');
    expect(text).toContain('autoRemediate=attempted');
    expect(text).toContain('autoReason=cooldown_active:120s');
    expect(text).toContain('autoCheck=api_latency_p95');
    expect(text).toContain('autoCount=2');
    expect(text).toContain('runbookRemediation(total=9,matched=6,returned=6,applied=2,notApplied=1,cooldown=2,error=1,ignored=0');
  });

  test('runtime summary renders rollout profile cue from runtime payload', () => {
    const { pathApp, elements } = loadPathAppHarness();
    const runtimeSummaryEl = createMockElement();
    elements.set('learning-runtime-summary', runtimeSummaryEl);

    pathApp.learningWorkbench.runtimeState = {
      state: {
        documents: 2,
        activeAtoms: 3,
        activeRelationEdges: 1,
        ingestTelemetry: {
          ingestP95Ms: 7.5,
        },
      },
      rolloutProfile: {
        mode: 'mixed',
        store: {
          backend: 'graphdb',
          provider: 'file',
          adapterId: 'local-file-graphdb',
          fallbackEnabled: false,
          strict: true,
        },
        vectorAcceleration: {
          provider: 'external_http',
          failureMode: 'fail_open',
          strict: false,
        },
      },
    };

    pathApp._renderLearningWorkbenchState();
    const text = String(runtimeSummaryEl.textContent || '');

    expect(text).toContain('rollout=mixed(');
    expect(text).toContain('store=graphdb/strict,fallback=off');
    expect(text).toContain('vector=external_http/fail_open/open');
    expect(text).toContain('repStrict=off');
  });

  test('runtime summary renders vector acceleration circuit budgets with observed counters', () => {
    const { pathApp, elements } = loadPathAppHarness();
    const runtimeSummaryEl = createMockElement();
    elements.set('learning-runtime-summary', runtimeSummaryEl);

    pathApp.learningWorkbench.queryBackendDiagnostics = {
      backendId: 'local_vector',
      fallbackCount: 0,
      runtime: {
        ready: true,
        backendId: 'local_vector',
        vectorIndex: {
          status: 'ready',
          enabled: true,
          persisted: true,
          loadedFromDisk: true,
          atomCount: 18,
          acceleration: {
            enabled: true,
            mode: 'ann_prefilter',
            healthStatus: 'degraded',
            circuitState: 'half_open',
            requestCount: 10,
            retryCount: 3,
            shortCircuitCount: 2,
            consecutiveFailures: 1,
            successCount: 7,
            failureCount: 3,
            halfOpenProbeSuccessCount: 3,
            halfOpenProbeFailureCount: 1,
          },
        },
      },
    };
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      overallStatus: 'degraded',
      summary: {
        passCount: 2,
        warnCount: 1,
        failCount: 0,
      },
      checks: [
        {
          checkId: 'query_vector_acceleration_circuit_state',
          status: 'warn',
          priorityScore: 240,
        },
        {
          checkId: 'query_vector_acceleration_prefilter_effectiveness',
          status: 'warn',
          priorityScore: 180,
        },
      ],
      thresholds: {
        queryFallbackWarnRatioPct: 12,
        queryFallbackFailRatioPct: 18,
        minQuerySampleSize: 3,
        queryEvidenceCoverageWarnRatioPct: 75,
        queryEvidenceCoverageFailRatioPct: 60,
        queryTemporalValidityWarnRatioPct: 80,
        queryTemporalValidityFailRatioPct: 65,
        queryBackendTrendWarnConfidenceRatioPct: 60,
        queryBackendTrendFailConfidenceRatioPct: 80,
        queryVectorAccelerationShortCircuitWarnCount: 1,
        queryVectorAccelerationShortCircuitFailCount: 3,
        queryVectorAccelerationShortCircuitWarnRatioPct: 10,
        queryVectorAccelerationShortCircuitFailRatioPct: 30,
        queryVectorAccelerationConsecutiveFailuresWarnCount: 1,
        queryVectorAccelerationConsecutiveFailuresFailCount: 3,
        queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 80,
        queryVectorAccelerationHalfOpenSuccessFailRatioPct: 50,
        queryVectorAccelerationPrefilterMinRequestSample: 8,
        queryVectorAccelerationPrefilterWarnCandidateRatioPct: 90,
        queryVectorAccelerationPrefilterFailCandidateRatioPct: 97,
      },
      signals: {
        queryBackendRuntimeReady: true,
        queryVectorIndexStatus: 'ready',
        queryVectorIndexEnabled: true,
        queryVectorIndexPersisted: true,
        queryVectorIndexLoadedFromDisk: true,
        queryVectorIndexAtomCount: 18,
        queryVectorIndexLocation: 'knowledge_query_vector_index.v1.json',
        queryVectorIndexAccelerationMode: 'ann_prefilter',
        queryVectorIndexAccelerationHealthStatus: 'degraded',
        queryVectorIndexAccelerationCircuitState: 'half_open',
        queryVectorIndexAccelerationRequestCount: 10,
        queryVectorIndexAccelerationRetryCount: 3,
        queryVectorIndexAccelerationShortCircuitCount: 2,
        queryVectorIndexAccelerationConsecutiveFailures: 1,
        queryVectorIndexAccelerationSuccessCount: 7,
        queryVectorIndexAccelerationFailureCount: 3,
        queryVectorIndexAccelerationHalfOpenProbeCount: 4,
        queryVectorIndexAccelerationHalfOpenSuccessRatePct: 75,
        queryVectorIndexAccelerationLastSelectionMode: 'full_scan',
        queryVectorIndexAccelerationLastCandidateCount: 17,
      },
    };

    pathApp._renderLearningWorkbenchState();
    const text = String(runtimeSummaryEl.textContent || '');

    expect(text).toContain('queryVectorAcceleration(mode=ann_prefilter,enabled=true,health=degraded,circuit=half_open');
    expect(text).toContain('shortCircuit=2(20.00%)');
    expect(text).toContain('halfOpenSuccess=75.00%');
    expect(text).toContain('check=warn');
    expect(text).toContain('budget=warn(warn shortCircuit>=1|10.00%|consecutiveFailures>=1|halfOpenSuccess<80.00%;fail shortCircuit>=3|30.00%|consecutiveFailures>=3|halfOpenSuccess<50.00%),prefilter(check=warn');
    expect(text).toContain('selection=full_scan');
    expect(text).toContain('candidate=17/18(94.44%)');
    expect(text).toContain('sampleReady=true');
    expect(text).toContain('selectionActive=false');
    expect(text).toContain('fullScanFallback=true');
    expect(text).toContain('budget=ok(minSample>=8,warn<90.00%,fail<97.00%))');
  });

  test('runtime summary prefers matrix-provided acceleration circuit budget status signals', () => {
    const { pathApp, elements } = loadPathAppHarness();
    const runtimeSummaryEl = createMockElement();
    elements.set('learning-runtime-summary', runtimeSummaryEl);

    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      overallStatus: 'blocked',
      summary: {
        passCount: 1,
        warnCount: 0,
        failCount: 1,
      },
      checks: [
        {
          checkId: 'query_vector_acceleration_circuit_state',
          status: 'fail',
          priorityScore: 320,
        },
      ],
      thresholds: {
        queryFallbackWarnRatioPct: 10,
        queryFallbackFailRatioPct: 20,
        minQuerySampleSize: 3,
        queryEvidenceCoverageWarnRatioPct: 75,
        queryEvidenceCoverageFailRatioPct: 60,
        queryTemporalValidityWarnRatioPct: 80,
        queryTemporalValidityFailRatioPct: 65,
        queryBackendTrendWarnConfidenceRatioPct: 60,
        queryBackendTrendFailConfidenceRatioPct: 80,
        queryVectorAccelerationShortCircuitWarnCount: 1,
        queryVectorAccelerationShortCircuitFailCount: 3,
        queryVectorAccelerationShortCircuitWarnRatioPct: 10,
        queryVectorAccelerationShortCircuitFailRatioPct: 30,
        queryVectorAccelerationConsecutiveFailuresWarnCount: 1,
        queryVectorAccelerationConsecutiveFailuresFailCount: 3,
        queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 80,
        queryVectorAccelerationHalfOpenSuccessFailRatioPct: 50,
      },
      signals: {
        queryBackendRuntimeReady: true,
        queryVectorIndexStatus: 'ready',
        queryVectorIndexEnabled: true,
        queryVectorIndexPersisted: true,
        queryVectorIndexLoadedFromDisk: true,
        queryVectorIndexAtomCount: 32,
        queryVectorIndexLocation: 'knowledge_query_vector_index.v1.json',
        queryVectorIndexAccelerationMode: 'ann_prefilter',
        queryVectorIndexAccelerationHealthStatus: 'degraded',
        queryVectorIndexAccelerationCircuitState: 'closed',
        queryVectorIndexAccelerationRequestCount: 10,
        queryVectorIndexAccelerationRetryCount: 1,
        queryVectorIndexAccelerationShortCircuitCount: 0,
        queryVectorIndexAccelerationShortCircuitRatioPct: 0,
        queryVectorIndexAccelerationConsecutiveFailures: 0,
        queryVectorIndexAccelerationSuccessCount: 9,
        queryVectorIndexAccelerationFailureCount: 1,
        queryVectorIndexAccelerationHalfOpenProbeCount: 0,
        queryVectorIndexAccelerationHalfOpenSuccessRatePct: 100,
        queryVectorIndexAccelerationCircuitWarnBudgetExceeded: true,
        queryVectorIndexAccelerationCircuitFailBudgetExceeded: true,
        queryVectorIndexAccelerationCircuitBudgetStatus: 'fail',
      },
    };

    pathApp._renderLearningWorkbenchState();
    const text = String(runtimeSummaryEl.textContent || '');

    expect(text).toContain('shortCircuit=0(0.00%)');
    expect(text).toContain('budget=fail(');
  });

  test('formats runtime runbook text with selected check, trace filter, actions, and verification targets', () => {
    const { pathApp } = loadPathAppHarness();
    const text = pathApp._formatLearningRuntimeRunbookText({
      generatedAt: '2026-04-03T00:00:00.000Z',
      overallStatus: 'blocked',
      summary: { passCount: 3, warnCount: 2, failCount: 1 },
      requestedCheckId: 'api_latency_p95',
      selectionSource: 'requested',
      topRiskCheck: {
        checkId: 'api_latency_hotspots',
        status: 'fail',
        priorityScore: 360,
      },
      selectedCheck: {
        checkId: 'api_latency_p95',
        status: 'fail',
        priorityScore: 320,
        expected: 'p95<=1200ms',
        observed: 'p95=2800ms',
        recommendedActions: ['Split heavy endpoint handler and defer non-critical workload.'],
      },
      traceFilter: {
        pathPrefix: '/api/knowledge/session/execute',
        statusAtLeast: 0,
        method: 'POST',
        errorCode: '',
      },
      verificationTargets: ['Re-fetch runtime capability matrix and verify api_latency_p95 status is pass.'],
    });
    expect(text).toContain('selection=requested,requested=api_latency_p95');
    expect(text).toContain('selected=api_latency_p95 (fail@320)');
    expect(text).toContain('traceFilter(pathPrefix=/api/knowledge/session/execute,statusAtLeast=0,method=POST,errorCode=<none>)');
    expect(text).toContain('actions=1.Split heavy endpoint handler');
    expect(text).toContain('verify=1.Re-fetch runtime capability matrix');
  });

  test('refresh runtime runbook requests endpoint with top-risk checkId and stores response', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {
        topRiskCheckId: 'api_server_error_ratio',
      },
      checks: [],
    };
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        runbook: {
          generatedAt: '2026-04-03T00:00:00.000Z',
          selectionSource: 'requested',
        },
      });

    const runbook = await pathApp.refreshLearningRuntimeRunbook();
    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook?checkId=api_server_error_ratio',
      { method: 'GET' }
    );
    expect(runbook).toEqual(
      expect.objectContaining({
        selectionSource: 'requested',
      })
    );
    expect(pathApp.learningWorkbench.runtimeRunbook).toEqual(
      expect.objectContaining({
        selectionSource: 'requested',
      })
    );
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('Runtime runbook ready'));
  });

  test('formats runtime runbook verification text with baseline delta', () => {
    const { pathApp } = loadPathAppHarness();
    const text = pathApp._formatLearningRuntimeRunbookVerificationText(
      {
        generatedAt: '2026-04-03T01:00:00.000Z',
        selectedCheckId: 'api_server_error_ratio',
        selectedCheckStatus: 'warn',
        selectedCheckPriorityScore: 220,
        selectedCheckEscalation: 'watch',
        topRiskCheckId: 'api_server_error_ratio',
        topRiskStatus: 'warn',
        selectedCheckHistory: {
          returnedRecords: 4,
          sinceMinutes: 1440,
          activeRiskStreak: 2,
          activeFailStreak: 1,
          trendStatus: 'regressing',
          severityDelta: 0.5,
          latestVerifiedAt: '2026-04-03T01:00:00.000Z',
        },
        selectedCheckRemediation: {
          returnedRecords: 3,
          latestStatus: 'cooldown',
          trendStatus: 'regressing',
          severityDelta: 0.67,
          activeRiskStreak: 2,
          activeCooldownStreak: 1,
          activeErrorStreak: 0,
          activeAppliedStreak: 0,
          appliedRatioPct: 33.3333,
          cooldownRatioPct: 33.3333,
          errorRatioPct: 0,
          riskRatioPct: 66.6667,
          latestRecordedAt: '2026-04-03T00:58:00.000Z',
          statusCounts: {
            applied: 1,
            not_applied: 1,
            cooldown: 1,
            error: 0,
            ignored: 0,
          },
        },
        dynamicModeAlignment: {
          records: 3,
          latestStatus: 'warn',
          conflictStreak: 2,
          failStreak: 1,
          conflictPersistent: true,
          recommendedFocusCheckId: 'tutor_routing_dynamic_mode_alignment',
          recommendedFocusReason: 'dynamic_mode_alignment_conflict_streak',
        },
        pathStrategyAlignment: {
          records: 2,
          latestStatus: 'warn',
          conflictStreak: 2,
          failStreak: 0,
          conflictPersistent: true,
          recommendedFocusCheckId: 'orchestration_path_strategy_alignment',
          recommendedFocusReason: 'path_strategy_alignment_conflict_streak',
        },
        selectedCheckEscalationActions: [
          'Prioritize this check in the next remediation cycle and complete at least one verify iteration immediately after mitigation.',
          'Update /api/knowledge/session/orchestration/config so preferredMode aligns with dynamic recommendation (auto/local/cloud).',
        ],
        selectedCheckEscalationActionItems: [
          {
            actionId: 'prioritize_remediation',
            priority: 'p0',
            category: 'governance',
            instruction:
              'Prioritize this check in the next remediation cycle and complete at least one verify iteration immediately after mitigation.',
            endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
          },
          {
            actionId: 'align_tutor_preferred_mode',
            priority: 'p0',
            category: 'routing',
            instruction:
              'Update /api/knowledge/session/orchestration/config so preferredMode aligns with dynamic recommendation (auto/local/cloud).',
            endpointHint: '/api/knowledge/session/orchestration/config',
          },
        ],
        traceSummary: {
          returnedRecords: 12,
          errorRequests: 2,
          errorRatioPct: 16.6667,
          transientReturnedRatioPct: 8.3333,
          averageDurationMs: 420,
          p95DurationMs: 1100,
          pathPrefix: '/api/knowledge',
          statusAtLeast: 500,
          method: 'POST',
          errorCode: '',
        },
        verificationTargets: ['Re-fetch matrix and verify api_server_error_ratio moves to pass.'],
      },
      {
        selectedCheckId: 'api_server_error_ratio',
        selectedCheckStatus: 'fail',
        traceSummary: {
          errorRatioPct: 28.4,
          p95DurationMs: 1650,
        },
      }
    );
    expect(text).toContain('selected=api_server_error_ratio:warn@220');
    expect(text).toContain('trace(returned=12,errors=2,errorRatio=16.67%');
    expect(text).toContain('history(records=4,sinceMinutes=1440,streak=2/1,trend=regressing,severityΔ=0.50,latest=2026-04-03T01:00:00.000Z)');
    expect(text).toContain('remediation(records=3,status(applied/notApplied/cooldown/error/ignored)=1/1/1/0/0');
    expect(text).toContain('ratio(applied/cooldown/error/risk)=33.33%/33.33%/0.00%/66.67%');
    expect(text).toContain('streak(risk/cooldown/error/applied)=2/1/0/0,trend=regressing,severityΔ=0.67,latest=2026-04-03T00:58:00.000Z');
    expect(text).toContain('escalation=watch');
    expect(text).toContain('dynamicMode(records=3,latest=warn,conflictStreak=2,failStreak=1,persistent=true,focus=tutor_routing_dynamic_mode_alignment:dynamic_mode_alignment_conflict_streak)');
    expect(text).toContain('pathStrategy(records=2,latest=warn,conflictStreak=2,failStreak=0,persistent=true,focus=orchestration_path_strategy_alignment:path_strategy_alignment_conflict_streak)');
    expect(text).toContain('escalationActionItems=1.p0/governance:Prioritize this check in the next remediation cycle');
    expect(text).toContain('[/api/knowledge/runtime-capability-runbook/verify]');
    expect(text).toContain('2.p0/routing:Update /api/knowledge/session/orchestration/config');
    expect(text).toContain('escalationActions=1.Prioritize this check in the next remediation cycle');
    expect(text).toContain('verify=1.Re-fetch matrix and verify api_server_error_ratio moves to pass.');
    expect(text).toContain('delta(status=improved,errorRatio=-11.73%,p95=-550.00ms)');
  });

  test('formats runtime runbook verification history summary and records', () => {
    const { pathApp } = loadPathAppHarness();
    const text = pathApp._formatLearningRuntimeRunbookVerificationHistoryText({
      summary: {
        totalRecords: 6,
        returnedRecords: 2,
        checkId: 'api_server_error_ratio',
        statusCounts: {
          pass: 0,
          warn: 1,
          fail: 1,
          unknown: 0,
        },
        activeRiskStreak: 2,
        activeFailStreak: 1,
        averageErrorRatioPct: 11.125,
        averageP95DurationMs: 842.44,
        latestVerifiedAt: '2026-04-03T02:00:00.000Z',
      },
      records: [
        {
          verifiedAt: '2026-04-03T02:00:00.000Z',
          checkId: 'api_server_error_ratio',
          status: 'warn',
          priorityScore: 220,
          topRiskCheckId: 'api_server_error_ratio',
          topRiskStatus: 'warn',
          traceSummary: {
            errorRatioPct: 12.25,
            p95DurationMs: 905,
            returnedRecords: 16,
          },
        },
        {
          verifiedAt: '2026-04-03T01:45:00.000Z',
          checkId: 'api_server_error_ratio',
          status: 'fail',
          priorityScore: 300,
          topRiskCheckId: 'api_server_error_ratio',
          topRiskStatus: 'fail',
          traceSummary: {
            errorRatioPct: 10,
            p95DurationMs: 779.88,
            returnedRecords: 12,
          },
        },
      ],
    });
    expect(text).toContain('summary(total=6,matched=0,returned=2,checkId=api_server_error_ratio,sinceMinutes=0,status=<all>,latest=2026-04-03T02:00:00.000Z)');
    expect(text).toContain('status(pass/warn/fail/unknown)=0/1/1/0');
    expect(text).toContain('streak(risk/fail)=2/1');
    expect(text).toContain('avg(errorRatio=11.13%,p95=842.44ms)');
    expect(text).toContain('trend(status=insufficient_data,window=0,severityΔ=0.00,errorRatioΔ=0.00%,p95Δ=0.00ms)');
    expect(text).toContain('1. 2026-04-03T02:00:00.000Z api_server_error_ratio:warn@220');
    expect(text).toContain('trace(err=12.25%,p95=905.00ms,returned=16)');
  });

  test('refresh runtime runbook verification requests verify endpoint and supports baseline mode', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      signals: {
        topRiskCheckId: 'api_transient_error_ratio',
      },
      checks: [],
    };
    pathApp.learningWorkbench.apiTraceServerLimit = 30;
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValueOnce({
        success: true,
        result: {
          selectedCheckId: 'api_transient_error_ratio',
          selectedCheckStatus: 'warn',
          runbook: {
            generatedAt: '2026-04-03T01:00:00.000Z',
            selectionSource: 'requested',
          },
          traceSummary: {
            returnedRecords: 10,
            errorRatioPct: 20,
            p95DurationMs: 900,
          },
          verificationTargets: ['Retry after mitigation.'],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          summary: {
            totalRecords: 1,
            returnedRecords: 1,
          },
          records: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          summary: {
            totalRecords: 1,
            matchedRecords: 1,
            returnedChecks: 1,
          },
          checks: [],
          actionQueue: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          summary: {
            totalQueueItems: 1,
            returnedQueueItems: 1,
          },
          actionQueue: [
            {
              queueId: 'api_transient_error_ratio:monitor_then_verify:1:1',
              checkId: 'api_transient_error_ratio',
              checkLatestStatus: 'warn',
              checkLatestEscalation: 'watch',
              checkTrendStatus: 'stable',
              actionId: 'monitor_then_verify',
              priority: 'p1',
              category: 'monitor',
              instruction: 'Maintain elevated monitoring and rerun verification.',
              endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            },
          ],
        },
      });

    const verification = await pathApp.refreshLearningRuntimeRunbookVerification({ setBaseline: true });
    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/verify?limit=30&checkId=api_transient_error_ratio',
      { method: 'GET' }
    );
    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history?limit=30&checkId=api_transient_error_ratio&sinceMinutes=360',
      { method: 'GET' }
    );
    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history/checks?limit=8&sinceMinutes=360&checkQuery=api_transient_error_ratio',
      { method: 'GET' }
    );
    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history/action-queue?limit=12&queueLimit=12&sinceMinutes=360&checkQuery=api_transient_error_ratio',
      { method: 'GET' }
    );
    expect(verification).toEqual(
      expect.objectContaining({
        selectedCheckId: 'api_transient_error_ratio',
      })
    );
    expect(pathApp.learningWorkbench.runtimeRunbookVerificationBaseline).toEqual(
      expect.objectContaining({
        selectedCheckId: 'api_transient_error_ratio',
      })
    );
    expect(pathApp.learningWorkbench.runtimeRunbook).toEqual(
      expect.objectContaining({
        selectionSource: 'requested',
      })
    );
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('Runtime runbook verification ready'));
  });

  test('refresh runtime runbook verification supports skipping history and check summary refresh', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeCapabilityMatrix = {
      checks: [],
    };
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValueOnce({
        success: true,
        result: {
          selectedCheckId: 'api_latency_p95',
          selectedCheckStatus: 'warn',
          runbook: {
            generatedAt: '2026-04-03T01:20:00.000Z',
          },
        },
      });
    const historySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationHistory')
      .mockResolvedValue(null);
    const checkSummarySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue(null);
    const actionQueueSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue')
      .mockResolvedValue(null);
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);

    const verification = await pathApp.refreshLearningRuntimeRunbookVerification({
      checkId: 'api_latency_p95',
      skipHistoryRefresh: true,
      skipCheckSummaryRefresh: true,
      silent: true,
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/verify?limit=24&checkId=api_latency_p95',
      { method: 'GET' }
    );
    expect(historySpy).not.toHaveBeenCalled();
    expect(checkSummarySpy).not.toHaveBeenCalled();
    expect(actionQueueSpy).not.toHaveBeenCalled();
    expect(statusSpy).not.toHaveBeenCalledWith(expect.stringContaining('Runtime runbook verification ready'));
    expect(verification).toEqual(
      expect.objectContaining({
        selectedCheckId: 'api_latency_p95',
      })
    );
  });

  test('refresh runtime runbook verification forwards recommended-focus query parameters', async () => {
    const { pathApp } = loadPathAppHarness();
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValueOnce({
        success: true,
        result: {
          selectedCheckId: 'api_server_error_ratio',
          selectedCheckStatus: 'fail',
          autoFocusApplied: true,
          runbook: {
            generatedAt: '2026-04-03T02:40:00.000Z',
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          summary: {
            returnedRecords: 1,
          },
          records: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          summary: {
            returnedChecks: 1,
          },
          checks: [],
        },
      });
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    await pathApp.refreshLearningRuntimeRunbookVerification({
      checkId: 'auto',
      focus: 'recommended',
      focusLimit: 12,
      sinceMinutes: 1440,
      status: 'warn',
      checkQuery: 'api_server_error_ratio',
      silent: true,
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/verify?limit=24&checkId=auto&focus=recommended&focusLimit=12&sinceMinutes=1440&status=warn&checkQuery=api_server_error_ratio',
      { method: 'GET' }
    );
  });

  test('refresh runtime runbook verification history requests endpoint with selected check fallback', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookVerification = {
      selectedCheckId: 'api_server_error_ratio',
    };
    pathApp.learningWorkbench.apiTraceServerLimit = 32;
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    const renderSpy = jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            totalRecords: 3,
            returnedRecords: 2,
            checkId: 'api_server_error_ratio',
            statusCounts: {
              pass: 0,
              warn: 1,
              fail: 1,
              unknown: 0,
            },
            averageErrorRatioPct: 12,
            averageP95DurationMs: 820,
            latestVerifiedAt: '2026-04-03T03:00:00.000Z',
          },
          records: [],
        },
      });

    const history = await pathApp.refreshLearningRuntimeRunbookVerificationHistory();

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history?limit=32&checkId=api_server_error_ratio&sinceMinutes=360',
      { method: 'GET' }
    );
    expect(history).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          returnedRecords: 2,
        }),
      })
    );
    expect(pathApp.learningWorkbench.runtimeRunbookVerificationHistory).toEqual(history);
    expect(renderSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('Runtime runbook verification history ready'));
  });

  test('formats runtime runbook verification check summary text', () => {
    const { pathApp } = loadPathAppHarness();
    const text = pathApp._formatLearningRuntimeRunbookVerificationCheckSummaryText({
      summary: {
        totalRecords: 12,
        matchedRecords: 6,
        returnedChecks: 2,
        sinceMinutes: 360,
        status: 'fail',
        checkQuery: 'api_',
        generatedAt: '2026-04-03T04:00:00.000Z',
        regressingChecks: 1,
        improvingChecks: 0,
        stableChecks: 1,
        insufficientDataChecks: 0,
        recommendedFocusCheckId: 'api_server_error_ratio',
        recommendedFocusLatestStatus: 'fail',
        recommendedFocusTrendStatus: 'regressing',
        recommendedFocusReason: 'regressing_trend',
        recommendedFocusEscalation: 'critical',
        recommendedFocusTopAction:
          'Trigger immediate mitigation and pause adaptive execution for the affected path until verification returns to warn/pass.',
        actionQueueTotal: 2,
        actionQueueP0: 1,
        actionQueueP1: 1,
        actionQueueP2: 0,
        dynamicModeAlignmentRecords: 3,
        dynamicModeAlignmentLatestStatus: 'warn',
        dynamicModeAlignmentConflictStreak: 2,
        dynamicModeAlignmentFailStreak: 1,
        pathStrategyAlignmentRecords: 4,
        pathStrategyAlignmentLatestStatus: 'fail',
        pathStrategyAlignmentConflictStreak: 3,
        pathStrategyAlignmentFailStreak: 2,
        remediationRecords: 5,
        remediationChecksWithEvents: 2,
        remediationChecksRegressing: 1,
        remediationChecksImproving: 0,
        remediationChecksStable: 1,
        remediationChecksInsufficientData: 0,
        remediationAppliedRatioPct: 40,
        remediationCooldownRatioPct: 20,
        remediationErrorRatioPct: 20,
        remediationRiskRatioPct: 60,
        remediationLatestRecordedAt: '2026-04-03T03:58:00.000Z',
        recommendedFocusRemediationStatus: 'error',
        recommendedFocusRemediationTrendStatus: 'regressing',
      },
      checks: [
        {
          checkId: 'api_server_error_ratio',
          latestStatus: 'fail',
          records: 4,
          trendStatus: 'regressing',
          activeRiskStreak: 3,
          activeFailStreak: 2,
          averageErrorRatioPct: 22.5,
          averageP95DurationMs: 980,
          errorRatioDeltaPct: 4.2,
          p95DurationDeltaMs: 120,
          topRiskMatchRatioPct: 100,
          latestEscalation: 'critical',
          remediation: {
            returnedRecords: 3,
            latestStatus: 'error',
            trendStatus: 'regressing',
            activeRiskStreak: 2,
            activeCooldownStreak: 1,
            activeErrorStreak: 1,
            appliedRatioPct: 33.3333,
            cooldownRatioPct: 33.3333,
            errorRatioPct: 33.3333,
            statusCounts: {
              applied: 1,
              not_applied: 0,
              cooldown: 1,
              error: 1,
              ignored: 0,
            },
          },
          escalationActionItems: [
            {
              actionId: 'mitigate_immediately',
              priority: 'p0',
              category: 'stabilize',
              instruction:
                'Trigger immediate mitigation and pause adaptive execution for the affected path until verification returns to warn/pass.',
              endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            },
          ],
        },
      ],
      actionQueue: [
        {
          queueId: 'api_server_error_ratio:mitigate_immediately:1:1',
          checkId: 'api_server_error_ratio',
          checkLatestStatus: 'fail',
          checkLatestEscalation: 'critical',
          checkTrendStatus: 'regressing',
          actionId: 'mitigate_immediately',
          priority: 'p0',
          category: 'stabilize',
          instruction:
            'Trigger immediate mitigation and pause adaptive execution for the affected path until verification returns to warn/pass.',
          endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
        },
        {
          queueId: 'api_server_error_ratio:collect_runtime_trace_evidence:1:2',
          checkId: 'api_server_error_ratio',
          checkLatestStatus: 'fail',
          checkLatestEscalation: 'critical',
          checkTrendStatus: 'regressing',
          actionId: 'collect_runtime_trace_evidence',
          priority: 'p1',
          category: 'evidence',
          instruction:
            'Collect /api/runtime-request-trace evidence with runbook filter and attach requestId samples to the remediation record.',
          endpointHint: '/api/runtime-request-trace',
        },
      ],
    });
    expect(text).toContain('summary(total=12,matched=6,returnedChecks=2,sinceMinutes=360,status=fail,checkQuery=api_,generatedAt=2026-04-03T04:00:00.000Z)');
    expect(text).toContain('trend(regressing/improving/stable/insufficient)=1/0/1/0');
    expect(text).toContain('recommendedFocus=api_server_error_ratio:fail:regressing reason=regressing_trend escalation=critical next=Trigger immediate mitigation');
    expect(text).toContain('actionQueue(total/p0/p1/p2)=2/1/1/0');
    expect(text).toContain('dynamicModeAlignment(records=3,latest=warn,conflictStreak=2,failStreak=1)');
    expect(text).toContain('pathStrategyAlignment(records=4,latest=fail,conflictStreak=3,failStreak=2)');
    expect(text).toContain('remediation(records=5,checksWithEvents=2,trend(regressing/improving/stable/insufficient)=1/0/1/0,ratio(applied/cooldown/error/risk)=40.00%/20.00%/20.00%/60.00%,focus=error:regressing,latest=2026-04-03T03:58:00.000Z)');
    expect(text).toContain('1. api_server_error_ratio latest=fail escalation=critical records=4 trend=regressing');
    expect(text).toContain('streak=3/2');
    expect(text).toContain('remediation(records=3,latest=error,trend=regressing,streak=2/1/1,ratio=33.33%/33.33%/33.33%,status=1/0/1/1/0)');
    expect(text).toContain('next=p0/stabilize:Trigger immediate mitigation');
    expect(text).toContain('[/api/knowledge/runtime-capability-runbook/verify]');
    expect(text).toContain('queue.1 p0/critical api_server_error_ratio remediation=');
    expect(text).toContain('Trigger immediate mitigation');
    expect(text).toContain('queue.2 p1/critical api_server_error_ratio remediation=');
    expect(text).toContain('Collect /api/runtime-request-trace evidence');
    expect(text).toContain('topRiskMatch=100.00%');
  });

  test('refresh runtime runbook verification check summary requests checks endpoint with filters', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookHistoryStatusFilter = 'warn';
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    const renderSpy = jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            returnedChecks: 1,
          },
          checks: [],
        },
      });

    const result = await pathApp.refreshLearningRuntimeRunbookVerificationCheckSummary({
      checkQuery: 'api_latency_p95',
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history/checks?limit=8&sinceMinutes=1440&status=warn&checkQuery=api_latency_p95',
      { method: 'GET' }
    );
    expect(result).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          returnedChecks: 1,
        }),
      })
    );
    expect(pathApp.learningWorkbench.runtimeRunbookVerificationCheckSummary).toEqual(result);
    expect(renderSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('check summary ready'));
  });

  test('refresh runtime runbook action queue requests endpoint with filters', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookHistoryStatusFilter = 'warn';
    pathApp.learningWorkbench.runtimeRunbookActionQueuePriorityFilter = 'p0';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCategoryFilter = 'verify';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCheckFilter = 'api_server_error_ratio';
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    const renderSpy = jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            returnedQueueItems: 2,
            queueP0: 1,
            queueP1: 1,
            queueP2: 0,
            priorityFilter: 'p0',
            categoryFilter: 'verify',
            checkIdFilter: 'api_server_error_ratio',
          },
          actionQueue: [
            {
              queueId: 'queue_1',
              checkId: 'api_server_error_ratio',
              checkLatestStatus: 'fail',
              checkLatestEscalation: 'critical',
              checkTrendStatus: 'regressing',
              actionId: 'mitigate_immediately',
              priority: 'p0',
              category: 'stabilize',
              instruction: 'Trigger immediate mitigation.',
              endpointHint: '/api/knowledge/runtime-capability-runbook/verify',
            },
          ],
        },
      });

    const result = await pathApp.refreshLearningRuntimeRunbookActionQueue({
      checkQuery: 'api_latency_p95',
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history/action-queue?limit=12&queueLimit=12&sinceMinutes=1440&status=warn&checkQuery=api_server_error_ratio&priority=p0&category=verify&checkId=api_server_error_ratio',
      { method: 'GET' }
    );
    expect(result).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          returnedQueueItems: 2,
        }),
      })
    );
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueue).toEqual(result);
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueuePriorityFilter).toBe('p0');
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueCategoryFilter).toBe('verify');
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueCheckFilter).toBe('api_server_error_ratio');
    expect(renderSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('action queue ready'));
  });

  test('refresh runtime runbook action queue includes remediation status/trend filters when configured', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookHistoryStatusFilter = 'warn';
    pathApp.learningWorkbench.runtimeRunbookActionQueuePriorityFilter = 'p0';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCategoryFilter = 'verify';
    pathApp.learningWorkbench.runtimeRunbookActionQueueCheckFilter = 'api_server_error_ratio';
    pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationStatusFilter = 'error';
    pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationTrendFilter = 'regressing';
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            returnedQueueItems: 1,
            priorityFilter: 'p0',
            categoryFilter: 'verify',
            checkIdFilter: 'api_server_error_ratio',
            remediationStatusFilter: 'error',
            remediationTrendFilter: 'regressing',
          },
          actionQueue: [],
        },
      });

    await pathApp.refreshLearningRuntimeRunbookActionQueue({
      checkQuery: 'api_latency_p95',
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history/action-queue?limit=12&queueLimit=12&sinceMinutes=1440&status=warn&checkQuery=api_server_error_ratio&priority=p0&category=verify&checkId=api_server_error_ratio&remediationStatus=error&remediationTrend=regressing',
      { method: 'GET' }
    );
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationStatusFilter).toBe('error');
    expect(pathApp.learningWorkbench.runtimeRunbookActionQueueRemediationTrendFilter).toBe('regressing');
  });

  test('formats runtime runbook remediation history text with summary and records', () => {
    const { pathApp } = loadPathAppHarness();
    const text = pathApp._formatLearningRuntimeRunbookRemediationHistoryText(
      {
        summary: {
          totalRecords: 18,
          matchedRecords: 5,
          returnedRecords: 3,
          sinceMinutes: 1440,
          status: 'cooldown',
          checkId: 'api_latency_p95',
          source: 'learning_workbench_refresh',
          lastRecordedAt: '2026-04-10T01:01:00.000Z',
          statusCounts: {
            applied: 1,
            not_applied: 0,
            cooldown: 2,
            error: 0,
            ignored: 0,
          },
        },
        records: [
          {
            recordedAt: '2026-04-10T01:01:00.000Z',
            requestId: 'remediation-event-cooldown-001',
            source: 'learning_workbench_refresh',
            triggerReason: 'degraded_refresh',
            status: 'cooldown',
            applied: false,
            checkId: 'api_latency_p95',
            degradedStreakCount: 4,
            failureCount: 1,
            recoveredCount: 0,
            failureSources: ['session_plan'],
            recoveredSources: [],
            detail: 'cooldown_active:120s',
            refreshAttemptedAt: '2026-04-10T01:01:00.000Z',
            refreshDurationMs: 160,
          },
          {
            recordedAt: '2026-04-10T01:00:00.000Z',
            requestId: 'remediation-event-applied-001',
            source: 'learning_workbench_refresh',
            triggerReason: 'degraded_refresh',
            status: 'applied',
            applied: true,
            checkId: 'api_latency_p95',
            degradedStreakCount: 3,
            failureCount: 1,
            recoveredCount: 0,
            failureSources: ['session_plan'],
            recoveredSources: [],
            detail: 'focused',
            refreshAttemptedAt: '2026-04-10T01:00:00.000Z',
            refreshDurationMs: 180,
          },
        ],
      },
      {
        config: {
          enabled: true,
          intervalMinutes: 30,
          intervalJitterPct: 0,
          cooldownMinutes: 15,
          replayBudgetWindowMinutes: 180,
          maxReplayChecksPerWindow: 4,
          triggerPolicy: 'always',
          triggerMinRiskRatioPct: 50,
          triggerMinRiskStreak: 2,
          replayOptions: {
            replayMode: 'all',
            replayLimit: 4,
            replayDryRun: true,
            replaySelectionPolicy: 'risk_ratio_desc',
            replayMinRiskRatioPct: 0,
          },
        },
        telemetry: {
          lastDecision: 'skipped_budget',
          lastReason: 'replay_budget_exceeded',
          lastEvaluatedAt: '2026-04-10T01:02:00.000Z',
          lastTriggeredAt: '2026-04-10T01:00:00.000Z',
          consecutiveSkips: 2,
          effectiveIntervalSeconds: 1800,
          lastJitterDelaySeconds: 0,
          cooldownRemainingSeconds: 0,
          currentWindowReplayChecks: 4,
          remainingWindowReplayChecks: 0,
          budgetWindowStartedAt: '2026-04-10T00:00:00.000Z',
          recommendations: [
            {
              code: 'schedule_tick_skipped_budget_capacity',
              severity: 'critical',
              reason: 'planned replay checks exceeded remaining budget',
              action: 'Reduce replay limit.',
            },
          ],
          policyTemplates: [
            {
              templateId: 'budget_relief',
              reason: 'rebalance replay budget window and replay limit',
              patch: {
                replayBudgetWindowMinutes: 240,
                replayOptions: {
                  replayLimit: 3,
                },
              },
            },
          ],
          autoExecution: {
            eligible: false,
            blockedReasons: ['dry_run_parity_missing'],
            decision: 'auto_execution_blocked',
            lastAttemptedAt: '2026-04-10T01:02:00.000Z',
            lastExecutedAt: '2026-04-10T01:00:00.000Z',
          },
          lastOutcome: null,
        },
      }
    );

    expect(text).toContain('summary(total=18,matched=5,returned=3,sinceMinutes=1440,status=cooldown,checkId=api_latency_p95,source=learning_workbench_refresh,last=2026-04-10T01:01:00.000Z)');
    expect(text).toContain('status(applied/notApplied/cooldown/error/ignored)=1/0/2/0/0');
    expect(text).toContain('recommendations=critical/schedule_tick_skipped_budget_capacity');
    expect(text).toContain('policyTemplates=budget_relief');
    expect(text).toContain('autoExecution(decision=auto_execution_blocked,eligible=false,blockedBy=dry_run_parity_missing');
    expect(text).toContain('1. 2026-04-10T01:01:00.000Z api_latency_p95 status=cooldown');
    expect(text).toContain('source=learning_workbench_refresh');
    expect(text).toContain('fail/recover=1/0');
    expect(text).toContain('refresh=2026-04-10T01:01:00.000Z+160.00ms');
    expect(text).toContain('detail=cooldown_active:120s');
    expect(text).toContain('(session_plan=>-)');
  });

  test('refresh runtime runbook remediation history requests endpoint with filters', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'cooldown';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = 'learning_workbench_refresh';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = 'api_latency_p95';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = 10;
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    const renderSpy = jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            returnedRecords: 2,
            status: 'cooldown',
            checkId: 'api_latency_p95',
            source: 'learning_workbench_refresh',
          },
          records: [],
        },
      });

    const result = await pathApp.refreshLearningRuntimeRunbookRemediationEvents();

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history/remediation-events?limit=10&sinceMinutes=1440&status=cooldown&checkId=api_latency_p95&source=learning_workbench_refresh',
      { method: 'GET' }
    );
    expect(result).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          returnedRecords: 2,
        }),
      })
    );
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationEvents).toEqual(result);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit).toBe(10);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter).toBe('cooldown');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter).toBe('api_latency_p95');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter).toBe('learning_workbench_refresh');
    expect(renderSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('remediation history ready'));
  });

  test('replay runtime runbook remediation issues posts replay request and refreshes projections', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'error';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = 'learning_workbench_refresh';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = 'api_latency_p95';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = 10;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun = false;
    pathApp.learningWorkbench.runtimeRunbookHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookHistoryStatusFilter = 'warn';
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    const renderSpy = jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            replayedChecks: 1,
            replayedPassChecks: 0,
            replayedWarnChecks: 1,
            replayedFailChecks: 0,
          },
          checks: [
            {
              requestedCheckId: 'api_latency_p95',
              resolvedCheckId: 'api_latency_p95',
              selectedCheckStatus: 'warn',
            },
          ],
        },
      });
    const refreshCheckSummarySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue(null);
    const refreshActionQueueSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue')
      .mockResolvedValue(null);
    const refreshRemediationSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookRemediationEvents')
      .mockResolvedValue(null);

    const result = await pathApp.replayLearningRuntimeRunbookRemediationEvents({
      replayLimit: 3,
      replayMode: 'risk_only',
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/remediation-event/replay',
      {
        method: 'POST',
        body: {
          limit: 10,
          replayLimit: 3,
          sinceMinutes: 1440,
          replayMode: 'risk_only',
          dryRun: false,
          replaySelectionPolicy: 'history_order',
          replayMinRiskRatioPct: 0,
          status: 'error',
          source: 'learning_workbench_refresh',
          checkId: 'api_latency_p95',
        },
      }
    );
    expect(result).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          replayedChecks: 1,
        }),
      })
    );
    expect(refreshCheckSummarySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sinceMinutes: 1440,
        status: 'warn',
        silent: true,
      })
    );
    expect(refreshActionQueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sinceMinutes: 1440,
        status: 'warn',
        silent: true,
      })
    );
    expect(refreshRemediationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        sinceMinutes: 1440,
        status: 'error',
        source: 'learning_workbench_refresh',
        checkId: 'api_latency_p95',
        silent: true,
      })
    );
    expect(renderSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('remediation replay completed'));
  });

  test('replay runtime runbook remediation uses saved replay controls when options are omitted', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'error';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = 'learning_workbench_refresh';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = 'api_latency_p95';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = 10;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit = 8;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode = 'all';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun = false;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy = 'risk_streak_desc';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct = 45;
    pathApp.learningWorkbench.runtimeRunbookHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookHistoryStatusFilter = 'warn';
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            replayedChecks: 1,
            replayedPassChecks: 0,
            replayedWarnChecks: 1,
            replayedFailChecks: 0,
            replayLimit: 8,
            replayMode: 'all',
            replaySelectionPolicy: 'risk_streak_desc',
            replayMinRiskRatioPct: 45,
          },
          checks: [],
        },
      });
    const refreshCheckSummarySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue(null);
    const refreshActionQueueSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue')
      .mockResolvedValue(null);
    const refreshRemediationSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookRemediationEvents')
      .mockResolvedValue(null);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    await pathApp.replayLearningRuntimeRunbookRemediationEvents();

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/remediation-event/replay',
      {
        method: 'POST',
        body: {
          limit: 10,
          replayLimit: 8,
          sinceMinutes: 1440,
          replayMode: 'all',
          dryRun: false,
          replaySelectionPolicy: 'risk_streak_desc',
          replayMinRiskRatioPct: 45,
          status: 'error',
          source: 'learning_workbench_refresh',
          checkId: 'api_latency_p95',
        },
      }
    );
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit).toBe(8);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode).toBe('all');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy).toBe('risk_streak_desc');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct).toBe(45);
    expect(refreshCheckSummarySpy).toHaveBeenCalled();
    expect(refreshActionQueueSpy).toHaveBeenCalled();
    expect(refreshRemediationSpy).toHaveBeenCalled();
  });

  test('replay runtime runbook remediation dry-run skips projection refresh and posts dryRun=true', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'error';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = 'learning_workbench_refresh';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = 'api_latency_p95';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = 10;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit = 8;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode = 'all';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun = true;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy = 'risk_ratio_desc';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct = 30;
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            replayDryRun: true,
            plannedReplayChecks: 2,
            replayMode: 'all',
            replayLimit: 8,
            replaySelectionPolicy: 'risk_ratio_desc',
            replayMinRiskRatioPct: 30,
            replayedChecks: 0,
          },
          checks: [],
        },
      });
    const refreshCheckSummarySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue(null);
    const refreshActionQueueSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue')
      .mockResolvedValue(null);
    const refreshRemediationSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookRemediationEvents')
      .mockResolvedValue(null);
    const statusSpy = jest
      .spyOn(pathApp, '_setLearningWorkbenchStatus')
      .mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    await pathApp.replayLearningRuntimeRunbookRemediationEvents();

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/remediation-event/replay',
      {
        method: 'POST',
        body: {
          limit: 10,
          replayLimit: 8,
          sinceMinutes: 1440,
          replayMode: 'all',
          dryRun: true,
          replaySelectionPolicy: 'risk_ratio_desc',
          replayMinRiskRatioPct: 30,
          status: 'error',
          source: 'learning_workbench_refresh',
          checkId: 'api_latency_p95',
        },
      }
    );
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun).toBe(true);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy).toBe('risk_ratio_desc');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct).toBe(30);
    expect(refreshCheckSummarySpy).not.toHaveBeenCalled();
    expect(refreshActionQueueSpy).not.toHaveBeenCalled();
    expect(refreshRemediationSpy).not.toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('dry-run completed'));
  });

  test('refresh replay schedule config includes top recommendation in status text', async () => {
    const { pathApp } = loadPathAppHarness();
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          config: {
            enabled: true,
            intervalMinutes: 30,
            triggerPolicy: 'always',
            triggerMinRiskRatioPct: 50,
            triggerMinRiskStreak: 2,
            replayOptions: {
              replayLimit: 4,
              replayMode: 'all',
              replayDryRun: true,
              replaySelectionPolicy: 'risk_ratio_desc',
              replayMinRiskRatioPct: 0,
            },
          },
          telemetry: {
            lastDecision: 'skipped_budget',
            lastReason: 'replay_budget_exceeded',
            recommendations: [
              {
                code: 'schedule_tick_skipped_budget_capacity',
                severity: 'critical',
                reason: 'planned replay checks exceeded remaining budget',
                action: 'Reduce replay limit.',
              },
            ],
            policyTemplates: [
              {
                templateId: 'budget_relief',
                reason: 'rebalance replay budget window and replay limit',
                patch: {
                  replayBudgetWindowMinutes: 240,
                },
              },
            ],
            autoExecution: {
              eligible: false,
              blockedReasons: ['dry_run_parity_missing'],
              decision: 'auto_execution_blocked',
              lastAttemptedAt: '2026-04-10T01:03:00.000Z',
              lastExecutedAt: '2026-04-10T01:00:00.000Z',
            },
          },
        },
      });
    const statusSpy = jest
      .spyOn(pathApp, '_setLearningWorkbenchStatus')
      .mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    await pathApp.refreshLearningRuntimeRunbookRemediationReplayScheduleConfig();

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/remediation-event/replay-schedule',
      { method: 'GET' }
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('recommendation=critical/schedule_tick_skipped_budget_capacity')
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('template=budget_relief')
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('autoExecution=blocked/auto_execution_blocked:dry_run_parity_missing')
    );
  });

  test('update replay schedule config posts normalized schedule and replay options', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'error';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = 'learning_workbench_refresh';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = 'api_latency_p95';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = 10;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit = 8;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode = 'all';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayDryRun = true;
    pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy = 'risk_ratio_desc';
    pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct = 35;
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          config: {
            enabled: true,
            intervalMinutes: 30,
            triggerPolicy: 'risk_ratio_or_streak',
            triggerMinRiskRatioPct: 60,
            triggerMinRiskStreak: 3,
            autoExecution: {
              enabled: true,
              mode: 'recommendation',
              requireDryRunParity: true,
              minConsecutiveSkips: 2,
            },
            replayOptions: {
              replayLimit: 8,
              replayMode: 'all',
              replayDryRun: true,
              replaySelectionPolicy: 'risk_ratio_desc',
              replayMinRiskRatioPct: 35,
            },
          },
          telemetry: {
            lastDecision: 'config_updated',
            recommendations: [
              {
                code: 'schedule_guardrail_budget_auto_raised',
                severity: 'warn',
                reason: 'guardrail adjusted budget',
                action: 'Increase maxReplayChecksPerWindow.',
              },
            ],
            policyTemplates: [
              {
                templateId: 'budget_relief',
                reason: 'rebalance replay budget window and replay limit',
                patch: {
                  replayBudgetWindowMinutes: 240,
                },
              },
            ],
            autoExecution: {
              eligible: false,
              blockedReasons: ['awaiting_schedule_tick'],
              decision: 'configured',
              lastAttemptedAt: '',
              lastExecutedAt: '',
            },
          },
        },
      });
    const statusSpy = jest
      .spyOn(pathApp, '_setLearningWorkbenchStatus')
      .mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    await pathApp.updateLearningRuntimeRunbookRemediationReplayScheduleConfig({
      enabled: true,
      intervalMinutes: 30,
      triggerPolicy: 'risk_ratio_or_streak',
      triggerMinRiskRatioPct: 60,
      triggerMinRiskStreak: 3,
      policyTemplate: 'budget_relief',
      autoExecution: {
        enabled: true,
        mode: 'recommendation',
        requireDryRunParity: true,
        minConsecutiveSkips: 2,
      },
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/remediation-event/replay-schedule',
      {
        method: 'POST',
        body: expect.objectContaining({
          enabled: true,
          intervalMinutes: 30,
          triggerPolicy: 'risk_ratio_or_streak',
          triggerMinRiskRatioPct: 60,
          triggerMinRiskStreak: 3,
          policyTemplate: 'budget_relief',
          autoExecution: {
            enabled: true,
            mode: 'recommendation',
            requireDryRunParity: true,
            minConsecutiveSkips: 2,
          },
          replay: expect.objectContaining({
            limit: 10,
            sinceMinutes: 1440,
            status: 'error',
            source: 'learning_workbench_refresh',
            checkId: 'api_latency_p95',
            replayLimit: 8,
            replayMode: 'all',
            dryRun: true,
            replaySelectionPolicy: 'risk_ratio_desc',
            replayMinRiskRatioPct: 35,
          }),
        }),
      }
    );
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleEnabled).toBe(true);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleIntervalMinutes).toBe(30);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerPolicy).toBe('risk_ratio_or_streak');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskRatioPct).toBe(60);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleTriggerMinRiskStreak).toBe(3);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleAutoExecutionEnabled).toBe(true);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayScheduleAutoExecutionMode).toBe(
      'recommendation'
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('recommendation=warn/schedule_guardrail_budget_auto_raised')
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('template=budget_relief')
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('autoExecution=blocked/configured:awaiting_schedule_tick')
    );
  });

  test('run replay schedule tick posts request and refreshes projections when non-dry-run executed', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookHistorySinceMinutes = 360;
    pathApp.learningWorkbench.runtimeRunbookHistoryStatusFilter = 'warn';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryLimit = 12;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryStatusFilter = 'error';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistorySourceFilter = 'learning_workbench_refresh';
    pathApp.learningWorkbench.runtimeRunbookRemediationHistoryCheckFilter = 'api_latency_p95';
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          decision: 'executed',
          reason: 'trigger_policy_always',
          executed: true,
          dryRun: false,
          replayResult: {
            summary: {
              replayLimit: 4,
              replayMode: 'all',
              replaySelectionPolicy: 'risk_streak_desc',
              replayMinRiskRatioPct: 25,
              replayedChecks: 1,
              replayedPassChecks: 0,
              replayedWarnChecks: 1,
              replayedFailChecks: 0,
            },
          },
          snapshot: {
            config: {
              enabled: true,
              intervalMinutes: 30,
              triggerPolicy: 'always',
              triggerMinRiskRatioPct: 50,
              triggerMinRiskStreak: 2,
              replayOptions: {
                replayLimit: 4,
                replayMode: 'all',
                replayDryRun: false,
                replaySelectionPolicy: 'risk_streak_desc',
                replayMinRiskRatioPct: 25,
              },
            },
            telemetry: {
              lastDecision: 'executed',
              recommendations: [
                {
                  code: 'schedule_high_risk_focus_check',
                  severity: 'warn',
                  reason: 'top planned check remains high risk',
                  action: 'Prioritize focused verification.',
                },
              ],
              policyTemplates: [
                {
                  templateId: 'high_risk_response',
                  reason: 'reduce trigger strictness and prioritize risk-first replay',
                  patch: {
                    triggerPolicy: 'risk_ratio_or_streak',
                  },
                },
              ],
              autoExecution: {
                eligible: true,
                blockedReasons: [],
                decision: 'auto_execution_executed',
                lastAttemptedAt: '2026-04-10T01:10:00.000Z',
                lastExecutedAt: '2026-04-10T01:10:00.000Z',
              },
            },
          },
        },
      });
    const refreshCheckSummarySpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookVerificationCheckSummary')
      .mockResolvedValue(null);
    const refreshActionQueueSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookActionQueue')
      .mockResolvedValue(null);
    const refreshRemediationSpy = jest
      .spyOn(pathApp, 'refreshLearningRuntimeRunbookRemediationEvents')
      .mockResolvedValue(null);
    const statusSpy = jest
      .spyOn(pathApp, '_setLearningWorkbenchStatus')
      .mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);

    await pathApp.runLearningRuntimeRunbookRemediationReplayScheduleTick({
      force: true,
      dryRun: false,
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/remediation-event/replay-schedule/tick',
      {
        method: 'POST',
        body: {
          force: true,
          dryRun: false,
        },
      }
    );
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayLimit).toBe(4);
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayMode).toBe('all');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplaySelectionPolicy).toBe('risk_streak_desc');
    expect(pathApp.learningWorkbench.runtimeRunbookRemediationReplayMinRiskRatioPct).toBe(25);
    expect(refreshCheckSummarySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sinceMinutes: 360,
        status: 'warn',
        silent: true,
      })
    );
    expect(refreshActionQueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sinceMinutes: 360,
        status: 'warn',
        silent: true,
      })
    );
    expect(refreshRemediationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 12,
        sinceMinutes: 1440,
        status: 'error',
        source: 'learning_workbench_refresh',
        checkId: 'api_latency_p95',
        silent: true,
      })
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('recommendation=warn/schedule_high_risk_focus_check')
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('template=high_risk_response')
    );
    expect(statusSpy).toHaveBeenCalledWith(
      expect.stringContaining('autoExecution=eligible/auto_execution_executed')
    );
  });

  test('refresh runtime runbook verification history includes since/status filters when configured', async () => {
    const { pathApp } = loadPathAppHarness();
    pathApp.learningWorkbench.runtimeRunbookVerification = {
      selectedCheckId: 'api_server_error_ratio',
    };
    pathApp.learningWorkbench.apiTraceServerLimit = 24;
    pathApp.learningWorkbench.runtimeRunbookHistorySinceMinutes = 1440;
    pathApp.learningWorkbench.runtimeRunbookHistoryStatusFilter = 'fail';
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        result: {
          summary: {
            totalRecords: 10,
            matchedRecords: 2,
            returnedRecords: 2,
            trendStatus: 'regressing',
          },
          records: [],
        },
      });

    await pathApp.refreshLearningRuntimeRunbookVerificationHistory();

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/runtime-capability-runbook/history?limit=24&checkId=api_server_error_ratio&sinceMinutes=1440&status=fail',
      { method: 'GET' }
    );
  });

  test('apply tutor routing config sends normalized adapter timeout and syncs runtime state', async () => {
    const { pathApp } = loadPathAppHarness();
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApi')
      .mockResolvedValue({
        tutorRoutingConfig: {
          enabled: true,
          minSamples: 5,
          maxFailedRatioPct: 25,
          maxDowngradedRatioPct: 45,
          minAverageConfidence: 0.6,
          preferredMode: 'cloud',
          adapterTimeoutMs: 120000,
        },
      });
    const requestOptionalSpy = jest
      .spyOn(pathApp, '_requestLearningApiOptional')
      .mockResolvedValue({
        success: true,
        runtimeCapabilityMatrix: {
          checks: [],
          signals: {},
        },
        configuredBackends: {
          store: 'file',
          query: 'local_hybrid',
        },
      });
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);

    pathApp.learningWorkbench.tutorRoutingEnabled = true;
    pathApp.learningWorkbench.tutorRoutingMinSamples = 5;
    pathApp.learningWorkbench.tutorRoutingMaxFailedRatioPct = 25;
    pathApp.learningWorkbench.tutorRoutingMaxDowngradedRatioPct = 45;
    pathApp.learningWorkbench.tutorRoutingMinAverageConfidence = 0.6;
    pathApp.learningWorkbench.tutorRoutingPreferredMode = 'cloud';
    pathApp.learningWorkbench.tutorRoutingAdapterTimeoutMs = 999999;

    await pathApp.applyLearningWorkbenchTutorRoutingConfig();

    expect(requestSpy).toHaveBeenCalledWith(
      '/api/knowledge/session/orchestration/config',
      expect.objectContaining({
        tutorRoutingConfig: expect.objectContaining({
          adapterTimeoutMs: 120000,
          preferredMode: 'cloud',
        }),
      })
    );
    expect(requestOptionalSpy).toHaveBeenCalledWith('/api/knowledge/state', { method: 'GET' });
    expect(pathApp.learningWorkbench.tutorRoutingAdapterTimeoutMs).toBe(120000);
  });

  test('knowledge query run normalizes payload and supports focus-query fallback/override', async () => {
    const { pathApp } = loadPathAppHarness();
    const requestSpy = jest
      .spyOn(pathApp, '_requestLearningApi')
      .mockResolvedValue({
        items: [
          {
            atom: {
              id: 'atom_query_1',
              title: 'Atom Query 1',
            },
            score: 0.91,
            evidenceSpans: [{ id: 'ev_query_1' }],
            relationPath: [{ id: 'rel_query_1' }],
            temporalValidity: {
              isValid: true,
              reasons: ['active'],
            },
          },
        ],
        trace: {
          latencyMs: 25,
          evidenceCoverageRatio: 1,
          relationPathCoverageRatio: 1,
          temporalValidityPassRatio: 1,
        },
      });
    const buildQuerySpy = jest
      .spyOn(pathApp, '_buildLearningQueryFromFocusNode')
      .mockReturnValue('  Focus   node   query  ');
    const renderSpy = jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const persistSpy = jest
      .spyOn(pathApp, '_persistLearningWorkbenchPreferences')
      .mockImplementation(() => undefined);
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);

    pathApp.learningWorkbench.queryBackendSelection = 'keyword';
    pathApp.learningWorkbench.queryText = '   ';
    pathApp.learningWorkbench.queryTopK = 99;
    await pathApp.runLearningWorkbenchKnowledgeQuery();

    expect(requestSpy).toHaveBeenNthCalledWith(1, '/api/knowledge/query', {
      query: 'Focus node query',
      topK: 20,
      queryBackend: 'keyword_only',
    });
    expect(pathApp.learningWorkbench.queryText).toBe('Focus node query');
    expect(pathApp.learningWorkbench.queryTopK).toBe(20);
    expect(pathApp.learningWorkbench.queryResult).toEqual(expect.any(Object));
    expect(pathApp.learningWorkbench.loading).toBe(false);
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge query completed.'));

    pathApp.learningWorkbench.queryText = 'manual query should be ignored';
    pathApp.learningWorkbench.queryTopK = 0;
    await pathApp.runLearningWorkbenchKnowledgeQuery({ forceFocusQuery: true });

    expect(buildQuerySpy).toHaveBeenCalledTimes(2);
    expect(requestSpy).toHaveBeenNthCalledWith(2, '/api/knowledge/query', {
      query: 'Focus node query',
      topK: 1,
      queryBackend: 'keyword_only',
    });
    expect(pathApp.learningWorkbench.queryText).toBe('Focus node query');
    expect(pathApp.learningWorkbench.queryTopK).toBe(1);
    expect(pathApp.learningWorkbench.loading).toBe(false);
    expect(persistSpy).toHaveBeenCalledTimes(2);
    expect(renderSpy).toHaveBeenCalled();
  });

  test('knowledge query run records error status when query API fails', async () => {
    const { pathApp } = loadPathAppHarness();
    jest.spyOn(pathApp, '_requestLearningApi').mockRejectedValue(new Error('query failed'));
    jest.spyOn(pathApp, '_buildLearningQueryFromFocusNode').mockReturnValue('focus query');
    jest.spyOn(pathApp, '_renderLearningWorkbenchState').mockImplementation(() => undefined);
    const statusSpy = jest.spyOn(pathApp, '_setLearningWorkbenchStatus').mockImplementation(() => undefined);

    pathApp.learningWorkbench.queryText = '';
    pathApp.learningWorkbench.queryTopK = 6;
    await pathApp.runLearningWorkbenchKnowledgeQuery();

    expect(pathApp.learningWorkbench.lastError).toBe('query failed');
    expect(pathApp.learningWorkbench.loading).toBe(false);
    expect(statusSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge query failed: query failed'), true);
  });

  test('retries runtime trace GET with Retry-After and records retry policy metadata', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const requestHeaders: Array<Record<string, any>> = [];
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async (_url: string, init?: Record<string, any>) => {
        requestHeaders.push(init?.headers || {});
        return buildFetchResponse({
          ok: false,
          status: 429,
          headers: {
            'x-request-id': 'srv-retry-1',
            'retry-after': '1',
          },
          body: {
            success: false,
            error: 'rate limited',
            errorCode: 'too_many_requests',
          },
        });
      })
      .mockImplementationOnce(async (_url: string, init?: Record<string, any>) => {
        requestHeaders.push(init?.headers || {});
        return buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-retry-2',
          },
          body: {
            success: true,
            result: {
              records: [],
              summary: {
                returnedRecords: 0,
              },
            },
          },
        });
      });
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional('/api/runtime-request-trace?limit=6', {
      method: 'GET',
    });

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(1000);

    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.succeeded).toBe(true);
    expect(trace.attemptCount).toBe(2);
    expect(trace.policyKey).toBe('runtime_trace_get');
    expect(trace.maxRetries).toBe(3);
    expect(trace.retryable).toBe(true);
    expect(trace.timeoutMs).toBe(12000);
    expect(trace.attempts?.[0]?.retryAfterMs).toBe(1000);
    expect(trace.attempts?.[0]?.nextRetryDelayMs).toBe(1000);

    const firstRequestId = String(requestHeaders[0]?.['X-Request-Id'] || '');
    const secondRequestId = String(requestHeaders[1]?.['X-Request-Id'] || '');
    expect(firstRequestId.length).toBeGreaterThan(0);
    expect(firstRequestId).toBe(secondRequestId);
  });

  test('applies extended timeout policy for session execute endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const fetchMock = jest.fn(async () => (
      buildFetchResponse({
        ok: true,
        status: 200,
        headers: {
          'x-request-id': 'srv-session-execute-1',
        },
        body: {
          success: true,
          result: {
            summary: {
              executedCount: 0,
            },
          },
        },
      })
    ));
    setFetch(fetchMock);

    const result = await pathApp._requestLearningApi(
      '/api/knowledge/session/execute',
      { userId: 'test_user', actions: [] },
      'POST'
    );

    expect(result?.summary?.executedCount).toBe(0);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('session_execute');
    expect(trace.timeoutMs).toBe(45000);
    expect(trace.maxRetries).toBe(0);
    expect(trace.retryable).toBe(false);
  });

  test('applies dedicated retry policy for session history GET endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 502,
          headers: {
            'x-request-id': 'srv-session-history-1',
          },
          body: {
            success: false,
            error: 'bad gateway',
            errorCode: 'bad_gateway',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-session-history-2',
          },
          body: {
            success: true,
            result: {
              userId: 'path_user_default',
              records: [],
              summary: {
                totalRecords: 0,
                matchedRecordsBeforeLimit: 0,
                appliedFilters: {
                  limit: 8,
                  sinceMinutes: 0,
                  pathStrategy: '',
                  pathStrategySelectionSource: '',
                },
              },
            },
          },
        })
      ));
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional(
      '/api/knowledge/session/history?userId=path_user_default&limit=8',
      { method: 'GET' }
    );

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(250);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('session_history_get');
    expect(trace.timeoutMs).toBe(10000);
    expect(trace.maxRetries).toBe(2);
    expect(trace.retryable).toBe(true);
    expect(trace.attemptCount).toBe(2);
  });

  test('applies dedicated retry policy for runtime runbook action queue GET endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 503,
          headers: {
            'x-request-id': 'srv-runbook-queue-1',
          },
          body: {
            success: false,
            error: 'service unavailable',
            errorCode: 'service_unavailable',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-runbook-queue-2',
          },
          body: {
            success: true,
            result: {
              summary: {
                returnedQueueItems: 0,
              },
              actionQueue: [],
            },
          },
        })
      ));
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional(
      '/api/knowledge/runtime-capability-runbook/history/action-queue?limit=12&queueLimit=12&sinceMinutes=1440',
      { method: 'GET' }
    );

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(250);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('runtime_runbook_action_queue_get');
    expect(trace.timeoutMs).toBe(12000);
    expect(trace.maxRetries).toBe(2);
    expect(trace.retryable).toBe(true);
    expect(trace.attemptCount).toBe(2);
  });

  test('applies dedicated retry policy for runtime runbook remediation history GET endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 502,
          headers: {
            'x-request-id': 'srv-runbook-remediation-1',
          },
          body: {
            success: false,
            error: 'bad gateway',
            errorCode: 'bad_gateway',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-runbook-remediation-2',
          },
          body: {
            success: true,
            result: {
              summary: {
                returnedRecords: 0,
              },
              records: [],
            },
          },
        })
      ));
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional(
      '/api/knowledge/runtime-capability-runbook/history/remediation-events?limit=12&sinceMinutes=1440',
      { method: 'GET' }
    );

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(250);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('runtime_runbook_remediation_history_get');
    expect(trace.timeoutMs).toBe(12000);
    expect(trace.maxRetries).toBe(2);
    expect(trace.retryable).toBe(true);
    expect(trace.attemptCount).toBe(2);
  });

  test('applies dedicated retry policy for runtime runbook summary GET endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 503,
          headers: {
            'x-request-id': 'srv-runbook-summary-1',
          },
          body: {
            success: false,
            error: 'service unavailable',
            errorCode: 'service_unavailable',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-runbook-summary-2',
          },
          body: {
            success: true,
            result: {
              summary: {},
            },
          },
        })
      ));
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional(
      '/api/knowledge/runtime-capability-runbook',
      { method: 'GET' }
    );

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(250);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('runtime_runbook_get');
    expect(trace.timeoutMs).toBe(12000);
    expect(trace.maxRetries).toBe(2);
    expect(trace.retryable).toBe(true);
    expect(trace.attemptCount).toBe(2);
  });

  test('applies dedicated retry policy for runtime runbook verify GET endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 502,
          headers: {
            'x-request-id': 'srv-runbook-verify-1',
          },
          body: {
            success: false,
            error: 'bad gateway',
            errorCode: 'bad_gateway',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-runbook-verify-2',
          },
          body: {
            success: true,
            result: {
              summary: {},
            },
          },
        })
      ));
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional(
      '/api/knowledge/runtime-capability-runbook/verify?limit=12',
      { method: 'GET' }
    );

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(250);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('runtime_runbook_verify_get');
    expect(trace.timeoutMs).toBe(12000);
    expect(trace.maxRetries).toBe(2);
    expect(trace.retryable).toBe(true);
    expect(trace.attemptCount).toBe(2);
  });

  test('applies dedicated retry policy for runtime runbook history checks GET endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 503,
          headers: {
            'x-request-id': 'srv-runbook-history-checks-1',
          },
          body: {
            success: false,
            error: 'service unavailable',
            errorCode: 'service_unavailable',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-runbook-history-checks-2',
          },
          body: {
            success: true,
            result: {
              summary: {
                totalChecks: 0,
              },
              checks: [],
            },
          },
        })
      ));
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional(
      '/api/knowledge/runtime-capability-runbook/history/checks?limit=12',
      { method: 'GET' }
    );

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(250);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('runtime_runbook_history_checks_get');
    expect(trace.timeoutMs).toBe(12000);
    expect(trace.maxRetries).toBe(2);
    expect(trace.retryable).toBe(true);
    expect(trace.attemptCount).toBe(2);
  });

  test('applies dedicated retry policy for runtime runbook history GET endpoint', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 503,
          headers: {
            'x-request-id': 'srv-runbook-history-1',
          },
          body: {
            success: false,
            error: 'service unavailable',
            errorCode: 'service_unavailable',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-runbook-history-2',
          },
          body: {
            success: true,
            result: {
              summary: {
                returnedRecords: 0,
              },
              records: [],
            },
          },
        })
      ));
    setFetch(fetchMock);

    const body = await pathApp._requestLearningApiOptional(
      '/api/knowledge/runtime-capability-runbook/history?limit=12&sinceMinutes=360',
      { method: 'GET' }
    );

    expect(body?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(250);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('runtime_runbook_history_get');
    expect(trace.timeoutMs).toBe(12000);
    expect(trace.maxRetries).toBe(2);
    expect(trace.retryable).toBe(true);
    expect(trace.attemptCount).toBe(2);
  });

  test('supports explicit retry policy overrides for session plan POST requests', async () => {
    const { pathApp, setFetch } = loadPathAppHarness();
    const sleepSpy = jest.spyOn(pathApp, '_sleepForLearningApi').mockResolvedValue(undefined);
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: false,
          status: 503,
          headers: {
            'x-request-id': 'srv-session-plan-1',
          },
          body: {
            success: false,
            error: 'upstream unavailable',
            errorCode: 'service_unavailable',
          },
        })
      ))
      .mockImplementationOnce(async () => (
        buildFetchResponse({
          ok: true,
          status: 200,
          headers: {
            'x-request-id': 'srv-session-plan-2',
          },
          body: {
            success: true,
            result: {
              summary: {
                totalActions: 1,
              },
              actions: [],
            },
          },
        })
      ));
    setFetch(fetchMock);

    const result = await pathApp._requestLearningApi(
      '/api/knowledge/session/plan',
      { userId: 'path_user_default', maxActions: 4 },
      'POST',
      {
        retryable: true,
        maxRetries: 2,
        timeoutMs: 22000,
        backoffSequenceMs: [300, 900],
      }
    );

    expect(result?.summary?.totalActions).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(300);
    const trace = pathApp.learningWorkbench.apiRequestTraces?.[0];
    expect(trace).toBeDefined();
    expect(trace.policyKey).toBe('default');
    expect(trace.retryable).toBe(true);
    expect(trace.maxRetries).toBe(2);
    expect(trace.timeoutMs).toBe(22000);
    expect(trace.attemptCount).toBe(2);
    expect(trace.attempts?.[0]?.retryReason).toBe('http-503');
  });
});
