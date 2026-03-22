import {
    LlmCompletionRequest,
    LlmCompletionResult,
    LlmProviderConfig,
    NetworkError,
    NotemdSettings,
    TaskKey,
    ValidationError,
} from './types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

class ProviderHttpError extends Error {
    public readonly status: number;
    public readonly retryable: boolean;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ProviderHttpError';
        this.status = status;
        this.retryable = status === 408 || status === 429 || status >= 500;
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
        (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
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

export function selectModelForTask(settings: NotemdSettings, taskKey: TaskKey, provider: LlmProviderConfig): string {
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

    public async testConnection(provider: LlmProviderConfig, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
        try {
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
        const model = String(request.model || provider.model || '').trim();
        if (!model) {
            throw new ValidationError(`Provider "${provider.name}" has no model configured.`);
        }

        const prompt = String(request.prompt || '').trim();
        const content = String(request.content || '');
        const maxTokens = Math.max(1, Math.floor(request.maxTokens || 1024));
        const maxRetries = Math.max(0, Math.floor(request.maxRetries ?? 2));
        const retryDelayMs = Math.max(0, Math.floor(request.retryDelayMs ?? 1200));
        const signal = request.signal;

        let lastError: unknown = null;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            if (signal?.aborted) {
                throw new Error('Operation cancelled.');
            }
            try {
                const text = await this.callProvider({
                    provider,
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

                request.onRetry?.(attempt + 1, error instanceof Error ? error.message : String(error));
                const backoff = retryDelayMs * Math.max(1, 2 ** attempt);
                await waitWithAbort(backoff, signal);
            }
        }

        if (lastError instanceof Error) {
            throw lastError;
        }
        throw new NetworkError(`${provider.name} completion failed.`);
    }

    private async callProvider(args: {
        provider: LlmProviderConfig;
        model: string;
        prompt: string;
        content: string;
        maxTokens: number;
        signal?: AbortSignal;
    }): Promise<string> {
        const { provider } = args;
        switch (provider.name) {
            case 'OpenAI':
            case 'DeepSeek':
            case 'Mistral':
            case 'OpenRouter':
            case 'xAI':
            case 'LMStudio':
                return this.callOpenAICompatible(provider, args);
            case 'Azure OpenAI':
                return this.callAzureOpenAI(provider, args);
            case 'Anthropic':
                return this.callAnthropic(provider, args);
            case 'Google':
                return this.callGoogle(provider, args);
            case 'Ollama':
                return this.callOllama(provider, args);
            default:
                throw new ValidationError(`Unsupported provider: ${provider.name}`);
        }
    }

    private async parseJsonResponse(response: Response, providerName: string): Promise<Record<string, unknown>> {
        const text = await response.text();
        let data: Record<string, unknown> = {};
        try {
            data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
            data = {};
        }

        if (!response.ok) {
            const fromPayload = resolveErrorMessage(data);
            const message = fromPayload || text || `${providerName} API failed with status ${response.status}.`;
            throw new ProviderHttpError(message, response.status);
        }

        return data;
    }

    private async callOpenAICompatible(
        provider: LlmProviderConfig,
        args: {
            model: string;
            prompt: string;
            content: string;
            maxTokens: number;
            signal?: AbortSignal;
        }
    ): Promise<string> {
        const url = joinUrl(provider.baseUrl, 'chat/completions');
        const isReasoningModel = /^o[13]/i.test(args.model) || /reasoner|r1/i.test(args.model);
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

        if (provider.name === 'DeepSeek' && /reasoner|r1/i.test(args.model)) {
            payload.max_completion_tokens = args.maxTokens;
        } else {
            payload.max_tokens = args.maxTokens;
        }

        if (!isReasoningModel) {
            payload.temperature = provider.temperature;
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (provider.name === 'LMStudio') {
            headers.Authorization = `Bearer ${provider.apiKey || 'EMPTY'}`;
        } else if (provider.apiKey.trim()) {
            headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
        }
        if (provider.name === 'OpenRouter') {
            headers['HTTP-Referer'] = 'https://github.com/Jacobinwwey/NoteConnection';
            headers['X-Title'] = 'NoteConnection NoteMD';
        }

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);
        const choices = Array.isArray(data.choices) ? data.choices : [];
        const firstChoice = (choices[0] || {}) as Record<string, unknown>;
        const message = (firstChoice.message || {}) as Record<string, unknown>;
        const content = String(message.content || '').trim();
        const reasoning = String((message as Record<string, unknown>).reasoning || '').trim();
        const text = content || reasoning;
        if (!text) {
            throw new NetworkError(`${provider.name} returned no completion content.`);
        }
        return text;
    }

    private async callAzureOpenAI(
        provider: LlmProviderConfig,
        args: {
            model: string;
            prompt: string;
            content: string;
            maxTokens: number;
            signal?: AbortSignal;
        }
    ): Promise<string> {
        if (!provider.apiVersion || !provider.baseUrl) {
            throw new ValidationError('Azure OpenAI requires baseUrl and apiVersion.');
        }

        const deployment = encodeURIComponent(args.model);
        const url = `${provider.baseUrl.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(provider.apiVersion)}`;
        const payload: Record<string, unknown> = {
            messages: [
                { role: 'system', content: args.prompt },
                { role: 'user', content: args.content || 'Proceed.' },
            ],
            max_tokens: args.maxTokens,
            temperature: provider.temperature,
        };

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': provider.apiKey.trim(),
            },
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);
        const choices = Array.isArray(data.choices) ? data.choices : [];
        const firstChoice = (choices[0] || {}) as Record<string, unknown>;
        const message = (firstChoice.message || {}) as Record<string, unknown>;
        const text = String(message.content || '').trim();
        if (!text) {
            throw new NetworkError('Azure OpenAI returned no completion content.');
        }
        return text;
    }

    private async callAnthropic(
        provider: LlmProviderConfig,
        args: {
            model: string;
            prompt: string;
            content: string;
            maxTokens: number;
            signal?: AbortSignal;
        }
    ): Promise<string> {
        const url = joinUrl(provider.baseUrl, 'v1/messages');
        const payload = {
            model: args.model,
            system: args.prompt,
            messages: [{ role: 'user', content: args.content || 'Proceed.' }],
            max_tokens: args.maxTokens,
            temperature: provider.temperature,
        };

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': provider.apiKey.trim(),
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(payload),
            signal: args.signal,
        });
        const data = await this.parseJsonResponse(response, provider.name);
        const parts = Array.isArray(data.content) ? data.content : [];
        const text = parts
            .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>).text || '') : ''))
            .join('\n')
            .trim();
        if (!text) {
            throw new NetworkError('Anthropic returned no completion content.');
        }
        return text;
    }

    private async callGoogle(
        provider: LlmProviderConfig,
        args: {
            model: string;
            prompt: string;
            content: string;
            maxTokens: number;
            signal?: AbortSignal;
        }
    ): Promise<string> {
        const url = `${provider.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(provider.apiKey.trim())}`;
        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${args.prompt}\n\n${args.content}`.trim() }],
                },
            ],
            generationConfig: {
                temperature: provider.temperature,
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
        const firstCandidate = (candidates[0] || {}) as Record<string, unknown>;
        const candidateContent = (firstCandidate.content || {}) as Record<string, unknown>;
        const parts = Array.isArray(candidateContent.parts) ? candidateContent.parts : [];
        const text = parts
            .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>).text || '') : ''))
            .join('\n')
            .trim();
        if (!text) {
            throw new NetworkError('Google returned no completion content.');
        }
        return text;
    }

    private async callOllama(
        provider: LlmProviderConfig,
        args: {
            model: string;
            prompt: string;
            content: string;
            maxTokens: number;
            signal?: AbortSignal;
        }
    ): Promise<string> {
        const url = joinUrl(provider.baseUrl, 'chat');
        const payload = {
            model: args.model,
            messages: [
                { role: 'system', content: args.prompt },
                { role: 'user', content: args.content || 'Proceed.' },
            ],
            stream: false,
            options: {
                temperature: provider.temperature,
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
        const message = (data.message || {}) as Record<string, unknown>;
        const text = String(message.content || '').trim();
        if (!text) {
            throw new NetworkError('Ollama returned no completion content.');
        }
        return text;
    }
}

