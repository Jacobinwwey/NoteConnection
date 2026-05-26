export type ExportProfileId =
    | 'desktop-full'
    | 'desktop-reader'
    | 'godot-path-mode'
    | 'mobile-slim';

export type PlatformRenderTarget =
    | 'tauri'
    | 'browser'
    | 'godot'
    | 'mobile';

export interface ExportProfile {
    id: ExportProfileId;
    platformTarget: PlatformRenderTarget;
    description: string;
    supportsSidecar: boolean;
    supportsBackgroundIndexing: boolean;
    supportsConversationStreaming: boolean;
    supportsSvgRenderArtifacts: boolean;
    supportsPngRenderArtifacts: boolean;
    preferredMermaidRenderer: 'auto' | 'local' | 'frontend';
}

const EXPORT_PROFILES: Record<ExportProfileId, ExportProfile> = {
    'desktop-full': {
        id: 'desktop-full',
        platformTarget: 'tauri',
        description: 'Full desktop runtime with sidecar-backed retrieval, streaming, and indexing.',
        supportsSidecar: true,
        supportsBackgroundIndexing: true,
        supportsConversationStreaming: true,
        supportsSvgRenderArtifacts: true,
        supportsPngRenderArtifacts: true,
        preferredMermaidRenderer: 'auto',
    },
    'desktop-reader': {
        id: 'desktop-reader',
        platformTarget: 'browser',
        description: 'Reader-oriented desktop profile with lightweight retrieval and PNG-safe rendering.',
        supportsSidecar: true,
        supportsBackgroundIndexing: false,
        supportsConversationStreaming: true,
        supportsSvgRenderArtifacts: true,
        supportsPngRenderArtifacts: true,
        preferredMermaidRenderer: 'auto',
    },
    'godot-path-mode': {
        id: 'godot-path-mode',
        platformTarget: 'godot',
        description: 'Godot reader/profile with PNG-first render materialization and no SVG dependency.',
        supportsSidecar: true,
        supportsBackgroundIndexing: false,
        supportsConversationStreaming: false,
        supportsSvgRenderArtifacts: false,
        supportsPngRenderArtifacts: true,
        preferredMermaidRenderer: 'auto',
    },
    'mobile-slim': {
        id: 'mobile-slim',
        platformTarget: 'mobile',
        description: 'Slim mobile export with bounded memory footprint and PNG-only render artifacts.',
        supportsSidecar: false,
        supportsBackgroundIndexing: false,
        supportsConversationStreaming: false,
        supportsSvgRenderArtifacts: false,
        supportsPngRenderArtifacts: true,
        preferredMermaidRenderer: 'local',
    },
};

export function getExportProfile(profileId: unknown): ExportProfile {
    const normalized = typeof profileId === 'string' ? profileId.trim().toLowerCase() : '';
    const candidate = normalized as ExportProfileId;
    return EXPORT_PROFILES[candidate] || EXPORT_PROFILES['desktop-full'];
}

export function listExportProfiles(): ExportProfile[] {
    return Object.values(EXPORT_PROFILES).map((profile) => ({ ...profile }));
}
