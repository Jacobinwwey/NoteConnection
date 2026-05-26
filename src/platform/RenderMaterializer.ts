import { resolvePlatformCapabilities } from './PlatformCapabilities';
import type { ExportProfileId, PlatformRenderTarget } from './ExportProfile';

export interface RenderMaterializationDecision {
    exportProfileId: ExportProfileId;
    platformTarget: PlatformRenderTarget;
    includeSvg: boolean;
    includeStages: boolean;
    responseArtifact: 'png' | 'svg';
    rendererPreference: 'auto' | 'local' | 'frontend';
    vectorSuppressed: boolean;
}

export function resolveRenderMaterializationDecision(input: {
    exportProfileId?: unknown;
    platformTarget?: unknown;
    includeSvg?: boolean;
    includeStages?: boolean;
    rendererPreference?: unknown;
} = {}): RenderMaterializationDecision {
    const capabilities = resolvePlatformCapabilities({
        exportProfileId: input.exportProfileId,
        platformTarget: input.platformTarget,
    });

    const requestedRenderer = typeof input.rendererPreference === 'string'
        ? input.rendererPreference.trim().toLowerCase()
        : '';
    let rendererPreference = (
        requestedRenderer === 'local'
        || requestedRenderer === 'frontend'
        || requestedRenderer === 'auto'
    )
        ? requestedRenderer
        : capabilities.render.preferredMermaidRenderer;
    if (!capabilities.render.supportsSvgArtifacts && rendererPreference === 'frontend') {
        rendererPreference = capabilities.render.preferredMermaidRenderer;
    }

    const includeStages = input.includeStages === true;
    const includeSvgRequested = input.includeSvg === true || includeStages;
    const includeSvg = capabilities.render.supportsSvgArtifacts && includeSvgRequested;

    return {
        exportProfileId: capabilities.exportProfileId,
        platformTarget: capabilities.platformTarget,
        includeSvg,
        includeStages,
        responseArtifact: capabilities.render.preferredArtifact,
        rendererPreference,
        vectorSuppressed: includeSvgRequested && !capabilities.render.supportsSvgArtifacts,
    };
}
