import fs from 'node:fs';
import path from 'node:path';

describe('route registry shadow parity gate', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const serverSource = fs.readFileSync(path.join(repoRoot, 'src', 'server.ts'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>;
    };

    test('supports an explicit legacy mode without changing the default registry mode', () => {
        expect(serverSource.includes('NOTE_CONNECTION_ROUTE_DISPATCH_MODE')).toBe(true);
        expect(serverSource.includes("ROUTE_DISPATCH_MODE === 'registry'")).toBe(true);
        expect(serverSource.includes("registeredRoute && (USE_REGISTRY_DISPATCH || requestPath.startsWith('/api/notemd/'))")).toBe(true);
        expect(/(?:get|post)Pathname === '\/api\/notemd\//.test(serverSource)).toBe(false);
    });

    test('ships an executable parity harness as a release gate', () => {
        expect(packageJson.scripts?.['verify:route:shadow']).toBe(
            'npm run build:mini && node scripts/verify-route-registry-shadow.js'
        );
        expect(fs.existsSync(path.join(repoRoot, 'scripts', 'verify-route-registry-shadow.js'))).toBe(true);
    });
});
