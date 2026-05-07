import { LlmProviderConfig } from './types';

export interface ProviderProfileExport {
    providers: LlmProviderConfig[];
    exportedAt: string;
    formatVersion: 1;
}

export interface ProviderProfileImportSummary {
    importedProviders: LlmProviderConfig[];
    newCount: number;
    updatedCount: number;
}

export function buildProviderProfileExport(providers: LlmProviderConfig[], now: Date = new Date()): ProviderProfileExport {
    return {
        providers,
        exportedAt: now.toISOString(),
        formatVersion: 1
    };
}

export function parseProviderProfileImport(jsonData: string, existingProviders: LlmProviderConfig[]): ProviderProfileImportSummary {
    const parsed = JSON.parse(jsonData) as ProviderProfileExport | LlmProviderConfig[];
    const importedProviders = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.providers)
            ? parsed.providers
            : null;

    if (!importedProviders) {
        throw new Error('Imported file does not contain a valid provider array.');
    }

    const existingProvidersMap = new Map(existingProviders.map(provider => [provider.name, provider]));
    let updatedCount = 0;
    let newCount = 0;

    importedProviders.forEach(importedProvider => {
        if (importedProvider && typeof importedProvider.name === 'string') {
            if (existingProvidersMap.has(importedProvider.name)) {
                existingProvidersMap.set(importedProvider.name, importedProvider);
                updatedCount += 1;
            } else {
                existingProvidersMap.set(importedProvider.name, importedProvider);
                newCount += 1;
            }
        }
    });

    return {
        importedProviders: Array.from(existingProvidersMap.values()),
        newCount,
        updatedCount
    };
}
