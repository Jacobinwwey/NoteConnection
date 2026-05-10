import type * as http from 'http';
import * as crypto from 'crypto';

const ERROR_CODE_HEADER = 'x-nc-error-code';
const MAX_TRACE_RECORDS = 5000;

interface ApiRequestTraceRecord {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    errorCode?: string;
    durationMs: number;
    startedAt: string;
    finishedAt: string;
    responseContentType: string;
    responseContentLength: number | null;
    requestContentLength: number | null;
    remoteAddress: string;
    userAgent: string;
}

const traceRecords: ApiRequestTraceRecord[] = [];

export function resolveRequestId(req: http.IncomingMessage): string {
    return (req.headers['x-request-id'] as string) || crypto.randomUUID();
}

export function normalizeApiErrorCodeToken(
    value: string | number | string[] | undefined,
    fallback: string
): string {
    if (typeof value === 'string') return value.trim();
    return fallback;
}

export function appendRuntimeApiRequestTrace(record: ApiRequestTraceRecord): void {
    traceRecords.push(record);
    while (traceRecords.length > MAX_TRACE_RECORDS) {
        traceRecords.shift();
    }
}

export function getRuntimeRequestTrace(requestId?: string): ApiRequestTraceRecord[] {
    if (requestId) {
        return traceRecords.filter((r) => r.requestId === requestId);
    }
    return traceRecords.slice(-100);
}

export function startRequestTraceHandler(req: http.IncomingMessage, res: http.ServerResponse): {
    requestId: string;
    requestStartedAtMs: number;
    requestStartedAt: string;
} {
    const requestId = resolveRequestId(req);
    const requestStartedAtMs = Date.now();
    const requestStartedAt = new Date(requestStartedAtMs).toISOString();
    res.setHeader('X-Request-Id', requestId);
    return { requestId, requestStartedAtMs, requestStartedAt };
}

export function finishRequestTrace(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requestId: string,
    requestStartedAtMs: number,
    requestStartedAt: string,
    requestPath: string,
    ERROR_CODE_HEADER: string
): void {
    const responseContentLengthHeader = Number(res.getHeader('content-length'));
    const responseContentLength = Number.isFinite(responseContentLengthHeader)
        ? Math.max(0, Math.floor(responseContentLengthHeader))
        : null;
    const responseErrorCode = normalizeApiErrorCodeToken(
        res.getHeader(ERROR_CODE_HEADER),
        ''
    );
    appendRuntimeApiRequestTrace({
        requestId,
        method: String(req.method || 'GET').trim().toUpperCase(),
        path: requestPath,
        statusCode: Number(res.statusCode || 0),
        errorCode: responseErrorCode || undefined,
        durationMs: Number((Date.now() - requestStartedAtMs).toFixed(4)),
        startedAt: requestStartedAt,
        finishedAt: new Date().toISOString(),
        responseContentType: String(res.getHeader('content-type') || '').trim(),
        responseContentLength,
        requestContentLength: null,
        remoteAddress: String(req.socket?.remoteAddress || '').trim(),
        userAgent: String(req.headers['user-agent'] || '').trim().slice(0, 180),
    });
}

export { ERROR_CODE_HEADER };
