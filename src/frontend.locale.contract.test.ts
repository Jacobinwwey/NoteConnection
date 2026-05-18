import * as fs from 'fs';
import * as path from 'path';

function getNestedStringValue(record: Record<string, unknown>, dottedKey: string): string | null {
  const value = dottedKey.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    return (current as Record<string, unknown>)[segment];
  }, record);

  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

describe('frontend locale contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const enLocale = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'locales', 'en.json'), 'utf8')
  ) as Record<string, unknown>;
  const zhLocale = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'locales', 'zh.json'), 'utf8')
  ) as Record<string, unknown>;
  const requiredKeys = [
    'analysis_title',
    'node_details',
    'reader_loading',
    'reader_outline_title',
    'reader_outline_empty',
  ];

  test('required reader and analysis keys resolve in both locales', () => {
    const missing = requiredKeys.filter((key) => (
      !getNestedStringValue(enLocale, key) || !getNestedStringValue(zhLocale, key)
    ));

    expect(missing).toEqual([]);
  });
});
