import * as fs from 'fs';
import * as path from 'path';

describe('storage provider abstraction contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const storageProviderPath = path.join(repoRoot, 'src', 'frontend', 'storage_provider.js');

  test('exposes NoteConnectionStorage provider factory', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('window.NoteConnectionStorage = {');
    expect(source).toContain('createProvider');
    expect(source).toContain('class RuntimeStorageProvider');
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
