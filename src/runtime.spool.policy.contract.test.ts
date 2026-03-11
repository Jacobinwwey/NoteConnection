import * as fs from 'fs';
import * as path from 'path';

describe('runtime request-body spool policy contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const serverPath = path.join(repoRoot, 'src', 'server.ts');

  test('server defines adaptive spool threshold policy and env controls', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    expect(serverSource).toContain('resolveRequestBodySpoolThresholdPolicy');
    expect(serverSource).toContain('NOTE_CONNECTION_REQUEST_BODY_SPOOL_THRESHOLD_KB');
    expect(serverSource).toContain('NOTE_CONNECTION_REQUEST_BODY_SPOOL_STRICT');
    expect(serverSource).toContain('REQUEST_BODY_SPOOL_THRESHOLD_POLICY');
    expect(serverSource).toContain('requestBodySpoolThresholdSource');
    expect(serverSource).toContain('requestBodySpoolThresholdRecommendedKb');
  });

  test('clipboard ingress routes consume centralized spool threshold setting', () => {
    const serverSource = fs.readFileSync(serverPath, 'utf8');
    expect(serverSource).toContain('spoolThresholdBytes: REQUEST_BODY_SPOOL_THRESHOLD_BYTES');
    expect(serverSource).not.toContain('spoolThresholdBytes: 128 * 1024');
  });
});
