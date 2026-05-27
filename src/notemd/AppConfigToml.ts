import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import { DEFAULT_SETTINGS } from './constants';
import { LlmProviderConfig, LlmProviderName, NotemdSettings, TaskKey } from './types';
import { mergeProviderTemplatesIntoNotemdSection } from './providerTemplates';

type AppConfigRecord = Record<string, unknown>;

const NOTEMD_BOOLEAN_KEYS = [
    'developerMode',
    'useCustomConceptNoteFolder',
    'useCustomProcessedFileFolder',
    'enableDuplicateDetection',
    'moveOriginalFileOnProcess',
    'enableResearchInGenerateContent',
    'enableFocusedLearning',
    'useMultiModelSettings',
    'useCustomAddLinksSuffix',
    'useCustomTranslationSuffix',
    'useCustomTranslationSavePath',
    'useCustomGenerateTitleOutputFolder',
    'enableBatchParallelism',
    'autoMermaidFixAfterGenerate',
    'useDifferentLanguagesForTasks',
    'disableAutoTranslation',
    'enableGlobalCustomPrompts',
] as const;

const NOTEMD_NUMBER_KEYS = [
    'chunkWordCount',
    'maxTokens',
    'batchConcurrency',
    'batchSize',
    'batchInterDelayMs',
    'apiCallIntervalMs',
    'maxRetries',
    'retryDelayMs',
] as const;

const NOTEMD_STRING_KEYS = [
    'workspaceFilePath',
    'workspaceFolderPath',
    'workspaceOutputFilePath',
    'workspaceOutputFolderPath',
    'conceptNoteFolder',
    'processedFileFolder',
    'focusedLearningDomain',
    'addLinksModel',
    'researchModel',
    'generateTitleModel',
    'translateModel',
    'summarizeToMermaidModel',
    'extractConceptsModel',
    'extractOriginalTextModel',
    'addLinksCustomSuffix',
    'translationCustomSuffix',
    'translationSavePath',
    'generateTitleOutputFolderName',
    'language',
    'generateTitleLanguage',
    'researchSummarizeLanguage',
    'addLinksLanguage',
    'summarizeToMermaidLanguage',
    'extractConceptsLanguage',
    'translateLanguage',
] as const;

const NOTEMD_TASK_PROVIDER_KEYS = [
    'addLinksProvider',
    'researchProvider',
    'generateTitleProvider',
    'translateProvider',
    'summarizeToMermaidProvider',
    'extractConceptsProvider',
    'extractOriginalTextProvider',
] as const;

const NOTEMD_TASK_MODEL_KEYS = [
    'addLinksModel',
    'researchModel',
    'generateTitleModel',
    'translateModel',
    'summarizeToMermaidModel',
    'extractConceptsModel',
    'extractOriginalTextModel',
] as const;

const NOTEMD_TASK_LANGUAGE_KEYS = [
    'generateTitleLanguage',
    'researchSummarizeLanguage',
    'addLinksLanguage',
    'summarizeToMermaidLanguage',
    'extractConceptsLanguage',
    'translateLanguage',
] as const;

const CUSTOM_PROMPT_TASK_KEYS: ReadonlyArray<TaskKey> = [
    'extractConcepts',
    'addLinks',
    'generateTitle',
    'translate',
    'summarizeToMermaid',
    'extractOriginalText',
];

export interface PathModeSettings {
    auto_reconstruct: boolean;
    retain_history: boolean;
    focus_mode: boolean;
    background: string;
    bg_brightness: number;
    reading_mode: 'window' | 'fullscreen';
    reader_render_mode: 'render' | 'source';
    reader_toggle_source_shortcut: string;
    reader_media_scale: number;
    reader_debug: boolean;
    node_spacing: number;
}

export const DEFAULT_PATH_MODE_SETTINGS: PathModeSettings = {
    auto_reconstruct: true,
    retain_history: true,
    focus_mode: true,
    background: '',
    bg_brightness: 0.1,
    reading_mode: 'window',
    reader_render_mode: 'render',
    reader_toggle_source_shortcut: 'Ctrl+M',
    reader_media_scale: 1.5,
    reader_debug: false,
    node_spacing: 240.0,
};

