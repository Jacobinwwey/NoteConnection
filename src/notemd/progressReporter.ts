import type { ProgressReporter } from './types';

export function createNoopProgressReporter(): ProgressReporter {
    return {
        report: () => undefined,
        isCancelled: () => false,
    };
}
