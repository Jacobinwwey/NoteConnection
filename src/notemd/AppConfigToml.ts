import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import { DEFAULT_SETTINGS } from './constants';
import { NotemdSettings } from './types';

type AppConfigRecord = Record<string, unknown>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneSettings(settings: NotemdSettings): NotemdSettings {
    return JSON.parse(JSON.stringify(settings)) as NotemdSettings;
}

function defaultConfigDirectory(): string {
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
        return path.join(process.env.LOCALAPPDATA, 'NoteConnection');
    }

    const xdgDataHome = String(process.env.XDG_DATA_HOME || '').trim();
    if (xdgDataHome) {
        return path.join(xdgDataHome, 'NoteConnection');
    }

    return path.join(os.homedir(), '.local', 'share', 'NoteConnection');
}

export function resolveAppConfigPath(): string {
    const explicitPath = String(process.env.NOTE_CONNECTION_CONFIG_PATH || '').trim();
    if (explicitPath) {
        return path.resolve(explicitPath);
    }

    const explicitDir = String(process.env.NOTE_CONNECTION_CONFIG_DIR || '').trim();
    if (explicitDir) {
        return path.resolve(path.join(explicitDir, 'app_config.toml'));
    }

    return path.resolve(path.join(defaultConfigDirectory(), 'app_config.toml'));
}

export async function loadAppConfigToml(): Promise<AppConfigRecord> {
    const configPath = resolveAppConfigPath();
    try {
        const content = await fs.promises.readFile(configPath, 'utf8');
        const parsed = TOML.parse(content);
        return isObjectRecord(parsed) ? parsed : {};
    } catch (error) {
        if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

export async function saveAppConfigToml(config: AppConfigRecord): Promise<void> {
    const configPath = resolveAppConfigPath();
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, TOML.stringify(config as TOML.JsonMap), 'utf8');
}

export function extractNotemdSettingsFromAppConfig(appConfig: AppConfigRecord): Partial<NotemdSettings> {
    const defaults = cloneSettings(DEFAULT_SETTINGS);
    const notemdSection = isObjectRecord(appConfig.notemd) ? appConfig.notemd : {};
    const apiSection = isObjectRecord(notemdSection.api) ? notemdSection.api : {};

    const next: Partial<NotemdSettings> = {
        developerMode: notemdSection.developer_mode === true,
    };

    if (typeof notemdSection.language === 'string' && notemdSection.language.trim()) {
        next.language = notemdSection.language.trim();
    }
    if (Number.isFinite(Number(notemdSection.chunk_word_count))) {
        next.chunkWordCount = Number(notemdSection.chunk_word_count);
    }
    if (Number.isFinite(Number(notemdSection.max_tokens))) {
        next.maxTokens = Number(notemdSection.max_tokens);
    }
    if (typeof notemdSection.auto_mermaid_fix_after_generate === 'boolean') {
        next.autoMermaidFixAfterGenerate = notemdSection.auto_mermaid_fix_after_generate;
    }

    const desiredProviderName = typeof apiSection.provider === 'string' && apiSection.provider.trim()
        ? apiSection.provider.trim()
        : defaults.activeProvider;
    const resolvedActiveProvider = defaults.providers.find((provider) => provider.name === desiredProviderName)
        || defaults.providers[0];

    next.activeProvider = resolvedActiveProvider.name;
    next.providers = defaults.providers.map((provider) => {
        if (provider.name !== resolvedActiveProvider.name) {
            return provider;
        }

        return {
            ...provider,
            baseUrl: typeof apiSection.base_url === 'string' && apiSection.base_url.trim()
                ? apiSection.base_url.trim()
                : provider.baseUrl,
            model: typeof apiSection.model === 'string' && apiSection.model.trim()
                ? apiSection.model.trim()
                : provider.model,
            apiKey: typeof apiSection.api_key === 'string' ? apiSection.api_key : provider.apiKey,
            apiVersion: typeof apiSection.api_version === 'string' ? apiSection.api_version : provider.apiVersion,
            temperature: Number.isFinite(Number(apiSection.temperature))
                ? Number(apiSection.temperature)
                : provider.temperature,
        };
    });

    return next;
}

export function applyNotemdSettingsToAppConfig(
    appConfig: AppConfigRecord,
    settings: NotemdSettings
): AppConfigRecord {
    const activeProvider = settings.providers.find((provider) => provider.name === settings.activeProvider)
        || settings.providers[0]
        || DEFAULT_SETTINGS.providers[0];
    const notemdSection = isObjectRecord(appConfig.notemd) ? { ...appConfig.notemd } : {};
    const apiSection = isObjectRecord(notemdSection.api) ? { ...notemdSection.api } : {};

    notemdSection.developer_mode = settings.developerMode === true;
    notemdSection.language = settings.language;
    notemdSection.chunk_word_count = settings.chunkWordCount;
    notemdSection.max_tokens = settings.maxTokens;
    notemdSection.auto_mermaid_fix_after_generate = settings.autoMermaidFixAfterGenerate === true;

    apiSection.provider = activeProvider.name;
    apiSection.base_url = activeProvider.baseUrl;
    apiSection.model = activeProvider.model;
    apiSection.api_key = activeProvider.apiKey;
    apiSection.api_version = activeProvider.apiVersion || '';
    apiSection.temperature = activeProvider.temperature;

    notemdSection.api = apiSection;

    return {
        ...appConfig,
        notemd: notemdSection,
    };
}
