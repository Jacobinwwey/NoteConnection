import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import type { GraphQueryBackend } from './queryBackend';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AgentConversationExecution, normalizeAgentConversationExecutionPolicy } from './agentConversationExecution';
import { resolveAgentResponseBudget } from './agentResponseBudget';

describe('agent conversation execution limits', () => {
    const document = {
        documentId: 'bounded-source',
        sourcePath: 'bounded/source.md',
        content: '# Bounded Source\n\nA bounded source explains safe execution and complete evidence. '.repeat(24),
    };

    test('client capability hints cannot exceed the declared host tier', async () => {
        const platform = new KnowledgeLearningPlatform({
            autoPersist: false,
            responseBudgetCapability: { memoryClass: 'low', workload: 'normal' },
        });
        await platform.ingestKnowledge({ documents: [document] });
        const response = await platform.agentConversation({
            message: 'Explain bounded source', responseMode: 'full', persistMemory: false,
            responseBudgetCapability: { memoryClass: 'high', workload: 'max' },
        });
        expect(response.responseBudget?.tier).toBe('standard');
    });

    test('declines oversized sources without claiming a complete source scan', async () => {
        const options = {
            autoPersist: false,
            responseExecutionPolicy: { maxSourceBytes: 96, maxTotalSourceBytes: 128 },
        };
        const platform = new KnowledgeLearningPlatform(options);
        await platform.ingestKnowledge({ documents: [document] });
        const response = await platform.agentConversation({
            message: 'Explain bounded source', responseMode: 'full', persistMemory: false,
        });
        expect(response.trace.ragContextPack?.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({ status: 'source_window_unavailable', reason: 'runtime_source_bytes_limit' }),
        ]));
        expect(response.summary.responseTruncated).toBe(true);
        expect(response.trace.ragSufficiencyReview?.status).not.toBe('sufficient');
    });

    test('expired query work cannot progress to memory or artifact writes', async () => {
        const backend: GraphQueryBackend = {
            id: 'delayed-query',
            query: async context => {
                await new Promise<void>(resolve => setTimeout(resolve, 25));
                return { candidates: context.atoms.map(atom => ({ atomId: atom.id, score: 1 })) };
            },
        };
        const options = { autoPersist: false, graphQueryBackend: backend, responseExecutionPolicy: { timeoutMs: 5 } };
        const platform = new KnowledgeLearningPlatform(options);
        await platform.ingestKnowledge({ documents: [document] });
        await expect(platform.agentConversation({
            userId: 'deadline-user', message: 'Explain bounded source', persistMemory: true,
        })).rejects.toEqual(expect.objectContaining({ code: 'runtime_timeout' }));
        const memory = await platform.listConversationMemory({ userId: 'deadline-user' });
        expect(memory.entries).toHaveLength(0);
        expect((await platform.addConversationMemory({ userId: 'deadline-user', content: 'next operation' })).added).toBe(true);
    });

    test('bounds admitted turns before they enter the serialized state queue', async () => {
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        const backend: GraphQueryBackend = {
            id: 'held-query',
            query: async context => {
                await held;
                return { candidates: context.atoms.map(atom => ({ atomId: atom.id, score: 1 })) };
            },
        };
        const options = { autoPersist: false, graphQueryBackend: backend, responseExecutionPolicy: { maxPendingTurns: 2 } };
        const platform = new KnowledgeLearningPlatform(options);
        await platform.ingestKnowledge({ documents: [document] });
        const first = platform.agentConversation({ message: 'First', persistMemory: false });
        const second = platform.agentConversation({ message: 'Second', persistMemory: false });
        const rejected = platform.agentConversation({ message: 'Third', persistMemory: false }).catch(error => error);
        await new Promise<void>(resolve => setImmediate(resolve));
        release();
        await Promise.all([first, second]);
        expect((await rejected).code).toBe('runtime_turn_capacity');
    });

    test('cancels cooperative query I/O without retrying or writing memory', async () => {
        const controller = new AbortController();
        let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        let queries = 0;
        const backend: GraphQueryBackend = {
            id: 'cancellable-query',
            query: async context => {
                queries++;
                const signal = context.signal!;
                entered();
                await new Promise<void>((_resolve, reject) => {
                    if (signal.aborted) reject(signal.reason);
                    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
                });
                return { candidates: [] };
            },
        };
        const platform = new KnowledgeLearningPlatform({ autoPersist: false, graphQueryBackend: backend });
        await platform.ingestKnowledge({ documents: [document] });
        const turn = platform.agentConversation({ userId: 'cancelled-user', message: 'Bounded source' }, controller.signal)
            .catch(error => error);
        await started;
        controller.abort();
        expect((await turn).code).toBe('runtime_cancelled');
        expect(queries).toBe(1);
        expect((await platform.listConversationMemory({ userId: 'cancelled-user' })).entries).toHaveLength(0);
    });

    test('rejects dense source structure while preserving direct evidence', async () => {
        const options = { autoPersist: false, responseExecutionPolicy: { maxSourceLines: 4 } };
        const platform = new KnowledgeLearningPlatform(options);
        await platform.ingestKnowledge({ documents: [document] });
        const response = await platform.agentConversation({ message: 'Explain bounded source', persistMemory: false });
        expect(response.trace.ragContextPack?.sourceDecisions.some(item => item.reason === 'runtime_source_lines_limit')).toBe(true);
        expect(response.trace.ragSufficiencyReview?.status).not.toBe('sufficient');
        expect(response.citations.length).toBeGreaterThan(0);
    });

    test('keeps the default tier conservative when only the host ceiling is configured', async () => {
        const platform = new KnowledgeLearningPlatform({
            autoPersist: false,
            responseBudgetHostCapability: { memoryClass: 'high', workload: 'max' },
        });
        await platform.ingestKnowledge({ documents: [document] });
        const request = { message: 'Explain bounded source', responseMode: 'full' as const, persistMemory: false };
        expect((await platform.agentConversation(request)).responseBudget?.tier).toBe('standard');
        expect((await platform.agentConversation({
            ...request, responseBudgetCapability: { memoryClass: 'high', workload: 'max' },
        })).responseBudget?.tier).toBe('max');
    });

    test('a cancelled queued turn never reaches query or persistence', async () => {
        let release!: () => void;
        let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        const held = new Promise<void>(resolve => { release = resolve; });
        const query = jest.fn(async () => { entered(); await held; return { candidates: [] }; });
        const platform = new KnowledgeLearningPlatform({ autoPersist: false, graphQueryBackend: { id: 'held', query } });
        const first = platform.agentConversation({ message: 'First', persistMemory: false });
        await started;
        const controller = new AbortController();
        const second = platform.agentConversation({ userId: 'queued', message: 'Second' }, controller.signal).catch(error => error);
        controller.abort();
        release();
        await first;
        expect((await second).code).toBe('runtime_cancelled');
        expect(query).toHaveBeenCalledTimes(1);
        expect((await platform.listConversationMemory({ userId: 'queued' })).entries).toHaveLength(0);
    });
});

