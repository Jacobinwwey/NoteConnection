import { resolvePlatformCapabilities } from './PlatformCapabilities';

describe('PlatformCapabilities', () => {
    test('resolves Godot profile as PNG-first and non-streaming', () => {
        const capabilities = resolvePlatformCapabilities({ exportProfileId: 'godot-path-mode' });
        expect(capabilities.platformTarget).toBe('godot');
        expect(capabilities.export.supportsWorkspaceBundles).toBe(true);
        expect(capabilities.export.bundlePackagingMode).toBe('full');
        expect(capabilities.render.supportsSvgArtifacts).toBe(false);
        expect(capabilities.render.preferredArtifact).toBe('png');
        expect(capabilities.conversation.supportsStreaming).toBe(false);
    });

    test('resolves mobile slim profile as sidecar-free and PNG-only', () => {
        const capabilities = resolvePlatformCapabilities({ exportProfileId: 'mobile-slim' });
        expect(capabilities.platformTarget).toBe('mobile');
        expect(capabilities.export.bundlePackagingMode).toBe('slim');
        expect(capabilities.export.requiresIndexedReadiness).toBe(true);
        expect(capabilities.retrieval.supportsSidecar).toBe(false);
        expect(capabilities.render.supportsSvgArtifacts).toBe(false);
    });

    test('platform target override selects the compatible profile family', () => {
        const capabilities = resolvePlatformCapabilities({
            exportProfileId: 'desktop-full',
            platformTarget: 'browser',
        });
        expect(capabilities.exportProfileId).toBe('desktop-reader');
        expect(capabilities.platformTarget).toBe('browser');
    });
});
