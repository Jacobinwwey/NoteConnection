import { LlmProviderConfig, NotemdLanguage, NotemdSettings } from './types';
import { createDefaultProviders, DEFAULT_PROVIDER_NAME } from './LlmProviderDefinitions';

export const NOTEMD_CONFIG_FILE_NAME = 'notemd_config.json';

export const NOTEMD_SUPPORTED_TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

export const DEFAULT_LANGUAGES: NotemdLanguage[] = [
    { code: 'en', name: 'English' },
    { code: 'zh-CN', name: '简体中文' },
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
];

export const DEFAULT_PROVIDERS: LlmProviderConfig[] = createDefaultProviders();

export const DEFAULT_SETTINGS: NotemdSettings = {
    providers: DEFAULT_PROVIDERS,
    activeProvider: DEFAULT_PROVIDER_NAME,
    developerMode: false,

    useCustomConceptNoteFolder: false,
    conceptNoteFolder: 'Concepts',
    useCustomProcessedFileFolder: false,
    processedFileFolder: 'Processed',

    chunkWordCount: 2800,
    maxTokens: 4096,
    enableDuplicateDetection: true,
    moveOriginalFileOnProcess: false,

    enableResearchInGenerateContent: false,
    focusedLearningDomain: '',
    enableFocusedLearning: false,

    useMultiModelSettings: false,
    addLinksProvider: DEFAULT_PROVIDER_NAME,
    researchProvider: DEFAULT_PROVIDER_NAME,
    generateTitleProvider: DEFAULT_PROVIDER_NAME,
    translateProvider: DEFAULT_PROVIDER_NAME,
    summarizeToMermaidProvider: DEFAULT_PROVIDER_NAME,
    extractConceptsProvider: DEFAULT_PROVIDER_NAME,
    extractOriginalTextProvider: DEFAULT_PROVIDER_NAME,

    addLinksModel: '',
    researchModel: '',
    generateTitleModel: '',
    translateModel: '',
    summarizeToMermaidModel: '',
    extractConceptsModel: '',
    extractOriginalTextModel: '',

    useCustomAddLinksSuffix: false,
    addLinksCustomSuffix: '',
    useCustomTranslationSuffix: false,
    translationCustomSuffix: '_translated',
    useCustomTranslationSavePath: false,
    translationSavePath: '',
    useCustomGenerateTitleOutputFolder: false,
    generateTitleOutputFolderName: '_complete',

    enableBatchParallelism: true,
    batchConcurrency: 2,
    batchSize: 20,
    batchInterDelayMs: 500,
    apiCallIntervalMs: 400,

    maxRetries: 3,
    retryDelayMs: 1200,
    autoMermaidFixAfterGenerate: false,

    language: 'en',
    availableLanguages: DEFAULT_LANGUAGES,
    useDifferentLanguagesForTasks: false,
    generateTitleLanguage: 'en',
    researchSummarizeLanguage: 'en',
    addLinksLanguage: 'en',
    summarizeToMermaidLanguage: 'en',
    extractConceptsLanguage: 'en',
    translateLanguage: 'en',
    disableAutoTranslation: false,

    enableGlobalCustomPrompts: false,
    customPrompts: {},
};
