import * as fs from 'fs';
import * as path from 'path';

const browserTestWindow = {};
(globalThis as any).window = browserTestWindow;
const storageProvider = require('./frontend/storage_provider.js') as {
  createProvider: (options?: { runtimeCaps?: Record<string, unknown> }) => {
    getStorageResolution: () => Record<string, unknown>;
    refreshStorageResolution: () => Promise<Record<string, unknown>>;
  };
};

describe('storage provider abstraction contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const storageProviderPath = path.join(repoRoot, 'src', 'frontend', 'storage_provider.js');

  test('exposes NoteConnectionStorage provider factory', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('window.NoteConnectionStorage = {');
    expect(source).toContain('createProvider');
    expect(source).toContain('class RuntimeStorageProvider');
    expect(source).toContain('getStorageResolution()');
    expect(source).toContain('async refreshStorageResolution()');
    expect(source).toContain("sidecarFetchJson('api/knowledge/store-diagnostics')");
    expect(source).toContain('supportsProjection');
  });

  test('forces projection resolution on Android even when a stale SQLite capability is reported', () => {
    const provider = storageProvider.createProvider({
      runtimeCaps: {
        platform: 'android',
        supports_projection_store: true,
        supports_sqlite: true,
        storage_requested_provider: 'sqlite',
        storage_resolved_provider: 'sqlite',
      },
    });

    expect(provider.getStorageResolution()).toEqual(expect.objectContaining({
      requestedProvider: 'sqlite',
      resolvedProvider: 'projection',
      fallbackReason: 'native_sqlite_runtime_unavailable',
      supportsSqlite: false,
      supportsProjection: true,
    }));
  });

  test('forces projection resolution for an iOS/mobile host without Capacitor globals', () => {
    const provider = storageProvider.createProvider({
      runtimeCaps: {
        platform: 'ios',
        supports_projection_store: true,
        supports_sqlite: true,
        storage_requested_provider: 'sqlite',
        storage_resolved_provider: 'sqlite',
      },
    });

    expect(provider.getStorageResolution()).toEqual(expect.objectContaining({
      requestedProvider: 'sqlite',
      resolvedProvider: 'projection',
      fallbackReason: 'native_sqlite_runtime_unavailable',
      supportsSqlite: false,
      supportsProjection: true,
    }));
  });

  test('keeps SQLite as the desktop default and exposes file fallback explicitly', () => {
    const sqliteProvider = storageProvider.createProvider({
      runtimeCaps: {
        platform: 'win32',
        supports_sidecar: true,
        supports_sqlite: true,
        storage_resolved_provider: 'sqlite',
      },
    });
    expect(sqliteProvider.getStorageResolution()).toEqual(expect.objectContaining({
      requestedProvider: 'sqlite',
      resolvedProvider: 'sqlite',
      supportsSqlite: true,
    }));

    const fallbackProvider = storageProvider.createProvider({
      runtimeCaps: {
        platform: 'linux',
        supports_sidecar: false,
        supports_sqlite: false,
        storage_requested_provider: 'sqlite',
        storage_resolved_provider: 'file',
        storage_fallback_reason: 'sqlite_runtime_unavailable',
      },
    });
    expect(fallbackProvider.getStorageResolution()).toEqual(expect.objectContaining({
      requestedProvider: 'sqlite',
      resolvedProvider: 'file',
      fallbackReason: 'sqlite_runtime_unavailable',
      supportsSqlite: false,
      supportsProjection: false,
    }));
  });

  test('does not treat desktop capability support as an active SQLite resolution before diagnostics', () => {
    const provider = storageProvider.createProvider({
      runtimeCaps: {
        platform: 'win32',
        supports_sidecar: true,
        supports_sqlite: true,
        storage_requested_provider: 'sqlite',
        storage_resolved_provider: 'unknown',
      },
    });

    expect(provider.getStorageResolution()).toEqual(expect.objectContaining({
      requestedProvider: 'sqlite',
      resolvedProvider: undefined,
      supportsSqlite: false,
    }));
  });

  test('refreshes desktop resolution from authoritative sidecar diagnostics', async () => {
    const previousWindow = (globalThis as any).window;
    const previousFetch = (globalThis as any).fetch;
    const runtimeWindow = {
      NoteConnectionRuntime: {
        buildUrl: (resourcePath: string) => `http://127.0.0.1:3000/${resourcePath}`,
        buildFetchOptions: () => ({ cache: 'no-store' }),
      },
    };
    (globalThis as any).window = runtimeWindow;
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        store: {
          requestedProvider: 'sqlite',
          resolvedProvider: 'file',
          storageEngine: 'file',
          fallbackReason: 'sqlite_runtime_unavailable',
        },
      }),
    });

    try {
      const provider = storageProvider.createProvider({
        runtimeCaps: {
          platform: 'win32',
          supports_sidecar: true,
          supports_sqlite: true,
          storage_requested_provider: 'sqlite',
          storage_resolved_provider: 'sqlite',
        },
      });

      await expect(provider.refreshStorageResolution()).resolves.toEqual(expect.objectContaining({
        requestedProvider: 'sqlite',
        resolvedProvider: 'file',
        fallbackReason: 'sqlite_runtime_unavailable',
        supportsSqlite: false,
      }));
      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3000/api/knowledge/store-diagnostics',
        { cache: 'no-store' }
      );
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).fetch = previousFetch;
    }
  });

  test('supports sidecar, tauri, and read-only capability branches', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('if (this._supportsSidecar()) {');
    expect(source).toContain("this._invoke('get_kb_path')");
    expect(source).toContain("this._invoke('build_graph_runtime'");
    expect(source).toContain('isCapacitorNativeRuntime()');
    expect(source).toContain('getCapacitorFilesystemPlugin()');
    expect(source).toContain('ensureCapacitorFilesystemPermission');
    expect(source).toContain('normalizeCapacitorPath');
    expect(source).toContain('createMobileResourceIdentity');
    expect(source).toContain('canonicalMobileNodeIdFromIdentity');
    expect(source).toContain('NoteConnectionMobileIdentity');
    expect(source).toContain('extractMarkdownLinks');
    expect(source).toContain('sourceUri: file.sourceUri ||');
    expect(source).toContain('canonicalId: file.canonicalId ||');
    expect(source).toContain('identityAliases: Array.isArray(file.identityAliases)');
    expect(source).toContain('Capacitor graph contains duplicate legacy node id');
    expect(source).toContain('extractRelativePathFromKbMarker');
    expect(source).toContain('resolveCapacitorContentCandidatePath');
    expect(source).toContain('async function capacitorReadText(pathValue, options)');
    expect(source).toContain('async function capacitorBuildGraph(requestPayload, runtimeCaps)');
    expect(source).toContain('function resolveCapacitorBuildModeDetail(buildMode, runtimeCaps)');
    expect(source).toContain('supportsCapacitorGraphBuildWorker');
    expect(source).toContain('runCapacitorGraphBuildWorker');
    expect(source).toContain('buildCapacitorGraphDataWithWorkerFallback');
    expect(source).toContain('CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS');
    expect(source).toContain("buildMode: 'single-thread-fallback'");
    expect(source).toContain("buildMode: 'worker'");
    expect(source).toContain('var linkedFile = resolveReference(file, rawLink, referenceIndex);');
    expect(source).toContain('addEdge(sourceId, linkedFile && linkedFile.id, "wiki-link")');
    expect(source).toContain('function buildCapacitorReferenceIndex(files)');
    expect(source).toContain('Capacitor graph contains an ambiguous legacy basename');
    expect(source).toContain('sourceUri: sourceNode && sourceNode.sourceUri');
    expect(source).toContain("const result = await capacitorBuildGraph(requestPayload || {}, this.runtimeCaps || {});");
    expect(source).toContain('buildModeDetail: resolveCapacitorBuildModeDetail(buildResult.buildMode, runtimeCaps || {})');
    expect(source).toContain('supportsMobileWasmCompute');
    expect(source).toContain('mobileWasmReason');
    expect(source).toContain("unsupportedOperationError('buildGraph')");
    expect(source).toContain('storage_requested_provider');
    expect(source).toContain('storage_resolved_provider');
    expect(source).toContain('storage_fallback_reason');
  });

  test('defines core storage operations used by source manager and reader', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('async getKbPath()');
    expect(source).toContain('async listFolders()');
    expect(source).toContain('async listAvailableTargets()');
    expect(source).toContain('async checkCache(target)');
    expect(source).toContain('async restoreCache(target)');
    expect(source).toContain('async buildGraph(requestPayload)');
    expect(source).toContain('async readContent(filePath)');
    expect(source).toContain('const capacitorPath = resolveCapacitorContentCandidatePath(filePath);');
    expect(source).toContain('return await capacitorReadText(capacitorPath, {');
    expect(source).toContain('async setKbPath(kbPath)');
    expect(source).toContain('async readGeneratedAsset(filename)');
  });
});
