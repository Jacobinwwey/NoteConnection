import {
    LlmCompletionRequest,
    LlmCompletionResult,
    LlmProviderConfig,
    NetworkError,
    NotemdSettings,
    TaskKey,
    ValidationError,
} from './types';
import { getProviderDefinition, LlmProviderDefinition } from './LlmProviderDefinitions';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const RETRYABLE_STATUS_CODES = new Set([408, 409, 423, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1200;
const MAX_RETRY_DELAY_MS = 60_000;

class ProviderHttpError extends Error {
    public readonly status: number;
    public readonly retryable: boolean;
    public readonly retryAfterMs: number | null;

    constructor(message: string, status: number, retryAfterMs: number | null = null) {
        super(message);
        this.name = 'ProviderHttpError';
        this.status = status;
        this.retryable = RETRYABLE_STATUS_CODES.has(status);
        this.retryAfterMs = retryAfterMs;
    }
}

function joinUrl(baseUrl: string, suffix: string): string {
    const normalizedBase = String(baseUrl || '').trim().replace(/\/+$/, '');
    const normalizedSuffix = String(suffix || '').trim().replace(/^\/+/, '');
    return `${normalizedBase}/${normalizedSuffix}`;
}

function isAbortLike(error: unknown): boolean {
    return (
        (error instanceof Error && error.name === 'AbortError') ||
        (typeof DOMException !== 'undefined' &&
            error instanceof DOMException &&
            error.name === 'AbortError')
    );
}

function resolveErrorMessage(payload: unknown): string {
    if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        if (typeof record.error === 'string' && record.error.trim()) {
            return record.error.trim();
        }
        if (record.error && typeof record.error === 'object') {
            const nested = record.error as Record<string, unknown>;
            if (typeof nested.message === 'string' && nested.message.trim()) {
                return nested.message.trim();
            }
        }
        if (typeof record.message === 'string' && record.message.trim()) {
            return record.message.trim();
        }
    }
    return '';
}

function parseRetryAfterMs(headers: Headers): number | null {
    const raw = headers.get('retry-after');
    if (!raw) {
        return null;
    }

    const asSeconds = Number(raw.trim());
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
        return Math.floor(asSeconds * 1000);
    }

    const asDate = Date.parse(raw);
    if (Number.isFinite(asDate)) {
        return Math.max(0, asDate - Date.now());
    }

    return null;
}

function toJsonRecord(text: string): Record<string, unknown> {
    if (!text.trim()) {
        return {};
    }
    try {
        const decoded = JSON.parse(text);
        if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
            return decoded as Record<string, unknown>;
        }
        return {};
    } catch {
        return {};
    }
}

function normalizeMessageContent(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => {
                if (typeof item === 'string') {
                    return item;
                }
                if (item && typeof item === 'object') {
                    const itemRecord = item as Record<string, unknown>;
                    if (typeof itemRecord.text === 'string') {
                        return itemRecord.text;
                    }
                    if (typeof itemRecord.content === 'string') {
                        return itemRecord.content;
                    }
                }
                return '';
            })
            .filter(Boolean)
            .join('\n')
            .trim();
    }

    return '';
}

async function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            if (signal) {
                signal.removeEventListener('abort', onAbort);
            }
            resolve();
        }, ms);

        const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('Operation cancelled.'));
        };

        if (signal) {
            signal.addEventListener('abort', onAbort, { once: true });
        }
    });
}

export function selectProviderForTask(settings: NotemdSettings, taskKey: TaskKey): LlmProviderConfig {
    const desiredName = settings.useMultiModelSettings
        ? (() => {
              switch (taskKey) {
                  case 'addLinks':
                      return settings.addLinksProvider;
                  case 'generateTitle':
                      return settings.generateTitleProvider;
                  case 'translate':
                      return settings.translateProvider;
                  case 'summarizeToMermaid':
                      return settings.summarizeToMermaidProvider;
                  case 'extractConcepts':
                      return settings.extractConceptsProvider;
                  case 'extractOriginalText':
                      return settings.extractOriginalTextProvider;
                  default:
                      return settings.activeProvider;
              }
          })()
        : settings.activeProvider;

    const provider = settings.providers.find((item) => item.name === desiredName);
    if (!provider) {
        throw new ValidationError(`LLM provider "${desiredName}" is not configured.`);
    }

    return provider;
}