export interface FrontendPhysicsSettings {
    repulsionForce: number;
    repulsionDAG: number;
    linkDistance: number;
    collisionRadius: number;
}

export interface FrontendVisualSettings {
    edgeOpacity: number;
    baseNodeSize: number;
    degreeMode: 'visible' | 'total';
}

export interface FrontendPerformanceSettings {
    maxWorkers: number;
    enableGPU: boolean;
    gpuRendering: boolean;
    memorySavingMode: boolean;
    compactMode: boolean;
    staticMode: boolean;
    deepDebug: boolean;
}

export interface FrontendReadingSettings {
    mode: 'window' | 'fullscreen';
    markdownEngine: 'legacy' | 'pulldown' | 'auto';
    chunkBlockSize: number;
    prefetchBlocks: number;
    indexCacheTtlSec: number;
    maxDocBytes: number;
}

export interface FrontendSettings {
    physics: FrontendPhysicsSettings;
    visuals: FrontendVisualSettings;
    performance: FrontendPerformanceSettings;
    reading: FrontendReadingSettings;
}

export const DEFAULT_FRONTEND_SETTINGS: FrontendSettings = {
    physics: {
        repulsionForce: -550,
        repulsionDAG: -850,
        linkDistance: 250,
        collisionRadius: 25,
    },
    visuals: {
        edgeOpacity: 0.6,
        baseNodeSize: 5,
        degreeMode: 'visible',
    },
    performance: {
        maxWorkers: 4,
        enableGPU: true,
        gpuRendering: true,
        memorySavingMode: false,
        compactMode: false,
        staticMode: false,
        deepDebug: false,
    },
    reading: {
        mode: 'window',
        markdownEngine: 'auto',
        chunkBlockSize: 36,
        prefetchBlocks: 8,
        indexCacheTtlSec: 1800,
        maxDocBytes: 100663296,
    },
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneSettings(settings: NotemdSettings): NotemdSettings {
    return JSON.parse(JSON.stringify(settings)) as NotemdSettings;
}

function toSnakeCase(input: string): string {
    return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function readField(
    section: Record<string, unknown>,
    snakeKey: string,
    camelKey?: string
): unknown {
    if (Object.prototype.hasOwnProperty.call(section, snakeKey)) {
        return section[snakeKey];
    }
    if (camelKey && Object.prototype.hasOwnProperty.call(section, camelKey)) {
        return section[camelKey];
    }
    return undefined;
}

function readString(
    section: Record<string, unknown>,
    snakeKey: string,
    camelKey?: string
): string | undefined {
    const value = readField(section, snakeKey, camelKey);
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
}

function readBoolean(
    section: Record<string, unknown>,
    snakeKey: string,
    camelKey?: string
): boolean | undefined {
    const value = readField(section, snakeKey, camelKey);
    if (typeof value === 'boolean') {
        return value;
    }
    return undefined;
}

function readNumber(
    section: Record<string, unknown>,
    snakeKey: string,
    camelKey?: string
): number | undefined {
    const value = readField(section, snakeKey, camelKey);
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return undefined;
    }
    return numericValue;
}

function readObject(
    section: Record<string, unknown>,
    snakeKey: string,
    camelKey?: string
): Record<string, unknown> | null {
    const value = readField(section, snakeKey, camelKey);
    return isObjectRecord(value) ? value : null;
}

function clampNumber(value: number, minValue: number, maxValue: number): number {
    return Math.max(minValue, Math.min(maxValue, value));
}

function normalizePathModeReadingMode(value: unknown): 'window' | 'fullscreen' {
    const text = String(value || '').trim().toLowerCase();
    return text === 'fullscreen' ? 'fullscreen' : 'window';
}

function normalizePathModeRenderMode(value: unknown): 'render' | 'source' {
    const text = String(value || '').trim().toLowerCase();
    return text === 'source' ? 'source' : 'render';
}

function cloneFrontendSettings(settings: FrontendSettings): FrontendSettings {
    return JSON.parse(JSON.stringify(settings)) as FrontendSettings;
}

function readNumberWithNestedFallback(
    nestedSection: Record<string, unknown>,
    section: Record<string, unknown>,
    snakeKey: string,
    camelKey: string
): number | undefined {
    const nestedValue = readNumber(nestedSection, snakeKey, camelKey);
    if (typeof nestedValue === 'number') {
        return nestedValue;
    }
    return readNumber(section, snakeKey, camelKey);
}

function readBooleanWithNestedFallback(
    nestedSection: Record<string, unknown>,
    section: Record<string, unknown>,
    snakeKey: string,
    camelKey: string
): boolean | undefined {
    const nestedValue = readBoolean(nestedSection, snakeKey, camelKey);
    if (typeof nestedValue === 'boolean') {
        return nestedValue;
    }
    return readBoolean(section, snakeKey, camelKey);
}

function normalizeFrontendReadingMode(value: unknown): 'window' | 'fullscreen' {
    const text = String(value || '').trim().toLowerCase();
    return text === 'fullscreen' ? 'fullscreen' : 'window';
}

function normalizeMarkdownEngine(value: unknown): 'legacy' | 'pulldown' | 'auto' {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'legacy') {
        return 'legacy';
    }
    if (text === 'pulldown') {
        return 'pulldown';
    }
    return 'auto';
}