describe('bounded source file I/O', () => {
    let directory: string;
    beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'source-budget-')); });
    afterEach(async () => {
        jest.restoreAllMocks();
        await fs.rm(directory, { recursive: true, force: true });
    });

    test('counts UTF-8 bytes at the exact file limit and charges cumulative reads', async () => {
        const filePath = path.join(directory, 'unicode.md');
        const source = '知识🧠';
        const bytes = Buffer.byteLength(source);
        await fs.writeFile(filePath, source);
        await AgentConversationExecution.run({
            budget: resolveAgentResponseBudget(),
            policy: normalizeAgentConversationExecutionPolicy({ maxSourceBytes: bytes, maxTotalSourceBytes: bytes }),
        }, async execution => {
            expect(await execution.readSourceFile(filePath)).toBe(source);
            expect(execution.diagnostics().sourceBytes).toBe(bytes);
            await expect(execution.readSourceFile(filePath)).rejects.toHaveProperty('code', 'runtime_total_source_bytes_limit');
        });
    });

    test('bounds actual bytes when a source grows after stat and closes the descriptor', async () => {
        const filePath = path.join(directory, 'growing.md');
        await fs.writeFile(filePath, 'small');
        const file = await fs.open(filePath, 'r');
        const oldStat = await file.stat();
        await fs.appendFile(filePath, 'x'.repeat(128 * 1024));
        jest.spyOn(file, 'stat').mockResolvedValueOnce(oldStat);
        const close = jest.spyOn(file, 'close');
        jest.spyOn(fs, 'open').mockResolvedValueOnce(file);
        await expect(AgentConversationExecution.run({
            budget: resolveAgentResponseBudget(),
            policy: normalizeAgentConversationExecutionPolicy({ maxSourceBytes: 16 }),
        }, execution => execution.readSourceFile(filePath))).rejects.toHaveProperty('code', 'runtime_source_bytes_limit');
        expect(close).toHaveBeenCalled();
        await expect(file.stat()).rejects.toHaveProperty('code', 'EBADF');
    });

    test('aborts a source stream and closes its descriptor', async () => {
        const filePath = path.join(directory, 'cancelled.md');
        await fs.writeFile(filePath, Buffer.alloc(256 * 1024, 65));
        const file = await fs.open(filePath, 'r');
        const controller = new AbortController();
        const createReadStream = file.createReadStream.bind(file);
        jest.spyOn(file, 'createReadStream').mockImplementation(options => {
            const stream = createReadStream(options);
            stream.once('data', () => controller.abort());
            return stream;
        });
        jest.spyOn(fs, 'open').mockResolvedValueOnce(file);
        await expect(AgentConversationExecution.run({
            budget: resolveAgentResponseBudget(), policy: normalizeAgentConversationExecutionPolicy(), signal: controller.signal,
        }, execution => execution.readSourceFile(filePath))).rejects.toHaveProperty('code', 'runtime_cancelled');
        await expect(file.stat()).rejects.toHaveProperty('code', 'EBADF');
    });
});
