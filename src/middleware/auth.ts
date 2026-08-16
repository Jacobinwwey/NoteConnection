import type * as http from 'http';

let sidecarAuthToken: string | null = null;

export function setSidecarAuthToken(token: string): void {
    sidecarAuthToken = String(token || '').trim() || null;
}

function readHeader(req: http.IncomingMessage, name: string): string {
    const value = req.headers[name];
    if (Array.isArray(value)) {
        return String(value[0] || '').trim();
    }
    return String(value || '').trim();
}

/**
 * Shared credential decision for the sidecar and HTTP server entry points.
 * A configured token changes the default from anonymous allow to explicit deny.
 */
export function isRequestTokenAuthorized(
    req: http.IncomingMessage,
    expectedToken: string,
): boolean {
    const expected = String(expectedToken || '').trim();
    if (!expected) return true;

    const legacyToken = readHeader(req, 'x-noteconnection-token');
    if (legacyToken) {
        return legacyToken === expected;
    }

    const authHeader = readHeader(req, 'authorization');
    if (!/^Bearer\s+/i.test(authHeader)) {
        return false;
    }

    const bearerToken = authHeader.slice(7).trim();
    return bearerToken.length > 0 && bearerToken === expected;
}

export function isAuthorizedRequest(req: http.IncomingMessage): boolean {
    return isRequestTokenAuthorized(req, sidecarAuthToken || '');
}
