import { WebSocketServer, WebSocket, RawData } from 'ws';

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
    includeSvg?: boolean;
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

type BridgeInboundEnvelope = {
    type: string;
    payload?: unknown;
    token?: unknown;
    client?: unknown;
};

type BridgeInboundEnvelopeValidationResult = {
    ok: boolean;
    envelope?: BridgeInboundEnvelope;
    reason?: string;
};

type OutboundQueueMessage = {
    type: string;
    serialized: string;
    enqueuedAt: number;
};

type ClientOutboundQueueState = {
    queue: OutboundQueueMessage[];
    flushTimer: NodeJS.Timeout | null;
    droppedCount: number;
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
const UNAUTHORIZED_CLIENT_TIMEOUT_MS = 5000;
const BYTES_PER_MIB = 1024 * 1024;
const DEFAULT_INBOUND_MESSAGE_LIMIT_MIB = 128;
const LARGE_GRAPH_INBOUND_MESSAGE_LIMIT_MIB = 256;
const EXTREME_GRAPH_INBOUND_MESSAGE_LIMIT_MIB = 512;
const MIN_INBOUND_MESSAGE_LIMIT_MIB = 8;
const MAX_INBOUND_MESSAGE_LIMIT_MIB = 1024;
const LARGE_GRAPH_NODE_THRESHOLD = 10000;
const EXTREME_GRAPH_NODE_THRESHOLD = 20000;
const LARGE_GRAPH_EDGE_THRESHOLD = 1000000;
const EXTREME_GRAPH_EDGE_THRESHOLD = 2000000;

type BridgeInboundLimitConfig = {
    selectedMessageMb: number;
    selectedMessageBytes: number;
    recommendedMessageMb: number;
    source: 'default' | 'configured' | 'configured-strict' | 'auto-raised';
    strictMode: boolean;
    workloadHint: {
        expectedNodeCount: number;
        expectedEdgeCount: number;
        scale: 'default' | 'large' | 'xlarge' | 'huge';
    };
};

type BridgeInboundSchemaPolicy = {
    rejectUnknownTypes: boolean;
    strictConfigureSchema: boolean;
};

function parsePositiveInteger(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 0;
    }
    return Math.floor(numeric);
}

function normalizeGraphScale(rawValue: unknown): 'default' | 'large' | 'xlarge' | 'huge' {
    const normalized = String(rawValue ?? '').trim().toLowerCase();
    if (normalized === 'large' || normalized === 'l') {
        return 'large';
    }
    if (normalized === 'xlarge' || normalized === 'xl') {
        return 'xlarge';
    }
    if (normalized === 'huge' || normalized === 'xxl' || normalized === 'extreme') {
        return 'huge';
    }
    return 'default';
}

