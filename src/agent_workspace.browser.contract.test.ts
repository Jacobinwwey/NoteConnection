import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

type PackageJson = {
  scripts?: Record<string, string>;
};

type BrowserSmokeReport = {
  port: number;
  bridgePort: number;
  artifacts: {
    artifactDir: string;
    screenshotPath: string;
    consoleLogPath: string;
    networkSummaryPath: string;
  };
  browserChecks: {
    backendMode: string;
    graphMode: string;
    pathMode: string;
    titleText: string;
    userMessageText: string;
    assistantMessageText: string;
    focusButtonLabelZh: string;
    learningPathButtonLabelZh: string;
    studySessionButtonLabelZh: string;
    quizButtonLabelZh: string;
    transferButtonLabelZh: string;
    counterexampleButtonLabelZh: string;
    followUpButtonLabelZh: string;
    compareQueryBackendsButtonLabelZh: string;
    queryBackendComparisonHistoryButtonLabelZh: string;
    queryBackendComparisonTrendButtonLabelZh: string;
    learningQualityTrendButtonLabelZh: string;
    learningQualityHistoryButtonLabelZh: string;
    sessionPlanQualityTrendButtonLabelZh: string;
    sessionPlanQualityHistoryButtonLabelZh: string;
    sessionHistoryButtonLabelZh: string;
    runtimeRunbookChecksButtonLabelZh: string;
    runtimeRunbookActionQueueButtonLabelZh: string;
    conversationTurnCacheAlertTrendButtonLabelZh: string;
    focusOpenedId: string;
    focusStateNodeId: string;
    focusNodeNameText: string;
    learningPathPaneOpenState: string;
    learningPathInitId: string;
    learningPathCurrentTargetId: string;
    learningPathDisplay: string;
    studySessionCardTitleZh: string;
    studySessionCardSummaryZh: string;
    tutorCardTitleZh: string;
    tutorCardEvidenceHeadingZh: string;
    queryBackendComparisonCardTitleZh: string;
    queryBackendComparisonCardMetricsHeadingZh: string;
    queryBackendComparisonHistoryCardTitleZh: string;
    queryBackendComparisonHistoryCardMetricsHeadingZh: string;
    queryBackendComparisonTrendCardTitleZh: string;
    queryBackendComparisonTrendCardMetricsHeadingZh: string;
    learningQualityTrendCardTitleZh: string;
    learningQualityTrendCardMetricsHeadingZh: string;
    learningQualityHistoryCardTitleZh: string;
    learningQualityHistoryCardMetricsHeadingZh: string;
    sessionPlanQualityTrendCardTitleZh: string;
    sessionPlanQualityTrendCardMetricsHeadingZh: string;
    sessionPlanQualityHistoryCardTitleZh: string;
    sessionPlanQualityHistoryCardMetricsHeadingZh: string;
    sessionPlanQualityHistoryDebugJson: string;
    sessionHistoryCardTitleZh: string;
    sessionHistoryCardMetricsHeadingZh: string;
    runtimeRunbookChecksCardTitleZh: string;
    runtimeRunbookChecksCardMetricsHeadingZh: string;
    runtimeRunbookActionQueueCardTitleZh: string;
    runtimeRunbookActionQueueCardMetricsHeadingZh: string;
    conversationTurnCacheAlertTrendCardTitleZh: string;
    conversationTurnCacheAlertTrendCardMetricsHeadingZh: string;
    promotionStateAfterClick: string;
    promotionStateAfterEscape: string | null;
  };
};

jest.setTimeout(300000);

