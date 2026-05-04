/**
 * ConversationManager domain — L4: Agent conversation, turn streaming,
 * conversation memory CRUD, and turn-cache governance.
 */

import type {
    AgentConversationRequest, AgentConversationResponse,
    ConversationMemoryAddRequest, ConversationMemoryAddResponse,
    ConversationMemoryListRequest, ConversationMemoryListResponse,
    ConversationMemorySearchRequest, ConversationMemorySearchResponse,
    ConversationMemoryDeleteRequest, ConversationMemoryDeleteResponse,
    ConversationMemoryFeedbackRequest, ConversationMemoryFeedbackResponse,
} from '../types';

export interface ConversationPlatform {
    runAgentConversation(request: AgentConversationRequest): Promise<AgentConversationResponse>;
    addConversationMemory(request: ConversationMemoryAddRequest): Promise<ConversationMemoryAddResponse>;
    listConversationMemory(request: ConversationMemoryListRequest): Promise<ConversationMemoryListResponse>;
    searchConversationMemory(request: ConversationMemorySearchRequest): Promise<ConversationMemorySearchResponse>;
    deleteConversationMemory(request: ConversationMemoryDeleteRequest): Promise<ConversationMemoryDeleteResponse>;
    feedbackConversationMemory(request: ConversationMemoryFeedbackRequest): Promise<ConversationMemoryFeedbackResponse>;
}

export class ConversationManager {
    private turnCount = 0;
    private totalResponseLatencyMs = 0;
    private memoryOpCounts = { add: 0, list: 0, search: 0, delete: 0, feedback: 0 };
    private lastConversationAt: string | null = null;

    constructor(private readonly platform: ConversationPlatform) {}

    async runAgentConversation(request: AgentConversationRequest): Promise<AgentConversationResponse> {
        const startMs = Date.now();
        const response = await this.platform.runAgentConversation(request);
        this.turnCount++;
        this.totalResponseLatencyMs += Date.now() - startMs;
        this.lastConversationAt = new Date().toISOString();
        return response;
    }

    async addMemory(request: ConversationMemoryAddRequest): Promise<ConversationMemoryAddResponse> {
        this.memoryOpCounts.add++;
        return this.platform.addConversationMemory(request);
    }

    async listMemory(request: ConversationMemoryListRequest): Promise<ConversationMemoryListResponse> {
        this.memoryOpCounts.list++;
        return this.platform.listConversationMemory(request);
    }

    async searchMemory(request: ConversationMemorySearchRequest): Promise<ConversationMemorySearchResponse> {
        this.memoryOpCounts.search++;
        return this.platform.searchConversationMemory(request);
    }

    async deleteMemory(request: ConversationMemoryDeleteRequest): Promise<ConversationMemoryDeleteResponse> {
        this.memoryOpCounts.delete++;
        return this.platform.deleteConversationMemory(request);
    }

    async feedbackMemory(request: ConversationMemoryFeedbackRequest): Promise<ConversationMemoryFeedbackResponse> {
        this.memoryOpCounts.feedback++;
        return this.platform.feedbackConversationMemory(request);
    }

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
            totalMemoryOps: Object.values(this.memoryOpCounts).reduce((a, b) => a + b, 0),
        };
    }
}
