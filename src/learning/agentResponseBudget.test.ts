import {
    AGENT_RESPONSE_BUDGET_TIERS,
    resolveAgentResponseBudget,
    applyRuntimeGovernor,
} from './agentResponseBudget';

describe('agent response budget resolver', () => {
    test.each([
        [{}, 'standard'],
        [{ memoryClass: 'standard', workload: 'normal' }, 'standard'],
        [{ memoryClass: 'high', workload: 'large' }, 'extended'],
        [{ memoryClass: 'standard', workload: 'max' }, 'extended'],
        [{ memoryClass: 'high', workload: 'max' }, 'max'],
        [{ memoryClass: 'low', workload: 'max' }, 'standard'],
    ])('adaptive capability %j resolves to %s', (capability, expectedTier) => {
        const budget = resolveAgentResponseBudget({
            responseMode: 'full',
            responseBudgetMode: 'adaptive',
            capability,
        });
        expect(budget.tier).toBe(expectedTier);
        expect(budget.mode).toBe('adaptive');
        expect(budget.productCapDisabled).toBe(false);
        expect(budget.rag?.maxFragments).toBe(
            AGENT_RESPONSE_BUDGET_TIERS[expectedTier as 'standard' | 'extended' | 'max'].rag.maxFragments
        );
    });

    test('explicit unbounded disables product caps but keeps a finite runtime governor', () => {
        const budget = resolveAgentResponseBudget({
            responseMode: 'full',
            responseBudgetMode: 'unbounded',
            capability: { memoryClass: 'low', workload: 'normal' },
        });
        expect(budget.mode).toBe('unbounded');
        expect(budget.tier).toBe('unbounded');
        expect(budget.productCapDisabled).toBe(true);
        expect(budget.reportMaxChars).toBeUndefined();
        expect(budget.runtimeGovernor.maxReportChars).toBeGreaterThan(
            AGENT_RESPONSE_BUDGET_TIERS.max.reportMaxChars
        );
        expect(Number.isFinite(budget.runtimeGovernor.maxSerializedBytes)).toBe(true);
        expect(budget.rag?.productCapDisabled).toBe(true);
    });

    test('slim and mobile requests cannot select desktop full budgets', () => {
        const slim = resolveAgentResponseBudget({
            responseMode: 'slim',
            responseBudgetMode: 'unbounded',
            capability: { memoryClass: 'high', workload: 'max' },
        });
        const mobile = resolveAgentResponseBudget({
            responseMode: 'full',
            responseBudgetMode: 'unbounded',
            capability: { memoryClass: 'high', workload: 'max' },
            mobile: true,
        });
        expect(slim.tier).toBe('standard');
        expect(slim.productCapDisabled).toBe(false);
        expect(mobile.tier).toBe('standard');
        expect(mobile.productCapDisabled).toBe(false);
    });

    test('numeric capability hints are bounded and cannot promote a tier', () => {
        const budget = resolveAgentResponseBudget({
            responseMode: 'full',
            responseBudgetMode: 'adaptive',
            capability: {
                memoryClass: 'standard',
                workload: 'normal',
                maxReportCharsHint: Number.MAX_SAFE_INTEGER,
                maxSerializedBytesHint: Number.MAX_SAFE_INTEGER,
            },
        });
        expect(budget.tier).toBe('standard');
        expect(budget.reportMaxChars).toBeLessThanOrEqual(AGENT_RESPONSE_BUDGET_TIERS.max.reportMaxChars);
        expect(budget.runtimeGovernor.maxSerializedBytes).toBeLessThanOrEqual(
            AGENT_RESPONSE_BUDGET_TIERS.max.runtimeGovernor.maxSerializedBytes
        );
    });

    test('runtime governor reports deterministic stop reasons', () => {
        const budget = resolveAgentResponseBudget({ responseMode: 'full', responseBudgetMode: 'unbounded' });
        const startedAtMs = 1000;
        expect(applyRuntimeGovernor({
            budget,
            startedAtMs,
            nowMs: startedAtMs + 10,
            processedFragments: 1,
            serializedBytes: 100,
            reportChars: 100,
        })).toEqual({ allowed: true, truncated: false });
        expect(applyRuntimeGovernor({
            budget,
            startedAtMs,
            nowMs: startedAtMs + budget.runtimeGovernor.timeoutMs + 1,
            processedFragments: 1,
            serializedBytes: 100,
            reportChars: 100,
        })).toEqual({ allowed: false, truncated: true, reason: 'runtime_timeout' });
        expect(applyRuntimeGovernor({
            budget,
            startedAtMs,
            nowMs: startedAtMs + 10,
            processedFragments: budget.runtimeGovernor.maxFragmentsProcessed + 1,
            serializedBytes: 100,
            reportChars: 100,
        })).toEqual({ allowed: false, truncated: true, reason: 'runtime_fragment_limit' });
    });
});
