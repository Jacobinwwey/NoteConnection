import { LlmProviderConfig, LlmProviderName, NotemdSettings } from './types';
import {
    createDefaultProviders,
    getProviderDefinition,
    type LlmProviderApiKeyMode,
    type LlmProviderCategory,
    type LlmProviderTransport,
} from './LlmProviderDefinitions';

export interface NotemdProviderTemplate {
    id: string;
    label: string;
    providerName: LlmProviderName;
    category: LlmProviderCategory;
    transport: LlmProviderTransport;
    apiKeyMode: LlmProviderApiKeyMode;
    baseUrl: string;
    model: string;
    apiVersion: string;
    temperature: number;
    recommendedFor: string;
    apiKeyHint: string;
    hostHint: string;
    inspiredBy: string[];
    notes: string[];
}

type ProviderTemplateSeed = {
    id: string;
    providerName: LlmProviderName;
    label: string;
    recommendedFor: string;
    apiKeyHint: string;
    hostHint: string;
    inspiredBy: string[];
    notes: string[];
};

const PROVIDER_TEMPLATE_SEEDS: ProviderTemplateSeed[] = [
    {
        id: 'deepseek-official',
        providerName: 'DeepSeek',
        label: 'DeepSeek Official',
        recommendedFor: 'Direct hosted DeepSeek reasoning/chat models.',
        apiKeyHint: 'Paste a DeepSeek API key.',
        hostHint: 'Uses the official DeepSeek OpenAI-compatible endpoint.',
        inspiredBy: ['Cherry Studio', 'DeepTutor'],
        notes: [
            'Keep the /v1 suffix for the official endpoint.',
            'Reasoning-capable models may prefer lower temperature values.',
        ],
    },
    {
        id: 'openai-official',
        providerName: 'OpenAI',
        label: 'OpenAI Official',
        recommendedFor: 'Direct OpenAI hosted GPT models.',
        apiKeyHint: 'Paste an OpenAI API key.',
        hostHint: 'Matches DeepTutor style host guidance: base URL stays at /v1.',
        inspiredBy: ['Cherry Studio', 'DeepTutor'],
        notes: [
            'Use a direct API key, not a session token.',
            'This preset is the cleanest baseline for hosted OpenAI models.',
        ],
    },
    {
        id: 'anthropic-official',
        providerName: 'Anthropic',
        label: 'Anthropic Official',
        recommendedFor: 'Claude models over the native Anthropic API.',
        apiKeyHint: 'Paste an Anthropic API key.',
        hostHint: 'Anthropic does not use the OpenAI-compatible /v1 shape.',
        inspiredBy: ['Cherry Studio'],
        notes: [
            'The base URL should usually remain https://api.anthropic.com.',
            'Claude deployments do not need an OpenAI-compatible relay.',
        ],
    },
    {
        id: 'gemini-official',
        providerName: 'Google',
        label: 'Gemini Official',
        recommendedFor: 'Google Gemini API over the official hosted endpoint.',
        apiKeyHint: 'Paste a Google AI Studio / Gemini API key.',
        hostHint: 'Uses the official Gemini REST endpoint, not an OpenAI relay.',
        inspiredBy: ['Cherry Studio', 'DeepTutor'],
        notes: [
            'This preset is for direct Gemini API usage.',
            'If you use an OpenAI-compatible Gemini relay, prefer OpenAI Compatible instead.',
        ],
    },
    {
        id: 'openrouter-gateway',
        providerName: 'OpenRouter',
        label: 'OpenRouter Gateway',
        recommendedFor: 'Unified routing across many hosted model families.',
        apiKeyHint: 'Paste an OpenRouter API key.',
        hostHint: 'Gateway style endpoint inspired by Cherry Studio provider routing.',
        inspiredBy: ['Cherry Studio'],
        notes: [
            'Model ids usually include upstream vendor prefixes.',
            'Good default when you want one key for many providers.',
        ],
    },
    {
        id: 'lmstudio-local',
        providerName: 'LMStudio',
        label: 'LM Studio Local',
        recommendedFor: 'Desktop local models exposed over an OpenAI-compatible server.',
        apiKeyHint: 'Usually no API key is required.',
        hostHint: 'DeepTutor-style local host guidance: prefer localhost on desktop, not inside containers.',
        inspiredBy: ['Cherry Studio', 'DeepTutor'],
        notes: [
            'Keep the local server running before testing the connection.',
            'If this app is containerized in the future, localhost must be replaced with a host bridge address.',
        ],
    },
    {
        id: 'ollama-local',
        providerName: 'Ollama',
        label: 'Ollama Local',
        recommendedFor: 'Local Ollama chat models.',
        apiKeyHint: 'No API key is required for a standard local Ollama instance.',
        hostHint: "Uses Ollama's local HTTP API.",
        inspiredBy: ['Cherry Studio', 'DeepTutor'],
        notes: [
            'The model name must match an installed Ollama model.',
            'Keep the default host only for local desktop usage.',
        ],
    },
    {
        id: 'azure-openai',
        providerName: 'Azure OpenAI',
        label: 'Azure OpenAI',
        recommendedFor: 'Azure OpenAI deployments that require deployment-specific base URLs.',
        apiKeyHint: 'Paste an Azure OpenAI key.',
        hostHint: 'Unlike standard OpenAI, Azure needs an explicit deployment URL and API version.',
        inspiredBy: ['Cherry Studio', 'DeepTutor'],
        notes: [
            'Fill in the full Azure resource endpoint plus deployment path.',
            'The API version field matters here and should not stay blank.',
        ],
    },
    {
        id: 'openai-compatible-custom',
        providerName: 'OpenAI Compatible',
        label: 'Custom OpenAI-Compatible',
        recommendedFor: 'Self-hosted gateways, enterprise relays, and custom-compatible endpoints.',
        apiKeyHint: 'Paste a key only if your relay requires one.',
        hostHint: 'Use this when the endpoint follows OpenAI-compatible chat semantics.',
        inspiredBy: ['Cherry Studio'],
        notes: [
            'Best fallback preset when your provider is not in the built-in catalog.',
            'Check that the base URL already includes the /v1 segment if required by your relay.',
        ],
    },
];

