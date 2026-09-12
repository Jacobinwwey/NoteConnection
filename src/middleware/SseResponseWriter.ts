import type { Writable } from 'stream';

export interface SseDeliveryPolicy {
    maxBufferedBytes: number;
    drainTimeoutMs: number;
}

/** Owns backpressure and the single terminal outcome of one HTTP event stream. */
export class SseResponseWriter {
    private readonly pending: string[] = [];
    private queuedBytes = 0;
    private blocked = false;
    private finishing = false;
    private finished = false;
    private failure?: Error;
    private timer?: NodeJS.Timeout;
    private completion?: Promise<void>;
    private resolveCompletion?: () => void;
    private rejectCompletion?: (error: Error) => void;

    constructor(private readonly destination: Writable, private readonly policy: SseDeliveryPolicy = {
        maxBufferedBytes: 64 * 1024 * 1024 + 256 * 1024,
        drainTimeoutMs: 15_000,
    }) {
        if (!Number.isFinite(policy.maxBufferedBytes) || policy.maxBufferedBytes < 1
            || !Number.isFinite(policy.drainTimeoutMs) || policy.drainTimeoutMs < 1) throw new TypeError('Invalid SSE delivery policy');
        destination.on('drain', this.onDrain);
        destination.on('error', this.onError);
        destination.once('close', this.onClose);
        destination.once('finish', this.onFinish);
    }

    get pendingBytes(): number { return this.failure || this.finished ? 0 : this.queuedBytes + this.destination.writableLength; }

    write(frame: string): void {
        if (this.failure) throw this.failure;
        if (this.finishing || this.finished || this.destination.destroyed || this.destination.writableEnded) throw new Error('sse_closed');
        const bytes = Buffer.byteLength(frame);
        if (this.pending.length >= 128 || this.pendingBytes + bytes > this.policy.maxBufferedBytes) {
            this.fail(new Error('sse_buffer_limit'));
            throw this.failure;
        }
        if (this.blocked) { this.pending.push(frame); this.queuedBytes += bytes; return; }
        this.send(frame);
    }

    finish(): Promise<void> {
        if (this.failure) return Promise.reject(this.failure);
        if (this.finished) return Promise.resolve();
        if (this.completion) return this.completion;
        this.finishing = true;
        this.completion = new Promise<void>((resolve, reject) => {
            this.resolveCompletion = resolve;
            this.rejectCompletion = reject;
        });
        if (!this.blocked && this.pending.length === 0) this.destination.end();
        return this.completion;
    }

    private send(frame: string): void {
        try {
            if (!this.destination.write(frame)) {
                this.blocked = true;
                this.timer = setTimeout(() => this.fail(new Error('sse_drain_timeout')), this.policy.drainTimeoutMs);
                this.timer.unref();
            }
        } catch (error) {
            this.fail(error instanceof Error ? error : new Error(String(error)));
            throw this.failure;
        }
    }

    private readonly onDrain = (): void => {
        clearTimeout(this.timer);
        this.timer = undefined;
        this.blocked = false;
        try {
            while (this.pending.length && !this.blocked && !this.failure) {
                const frame = this.pending.shift()!;
                this.queuedBytes -= Buffer.byteLength(frame);
                this.send(frame);
            }
            if (this.finishing && !this.blocked && !this.failure) this.destination.end();
        } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
    };

    private readonly onError = (error: Error): void => { this.fail(error); };
    private readonly onClose = (): void => {
        if (!this.finished) this.fail(new Error('sse_closed'));
        this.cleanup();
    };
    private readonly onFinish = (): void => {
        if (this.failure) return;
        this.finished = true;
        this.cleanup();
        this.resolveCompletion?.();
    };

    private fail(error: Error): void {
        if (this.failure || this.finished) return;
        this.failure = error;
        this.pending.length = 0;
        this.queuedBytes = 0;
        clearTimeout(this.timer);
        this.destination.removeListener('drain', this.onDrain);
        this.rejectCompletion?.(error);
        // Preserve the error for finish(); destroy without an unhandled second error event.
        this.destination.destroy();
    }

    private cleanup(): void {
        clearTimeout(this.timer);
        this.destination.removeListener('drain', this.onDrain);
        this.destination.removeListener('error', this.onError);
        this.destination.removeListener('close', this.onClose);
        this.destination.removeListener('finish', this.onFinish);
    }
}
