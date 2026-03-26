import { LlmProviderConfig, LlmProviderName } from './types';

export type LlmProviderCategory = 'cloud' | 'gateway' | 'local';
export type LlmProviderTransport =
    | 'openai-compatible'
    | 'anthropic'
    | 'google'
    | 'azure-openai'
    | 'ollama';
export type LlmProviderApiKeyMode = 'required' | 'optional' | 'none';
export type LlmProviderApiTestMode = 'models-then-chat' | 'chat-only';

export interface LlmProviderDefinition {
    name: LlmProviderName;
    category: LlmProviderCategory;
    transport: LlmProviderTransport;
    apiKeyMode: LlmProviderApiKeyMode;
    apiTestMode: LlmProviderApiTestMode;
    description: string;
    defaultConfig: Omit<LlmProviderConfig, 'name'>;
    extraHeaders?: Record<string, string>;
}

export const DEFAULT_PROVIDER_NAME: LlmProviderName = 'DeepSeek';

export const LLM_PROVIDER_DEFINITIONS: LlmProviderDefinition[] = [
    {
        name: 'DeepSeek',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'DeepSeek official cloud endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.deepseek.com/v1',
            model: 'deepseek-reasoner',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'OpenAI',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'OpenAI official endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Anthropic',
        category: 'cloud',
        transport: 'anthropic',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'Anthropic Messages API',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-3-5-sonnet-20240620',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Google',
        category: 'cloud',
        transport: 'google',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'Google Gemini API',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://generativelanguage.googleapis.com/v1',
            model: 'gemini-2.0-flash',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Mistral',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'Mistral cloud endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.mistral.ai/v1',
            model: 'mistral-large-latest',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Azure OpenAI',
        category: 'cloud',
        transport: 'azure-openai',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'Azure OpenAI deployment endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: '',
            model: 'gpt-4o',
            temperature: 0.5,
            apiVersion: '2025-01-01-preview',
            enabled: true,
        },
    },
    {
        name: 'LMStudio',
        category: 'local',
        transport: 'openai-compatible',
        apiKeyMode: 'none',
        apiTestMode: 'chat-only',
        description: 'LM Studio local OpenAI-compatible server',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'http://localhost:1234/v1',
            model: 'local-model',
            temperature: 0.7,
            enabled: true,
        },
    },
    {
        name: 'Ollama',
        category: 'local',
        transport: 'ollama',
        apiKeyMode: 'none',
        apiTestMode: 'chat-only',
        description: 'Ollama local endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'http://localhost:11434/api',
            model: 'llama3',
            temperature: 0.7,
            enabled: true,
        },
    },
    {
        name: 'OpenRouter',
        category: 'gateway',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'OpenRouter aggregator endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-4o-mini',
            temperature: 0.7,
            enabled: true,
        },
        extraHeaders: {
            'HTTP-Referer': 'https://github.com/Jacobinwwey/NoteConnection',
            'X-Title': 'NoteConnection NoteMD',
        },
    },
    {
        name: 'xAI',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'xAI Grok endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.x.ai/v1',
            model: 'grok-2-latest',
            temperature: 0.7,
            enabled: true,
        },
    },
    {
        name: 'Qwen',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'Qwen-compatible endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            model: 'qwen-max-latest',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Doubao',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'Doubao Ark endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
            model: 'doubao-1-5-pro-32k-250115',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Moonshot',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'Moonshot Kimi endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.moonshot.cn/v1',
            model: 'moonshot-v1-8k',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'GLM',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'Zhipu GLM endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
            model: 'glm-4-plus',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'MiniMax',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'MiniMax endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.minimax.chat/v1',
            model: 'MiniMax-Text-01',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Groq',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'Groq endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.groq.com/openai/v1',
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            enabled: true,
        },
    },
    {
        name: 'Together',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'Together endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.together.xyz/v1',
            model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Fireworks',
        category: 'cloud',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'models-then-chat',
        description: 'Fireworks endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://api.fireworks.ai/inference/v1',
            model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
            temperature: 0.5,
            enabled: true,
        },
    },
    {
        name: 'Requesty',
        category: 'gateway',
        transport: 'openai-compatible',
        apiKeyMode: 'required',
        apiTestMode: 'chat-only',
        description: 'Requesty router endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'https://router.requesty.ai/v1',
            model: 'openai/gpt-4o-mini',
            temperature: 0.5,
            enabled: true,
        },
        extraHeaders: {
            'HTTP-Referer': 'https://github.com/Jacobinwwey/NoteConnection',
            'X-Title': 'NoteConnection NoteMD',
        },
    },
    {
        name: 'OpenAI Compatible',
        category: 'gateway',
        transport: 'openai-compatible',
        apiKeyMode: 'optional',
        apiTestMode: 'chat-only',
        description: 'Generic OpenAI-compatible endpoint',
        defaultConfig: {
            apiKey: '',
            baseUrl: 'http://localhost:4000/v1',
            model: 'local-model',
            temperature: 0.5,
            enabled: true,
        },
    },
];

const DEFINITIONS_BY_NAME = new Map<LlmProviderName, LlmProviderDefinition>(
    LLM_PROVIDER_DEFINITIONS.map((definition) => [definition.name, definition])
);

export function getProviderDefinition(name: LlmProviderName): LlmProviderDefinition {
    return DEFINITIONS_BY_NAME.get(name) || LLM_PROVIDER_DEFINITIONS[0];
}

export function createDefaultProviders(): LlmProviderConfig[] {
    return LLM_PROVIDER_DEFINITIONS.map((definition) => ({
        name: definition.name,
        ...definition.defaultConfig,
    }));
}
