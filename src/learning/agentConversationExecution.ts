import { open } from 'fs/promises';
import { AsyncLocalStorage } from 'async_hooks';
import { applyRuntimeGovernor } from './agentResponseBudget';
import type { AgentConversationBudget } from './types';

export interface AgentConversationExecutionPolicy {
    timeoutMs: number;
    maxSourceBytes: number;
    maxTotalSourceBytes: number;
    maxPendingTurns: number;
    maxSourceLines: number;
    maxSourceFacts: number;
}

export const DEFAULT_AGENT_CONVERSATION_EXECUTION_POLICY: Readonly<AgentConversationExecutionPolicy> = Object.freeze({
    timeoutMs: 180_000,
    maxSourceBytes: 4 * 1024 * 1024,
    maxTotalSourceBytes: 16 * 1024 * 1024,
    maxPendingTurns: 8,
    maxSourceLines: 16_384,
    maxSourceFacts: 4_096,
});

export type AgentConversationExecutionStop =
    | 'runtime_timeout'
    | 'runtime_cancelled'
    | 'runtime_source_bytes_limit'
    | 'runtime_total_source_bytes_limit'
    | 'runtime_fragment_limit'
    | 'runtime_source_lines_limit'
    | 'runtime_source_facts_limit'
    | 'runtime_turn_capacity';

export class AgentConversationExecutionError extends Error {
    readonly statusCode: number;

    constructor(readonly code: AgentConversationExecutionStop) {
        super(code);
        this.name = 'AgentConversationExecutionError';
        this.statusCode = code === 'runtime_turn_capacity' ? 429
            : code === 'runtime_timeout' ? 504
                : code === 'runtime_cancelled' ? 499 : 413;
    }
}

export function normalizeAgentConversationExecutionPolicy(
    input: Partial<AgentConversationExecutionPolicy> = {}
): AgentConversationExecutionPolicy {
    const policy = { ...DEFAULT_AGENT_CONVERSATION_EXECUTION_POLICY };
    for (const key of Object.keys(policy) as Array<keyof AgentConversationExecutionPolicy>) {
        const candidate = input[key];
        if (candidate === undefined) continue;
        if (!Number.isFinite(candidate) || candidate < 1) {
            throw new TypeError(`Invalid agent conversation execution policy: ${key}`);
        }
        policy[key] = Math.min(policy[key], Math.floor(candidate));
    }
    policy.maxSourceBytes = Math.min(policy.maxSourceBytes, policy.maxTotalSourceBytes);
    return policy;
}

/** Owns one turn's cooperative deadline and bounded source I/O, including queued time. */
export class AgentConversationExecution {
    private static readonly scope = new AsyncLocalStorage<AgentConversationExecution>();
    private active = true;
    private readonly controller = new AbortController();
    private readonly startedAtMs = Date.now();
    private readonly timeoutMs: number;
    private readonly timer: NodeJS.Timeout;
    private readonly onParentAbort: () => void;
    private sourceBytes = 0;
    private sourceReads = 0;
    private processedFragments = 0;
    private sourceFacts = 0;
    private sourceStop: AgentConversationExecutionStop | undefined;

    private constructor(
        private readonly budget: AgentConversationBudget,
        private readonly policy: AgentConversationExecutionPolicy,
        private readonly parentSignal?: AbortSignal,
    ) {
        this.timeoutMs = Math.min(policy.timeoutMs, budget.runtimeGovernor.timeoutMs);
        this.budget = { ...budget, runtimeGovernor: { ...budget.runtimeGovernor, timeoutMs: this.timeoutMs } };
        this.onParentAbort = () => this.controller.abort(new AgentConversationExecutionError('runtime_cancelled'));
        this.timer = setTimeout(() => {
            this.controller.abort(new AgentConversationExecutionError('runtime_timeout'));
        }, this.timeoutMs);
        this.timer.unref();
        if (parentSignal?.aborted) this.onParentAbort();
        else parentSignal?.addEventListener('abort', this.onParentAbort, { once: true });
    }

    static async run<T>(
        options: { budget: AgentConversationBudget; policy: AgentConversationExecutionPolicy; signal?: AbortSignal },
        operation: (execution: AgentConversationExecution) => Promise<T>,
    ): Promise<T> {
        const existing = this.current();
        if (existing) {
            existing.assertActive();
            return operation(existing);
        }
        const execution = new AgentConversationExecution(options.budget, options.policy, options.signal);
        try {
            execution.assertActive();
            // Keep the state lease until cooperative work has actually stopped.
            // Racing an uncancelled promise would allow it to mutate a later turn.
            return await this.scope.run(execution, () => operation(execution));
        } finally {
            execution.active = false;
            clearTimeout(execution.timer);
            options.signal?.removeEventListener('abort', execution.onParentAbort);
        }
    }

