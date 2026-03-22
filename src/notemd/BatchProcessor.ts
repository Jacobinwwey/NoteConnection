import { ProgressReporter, ValidationError } from './types';

export interface BatchProcessorOptions {
    concurrency?: number;
    interTaskDelayMs?: number;
    continueOnError?: boolean;
    signal?: AbortSignal;
    reporter?: ProgressReporter;
}

export interface BatchItemResult<T> {
    index: number;
    ok: boolean;
    value?: T;
    error?: string;
    durationMs: number;
}

function delay(ms: number): Promise<void> {
    if (ms <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function asErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export class BatchProcessor {
    public async process<TInput, TResult>(
        items: TInput[],
        handler: (item: TInput, index: number, signal?: AbortSignal) => Promise<TResult>,
        options: BatchProcessorOptions = {}
    ): Promise<Array<BatchItemResult<TResult>>> {
        if (!Array.isArray(items)) {
            throw new ValidationError('BatchProcessor requires an array of items.');
        }
        if (typeof handler !== 'function') {
            throw new ValidationError('BatchProcessor requires a handler function.');
        }

        const concurrency = Math.max(1, Math.min(32, Math.floor(options.concurrency || 1)));
        const interTaskDelayMs = Math.max(0, Math.floor(options.interTaskDelayMs || 0));
        const continueOnError = options.continueOnError !== false;
        const signal = options.signal;
        const reporter = options.reporter;
        const results: Array<BatchItemResult<TResult>> = new Array(items.length);
        let nextIndex = 0;
        let fatalError: Error | null = null;

        const runWorker = async (): Promise<void> => {
            for (;;) {
                if (fatalError) {
                    return;
                }
                if (signal?.aborted) {
                    fatalError = new Error('Operation cancelled.');
                    return;
                }

                const index = nextIndex;
                nextIndex += 1;
                if (index >= items.length) {
                    return;
                }

                const startedAt = Date.now();
                try {
                    const value = await handler(items[index], index, signal);
                    results[index] = {
                        index,
                        ok: true,
                        value,
                        durationMs: Date.now() - startedAt,
                    };
                } catch (error) {
                    const message = asErrorMessage(error);
                    results[index] = {
                        index,
                        ok: false,
                        error: message,
                        durationMs: Date.now() - startedAt,
                    };

                    reporter?.report({
                        type: 'error',
                        message: `Batch item ${index + 1}/${items.length} failed: ${message}`,
                    });

                    if (!continueOnError) {
                        fatalError = error instanceof Error ? error : new Error(message);
                        return;
                    }
                }

                if (interTaskDelayMs > 0) {
                    await delay(interTaskDelayMs);
                }
            }
        };

        const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
        await Promise.all(workers);

        if (fatalError) {
            throw fatalError;
        }

        return results;
    }
}

