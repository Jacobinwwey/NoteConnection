import { LlmProviderConfig, NotemdSettings, ProgressReporter } from './types';

export const DEFAULT_PROVIDER_DIAGNOSTIC_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RESPONSE_PREVIEW_CHARS = 8000;
export const DEFAULT_PROVIDER_DIAGNOSTIC_CALL_MODE: ProviderDiagnosticCallMode = 'runtime-stable';
export const DEFAULT_PROVIDER_DIAGNOSTIC_STABILITY_RUNS = 3;
export const MAX_PROVIDER_DIAGNOSTIC_STABILITY_RUNS = 10;

export type ProviderDiagnosticCallMode =
    | 'runtime-stable'
    | 'runtime-requesturl-first';

export interface ProviderDiagnosticCallModeOption {
    value: ProviderDiagnosticCallMode;
    label: string;
    description: string;
    openaiCompatibleOnly: boolean;
}

const PROVIDER_DIAGNOSTIC_CALL_MODE_OPTIONS: ProviderDiagnosticCallModeOption[] = [
    {
        value: 'runtime-stable',
        label: 'Runtime stable (auto)',
        description: 'Use the stable runtime path (stream -> non-stream -> fallback).',
        openaiCompatibleOnly: false
    },
    {
        value: 'runtime-requesturl-first',
        label: 'Runtime requestUrl-first',
        description: 'Use requestUrl-first runtime behavior before streamed fallback parsing.',
        openaiCompatibleOnly: false
    }
];

export interface ProviderDiagnosticOperationInput {
    providerName: string;
    model: string;
    callMode: ProviderDiagnosticCallMode;
    timeoutMs: number;
    stabilityRuns: number;
}

export interface ProviderDiagnosticProbeResult {
    success: boolean;
    elapsedMs: number;
    callMode: ProviderDiagnosticCallMode;
    requestedCallMode: ProviderDiagnosticCallMode;
    responseText?: string;
    errorMessage?: string;
    debugInfo?: string;
    logs: string[];
    report: string;
}

export interface ProviderDiagnosticStabilityProbeResult {
    runs: number;
    callMode: ProviderDiagnosticCallMode;
    requestedCallMode: ProviderDiagnosticCallMode;
    successCount: number;
    failureCount: number;
    totalElapsedMs: number;
    runResults: ProviderDiagnosticProbeResult[];
    report: string;
}

function redactApiKey(apiKey: string): string {
    if (!apiKey) return '(empty)';
    if (apiKey.length <= 6) return '[REDACTED]';
    return `${apiKey.slice(0, 3)}...${apiKey.slice(-3)} (redacted)`;
}

function normalizeMultiline(input: string): string {
    return input.replace(/\r\n/g, '\n');
}

function clipPreview(input: string, maxChars: number = MAX_RESPONSE_PREVIEW_CHARS): string {
    if (input.length <= maxChars) return input;
    return `${input.slice(0, maxChars)}\n\n...[${input.length - maxChars} chars omitted]`;
}

function normalizeStabilityRuns(input: number | undefined): number {
    const numeric = Number.isFinite(input) ? Math.floor(input as number) : DEFAULT_PROVIDER_DIAGNOSTIC_STABILITY_RUNS;
    if (numeric < 1) return 1;
    return Math.min(numeric, MAX_PROVIDER_DIAGNOSTIC_STABILITY_RUNS);
}

export function getProviderDiagnosticCallModeOptions(_provider: LlmProviderConfig): ProviderDiagnosticCallModeOption[] {
    return PROVIDER_DIAGNOSTIC_CALL_MODE_OPTIONS.map(option => ({ ...option }));
}

export function buildDefaultProviderDiagnosticPayload(providerName: string): { prompt: string; content: string } {
    const prompt = 'You are a diagnostic assistant. Return plain markdown text only. Do not use code fences.';
    const contentBlock = 'Please produce a structured diagnostic response with: summary, numbered findings, risk notes, and a final checklist. Expand each section with details.';
    const repeated = Array.from({ length: 10 }, (_, idx) => `Input block ${idx + 1}: ${contentBlock}`).join('\n\n');
    return { prompt, content: `Provider diagnostic target: ${providerName}\n\n${repeated}` };
}

export function buildProviderDiagnosticFileName(providerName: string, now: Date): string {
    const safeProviderName = providerName
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'provider';
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    return `Notemd_Provider_Diagnostic_${safeProviderName}_${timestamp}.txt`;
}

