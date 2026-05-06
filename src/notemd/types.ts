export type LlmProviderName =
    | 'DeepSeek'
    | 'OpenAI'
    | 'Anthropic'
    | 'Google'
    | 'Mistral'
    | 'Azure OpenAI'
    | 'LMStudio'
    | 'Ollama'
    | 'OpenRouter'
    | 'xAI'
    | 'Qwen'
    | 'Doubao'
    | 'Moonshot'
    | 'GLM'
    | 'MiniMax'
    | 'Groq'
    | 'Together'
    | 'Fireworks'
    | 'Requesty'
    | 'OpenAI Compatible';

export type TaskKey =
    | 'extractConcepts'
    | 'addLinks'
    | 'generateTitle'
    | 'translate'
    | 'summarizeToMermaid'
    | 'extractOriginalText'
    | 'extractOriginalTextMerged'
    | 'searchResearch';

export interface LlmProviderConfig {
    name: LlmProviderName;
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    apiVersion?: string;
    enabled?: boolean;
}

export interface NotemdLanguage {
    code: string;
    name: string;
}

export interface NotemdSettings {
    providers: LlmProviderConfig[];
    activeProvider: LlmProviderName;
    developerMode: boolean;

    workspaceFilePath: string;
    workspaceFolderPath: string;
    workspaceOutputFilePath: string;
    workspaceOutputFolderPath: string;

    useCustomConceptNoteFolder: boolean;
    conceptNoteFolder: string;
    useCustomProcessedFileFolder: boolean;
    processedFileFolder: string;

    chunkWordCount: number;
    maxTokens: number;
    enableDuplicateDetection: boolean;
    moveOriginalFileOnProcess: boolean;

    enableResearchInGenerateContent: boolean;
    focusedLearningDomain: string;
    enableFocusedLearning: boolean;

    useMultiModelSettings: boolean;
    addLinksProvider: LlmProviderName;
    researchProvider: LlmProviderName;
    generateTitleProvider: LlmProviderName;
    translateProvider: LlmProviderName;
    summarizeToMermaidProvider: LlmProviderName;
    extractConceptsProvider: LlmProviderName;
    extractOriginalTextProvider: LlmProviderName;

    addLinksModel: string;
    researchModel: string;
    generateTitleModel: string;
    translateModel: string;
    summarizeToMermaidModel: string;
    extractConceptsModel: string;
    extractOriginalTextModel: string;

    useCustomAddLinksSuffix: boolean;
    addLinksCustomSuffix: string;
    useCustomTranslationSuffix: boolean;
    translationCustomSuffix: string;
    useCustomTranslationSavePath: boolean;
    translationSavePath: string;
    useCustomGenerateTitleOutputFolder: boolean;
    generateTitleOutputFolderName: string;

    enableBatchParallelism: boolean;
    batchConcurrency: number;
    batchSize: number;
    batchInterDelayMs: number;
    apiCallIntervalMs: number;

    maxRetries: number;
    retryDelayMs: number;
    autoMermaidFixAfterGenerate: boolean;

    language: string;
    availableLanguages: NotemdLanguage[];
    useDifferentLanguagesForTasks: boolean;
    generateTitleLanguage: string;
    researchSummarizeLanguage: string;
    addLinksLanguage: string;
    summarizeToMermaidLanguage: string;
    extractConceptsLanguage: string;
    translateLanguage: string;
    disableAutoTranslation: boolean;

    enableGlobalCustomPrompts: boolean;
    customPrompts: Partial<Record<TaskKey, string>>;

    // ── Search (obsidian-notemd v1.8.4) ──
    tavilyApiKey: string;
    searchProvider: 'tavily' | 'duckduckgo';
    ddgMaxResults: number;
    ddgFetchTimeout: number;
    maxResearchContentTokens: number;
    tavilyMaxResults: number;
    tavilySearchDepth: 'basic' | 'advanced';

    // ── Diagram pipeline (obsidian-notemd v1.8.4) ──
    enableExperimentalDiagramPipeline: boolean;
    experimentalDiagramCompatibilityMode: 'legacy-mermaid' | 'best-fit';
    preferredDiagramIntent?: string;
    useCustomSummarizeToMermaidSuffix: boolean;
    summarizeToMermaidCustomSuffix: string;
    useCustomSummarizeToMermaidSavePath: boolean;
    summarizeToMermaidSavePath: string;
    translateSummarizeToMermaidOutput: boolean;

    // ── Mermaid error detection (obsidian-notemd v1.8.4) ──
    enableMermaidErrorDetection: boolean;
    moveMermaidErrorFiles: boolean;
    mermaidErrorFolderPath: string;

    // ── Extract original text (obsidian-notemd v1.8.4) ──
    extractOriginalTextMergedMode: boolean;
    extractOriginalTextUseCustomOutput: boolean;
    extractOriginalTextCustomPath: string;
    extractOriginalTextCustomSuffix: string;
    translateExtractOriginalTextOutput: boolean;

    // ── Duplicate detection (obsidian-notemd v1.8.4) ──
    duplicateCheckScopeMode: 'vault' | 'include' | 'exclude' | 'concept_folder_only';
    duplicateCheckScopePaths: string;

    // ── Add links post-processing (obsidian-notemd v1.8.4) ──
    removeCodeFencesOnAddLinks: boolean;

    // ── Workflow (obsidian-notemd v1.8.4) ──
    extractQuestions: string;
    customWorkflowErrorStrategy: 'stop_on_error' | 'continue_on_error';
    customWorkflowButtonsDsl: string;

    // ── Developer diagnostics (obsidian-notemd v1.8.4) ──
    enableDeveloperMode: boolean;
    developerDiagnosticCallMode: string;
    developerDiagnosticStabilityRuns: number;
    developerDiagnosticTimeoutMs: number;
    enableApiErrorDebugMode: boolean;
    enableStableApiCall: boolean;
}

