import { LlmProviderClient, selectModelForTask, selectProviderForTask } from '../notemd/LlmProvider';
import type { LlmCompletionResult, NotemdSettings, TaskKey } from '../notemd/types';
import type {
    AgentConversationGraphContext,
    RagContextPack,
    RagEvidenceFragment,
    RagSufficiencyReview,
} from './types';
import type { RagSufficiencyJudgeInput, RagSufficiencyLlmJudge } from './ragSufficiencyJudge';

type RagSufficiencyCompletionClient = Pick<LlmProviderClient, 'complete'>;

export interface RagSufficiencyProviderJudgeOptions {
    settingsProvider: () => NotemdSettings | Promise<NotemdSettings>;
    llmClient?: RagSufficiencyCompletionClient;
    timeoutMs?: number;
    maxTokens?: number;
}

const RAG_SUFFICIENCY_TASK_KEY: TaskKey = 'ragSufficiencyJudge';
const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_MAX_TOKENS = 320;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 20000;
const MIN_MAX_TOKENS = 32;
const MAX_MAX_TOKENS = 1200;
const VALID_STATUSES = new Set<RagSufficiencyReview['status']>([
    'sufficient',
    'borderline',
    'insufficient',
]);
const VALID_DEGRADATION_STATES = new Set<NonNullable<RagSufficiencyReview['degradationState']>>([
    'none',
    'partial_coverage',
    'conflict',
    'stale_evidence',
    'insufficient_evidence',
]);

const DEFAULT_REVIEW_PROMPT = [
    'You are a bounded RAG sufficiency reviewer.',
    'Decide whether the supplied RAG context is sufficient to answer the user query without unsupported claims.',
    'Use only the supplied context. Do not produce the final answer.',
    'Return only one JSON object with keys: status, score, reasons, degradationState.',
    'status must be one of: sufficient, borderline, insufficient.',
    'score must be a number from 0 to 1.',
    'reasons must be a short string array using stable snake_case reason codes.',
    'degradationState must be one of: none, partial_coverage, conflict, stale_evidence, insufficient_evidence.',
].join('\n');

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.max(min, Math.min(max, value));
}

function clampUnit(value: number): number {
    return Number(clamp(value, 0, 1).toFixed(4));
}

function resolveBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    const normalized = Math.floor(Number(value));
    if (!Number.isFinite(normalized)) {
        return fallback;
    }
    return Math.floor(clamp(normalized, min, max));
}

function cleanReason(value: unknown): string {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_:-]/g, '')
        .slice(0, 96);
}

function extractJsonObjectText(text: string): string {
    const trimmed = String(text || '').trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
        return candidate;
    }
    const startIndex = candidate.indexOf('{');
    const endIndex = candidate.lastIndexOf('}');
    if (startIndex >= 0 && endIndex > startIndex) {
        return candidate.slice(startIndex, endIndex + 1);
    }
    return candidate;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

export function parseRagSufficiencyProviderJudgeReview(
    text: string
): Partial<RagSufficiencyReview> | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(extractJsonObjectText(text));
    } catch {
        return null;
    }
    const record = toRecord(parsed);
    if (!record) {
        return null;
    }

    const review: Partial<RagSufficiencyReview> = {};
    if (VALID_STATUSES.has(record.status as RagSufficiencyReview['status'])) {
        review.status = record.status as RagSufficiencyReview['status'];
    }
    if (Number.isFinite(Number(record.score))) {
        review.score = clampUnit(Number(record.score));
    }
    if (Array.isArray(record.reasons)) {
        const reasons = record.reasons
            .map(cleanReason)
            .filter(Boolean)
            .slice(0, 8);
        if (reasons.length > 0) {
            review.reasons = reasons;
        }
    }
    if (VALID_DEGRADATION_STATES.has(record.degradationState as NonNullable<RagSufficiencyReview['degradationState']>)) {
        review.degradationState = record.degradationState as NonNullable<RagSufficiencyReview['degradationState']>;
    }

    return Object.keys(review).length > 0 ? review : null;
}

