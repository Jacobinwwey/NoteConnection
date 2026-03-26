import { LlmProviderConfig, NotemdLanguage, NotemdSettings } from './types';

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

export const DEFAULT_PROVIDERS: LlmProviderConfig[] = [
    {
        name: 'DeepSeek',
        apiKey: '',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-reasoner',
        temperature: 0.5,
        enabled: true,
    },
    {
        name: 'OpenAI',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        temperature: 0.5,
        enabled: true,
    },
    {
        name: 'Anthropic',
        apiKey: '',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20240620',
        temperature: 0.5,
        enabled: true,
    },
    {
        name: 'Google',
        apiKey: '',
        baseUrl: 'https://generativelanguage.googleapis.com/v1',
        model: 'gemini-2.0-flash',
        temperature: 0.5,
        enabled: true,
    },
    {
        name: 'Mistral',
        apiKey: '',
        baseUrl: 'https://api.mistral.ai/v1',
        model: 'mistral-large-latest',
        temperature: 0.5,
        enabled: true,
    },
    {
        name: 'Azure OpenAI',
        apiKey: '',
        baseUrl: '',
        model: 'gpt-4o',
        temperature: 0.5,
        apiVersion: '2025-01-01-preview',
        enabled: true,
    },
    {
        name: 'LMStudio',
        apiKey: 'EMPTY',
        baseUrl: 'http://localhost:1234/v1',
        model: 'local-model',
        temperature: 0.7,
        enabled: true,
    },
    {
        name: 'Ollama',
        apiKey: '',
        baseUrl: 'http://localhost:11434/api',
        model: 'llama3',
        temperature: 0.7,
        enabled: true,
    },
    {
        name: 'OpenRouter',
        apiKey: '',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini',
        temperature: 0.7,
        enabled: true,
    },
    {
        name: 'xAI',
        apiKey: '',
        baseUrl: 'https://api.x.ai/v1',
        model: 'grok-2-latest',
        temperature: 0.7,
        enabled: true,
    },
];

export const DEFAULT_SETTINGS: NotemdSettings = {
    providers: DEFAULT_PROVIDERS,
    activeProvider: 'DeepSeek',
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
    addLinksProvider: 'DeepSeek',
    researchProvider: 'DeepSeek',
    generateTitleProvider: 'DeepSeek',
    translateProvider: 'DeepSeek',
    summarizeToMermaidProvider: 'DeepSeek',
    extractConceptsProvider: 'DeepSeek',
    extractOriginalTextProvider: 'DeepSeek',

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
