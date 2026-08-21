import * as fs from 'fs';
import * as path from 'path';

describe('capacitor bridge serialization contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const storageProviderPath = path.join(repoRoot, 'src', 'frontend', 'storage_provider.js');

  test('capacitor graph payload writes are chunked and bounded for bridge safety', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('CAPACITOR_BRIDGE_MAX_CHUNK_BYTES');
    expect(source).toContain('getMobileRuntimeBudget().maxProjectionBytes');
    expect(source).toContain('splitCapacitorPayloadIntoChunks');
    expect(source).toContain('writeCapacitorChunkSequenceToDirectory');
    expect(source).toContain('appendFile');
    expect(source).toContain('createCapacitorGraphDataJsonChunks');
    expect(source).toContain("serializationMode: 'chunked-bridge-json-stream'");
    expect(source).not.toContain('JSON.stringify(graphData, null, 2)');
  });
});