function buildFragmentPayload(fragment: RagEvidenceFragment): Record<string, unknown> {
    return {
        role: fragment.role,
        title: fragment.title,
        documentId: fragment.documentId,
        sourcePath: fragment.sourcePath,
        headingPath: fragment.headingPath,
        sourceBoundary: fragment.sourceBoundary,
        citationIds: fragment.citationIds,
        relationEdgeIds: fragment.relationEdgeIds || [],
        score: fragment.score,
        truncated: fragment.truncated,
        truncationReason: fragment.truncationReason,
        text: fragment.text,
    };
}

function buildGraphPayload(graphContext: AgentConversationGraphContext | null | undefined): Record<string, unknown> | null {
    if (!graphContext) {
        return null;
    }
    return {
        anchorAtomId: graphContext.anchorAtomId,
        anchorTitle: graphContext.anchorTitle,
        supportingAtomIds: graphContext.supportingAtomIds || [],
        supportingTitles: graphContext.supportingTitles || [],
        relationKinds: graphContext.relationKinds || [],
        relationSummaries: graphContext.relationSummaries || [],
        predecessorWindow: graphContext.predecessorWindow || [],
        successorWindow: graphContext.successorWindow || [],
        temporalValidity: graphContext.temporalValidity,
    };
}

function buildReviewContent(input: RagSufficiencyJudgeInput): string {
    const pack: RagContextPack = input.contextPack;
    return JSON.stringify({
        query: input.query,
        generatedAt: pack.generatedAt,
        sourceBoundary: pack.sourceBoundary,
        budget: pack.budget,
        totalCharCount: pack.totalCharCount,
        tokenEstimate: pack.tokenEstimate,
        sourceDecisions: pack.sourceDecisions,
        fragments: pack.fragments.map(buildFragmentPayload),
        graphContext: buildGraphPayload(input.graphContext),
    });
}

async function completeWithTimeout(params: {
    client: RagSufficiencyCompletionClient;
    request: Parameters<RagSufficiencyCompletionClient['complete']>[0];
    timeoutMs: number;
}): Promise<LlmCompletionResult> {
    const controller = new AbortController();
    let didTimeout = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            didTimeout = true;
            controller.abort();
            reject(new Error('RAG sufficiency judge timed out.'));
        }, params.timeoutMs);
        params.request.signal?.addEventListener('abort', () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            controller.abort();
            reject(new Error('RAG sufficiency judge cancelled.'));
        }, { once: true });
    });

    try {
        return await Promise.race([
            params.client.complete({
                ...params.request,
                signal: controller.signal,
            }),
            timeoutPromise,
        ]);
    } catch (error) {
        if (didTimeout) {
            throw new Error('RAG sufficiency judge timed out.');
        }
        throw error;
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

export function createRagSufficiencyProviderJudge(
    options: RagSufficiencyProviderJudgeOptions
): RagSufficiencyLlmJudge {
    const client = options.llmClient || new LlmProviderClient();
    const timeoutMs = resolveBoundedInteger(
        options.timeoutMs,
        DEFAULT_TIMEOUT_MS,
        MIN_TIMEOUT_MS,
        MAX_TIMEOUT_MS
    );
    const maxTokens = resolveBoundedInteger(
        options.maxTokens,
        DEFAULT_MAX_TOKENS,
        MIN_MAX_TOKENS,
        MAX_MAX_TOKENS
    );

    return async (input) => {
        const settings = await options.settingsProvider();
        const provider = selectProviderForTask(settings, RAG_SUFFICIENCY_TASK_KEY);
        const model = selectModelForTask(settings, RAG_SUFFICIENCY_TASK_KEY, provider);
        const configuredPrompt = settings.enableGlobalCustomPrompts
            ? String(settings.customPrompts?.[RAG_SUFFICIENCY_TASK_KEY] || '').trim()
            : '';
        const result = await completeWithTimeout({
            client,
            timeoutMs,
            request: {
                provider,
                model,
                prompt: configuredPrompt || DEFAULT_REVIEW_PROMPT,
                content: buildReviewContent(input),
                maxTokens,
                maxRetries: 0,
                retryDelayMs: 0,
            },
        });
        return parseRagSufficiencyProviderJudgeReview(result.text);
    };
}