function parseBooleanFlag(rawValue: unknown): boolean {
    const normalized = String(rawValue ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function resolveBridgeInboundSchemaPolicy(
    env: NodeJS.ProcessEnv = process.env
): BridgeInboundSchemaPolicy {
    return {
        rejectUnknownTypes: parseBooleanFlag(env.NOTE_CONNECTION_BRIDGE_REJECT_UNKNOWN_TYPES),
        strictConfigureSchema: parseBooleanFlag(env.NOTE_CONNECTION_BRIDGE_STRICT_CONFIG_SCHEMA),
    };
}

function clampInboundLimitMb(value: number): number {
    return Math.min(
        MAX_INBOUND_MESSAGE_LIMIT_MIB,
        Math.max(MIN_INBOUND_MESSAGE_LIMIT_MIB, Math.floor(value))
    );
}

function resolveRecommendedInboundMessageLimitMb(workloadHint: BridgeInboundLimitConfig['workloadHint']): number {
    let recommendedMb = DEFAULT_INBOUND_MESSAGE_LIMIT_MIB;

    if (workloadHint.scale === 'large' || workloadHint.scale === 'xlarge') {
        recommendedMb = Math.max(recommendedMb, LARGE_GRAPH_INBOUND_MESSAGE_LIMIT_MIB);
    } else if (workloadHint.scale === 'huge') {
        recommendedMb = Math.max(recommendedMb, EXTREME_GRAPH_INBOUND_MESSAGE_LIMIT_MIB);
    }

    if (
        workloadHint.expectedNodeCount >= LARGE_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= LARGE_GRAPH_EDGE_THRESHOLD
    ) {
        recommendedMb = Math.max(recommendedMb, LARGE_GRAPH_INBOUND_MESSAGE_LIMIT_MIB);
    }

    if (
        workloadHint.expectedNodeCount >= EXTREME_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= EXTREME_GRAPH_EDGE_THRESHOLD
    ) {
        recommendedMb = Math.max(recommendedMb, EXTREME_GRAPH_INBOUND_MESSAGE_LIMIT_MIB);
    }

    return clampInboundLimitMb(recommendedMb);
}

export function resolveBridgeInboundLimitConfig(env: NodeJS.ProcessEnv = process.env): BridgeInboundLimitConfig {
    const workloadHint = {
        expectedNodeCount: parsePositiveInteger(env.NOTE_CONNECTION_EXPECTED_NODE_COUNT),
        expectedEdgeCount: parsePositiveInteger(env.NOTE_CONNECTION_EXPECTED_EDGE_COUNT),
        scale: normalizeGraphScale(env.NOTE_CONNECTION_GRAPH_SCALE),
    };
    const recommendedMessageMb = resolveRecommendedInboundMessageLimitMb(workloadHint);
    const configuredLimitMb = parsePositiveInteger(env.NOTE_CONNECTION_BRIDGE_MAX_INBOUND_MB);
    const strictMode = parseBooleanFlag(env.NOTE_CONNECTION_BRIDGE_STRICT_INBOUND_LIMIT);

    if (configuredLimitMb <= 0) {
        return {
            selectedMessageMb: recommendedMessageMb,
            selectedMessageBytes: recommendedMessageMb * BYTES_PER_MIB,
            recommendedMessageMb,
            source: 'default',
            strictMode,
            workloadHint,
        };
    }

    const boundedConfiguredLimitMb = clampInboundLimitMb(configuredLimitMb);
    if (strictMode) {
        return {
            selectedMessageMb: boundedConfiguredLimitMb,
            selectedMessageBytes: boundedConfiguredLimitMb * BYTES_PER_MIB,
            recommendedMessageMb,
            source: 'configured-strict',
            strictMode,
            workloadHint,
        };
    }

    const selectedMessageMb = Math.max(boundedConfiguredLimitMb, recommendedMessageMb);
    return {
        selectedMessageMb,
        selectedMessageBytes: selectedMessageMb * BYTES_PER_MIB,
        recommendedMessageMb,
        source: selectedMessageMb > boundedConfiguredLimitMb ? 'auto-raised' : 'configured',
        strictMode,
        workloadHint,
    };
}

const BRIDGE_INBOUND_LIMIT_CONFIG = resolveBridgeInboundLimitConfig(process.env);
const BRIDGE_INBOUND_SCHEMA_POLICY = resolveBridgeInboundSchemaPolicy(process.env);
const MAX_INBOUND_MESSAGE_BYTES = BRIDGE_INBOUND_LIMIT_CONFIG.selectedMessageBytes;
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

const KNOWN_BRIDGE_MESSAGE_TYPES = new Set([
    'authenticate',
    'identify',
    'requestPath',
    'pathResult',
    'pathStatus',
    'renderMermaidResult',
    'nodeClick',
    'markComplete',
    'switchCenter',
    'openReader',
    'unmarkComplete',
    'completionSync',
    'toggleCollapse',
    'expandPrereqs',
    'collapsePrereqs',
    'collapseAll',
    'configure',
    'exitPathMode',
    'setWindowVisible',
    'openNotemd',
    'open_notemd',
    'requestAppShutdown',
    'request_app_shutdown',
]);

const BRIDGE_OUTBOUND_MAX_QUEUE_MESSAGES = 256;
const BRIDGE_OUTBOUND_MAX_BUFFERED_BYTES = 2 * 1024 * 1024;
const BRIDGE_OUTBOUND_FLUSH_INTERVAL_MS = 25;

export const BRIDGE_BACKPRESSURE_LIMITS = {
    maxQueueMessages: BRIDGE_OUTBOUND_MAX_QUEUE_MESSAGES,
    maxBufferedAmountBytes: BRIDGE_OUTBOUND_MAX_BUFFERED_BYTES,
    flushIntervalMs: BRIDGE_OUTBOUND_FLUSH_INTERVAL_MS,
};

export const BRIDGE_INBOUND_LIMITS = {
    defaultMessageBytes: DEFAULT_INBOUND_MESSAGE_LIMIT_MIB * BYTES_PER_MIB,
    recommendedMessageBytes: BRIDGE_INBOUND_LIMIT_CONFIG.recommendedMessageMb * BYTES_PER_MIB,
    minMessageBytes: MIN_INBOUND_MESSAGE_LIMIT_MIB * BYTES_PER_MIB,
    maxMessageBytes: MAX_INBOUND_MESSAGE_BYTES,
    hardCapBytes: MAX_INBOUND_MESSAGE_LIMIT_MIB * BYTES_PER_MIB,
    selectedBy: BRIDGE_INBOUND_LIMIT_CONFIG.source,
    strictMode: BRIDGE_INBOUND_LIMIT_CONFIG.strictMode,
};
export const BRIDGE_INBOUND_SCHEMA_LIMITS = {
    rejectUnknownTypes: BRIDGE_INBOUND_SCHEMA_POLICY.rejectUnknownTypes,
    strictConfigureSchema: BRIDGE_INBOUND_SCHEMA_POLICY.strictConfigureSchema,
};

const MAX_BRIDGE_MESSAGE_TYPE_LENGTH = 64;
const ALLOWED_CONFIG_MODE_VALUES = new Set(['domain', 'diffusion']);
const ALLOWED_CONFIG_STRATEGY_VALUES = new Set(['foundational', 'core']);
const ALLOWED_CONFIG_LAYOUT_VALUES = new Set(['vertical', 'horizontal', 'radial', 'orbital']);
const ALLOWED_READING_MODE_VALUES = new Set(['window', 'fullscreen']);
const ALLOWED_READER_RENDER_MODE_VALUES = new Set(['render', 'source']);
const ALLOWED_BACKGROUND_FILE_EXTENSIONS = ['.exr', '.hdr'];
const CONFIG_TARGET_ID_MAX_LENGTH = 512;
const CONFIG_SHORTCUT_MAX_LENGTH = 64;
const CONFIG_BACKGROUND_MAX_LENGTH = 128;
const CONFIG_BRIGHTNESS_MIN = 0.01;
const CONFIG_BRIGHTNESS_MAX = 10.0;
const CONFIG_READER_MEDIA_SCALE_MIN = 0.1;
const CONFIG_READER_MEDIA_SCALE_MAX = 3.0;
const CONFIG_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const CONFIG_SHORTCUT_PATTERN = /^[A-Za-z0-9+\- _]+$/;
const CONFIG_BACKGROUND_BASENAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const ALLOWED_CONFIG_KEYS = new Set([
    'mode',
    'strategy',
    'layout',
    'targetId',
    'target_id',
    'targetIds',
    'auto_reconstruct',
    'retain_history',
    'focus_mode',
    'background',
    'bg_brightness',
    'reading_mode',
    'reader_render_mode',
    'reader_toggle_source_shortcut',
    'reader_media_scale',
    'reader_debug',
    'node_spacing',
]);

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumberValue(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isValidBridgeStatusLevel(value: unknown): boolean {
    return value === 'info' || value === 'success' || value === 'warning' || value === 'error';
}

function isSafeConfigBackgroundValue(rawValue: string): boolean {
    const value = rawValue.trim();
    if (value.length === 0) {
        return true;
    }
    if (value.length > CONFIG_BACKGROUND_MAX_LENGTH) {
        return false;
    }
    if (value.includes('/') || value.includes('\\') || value.includes('..')) {
        return false;
    }
    if (!CONFIG_BACKGROUND_BASENAME_PATTERN.test(value)) {
        return false;
    }

    const normalizedValue = value.toLowerCase();
    return ALLOWED_BACKGROUND_FILE_EXTENSIONS.some((extension) => normalizedValue.endsWith(extension));
}

function validateRequestPathPayload(payload: Record<string, unknown>): string | null {
    if (payload.requestedBy !== undefined && !isNonEmptyString(payload.requestedBy)) {
        return 'requestPath payload.requestedBy must be a non-empty string when provided.';
    }
    if (payload.requestedAt !== undefined && !isFiniteNumberValue(payload.requestedAt)) {
        return 'requestPath payload.requestedAt must be a finite number when provided.';
    }
    return null;
}

function validatePathStatusPayload(payload: Record<string, unknown>): string | null {
    if (payload.level !== undefined && !isValidBridgeStatusLevel(payload.level)) {
        return 'pathStatus payload.level must be one of info/success/warning/error when provided.';
    }
    if (payload.code !== undefined && !isNonEmptyString(payload.code)) {
        return 'pathStatus payload.code must be a non-empty string when provided.';
    }
    if (payload.message !== undefined && !isNonEmptyString(payload.message)) {
        return 'pathStatus payload.message must be a non-empty string when provided.';
    }
    if (payload.terminal !== undefined && typeof payload.terminal !== 'boolean') {
        return 'pathStatus payload.terminal must be a boolean when provided.';
    }
    if (payload.timestamp !== undefined && !isFiniteNumberValue(payload.timestamp)) {
        return 'pathStatus payload.timestamp must be a finite number when provided.';
    }
    if (payload.details !== undefined && !isRecord(payload.details)) {
        return 'pathStatus payload.details must be an object when provided.';
    }
    return null;
}

function validateMermaidRenderStages(stagesLike: unknown): string | null {
    if (!Array.isArray(stagesLike)) {
        return 'renderMermaidResult payload.stages must be an array when provided.';
    }

    for (let index = 0; index < stagesLike.length; index += 1) {
        const stage = stagesLike[index];
        if (!isRecord(stage)) {
            return `renderMermaidResult payload.stages[${index}] must be an object.`;
        }
        if (!isNonEmptyString(stage.stage)) {
            return `renderMermaidResult payload.stages[${index}].stage must be a non-empty string.`;
        }
        if (!isNonEmptyString(stage.svg)) {
            return `renderMermaidResult payload.stages[${index}].svg must be a non-empty string.`;
        }
        if (stage.width !== undefined && !isFiniteNumberValue(stage.width)) {
            return `renderMermaidResult payload.stages[${index}].width must be a finite number when provided.`;
        }
        if (stage.height !== undefined && !isFiniteNumberValue(stage.height)) {
            return `renderMermaidResult payload.stages[${index}].height must be a finite number when provided.`;
        }
    }

    return null;
}

function validateMermaidRenderResultPayload(payload: Record<string, unknown>): string | null {
    if (!isNonEmptyString(payload.requestId)) {
        return 'renderMermaidResult payload.requestId must be a non-empty string.';
    }
    if (typeof payload.ok !== 'boolean') {
        return 'renderMermaidResult payload.ok must be a boolean.';
    }
    if (payload.ok === true && !isNonEmptyString(payload.pngBase64)) {
        return 'renderMermaidResult payload.pngBase64 must be a non-empty string when ok=true.';
    }
    if (payload.error !== undefined && typeof payload.error !== 'string') {
        return 'renderMermaidResult payload.error must be a string when provided.';
    }
    if (payload.svg !== undefined && typeof payload.svg !== 'string') {
        return 'renderMermaidResult payload.svg must be a string when provided.';
    }
    if (payload.renderer !== undefined && typeof payload.renderer !== 'string') {
        return 'renderMermaidResult payload.renderer must be a string when provided.';
    }
    if (payload.width !== undefined && !isFiniteNumberValue(payload.width)) {
        return 'renderMermaidResult payload.width must be a finite number when provided.';
    }
    if (payload.height !== undefined && !isFiniteNumberValue(payload.height)) {
        return 'renderMermaidResult payload.height must be a finite number when provided.';
    }
    if (payload.stages !== undefined) {
        return validateMermaidRenderStages(payload.stages);
    }
    return null;
}

function validateConfigurePayload(
    payload: Record<string, unknown>,
    policy: BridgeInboundSchemaPolicy
): string | null {
    if (payload.mode !== undefined) {
        if (!isNonEmptyString(payload.mode)) {
            return 'configure payload.mode must be a non-empty string when provided.';
        }
        if (!ALLOWED_CONFIG_MODE_VALUES.has(payload.mode)) {
            return `configure payload.mode must be one of: ${Array.from(ALLOWED_CONFIG_MODE_VALUES).join(', ')}.`;
        }
    }
    if (payload.strategy !== undefined) {
        if (!isNonEmptyString(payload.strategy)) {
            return 'configure payload.strategy must be a non-empty string when provided.';
        }
        if (!ALLOWED_CONFIG_STRATEGY_VALUES.has(payload.strategy)) {
            return `configure payload.strategy must be one of: ${Array.from(ALLOWED_CONFIG_STRATEGY_VALUES).join(', ')}.`;
        }
    }
    if (payload.layout !== undefined) {
        if (!isNonEmptyString(payload.layout)) {
            return 'configure payload.layout must be a non-empty string when provided.';
        }
        if (!ALLOWED_CONFIG_LAYOUT_VALUES.has(payload.layout)) {
            return `configure payload.layout must be one of: ${Array.from(ALLOWED_CONFIG_LAYOUT_VALUES).join(', ')}.`;
        }
    }
    if (payload.targetId !== undefined && typeof payload.targetId !== 'string') {
        return 'configure payload.targetId must be a string when provided.';
    }
    if (payload.target_id !== undefined && typeof payload.target_id !== 'string') {
        return 'configure payload.target_id must be a string when provided.';
    }
    const normalizedTargetId = typeof payload.targetId === 'string' ? payload.targetId.trim() : '';
    const normalizedLegacyTargetId = typeof payload.target_id === 'string' ? payload.target_id.trim() : '';
    if (normalizedTargetId.length > CONFIG_TARGET_ID_MAX_LENGTH) {
        return `configure payload.targetId must be at most ${CONFIG_TARGET_ID_MAX_LENGTH} characters.`;
    }
    if (normalizedLegacyTargetId.length > CONFIG_TARGET_ID_MAX_LENGTH) {
        return `configure payload.target_id must be at most ${CONFIG_TARGET_ID_MAX_LENGTH} characters.`;
    }
    if (normalizedTargetId && CONFIG_CONTROL_CHARACTER_PATTERN.test(normalizedTargetId)) {
        return 'configure payload.targetId must not contain control characters.';
    }
    if (normalizedLegacyTargetId && CONFIG_CONTROL_CHARACTER_PATTERN.test(normalizedLegacyTargetId)) {
        return 'configure payload.target_id must not contain control characters.';
    }
    if (
        normalizedTargetId.length > 0 &&
        normalizedLegacyTargetId.length > 0 &&
        normalizedTargetId !== normalizedLegacyTargetId
    ) {
        return 'configure payload.targetId and payload.target_id must match when both are provided.';
    }
    if (payload.targetIds !== undefined) {
        if (!Array.isArray(payload.targetIds)) {
            return 'configure payload.targetIds must be an array when provided.';
        }
        if (payload.targetIds.some(id => typeof id !== 'string')) {
            return 'configure payload.targetIds must be an array of strings.';
        }
    }
    if (payload.auto_reconstruct !== undefined && typeof payload.auto_reconstruct !== 'boolean') {
        return 'configure payload.auto_reconstruct must be a boolean when provided.';
    }
    if (payload.retain_history !== undefined && typeof payload.retain_history !== 'boolean') {
        return 'configure payload.retain_history must be a boolean when provided.';
    }
    if (payload.focus_mode !== undefined && typeof payload.focus_mode !== 'boolean') {
        return 'configure payload.focus_mode must be a boolean when provided.';
    }
    if (payload.background !== undefined) {
        if (typeof payload.background !== 'string') {
            return 'configure payload.background must be a string when provided.';
        }
        if (!isSafeConfigBackgroundValue(payload.background)) {
            return 'configure payload.background must be empty or a safe .exr/.hdr filename.';
        }
    }
    if (payload.bg_brightness !== undefined) {
        if (!isFiniteNumberValue(payload.bg_brightness)) {
            return 'configure payload.bg_brightness must be a finite number when provided.';
        }
        if (payload.bg_brightness < CONFIG_BRIGHTNESS_MIN || payload.bg_brightness > CONFIG_BRIGHTNESS_MAX) {
            return `configure payload.bg_brightness must be within [${CONFIG_BRIGHTNESS_MIN}, ${CONFIG_BRIGHTNESS_MAX}].`;
        }
    }
    if (payload.reading_mode !== undefined) {
        if (!isNonEmptyString(payload.reading_mode)) {
            return 'configure payload.reading_mode must be a non-empty string when provided.';
        }
        if (!ALLOWED_READING_MODE_VALUES.has(payload.reading_mode)) {
            return `configure payload.reading_mode must be one of: ${Array.from(ALLOWED_READING_MODE_VALUES).join(', ')}.`;
        }
    }
    if (payload.reader_render_mode !== undefined) {
        if (!isNonEmptyString(payload.reader_render_mode)) {
            return 'configure payload.reader_render_mode must be a non-empty string when provided.';
        }
        if (!ALLOWED_READER_RENDER_MODE_VALUES.has(payload.reader_render_mode)) {
            return `configure payload.reader_render_mode must be one of: ${Array.from(ALLOWED_READER_RENDER_MODE_VALUES).join(', ')}.`;
        }
    }
    if (
        payload.reader_toggle_source_shortcut !== undefined &&
        !isNonEmptyString(payload.reader_toggle_source_shortcut)
    ) {
        return 'configure payload.reader_toggle_source_shortcut must be a non-empty string when provided.';
    }
    if (payload.reader_toggle_source_shortcut !== undefined) {
        const shortcut = payload.reader_toggle_source_shortcut.trim();
        if (shortcut.length > CONFIG_SHORTCUT_MAX_LENGTH) {
            return `configure payload.reader_toggle_source_shortcut must be at most ${CONFIG_SHORTCUT_MAX_LENGTH} characters.`;
        }
        if (CONFIG_CONTROL_CHARACTER_PATTERN.test(shortcut)) {
            return 'configure payload.reader_toggle_source_shortcut must not contain control characters.';
        }
        if (!CONFIG_SHORTCUT_PATTERN.test(shortcut)) {
            return 'configure payload.reader_toggle_source_shortcut contains unsupported characters.';
        }
    }
    if (payload.reader_media_scale !== undefined) {
        if (!isFiniteNumberValue(payload.reader_media_scale)) {
            return 'configure payload.reader_media_scale must be a finite number when provided.';
        }
        if (
            payload.reader_media_scale < CONFIG_READER_MEDIA_SCALE_MIN ||
            payload.reader_media_scale > CONFIG_READER_MEDIA_SCALE_MAX
        ) {
            return `configure payload.reader_media_scale must be within [${CONFIG_READER_MEDIA_SCALE_MIN}, ${CONFIG_READER_MEDIA_SCALE_MAX}].`;
        }
    }
    if (payload.reader_debug !== undefined && typeof payload.reader_debug !== 'boolean') {
        return 'configure payload.reader_debug must be a boolean when provided.';
    }
    if (payload.node_spacing !== undefined && !isFiniteNumberValue(payload.node_spacing)) {
        return 'configure payload.node_spacing must be a finite number when provided.';
    }

    if (policy.strictConfigureSchema) {
        const unknownKeys = Object.keys(payload).filter((key) => !ALLOWED_CONFIG_KEYS.has(key));
        if (unknownKeys.length > 0) {
            return `configure payload includes unsupported keys in strict mode: ${unknownKeys.join(', ')}.`;
        }
    }

    return null;
}

function validateKnownEnvelopePayload(
    type: string,
    payload: unknown,
    policy: BridgeInboundSchemaPolicy
): string | null {
    switch (type) {
        case 'authenticate':
        case 'identify':
            if (payload !== undefined && !isRecord(payload)) {
                return `${type} payload must be an object when provided.`;
            }
            if (isRecord(payload)) {
                const token = payload.token;
                const client = payload.client ?? payload.tag;
                if (token !== undefined && typeof token !== 'string') {
                    return `${type} token must be a string when provided.`;
                }
                if (client !== undefined && typeof client !== 'string') {
                    return `${type} client/tag must be a string when provided.`;
                }
            }
            return null;

        case 'requestPath':
            if (payload !== undefined && !isRecord(payload)) {
                return 'requestPath payload must be an object when provided.';
            }
            if (isRecord(payload)) {
                return validateRequestPathPayload(payload);
            }
            return null;

        case 'pathResult':
            if (!isRecord(payload)) {
                return 'pathResult payload must be an object.';
            }
            return null;

        case 'renderMermaidResult':
            if (!isRecord(payload)) {
                return 'renderMermaidResult payload must be an object.';
            }
            return validateMermaidRenderResultPayload(payload);

        case 'pathStatus':
            if (!isRecord(payload)) {
                return 'pathStatus payload must be an object.';
            }
            return validatePathStatusPayload(payload);

        case 'configure':
            if (payload !== undefined && !isRecord(payload)) {
                return 'configure payload must be an object when provided.';
            }
            if (isRecord(payload)) {
                return validateConfigurePayload(payload, policy);
            }
            return null;

        case 'openReader':
            if (payload === undefined || typeof payload === 'string') {
                return null;
            }
            if (!isRecord(payload)) {
                return 'openReader payload must be a string or object.';
            }
            if (!isNonEmptyString(payload.nodeId)) {
                return 'openReader payload.nodeId must be a non-empty string.';
            }
            return null;

        case 'switchCenter':
            if (!isRecord(payload)) {
                return 'switchCenter payload must be an object.';
            }
            if (!isNonEmptyString(payload.newCenterId)) {
                return 'switchCenter payload.newCenterId must be a non-empty string.';
            }
            return null;

        case 'completionSync':
            if (!isRecord(payload)) {
                return 'completionSync payload must be an object.';
            }
            if (payload.completedIds !== undefined && !Array.isArray(payload.completedIds)) {
                return 'completionSync payload.completedIds must be an array when provided.';
            }
            if (Array.isArray(payload.completedIds)) {
                const hasInvalidId = payload.completedIds.some((entry) => !isNonEmptyString(entry));
                if (hasInvalidId) {
                    return 'completionSync payload.completedIds must contain only non-empty strings.';
                }
            }
            return null;

        case 'nodeClick':
        case 'markComplete':
        case 'unmarkComplete':
        case 'toggleCollapse':
        case 'expandPrereqs':
        case 'collapsePrereqs':
            if (!isRecord(payload)) {
                return `${type} payload must be an object.`;
            }
            if (!isNonEmptyString(payload.nodeId)) {
                return `${type} payload.nodeId must be a non-empty string.`;
            }
            return null;

        default:
            return null;
    }
}

export function parseBridgeInboundEnvelope(
    data: unknown,
    policy: BridgeInboundSchemaPolicy = BRIDGE_INBOUND_SCHEMA_POLICY
): BridgeInboundEnvelopeValidationResult {
    if (!isRecord(data)) {
        return {
            ok: false,
            reason: 'Bridge message must be a JSON object.',
        };
    }

    const type = typeof data.type === 'string' ? data.type.trim() : '';
    if (!type) {
        return {
            ok: false,
            reason: 'Bridge message requires a non-empty type string.',
        };
    }
    if (type.length > MAX_BRIDGE_MESSAGE_TYPE_LENGTH) {
        return {
            ok: false,
            reason: `Bridge message type exceeds max length (${MAX_BRIDGE_MESSAGE_TYPE_LENGTH}).`,
        };
    }

    const envelope: BridgeInboundEnvelope = {
        type,
        payload: data.payload,
        token: data.token,
        client: data.client,
    };
    if (envelope.token !== undefined && typeof envelope.token !== 'string') {
        return {
            ok: false,
            reason: 'Bridge message token must be a string when provided.',
        };
    }
    if (envelope.client !== undefined && typeof envelope.client !== 'string') {
        return {
            ok: false,
            reason: 'Bridge message client must be a string when provided.',
        };
    }

    const isKnownType = KNOWN_BRIDGE_MESSAGE_TYPES.has(type);
    if (!isKnownType && policy.rejectUnknownTypes) {
        return {
            ok: false,
            reason: `Bridge message type '${type}' is not allowed in strict unknown-type mode.`,
        };
    }

    if (isKnownType) {
        const payloadError = validateKnownEnvelopePayload(type, envelope.payload, policy);
        if (payloadError) {
            return {
                ok: false,
                reason: payloadError,
            };
        }
    }

    return {
        ok: true,
        envelope,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toBuffer(raw: RawData): Buffer {
    if (Buffer.isBuffer(raw)) {
        return raw;
    }

    if (typeof raw === 'string') {
        return Buffer.from(raw, 'utf8');
    }

    if (Array.isArray(raw)) {
        return Buffer.concat(raw.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part)));
    }

    return Buffer.from(raw);
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

    if (summary.totalNodes === 0 && summary.pathNodeCount === 0) {
        // Valid empty graph state (e.g., Domain Learning with no selected targets)
    } else {
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
    private unauthorizedClientTimers: Map<WebSocket, NodeJS.Timeout> = new Map();
    private outboundQueueState: Map<WebSocket, ClientOutboundQueueState> = new Map();
    private nextMermaidRenderRequestId = 1;

    constructor(options: number | PathBridgeOptions = 9876) {
        const resolvedOptions: PathBridgeOptions = typeof options === 'number'
            ? { port: options }
            : (options || {});
        this.port = resolvedOptions.port || 9876;
        this.host = resolvedOptions.host || '127.0.0.1';
        this.authToken = typeof resolvedOptions.authToken === 'string' ? resolvedOptions.authToken.trim() : '';
        this.wss = new WebSocketServer({
            port: this.port,
            host: this.host,
            maxPayload: MAX_INBOUND_MESSAGE_BYTES,
        });

        console.log(`[PathBridge] WebSocket Server started on ws://${this.host}:${this.port}`);
        console.log(
            `[PathBridge] Inbound frame limit ${BRIDGE_INBOUND_LIMIT_CONFIG.selectedMessageMb} MiB ` +
            `(recommended=${BRIDGE_INBOUND_LIMIT_CONFIG.recommendedMessageMb} MiB, ` +
            `source=${BRIDGE_INBOUND_LIMIT_CONFIG.source}, strict=${BRIDGE_INBOUND_LIMIT_CONFIG.strictMode})`
        );

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
            this.outboundQueueState.set(ws, {
                queue: [],
                flushTimer: null,
                droppedCount: 0,
            });
            console.log(
                `[PathBridge] Client connected #${clientId} (${clientTag}) from ${clientAddress}. Total clients: ${this.clients.size}`
            );
            this.scheduleUnauthorizedDisconnect(ws);

            ws.on('message', (message) => {
                try {
                    const decodedMessage = this.decodeIncomingMessage(message);
                    if (!decodedMessage.ok) {
                        console.warn(`[PathBridge] Rejected malformed inbound frame: ${decodedMessage.reason}`);
                        ws.close(4400, 'Bad Request');
                        return;
                    }

                    const envelopeResult = parseBridgeInboundEnvelope(decodedMessage.payload);
                    if (!envelopeResult.ok || !envelopeResult.envelope) {
                        console.warn(
                            `[PathBridge] Rejected malformed bridge envelope: ${envelopeResult.reason ?? 'unknown reason'}`
                        );
                        ws.close(4400, 'Bad Request');
                        return;
                    }

                    const envelope = envelopeResult.envelope;
                    if (!this.authorizeClient(ws, envelope)) {
                        const meta = this.clientMeta.get(ws);
                        console.warn(
                            `[PathBridge] Rejected unauthorized message from #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'})`
                        );
                        ws.close(4401, 'Unauthorized');
                        return;
                    }
                    this.handleMessage(envelope, ws);
                } catch (error) {
                    console.error('[PathBridge] Message error:', error);
                }
            });

            ws.on('close', (code, reasonBuffer) => {
                const meta = this.clientMeta.get(ws);
                const reason = reasonBuffer?.toString() || '';
                const wasProducer = !!meta && this.isPathProducerTag(meta.tag);
                this.clearUnauthorizedDisconnect(ws);
                this.clearPendingPathRequest(ws);
                this.clearOutboundQueueState(ws);
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

    private decodeIncomingMessage(raw: RawData): {
        ok: boolean;
        payload?: unknown;
        reason?: string;
    } {
        const buffer = toBuffer(raw);
        if (buffer.length > MAX_INBOUND_MESSAGE_BYTES) {
            return {
                ok: false,
                reason: `Inbound frame exceeded limit (${buffer.length} bytes > ${MAX_INBOUND_MESSAGE_BYTES} bytes).`,
            };
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(buffer.toString('utf8'));
        } catch (_error) {
            return {
                ok: false,
                reason: 'Inbound frame is not valid JSON.',
            };
        }

        return {
            ok: true,
            payload: parsed,
        };
    }

    private authorizeClient(ws: WebSocket, envelope: BridgeInboundEnvelope): boolean {
        if (!this.authToken) {
            this.clearUnauthorizedDisconnect(ws);
            return true;
        }

        const meta = this.clientMeta.get(ws);
        if (!meta) {
            return false;
        }
        if (meta.authorized) {
            this.clearUnauthorizedDisconnect(ws);
            return true;
        }

        if (envelope.type !== 'identify' && envelope.type !== 'authenticate') {
            return false;
        }

        const payload = isRecord(envelope.payload) ? envelope.payload : {};
        const providedToken = String(payload.token ?? envelope.token ?? '').trim();
        if (!providedToken || providedToken !== this.authToken) {
            return false;
        }

        meta.authorized = true;
        this.clientMeta.set(ws, meta);
        this.clearUnauthorizedDisconnect(ws);
        const requestedTag = payload.client ?? payload.tag ?? envelope.client;
        if (requestedTag) {
            this.setClientTag(ws, String(requestedTag));
        }
        console.log(`[PathBridge] Client #${meta.id} authorized.`);
        return true;
    }

    private scheduleUnauthorizedDisconnect(ws: WebSocket): void {
        if (!this.authToken) {
            return;
        }

        const meta = this.clientMeta.get(ws);
        if (!meta || meta.authorized) {
            return;
        }

        this.clearUnauthorizedDisconnect(ws);
        const timer = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                this.unauthorizedClientTimers.delete(ws);
                return;
            }

            const latestMeta = this.clientMeta.get(ws);
            if (latestMeta?.authorized) {
                this.unauthorizedClientTimers.delete(ws);
                return;
            }

            console.warn(
                `[PathBridge] Closing unauthorized client #${latestMeta?.id ?? '?'} ` +
                `(${latestMeta?.tag ?? 'unknown'}) after auth timeout.`
            );
            try {
                ws.close(4401, 'Unauthorized');
            } finally {
                this.unauthorizedClientTimers.delete(ws);
            }
        }, UNAUTHORIZED_CLIENT_TIMEOUT_MS);

        this.unauthorizedClientTimers.set(ws, timer);
    }

    private clearUnauthorizedDisconnect(ws: WebSocket): void {
        const timer = this.unauthorizedClientTimers.get(ws);
        if (!timer) {
            return;
        }

        clearTimeout(timer);
        this.unauthorizedClientTimers.delete(ws);
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

    private getOpenAuthorizedClients(): WebSocket[] {
        return this.getOpenClients().filter((client) => {
            const meta = this.clientMeta.get(client);
            return !!meta && meta.authorized;
        });
    }

    private getPathProducerClients(): WebSocket[] {
        return this.getOpenAuthorizedClients().filter((client) => {
            const meta = this.clientMeta.get(client);
            return !!meta && this.isPathProducerTag(meta.tag);
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
            return `${meta.tag}#${meta.id}${meta.authorized ? '' : '(unauthorized)'}`;
        });
    }

    private getOutboundQueueState(client: WebSocket): ClientOutboundQueueState {
        const existing = this.outboundQueueState.get(client);
        if (existing) {
            return existing;
        }

        const nextState: ClientOutboundQueueState = {
            queue: [],
            flushTimer: null,
            droppedCount: 0,
        };
        this.outboundQueueState.set(client, nextState);
        return nextState;
    }

    private clearOutboundQueueState(client: WebSocket): void {
        const state = this.outboundQueueState.get(client);
        if (!state) {
            return;
        }

        if (state.flushTimer) {
            clearTimeout(state.flushTimer);
            state.flushTimer = null;
        }
        state.queue.length = 0;
        this.outboundQueueState.delete(client);
    }

    private enqueueOutboundMessage(client: WebSocket, message: OutboundQueueMessage): void {
        const state = this.getOutboundQueueState(client);
        if (state.queue.length >= BRIDGE_OUTBOUND_MAX_QUEUE_MESSAGES) {
            state.queue.shift();
            state.droppedCount += 1;
            const meta = this.clientMeta.get(client);
            console.warn(
                `[PathBridge] Outbound queue overflow for #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}); ` +
                `dropped oldest frame count=${state.droppedCount}`
            );
        }

        state.queue.push(message);
        this.flushOutboundQueue(client);
    }

    private flushOutboundQueue(client: WebSocket): void {
        const state = this.outboundQueueState.get(client);
        if (!state) {
            return;
        }

        if (state.flushTimer) {
            clearTimeout(state.flushTimer);
            state.flushTimer = null;
        }

        if (client.readyState !== WebSocket.OPEN) {
            this.clearOutboundQueueState(client);
            return;
        }

        while (state.queue.length > 0) {
            if (client.bufferedAmount >= BRIDGE_OUTBOUND_MAX_BUFFERED_BYTES) {
                state.flushTimer = setTimeout(
                    () => this.flushOutboundQueue(client),
                    BRIDGE_OUTBOUND_FLUSH_INTERVAL_MS
                );
                return;
            }

            const next = state.queue.shift();
            if (!next) {
                break;
            }

            try {
                client.send(next.serialized);
            } catch (error) {
                const meta = this.clientMeta.get(client);
                console.error(
                    `[PathBridge] Send error to #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}):`,
                    error
                );
                this.clearOutboundQueueState(client);
                return;
            }
        }
    }

    private sendMessage(client: WebSocket, type: string, payload: unknown): void {
        if (client.readyState !== WebSocket.OPEN) {
            this.clearOutboundQueueState(client);
            return;
        }

        let serialized = '';
        try {
            serialized = JSON.stringify({ type, payload });
        } catch (error) {
            const meta = this.clientMeta.get(client);
            console.error(
                `[PathBridge] Failed to serialize outbound frame ${type} for #${meta?.id ?? '?'} (${meta?.tag ?? 'unknown'}):`,
                error
            );
            return;
        }

        this.enqueueOutboundMessage(client, {
            type,
            serialized,
            enqueuedAt: Date.now(),
        });
    }

    private broadcastTo(predicate: (client: WebSocket) => boolean, type: string, payload: unknown): void {
        this.getOpenAuthorizedClients().forEach((client) => {
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

    private handleMessage(envelope: BridgeInboundEnvelope, sender: WebSocket): void {
        const { type, payload, client } = envelope;
        console.log(`[PathBridge] Received: ${type}`);

        switch (type) {
            case 'authenticate':
                break;

            case 'identify': {
                const identifyPayload = isRecord(payload) ? payload : {};
                const requestedTag = identifyPayload.client ?? identifyPayload.tag ?? client ?? 'unknown';
                this.setClientTag(sender, String(requestedTag));
                break;
            }

            case 'requestPath':
                this.handlePathRequest(sender);
                break;

            case 'pathResult':
                this.handlePathResult(payload, sender);
                break;

            case 'pathStatus':
                this.handlePathStatus(payload, sender);
                break;

            case 'renderMermaidResult':
                this.handleMermaidRenderResult(payload, sender);
                break;

            case 'nodeClick':
                this.invalidateCurrentPath('nodeClick');
                console.log(`[PathBridge] Godot clicked node: ${isRecord(payload) ? payload.nodeId : undefined}`);
                this.broadcast('nodeClick', payload);
                break;

            case 'markComplete':
                this.invalidateCurrentPath('markComplete');
                console.log(`[PathBridge] Node marked complete: ${isRecord(payload) ? payload.nodeId : undefined}`);
                this.broadcast('markComplete', payload);
                break;

            case 'switchCenter':
                this.invalidateCurrentPath('switchCenter');
                console.log(`[PathBridge] Switch center to: ${isRecord(payload) ? payload.newCenterId : undefined}`);
                this.broadcast('switchCenter', payload);
                break;

            case 'openReader': {
                const nodeId = isRecord(payload) ? payload.nodeId : payload;
                console.log(`[PathBridge] Open reader for: ${nodeId}`);
                this.broadcast('openReader', payload);
                break;
            }

            case 'unmarkComplete':
                this.invalidateCurrentPath('unmarkComplete');
                console.log(`[PathBridge] Node unmarked: ${isRecord(payload) ? payload.nodeId : undefined}`);
                this.broadcast('unmarkComplete', payload);
                break;

            case 'completionSync':
                this.invalidateCurrentPath('completionSync');
                console.log(
                    `[PathBridge] Completion sync, ${
                        isRecord(payload) && Array.isArray(payload.completedIds) ? payload.completedIds.length : 0
                    } nodes`
                );
                this.broadcast('completionSync', payload);
                break;

            case 'toggleCollapse':
                this.invalidateCurrentPath('toggleCollapse');
                console.log(`[PathBridge] Toggle collapse: ${isRecord(payload) ? payload.nodeId : undefined}`);
                this.broadcast('toggleCollapse', payload);
                break;

            case 'expandPrereqs':
                this.invalidateCurrentPath('expandPrereqs');
                console.log(`[PathBridge] Expand prereqs: ${isRecord(payload) ? payload.nodeId : undefined}`);
                this.broadcast('expandPrereqs', payload);
                break;

            case 'collapsePrereqs':
                this.invalidateCurrentPath('collapsePrereqs');
                console.log(`[PathBridge] Collapse prereqs: ${isRecord(payload) ? payload.nodeId : undefined}`);
                this.broadcast('collapsePrereqs', payload);
                break;

            case 'collapseAll':
                this.invalidateCurrentPath('collapseAll');
                console.log('[PathBridge] Collapse ALL requested');
                this.broadcast('collapseAll', payload);
                break;

            case 'configure':
                this.invalidateCurrentPath('configure');
                console.log('[PathBridge] Configuration update');
                this.broadcast('configure', payload);
                break;

            case 'exitPathMode':
                console.log('[PathBridge] Exit Path Mode requested');
                this.broadcast('exitPathMode', payload || {});
                break;

            // Single-window toggle: relay visibility control to Godot client.
            // 单窗口切换：将可见性控制消息转发给 Godot 客户端。
            case 'setWindowVisible':
                console.log(`[PathBridge] Set Godot window visible: ${isRecord(payload) ? payload.visible : undefined}`);
                this.broadcast('setWindowVisible', payload);
                break;

            case 'openNotemd':
            case 'open_notemd':
                console.log('[PathBridge] Open NoteMD requested from bridge client');
                this.broadcast('openNotemd', payload || {});
                break;

            case 'requestAppShutdown':
            case 'request_app_shutdown':
                console.log('[PathBridge] Full application shutdown requested from bridge client');
                this.broadcast('requestAppShutdown', payload || {});
                break;

            default:
                if (PATH_MUTATION_TYPES.has(type)) {
                    this.invalidateCurrentPath(type);
                }
                console.log(`[PathBridge] Unknown message type: ${type}`);
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
            includeSvg: payload.includeSvg === true || payload.includeStages === true,
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
        Array.from(this.pendingMermaidRenderRequests.values()).forEach((pendingRequest) => {
            clearTimeout(pendingRequest.timer);
            pendingRequest.reject(new Error('PathBridge is closing before Mermaid render completed.'));
        });
        this.pendingMermaidRenderRequests.clear();
        Array.from(this.unauthorizedClientTimers.keys()).forEach((client) => this.clearUnauthorizedDisconnect(client));
        Array.from(this.outboundQueueState.keys()).forEach((client) => this.clearOutboundQueueState(client));
        this.wss.close();
        this.clients.clear();
        this.clientMeta.clear();
    }
}




