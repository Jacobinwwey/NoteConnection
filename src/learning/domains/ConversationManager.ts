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
    streamAgentConversation(request: AgentConversationRequest): AsyncIterable<any>;
    addConversationMemory(request: ConversationMemoryAddRequest): Promise<ConversationMemoryAddResponse>;
    listConversationMemory(request: ConversationMemoryListRequest): Promise<ConversationMemoryListResponse>;
    searchConversationMemory(request: ConversationMemorySearchRequest): Promise<ConversationMemorySearchResponse>;
    deleteConversationMemory(request: ConversationMemoryDeleteRequest): Promise<ConversationMemoryDeleteResponse>;
    feedbackConversationMemory(request: ConversationMemoryFeedbackRequest): Promise<ConversationMemoryFeedbackResponse>;
    getAgentConversationTurnCacheDiagnostics(request: { format: string }): Promise<any>;
    getAgentConversationTurnCacheTrend(request: { limit: number; windowSize: number; minSamples: number }): Promise<any>;
}

export class ConversationManager {
    private turnCount = 0;
    private totalResponseLatencyMs = 0;

    constructor(private readonly platform: ConversationPlatform) {}

    async runAgentConversation(request: AgentConversationRequest): Promise<AgentConversationResponse> {
        const startMs = Date.now();
        const response = await this.platform.runAgentConversation(request);
        this.turnCount++;
        this.totalResponseLatencyMs += Date.now() - startMs;
        return response;
    }

    streamAgentConversation(request: AgentConversationRequest): AsyncIterable<any> {
        return this.platform.streamAgentConversation(request);
    }

    async addMemory(request: ConversationMemoryAddRequest): Promise<ConversationMemoryAddResponse> {
        return this.platform.addConversationMemory(request);
    }

    async listMemory(request: ConversationMemoryListRequest): Promise<ConversationMemoryListResponse> {
        return this.platform.listConversationMemory(request);
    }

    async searchMemory(request: ConversationMemorySearchRequest): Promise<ConversationMemorySearchResponse> {
        return this.platform.searchConversationMemory(request);
    }

    async deleteMemory(request: ConversationMemoryDeleteRequest): Promise<ConversationMemoryDeleteResponse> {
        return this.platform.deleteConversationMemory(request);
    }

    async feedbackMemory(request: ConversationMemoryFeedbackRequest): Promise<ConversationMemoryFeedbackResponse> {
        return this.platform.feedbackConversationMemory(request);
    }

    getTurnCount(): number { return this.turnCount; }
    averageResponseLatencyMs(): number {
        if (this.turnCount === 0) return 0;
        return this.totalResponseLatencyMs / this.turnCount;
    }
}
