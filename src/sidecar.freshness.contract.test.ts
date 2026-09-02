import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type SidecarFingerprintModule = {
    computeSidecarInputFingerprint: (repoRoot: string) => {
        algorithm: string;
        digest: string;
        files: Array<{ path: string; size: number; sha256: string }>;
    };
    writeSidecarBuildManifest: (repoRoot: string, targets: string[]) => unknown;
    readSidecarBuildManifest: (repoRoot: string) => { fingerprint?: { digest?: string } } | null;
    isSidecarBuildManifestCurrent: (repoRoot: string) => boolean;
};

describe('sidecar input freshness contract', () => {
    const fingerprintPath = path.join(__dirname, '..', 'scripts', 'sidecar-build-fingerprint.js');
    let fingerprint: SidecarFingerprintModule;

    beforeAll(() => {
        fingerprint = require(fingerprintPath) as SidecarFingerprintModule;
    });

    test('content fingerprint changes even when an input keeps an older mtime', () => {
        const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sidecar-fingerprint-'));
        const distRoot = path.join(repoRoot, 'dist', 'src');
        try {
            fs.mkdirSync(distRoot, { recursive: true });
            fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true });
            fs.writeFileSync(path.join(repoRoot, 'package.json'), '{"name":"fixture"}', 'utf8');
            fs.writeFileSync(path.join(repoRoot, 'tsconfig.json'), '{}', 'utf8');
            fs.writeFileSync(path.join(repoRoot, 'scripts', 'build-sidecar.js'), 'build-v1', 'utf8');
            const entryPath = path.join(distRoot, 'server.js');
            fs.writeFileSync(entryPath, 'payload-v1', 'utf8');

            const before = fingerprint.computeSidecarInputFingerprint(repoRoot);
            fs.writeFileSync(entryPath, 'payload-v2', 'utf8');
            const after = fingerprint.computeSidecarInputFingerprint(repoRoot);

            expect(after.digest).not.toBe(before.digest);
            expect(after.files.some((file) => file.path === 'dist/src/server.js')).toBe(true);
        } finally {
            fs.rmSync(repoRoot, { recursive: true, force: true });
        }
    });

    test('manifest validation rejects a stale packaged input and accepts the current digest', () => {
        const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sidecar-manifest-'));
        try {
            fs.mkdirSync(path.join(repoRoot, 'dist', 'src'), { recursive: true });
            fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true });
            fs.writeFileSync(path.join(repoRoot, 'package.json'), '{"name":"fixture"}', 'utf8');
            fs.writeFileSync(path.join(repoRoot, 'tsconfig.json'), '{}', 'utf8');
            fs.writeFileSync(path.join(repoRoot, 'scripts', 'build-sidecar.js'), 'build-v1', 'utf8');
            const entryPath = path.join(repoRoot, 'dist', 'src', 'server.js');
            fs.writeFileSync(entryPath, 'payload-v1', 'utf8');

            fingerprint.writeSidecarBuildManifest(repoRoot, ['server-fixture']);
            expect(fingerprint.isSidecarBuildManifestCurrent(repoRoot)).toBe(true);

            fs.writeFileSync(entryPath, 'payload-v2', 'utf8');
            expect(fingerprint.isSidecarBuildManifestCurrent(repoRoot)).toBe(false);
            expect(fingerprint.readSidecarBuildManifest(repoRoot)).not.toBeNull();
        } finally {
            fs.rmSync(repoRoot, { recursive: true, force: true });
        }
    });

    test('build and ensure scripts consume the same manifest contract', () => {
        const buildSource = fs.readFileSync(path.join(repoRoot(), 'scripts', 'build-sidecar.js'), 'utf8');
        const ensureSource = fs.readFileSync(path.join(repoRoot(), 'scripts', 'ensure-sidecar-ready.js'), 'utf8');

        expect(buildSource).toContain("require('./sidecar-build-fingerprint.js')");
        expect(buildSource).toContain('writeSidecarBuildManifest');
        expect(ensureSource).toContain("require('./sidecar-build-fingerprint.js')");
        expect(ensureSource).toContain('isSidecarBuildManifestCurrent');
        expect(ensureSource).toContain('Sidecar input fingerprint is missing or stale');
    });
});

function repoRoot(): string {
    return path.resolve(__dirname, '..');
}