function buildTemplateFromSeed(seed: ProviderTemplateSeed): NotemdProviderTemplate {
    const fallback = createDefaultProviders().find((provider) => provider.name === seed.providerName);
    const definition = getProviderDefinition(seed.providerName);
    const defaultConfig = fallback || {
        name: seed.providerName,
        apiKey: '',
        baseUrl: '',
        model: '',
        temperature: 0.5,
        apiVersion: '',
        enabled: true,
    };

    return {
        id: seed.id,
        label: seed.label,
        providerName: seed.providerName,
        category: definition.category,
        transport: definition.transport,
        apiKeyMode: definition.apiKeyMode,
        baseUrl: defaultConfig.baseUrl,
        model: defaultConfig.model,
        apiVersion: String(defaultConfig.apiVersion || ''),
        temperature: Number.isFinite(Number(defaultConfig.temperature))
            ? Number(defaultConfig.temperature)
            : 0.5,
        recommendedFor: seed.recommendedFor,
        apiKeyHint: seed.apiKeyHint,
        hostHint: seed.hostHint,
        inspiredBy: seed.inspiredBy.slice(),
        notes: seed.notes.slice(),
    };
}

export const NOTEMD_PROVIDER_TEMPLATES: NotemdProviderTemplate[] = PROVIDER_TEMPLATE_SEEDS.map(buildTemplateFromSeed);

export function getNotemdProviderTemplate(templateId: string): NotemdProviderTemplate | null {
    const normalizedId = String(templateId || '').trim();
    return NOTEMD_PROVIDER_TEMPLATES.find((template) => template.id === normalizedId) || null;
}

export function applyProviderTemplateToSettings(
    settings: NotemdSettings,
    templateId: string
): NotemdSettings {
    const template = getNotemdProviderTemplate(templateId);
    if (!template) {
        throw new Error(`Unknown provider template: ${templateId}`);
    }

    const next = JSON.parse(JSON.stringify(settings)) as NotemdSettings;
    next.activeProvider = template.providerName;

    let matched = false;
    next.providers = next.providers.map((provider) => {
        if (provider.name !== template.providerName) {
            return provider;
        }
        matched = true;
        return {
            ...provider,
            baseUrl: template.baseUrl,
            model: template.model,
            apiVersion: template.apiVersion,
            temperature: template.temperature,
            enabled: true,
        };
    });

    if (!matched) {
        const fallback = createDefaultProviders().find((provider) => provider.name === template.providerName);
        if (fallback) {
            next.providers.push({
                ...fallback,
                baseUrl: template.baseUrl,
                model: template.model,
                apiVersion: template.apiVersion,
                temperature: template.temperature,
                enabled: true,
            } as LlmProviderConfig);
        }
    }

    return next;
}

export function mergeProviderTemplatesIntoNotemdSection(
    notemdSectionLike: Record<string, unknown>
): Record<string, unknown> {
    const nextNotemdSection = { ...(notemdSectionLike || {}) };
    const existingTemplates = (
        nextNotemdSection.provider_templates &&
        typeof nextNotemdSection.provider_templates === 'object' &&
        !Array.isArray(nextNotemdSection.provider_templates)
    )
        ? { ...(nextNotemdSection.provider_templates as Record<string, unknown>) }
        : {};

    NOTEMD_PROVIDER_TEMPLATES.forEach((template) => {
        if (existingTemplates[template.id] && typeof existingTemplates[template.id] === 'object') {
            return;
        }
        existingTemplates[template.id] = {
            label: template.label,
            provider_name: template.providerName,
            category: template.category,
            transport: template.transport,
            api_key_mode: template.apiKeyMode,
            base_url: template.baseUrl,
            model: template.model,
            api_version: template.apiVersion,
            temperature: template.temperature,
            recommended_for: template.recommendedFor,
            api_key_hint: template.apiKeyHint,
            host_hint: template.hostHint,
            inspired_by: template.inspiredBy.slice(),
            notes: template.notes.slice(),
        };
    });

    nextNotemdSection.provider_templates = existingTemplates;
    return nextNotemdSection;
}
