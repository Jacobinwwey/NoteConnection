import type {
    AgentConversationBudget,
    AgentConversationBudgetMemoryClass,
    AgentConversationBudgetTier,
    AgentConversationBudgetWorkload,
    AgentConversationResponseBudgetCapability,
    AgentConversationResponseBudgetMode,
    AgentConversationResponseMode,
    AgentConversationRuntimeGovernor,
    RagContextBudget,
} from './types';

type ProductBudgetTier = Exclude<AgentConversationBudgetTier, 'unbounded'>;

type AgentResponseBudgetTierDefinition = Readonly<{
    rag: Readonly<RagContextBudget>;
    reportMaxChars: number;
    runtimeGovernor: Readonly<AgentConversationRuntimeGovernor>;
}>;

const STANDARD_RUNTIME_GOVERNOR: AgentConversationRuntimeGovernor = Object.freeze({
    timeoutMs: 60_000,
    maxSerializedBytes: 8 * 1024 * 1024,
    maxFragmentsProcessed: 512,
    maxReportChars: 48_000,
});

const EXTENDED_RUNTIME_GOVERNOR: AgentConversationRuntimeGovernor = Object.freeze({
    timeoutMs: 90_000,
    maxSerializedBytes: 16 * 1024 * 1024,
    maxFragmentsProcessed: 1_024,
    maxReportChars: 80_000,
});

const MAX_RUNTIME_GOVERNOR: AgentConversationRuntimeGovernor = Object.freeze({
    timeoutMs: 120_000,
    maxSerializedBytes: 32 * 1024 * 1024,
    maxFragmentsProcessed: 2_048,
    maxReportChars: 160_000,
});

const UNBOUNDED_RUNTIME_GOVERNOR: AgentConversationRuntimeGovernor = Object.freeze({
    timeoutMs: 180_000,
    maxSerializedBytes: 64 * 1024 * 1024,
    maxFragmentsProcessed: 4_096,
    maxReportChars: 320_000,
});

function createProductBudgetDefinition(
    maxFragments: number,
    maxCharsPerFragment: number,
    maxTotalChars: number,
    reportMaxChars: number,
    runtimeGovernor: AgentConversationRuntimeGovernor
): AgentResponseBudgetTierDefinition {
    return Object.freeze({
        rag: Object.freeze({
            maxFragments,
            maxCharsPerFragment,
            maxTotalChars,
            productCapDisabled: false,
            runtimeMaxFragments: runtimeGovernor.maxFragmentsProcessed,
            runtimeMaxCharsPerFragment: maxCharsPerFragment,
            runtimeMaxTotalChars: runtimeGovernor.maxSerializedBytes,
        }),
        reportMaxChars,
        runtimeGovernor,
    });
}

export const AGENT_RESPONSE_BUDGET_TIERS: Readonly<Record<ProductBudgetTier, AgentResponseBudgetTierDefinition>> = Object.freeze({
    standard: createProductBudgetDefinition(120, 8_000, 64_000, 48_000, STANDARD_RUNTIME_GOVERNOR),
    extended: createProductBudgetDefinition(160, 12_000, 128_000, 80_000, EXTENDED_RUNTIME_GOVERNOR),
    max: createProductBudgetDefinition(256, 16_000, 256_000, 160_000, MAX_RUNTIME_GOVERNOR),
});

export const AGENT_RESPONSE_UNBOUNDED_RUNTIME_GOVERNOR: Readonly<AgentConversationRuntimeGovernor> =
    UNBOUNDED_RUNTIME_GOVERNOR;

export interface ResolveAgentResponseBudgetInput {
    responseMode?: AgentConversationResponseMode;
    responseBudgetMode?: AgentConversationResponseBudgetMode;
    capability?: unknown;
    mobile?: boolean;
}

export interface RuntimeGovernorInput {
    budget: AgentConversationBudget;
    startedAtMs: number;
    nowMs: number;
    processedFragments: number;
    serializedBytes: number;
    reportChars: number;
}

export type RuntimeGovernorDecision =
    | { allowed: true; truncated: false }
    | { allowed: false; truncated: true; reason: 'runtime_timeout' | 'runtime_fragment_limit' | 'runtime_serialized_bytes_limit' | 'runtime_report_chars_limit' };

function normalizedMemoryClass(value: unknown): AgentConversationBudgetMemoryClass | undefined {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'low' || normalized === 'standard' || normalized === 'high'
        ? normalized
        : undefined;
}

function normalizedWorkload(value: unknown): AgentConversationBudgetWorkload | undefined {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'normal' || normalized === 'large' || normalized === 'max'
        ? normalized
        : undefined;
}

function normalizedCapability(value: unknown): AgentConversationResponseBudgetCapability {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const record = value as Record<string, unknown>;
    const capability: AgentConversationResponseBudgetCapability = {};
    const memoryClass = normalizedMemoryClass(record.memoryClass ?? record.memory_class);
    const workload = normalizedWorkload(record.workload ?? record.workload_class);
    if (memoryClass) {
        capability.memoryClass = memoryClass;
    }
    if (workload) {
        capability.workload = workload;
    }
    return capability;
}