export function buildProviderDiagnosticOperationInput(
    provider: LlmProviderConfig,
    settings: NotemdSettings
): ProviderDiagnosticOperationInput {
    return {
        providerName: provider.name,
        model: provider.model,
        callMode: (settings.developerDiagnosticCallMode as ProviderDiagnosticCallMode) || DEFAULT_PROVIDER_DIAGNOSTIC_CALL_MODE,
        timeoutMs: settings.developerDiagnosticTimeoutMs ?? DEFAULT_PROVIDER_DIAGNOSTIC_TIMEOUT_MS,
        stabilityRuns: settings.developerDiagnosticStabilityRuns ?? DEFAULT_PROVIDER_DIAGNOSTIC_STABILITY_RUNS
    };
}

function createInMemoryProgressReporter(logs: string[]): ProgressReporter {
    let cancelled = false;
    const reporter: ProgressReporter = {
        report(_event) { /* no-op for diagnostics */ },
        isCancelled() { return cancelled; }
    };
    (reporter as any).log = (message: string) => { logs.push(`[${new Date().toISOString()}] ${message}`); };
    return reporter;
}

function buildProviderDiagnosticReport(params: {
    provider: LlmProviderConfig;
    settings: NotemdSettings;
    startedAt: Date;
    timeoutMs: number;
    callMode: ProviderDiagnosticCallMode;
    requestedCallMode: ProviderDiagnosticCallMode;
    success: boolean;
    elapsedMs: number;
    logs: string[];
    responseText?: string;
    errorMessage?: string;
    debugInfo?: string;
}): string {
    const { provider, settings, startedAt, timeoutMs, callMode, requestedCallMode, success, elapsedMs, logs, responseText, errorMessage, debugInfo } = params;
    const sections: string[] = [
        'Notemd Provider Diagnostic Report',
        `Generated At: ${startedAt.toISOString()}`,
        '',
        '=== Provider Context ===',
        `Provider: ${provider.name}`,
        `Base URL: ${provider.baseUrl}`,
        `Model: ${provider.model}`,
        `Temperature: ${provider.temperature}`,
        `API Key: ${redactApiKey(provider.apiKey)}`,
        '',
        '=== Runtime Settings ===',
        `Stable API Calls: ${settings.enableStableApiCall ? 'enabled' : 'disabled'}`,
        `Max Retries: ${settings.maxRetries}`,
        `Requested Call Mode: ${requestedCallMode}`,
        `Effective Call Mode: ${callMode}`,
        `Timeout: ${timeoutMs}ms`,
        '',
        '=== Result ===',
        `Result: ${success ? 'SUCCESS' : 'FAILED'}`,
        `Elapsed: ${elapsedMs}ms`
    ];
    if (errorMessage) sections.push(`Error: ${errorMessage}`);
    if (debugInfo) sections.push('', '=== Debug Details ===', normalizeMultiline(debugInfo));
    if (responseText && responseText.trim()) sections.push('', '=== Response Preview ===', clipPreview(normalizeMultiline(responseText)));
    sections.push('', '=== Runtime Logs ===');
    sections.push(logs.length > 0 ? logs.join('\n') : '(no logs captured)');
    return sections.join('\n');
}