function normalizeFrontendDegreeMode(value: unknown): 'visible' | 'total' {
    const text = String(value || '').trim().toLowerCase();
    return text === 'total' ? 'total' : 'visible';
}

function normalizeRepulsionValue(value: unknown, fallback: number): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }
    return clampNumber(numericValue, -10000, -1);
}

function normalizeFrontendSettingsValue(raw: unknown): FrontendSettings {
    const section = isObjectRecord(raw) ? raw : {};
    const physicsSection = readObject(section, 'physics', 'physics') || {};
    const visualsSection = readObject(section, 'visuals', 'visuals') || {};
    const performanceSection = readObject(section, 'performance', 'performance') || {};
    const readingSection = readObject(section, 'reading', 'reading') || {};
    const merged = cloneFrontendSettings(DEFAULT_FRONTEND_SETTINGS);

    merged.physics.repulsionForce = normalizeRepulsionValue(
        readNumberWithNestedFallback(physicsSection, section, 'repulsion_force', 'repulsionForce'),
        merged.physics.repulsionForce
    );
    merged.physics.repulsionDAG = normalizeRepulsionValue(
        readNumberWithNestedFallback(physicsSection, section, 'repulsion_dag', 'repulsionDAG'),
        merged.physics.repulsionDAG
    );

    const linkDistance = readNumberWithNestedFallback(
        physicsSection,
        section,
        'link_distance',
        'linkDistance'
    );
    if (typeof linkDistance === 'number') {
        merged.physics.linkDistance = clampNumber(linkDistance, 20, 2000);
    }

    const collisionRadius = readNumberWithNestedFallback(
        physicsSection,
        section,
        'collision_radius',
        'collisionRadius'
    );
    if (typeof collisionRadius === 'number') {
        merged.physics.collisionRadius = clampNumber(collisionRadius, 1, 300);
    }

    const edgeOpacity = readNumberWithNestedFallback(
        visualsSection,
        section,
        'edge_opacity',
        'edgeOpacity'
    );
    if (typeof edgeOpacity === 'number') {
        merged.visuals.edgeOpacity = clampNumber(edgeOpacity, 0, 1);
    }

    const baseNodeSize = readNumberWithNestedFallback(
        visualsSection,
        section,
        'base_node_size',
        'baseNodeSize'
    );
    if (typeof baseNodeSize === 'number') {
        merged.visuals.baseNodeSize = clampNumber(baseNodeSize, 1, 100);
    }

    merged.visuals.degreeMode = normalizeFrontendDegreeMode(
        readString(visualsSection, 'degree_mode', 'degreeMode')
            ?? readString(section, 'degree_mode', 'degreeMode')
            ?? merged.visuals.degreeMode
    );

    const maxWorkers = readNumberWithNestedFallback(
        performanceSection,
        section,
        'max_workers',
        'maxWorkers'
    );
    if (typeof maxWorkers === 'number') {
        merged.performance.maxWorkers = Math.round(clampNumber(maxWorkers, 1, 64));
    }

    const enableGPU = readBooleanWithNestedFallback(
        performanceSection,
        section,
        'enable_gpu',
        'enableGPU'
    );
    if (typeof enableGPU === 'boolean') {
        merged.performance.enableGPU = enableGPU;
    }

    const gpuRendering = readBooleanWithNestedFallback(
        performanceSection,
        section,
        'gpu_rendering',
        'gpuRendering'
    );
    if (typeof gpuRendering === 'boolean') {
        merged.performance.gpuRendering = gpuRendering;
    }

    const memorySavingMode = readBooleanWithNestedFallback(
        performanceSection,
        section,
        'memory_saving_mode',
        'memorySavingMode'
    );
    if (typeof memorySavingMode === 'boolean') {
        merged.performance.memorySavingMode = memorySavingMode;
    }

    const compactMode = readBooleanWithNestedFallback(
        performanceSection,
        section,
        'compact_mode',
        'compactMode'
    );
    if (typeof compactMode === 'boolean') {
        merged.performance.compactMode = compactMode;
    }

    const staticMode = readBooleanWithNestedFallback(
        performanceSection,
        section,
        'static_mode',
        'staticMode'
    );
    if (typeof staticMode === 'boolean') {
        merged.performance.staticMode = staticMode;
    }

    const deepDebug = readBooleanWithNestedFallback(
        performanceSection,
        section,
        'deep_debug',
        'deepDebug'
    );
    if (typeof deepDebug === 'boolean') {
        merged.performance.deepDebug = deepDebug;
    }

    merged.reading.mode = normalizeFrontendReadingMode(
        readString(readingSection, 'mode', 'mode')
            ?? readString(section, 'reading_mode', 'readingMode')
            ?? merged.reading.mode
    );
    merged.reading.markdownEngine = normalizeMarkdownEngine(
        readString(readingSection, 'markdown_engine', 'markdownEngine')
            ?? readString(section, 'markdown_engine', 'markdownEngine')
            ?? merged.reading.markdownEngine
    );

    const chunkBlockSize = readNumberWithNestedFallback(
        readingSection,
        section,
        'chunk_block_size',
        'chunkBlockSize'
    );
    if (typeof chunkBlockSize === 'number') {
        merged.reading.chunkBlockSize = Math.round(clampNumber(chunkBlockSize, 1, 4096));
    }

    const prefetchBlocks = readNumberWithNestedFallback(
        readingSection,
        section,
        'prefetch_blocks',
        'prefetchBlocks'
    );
    if (typeof prefetchBlocks === 'number') {
        merged.reading.prefetchBlocks = Math.round(clampNumber(prefetchBlocks, 0, 1024));
    }

    const indexCacheTtlSec = readNumberWithNestedFallback(
        readingSection,
        section,
        'index_cache_ttl_sec',
        'indexCacheTtlSec'
    );
    if (typeof indexCacheTtlSec === 'number') {
        merged.reading.indexCacheTtlSec = Math.round(clampNumber(indexCacheTtlSec, 5, 86400));
    }

    const maxDocBytes = readNumberWithNestedFallback(
        readingSection,
        section,
        'max_doc_bytes',
        'maxDocBytes'
    );
    if (typeof maxDocBytes === 'number') {
        merged.reading.maxDocBytes = Math.round(clampNumber(maxDocBytes, 256 * 1024, 2 * 1024 * 1024 * 1024));
    }

    return merged;
}

