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

    workspaceFilePath: '',
    workspaceFolderPath: '',
    workspaceOutputFilePath: '',
    workspaceOutputFolderPath: '',

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

    // ── Search (obsidian-notemd v1.8.4) ──
    tavilyApiKey: '',
    searchProvider: 'tavily',
    ddgMaxResults: 5,
    ddgFetchTimeout: 10000,
    maxResearchContentTokens: 32000,
    tavilyMaxResults: 5,
    tavilySearchDepth: 'basic',

    // ── Diagram pipeline (obsidian-notemd v1.8.4) ──
    enableExperimentalDiagramPipeline: false,
    experimentalDiagramCompatibilityMode: 'best-fit',
    preferredDiagramIntent: undefined,
    useCustomSummarizeToMermaidSuffix: false,
    summarizeToMermaidCustomSuffix: '',
    useCustomSummarizeToMermaidSavePath: false,
    summarizeToMermaidSavePath: '',
    translateSummarizeToMermaidOutput: false,

    // ── Mermaid error detection (obsidian-notemd v1.8.4) ──
    enableMermaidErrorDetection: false,
    moveMermaidErrorFiles: false,
    mermaidErrorFolderPath: '',

    // ── Extract original text (obsidian-notemd v1.8.4) ──
    extractOriginalTextMergedMode: false,
    extractOriginalTextUseCustomOutput: false,
    extractOriginalTextCustomPath: '',
    extractOriginalTextCustomSuffix: '',
    translateExtractOriginalTextOutput: false,

    // ── Duplicate detection (obsidian-notemd v1.8.4) ──
    duplicateCheckScopeMode: 'vault',
    duplicateCheckScopePaths: '',

    // ── Add links post-processing (obsidian-notemd v1.8.4) ──
    removeCodeFencesOnAddLinks: false,

    // ── Workflow (obsidian-notemd v1.8.4) ──
    extractQuestions: '',
    customWorkflowErrorStrategy: 'stop_on_error',
    customWorkflowButtonsDsl: '',

    // ── Developer diagnostics (obsidian-notemd v1.8.4) ──
    enableDeveloperMode: false,
    developerDiagnosticCallMode: 'single',
    developerDiagnosticStabilityRuns: 5,
    developerDiagnosticTimeoutMs: 10000,
    enableApiErrorDebugMode: false,
    enableStableApiCall: false,
};
