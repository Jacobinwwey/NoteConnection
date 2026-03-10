import * as fs from 'fs';
import { WasmParityRuntime } from './WasmParityRuntime';

export const REQUIRED_WASM_PARITY_EXPORTS = [
    'compute_layout_json',
    'compute_betweenness_json',
    'compute_cycles_json',
    'compute_ranks_json',
    'get_last_result_len',
    'alloc',
    'dealloc',
    'memory'
] as const;

export type RequiredWasmParityExport = typeof REQUIRED_WASM_PARITY_EXPORTS[number];

export interface WasmParityArtifactProbeResult {
    artifactPath: string | null;
    exists: boolean;
    exportNames: string[];
    requiredExports: readonly RequiredWasmParityExport[];
    missingExports: string[];
    ready: boolean;
    error: string | null;
}

export function getMissingRequiredWasmParityExports(exportNames: string[]): string[] {
    const available = new Set(exportNames);
    return REQUIRED_WASM_PARITY_EXPORTS.filter((name) => !available.has(name));
}

function createBaseProbeResult(artifactPath: string | null): WasmParityArtifactProbeResult {
    return {
        artifactPath,
        exists: false,
        exportNames: [],
        requiredExports: REQUIRED_WASM_PARITY_EXPORTS,
        missingExports: [...REQUIRED_WASM_PARITY_EXPORTS],
        ready: false,
        error: null
    };
}

export async function probeWasmParityArtifact(explicitPath?: string | null): Promise<WasmParityArtifactProbeResult> {
    const trimmed = typeof explicitPath === 'string' ? explicitPath.trim() : '';
    const artifactPath = trimmed || WasmParityRuntime.resolveArtifactPath();
    const result = createBaseProbeResult(artifactPath || null);

    if (!artifactPath) {
        result.error = 'artifact-not-found';
        return result;
    }

    if (!fs.existsSync(artifactPath)) {
        result.error = 'artifact-path-not-found';
        return result;
    }

    result.exists = true;

    try {
        const bytes = await fs.promises.readFile(artifactPath);
        const instanceResult = await WebAssembly.instantiate(bytes, {});
        const exportNames = Object.keys(instanceResult.instance.exports || {});
        const missing = getMissingRequiredWasmParityExports(exportNames);
        result.exportNames = exportNames;
        result.missingExports = missing;
        result.ready = missing.length === 0;
        if (!result.ready) {
            result.error = 'missing-required-exports';
        }
        return result;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        return result;
    }
}
