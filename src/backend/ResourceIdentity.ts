import * as path from 'path';
import { createHash } from 'crypto';
import { normalizeResourceReference } from '../core/ResourceReference';

export { normalizeResourceReference } from '../core/ResourceReference';

export interface ResourceIdentity {
    sourceUri: string;
    revision: string;
    identityAliases: string[];
}

export type LegacyResourceDescriptor = {
    filepath: string;
    filename: string;
};

const SOURCE_URI_PREFIX = 'note://workspace/v1/';

function normalizeUnicodeText(value: string, fieldName: string): string {
    if (typeof value !== 'string') {
        throw new Error(`${fieldName} must be a string`);
    }
    if (value.includes('\0')) {
        throw new Error(`${fieldName} must not contain NUL characters`);
    }
    return value.normalize('NFC');
}

/**
 * Produces the case-folded path key used by portable aliases and source URIs.
 * The lower-case policy is deliberate: a workspace must not change identity when
 * moved between Windows and a case-sensitive POSIX host.
 */
export function normalizePortableResourcePath(relativePath: string): string {
    const normalized = normalizeUnicodeText(relativePath, 'Relative resource path')
        .replace(/\\/g, '/');
    if (
        !normalized
        || normalized.startsWith('/')
        || /^[A-Za-z]:\//.test(normalized)
    ) {
        throw new Error(`Relative resource path must stay inside the workspace: ${relativePath}`);
    }

    const segments = normalized.split('/');
    if (segments.some(segment => !segment || segment === '..')) {
        throw new Error(`Relative resource path contains an unsafe segment: ${relativePath}`);
    }

    return segments
        .filter(segment => segment !== '.')
        .map(segment => segment.toLowerCase())
        .join('/');
}

function createSourceUri(canonicalRelativePath: string): string {
    const encodedSegments = canonicalRelativePath
        .split('/')
        .map(segment => encodeURIComponent(segment));
    return `${SOURCE_URI_PREFIX}${encodedSegments.join('/')}`;
}

function createContentRevision(content: string): string {
    const normalizedContent = normalizeUnicodeText(content, 'Resource content');
    return `sha256:${createHash('sha256').update(normalizedContent, 'utf8').digest('hex')}`;
}

/**
 * Builds additive identity metadata for a loaded Markdown resource.
 * `relativePath` keeps its display spelling in aliases while the source URI is
 * canonicalized for cross-platform persistence.
 */
export function createResourceIdentity(
    relativePath: string,
    legacyId: string,
    content: string,
): ResourceIdentity {
    const displayRelativePath = normalizeUnicodeText(relativePath, 'Relative resource path')
        .replace(/\\/g, '/');
    const canonicalRelativePath = normalizePortableResourcePath(displayRelativePath);
    const normalizedLegacyId = normalizeUnicodeText(legacyId, 'Legacy resource ID');
    if (!normalizedLegacyId.trim()) {
        throw new Error('Legacy resource ID must not be empty');
    }

    const identityAliases = Array.from(new Set([
        normalizedLegacyId,
        normalizedLegacyId.toLowerCase().endsWith('.md') ? normalizedLegacyId : `${normalizedLegacyId}.md`,
        displayRelativePath,
        canonicalRelativePath,
    ]));

    return {
        sourceUri: createSourceUri(canonicalRelativePath),
        revision: createContentRevision(content),
        identityAliases,
    };
}

/**
 * Returns the stable, workspace-relative spelling used by persistence and diagnostics.
 * The legacy basename remains a compatibility alias; this value is the migration input
 * for a future stable source URI.
 */
export function normalizeResourceRelativePath(rootPath: string, filePath: string): string {
    normalizeUnicodeText(rootPath, 'Workspace root');
    normalizeUnicodeText(filePath, 'Resource path');
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
        const identityKey = normalizeResourceReference(file.filename);
        const paths = pathsById.get(identityKey) ?? [];
        paths.push(file.filepath);
        pathsById.set(identityKey, paths);
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
