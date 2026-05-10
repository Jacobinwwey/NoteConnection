/** ConversationManager — L4: Agent conversation + memory CRUD governance. */
export interface ConversationPlatform {
    runAgentConversation(request: any): Promise<any>;
    addConversationMemory(request: any): Promise<any>;
    listConversationMemory(request: any): Promise<any>;
    searchConversationMemory(request: any): Promise<any>;
    deleteConversationMemory(request: any): Promise<any>;
    feedbackConversationMemory(request: any): Promise<any>;
}

export class ConversationManager {
    private turnCount = 0;
    private totalResponseLatencyMs = 0;
    private memoryOpCounts = { add: 0, list: 0, search: 0, delete: 0, feedback: 0 };
    private lastConversationAt: string | null = null;

    constructor(private readonly platform: ConversationPlatform) {}

    async runAgentConversation(request: any): Promise<any> {
        this.validateConversationRequest(request);
        const startMs = Date.now();
        const response = await this.platform.runAgentConversation(request);
        this.turnCount++;
        this.totalResponseLatencyMs += Date.now() - startMs;
        this.lastConversationAt = new Date().toISOString();
        return this.augmentConversationResponse(response, Date.now() - startMs);
    }

    async addMemory(r: any) { this.validateMemoryRequest(r, 'add'); this.memoryOpCounts.add++; return this.platform.addConversationMemory(r); }
    async listMemory(r: any) { this.memoryOpCounts.list++; return this.platform.listConversationMemory(r); }
    async searchMemory(r: any) { this.memoryOpCounts.search++; return this.platform.searchConversationMemory(r); }
    async deleteMemory(r: any) { this.memoryOpCounts.delete++; return this.platform.deleteConversationMemory(r); }
    async feedbackMemory(r: any) { this.memoryOpCounts.feedback++; return this.platform.feedbackConversationMemory(r); }

    getTurnCount(): number { return this.turnCount; }
    averageResponseLatencyMs(): number { return this.turnCount === 0 ? 0 : Math.round(this.totalResponseLatencyMs / this.turnCount); }

    getDiagnosticsSummary() {
        return { turnCount: this.turnCount, averageResponseLatencyMs: this.averageResponseLatencyMs(), lastConversationAt: this.lastConversationAt, memoryOperations: { ...this.memoryOpCounts }, totalMemoryOps: Object.values(this.memoryOpCounts).reduce((a: any, b: any) => a + b, 0) };
    }

    private validateConversationRequest(r: any): void {
        if (!r) throw new Error('Conversation request is required.');
        const query = String(r?.query ?? '').trim();
        if (!query) throw new Error('Conversation query must not be empty.');
        if (query.length > 10000) throw new Error('Conversation query exceeds maximum length.');
    }

    private validateMemoryRequest(r: any, op: string): void {
        if (!r) throw new Error(`Memory ${op} request is required.`);
        if (op === 'add' || op === 'search') {
            const content = String(r?.content ?? r?.query ?? '').trim();
            if (!content) throw new Error(`Memory ${op} requires non-empty content.`);
        }
    }

    private augmentConversationResponse(response: any, latencyMs: number): any {
        return { ...response, _domain: { turnNumber: this.turnCount, latencyMs: Math.round(latencyMs), memoryOps: this.memoryOpCounts, generatedAt: this.lastConversationAt } };
    }
}
