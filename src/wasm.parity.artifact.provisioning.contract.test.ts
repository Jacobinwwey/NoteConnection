import * as fs from 'fs';
import * as path from 'path';
import { probeWasmParityArtifact, REQUIRED_WASM_PARITY_EXPORTS } from './backend/algorithms/WasmParityArtifactProbe';

describe('wasm parity artifact provisioning contract', () => {
    test('provisioned artifact exists at canonical source path and is ready', async () => {
        const artifactPath = path.resolve(
            process.cwd(),
            'src',
            'backend',
            'wasm',
            'noteconnection_compute.wasm'
        );

        expect(fs.existsSync(artifactPath)).toBe(true);

        const probe = await probeWasmParityArtifact(artifactPath);
        expect(probe.artifactPath).toBe(artifactPath);
        expect(probe.exists).toBe(true);
        expect(probe.missingExports).toEqual([]);
        expect(probe.requiredExports).toEqual(REQUIRED_WASM_PARITY_EXPORTS);
        expect(probe.ready).toBe(true);
        expect(probe.error).toBeNull();
    });
});
