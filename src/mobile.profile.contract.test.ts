import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { resolvePlatformCapabilities } from './platform/PlatformCapabilities';
import { resolveRenderMaterializationDecision } from './platform/RenderMaterializer';

type MobileExactAnalyzer = {
  createMobileExactIndex: (graph: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  }) => {
    searchExact: (term: string, limit?: number) => Array<{ id: string }>;
    neighbors: (nodeId: string, limit?: number) => Array<{ id: string }>;
    shortestPath: (
      sourceNodeId: string,
      targetNodeId: string,
      maxDepth?: number,
      maxVisitedNodes?: number
    ) => string[] | null;
    statistics: () => { nodeCount: number; edgeCount: number };
  };
};

type MobileBudgetVerifier = {
  assertMobileSlimBudget: (options: {
    stagingDir: string;
    assetBudgetBytes: number;
    maxResidentBytes: number;
    rssEvidencePath?: string;
  }) => {
    compressedBytes: number;
    fileCount: number;
  };
};

describe('mobile-slim profile contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const analyzerPath = path.join(repoRoot, 'src', 'frontend', 'mobile_exact_analyzer.js');
  const verifierPath = path.join(repoRoot, 'scripts', 'verify-mobile-slim-budget.js');
  const preparePath = path.join(repoRoot, 'scripts', 'prepare-mobile-slim.js');

  test('declares sidecar-free local analysis with optional remote inference and hard budgets', () => {
    const capabilities = resolvePlatformCapabilities({ exportProfileId: 'mobile-slim' }) as unknown as {
      retrieval: {
        supportsSidecar: boolean;
        supportsLocalIngest: boolean;
        supportsLocalExactQuery: boolean;
        supportsRemoteInference: boolean;
        requiresRemoteInference: boolean;
      };
      export: {
        assetBudgetBytes: number;
        maxResidentBytes: number;
      };
    };

    expect(capabilities.retrieval.supportsSidecar).toBe(false);
    expect(capabilities.retrieval.supportsLocalIngest).toBe(true);
    expect(capabilities.retrieval.supportsLocalExactQuery).toBe(true);
    expect(capabilities.retrieval.supportsRemoteInference).toBe(true);
    expect(capabilities.retrieval.requiresRemoteInference).toBe(false);
    expect(capabilities.export.assetBudgetBytes).toBe(25 * 1024 * 1024);
    expect(capabilities.export.maxResidentBytes).toBe(256 * 1024 * 1024);
  });

  test('rejects SVG materialization for mobile even when explicitly requested', () => {
    const decision = resolveRenderMaterializationDecision({
      exportProfileId: 'mobile-slim',
      includeSvg: true,
      includeStages: true,
      rendererPreference: 'frontend',
    });

    expect(decision.includeSvg).toBe(false);
    expect(decision.vectorSuppressed).toBe(true);
    expect(decision.responseArtifact).toBe('png');
    expect(decision.rendererPreference).toBe('local');
  });

  test('ships a callable bounded exact graph analyzer without retaining document bodies', () => {
    expect(fs.existsSync(analyzerPath)).toBe(true);
    const analyzer = require(analyzerPath) as MobileExactAnalyzer;
    const index = analyzer.createMobileExactIndex({
      nodes: [
        { id: 'fundamentals/alpha', label: 'Alpha', content: 'must not be retained' },
        { id: 'fundamentals/beta', label: 'Beta', metadata: { tags: ['core'] } },
        { id: 'advanced/gamma', label: 'Gamma' },
      ],
      edges: [
        { source: 'fundamentals/alpha', target: 'fundamentals/beta', type: 'prerequisite' },
        { source: 'fundamentals/beta', target: 'advanced/gamma', type: 'next' },
      ],
    });

    expect(index.searchExact('beta')).toEqual([
      expect.objectContaining({ id: 'fundamentals/beta' }),
    ]);
    expect(index.searchExact('core')).toEqual([
      expect.objectContaining({ id: 'fundamentals/beta' }),
    ]);
    expect(index.neighbors('fundamentals/beta')).toEqual([
      expect.objectContaining({ id: 'advanced/gamma' }),
      expect.objectContaining({ id: 'fundamentals/alpha' }),
    ]);
    expect(index.shortestPath('fundamentals/alpha', 'advanced/gamma')).toEqual([
      'fundamentals/alpha',
      'fundamentals/beta',
      'advanced/gamma',
    ]);
    expect(index.statistics()).toEqual({ nodeCount: 3, edgeCount: 2 });
    expect(JSON.stringify(index.searchExact('alpha'))).not.toContain('must not be retained');
  });

  test('normalizes exact lookup keys independently of the device locale', () => {
    const analyzerSource = fs.readFileSync(analyzerPath, 'utf8');
    const analyzer = require(analyzerPath) as MobileExactAnalyzer;
    const index = analyzer.createMobileExactIndex({
      nodes: [{ id: 'unicode-i', label: '\u0130' }],
      edges: [],
    });

    expect(analyzerSource).not.toContain('.toLocaleLowerCase(');
    expect(index.searchExact('i\u0307')).toEqual([
      expect.objectContaining({ id: 'unicode-i' }),
    ]);
  });

  test('does not cross the requested visited-node ceiling during path traversal', () => {
    const analyzer = require(analyzerPath) as MobileExactAnalyzer;
    const index = analyzer.createMobileExactIndex({
      nodes: [
        { id: 'source' },
        { id: 'first-branch' },
        { id: 'target' },
      ],
      edges: [
        { source: 'source', target: 'first-branch' },
        { source: 'source', target: 'target' },
      ],
    });

    expect(index.shortestPath('source', 'target', 2, 2)).toBeNull();
  });

  test('exposes exact query and path operations through the runtime storage boundary', () => {
    const storageProvider = fs.readFileSync(
      path.join(repoRoot, 'src', 'frontend', 'storage_provider.js'),
      'utf8'
    );
    const indexHtml = fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'index.html'), 'utf8');
    const analyzerScriptOffset = indexHtml.indexOf('<script src="mobile_exact_analyzer.js"></script>');
    const storageScriptOffset = indexHtml.indexOf('<script src="storage_provider.js"></script>');

    expect(storageProvider).toContain('async queryKnowledgeBaseExact(request)');
    expect(storageProvider).toContain('async findKnowledgePath(request)');
    expect(storageProvider).toContain("this.readGeneratedAsset('graph_data.json')");
    expect(analyzerScriptOffset).toBeGreaterThan(-1);
    expect(analyzerScriptOffset).toBeLessThan(storageScriptOffset);
  });

  test('fails closed for oversized, forbidden, and over-RSS mobile staging evidence', () => {
    expect(fs.existsSync(verifierPath)).toBe(true);
    const verifier = require(verifierPath) as MobileBudgetVerifier;
    const fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.mobile-slim-contract-'));

    try {
      fs.writeFileSync(path.join(fixtureRoot, 'index.html'), crypto.randomBytes(2048));
      expect(() => verifier.assertMobileSlimBudget({
        stagingDir: fixtureRoot,
        assetBudgetBytes: 128,
        maxResidentBytes: 1024,
      })).toThrow(/compressed payload/i);

      fs.rmSync(path.join(fixtureRoot, 'index.html'));
      fs.writeFileSync(path.join(fixtureRoot, 'server-aarch64-linux'), 'forbidden');
      expect(() => verifier.assertMobileSlimBudget({
        stagingDir: fixtureRoot,
        assetBudgetBytes: 4096,
        maxResidentBytes: 1024,
      })).toThrow(/forbidden mobile artifact/i);

      fs.rmSync(path.join(fixtureRoot, 'server-aarch64-linux'));
      fs.writeFileSync(path.join(fixtureRoot, 'index.html'), 'ok');
      const rssEvidencePath = path.join(fixtureRoot, 'rss-evidence.json');
      fs.writeFileSync(rssEvidencePath, JSON.stringify({ peakResidentBytes: 2048 }));
      expect(() => verifier.assertMobileSlimBudget({
        stagingDir: fixtureRoot,
        assetBudgetBytes: 4096,
        maxResidentBytes: 1024,
        rssEvidencePath,
      })).toThrow(/peak RSS/i);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('routes both Android packagers through the deterministic mobile staging directory', () => {
    expect(fs.existsSync(preparePath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const capacitorConfig = fs.readFileSync(path.join(repoRoot, 'capacitor.config.ts'), 'utf8');
    const capacitorBuild = fs.readFileSync(path.join(repoRoot, 'build_apk.bat'), 'utf8');
    const tauriAndroidConfig = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'src-tauri', 'tauri.android.conf.json'), 'utf8')
    ) as { build?: { frontendDist?: string }; bundle?: { externalBin?: string[] } };

    expect(pkg.scripts['mobile:prepare:slim']).toContain('prepare-mobile-slim.js');
    expect(pkg.scripts['mobile:prepare:slim']).toContain('verify-mobile-slim-budget.js');
    expect(pkg.scripts['tauri:android:init']).toContain('mobile:prepare:slim');
    expect(pkg.scripts['verify:mobile:slim:budget']).toContain('verify-mobile-slim-budget.js');
    expect(pkg.scripts['tauri:android:build']).toContain('mobile:prepare:slim');
    expect(pkg.scripts['tauri:android:build']).not.toContain('build:sidecar');
    expect(capacitorConfig).toContain('NOTE_CONNECTION_MOBILE_WEB_DIR');
    expect(capacitorBuild).toContain('npm run mobile:prepare:slim');
    expect(capacitorBuild).toContain('NOTE_CONNECTION_MOBILE_WEB_DIR');
    expect(tauriAndroidConfig.build?.frontendDist).toBe('../dist/mobile-slim/frontend');
    expect(tauriAndroidConfig.bundle?.externalBin).toEqual([]);
  });

  test('keeps Godot Android integration explicit instead of enabling it in mobile-slim', () => {
    const runner = fs.readFileSync(path.join(repoRoot, 'scripts', 'run-tauri-android.js'), 'utf8');
    const patcher = fs.readFileSync(path.join(repoRoot, 'scripts', 'apply-tauri-android-pathmode.js'), 'utf8');

    expect(runner).toContain('NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE');
    expect(runner).toContain("runPathmodePatch({ mode: 'disable'");
    expect(patcher).toContain("process.argv.includes('--disable')");
    expect(patcher).toContain('removePathmodeAssets');
  });
});