export async function runProviderDiagnosticProbe(
    provider: LlmProviderConfig,
    settings: NotemdSettings,
    llmCallImpl: (provider: LlmProviderConfig, prompt: string, content: string, settings: NotemdSettings, signal?: AbortSignal) => Promise<string>,
    options: { timeoutMs?: number; callMode?: ProviderDiagnosticCallMode; now?: Date } = {}
): Promise<ProviderDiagnosticProbeResult> {
    const payload = buildDefaultProviderDiagnosticPayload(provider.name);
    const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_DIAGNOSTIC_TIMEOUT_MS;
    const requestedCallMode = options.callMode ?? DEFAULT_PROVIDER_DIAGNOSTIC_CALL_MODE;
    const callMode = requestedCallMode;
    const runtimeStartedAtMs = Date.now();
    const startedAt = options.now ?? new Date(runtimeStartedAtMs);
    const logs: string[] = [];
    const reporter = createInMemoryProgressReporter(logs);

    (reporter as any).log(`Developer diagnostic started for ${provider.name}.`);
    (reporter as any).log(`Using model '${provider.model}' at '${provider.baseUrl}'.`);
    (reporter as any).log(`Effective call mode: ${callMode}.`);
    (reporter as any).log(`Timeout configured to ${timeoutMs}ms.`);

    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let success = false;
    let responseText: string | undefined;
    let errorMessage: string | undefined;
    let debugInfo: string | undefined;

    try {
        timeoutHandle = setTimeout(() => {
            (reporter as any).log(`Diagnostic timeout reached (${timeoutMs}ms). Aborting request.`);
            controller.abort();
        }, timeoutMs);

        responseText = await llmCallImpl(
            provider,
            payload.prompt,
            payload.content,
            { ...settings, enableApiErrorDebugMode: true, enableStableApiCall: true },
            controller.signal
        );
        success = true;
        (reporter as any).log(`Diagnostic completed successfully. Response length: ${responseText.length} chars.`);
    } catch (error: unknown) {
        errorMessage = error instanceof Error ? error.message : String(error);
        debugInfo = error instanceof Error ? error.stack : undefined;
        (reporter as any).log(`Diagnostic failed: ${errorMessage}`);
        if (debugInfo) (reporter as any).log(`Diagnostic debug details:\n${debugInfo}`);
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const elapsedMs = Date.now() - runtimeStartedAtMs;
    const report = buildProviderDiagnosticReport({
        provider, settings, startedAt, timeoutMs, callMode, requestedCallMode,
        success, elapsedMs, logs, responseText, errorMessage, debugInfo
    });

    return { success, elapsedMs, callMode, requestedCallMode, responseText, errorMessage, debugInfo, logs, report };
}

function buildProviderDiagnosticStabilityReport(params: {
    provider: LlmProviderConfig;
    requestedCallMode: ProviderDiagnosticCallMode;
    callMode: ProviderDiagnosticCallMode;
    runs: number;
    successCount: number;
    failureCount: number;
    totalElapsedMs: number;
    runResults: ProviderDiagnosticProbeResult[];
}): string {
    const { provider, requestedCallMode, callMode, runs, successCount, failureCount, totalElapsedMs, runResults } = params;
    const lines: string[] = [
        'Notemd Provider Diagnostic Stability Report',
        `Generated At: ${new Date().toISOString()}`,
        '',
        '=== Provider Context ===',
        `Provider: ${provider.name}`,
        `Base URL: ${provider.baseUrl}`,
        `Model: ${provider.model}`,
        `Requested Call Mode: ${requestedCallMode}`,
        `Effective Call Mode: ${callMode}`,
        '',
        '=== Summary ===',
        `Runs: ${runs}`,
        `Success: ${successCount}`,
        `Failed: ${failureCount}`,
        `Total Elapsed: ${totalElapsedMs}ms`,
        `Average Elapsed: ${runs > 0 ? Math.round(totalElapsedMs / runs) : 0}ms`,
        ''
    ];
    runResults.forEach((run, index) => {
        lines.push(`=== Run ${index + 1} ===`);
        lines.push(`Result: ${run.success ? 'SUCCESS' : 'FAILED'}`);
        lines.push(`Elapsed: ${run.elapsedMs}ms`);
        if (run.errorMessage) lines.push(`Error: ${run.errorMessage}`);
        if (run.debugInfo) { lines.push('Debug:'); lines.push(normalizeMultiline(run.debugInfo)); }
        lines.push('');
    });
    return lines.join('\n');
}

export async function runProviderDiagnosticStabilityProbe(
    provider: LlmProviderConfig,
    settings: NotemdSettings,
    llmCallImpl: (provider: LlmProviderConfig, prompt: string, content: string, settings: NotemdSettings, signal?: AbortSignal) => Promise<string>,
    options: { runs?: number; callMode?: ProviderDiagnosticCallMode; timeoutMs?: number } = {}
): Promise<ProviderDiagnosticStabilityProbeResult> {
    const runs = normalizeStabilityRuns(options.runs);
    const requestedCallMode = options.callMode ?? DEFAULT_PROVIDER_DIAGNOSTIC_CALL_MODE;
    const runResults: ProviderDiagnosticProbeResult[] = [];
    const startedAtMs = Date.now();

    for (let runIndex = 0; runIndex < runs; runIndex += 1) {
        const runResult = await runProviderDiagnosticProbe(provider, settings, llmCallImpl, {
            ...options,
            callMode: requestedCallMode
        });
        runResults.push(runResult);
    }

    const totalElapsedMs = Date.now() - startedAtMs;
    const successCount = runResults.filter(run => run.success).length;
    const failureCount = runResults.length - successCount;
    const report = buildProviderDiagnosticStabilityReport({
        provider, requestedCallMode, callMode: requestedCallMode,
        runs, successCount, failureCount, totalElapsedMs, runResults
    });

    return { runs, callMode: requestedCallMode, requestedCallMode, successCount, failureCount, totalElapsedMs, runResults, report };
}