export function selectModelForTask(
    settings: NotemdSettings,
    taskKey: TaskKey,
    provider: LlmProviderConfig
): string {
    if (!settings.useMultiModelSettings) {
        return provider.model;
    }

    const fromTask = (() => {
        switch (taskKey) {
            case 'addLinks':
                return settings.addLinksModel;
            case 'generateTitle':
                return settings.generateTitleModel;
            case 'translate':
                return settings.translateModel;
            case 'summarizeToMermaid':
                return settings.summarizeToMermaidModel;
            case 'extractConcepts':
                return settings.extractConceptsModel;
            case 'extractOriginalText':
                return settings.extractOriginalTextModel;
            default:
                return '';
        }
    })();

    return String(fromTask || provider.model).trim() || provider.model;
}

export class LlmProviderClient {
    private readonly fetchImpl: FetchLike;

    constructor(fetchImpl?: FetchLike) {
        this.fetchImpl = fetchImpl || (globalThis.fetch as FetchLike);
        if (typeof this.fetchImpl !== 'function') {
            throw new ValidationError('Global fetch is unavailable. Node.js 18+ is required.');
        }
    }

    public async testConnection(
        provider: LlmProviderConfig,
        signal?: AbortSignal
    ): Promise<{ success: boolean; message: string }> {
        const definition = getProviderDefinition(provider.name);
        try {
            this.assertProviderConfig(provider, definition);

            if (
                definition.transport === 'openai-compatible' &&
                definition.apiTestMode === 'models-then-chat'
            ) {
                try {
                    const modelCount = await this.probeOpenAiCompatibleModels(
                        provider,
                        definition,
                        signal
                    );
                    return {
                        success: true,
                        message: `Connected to ${provider.name}. Model catalog probe succeeded (${modelCount} models).`,
                    };
                } catch {
                    // Fall through to chat probe for compatibility with gateways that disable /models.
                }
            }

            const result = await this.complete({
                provider,
                model: provider.model,
                prompt: 'Reply with exactly: OK',
                content: 'Connection test.',
                maxTokens: 16,
                signal,
                maxRetries: 0,
                retryDelayMs: 0,
            });
            return {
                success: true,
                message: `Connected to ${provider.name} (${result.model}).`,
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }

    public async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
        const provider = request.provider;
        const definition = getProviderDefinition(provider.name);
        this.assertProviderConfig(provider, definition);

        const model = String(request.model || provider.model || '').trim();
        if (!model) {
            throw new ValidationError(`Provider "${provider.name}" has no model configured.`);
        }

        const prompt = String(request.prompt || '').trim();
        const content = String(request.content || '');
        const maxTokens = Math.max(1, Math.floor(request.maxTokens || 1024));
        const maxRetries = Math.max(0, Math.floor(request.maxRetries ?? DEFAULT_MAX_RETRIES));
        const retryDelayMs = Math.max(0, Math.floor(request.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
        const signal = request.signal;

        let lastError: unknown = null;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            if (signal?.aborted) {
                throw new Error('Operation cancelled.');
            }

            try {
                const text = await this.callProvider({
                    provider,
                    definition,
                    model,
                    prompt,
                    content,
                    maxTokens,
                    signal,
                });
                if (!text.trim()) {
                    throw new NetworkError(`${provider.name} returned an empty completion.`);
                }
                return { text, provider: provider.name, model };
            } catch (error) {
                if (isAbortLike(error)) {
                    throw error;
                }

                lastError = error;
                const retryable = error instanceof ProviderHttpError ? error.retryable : true;
                const isLastAttempt = attempt >= maxRetries;
                if (!retryable || isLastAttempt) {
                    break;
                }

                request.onRetry?.(
                    attempt + 1,
                    error instanceof Error ? error.message : String(error)
                );
                const backoff = this.resolveRetryDelayMs(
                    attempt,
                    retryDelayMs,
                    error instanceof ProviderHttpError ? error.retryAfterMs : null
                );
                await waitWithAbort(backoff, signal);
            }
        }

        if (lastError instanceof Error) {
            throw lastError;
        }
        throw new NetworkError(`${provider.name} completion failed.`);
    }

    private resolveRetryDelayMs(
        attempt: number,
        retryDelayMs: number,
        retryAfterMs: number | null
    ): number {
        const exponential = Math.min(MAX_RETRY_DELAY_MS, retryDelayMs * Math.max(1, 2 ** attempt));
        const jitter = Math.floor(Math.random() * Math.min(250, exponential));
        const computed = exponential + jitter;
        if (Number.isFinite(retryAfterMs) && (retryAfterMs as number) > 0) {
            return Math.max(computed, Math.min(MAX_RETRY_DELAY_MS, retryAfterMs as number));
        }
        return computed;
    }

    private assertProviderConfig(
        provider: LlmProviderConfig,
        definition: LlmProviderDefinition
    ): void {
        const apiKey = String(provider.apiKey || '').trim();
        const baseUrl = String(provider.baseUrl || '').trim();

        if (!baseUrl) {
            throw new ValidationError(`Provider "${provider.name}" requires a base URL.`);
        }
        if (definition.apiKeyMode === 'required' && !apiKey) {
            throw new ValidationError(`Provider "${provider.name}" requires an API key.`);
        }
        if (definition.transport === 'azure-openai') {
            if (!String(provider.apiVersion || '').trim()) {
                throw new ValidationError('Azure OpenAI requires apiVersion.');
            }
        }
    }

    private async callProvider(args: {
        provider: LlmProviderConfig;
        definition: LlmProviderDefinition;
        model: string;
        prompt: string;
        content: string;
        maxTokens: number;
        signal?: AbortSignal;
    }): Promise<string> {
        switch (args.definition.transport) {
            case 'openai-compatible':
                return this.callOpenAICompatible(args);
            case 'azure-openai':
                return this.callAzureOpenAI(args);
            case 'anthropic':
                return this.callAnthropic(args);
            case 'google':
                return this.callGoogle(args);
            case 'ollama':
                return this.callOllama(args);
            default:
                throw new ValidationError(`Unsupported provider transport: ${args.definition.transport}`);
        }
    }

    private async parseJsonResponse(
        response: Response,
        providerName: string
    ): Promise<Record<string, unknown>> {
        const text = await response.text();
        const data = toJsonRecord(text);

        if (!response.ok) {
            const fromPayload = resolveErrorMessage(data);
            const message =
                fromPayload || text || `${providerName} API failed with status ${response.status}.`;
            throw new ProviderHttpError(
                message,
                response.status,
                parseRetryAfterMs(response.headers)
            );
        }

        return data;
    }

    private buildOpenAiCompatibleHeaders(
        provider: LlmProviderConfig,
        definition: LlmProviderDefinition
    ): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const apiKey = String(provider.apiKey || '').trim();
        if ((definition.apiKeyMode === 'required' || definition.apiKeyMode === 'optional') && apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        if (definition.extraHeaders) {
            Object.keys(definition.extraHeaders).forEach((key) => {
                const value = String(definition.extraHeaders?.[key] || '').trim();
                if (value) {
                    headers[key] = value;
                }
            });
        }

        return headers;
    }

    private async probeOpenAiCompatibleModels(
        provider: LlmProviderConfig,
        definition: LlmProviderDefinition,
        signal?: AbortSignal
    ): Promise<number> {
        const url = joinUrl(provider.baseUrl, 'models');
        const response = await this.fetchImpl(url, {
            method: 'GET',
            headers: this.buildOpenAiCompatibleHeaders(provider, definition),
            signal,
        });
        const payload = await this.parseJsonResponse(response, provider.name);
        const models = Array.isArray(payload.data) ? payload.data : [];
        return models.length;
    }

    private async callOpenAICompatible(args: {
        provider: LlmProviderConfig;
        definition: LlmProviderDefinition;
        model: string;
        prompt: string;
        content: string;
        maxTokens: number;
        signal?: AbortSignal;
    }): Promise<string> {
        const { provider, definition } = args;
        const url = joinUrl(provider.baseUrl, 'chat/completions');
        const loweredModel = args.model.toLowerCase();
        const isReasoningModel =
            /^o[13]/i.test(args.model) || /reasoner|r1|thinking/.test(loweredModel);
        const combinedUserContent = `${args.prompt}\n\n${args.content}`.trim();

        const payload: Record<string, unknown> = {
            model: args.model,
            messages: isReasoningModel
                ? [{ role: 'user', content: combinedUserContent }]
                : [
                      { role: 'system', content: args.prompt },
                      { role: 'user', content: args.content || 'Proceed.' },
                  ],
        };

        if (isReasoningModel) {
            payload.max_completion_tokens = args.maxTokens;
        } else {
            payload.max_tokens = args.maxTokens;
            payload.temperature = Number.isFinite(provider.temperature)
                ? provider.temperature
                : 0.5;
        }

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: this.buildOpenAiCompatibleHeaders(provider, definition),
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);

        const choices = Array.isArray(data.choices) ? data.choices : [];
        const firstChoice =
            choices.length > 0 && choices[0] && typeof choices[0] === 'object'
                ? (choices[0] as Record<string, unknown>)
                : {};
        const message =
            firstChoice.message && typeof firstChoice.message === 'object'
                ? (firstChoice.message as Record<string, unknown>)
                : {};
        const text =
            normalizeMessageContent(message.content) ||
            String(message.reasoning || '').trim() ||
            String(firstChoice.text || '').trim();

        if (!text) {
            throw new NetworkError(`${provider.name} returned no completion content.`);
        }
        return text;
    }

    private async callAzureOpenAI(args: {
        provider: LlmProviderConfig;
        model: string;
        prompt: string;
        content: string;
        maxTokens: number;
        signal?: AbortSignal;
    }): Promise<string> {
        const { provider } = args;
        const deployment = encodeURIComponent(args.model);
        const apiVersion = String(provider.apiVersion || '').trim();
        const url = `${provider.baseUrl.replace(
            /\/+$/,
            ''
        )}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(
            apiVersion
        )}`;
        const payload: Record<string, unknown> = {
            messages: [
                { role: 'system', content: args.prompt },
                { role: 'user', content: args.content || 'Proceed.' },
            ],
            max_tokens: args.maxTokens,
            temperature: Number.isFinite(provider.temperature) ? provider.temperature : 0.5,
        };

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': String(provider.apiKey || '').trim(),
            },
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);
        const choices = Array.isArray(data.choices) ? data.choices : [];
        const firstChoice =
            choices.length > 0 && choices[0] && typeof choices[0] === 'object'
                ? (choices[0] as Record<string, unknown>)
                : {};
        const message =
            firstChoice.message && typeof firstChoice.message === 'object'
                ? (firstChoice.message as Record<string, unknown>)
                : {};
        const text = normalizeMessageContent(message.content);
        if (!text) {
            throw new NetworkError('Azure OpenAI returned no completion content.');
        }
        return text;
    }

    private async callAnthropic(args: {
        provider: LlmProviderConfig;
        model: string;
        prompt: string;
        content: string;
        maxTokens: number;
        signal?: AbortSignal;
    }): Promise<string> {
        const { provider } = args;
        const url = joinUrl(provider.baseUrl, 'v1/messages');
        const payload = {
            model: args.model,
            system: args.prompt,
            messages: [{ role: 'user', content: args.content || 'Proceed.' }],
            max_tokens: args.maxTokens,
            temperature: Number.isFinite(provider.temperature) ? provider.temperature : 0.5,
        };

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': String(provider.apiKey || '').trim(),
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);
        const parts = Array.isArray(data.content) ? data.content : [];
        const text = parts
            .map((item) =>
                item && typeof item === 'object'
                    ? String((item as Record<string, unknown>).text || '')
                    : ''
            )
            .join('\n')
            .trim();
        if (!text) {
            throw new NetworkError('Anthropic returned no completion content.');
        }
        return text;
    }

    private async callGoogle(args: {
        provider: LlmProviderConfig;
        model: string;
        prompt: string;
        content: string;
        maxTokens: number;
        signal?: AbortSignal;
    }): Promise<string> {
        const { provider } = args;
        const apiKey = String(provider.apiKey || '').trim();
        const url = `${provider.baseUrl.replace(
            /\/+$/,
            ''
        )}/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(
            apiKey
        )}`;
        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${args.prompt}\n\n${args.content}`.trim() }],
                },
            ],
            generationConfig: {
                temperature: Number.isFinite(provider.temperature) ? provider.temperature : 0.5,
                maxOutputTokens: args.maxTokens,
            },
        };

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);
        const candidates = Array.isArray(data.candidates) ? data.candidates : [];
        const firstCandidate =
            candidates.length > 0 && candidates[0] && typeof candidates[0] === 'object'
                ? (candidates[0] as Record<string, unknown>)
                : {};
        const candidateContent =
            firstCandidate.content && typeof firstCandidate.content === 'object'
                ? (firstCandidate.content as Record<string, unknown>)
                : {};
        const parts = Array.isArray(candidateContent.parts) ? candidateContent.parts : [];
        const text = parts
            .map((item) =>
                item && typeof item === 'object'
                    ? String((item as Record<string, unknown>).text || '')
                    : ''
            )
            .join('\n')
            .trim();
        if (!text) {
            throw new NetworkError('Google returned no completion content.');
        }
        return text;
    }

    private async callOllama(args: {
        provider: LlmProviderConfig;
        model: string;
        prompt: string;
        content: string;
        maxTokens: number;
        signal?: AbortSignal;
    }): Promise<string> {
        const { provider } = args;
        const url = joinUrl(provider.baseUrl, 'chat');
        const payload = {
            model: args.model,
            messages: [
                { role: 'system', content: args.prompt },
                { role: 'user', content: args.content || 'Proceed.' },
            ],
            stream: false,
            options: {
                temperature: Number.isFinite(provider.temperature) ? provider.temperature : 0.5,
                num_predict: args.maxTokens,
            },
        };

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);
        const message =
            data.message && typeof data.message === 'object'
                ? (data.message as Record<string, unknown>)
                : {};
        const text = String(message.content || '').trim();
        if (!text) {
            throw new NetworkError('Ollama returned no completion content.');
        }
        return text;
    }
}
