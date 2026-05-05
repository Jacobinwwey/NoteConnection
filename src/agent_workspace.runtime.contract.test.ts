import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type RuntimeSmokeModule = {
  verifyAgentWorkspaceRuntime: (options?: {
    projectRoot?: string;
    port?: number;
    bridgePort?: number;
    timeoutMs?: number;
    logger?: Pick<Console, 'log' | 'warn' | 'error'>;
  }) => Promise<{
    port: number;
    bridgePort: number;
    rootHtmlChecks: {
      hasAgentWorkspaceShell: boolean;
      hasAgentChatPane: boolean;
      hasGraphFocusPane: boolean;
      hasLearningPathPane: boolean;
      hasAgentWorkspaceI18nKey: boolean;
    };
    localeChecks: {
      hasAgentWorkspaceNamespace: boolean;
      focusLabel: string;
      localNodeUnavailableTemplate: string;
      queryBackendDiagnosticsRolloutModeLabel: string;
      queryBackendDiagnosticsAccelerationProviderLabel: string;
      queryBackendDiagnosticsAccelerationFailureModeLabel: string;
      queryBackendDiagnosticsAccelerationRepresentationStrictLabel: string;
      queryBackendDiagnosticsAnnPrefilterLabel: string;
    };
  }>;
};

jest.setTimeout(30000);

describe('agent workspace runtime smoke contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const runtimeSmokeScriptPath = path.join(repoRoot, 'scripts', 'verify-agent-workspace-runtime.js');

  test('package exposes a dedicated agent-workspace runtime verification command', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    expect(packageJson.scripts?.['verify:agent-workspace:runtime']).toBe(
      'node scripts/verify-agent-workspace-runtime.js'
    );
  });

  test('runtime verification script serves copied frontend shell and localized agent workspace resources', async () => {
    const runtimeSmoke = require(runtimeSmokeScriptPath) as RuntimeSmokeModule;
    expect(typeof runtimeSmoke.verifyAgentWorkspaceRuntime).toBe('function');

    const report = await runtimeSmoke.verifyAgentWorkspaceRuntime({
      timeoutMs: 15000,
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    expect(report.rootHtmlChecks).toEqual({
      hasAgentWorkspaceShell: true,
      hasAgentChatPane: true,
      hasGraphFocusPane: true,
      hasLearningPathPane: true,
      hasAgentWorkspaceI18nKey: true,
    });
    expect(report.localeChecks.hasAgentWorkspaceNamespace).toBe(true);
    expect(report.localeChecks.focusLabel).toBe('聚焦');
    expect(report.localeChecks.localNodeUnavailableTemplate).toContain('{nodeId}');
    expect(report.localeChecks.queryBackendDiagnosticsRolloutModeLabel).toBe('发布策略模式');
    expect(report.localeChecks.queryBackendDiagnosticsAccelerationProviderLabel).toBe('加速提供方配置');
    expect(report.localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel).toBe('加速失败模式配置');
    expect(report.localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel)
      .toBe('加速表示一致性严格模式配置');
    expect(report.localeChecks.queryBackendDiagnosticsAnnPrefilterLabel).toBe('ANN 预筛选发布状态');
  });
});
