import * as fs from 'fs';
import * as path from 'path';

type ArtifactVerifier = {
    verifyMobileArtifact: (options: {
        artifactPath: string;
        profile?: string;
        rssEvidencePath?: string;
        requireRss?: boolean;
    }) => {
        artifactKind: string;
        rssStatus: string;
        compressedPayloadBytes: number;
    };
};

function createStoredZip(entries: Array<{ name: string; content: Buffer }>): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let localOffset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const local = Buffer.alloc(30 + name.length + entry.content.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(0, 14);
        local.writeUInt32LE(entry.content.length, 18);
        local.writeUInt32LE(entry.content.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        name.copy(local, 30);
        entry.content.copy(local, 30 + name.length);
        localParts.push(local);

        const central = Buffer.alloc(46 + name.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(0, 16);
        central.writeUInt32LE(entry.content.length, 20);
        central.writeUInt32LE(entry.content.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(localOffset, 42);
        name.copy(central, 46);
        centralParts.push(central);
        localOffset += local.length;
    }
    const localData = Buffer.concat(localParts);
    const centralData = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralData.length, 12);
    eocd.writeUInt32LE(localData.length, 16);
    return Buffer.concat([localData, centralData, eocd]);
}

describe('mobile APK/AAB artifact verifier contract', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const verifier = require(path.join(repoRoot, 'scripts', 'verify-mobile-artifact.js')) as ArtifactVerifier;
    let fixtureRoot: string;

    beforeEach(() => {
        fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.tmp-mobile-artifact-'));
    });

    afterEach(() => {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('checks APK entries and requires RSS in release mode', () => {
        const artifactPath = path.join(fixtureRoot, 'app-arm64-v8a.apk');
        const rssPath = path.join(fixtureRoot, 'rss.json');
        fs.writeFileSync(artifactPath, createStoredZip([
            { name: 'assets/index.html', content: Buffer.from('<html />') },
            { name: 'lib/arm64-v8a/libnoteconnection.so', content: Buffer.from('runtime') },
        ]));
        fs.writeFileSync(rssPath, JSON.stringify({ peakResidentBytes: 128 * 1024 * 1024 }));

        const result = verifier.verifyMobileArtifact({
            artifactPath,
            profile: 'mobile-low',
            rssEvidencePath: rssPath,
            requireRss: true,
        });

        expect(result.artifactKind).toBe('apk');
        expect(result.rssStatus).toBe('within-budget');
        expect((result as { hasArm64Payload?: boolean }).hasArm64Payload).toBe(true);
        expect(result.compressedPayloadBytes).toBeGreaterThan(0);
    });

    test('rejects forbidden runtime entries and missing release RSS evidence', () => {
        const artifactPath = path.join(fixtureRoot, 'app.aab');
        fs.writeFileSync(artifactPath, createStoredZip([
            { name: 'assets/models/tiny.gguf', content: Buffer.from('model') },
        ]));

        expect(() => verifier.verifyMobileArtifact({ artifactPath, profile: 'mobile-standard' }))
            .toThrow(/Forbidden mobile artifact entries/);

        const cleanArtifactPath = path.join(fixtureRoot, 'clean.aab');
        fs.writeFileSync(cleanArtifactPath, createStoredZip([
            { name: 'assets/index.html', content: Buffer.from('<html />') },
        ]));
        expect(() => verifier.verifyMobileArtifact({
            artifactPath: cleanArtifactPath,
            profile: 'mobile-standard',
            requireRss: true,
        })).toThrow(/RSS evidence is required/);
    });
});