function resolveAdaptiveTier(capability: AgentConversationResponseBudgetCapability): ProductBudgetTier {
    if (capability.memoryClass === 'low') {
        return 'standard';
    }
    if (capability.memoryClass === 'high' && capability.workload === 'max') {
        return 'max';
    }
    if (capability.workload === 'max' || (capability.memoryClass === 'high' && capability.workload === 'large')) {
        return 'extended';
    }
    return 'standard';
}

function cloneRuntimeGovernor(governor: Readonly<AgentConversationRuntimeGovernor>): AgentConversationRuntimeGovernor {
    return {
        timeoutMs: governor.timeoutMs,
        maxSerializedBytes: governor.maxSerializedBytes,
        maxFragmentsProcessed: governor.maxFragmentsProcessed,
        maxReportChars: governor.maxReportChars,
    };
}

function cloneRagBudget(rag: Readonly<RagContextBudget>, productCapDisabled = false): RagContextBudget {
    return {
        maxFragments: rag.maxFragments,
        maxCharsPerFragment: rag.maxCharsPerFragment,
        maxTotalChars: rag.maxTotalChars,
        productCapDisabled,
        runtimeMaxFragments: rag.runtimeMaxFragments,
        runtimeMaxCharsPerFragment: rag.runtimeMaxCharsPerFragment,
        runtimeMaxTotalChars: rag.runtimeMaxTotalChars,
    };
}

export function resolveAgentResponseBudget(input: ResolveAgentResponseBudgetInput = {}): AgentConversationBudget {
    const responseMode = input.responseMode === 'full' ? 'full' : 'slim';
    const mobile = input.mobile === true;
    const requestedMode: AgentConversationResponseBudgetMode = input.responseBudgetMode === 'unbounded'
        ? 'unbounded'
        : 'adaptive';
    if (responseMode !== 'full' || mobile) {
        const standard = AGENT_RESPONSE_BUDGET_TIERS.standard;
        return {
            mode: 'adaptive',
            tier: 'standard',
            productCapDisabled: false,
            rag: cloneRagBudget(standard.rag),
            reportMaxChars: standard.reportMaxChars,
            runtimeGovernor: cloneRuntimeGovernor(standard.runtimeGovernor),
        };
    }
    if (requestedMode === 'unbounded') {
        return {
            mode: 'unbounded',
            tier: 'unbounded',
            productCapDisabled: true,
            rag: cloneRagBudget({
                maxFragments: UNBOUNDED_RUNTIME_GOVERNOR.maxFragmentsProcessed,
                maxCharsPerFragment: AGENT_RESPONSE_BUDGET_TIERS.max.rag.maxCharsPerFragment,
                maxTotalChars: AGENT_RESPONSE_UNBOUNDED_RUNTIME_GOVERNOR.maxReportChars,
                runtimeMaxFragments: UNBOUNDED_RUNTIME_GOVERNOR.maxFragmentsProcessed,
                runtimeMaxCharsPerFragment: AGENT_RESPONSE_BUDGET_TIERS.max.rag.maxCharsPerFragment,
                runtimeMaxTotalChars: UNBOUNDED_RUNTIME_GOVERNOR.maxSerializedBytes,
            }, true),
            runtimeGovernor: cloneRuntimeGovernor(UNBOUNDED_RUNTIME_GOVERNOR),
        };
    }
    const tier = resolveAdaptiveTier(normalizedCapability(input.capability));
    const definition = AGENT_RESPONSE_BUDGET_TIERS[tier];
    return {
        mode: 'adaptive',
        tier,
        productCapDisabled: false,
        rag: cloneRagBudget(definition.rag),
        reportMaxChars: definition.reportMaxChars,
        runtimeGovernor: cloneRuntimeGovernor(definition.runtimeGovernor),
    };
}

export function applyRuntimeGovernor(input: RuntimeGovernorInput): RuntimeGovernorDecision {
    const governor = input.budget.runtimeGovernor;
    if (Number(input.nowMs) - Number(input.startedAtMs) > governor.timeoutMs) {
        return { allowed: false, truncated: true, reason: 'runtime_timeout' };
    }
    if (Number(input.processedFragments) > governor.maxFragmentsProcessed) {
        return { allowed: false, truncated: true, reason: 'runtime_fragment_limit' };
    }
    if (Number(input.serializedBytes) > governor.maxSerializedBytes) {
        return { allowed: false, truncated: true, reason: 'runtime_serialized_bytes_limit' };
    }
    if (Number(input.reportChars) > governor.maxReportChars) {
        return { allowed: false, truncated: true, reason: 'runtime_report_chars_limit' };
    }
    return { allowed: true, truncated: false };
}
