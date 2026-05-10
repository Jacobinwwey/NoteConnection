export interface CliArgs {
    command: string;
    params: Record<string, string>;
    flags: Set<string>;
    positional: string[];
}

export function parseCliArgs(args: string[]): CliArgs {
    const params: Record<string, string> = {};
    const flags = new Set<string>();
    const positional: string[] = [];
    let command = '';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            const eqIdx = arg.indexOf('=');
            if (eqIdx !== -1) {
                const key = arg.slice(2, eqIdx);
                const value = arg.slice(eqIdx + 1);
                params[key] = value;
            } else {
                const key = arg.slice(2);
                // Check if next arg is a value
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    params[key] = args[i + 1];
                    i++;
                } else {
                    flags.add(key);
                }
            }
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                params[key] = args[i + 1];
                i++;
            } else {
                flags.add(key);
            }
        } else if (!command) {
            command = arg;
        } else {
            positional.push(arg);
        }
    }

    return { command, params, flags, positional };
}

export function resolveParam(params: Record<string, string>, keys: string[], fallback?: string): string | undefined {
    for (const key of keys) {
        if (params[key] !== undefined) return params[key];
    }
    return fallback;
}

export function resolveBool(params: Record<string, string>, flags: Set<string>, keys: string[]): boolean {
    for (const key of keys) {
        if (flags.has(key)) return true;
        if (params[key] !== undefined) {
            const v = params[key].toLowerCase();
            return v === 'true' || v === '1' || v === 'yes';
        }
    }
    return false;
}
