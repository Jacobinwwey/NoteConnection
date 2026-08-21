import * as fs from 'fs';
import * as path from 'path';

describe('canonical ID migration readiness boundary', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'verify-canonical-id-readiness.js');
    const manifestPath = path.resolve(process.cwd(), 'config', 'identity-corpus.v1.json');

    test('keeps readiness read-only and public-ID cutover blocked', () => {
        const source = fs.readFileSync(scriptPath, 'utf8');
        expect(source).toContain("canonicalPublicIdCutover: 'blocked'");
        expect(source).toContain('independentReviewRequired: true');
        expect(source).toContain("nativeDeviceEvidence === true");
        expect(source).toContain("process.argv.includes('--strict')");
        expect(source).not.toContain('migratePublicIds(');
        expect(source).not.toContain('switchPublicIds(');
    });

    test('manifest keeps all compatibility changes false before review', () => {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            compatibility: Record<string, boolean>;
        };
        expect(Object.values(manifest.compatibility)).toEqual([false, false, false, false]);
    });
});