function normalizePathModeSettingsValue(raw: unknown): PathModeSettings {
    const section = isObjectRecord(raw) ? raw : {};
    const merged: PathModeSettings = {
        ...DEFAULT_PATH_MODE_SETTINGS,
    };

    const autoReconstruct = readBoolean(section, 'auto_reconstruct');
    if (typeof autoReconstruct === 'boolean') {
        merged.auto_reconstruct = autoReconstruct;
    }

    const retainHistory = readBoolean(section, 'retain_history');
    if (typeof retainHistory === 'boolean') {
        merged.retain_history = retainHistory;
    }

    const focusMode = readBoolean(section, 'focus_mode');
    if (typeof focusMode === 'boolean') {
        merged.focus_mode = focusMode;
    }

    const background = readString(section, 'background');
    if (typeof background === 'string') {
        merged.background = background;
    }

    const brightness = readNumber(section, 'bg_brightness');
    if (typeof brightness === 'number') {
        merged.bg_brightness = clampNumber(brightness, 0.0, 0.1);
    }

    merged.reading_mode = normalizePathModeReadingMode(
        readString(section, 'reading_mode') || merged.reading_mode
    );
    merged.reader_render_mode = normalizePathModeRenderMode(
        readString(section, 'reader_render_mode') || merged.reader_render_mode
    );

    const shortcut = readString(section, 'reader_toggle_source_shortcut');
    if (typeof shortcut === 'string' && shortcut.trim()) {
        merged.reader_toggle_source_shortcut = shortcut.trim();
    }

    const mediaScale = readNumber(section, 'reader_media_scale');
    if (typeof mediaScale === 'number') {
        merged.reader_media_scale = clampNumber(mediaScale, 0.1, 3.0);
    }

    const readerDebug = readBoolean(section, 'reader_debug');
    if (typeof readerDebug === 'boolean') {
        merged.reader_debug = readerDebug;
    }

    const nodeSpacing = readNumber(section, 'node_spacing');
    if (typeof nodeSpacing === 'number') {
        merged.node_spacing = clampNumber(nodeSpacing, 100.0, 600.0);
    }

    return merged;
}

