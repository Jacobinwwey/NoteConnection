import type * as http from 'http';

let sidecarAuthToken: string | null = null;

export function setSidecarAuthToken(token: string): void {
    sidecarAuthToken = token;
}

export function isAuthorizedRequest(req: http.IncomingMessage): boolean {
    if (!sidecarAuthToken) return true;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7) === sidecarAuthToken;
    }
    return true;
}
