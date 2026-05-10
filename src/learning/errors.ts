export type InvalidRequestErrorOptions = {
    errorCode?: string;
    cause?: unknown;
};

function normalizeInvalidRequestErrorCode(errorCode: unknown): string {
    const candidate = String(errorCode || '').trim().toLowerCase();
    if (!candidate) {
        return 'invalid_request';
    }
    return /^[a-z0-9_]+$/.test(candidate)
        ? candidate
        : 'invalid_request';
}

export class InvalidRequestError extends Error {
    public readonly errorCode: string;
    public readonly statusCode: number;

    public constructor(message: string, options: InvalidRequestErrorOptions = {}) {
        const normalizedMessage = String(message || '').trim() || 'Invalid request.';
        super(normalizedMessage);
        this.name = 'InvalidRequestError';
        this.errorCode = normalizeInvalidRequestErrorCode(options.errorCode);
        this.statusCode = 422;
        if (typeof options.cause !== 'undefined') {
            (this as Error & { cause?: unknown }).cause = options.cause;
        }
    }
}

export function isInvalidRequestError(error: unknown): error is InvalidRequestError {
    return error instanceof InvalidRequestError;
}
