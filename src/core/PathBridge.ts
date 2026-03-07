import { WebSocketServer, WebSocket } from 'ws';

type PathBridgeOptions = {
    port?: number;
    host?: string;
    authToken?: string;
};

type ClientMeta = {
    id: number;
    tag: string;
    address: string;
    authorized: boolean;
};

type BridgeStatusLevel = 'info' | 'success' | 'warning' | 'error';

type PathStatusPayload = {
    level: BridgeStatusLevel;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    terminal: boolean;
    timestamp: number;
};

type PendingPathRequest = {
    client: WebSocket;
    requestedAt: number;
    timer: NodeJS.Timeout;
};

type MermaidRenderRequestPayload = {
    requestId: string;
    source: string;
    maxWidth?: number;
    maxHeight?: number;
    renderScale?: number;
    theme?: 'dark' | 'default';
    includeStages?: boolean;
};

type MermaidRenderStagePayload = {
    stage: string;
    svg: string;
    width?: number;
    height?: number;
};

type MermaidRenderResultPayload = {
    requestId: string;
    ok: boolean;
    pngBase64?: string;
    svg?: string;
    width?: number;
    height?: number;
    renderer?: string;
    stages?: MermaidRenderStagePayload[];
    error?: string;
};

type PendingMermaidRenderRequest = {
    resolve: (payload: MermaidRenderResultPayload) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
};

export type PathTransportSummary = {
    centralId: string;
    totalNodes: number;
    pathNodeCount: number;
    pathNodeIds: string[];
    peripheralIds: string[];
    completedIds: string[];
    treeNodeIds: string[];
    progressCompleted: number;
    progressTotal: number;
    mode: string;
    filepath: string;
};

type PathValidationResult = {
    ok: boolean;
    warnings: string[];
    errors: string[];
    transport: {
        summary: PathTransportSummary;
        fingerprint: string;
        declaredSummary: PathTransportSummary | null;
        declaredFingerprint: string;
    };
};

const PATH_REQUEST_TIMEOUT_MS = 3000;
const PATH_PRODUCER_GRACE_MS = 30000;
const MERMAID_RENDER_TIMEOUT_MS = 12000;
const PATH_MUTATION_TYPES = new Set([
    'nodeClick',
    'markComplete',
    'switchCenter',
    'unmarkComplete',
    'completionSync',
    'toggleCollapse',
    'expandPrereqs',
    'collapsePrereqs',
    'collapseAll',
    'configure',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => {
            if (typeof item === 'string') {
                return item.trim();
            }
            if (isRecord(item) && typeof item.id === 'string') {
                return item.id.trim();
            }
            return String(item ?? '').trim();
        })
        .filter((item) => item.length > 0);
}

function toInteger(value: unknown, fallback = 0): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(0, Math.trunc(numeric));
}

function normalizeTransportSummary(summaryLike: Record<string, unknown>): PathTransportSummary {
    return {
        centralId: typeof summaryLike.centralId === 'string' ? summaryLike.centralId.trim() : '',
        totalNodes: toInteger(summaryLike.totalNodes),
        pathNodeCount: toInteger(summaryLike.pathNodeCount),
        pathNodeIds: toStringList(summaryLike.pathNodeIds),
        peripheralIds: toStringList(summaryLike.peripheralIds),
        completedIds: toStringList(summaryLike.completedIds).sort((a, b) => a.localeCompare(b)),
        treeNodeIds: toStringList(summaryLike.treeNodeIds),
        progressCompleted: toInteger(summaryLike.progressCompleted),
        progressTotal: toInteger(summaryLike.progressTotal),
        mode: typeof summaryLike.mode === 'string' ? summaryLike.mode.trim() : '',
        filepath: typeof summaryLike.filepath === 'string' ? summaryLike.filepath.trim() : '',
    };
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
    }

    if (isRecord(value)) {
        const entries = Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
        return `{${entries.join(',')}}`;
    }

    return JSON.stringify(value ?? null);
}