export type ProgressEventType = 'status' | 'log' | 'warning' | 'error' | 'done';

export interface ProgressEvent {
    type: ProgressEventType;
    message: string;
    percent?: number;
    operationId?: string;
    details?: Record<string, unknown>;
    timestamp: number;
}

export interface ProgressReporter {
    report(event: Omit<ProgressEvent, 'timestamp'>): void;
    isCancelled(): boolean;
}

export interface LlmCompletionRequest {
    provider: LlmProviderConfig;
    model?: string;
    prompt: string;
    content: string;
    maxTokens?: number;
    signal?: AbortSignal;
    maxRetries?: number;
    retryDelayMs?: number;
    onRetry?: (attempt: number, errorMessage: string) => void;
}

export interface LlmCompletionResult {
    text: string;
    provider: LlmProviderName;
    model: string;
}

export interface ProcessFileRequest {
    filePath: string;
    outputPath?: string;
    createConceptNotes?: boolean;
    dryRun?: boolean;
}

export interface ProcessFileResult {
    filePath: string;
    outputPath: string;
    conceptCount: number;
    concepts: string[];
    linkCount: number;
    changed: boolean;
}

export interface ProcessFolderRequest {
    folderPath: string;
    outputFolderPath?: string;
    createConceptNotes?: boolean;
    dryRun?: boolean;
}

export interface ProcessFolderResult {
    folderPath: string;
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    results: ProcessFileResult[];
    errors: Array<{ filePath: string; error: string }>;
}

export interface TranslateFileRequest {
    filePath: string;
    targetLanguage: string;
    outputPath?: string;
}

export interface TranslateFileResult {
    filePath: string;
    outputPath: string;
    changed: boolean;
}

export interface GenerateContentRequest {
    title: string;
    context?: string;
}

export class NotemdError extends Error {
    public readonly code: string;
    public readonly causeError?: unknown;

    constructor(message: string, code = 'NOTEMD_ERROR', causeError?: unknown) {
        super(message);
        this.name = 'NotemdError';
        this.code = code;
        this.causeError = causeError;
    }
}

export class ValidationError extends NotemdError {
    constructor(message: string, causeError?: unknown) {
        super(message, 'VALIDATION_ERROR', causeError);
        this.name = 'ValidationError';
    }
}

export class FileOperationError extends NotemdError {
    constructor(message: string, causeError?: unknown) {
        super(message, 'FILE_OPERATION_ERROR', causeError);
        this.name = 'FileOperationError';
    }
}

export class NetworkError extends NotemdError {
    constructor(message: string, causeError?: unknown) {
        super(message, 'NETWORK_ERROR', causeError);
        this.name = 'NetworkError';
    }
}

export interface DuplicateTerm {
    term: string;
    count: number;
}

export interface MermaidFixResult {
    content: string;
    changed: boolean;
    fixes: string[];
}

export interface FormulaFixResult {
    content: string;
    changed: boolean;
    fixes: string[];
}

// ── Diagram generation (obsidian-notemd v1.8.4) ──
export type DiagramIntent = 'mermaid' | 'vega-lite' | 'canvas';

export interface GenerateDiagramRequest {
    content: string;
    intent?: DiagramIntent;
    compatibilityMode?: 'legacy-mermaid' | 'best-fit';
    title?: string;
}

export interface GenerateDiagramResult {
    diagramType: DiagramIntent;
    spec: string;
    mermaidCode?: string;
    vegaLiteSpec?: Record<string, unknown>;
    renderErrors: string[];
    intent: DiagramIntent;
    generatedAt: string;
}

export interface PreviewDiagramRequest {
    content: string;
    diagramType?: DiagramIntent;
    format?: 'png' | 'svg';
    width?: number;
    height?: number;
}

export interface PreviewDiagramResult {
    format: string;
    dataUrl: string;
    errors: string[];
}

export interface ExportDiagramRequest {
    content: string;
    diagramType?: DiagramIntent;
    format: 'png' | 'svg';
    outputPath?: string;
}

export interface ExportDiagramResult {
    outputPath: string;
    format: string;
    size: number;
}

// ── Search (obsidian-notemd v1.8.4) ──
export interface SearchRequest {
    query: string;
    provider?: 'tavily' | 'duckduckgo';
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    fetchContent?: boolean;
    maxContentTokens?: number;
}

export interface SearchResultItem {
    title: string;
    url: string;
    content: string;
}

export interface SearchResult {
    query: string;
    provider: string;
    results: SearchResultItem[];
    totalResults: number;
    searchedAt: string;
}

// ── LLM diagnostics (obsidian-notemd v1.8.4) ──
export interface LlmDiagnoseRequest {
    provider?: string;
    model?: string;
}

export interface LlmDiagnoseResult {
    provider: string;
    model: string;
    status: 'ok' | 'error';
    latencyMs: number;
    error?: string;
    tokensUsed?: number;
}

// ── Extract original text (obsidian-notemd v1.8.4) ──
export interface ExtractOriginalTextRequest {
    filePath: string;
    mergedMode?: boolean;
    outputPath?: string;
    translateOutput?: boolean;
}

export interface ExtractOriginalTextResult {
    filePath: string;
    outputPath: string;
    originalText: string;
    changed: boolean;
}

// ── Batch progress (obsidian-notemd v1.8.4) ──
export interface BatchProgress {
    operationId: string;
    status: 'running' | 'completed' | 'cancelled' | 'error';
    totalItems: number;
    completedItems: number;
    failedItems: number;
    logs: string[];
    percent: number;
    startedAt: string;
    updatedAt: string;
}
