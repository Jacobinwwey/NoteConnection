import {
    getExportProfile,
    type ExportProfile,
    type ExportProfileId,
    type PlatformRenderTarget,
} from './ExportProfile';
import type { StorageProviderKind } from '../shared/types';

export interface PlatformCapabilities {
    exportProfileId: ExportProfileId;
    platformTarget: PlatformRenderTarget;
    export: {
        supportsWorkspaceBundles: boolean;
        deterministicBundles: boolean;
        bundlePackagingMode: 'full' | 'slim';
        requiresIndexedReadiness: boolean;
        assetBudgetBytes: number | null;
        maxResidentBytes: number | null;
    };
    render: {
        supportsSvgArtifacts: boolean;
        supportsPngArtifacts: boolean;
        preferredArtifact: 'png' | 'svg';
        preferredMermaidRenderer: 'auto' | 'local' | 'frontend';
    };
    retrieval: {
        supportsSidecar: boolean;
        supportsBackgroundIndexing: boolean;
        supportsLocalIngest: boolean;
        supportsLocalExactQuery: boolean;
        supportsRemoteInference: boolean;
        requiresRemoteInference: boolean;
    };
    storage: {
        preferredProvider: StorageProviderKind;
        supportedProviders: StorageProviderKind[];
        supportsSqlite: boolean;
        supportsProjection: boolean;
    };
    conversation: {
        supportsStreaming: boolean;
    };
}

function cloneProfile(profile: ExportProfile): ExportProfile {
    return { ...profile };
}

export function resolvePlatformCapabilities(input: {
    exportProfileId?: unknown;
    platformTarget?: unknown;
} = {}): PlatformCapabilities {
    let profile = cloneProfile(getExportProfile(input.exportProfileId));
    const requestedTarget = typeof input.platformTarget === 'string'
        ? input.platformTarget.trim().toLowerCase()
        : '';

    if (requestedTarget) {
        const compatibleProfile = (
            requestedTarget === 'godot' ? getExportProfile('godot-path-mode')
                : requestedTarget === 'mobile' ? getExportProfile('mobile-slim')
                    : requestedTarget === 'browser' ? getExportProfile('desktop-reader')
                        : getExportProfile('desktop-full')
        );
        if (compatibleProfile.platformTarget === requestedTarget) {
            profile = cloneProfile(compatibleProfile);
        }
    }

    return {
        exportProfileId: profile.id,
        platformTarget: profile.platformTarget,
        export: {
            supportsWorkspaceBundles: true,
            deterministicBundles: true,
            bundlePackagingMode: profile.supportsSidecar ? 'full' : 'slim',
            requiresIndexedReadiness: true,
            assetBudgetBytes: profile.assetBudgetBytes,
            maxResidentBytes: profile.maxResidentBytes,
        },
        render: {
            supportsSvgArtifacts: profile.supportsSvgRenderArtifacts,
            supportsPngArtifacts: profile.supportsPngRenderArtifacts,
            preferredArtifact: profile.supportsSvgRenderArtifacts ? 'svg' : 'png',
            preferredMermaidRenderer: profile.preferredMermaidRenderer,
        },
        retrieval: {
            supportsSidecar: profile.supportsSidecar,
            supportsBackgroundIndexing: profile.supportsBackgroundIndexing,
            supportsLocalIngest: profile.supportsLocalIngest,
            supportsLocalExactQuery: profile.supportsLocalExactQuery,
            supportsRemoteInference: profile.supportsRemoteInference,
            requiresRemoteInference: profile.requiresRemoteInference,
        },
        storage: {
            preferredProvider: profile.platformTarget === 'mobile' ? 'projection' : 'sqlite',
            supportedProviders: profile.platformTarget === 'mobile'
                ? ['projection']
                : ['sqlite', 'file', 'remote'],
            supportsSqlite: profile.platformTarget !== 'mobile',
            supportsProjection: profile.platformTarget === 'mobile',
        },
        conversation: {
            supportsStreaming: profile.supportsConversationStreaming,
        },
    };
}
