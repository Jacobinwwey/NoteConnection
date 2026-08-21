import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import {
  MOBILE_LOW_ARTIFACT_BUDGET_BYTES,
  MOBILE_LOW_MAX_DEVICE_RAM_BYTES,
  MOBILE_LOW_MAX_RESIDENT_BYTES,
} from './platform/MobileBudget';

describe('versioned mobile budget contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const contractPath = path.join(repoRoot, 'config', 'mobile-budget.v1.json');
  const contractModulePath = path.join(repoRoot, 'scripts', 'mobile-budget-contract.js');
  const slimVerifierPath = path.join(repoRoot, 'scripts', 'verify-mobile-slim-budget.js');
  const artifactVerifierPath = path.join(repoRoot, 'scripts', 'verify-mobile-artifact.js');
  const preparePath = path.join(repoRoot, 'scripts', 'prepare-mobile-slim.js');
  const runtimeProjectionPath = path.join(repoRoot, 'src', 'frontend', 'mobile_budget_runtime.js');

  test('declares matching low and standard artifact/RSS profiles plus runtime limits', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as {
      schemaVersion: number;
      contractSha256: string;
      profiles: Record<string, { artifactCompressedBytes: number; maxResidentBytes: number; maxDeviceRamBytes: number }>;
      runtime: Record<string, number>;
    };
    const loaded = require(contractModulePath) as {
      MOBILE_BUDGET_CONTRACT: typeof contract;
    };
    const slimVerifier = require(slimVerifierPath) as {
      DEFAULT_ASSET_BUDGET_BYTES: number;
      DEFAULT_MAX_RESIDENT_BYTES: number;
    };
    const artifactVerifier = require(artifactVerifierPath) as {
      PROFILES: Record<string, { compressedBudgetBytes: number; maxResidentBytes: number; maxDeviceRamBytes: number }>;
    };

    expect(loaded.MOBILE_BUDGET_CONTRACT.schemaVersion).toBe(contract.schemaVersion);
    expect(loaded.MOBILE_BUDGET_CONTRACT.profiles).toEqual(contract.profiles);
    expect(loaded.MOBILE_BUDGET_CONTRACT.runtime).toEqual(contract.runtime);
    expect(loaded.MOBILE_BUDGET_CONTRACT.contractSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(slimVerifier.DEFAULT_ASSET_BUDGET_BYTES).toBe(contract.profiles['mobile-low'].artifactCompressedBytes);
    expect(slimVerifier.DEFAULT_MAX_RESIDENT_BYTES).toBe(contract.profiles['mobile-low'].maxResidentBytes);
    expect(artifactVerifier.PROFILES['mobile-low'].compressedBudgetBytes).toBe(
      contract.profiles['mobile-low'].artifactCompressedBytes
    );
    expect(artifactVerifier.PROFILES['mobile-standard'].maxResidentBytes).toBe(
      contract.profiles['mobile-standard'].maxResidentBytes
    );
    expect(artifactVerifier.PROFILES['mobile-low'].maxDeviceRamBytes).toBe(
      contract.profiles['mobile-low'].maxDeviceRamBytes
    );
  });

  test('persists runtime budgets into the slim manifest and keeps the contract outside the runtime bundle', () => {
    const prepareSource = fs.readFileSync(preparePath, 'utf8');
    expect(prepareSource).toContain("require('./mobile-budget-contract')");
    expect(prepareSource).toContain('contractSchemaVersion');
    expect(prepareSource).toContain('runtime: MOBILE_BUDGET_CONTRACT.runtime');
    expect(fs.readFileSync(contractPath, 'utf8')).not.toContain('mobile_exact_analyzer');
    expect(prepareSource).toContain("profile: 'mobile-low'");
    expect(prepareSource).toContain('contractSha256');
  });

  test('browser budget projection stays aligned with the versioned contract', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as {
      schemaVersion: number;
      profiles: Record<string, { artifactCompressedBytes: number; maxResidentBytes: number; maxDeviceRamBytes: number }>;
      runtime: Record<string, number>;
    };
    const context: Record<string, unknown> = {};
    vm.runInNewContext(fs.readFileSync(runtimeProjectionPath, 'utf8'), context);
    const runtime = (context as { NoteConnectionMobileBudget?: typeof contract }).NoteConnectionMobileBudget;
    expect(runtime?.schemaVersion).toBe(contract.schemaVersion);
    expect(runtime?.profiles).toEqual(contract.profiles);
    expect(runtime?.runtime).toEqual(contract.runtime);
    expect(MOBILE_LOW_ARTIFACT_BUDGET_BYTES).toBe(contract.profiles['mobile-low'].artifactCompressedBytes);
    expect(MOBILE_LOW_MAX_RESIDENT_BYTES).toBe(contract.profiles['mobile-low'].maxResidentBytes);
    expect(MOBILE_LOW_MAX_DEVICE_RAM_BYTES).toBe(contract.profiles['mobile-low'].maxDeviceRamBytes);
  });
});
