import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const verifier = require(path.resolve(__dirname, '..', 'scripts', 'verify-mobile-native-recovery.js')) as {
    runRecoveryVerification: (options?: { outputPath?: string }) => {
        evidenceLevel: string;
        nativeDeviceEvidence: boolean;
        scenarios: Array<{ name: string; action: string; status: string; backupExists?: boolean; journalExists?: boolean }>;
        outputPath: string;
    };
};

describe('mobile native recovery state-machine contract', () => {
    test('replays all journal phases and fail-closed cases without claiming native evidence', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-recovery-contract-'));
        const outputPath = path.join(root, 'report.json');
        try {
            const evidence = verifier.runRecoveryVerification({ outputPath });

            expect(evidence.evidenceLevel).toBe('host-recovery-state-machine');
            expect(evidence.nativeDeviceEvidence).toBe(false);
            expect(evidence.scenarios).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'staging-target-wins', action: 'target-preserved' }),
                expect.objectContaining({ name: 'backup-restored', action: 'previous-restored' }),
                expect.objectContaining({ name: 'backup-rename-retry', action: 'recovery-pending', backupExists: true, journalExists: true }),
                expect.objectContaining({ name: 'activated-target-wins', action: 'target-preserved' }),
                expect.objectContaining({ name: 'orphan-backup-restored', action: 'orphan-backup-restored' }),
                expect.objectContaining({ name: 'orphan-backup-retry', action: 'orphan-recovery-pending', backupExists: true }),
                expect.objectContaining({ name: 'unsafe-journal-rejected', action: 'unsafe_import_journal' }),
                expect.objectContaining({ name: 'unknown-schema-rejected', action: 'invalid_import_journal' }),
            ]));
            expect(JSON.parse(fs.readFileSync(outputPath, 'utf8')).scenarios).toHaveLength(8);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
