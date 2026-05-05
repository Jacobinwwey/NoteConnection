/**
 * ConversationManager domain — L4: Agent conversation + memory CRUD.
 * Note: full type migration pending M8-M10 type stabilization.
 */
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
        const startMs = Date.now();
        const response = await this.platform.runAgentConversation(request);
        this.turnCount++;
        this.totalResponseLatencyMs += Date.now() - startMs;
        this.lastConversationAt = new Date().toISOString();
        return response;
    }

    async addMemory(request: any): Promise<any> { this.memoryOpCounts.add++; return this.platform.addConversationMemory(request); }
    async listMemory(request: any): Promise<any> { this.memoryOpCounts.list++; return this.platform.listConversationMemory(request); }
    async searchMemory(request: any): Promise<any> { this.memoryOpCounts.search++; return this.platform.searchConversationMemory(request); }
    async deleteMemory(request: any): Promise<any> { this.memoryOpCounts.delete++; return this.platform.deleteConversationMemory(request); }
    async feedbackMemory(request: any): Promise<any> { this.memoryOpCounts.feedback++; return this.platform.feedbackConversationMemory(request); }

    getTurnCount(): number { return this.turnCount; }
    getLastConversationAt(): string | null { return this.lastConversationAt; }
    averageResponseLatencyMs(): number {
        if (this.turnCount === 0) return 0;
        return Math.round(this.totalResponseLatencyMs / this.turnCount);
    }

    getDiagnosticsSummary() {
        return {
            turnCount: this.turnCount,
            averageResponseLatencyMs: this.averageResponseLatencyMs(),
            lastConversationAt: this.lastConversationAt,
            memoryOperations: { ...this.memoryOpCounts },
            totalMemoryOps: Object.values(this.memoryOpCounts).reduce((a: any, b: any) => a + b, 0),
        };
    }
}
