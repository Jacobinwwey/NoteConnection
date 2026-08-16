import * as path from 'path';

export type LegacyResourceDescriptor = {
    filepath: string;
    filename: string;
};

/**
 * Returns the stable, workspace-relative spelling used by persistence and diagnostics.
 * The legacy basename remains a compatibility alias; this value is the migration input
 * for a future stable source URI.
 */
export function normalizeResourceRelativePath(rootPath: string, filePath: string): string {
    const resolvedRoot = path.resolve(rootPath);
    const resolvedFile = path.resolve(filePath);
    const relativePath = path.relative(resolvedRoot, resolvedFile);
    const parentPrefix = `..${path.sep}`;

    if (
        !relativePath
        || relativePath === '..'
        || relativePath.startsWith(parentPrefix)
        || path.isAbsolute(relativePath)
    ) {
        throw new Error(`Resource path is outside workspace root: ${filePath}`);
    }

    return relativePath.split(path.sep).join('/').normalize('NFC');
}

/**
 * Prevents the current basename-based graph identity from silently dropping files.
 * This guard is intentionally fail-fast until stable source IDs and aliases are migrated.
 */
export function assertUniqueLegacyResourceIds(
    files: ReadonlyArray<LegacyResourceDescriptor>,
): void {
    const pathsById = new Map<string, string[]>();
    files.forEach((file) => {
        const paths = pathsById.get(file.filename) ?? [];
        paths.push(file.filepath);
        pathsById.set(file.filename, paths);
    });

    const collisions = Array.from(pathsById.entries())
        .filter(([, paths]) => paths.length > 1)
        .map(([id, paths]) => `${id}: ${paths.join(', ')}`);

    if (collisions.length > 0) {
        throw new Error(
            `Ambiguous legacy resource identity detected; duplicate basenames must be resolved before graph construction: ${collisions.join('; ')}`,
        );
    }
}
