import type * as http from 'http';

export interface ServerContext {
    knowledgeLearningPlatform: any;
    knowledgeIngestor: any;
    knowledgeQuerier: any;
    conversationManager: any;
    masteryEngine: any;
    qualityEvaluator: any;
    tutorRouter: any;
    memoryPolicyManager: any;
    notemdService: any;
    loadNotemdSettings: () => Promise<any>;
    LOOPBACK_HOST: string;
    finalPort: number;
    KNOWLEDGE_GRAPH_STORE_BACKEND: string;
    KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: string;
    KNOWLEDGE_GRAPHDB_ADAPTER_ID: string;
    KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: boolean;
    KNOWLEDGE_GRAPHDB_OPERATION_MODE: string;
    kbRoot: string;
    runtimeDataDir: string;
}

export type RouteHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    ctx: ServerContext
) => Promise<void>;

export interface RouteEntry {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    prefix?: boolean;
    handler: RouteHandler;
}

export type RouteRegistrar = (ctx: ServerContext) => RouteEntry[];