export function computeBridgePathFingerprint(summary: PathTransportSummary): string {
    const normalized = stableStringify(summary);
    let hash = 2166136261;
    for (let index = 0; index < normalized.length; index += 1) {
        hash ^= normalized.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildBridgePathTransportSummary(pathData: unknown): PathTransportSummary {
    if (!isRecord(pathData)) {
        return normalizeTransportSummary({});
    }

    const central = isRecord(pathData.central) ? pathData.central : {};
    const progress = isRecord(pathData.progress) ? pathData.progress : {};
    const centralMetadata = isRecord(central.metadata) ? central.metadata : {};
    const pathNodes = Array.isArray(pathData.pathNodes) ? pathData.pathNodes : [];
    const peripherals = Array.isArray(pathData.peripherals) ? pathData.peripherals : [];
    const completedIds = Array.isArray(pathData.completedIds) ? pathData.completedIds : [];
    const treeLayout = isRecord(pathData.treeLayout) ? pathData.treeLayout : null;
    const treeNodes = treeLayout && Array.isArray(treeLayout.nodes) ? treeLayout.nodes : [];

    return normalizeTransportSummary({
        centralId: typeof central.id === 'string' ? central.id : '',
        totalNodes: pathData.totalNodes,
        pathNodeCount: pathNodes.length,
        pathNodeIds: pathNodes.map((node) => (isRecord(node) ? node.id : node)),
        peripheralIds: peripherals.map((node) => (isRecord(node) ? node.id : node)),
        completedIds,
        treeNodeIds: treeNodes.map((node) => (isRecord(node) ? node.id : node)),
        progressCompleted: progress.completed,
        progressTotal: progress.total,
        mode: typeof pathData.mode === 'string' ? pathData.mode : '',
        filepath: typeof centralMetadata.filepath === 'string' ? centralMetadata.filepath : '',
    });
}

export function validateBridgePathPayload(pathData: unknown): PathValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const summary = buildBridgePathTransportSummary(pathData);
    const fingerprint = computeBridgePathFingerprint(summary);
    let declaredSummary: PathTransportSummary | null = null;
    let declaredFingerprint = '';

    if (!isRecord(pathData)) {
        errors.push('Path payload must be an object.');
        return {
            ok: false,
            warnings,
            errors,
            transport: {
                summary,
                fingerprint,
                declaredSummary,
                declaredFingerprint,
            },
        };
    }

    if (!summary.centralId) {
        errors.push('Path payload is missing central.id.');
    }
    if (summary.totalNodes <= 0) {
        errors.push('Path payload must declare a positive totalNodes value.');
    }
    if (summary.pathNodeCount <= 0) {
        errors.push('Path payload must include at least one path node.');
    }
    if (summary.totalNodes > 0 && summary.totalNodes !== summary.pathNodeCount) {
        errors.push('Path payload totalNodes does not match pathNodes length.');
    }
    if (summary.progressCompleted > summary.progressTotal) {
        errors.push('Path payload progress.completed exceeds progress.total.');
    }
    if (summary.progressTotal > 0 && summary.totalNodes > 0 && summary.progressTotal !== summary.totalNodes) {
        warnings.push('Path payload progress.total does not match totalNodes.');
    }

    const pathNodeSet = new Set(summary.pathNodeIds);
    if (pathNodeSet.size !== summary.pathNodeIds.length) {
        errors.push('Path payload pathNodes contains duplicate node IDs.');
    }
    if (summary.centralId && !pathNodeSet.has(summary.centralId)) {
        errors.push('Path payload central node is missing from pathNodes.');
    }
    if (summary.peripheralIds.some((nodeId) => !pathNodeSet.has(nodeId))) {
        warnings.push('Path payload contains peripherals that are missing from pathNodes.');
    }
    if (summary.treeNodeIds.some((nodeId) => !pathNodeSet.has(nodeId))) {
        warnings.push('Path payload treeLayout contains nodes that are missing from pathNodes.');
    }

    const transportMeta = isRecord(pathData._bridgeTransport) ? pathData._bridgeTransport : null;
    if (!transportMeta) {
        warnings.push('Missing _bridgeTransport verification metadata.');
    } else {
        if (isRecord(transportMeta.summary)) {
            declaredSummary = normalizeTransportSummary(transportMeta.summary);
        } else {
            warnings.push('Missing _bridgeTransport.summary payload.');
        }

        if (typeof transportMeta.fingerprint === 'string') {
            declaredFingerprint = transportMeta.fingerprint.trim();
        }
        if (!declaredFingerprint) {
            warnings.push('Missing _bridgeTransport.fingerprint payload.');
        }
    }

    if (declaredSummary && stableStringify(declaredSummary) !== stableStringify(summary)) {
        errors.push('Frontend/back-end transport summary mismatch.');
    }
    if (declaredFingerprint && declaredFingerprint !== fingerprint) {
        errors.push('Frontend/back-end transport fingerprint mismatch.');
    }

    return {
        ok: errors.length === 0,
        warnings,
        errors,
        transport: {
            summary,
            fingerprint,
            declaredSummary,
            declaredFingerprint,
        },
    };
}

export class PathBridge {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private clientMeta: Map<WebSocket, ClientMeta> = new Map();
    private nextClientId = 1;
    private port: number;
    private host: string;
    private authToken: string;
    private currentPath: Record<string, unknown> | null = null;
    private pendingPathRequests: Map<WebSocket, PendingPathRequest> = new Map();
    private pendingMermaidRenderRequests: Map<string, PendingMermaidRenderRequest> = new Map();
    private nextMermaidRenderRequestId = 1;

    constructor(options: number | PathBridgeOptions = 9876) {
        const resolvedOptions: PathBridgeOptions = typeof options === 'number'
            ? { port: options }
            : (options || {});
        this.port = resolvedOptions.port || 9876;
        this.host = resolvedOptions.host || '127.0.0.1';
        this.authToken = typeof resolvedOptions.authToken === 'string' ? resolvedOptions.authToken.trim() : '';
        this.wss = new WebSocketServer({ port: this.port, host: this.host });

        console.log(`[PathBridge] WebSocket Server started on ws://${this.host}:${this.port}`);

        this.wss.on('connection', (ws, request) => {
            const clientId = this.nextClientId++;
            const clientTag = this.resolveClientTag(request.url || '');
            const clientAddress = request.socket.remoteAddress || 'unknown';
            const initialToken = this.extractConnectionToken(request.url || '');
            const isAuthorized = !this.authToken || initialToken === this.authToken;

            this.clientMeta.set(ws, {
                id: clientId,
                tag: clientTag,
                address: clientAddress,
                authorized: isAuthorized,
            });
            this.clients.add(ws);
            console.log(
                `[PathBridge] Client connected #${clientId} (${clientTag}) from ${clientAddress}. Total clients: ${this.clients.size}`
            );

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (!this.authorizeClient(ws, data)) {
                        const meta = this.clientMeta.get(ws);
                        console.warn(
                            `[PathBridge] Rejected unauthorized message from #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'})`
                        );
                        ws.close(4401, 'Unauthorized');
                        return;
                    }
                    this.handleMessage(data, ws);
                } catch (error) {
                    console.error('[PathBridge] Message error:', error);
                }
            });

            ws.on('close', (code, reasonBuffer) => {
                const meta = this.clientMeta.get(ws);
                const reason = reasonBuffer?.toString() || '';
                const wasProducer = !!meta && this.isPathProducerTag(meta.tag);
                this.clearPendingPathRequest(ws);
                this.clients.delete(ws);
                this.clientMeta.delete(ws);
                console.log(
                    `[PathBridge] Client disconnected #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}) code=${code} reason='${reason}'. Total clients: ${this.clients.size}`
                );

                if (wasProducer && this.pendingPathRequests.size > 0 && this.getPathProducerClients().length === 0) {
                    this.notifyPendingPathRequests(this.buildStatusPayload(
                        'warning',
                        'path_producer_disconnected',
                        'All frontend path producers disconnected while waiting for path data.',
                        {
                            disconnectedClient: meta?.tag ?? 'unknown',
                            connectedClients: this.describeConnectedClients(),
                        },
                        false
                    ));
                }
            });

            ws.on('error', (error) => {
                const meta = this.clientMeta.get(ws);
                console.error(
                    `[PathBridge] Client error #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}):`,
                    error
                );
            });
        });
    }

    private parseConnectionUrl(rawUrl: string): URL | null {
        try {
            return new URL(rawUrl || '/', `ws://${this.host}:${this.port}`);
        } catch (_error) {
            return null;
        }
    }

    private extractConnectionToken(rawUrl: string): string {
        const parsed = this.parseConnectionUrl(rawUrl);
        return parsed?.searchParams.get('token')?.trim() || '';
    }

    private authorizeClient(ws: WebSocket, data: any): boolean {
        if (!this.authToken) {
            return true;
        }

        const meta = this.clientMeta.get(ws);
        if (!meta) {
            return false;
        }
        if (meta.authorized) {
            return true;
        }

        if (data?.type !== 'identify' && data?.type !== 'authenticate') {
            return false;
        }

        const providedToken = String(data?.payload?.token ?? data?.token ?? '').trim();
        if (!providedToken || providedToken !== this.authToken) {
            return false;
        }

        meta.authorized = true;
        this.clientMeta.set(ws, meta);
        const requestedTag = data?.payload?.client ?? data?.payload?.tag ?? data?.client;
        if (requestedTag) {
            this.setClientTag(ws, requestedTag);
        }
        console.log(`[PathBridge] Client #${meta.id} authorized.`);
        return true;
    }

    private sanitizeClientTag(rawTag: unknown): string {
        if (typeof rawTag !== 'string') {
            return 'unknown';
        }

        const cleaned = rawTag.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        return cleaned.length > 0 ? cleaned : 'unknown';
    }

    private resolveClientTag(rawUrl: string): string {
        const parsed = this.parseConnectionUrl(rawUrl);
        if (!parsed) {
            return 'unknown';
        }
        const client = parsed.searchParams.get('client');
        return this.sanitizeClientTag(client);
    }

    private setClientTag(ws: WebSocket, tag: string): void {
        const meta = this.clientMeta.get(ws);
        if (!meta) {
            return;
        }

        const nextTag = this.sanitizeClientTag(tag);
        if (nextTag === 'unknown' || meta.tag === nextTag) {
            return;
        }

        meta.tag = nextTag;
        this.clientMeta.set(ws, meta);
        console.log(
            `[PathBridge] Client #${meta.id} tagged as '${nextTag}'. Total clients: ${this.clients.size}`
        );

        if (this.isPathProducerTag(nextTag) && this.pendingPathRequests.size > 0) {
            this.notifyPendingPathRequests(this.buildStatusPayload(
                'info',
                'path_producer_connected',
                'Frontend path producer connected. Waiting for published path data.',
                {
                    producer: nextTag,
                    connectedClients: this.describeConnectedClients(),
                },
                false
            ));
        }
    }

    private isPathProducerTag(tag: string): boolean {
        return tag.startsWith('frontend');
    }

    private getOpenClients(): WebSocket[] {
        return Array.from(this.clients).filter((client) => client.readyState === WebSocket.OPEN);
    }

    private getPathProducerClients(): WebSocket[] {
        return this.getOpenClients().filter((client) => {
            const meta = this.clientMeta.get(client);
            return !!meta && meta.authorized && this.isPathProducerTag(meta.tag);
        });
    }

    private getPreferredFrontendClient(): WebSocket | null {
        const rankedClients = this.getPathProducerClients().sort((left, right) => {
            const leftTag = this.clientMeta.get(left)?.tag || '';
            const rightTag = this.clientMeta.get(right)?.tag || '';
            const leftRank = leftTag === 'frontend' ? 0 : leftTag === 'frontend-early' ? 1 : 2;
            const rightRank = rightTag === 'frontend' ? 0 : rightTag === 'frontend-early' ? 1 : 2;
            return leftRank - rightRank;
        });
        return rankedClients[0] || null;
    }

    private describeConnectedClients(): string[] {
        return this.getOpenClients().map((client) => {
            const meta = this.clientMeta.get(client);
            if (!meta) {
                return 'unknown';
            }
            return `${meta.tag}#${meta.id}`;
        });
    }

    private sendMessage(client: WebSocket, type: string, payload: unknown): void {
        if (client.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            client.send(JSON.stringify({ type, payload }));
        } catch (error) {
            const meta = this.clientMeta.get(client);
            console.error(
                `[PathBridge] Send error to #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}):`,
                error
            );
        }
    }

    private broadcastTo(predicate: (client: WebSocket) => boolean, type: string, payload: unknown): void {
        this.getOpenClients().forEach((client) => {
            if (!predicate(client)) {
                return;
            }
            this.sendMessage(client, type, payload);
        });
    }

    private buildStatusPayload(
        level: BridgeStatusLevel,
        code: string,
        message: string,
        details: Record<string, unknown> = {},
        terminal = false
    ): PathStatusPayload {
        return {
            level,
            code,
            message,
            details,
            terminal,
            timestamp: Date.now(),
        };
    }

    private sendStatus(client: WebSocket, payload: PathStatusPayload): void {
        this.sendMessage(client, 'pathStatus', payload);
    }

    private notifyPendingPathRequests(payload: PathStatusPayload): void {
        const pendingClients = Array.from(this.pendingPathRequests.keys());
        pendingClients.forEach((client) => this.sendStatus(client, payload));
        if (payload.terminal) {
            this.clearAllPendingPathRequests();
        }
    }

    private clearPendingPathRequest(client: WebSocket): void {
        const pending = this.pendingPathRequests.get(client);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timer);
        this.pendingPathRequests.delete(client);
    }

    private clearAllPendingPathRequests(): void {
        Array.from(this.pendingPathRequests.keys()).forEach((client) => this.clearPendingPathRequest(client));
    }

    private invalidateCurrentPath(reason: string): void {
        if (!this.currentPath) {
            return;
        }
        console.log(`[PathBridge] Invalidating cached path after '${reason}'`);
        this.currentPath = null;
    }

    private handlePathRequest(requester: WebSocket): void {
        const requesterMeta = this.clientMeta.get(requester);
        console.log('[PathBridge] Godot requested path data');

        if (this.currentPath) {
            console.log('[PathBridge] Serving cached pathResult to requester');
            this.sendStatus(requester, this.buildStatusPayload(
                'success',
                'path_cache_hit',
                'Using verified cached path data.',
                {
                    requester: requesterMeta?.tag ?? 'unknown',
                },
                false
            ));
            this.sendMessage(requester, 'pathResult', this.currentPath);
            return;
        }

        const producers = this.getPathProducerClients();
        if (producers.length === 0) {
            this.clearPendingPathRequest(requester);
            const timer = setTimeout(() => {
                this.pendingPathRequests.delete(requester);
                if (this.currentPath) {
                    this.sendStatus(requester, this.buildStatusPayload(
                        'success',
                        'path_cache_hit',
                        'Using verified cached path data after waiting for a frontend producer.',
                        {
                            requester: requesterMeta?.tag ?? 'unknown',
                        },
                        false
                    ));
                    this.sendMessage(requester, 'pathResult', this.currentPath);
                    return;
                }

                this.sendStatus(requester, this.buildStatusPayload(
                    'error',
                    'path_producer_unavailable',
                    'No frontend path producer is connected and no cached path data is available.',
                    {
                        requester: requesterMeta?.tag ?? 'unknown',
                        connectedClients: this.describeConnectedClients(),
                        hasCachedPath: false,
                        waitMs: PATH_PRODUCER_GRACE_MS,
                    },
                    true
                ));
            }, PATH_PRODUCER_GRACE_MS);

            this.pendingPathRequests.set(requester, {
                client: requester,
                requestedAt: Date.now(),
                timer,
            });

            this.sendStatus(requester, this.buildStatusPayload(
                'info',
                'path_producer_waiting',
                'Waiting for a frontend path producer to connect.',
                {
                    requester: requesterMeta?.tag ?? 'unknown',
                    connectedClients: this.describeConnectedClients(),
                    waitMs: PATH_PRODUCER_GRACE_MS,
                },
                false
            ));
            return;
        }

        this.clearPendingPathRequest(requester);
        const requestedAt = Date.now();
        const timer = setTimeout(() => {
            this.pendingPathRequests.delete(requester);
            this.sendStatus(requester, this.buildStatusPayload(
                'warning',
                'path_request_timeout',
                'Frontend path request timed out.',
                {
                    timeoutMs: PATH_REQUEST_TIMEOUT_MS,
                    requester: requesterMeta?.tag ?? 'unknown',
                    producers: producers.map((client) => this.clientMeta.get(client)?.tag ?? 'unknown'),
                },
                true
            ));
        }, PATH_REQUEST_TIMEOUT_MS);

        this.pendingPathRequests.set(requester, {
            client: requester,
            requestedAt,
            timer,
        });

        this.sendStatus(requester, this.buildStatusPayload(
            'info',
            'path_request_forwarded',
            'Waiting for frontend path data from frontend producer...',
            {
                requester: requesterMeta?.tag ?? 'unknown',
                producers: producers.map((client) => this.clientMeta.get(client)?.tag ?? 'unknown'),
            },
            false
        ));

        const payload = {
            requestedBy: requesterMeta?.tag ?? 'unknown',
            requestedAt,
        };
        producers.forEach((producer) => this.sendMessage(producer, 'requestPath', payload));
    }

    private attachBridgeValidation(
        payload: Record<string, unknown>,
        validation: PathValidationResult,
        senderMeta: ClientMeta | undefined
    ): Record<string, unknown> {
        const existingTransport = isRecord(payload._bridgeTransport) ? payload._bridgeTransport : {};
        return {
            ...payload,
            _bridgeTransport: {
                ...existingTransport,
                summary: validation.transport.summary,
                fingerprint: validation.transport.fingerprint,
            },
            _bridgeValidation: {
                verified: true,
                verifiedAt: new Date().toISOString(),
                sourceClient: senderMeta?.tag ?? 'unknown',
                warnings: validation.warnings,
                summary: validation.transport.summary,
                fingerprint: validation.transport.fingerprint,
            },
        };
    }

    private handlePathResult(payload: unknown, sender: WebSocket): void {
        const senderMeta = this.clientMeta.get(sender);
        if (!senderMeta || !this.isPathProducerTag(senderMeta.tag)) {
            const status = this.buildStatusPayload(
                'error',
                'path_result_rejected',
                'Only frontend path producers may publish pathResult payloads.',
                {
                    sender: senderMeta?.tag ?? 'unknown',
                },
                true
            );
            this.sendStatus(sender, status);
            this.notifyPendingPathRequests(status);
            return;
        }

        const validation = validateBridgePathPayload(payload);
        if (!validation.ok || !isRecord(payload)) {
            console.warn(
                `[PathBridge] Rejected invalid pathResult from ${senderMeta.tag}: ${validation.errors.join(' | ')}`
            );
            const status = this.buildStatusPayload(
                'error',
                'path_validation_failed',
                'Frontend returned invalid path data; see backend log for validation issues.',
                {
                    sender: senderMeta.tag,
                    errors: validation.errors,
                    warnings: validation.warnings,
                },
                true
            );
            this.sendStatus(sender, status);
            if (this.pendingPathRequests.size > 0) {
                this.notifyPendingPathRequests(status);
            } else {
                this.broadcast('pathStatus', status);
            }
            return;
        }

        const forwardedPayload = this.attachBridgeValidation(payload, validation, senderMeta);
        this.currentPath = forwardedPayload;
        console.log(
            `[PathBridge] Verified pathResult from ${senderMeta.tag}. ` +
            `fingerprint=${validation.transport.fingerprint} nodes=${validation.transport.summary.pathNodeCount}`
        );

        if (validation.warnings.length > 0) {
            const warningStatus = this.buildStatusPayload(
                'warning',
                'path_validation_warning',
                'Frontend path payload was accepted with warnings.',
                {
                    sender: senderMeta.tag,
                    warnings: validation.warnings,
                    fingerprint: validation.transport.fingerprint,
                },
                false
            );
            if (this.pendingPathRequests.size > 0) {
                this.notifyPendingPathRequests(warningStatus);
            }
        }

        this.clearAllPendingPathRequests();
        this.broadcast('pathResult', forwardedPayload);
    }

    private handleMermaidRenderResult(payloadLike: unknown, sender: WebSocket): void {
        const senderMeta = this.clientMeta.get(sender);
        if (!senderMeta || !senderMeta.authorized || !this.isPathProducerTag(senderMeta.tag) || !isRecord(payloadLike)) {
            console.warn('[PathBridge] Ignored invalid Mermaid render result payload.');
            return;
        }

        const requestId = typeof payloadLike.requestId === 'string' ? payloadLike.requestId.trim() : '';
        if (!requestId) {
            return;
        }

        const pendingRequest = this.pendingMermaidRenderRequests.get(requestId);
        if (!pendingRequest) {
            return;
        }

        console.log(`[PathBridge] Received Mermaid render result from ${senderMeta.tag} for ${requestId}`);
        clearTimeout(pendingRequest.timer);
        this.pendingMermaidRenderRequests.delete(requestId);

        const pngBase64 = typeof payloadLike.pngBase64 === 'string' ? payloadLike.pngBase64.trim() : '';
        const ok = payloadLike.ok === true && pngBase64.length > 0;
        if (!ok) {
            const errorMessage = typeof payloadLike.error === 'string' && payloadLike.error.trim().length > 0
                ? payloadLike.error.trim()
                : 'Frontend Mermaid render failed.';
            pendingRequest.reject(new Error(errorMessage));
            return;
        }
        const stages = Array.isArray(payloadLike.stages)
            ? (payloadLike.stages
                .filter((stagePayload): stagePayload is Record<string, unknown> => isRecord(stagePayload))
                .map((stagePayload): MermaidRenderStagePayload | null => {
                    const stageName = typeof stagePayload.stage === 'string' ? stagePayload.stage.trim() : '';
                    const stageSvg = typeof stagePayload.svg === 'string' ? stagePayload.svg : '';
                    if (!stageName || !stageSvg) {
                        return null;
                    }
                    return {
                        stage: stageName,
                        svg: stageSvg,
                        width: toInteger(stagePayload.width),
                        height: toInteger(stagePayload.height),
                    };
                })
                .filter((stage) => stage !== null) as MermaidRenderStagePayload[])
            : undefined;

        pendingRequest.resolve({
            requestId,
            ok: true,
            pngBase64,
            svg: typeof payloadLike.svg === 'string' ? payloadLike.svg : undefined,
            width: toInteger(payloadLike.width),
            height: toInteger(payloadLike.height),
            renderer: typeof payloadLike.renderer === 'string' ? payloadLike.renderer : undefined,
            stages: stages && stages.length > 0 ? stages : undefined,
        });
    }

    private handlePathStatus(payload: unknown, sender: WebSocket): void {
        const senderMeta = this.clientMeta.get(sender);
        if (!senderMeta || !this.isPathProducerTag(senderMeta.tag)) {
            return;
        }

        const record = isRecord(payload) ? payload : {};
        const status = this.buildStatusPayload(
            record.level === 'success' || record.level === 'warning' || record.level === 'error'
                ? record.level
                : 'info',
            typeof record.code === 'string' && record.code.trim().length > 0
                ? record.code.trim()
                : 'path_status',
            typeof record.message === 'string' && record.message.trim().length > 0
                ? record.message.trim()
                : 'Path status update received from frontend.',
            isRecord(record.details) ? record.details : {},
            record.terminal === true
        );

        console.log(`[PathBridge] Frontend status ${status.level}/${status.code}: ${status.message}`);
        if (this.pendingPathRequests.size > 0) {
            this.notifyPendingPathRequests(status);
            return;
        }
        this.broadcast('pathStatus', status);
    }

    private handleMessage(data: any, sender: WebSocket): void {
        console.log(`[PathBridge] Received: ${data.type}`);

        switch (data.type) {
            case 'authenticate':
                break;

            case 'identify': {
                const requestedTag =
                    data?.payload?.client ??
                    data?.payload?.tag ??
                    data?.client ??
                    'unknown';
                this.setClientTag(sender, requestedTag);
                break;
            }

            case 'requestPath':
                this.handlePathRequest(sender);
                break;

            case 'pathResult':
                this.handlePathResult(data.payload, sender);
                break;

            case 'pathStatus':
                this.handlePathStatus(data.payload, sender);
                break;

            case 'renderMermaidResult':
                this.handleMermaidRenderResult(data.payload, sender);
                break;

            case 'nodeClick':
                this.invalidateCurrentPath('nodeClick');
                console.log(`[PathBridge] Godot clicked node: ${data.payload?.nodeId}`);
                this.broadcast('nodeClick', data.payload);
                break;

            case 'markComplete':
                this.invalidateCurrentPath('markComplete');
                console.log(`[PathBridge] Node marked complete: ${data.payload?.nodeId}`);
                this.broadcast('markComplete', data.payload);
                break;

            case 'switchCenter':
                this.invalidateCurrentPath('switchCenter');
                console.log(`[PathBridge] Switch center to: ${data.payload?.newCenterId}`);
                this.broadcast('switchCenter', data.payload);
                break;

            case 'openReader': {
                const nodeId = data.payload?.nodeId || data.payload;
                console.log(`[PathBridge] Open reader for: ${nodeId}`);
                this.broadcast('openReader', data.payload);
                break;
            }

            case 'unmarkComplete':
                this.invalidateCurrentPath('unmarkComplete');
                console.log(`[PathBridge] Node unmarked: ${data.payload?.nodeId}`);
                this.broadcast('unmarkComplete', data.payload);
                break;

            case 'completionSync':
                this.invalidateCurrentPath('completionSync');
                console.log(`[PathBridge] Completion sync, ${data.payload?.completedIds?.length || 0} nodes`);
                this.broadcast('completionSync', data.payload);
                break;

            case 'toggleCollapse':
                this.invalidateCurrentPath('toggleCollapse');
                console.log(`[PathBridge] Toggle collapse: ${data.payload?.nodeId}`);
                this.broadcast('toggleCollapse', data.payload);
                break;

            case 'expandPrereqs':
                this.invalidateCurrentPath('expandPrereqs');
                console.log(`[PathBridge] Expand prereqs: ${data.payload?.nodeId}`);
                this.broadcast('expandPrereqs', data.payload);
                break;

            case 'collapsePrereqs':
                this.invalidateCurrentPath('collapsePrereqs');
                console.log(`[PathBridge] Collapse prereqs: ${data.payload?.nodeId}`);
                this.broadcast('collapsePrereqs', data.payload);
                break;

            case 'collapseAll':
                this.invalidateCurrentPath('collapseAll');
                console.log('[PathBridge] Collapse ALL requested');
                this.broadcast('collapseAll', data.payload);
                break;

            case 'configure':
                this.invalidateCurrentPath('configure');
                console.log('[PathBridge] Configuration update');
                this.broadcast('configure', data.payload);
                break;

            case 'exitPathMode':
                console.log('[PathBridge] Exit Path Mode requested');
                this.broadcast('exitPathMode', data.payload || {});
                break;

            default:
                if (PATH_MUTATION_TYPES.has(String(data.type || ''))) {
                    this.invalidateCurrentPath(String(data.type || 'unknown'));
                }
                console.log(`[PathBridge] Unknown message type: ${data.type}`);
        }
    }

    public broadcast(type: string, payload: unknown): void {
        this.broadcastTo(() => true, type, payload);
    }

    public requestFrontendMermaidRender(payload: Omit<MermaidRenderRequestPayload, 'requestId'>): Promise<MermaidRenderResultPayload> {
        const frontendClient = this.getPreferredFrontendClient();
        if (!frontendClient) {
            return Promise.reject(new Error('No frontend Mermaid renderer is connected.'));
        }

        const requestId = `mermaid-${Date.now()}-${this.nextMermaidRenderRequestId++}`;
        const requestPayload: MermaidRenderRequestPayload = {
            requestId,
            source: payload.source,
            maxWidth: payload.maxWidth,
            maxHeight: payload.maxHeight,
            renderScale: payload.renderScale,
            theme: payload.theme || 'dark',
            includeStages: payload.includeStages === true,
        };

        return new Promise<MermaidRenderResultPayload>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingMermaidRenderRequests.delete(requestId);
                reject(new Error('Timed out waiting for frontend Mermaid render.'));
            }, MERMAID_RENDER_TIMEOUT_MS);

            this.pendingMermaidRenderRequests.set(requestId, { resolve, reject, timer });
            const frontendMeta = this.clientMeta.get(frontendClient);
            console.log(`[PathBridge] Requesting Mermaid render ${requestId} from ${frontendMeta?.tag ?? 'frontend'}`);
            this.sendMessage(frontendClient, 'renderMermaidRequest', requestPayload);
        });
    }

    public setCurrentPath(pathData: unknown): void {
        const validation = validateBridgePathPayload(pathData);
        if (!validation.ok || !isRecord(pathData)) {
            console.warn('[PathBridge] Ignored invalid setCurrentPath payload:', validation.errors);
            return;
        }

        this.currentPath = this.attachBridgeValidation(pathData, validation, undefined);
        this.broadcast('pathResult', this.currentPath);
    }

    public close(): void {
        this.clearAllPendingPathRequests();
        this.wss.close();
        this.clients.clear();
        this.clientMeta.clear();
    }
}