function normalizeProviderName(
    rawName: unknown,
    fallbackName: LlmProviderName,
    knownNames: Set<LlmProviderName>
): LlmProviderName {
    const candidate = String(rawName || '').trim() as LlmProviderName;
    if (candidate && knownNames.has(candidate)) {
        return candidate;
    }
    return fallbackName;
}

function normalizeProviderEntry(
    candidate: Record<string, unknown>,
    fallbackProvider: LlmProviderConfig
): LlmProviderConfig {
    const baseUrl =
        readString(candidate, 'base_url', 'baseUrl') ?? fallbackProvider.baseUrl;
    const model = readString(candidate, 'model', 'model') ?? fallbackProvider.model;
    const apiKey =
        readString(candidate, 'api_key', 'apiKey') ?? fallbackProvider.apiKey;
    const apiVersion =
        readString(candidate, 'api_version', 'apiVersion') ??
        String(fallbackProvider.apiVersion || '').trim();
    const temperature =
        readNumber(candidate, 'temperature', 'temperature') ?? fallbackProvider.temperature;
    const enabled =
        readBoolean(candidate, 'enabled', 'enabled') ?? fallbackProvider.enabled ?? true;

    return {
        ...fallbackProvider,
        baseUrl: String(baseUrl || '').trim(),
        model: String(model || '').trim(),
        apiKey: String(apiKey || ''),
        apiVersion: String(apiVersion || '').trim(),
        temperature: Number.isFinite(temperature) ? temperature : fallbackProvider.temperature,
        enabled,
    };
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

export function extractNotemdSettingsFromAppConfig(
    appConfig: AppConfigRecord
): Partial<NotemdSettings> {
    const defaults = cloneSettings(DEFAULT_SETTINGS);
    const notemdSection = isObjectRecord(appConfig.notemd) ? appConfig.notemd : {};
    const legacyApiSection = readObject(notemdSection, 'api', 'api');
    const providerFallbackMap = new Map<LlmProviderName, LlmProviderConfig>(
        defaults.providers.map((provider) => [provider.name, provider])
    );
    const knownProviderNames = new Set<LlmProviderName>(
        defaults.providers.map((provider) => provider.name)
    );
    const mergedSettings = cloneSettings(defaults);
    const mergedRecord = mergedSettings as unknown as Record<string, unknown>;

    const providerCandidates = Array.isArray(readField(notemdSection, 'providers', 'providers'))
        ? (readField(notemdSection, 'providers', 'providers') as unknown[])
        : [];
    const normalizedProviderMap = new Map<LlmProviderName, LlmProviderConfig>();
    defaults.providers.forEach((provider) => normalizedProviderMap.set(provider.name, { ...provider }));

    providerCandidates.forEach((providerCandidate) => {
        if (!isObjectRecord(providerCandidate)) {
            return;
        }
        const rawName = readString(providerCandidate, 'name', 'name');
        if (!rawName) {
            return;
        }
        const providerName = rawName as LlmProviderName;
        const fallbackProvider = providerFallbackMap.get(providerName);
        if (!fallbackProvider) {
            return;
        }
        normalizedProviderMap.set(
            providerName,
            normalizeProviderEntry(providerCandidate, fallbackProvider)
        );
    });

    let activeProviderName = normalizeProviderName(
        readString(notemdSection, 'active_provider', 'activeProvider'),
        defaults.activeProvider,
        knownProviderNames
    );

    if (legacyApiSection) {
        const fromLegacy = normalizeProviderName(
            readString(legacyApiSection, 'provider', 'provider'),
            activeProviderName,
            knownProviderNames
        );
        activeProviderName = fromLegacy;
        const fallbackProvider =
            normalizedProviderMap.get(activeProviderName) ||
            providerFallbackMap.get(activeProviderName) ||
            defaults.providers[0];
        normalizedProviderMap.set(
            activeProviderName,
            normalizeProviderEntry(legacyApiSection, fallbackProvider)
        );
    }

    mergedSettings.providers = defaults.providers.map((provider) => {
        const resolved = normalizedProviderMap.get(provider.name);
        return resolved ? { ...resolved } : { ...provider };
    });
    mergedSettings.activeProvider = activeProviderName;

    NOTEMD_BOOLEAN_KEYS.forEach((key) => {
        const value = readBoolean(notemdSection, toSnakeCase(key), key);
        if (typeof value === 'boolean') {
            mergedRecord[key] = value;
        }
    });

    NOTEMD_NUMBER_KEYS.forEach((key) => {
        const value = readNumber(notemdSection, toSnakeCase(key), key);
        if (typeof value === 'number') {
            mergedRecord[key] = value;
        }
    });

    NOTEMD_STRING_KEYS.forEach((key) => {
        const value = readString(notemdSection, toSnakeCase(key), key);
        if (typeof value === 'string') {
            mergedRecord[key] = value;
        }
    });

    const taskProvidersSection = readObject(notemdSection, 'task_providers', 'taskProviders');
    NOTEMD_TASK_PROVIDER_KEYS.forEach((key) => {
        const nestedValue = taskProvidersSection
            ? readString(taskProvidersSection, toSnakeCase(key), key)
            : undefined;
        const directValue = readString(notemdSection, toSnakeCase(key), key);
        const desired = nestedValue ?? directValue;
        if (!desired) {
            return;
        }
        const normalized = normalizeProviderName(
            desired,
            mergedSettings.activeProvider,
            knownProviderNames
        );
        mergedRecord[key] = normalized;
    });

    const taskModelsSection = readObject(notemdSection, 'task_models', 'taskModels');
    NOTEMD_TASK_MODEL_KEYS.forEach((key) => {
        const nestedValue = taskModelsSection
            ? readString(taskModelsSection, toSnakeCase(key), key)
            : undefined;
        const directValue = readString(notemdSection, toSnakeCase(key), key);
        const desired = nestedValue ?? directValue;
        if (typeof desired === 'string') {
            mergedRecord[key] = desired;
        }
    });

    const taskLanguagesSection = readObject(notemdSection, 'task_languages', 'taskLanguages');
    NOTEMD_TASK_LANGUAGE_KEYS.forEach((key) => {
        const nestedValue = taskLanguagesSection
            ? readString(taskLanguagesSection, toSnakeCase(key), key)
            : undefined;
        const directValue = readString(notemdSection, toSnakeCase(key), key);
        const desired = nestedValue ?? directValue;
        if (typeof desired === 'string') {
            mergedRecord[key] = desired;
        }
    });

    const availableLanguagesRaw = readField(
        notemdSection,
        'available_languages',
        'availableLanguages'
    );
    if (Array.isArray(availableLanguagesRaw)) {
        const nextLanguages = availableLanguagesRaw
            .map((candidate) => {
                if (!isObjectRecord(candidate)) {
                    return null;
                }
                const code = readString(candidate, 'code', 'code');
                const name = readString(candidate, 'name', 'name');
                if (!code || !name) {
                    return null;
                }
                return { code, name };
            })
            .filter((item): item is { code: string; name: string } => item !== null);
        if (nextLanguages.length > 0) {
            mergedSettings.availableLanguages = nextLanguages;
        }
    }

    const customPromptsSection = readObject(notemdSection, 'custom_prompts', 'customPrompts');
    if (customPromptsSection) {
        const nextPrompts: Partial<Record<TaskKey, string>> = {};
        CUSTOM_PROMPT_TASK_KEYS.forEach((taskKey) => {
            const prompt = readString(customPromptsSection, taskKey, taskKey);
            if (typeof prompt === 'string' && prompt.trim()) {
                nextPrompts[taskKey] = prompt.trim();
            }
        });
        mergedSettings.customPrompts = nextPrompts;
    }

    return mergedSettings;
}

export function applyNotemdSettingsToAppConfig(
    appConfig: AppConfigRecord,
    settings: NotemdSettings
): AppConfigRecord {
    let nextNotemdSection = isObjectRecord(appConfig.notemd) ? { ...appConfig.notemd } : {};
    const activeProvider =
        settings.providers.find((provider) => provider.name === settings.activeProvider) ||
        settings.providers[0] ||
        DEFAULT_SETTINGS.providers[0];

    NOTEMD_BOOLEAN_KEYS.forEach((key) => {
        nextNotemdSection[toSnakeCase(key)] = settings[key] === true;
    });

    NOTEMD_NUMBER_KEYS.forEach((key) => {
        nextNotemdSection[toSnakeCase(key)] = Number(settings[key]);
    });

    NOTEMD_STRING_KEYS.forEach((key) => {
        nextNotemdSection[toSnakeCase(key)] = String(settings[key] || '');
    });

    nextNotemdSection.active_provider = settings.activeProvider;
    nextNotemdSection.providers = settings.providers.map((provider) => ({
        name: provider.name,
        api_key: provider.apiKey,
        base_url: provider.baseUrl,
        model: provider.model,
        temperature: provider.temperature,
        api_version: provider.apiVersion || '',
        enabled: provider.enabled !== false,
    }));

    nextNotemdSection.available_languages = settings.availableLanguages.map((language) => ({
        code: language.code,
        name: language.name,
    }));

    const taskProviders: Record<string, string> = {};
    NOTEMD_TASK_PROVIDER_KEYS.forEach((key) => {
        taskProviders[toSnakeCase(key)] = settings[key];
    });
    nextNotemdSection.task_providers = taskProviders;

    const taskModels: Record<string, string> = {};
    NOTEMD_TASK_MODEL_KEYS.forEach((key) => {
        taskModels[toSnakeCase(key)] = settings[key];
    });
    nextNotemdSection.task_models = taskModels;

    const taskLanguages: Record<string, string> = {};
    NOTEMD_TASK_LANGUAGE_KEYS.forEach((key) => {
        taskLanguages[toSnakeCase(key)] = settings[key];
    });
    nextNotemdSection.task_languages = taskLanguages;

    const customPrompts: Record<string, string> = {};
    CUSTOM_PROMPT_TASK_KEYS.forEach((taskKey) => {
        const prompt = String(settings.customPrompts?.[taskKey] || '').trim();
        if (prompt) {
            customPrompts[taskKey] = prompt;
        }
    });
    nextNotemdSection.custom_prompts = customPrompts;

    // Keep legacy compatibility mirror so older runtime branches still read active profile.
    nextNotemdSection.api = {
        provider: activeProvider.name,
        base_url: activeProvider.baseUrl,
        model: activeProvider.model,
        api_key: activeProvider.apiKey,
        api_version: activeProvider.apiVersion || '',
        temperature: activeProvider.temperature,
    };

    nextNotemdSection = mergeProviderTemplatesIntoNotemdSection(nextNotemdSection);

    return {
        ...appConfig,
        notemd: nextNotemdSection,
    };
}

export function extractPathModeSettingsFromAppConfig(appConfig: AppConfigRecord): PathModeSettings {
    const pathModeSection = isObjectRecord(appConfig.path_mode) ? appConfig.path_mode : {};
    return normalizePathModeSettingsValue(pathModeSection);
}

export function applyPathModeSettingsToAppConfig(
    appConfig: AppConfigRecord,
    settingsLike: unknown
): AppConfigRecord {
    const normalized = normalizePathModeSettingsValue(settingsLike);
    return {
        ...appConfig,
        path_mode: {
            auto_reconstruct: normalized.auto_reconstruct,
            retain_history: normalized.retain_history,
            focus_mode: normalized.focus_mode,
            background: normalized.background,
            bg_brightness: normalized.bg_brightness,
            reading_mode: normalized.reading_mode,
            reader_render_mode: normalized.reader_render_mode,
            reader_toggle_source_shortcut: normalized.reader_toggle_source_shortcut,
            reader_media_scale: normalized.reader_media_scale,
            reader_debug: normalized.reader_debug,
            node_spacing: normalized.node_spacing,
        },
    };
}

export function extractFrontendSettingsFromAppConfig(appConfig: AppConfigRecord): FrontendSettings {
    const frontendSection = isObjectRecord(appConfig.frontend_settings)
        ? appConfig.frontend_settings
        : (isObjectRecord(appConfig.frontend) ? appConfig.frontend : {});
    return normalizeFrontendSettingsValue(frontendSection);
}

export function applyFrontendSettingsToAppConfig(
    appConfig: AppConfigRecord,
    settingsLike: unknown
): AppConfigRecord {
    const normalized = normalizeFrontendSettingsValue(settingsLike);
    return {
        ...appConfig,
        frontend_settings: {
            physics: {
                repulsion_force: normalized.physics.repulsionForce,
                repulsion_dag: normalized.physics.repulsionDAG,
                link_distance: normalized.physics.linkDistance,
                collision_radius: normalized.physics.collisionRadius,
            },
            visuals: {
                edge_opacity: normalized.visuals.edgeOpacity,
                base_node_size: normalized.visuals.baseNodeSize,
                degree_mode: normalized.visuals.degreeMode,
            },
            performance: {
                max_workers: normalized.performance.maxWorkers,
                enable_gpu: normalized.performance.enableGPU,
                gpu_rendering: normalized.performance.gpuRendering,
                memory_saving_mode: normalized.performance.memorySavingMode,
                compact_mode: normalized.performance.compactMode,
                static_mode: normalized.performance.staticMode,
                deep_debug: normalized.performance.deepDebug,
            },
            reading: {
                mode: normalized.reading.mode,
                markdown_engine: normalized.reading.markdownEngine,
                chunk_block_size: normalized.reading.chunkBlockSize,
                prefetch_blocks: normalized.reading.prefetchBlocks,
                index_cache_ttl_sec: normalized.reading.indexCacheTtlSec,
                max_doc_bytes: normalized.reading.maxDocBytes,
            },
        },
    };
}
