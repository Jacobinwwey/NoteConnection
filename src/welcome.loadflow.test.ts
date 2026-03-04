import * as fs from 'fs';
import * as path from 'path';

describe('welcome modal startup handoff', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const welcomePath = path.join(repoRoot, 'src', 'frontend', 'welcome.js');

  test('consumes pending welcome state set by source manager', () => {
    const source = fs.readFileSync(welcomePath, 'utf8');
    expect(source).toContain('consumePendingWelcomeState');
    expect(source).toContain('__NC_PENDING_WELCOME_STATE');
    expect(source).toContain('showWelcomeModal(pendingWelcomeState)');
  });

  test('has a bounded i18n readiness fallback to avoid modal starvation', () => {
    const source = fs.readFileSync(welcomePath, 'utf8');
    expect(source).toContain('i18n readiness timeout');
    expect(source).toContain('setTimeout(() => checkAndShow(attempt + 1), 80);');
  });
});
