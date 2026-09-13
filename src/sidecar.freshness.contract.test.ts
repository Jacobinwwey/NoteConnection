import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type SidecarFingerprintModule = {
    computeSidecarSourceFingerprint: (repoRoot: string) => { digest: string; fileCount: number };
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

    test('uncompiled source changes invalidate otherwise unchanged packaged inputs', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-source-fingerprint-'));
        try {
            fs.mkdirSync(path.join(root, 'src'), { recursive: true });
            fs.mkdirSync(path.join(root, 'dist', 'src'), { recursive: true });
            const source = path.join(root, 'src', 'server.ts');
            fs.writeFileSync(source, 'const revision = 1;\r\n');
            fs.writeFileSync(path.join(root, 'dist', 'src', 'server.js'), 'const revision = 1;\n');
            fingerprint.writeSidecarBuildManifest(root, ['server-fixture']);
            const inputs = fingerprint.computeSidecarInputFingerprint(root).digest;
            fs.writeFileSync(source, 'const revision = 1;\n');
            expect(fingerprint.isSidecarBuildManifestCurrent(root)).toBe(true);
            fs.writeFileSync(source, 'const revision = 2;\n');
            expect(fingerprint.computeSidecarInputFingerprint(root).digest).toBe(inputs);
            expect(fingerprint.isSidecarBuildManifestCurrent(root)).toBe(false);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    test('Rust WASM compiler caches do not change source identity', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-source-cache-'));
        try {
            const source = path.join(root, 'src', 'backend', 'wasm', 'src');
            fs.mkdirSync(source, { recursive: true });
            fs.writeFileSync(path.join(source, 'lib.rs'), 'pub fn compute() {}\n');
            const before = fingerprint.computeSidecarSourceFingerprint(root);
            const cache = path.join(root, 'src', 'backend', 'wasm', 'target', 'release');
            fs.mkdirSync(cache, { recursive: true });
            fs.writeFileSync(path.join(cache, '.rustc_info.json'), '{"host":"one"}');
            fs.writeFileSync(path.join(cache, 'compiler-output.rlib'), Buffer.from([0, 1, 2, 3]));
            expect(fingerprint.computeSidecarSourceFingerprint(root)).toEqual(before);
            fs.writeFileSync(path.join(source, 'lib.rs'), 'pub fn compute() { panic!(); }\n');
            expect(fingerprint.computeSidecarSourceFingerprint(root).digest).not.toBe(before.digest);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    test.each(['Cargo.lock', 'src/lib.rs'])('%s has the same source identity under LF and CRLF checkouts', (relativePath) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-source-newline-'));
        try {
            const file = path.join(root, 'src', 'backend', 'wasm', relativePath);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, 'first line\nsecond line\n');
            const before = fingerprint.computeSidecarSourceFingerprint(root).digest;
            fs.writeFileSync(file, 'first line\r\nsecond line\r\n');
            expect(fingerprint.computeSidecarSourceFingerprint(root).digest).toBe(before);
            fs.writeFileSync(file, 'first line\nchanged line\n');
            expect(fingerprint.computeSidecarSourceFingerprint(root).digest).not.toBe(before);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    test('ordinary target directories and new tests remain source inputs', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-source-target-'));
        try {
            const directory = path.join(root, 'src', 'learning', 'target');
            fs.mkdirSync(directory, { recursive: true });
            const initial = fingerprint.computeSidecarSourceFingerprint(root).digest;
            fs.writeFileSync(path.join(directory, 'Reducer.ts'), 'export const revision = 1;\n');
            const withSource = fingerprint.computeSidecarSourceFingerprint(root).digest;
            expect(withSource).not.toBe(initial);
            fs.writeFileSync(path.join(directory, 'Reducer.test.ts'), 'test("revision", () => {});\n');
            expect(fingerprint.computeSidecarSourceFingerprint(root).digest).not.toBe(withSource);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    test('compiled target directories remain fully bound by the artifact input fingerprint', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-dist-target-'));
        try {
            const directory = path.join(root, 'dist', 'src', 'backend', 'wasm', 'target');
            fs.mkdirSync(directory, { recursive: true });
            const file = path.join(directory, 'runtime.wasm');
            fs.writeFileSync(file, Buffer.from([0, 1, 2, 3]));
            const before = fingerprint.computeSidecarInputFingerprint(root).digest;
            fs.writeFileSync(file, Buffer.from([0, 1, 2, 4]));
            expect(fingerprint.computeSidecarInputFingerprint(root).digest).not.toBe(before);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });
});

function repoRoot(): string {
    return path.resolve(__dirname, '..');
}