    get signal(): AbortSignal { return this.controller.signal; }
    get maxFragmentChars(): number { return this.budget.rag.maxCharsPerFragment; }
    get truncationReason(): AgentConversationExecutionStop | undefined { return this.sourceStop; }

    static current(): AgentConversationExecution | undefined {
        const execution = this.scope.getStore();
        return execution?.active ? execution : undefined;
    }

    isResourceLimit(error: unknown): error is AgentConversationExecutionError {
        return error instanceof AgentConversationExecutionError && (
            error.code === 'runtime_source_bytes_limit'
            || error.code === 'runtime_total_source_bytes_limit'
            || error.code === 'runtime_fragment_limit'
            || error.code === 'runtime_source_lines_limit'
            || error.code === 'runtime_source_facts_limit'
        );
    }

    assertActive(): void {
        if (!this.active) throw new AgentConversationExecutionError('runtime_cancelled');
        if (this.signal.aborted) throw this.signal.reason;
        const decision = applyRuntimeGovernor({
            budget: this.budget,
            startedAtMs: this.startedAtMs, nowMs: Date.now(),
            processedFragments: this.processedFragments, serializedBytes: 0, reportChars: 0,
        });
        if (!decision.allowed) {
            const code = decision.reason === 'runtime_timeout' ? 'runtime_timeout' : 'runtime_fragment_limit';
            throw new AgentConversationExecutionError(code);
        }
    }

    async yieldCheckpoint(): Promise<void> {
        this.assertActive();
        await new Promise<void>(resolve => setImmediate(resolve));
        this.assertActive();
    }

    recordFragment(): void {
        if (this.processedFragments >= this.budget.runtimeGovernor.maxFragmentsProcessed) {
            this.sourceStop = 'runtime_fragment_limit';
            throw new AgentConversationExecutionError(this.sourceStop);
        }
        this.processedFragments++;
        this.assertActive();
    }

    checkSourceLineCount(count: number): void {
        this.assertActive();
        if (count > this.policy.maxSourceLines) {
            this.sourceStop = 'runtime_source_lines_limit';
            throw new AgentConversationExecutionError(this.sourceStop);
        }
    }

    recordSourceFact(): void {
        this.assertActive();
        if (this.sourceFacts >= this.policy.maxSourceFacts) {
            this.sourceStop = 'runtime_source_facts_limit';
            throw new AgentConversationExecutionError(this.sourceStop);
        }
        this.sourceFacts++;
    }

    acceptSourceText(content: string): string {
        this.assertActive();
        const bytes = Buffer.byteLength(content, 'utf8');
        this.assertSourceFits(bytes, bytes);
        this.sourceBytes += bytes;
        this.sourceReads++;
        return content;
    }

    async readSourceFile(filePath: string): Promise<string | null> {
        this.assertActive();
        const file = await open(filePath, 'r');
        try {
            this.assertActive();
            const stat = await file.stat();
            if (!stat.isFile()) return null;
            this.assertSourceFits(stat.size, stat.size);
            const chunks: Buffer[] = [];
            let fileBytes = 0;
            const stream = file.createReadStream({ autoClose: false, highWaterMark: 64 * 1024, signal: this.signal });
            try {
                for await (const chunk of stream) {
                    this.assertActive();
                    const bytes = chunk as Buffer;
                    fileBytes += bytes.length;
                    // Check actual bytes too: the file can grow after stat().
                    this.assertSourceFits(fileBytes, bytes.length);
                    this.sourceBytes += bytes.length;
                    chunks.push(bytes);
                }
            } catch (error) {
                this.assertActive();
                throw error;
            }
            this.sourceReads++;
            return Buffer.concat(chunks, fileBytes).toString('utf8');
        } finally {
            await file.close();
        }
    }

    diagnostics() {
        return {
            elapsedMs: Math.max(0, Date.now() - this.startedAtMs),
            timeoutMs: this.timeoutMs,
            maxSourceBytes: this.policy.maxSourceBytes,
            maxTotalSourceBytes: this.policy.maxTotalSourceBytes,
            sourceBytes: this.sourceBytes,
            sourceReads: this.sourceReads,
            processedFragments: this.processedFragments,
            maxSourceLines: this.policy.maxSourceLines,
            maxSourceFacts: this.policy.maxSourceFacts,
            sourceFacts: this.sourceFacts,
            ...(this.sourceStop ? { truncationReason: this.sourceStop } : {}),
        };
    }

    private assertSourceFits(fileBytes: number, additionalBytes: number): void {
        if (fileBytes > this.policy.maxSourceBytes) {
            this.sourceStop = 'runtime_source_bytes_limit';
            throw new AgentConversationExecutionError(this.sourceStop);
        }
        if (this.sourceBytes + additionalBytes > this.policy.maxTotalSourceBytes) {
            this.sourceStop = 'runtime_total_source_bytes_limit';
            throw new AgentConversationExecutionError(this.sourceStop);
        }
    }
}
