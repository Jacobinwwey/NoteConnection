import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type EvaluateMode = 'unexpected-only' | 'strict';

type LfsAssetPolicyResult = {
  protectedTrackedPaths: string[];
  unexpectedProtectedPaths: string[];
  legacyProtectedPaths: string[];
  strictViolations: string[];
};

type LfsAssetPolicyModule = {
  PROTECTED_LFS_ROOTS: string[];
  LEGACY_ALLOWED_PROTECTED_LFS_PATHS: string[];
  evaluateLfsAssetPolicy: (options: {
    gitattributesText?: string;
    lfsLsFilesText?: string;
    existingRepoPaths?: string[];
    mode?: EvaluateMode;
  }) => LfsAssetPolicyResult;
};

describe('LFS asset policy contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const gitattributesPath = path.join(repoRoot, '.gitattributes');
  const deadNodeSidecarPath = path.join(
    repoRoot,
    'src-tauri',
    'bin',
    'node-x86_64-pc-windows-msvc.exe'
  );
  const deadGraphPayloadPaths = [
    path.join(repoRoot, 'src', 'frontend', 'data.js'),
    path.join(repoRoot, 'src', 'frontend', 'graph_data.json'),
  ];
  const policyUtilsPath = path.join(repoRoot, 'scripts', 'lfs-asset-policy-utils.js');
  let policyUtils: LfsAssetPolicyModule;

  function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  }

  beforeAll(() => {
    policyUtils = require(policyUtilsPath) as LfsAssetPolicyModule;
  });

  test('repository head no longer keeps removed LFS residues for dead node sidecar or bundled graph payloads', () => {
    const gitattributes = fs.readFileSync(gitattributesPath, 'utf8');
    expect(gitattributes).not.toContain('src-tauri/bin/node-x86_64-pc-windows-msvc.exe');
    expect(gitattributes).not.toContain('src/frontend/data.js');
    expect(gitattributes).not.toContain('src/frontend/graph_data.json');
    expect(fs.existsSync(deadNodeSidecarPath)).toBe(false);
    deadGraphPayloadPaths.forEach((filePath) => {
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  test('unexpected-only mode tolerates current legacy protected entries while keeping protected roots explicit', () => {
    const result = policyUtils.evaluateLfsAssetPolicy({
      gitattributesText: [
        'src-tauri/bin/server-x86_64-pc-windows-msvc.exe filter=lfs diff=lfs merge=lfs -text',
        'src-tauri/bin/server-x86_64-unknown-linux-gnu filter=lfs diff=lfs merge=lfs -text',
        'src-tauri/bin/server-aarch64-apple-darwin filter=lfs diff=lfs merge=lfs -text',
        'src-tauri/bin/godot-x86_64-pc-windows-msvc.exe filter=lfs diff=lfs merge=lfs -text',
        'assets/demo-large.zip filter=lfs diff=lfs merge=lfs -text',
      ].join('\n'),
      lfsLsFilesText: [
        'bbbbbbbbbb - src-tauri/bin/server-x86_64-unknown-linux-gnu',
      ].join('\n'),
      mode: 'unexpected-only',
    });

    expect(policyUtils.PROTECTED_LFS_ROOTS).toEqual(['src/frontend/', 'src-tauri/bin/']);
    expect(result.unexpectedProtectedPaths).toEqual([]);
    expect(result.legacyProtectedPaths).toEqual([
      'src-tauri/bin/godot-x86_64-pc-windows-msvc.exe',
      'src-tauri/bin/server-aarch64-apple-darwin',
      'src-tauri/bin/server-x86_64-pc-windows-msvc.exe',
      'src-tauri/bin/server-x86_64-unknown-linux-gnu',
    ]);
  });

  test('unexpected-only mode flags new protected LFS paths outside the approved legacy allowlist', () => {
    const result = policyUtils.evaluateLfsAssetPolicy({
      gitattributesText: [
        'src-tauri/bin/new-helper.exe filter=lfs diff=lfs merge=lfs -text',
      ].join('\n'),
      mode: 'unexpected-only',
    });

    expect(result.unexpectedProtectedPaths).toEqual(['src-tauri/bin/new-helper.exe']);
  });

  test('unexpected-only mode now treats bundled graph payload LFS paths as drift to be removed', () => {
    const result = policyUtils.evaluateLfsAssetPolicy({
      gitattributesText: [
        'src/frontend/data.js filter=lfs diff=lfs merge=lfs -text',
        'src/frontend/graph_data.json filter=lfs diff=lfs merge=lfs -text',
      ].join('\n'),
      mode: 'unexpected-only',
    });

    expect(result.unexpectedProtectedPaths).toEqual([
      'src/frontend/data.js',
      'src/frontend/graph_data.json',
    ]);
  });

  test('deleted working-tree residues listed by git lfs ls-files are ignored once the rule and file are gone', () => {
    const result = policyUtils.evaluateLfsAssetPolicy({
      gitattributesText: '',
      lfsLsFilesText: 'aaaaaaaaaa - src-tauri/bin/node-x86_64-pc-windows-msvc.exe',
      existingRepoPaths: [],
      mode: 'unexpected-only',
    });

    expect(result.protectedTrackedPaths).toEqual([]);
    expect(result.unexpectedProtectedPaths).toEqual([]);
  });

  test('strict mode is ready for the future no-LFS end state', () => {
    const result = policyUtils.evaluateLfsAssetPolicy({
      gitattributesText: 'src/frontend/data.js filter=lfs diff=lfs merge=lfs -text',
      mode: 'strict',
    });

    expect(result.strictViolations).toEqual(['src/frontend/data.js']);
  });

  test('package scripts expose local policy verification and future strict mode', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    const scripts = packageJson.scripts || {};

    expect(scripts['verify:lfs:policy']).toBe(
      'node scripts/verify-lfs-asset-policy.js'
    );
    expect(scripts['verify:lfs:policy:strict']).toBe(
      'node scripts/verify-lfs-asset-policy.js --strict'
    );
  });

  test('legacy allowlist no longer preserves the unused node sidecar path', () => {
    expect(policyUtils.LEGACY_ALLOWED_PROTECTED_LFS_PATHS).not.toContain(
      'src-tauri/bin/node-x86_64-pc-windows-msvc.exe'
    );
    expect(policyUtils.LEGACY_ALLOWED_PROTECTED_LFS_PATHS).not.toContain(
      'src/frontend/data.js'
    );
    expect(policyUtils.LEGACY_ALLOWED_PROTECTED_LFS_PATHS).not.toContain(
      'src/frontend/graph_data.json'
    );
  });

  test('current legacy LFS scope is limited to desktop binary placeholders rather than markdown-worker or bridge source', () => {
    const gitattributes = fs.readFileSync(gitattributesPath, 'utf8');
    const tracked = policyUtils.evaluateLfsAssetPolicy({
      gitattributesText: gitattributes,
      mode: 'unexpected-only',
    });

    expect(tracked.legacyProtectedPaths).toEqual([
      'src-tauri/bin/godot-x86_64-pc-windows-msvc.exe',
      'src-tauri/bin/server-aarch64-apple-darwin',
      'src-tauri/bin/server-x86_64-pc-windows-msvc.exe',
      'src-tauri/bin/server-x86_64-unknown-linux-gnu',
    ]);
    expect(gitattributes).not.toContain('src-tauri/bin/markdown-worker');
    expect(gitattributes).not.toContain('src/core/PathBridge.ts');
  });
});
