import * as fs from 'fs';
import * as path from 'path';

function extractAgentWorkspaceKeys(source: string): string[] {
    return Array.from(
        new Set(
            Array.from(source.matchAll(/agentWorkspace\.[A-Za-z0-9_.]+/g)).map((match) => match[0])
        )
    ).filter((key) => /[A-Za-z0-9_]$/.test(key)).sort();
}

function getNestedStringValue(record: Record<string, unknown>, dottedKey: string): string | null {
    const value = dottedKey.split('.').reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object' || !(segment in current)) {
            return null;
        }
        return (current as Record<string, unknown>)[segment];
    }, record);

    return typeof value === 'string' && value.trim().length > 0
        ? value
        : null;
}

function extractPlaceholderSet(template: string): string[] {
    return Array.from(
        new Set(
            Array.from(template.matchAll(/\{(\w+)\}/g)).map((match) => match[1] || '')
        )
    ).filter(Boolean).sort();
}

describe('agent workspace locale contract', () => {
    const sourceFiles = [
        path.join(__dirname, 'frontend', 'agent_workspace.js'),
        path.join(__dirname, 'frontend', 'workspace_panes.js'),
        path.join(__dirname, 'frontend', 'index.html'),
        path.join(__dirname, 'learning', 'KnowledgeLearningPlatform.ts'),
    ];

    const localeEn = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'frontend', 'locales', 'en.json'), 'utf8')
    ) as Record<string, unknown>;
    const localeZh = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'frontend', 'locales', 'zh.json'), 'utf8')
    ) as Record<string, unknown>;

    const referencedKeys = Array.from(
        new Set(
            sourceFiles.flatMap((filePath) => (
                extractAgentWorkspaceKeys(fs.readFileSync(filePath, 'utf8'))
            ))
        )
    ).sort();

    test('all referenced agentWorkspace keys resolve in both locales', () => {
        const missing = referencedKeys.filter((key) => (
            !getNestedStringValue(localeEn, key) || !getNestedStringValue(localeZh, key)
        ));

        expect(missing).toEqual([]);
    });

    test('matching agentWorkspace locale strings preserve placeholder sets', () => {
        const mismatched = referencedKeys.flatMap((key) => {
            const enValue = getNestedStringValue(localeEn, key);
            const zhValue = getNestedStringValue(localeZh, key);
            if (!enValue || !zhValue) {
                return [];
            }
            const enPlaceholders = extractPlaceholderSet(enValue);
            const zhPlaceholders = extractPlaceholderSet(zhValue);
            return JSON.stringify(enPlaceholders) === JSON.stringify(zhPlaceholders)
                ? []
                : [{
                    key,
                    enPlaceholders,
                    zhPlaceholders,
                }];
        });

        expect(mismatched).toEqual([]);
    });
});
