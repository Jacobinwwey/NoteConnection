import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    getMissingRequiredWasmParityExports,
    probeWasmParityArtifact,
    REQUIRED_WASM_PARITY_EXPORTS
} from './backend/algorithms/WasmParityArtifactProbe';
import { WasmParityRuntime } from './backend/algorithms/WasmParityRuntime';

describe('wasm parity artifact probe contract', () => {
    test('detects missing required exports from export list', () => {
        const missing = getMissingRequiredWasmParityExports(['alloc', 'memory']);
        expect(missing).toEqual([
            'compute_layout_json',
            'compute_betweenness_json',
            'compute_cycles_json',
            'compute_ranks_json',
            'get_last_result_len',
            'dealloc'
        ]);
    });

    test('returns artifact-not-found when no artifact path can be resolved', async () => {
        const resolveArtifactPathSpy = jest
            .spyOn(WasmParityRuntime, 'resolveArtifactPath')
            .mockReturnValue(null);
        try {
            const result = await probeWasmParityArtifact('');
            expect(result.ready).toBe(false);
            expect(result.exists).toBe(false);
            expect(result.error).toBe('artifact-not-found');
            expect(result.requiredExports).toEqual(REQUIRED_WASM_PARITY_EXPORTS);
        } finally {
            resolveArtifactPathSpy.mockRestore();
        }
    });

    test('returns path-not-found for explicit missing file', async () => {
        const missingPath = path.join(os.tmpdir(), `missing-wasm-${Date.now()}.wasm`);
        const result = await probeWasmParityArtifact(missingPath);
        expect(result.ready).toBe(false);
        expect(result.exists).toBe(false);
        expect(result.error).toBe('artifact-path-not-found');
        expect(result.artifactPath).toBe(missingPath);
    });

    test('returns non-ready result when wasm bytes cannot be instantiated', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-wasm-probe-'));
        const invalidWasmPath = path.join(tempDir, 'invalid.wasm');
        fs.writeFileSync(invalidWasmPath, Buffer.from([0x00, 0x61, 0x62, 0x63]), 'binary');

        try {
            const result = await probeWasmParityArtifact(invalidWasmPath);
            expect(result.exists).toBe(true);
            expect(result.ready).toBe(false);
            expect(typeof result.error).toBe('string');
            expect(result.missingExports.length).toBe(REQUIRED_WASM_PARITY_EXPORTS.length);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