describe('agent workspace browser smoke contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const browserSmokeScriptPath = path.join(repoRoot, 'scripts', 'verify-agent-workspace-browser.js');

  test('package exposes a dedicated agent-workspace browser verification command', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    expect(packageJson.scripts?.['verify:agent-workspace:browser']).toBe(
      'node scripts/verify-agent-workspace-browser.js'
    );
  });

  test('browser verification script drives the rendered shell and localized interactions in a real browser', async () => {
    const execution = spawnSync(process.execPath, [browserSmokeScriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      timeout: 300000,
    });
    expect(execution.status).toBe(0);

    const stdout = String(execution.stdout || '');
    const match = stdout.match(/\[agent-workspace-browser\] PASS (\{[\s\S]*\})/);
    expect(match).not.toBeNull();
    const report = JSON.parse(match![1]) as BrowserSmokeReport;

    expect(report.artifacts.artifactDir).toContain('output/playwright/agent-workspace-browser');
    expect(report.artifacts.screenshotPath.endsWith('.png')).toBe(true);
    expect(report.artifacts.consoleLogPath.endsWith('.log')).toBe(true);
    expect(report.artifacts.networkSummaryPath.endsWith('.json')).toBe(true);
    expect(fs.existsSync(report.artifacts.artifactDir)).toBe(true);
    expect(fs.existsSync(report.artifacts.screenshotPath)).toBe(true);
    expect(fs.existsSync(report.artifacts.consoleLogPath)).toBe(true);
    expect(fs.existsSync(report.artifacts.networkSummaryPath)).toBe(true);

    const networkSummary = JSON.parse(fs.readFileSync(report.artifacts.networkSummaryPath, 'utf8')) as {
      hasDataJsRequest: boolean;
      hasConversationRequest: boolean;
      hasLearningPathRequest: boolean;
      hasStudySessionRequest: boolean;
      hasQueryBackendComparisonRequest: boolean;
      hasQueryBackendComparisonHistoryRequest: boolean;
      hasQueryBackendComparisonTrendRequest: boolean;
      hasLearningQualityTrendRequest: boolean;
      hasLearningQualityHistoryRequest: boolean;
      hasSessionPlanQualityTrendRequest: boolean;
      hasSessionPlanQualityHistoryRequest: boolean;
      hasSessionHistoryRequest: boolean;
      hasRuntimeRunbookChecksRequest: boolean;
      hasRuntimeRunbookActionQueueRequest: boolean;
      hasConversationTurnCacheAlertTrendRequest: boolean;
      hasTutorActionRequest: boolean;
      fetchTraceCount: number;
      allTrackedRequestsSucceeded: boolean;
      endpointStatusSummary: Record<string, {
        requestCount: number;
        non2xxCount: number;
        statusCodes: number[];
        averageDurationMs: number;
        maxDurationMs: number;
      }>;
    };
    expect(networkSummary.hasDataJsRequest).toBe(true);
    expect(networkSummary.hasConversationRequest).toBe(true);
    expect(networkSummary.hasLearningPathRequest).toBe(true);
    expect(networkSummary.hasStudySessionRequest).toBe(true);
    expect(networkSummary.hasQueryBackendComparisonRequest).toBe(true);
    expect(networkSummary.hasQueryBackendComparisonHistoryRequest).toBe(true);
    expect(networkSummary.hasQueryBackendComparisonTrendRequest).toBe(true);
    expect(networkSummary.hasLearningQualityTrendRequest).toBe(true);
    expect(networkSummary.hasLearningQualityHistoryRequest).toBe(true);
    expect(networkSummary.hasSessionPlanQualityTrendRequest).toBe(true);
    expect(networkSummary.hasSessionPlanQualityHistoryRequest).toBe(true);
    expect(networkSummary.hasSessionHistoryRequest).toBe(true);
    expect(networkSummary.hasRuntimeRunbookChecksRequest).toBe(true);
    expect(networkSummary.hasRuntimeRunbookActionQueueRequest).toBe(true);
    expect(networkSummary.hasConversationTurnCacheAlertTrendRequest).toBe(true);
    expect(networkSummary.hasTutorActionRequest).toBe(true);
    expect(networkSummary.fetchTraceCount).toBeGreaterThanOrEqual(12);
    expect(networkSummary.allTrackedRequestsSucceeded).toBe(true);
    expect(networkSummary.endpointStatusSummary.conversation.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.conversation.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.learningPath.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.learningPath.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.studySession.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.studySession.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.queryBackendComparison.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.queryBackendComparison.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.queryBackendComparisonHistory.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.queryBackendComparisonHistory.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.queryBackendComparisonTrend.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.queryBackendComparisonTrend.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.learningQualityTrend.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.learningQualityTrend.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.learningQualityHistory.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.learningQualityHistory.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.sessionPlanQualityTrend.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.sessionPlanQualityTrend.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.sessionPlanQualityHistory.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.sessionPlanQualityHistory.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.sessionHistory.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.sessionHistory.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.runtimeRunbookChecks.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.runtimeRunbookChecks.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.runtimeRunbookActionQueue.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.runtimeRunbookActionQueue.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.conversationTurnCacheAlertTrend.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.conversationTurnCacheAlertTrend.non2xxCount).toBe(0);
    expect(networkSummary.endpointStatusSummary.tutorAction.requestCount).toBeGreaterThan(0);
    expect(networkSummary.endpointStatusSummary.tutorAction.non2xxCount).toBe(0);

    expect(report.browserChecks.backendMode).toBe('real_backend');
    expect(report.browserChecks.graphMode).toBe('real_graph_runtime');
    expect(report.browserChecks.pathMode).toBe('real_path_runtime');
    expect(report.browserChecks.titleText).toBe('Agent 工作区');
    expect(report.browserChecks.userMessageText).toBe('focus node');
    expect(report.browserChecks.assistantMessageText).toBe(
      'I found 1 local knowledge point(s) relevant to your request. Start with Focus Node and use the focus or learning path actions to inspect them.'
    );
    expect(report.browserChecks.focusButtonLabelZh).toBe('聚焦');
    expect(report.browserChecks.learningPathButtonLabelZh).toBe('学习路径');
    expect(report.browserChecks.studySessionButtonLabelZh).toBe('学习会话');
    expect(report.browserChecks.quizButtonLabelZh).toBe('测验');
    expect(report.browserChecks.transferButtonLabelZh).toBe('迁移挑战');
    expect(report.browserChecks.counterexampleButtonLabelZh).toBe('反例挑战');
    expect(report.browserChecks.followUpButtonLabelZh).toBe('追问');
    expect(report.browserChecks.compareQueryBackendsButtonLabelZh).toBe('后端对比');
    expect(report.browserChecks.queryBackendComparisonHistoryButtonLabelZh).toBe('对比历史');
    expect(report.browserChecks.queryBackendComparisonTrendButtonLabelZh).toBe('对比趋势');
    expect(report.browserChecks.learningQualityTrendButtonLabelZh).toBe('学习质量趋势');
    expect(report.browserChecks.learningQualityHistoryButtonLabelZh).toBe('学习质量历史');
    expect(report.browserChecks.sessionPlanQualityTrendButtonLabelZh).toBe('会话计划趋势');
    expect(report.browserChecks.sessionPlanQualityHistoryButtonLabelZh).toBe('会话计划历史');
    expect(report.browserChecks.sessionHistoryButtonLabelZh).toBe('会话历史');
    expect(report.browserChecks.runtimeRunbookChecksButtonLabelZh).toBe('运行时检查');
    expect(report.browserChecks.runtimeRunbookActionQueueButtonLabelZh).toBe('运行时队列');
    expect(report.browserChecks.conversationTurnCacheAlertTrendButtonLabelZh).toBe('轮次缓存趋势');
    expect(report.browserChecks.focusOpenedId).toMatch(/^atom_/);
    expect(report.browserChecks.focusStateNodeId).toBe(report.browserChecks.focusOpenedId);
    expect(report.browserChecks.focusNodeNameText).toBe('Focus Node');
    expect(report.browserChecks.learningPathPaneOpenState).toBe('true');
    expect(report.browserChecks.learningPathInitId).toBe(report.browserChecks.focusOpenedId);
    expect(report.browserChecks.learningPathCurrentTargetId).toBe(report.browserChecks.focusOpenedId);
    expect(report.browserChecks.learningPathDisplay).toBe('block');
    expect(report.browserChecks.studySessionCardTitleZh).toBe('学习会话计划');
    expect(report.browserChecks.studySessionCardSummaryZh).toContain('动作');
    expect(report.browserChecks.tutorCardTitleZh).toBe('测验提示');
    expect(report.browserChecks.tutorCardEvidenceHeadingZh).toBe('证据');
    expect(report.browserChecks.queryBackendComparisonCardTitleZh).toBe('检索后端对比');
    expect(report.browserChecks.queryBackendComparisonCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.queryBackendComparisonHistoryCardTitleZh).toBe('后端对比历史');
    expect(report.browserChecks.queryBackendComparisonHistoryCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.queryBackendComparisonTrendCardTitleZh).toBe('后端对比趋势');
    expect(report.browserChecks.queryBackendComparisonTrendCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.learningQualityTrendCardTitleZh).toBe('学习质量趋势');
    expect(report.browserChecks.learningQualityTrendCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.learningQualityHistoryCardTitleZh).toBe('学习质量历史');
    expect(report.browserChecks.learningQualityHistoryCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.sessionPlanQualityTrendCardTitleZh).toBe('会话计划质量趋势');
    expect(report.browserChecks.sessionPlanQualityTrendCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.sessionPlanQualityHistoryCardTitleZh).toBe('会话计划质量历史');
    expect(report.browserChecks.sessionPlanQualityHistoryCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.sessionHistoryCardTitleZh).toBe('会话历史');
    expect(report.browserChecks.sessionHistoryCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.runtimeRunbookChecksCardTitleZh).toBe('运行时 Runbook 检查');
    expect(report.browserChecks.runtimeRunbookChecksCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.runtimeRunbookActionQueueCardTitleZh).toBe('运行时动作队列');
    expect(report.browserChecks.runtimeRunbookActionQueueCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.conversationTurnCacheAlertTrendCardTitleZh).toBe('对话轮次缓存告警趋势');
    expect(report.browserChecks.conversationTurnCacheAlertTrendCardMetricsHeadingZh).toBe('关键指标');
    expect(report.browserChecks.promotionStateAfterClick).toBe('graph-focus');
    expect(report.browserChecks.promotionStateAfterEscape).toBeNull();
  });
});
