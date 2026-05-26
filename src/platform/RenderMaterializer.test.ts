import { resolveRenderMaterializationDecision } from './RenderMaterializer';

describe('RenderMaterializer', () => {
    test('suppresses SVG for Godot even when includeSvg is requested', () => {
        const decision = resolveRenderMaterializationDecision({
            exportProfileId: 'godot-path-mode',
            includeSvg: true,
        });
        expect(decision.includeSvg).toBe(false);
        expect(decision.vectorSuppressed).toBe(true);
        expect(decision.responseArtifact).toBe('png');
    });

    test('preserves SVG diagnostics for desktop-full profile', () => {
        const decision = resolveRenderMaterializationDecision({
            exportProfileId: 'desktop-full',
            includeSvg: true,
            includeStages: true,
        });
        expect(decision.includeSvg).toBe(true);
        expect(decision.includeStages).toBe(true);
        expect(decision.vectorSuppressed).toBe(false);
    });

    test('falls back to local renderer for mobile slim profile', () => {
        const decision = resolveRenderMaterializationDecision({
            exportProfileId: 'mobile-slim',
            rendererPreference: 'frontend',
        });
        expect(decision.rendererPreference).toBe('local');
        expect(decision.responseArtifact).toBe('png');
    });
});
