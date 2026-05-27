import type * as http from 'http';

export interface RuntimeRunbookRouteOps {
    getRunbook?: (request?: { checkId?: string }) => Promise<any>;
    verify?: (request?: {
        checkId?: string;
        limit?: number;
        sinceMinutes?: number;
        status?: string;
        checkQuery?: string;
        focus?: string;
        focusLimit?: number;
    }) => Promise<any>;
    getHistory?: (request?: {
        limit?: number;
        checkId?: string;
        sinceMinutes?: number;
        status?: string;
    }) => Promise<any>;
    getChecks?: (request?: {
        limit?: number;
        sinceMinutes?: number;
        status?: string;
        checkQuery?: string;
    }) => Promise<any>;
    getActionQueue?: (request?: {
        limit?: number;
        sinceMinutes?: number;
        status?: string;
        checkQuery?: string;
        queueLimit?: number;
        priority?: string;
        category?: string;
        checkId?: string;
        remediationStatus?: string;
        remediationTrend?: string;
    }) => Promise<any>;
    getRemediationHistory?: (request?: {
        limit?: number;
        sinceMinutes?: number;
        status?: string;
        source?: string;
        checkId?: string;
    }) => Promise<any>;
    getReplaySchedule?: () => Promise<any>;
    recordRemediationEvent?: (payload?: unknown, requestId?: string) => Promise<any>;
    replayRemediationEvent?: (payload?: unknown) => Promise<any>;
    updateReplaySchedule?: (payload?: unknown) => Promise<any>;
    tickReplaySchedule?: (payload?: unknown) => Promise<any>;
}

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
    persistNotemdSettings?: (settingsLike: unknown) => Promise<any>;
    loadFrontendSettings?: () => Promise<any>;
    markdownGateway?: any;
    LOOPBACK_HOST: string;
    finalPort: number;
    KNOWLEDGE_GRAPH_STORE_BACKEND: string;
    KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: string;
    KNOWLEDGE_GRAPHDB_ADAPTER_ID: string;
    KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: boolean;
    KNOWLEDGE_GRAPHDB_OPERATION_MODE: string;
    kbRoot: string;
    runtimeDataDir: string;
    runtimeRunbookOps?: RuntimeRunbookRouteOps;
    getPathBridge?: () => any;
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
