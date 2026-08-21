import * as fs from 'fs';
import * as path from 'path';

describe('versioned identity corpus manifest', () => {
    const manifestPath = path.resolve(process.cwd(), 'config', 'identity-corpus.v1.json');
    const verifierPath = path.resolve(process.cwd(), 'scripts', 'verify-identity-corpus.js');

    test('declares the complete G4 corpus and keeps compatibility cutover frozen', () => {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            schemaVersion: number;
            corpusId: string;
            requiredCases: string[];
            requiredProjectionHosts: string[];
            compatibility: Record<string, boolean>;
            gates: Record<string, string>;
        };
        expect(manifest.schemaVersion).toBe(1);
        expect(manifest.corpusId).toBe('noteconnection-identity-g4-v1');
        expect(manifest.requiredCases).toEqual(expect.arrayContaining([
            'legacy_snapshot_restore',
            'same_content_isolation',
            'cross_root_nfc_identity',
            'nfc_case_collision_rejection',
            'move_journal_restart_alias_delete',
            'mixed_batch_rollback',
            'four_owner_convergence',
            'upsert_alias_collision_rejection',
        ]));
        expect(manifest.requiredProjectionHosts).toEqual(['web', 'tauri', 'capacitor', 'android']);
        expect(manifest.compatibility).toEqual({
            publicIdsChanged: false,
            snapshotSchemaChanged: false,
            projectionSchemaChanged: false,
            mobileRuntimeChanged: false,
        });
        expect(manifest.gates.canonicalPublicIdCutover).toContain('blocked');
    });

    test('verifier reports host-code evidence separately from native evidence', () => {
        const verifier = fs.readFileSync(verifierPath, 'utf8');
        expect(verifier).toContain("require('ts-node/register/transpile-only')");
        expect(verifier).toContain("evidenceLevel: 'host-code-replay'");
        expect(verifier).toContain('nativeDeviceEvidence: false');
        expect(verifier).toContain("canonicalPublicIdCutover: 'blocked'");
        expect(verifier).toContain('verify-mobile-projection-replay.js');
    });
});
