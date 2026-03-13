import * as path from 'path';

const policyModulePath = path.resolve(__dirname, '..', 'scripts', 'lib', 'runtime-memory-policy.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  resolveRuntimeHeapPolicy,
  stripMaxOldSpaceFromNodeOptions,
} = require(policyModulePath);

describe('runtime heap startup policy contracts', () => {
  test('desktop default policy keeps a bounded baseline when no hints are provided', () => {
    const policy = resolveRuntimeHeapPolicy({}, 32768);
    expect(policy.runtimeClass).toBe('desktop');
    expect(policy.source).toBe('default');
    expect(policy.selectedOldSpaceMb).toBe(4096);
    expect(policy.recommendedOldSpaceMb).toBe(4096);
  });

  test('large-graph hints promote heap recommendation to support 10k+/1m+ workloads', () => {
    const policy = resolveRuntimeHeapPolicy({
      NOTE_CONNECTION_EXPECTED_NODE_COUNT: '15000',
      NOTE_CONNECTION_EXPECTED_EDGE_COUNT: '1500000',
    }, 32768);

    expect(policy.source).toBe('workload-hint');
    expect(policy.recommendedOldSpaceMb).toBe(8192);
    expect(policy.selectedOldSpaceMb).toBe(8192);
  });

  test('explicit heap override is honored but clamped by hard bounds', () => {
    const policy = resolveRuntimeHeapPolicy({
      NOTE_CONNECTION_MAX_OLD_SPACE_SIZE_MB: '20000',
    }, 32768);

    expect(policy.source).toBe('env-override');
    expect(policy.selectedOldSpaceMb).toBe(12288);
    expect(policy.warnings.length).toBeGreaterThan(0);
  });

  test('host memory budget prevents unstable oversubscription on constrained machines', () => {
    const policy = resolveRuntimeHeapPolicy({
      NOTE_CONNECTION_EXPECTED_NODE_COUNT: '25000',
      NOTE_CONNECTION_EXPECTED_EDGE_COUNT: '2500000',
    }, 4096);

    expect(policy.recommendedOldSpaceMb).toBe(2048);
    expect(policy.selectedOldSpaceMb).toBe(2048);
    expect(policy.hostBudgetMb).toBe(2048);
    expect(policy.warnings.length).toBeGreaterThan(0);
  });

  test('ios runtime applies jetsam-aware ceiling when workload hints exceed mobile tolerance', () => {
    const policy = resolveRuntimeHeapPolicy({
      NOTE_CONNECTION_RUNTIME_PROFILE: 'ios',
      NOTE_CONNECTION_EXPECTED_NODE_COUNT: '15000',
      NOTE_CONNECTION_EXPECTED_EDGE_COUNT: '1500000',
    }, 8192);

    expect(policy.runtimeClass).toBe('mobile');
    expect(policy.runtimePlatform).toBe('ios');
    expect(policy.iosJetsamTier).toBe('balanced');
    expect(policy.recommendedOldSpaceMb).toBe(2048);
    expect(policy.selectedOldSpaceMb).toBe(2048);
    expect(policy.warnings.some((warning: string) => warning.includes('iOS Jetsam ceiling'))).toBe(true);
  });

  test('ios tight jetsam tier clamps explicit overrides to tighter ceiling', () => {
    const policy = resolveRuntimeHeapPolicy({
      NOTE_CONNECTION_RUNTIME_PROFILE: 'ios',
      NOTE_CONNECTION_IOS_JETSAM_TIER: 'tight',
      NOTE_CONNECTION_MAX_OLD_SPACE_SIZE_MB: '4096',
    }, 8192);

    expect(policy.runtimePlatform).toBe('ios');
    expect(policy.iosJetsamTier).toBe('tight');
    expect(policy.source).toBe('env-override');
    expect(policy.selectedOldSpaceMb).toBe(1536);
    expect(policy.warnings.length).toBeGreaterThan(0);
  });

  test('NODE_OPTIONS sanitizer removes conflicting max-old-space-size flags', () => {
    const sanitized = stripMaxOldSpaceFromNodeOptions('--trace-warnings --max-old-space-size=1024 --stack-trace-limit=200');
    expect(sanitized).toBe('--trace-warnings --stack-trace-limit=200');
  });
});
