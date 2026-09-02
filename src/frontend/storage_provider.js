(function () {
    function getRuntimeBridge() {
        return (typeof window !== 'undefined' && window.NoteConnectionRuntime)
            ? window.NoteConnectionRuntime
            : null;
    }

    function getTauriInvoke() {
        if (!window.__TAURI__ || !window.__TAURI__.core || typeof window.__TAURI__.core.invoke !== 'function') {
            return null;
        }
        return window.__TAURI__.core.invoke;
    }

    function isCapacitorNativeRuntime() {
        if (typeof window === 'undefined' || window.__TAURI__ || !window.Capacitor) {
            return false;
        }
        try {
            if (typeof window.Capacitor.getPlatform === 'function') {
                const platform = window.Capacitor.getPlatform();
                if (platform && platform !== 'web') {
                    return true;
                }
            }
            if (typeof window.Capacitor.isNativePlatform === 'function') {
                return Boolean(window.Capacitor.isNativePlatform());
            }
        } catch (_err) {
            return false;
        }
        return false;
    }

    function getCapacitorFilesystemPlugin() {
        if (!isCapacitorNativeRuntime() || !window.Capacitor) {
            return null;
        }
        const plugins = window.Capacitor.Plugins || {};
        return plugins.Filesystem || window.CapacitorFilesystem || null;
    }

    let capacitorFsPermissionGranted = false;
    let capacitorFsPermissionPromise = null;
    const CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS = 20000;
    const CAPACITOR_BRIDGE_MAX_CHUNK_BYTES = 192 * 1024;
    const CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES = 48 * 1024 * 1024;
    const CAPACITOR_BRIDGE_MAX_TEXT_PAYLOAD_BYTES = 64 * 1024 * 1024;
    const FALLBACK_MOBILE_RUNTIME_BUDGET = Object.freeze({
        maxDocuments: 5000,
        maxDocumentBytes: 16 * 1024 * 1024,
        maxTotalInputBytes: 64 * 1024 * 1024,
        maxEdges: 250000,
        maxDepth: 64,
        maxProjectionBytes: CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES
    });

    function getMobileRuntimeBudget() {
        const candidate = typeof window !== 'undefined' ? window.NoteConnectionMobileBudget : null;
        const runtime = candidate && candidate.runtime;
        if (!runtime || typeof runtime !== 'object') {
            return FALLBACK_MOBILE_RUNTIME_BUDGET;
        }

        const keys = Object.keys(FALLBACK_MOBILE_RUNTIME_BUDGET);
        const isValid = keys.every((key) => Number.isInteger(runtime[key]) && runtime[key] > 0);
        return isValid ? runtime : FALLBACK_MOBILE_RUNTIME_BUDGET;
    }

    function measureUtf8Bytes(textPayload) {
        const text = String(textPayload || '');
        if (!text) {
            return 0;
        }
        if (typeof TextEncoder === 'function') {
            return new TextEncoder().encode(text).length;
        }
        if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
            return Buffer.byteLength(text, 'utf8');
        }
        return text.length;
    }

    function getCapacitorDirectoryHints(filesystem) {
        const directoryHints = [];
        const directories = (filesystem && filesystem.Directory) ? filesystem.Directory : {};
        if (directories.Data) {
            directoryHints.push(directories.Data);
        }
        if (directories.Documents) {
            directoryHints.push(directories.Documents);
        }
        if (directories.ExternalStorage) {
            directoryHints.push(directories.ExternalStorage);
        }
        directoryHints.push(null);
        return directoryHints;
    }

    function sanitizeTargetName(target) {
        return String(target || '').replace(/[^a-z0-9_\-]/gi, '_');
    }

    function parseCapacitorFrontmatter(content) {
        const metadata = {
            tags: [],
            prerequisites: [],
            next: []
        };
        const match = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) {
            return metadata;
        }
        const yaml = match[1];

        const cleanLink = (raw) => {
            let text = String(raw || '').trim();
            const linkMatch = text.match(/^\[\[(.*?)(?:\|.*?)?\]\]$/);
            if (linkMatch) {
                return String(linkMatch[1] || '').trim();
            }
            text = text.replace(/^["']|["']$/g, '').trim();
            return text;
        };

        const extractField = (fieldName) => {
            const results = [];
            const listBlockRegex = new RegExp(`${fieldName}:\\s*\\r?\\n((?:\\s*-\\s*.*\\r?\\n?)*)`, 'i');
            const listMatch = yaml.match(listBlockRegex);
            if (listMatch) {
                listMatch[1]
                    .split(/\r?\n/)
                    .forEach((line) => {
                        const itemMatch = line.match(/\s*-\s*(.*)/);
                        if (!itemMatch) {
                            return;
                        }
                        const cleaned = cleanLink(itemMatch[1]);
                        if (cleaned) {
                            results.push(cleaned);
                        }
                    });
                if (results.length > 0) {
                    return results;
                }
            }

            const inlineRegex = new RegExp(`${fieldName}:\\s*(.*)`, 'i');
            const inlineMatch = yaml.match(inlineRegex);
            if (!inlineMatch) {
                return results;
            }

            const inlineValue = String(inlineMatch[1] || '').trim();
            if (!inlineValue || inlineValue.startsWith('#')) {
                return results;
            }

            if (inlineValue.startsWith('[[')) {
                const cleaned = cleanLink(inlineValue);
                if (cleaned) {
                    results.push(cleaned);
                }
                return results;
            }

            if (inlineValue.startsWith('[')) {
                inlineValue
                    .replace(/^\[|\]$/g, '')
                    .split(',')
                    .forEach((item) => {
                        const cleaned = cleanLink(item);
                        if (cleaned) {
                            results.push(cleaned);
                        }
                    });
                return results;
            }

            if (!inlineValue.startsWith('-')) {
                const cleaned = cleanLink(inlineValue);
                if (cleaned) {
                    results.push(cleaned);
                }
            }
            return results;
        };

        metadata.tags = extractField('tags');
        metadata.prerequisites = extractField('prerequisites');
        metadata.next = extractField('next');
        return metadata;
    }

    function stripMarkdownExtension(value) {
        return String(value || '')
            .trim()
            .replace(/\.md$/i, '')
            .replace(/\\/g, '/')
            .split('/')
            .filter(Boolean)
            .pop() || '';
    }

    function canonicalMobileNodeIdFromIdentity(identity) {
        const sourceUri = identity && typeof identity.sourceUri === 'string'
            ? identity.sourceUri
            : '';
        const prefix = 'note://workspace/v1/';
        if (!sourceUri.startsWith(prefix)) {
            return '';
        }
        try {
            return decodeURIComponent(sourceUri.slice(prefix.length))
                .replace(/\.(?:md|markdown)$/i, '')
                .trim();
        } catch (_error) {
            return '';
        }
    }

    async function createMobileResourceIdentity(relativePath, legacyId, content) {
        const identityContract = typeof globalThis !== 'undefined'
            ? globalThis.NoteConnectionMobileIdentity
            : null;
        if (!identityContract || typeof identityContract.createResourceIdentity !== 'function') {
            throw new Error('Mobile identity contract is unavailable.');
        }
        return await identityContract.createResourceIdentity(relativePath, legacyId, content);
    }

    function extractWikiLinks(content) {
        const links = new Set();
        const regex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
        const text = String(content || '');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const linked = String(match[1] || '').trim();
            if (linked) {
                links.add(linked);
            }
        }
        return Array.from(links);
    }

    function extractMarkdownLinks(content) {
        const links = new Set();
        const regex = /\]\(([^)]+)\)/g;
        const text = String(content || '');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const linked = String(match[1] || '').trim();
            if (linked) {
                links.add(linked);
            }
        }
        return Array.from(links);
    }

    function normalizeCapacitorCanonicalId(value) {
        const normalized = String(value || '')
            .normalize('NFC')
            .replace(/\\/g, '/')
            .replace(/^knowledge_base\//i, '')
            .replace(/^\/+/, '')
            .trim();
        const segments = [];
        for (const segment of normalized.split('/')) {
            if (!segment || segment === '.') {
                continue;
            }
            if (segment === '..') {
                if (segments.length === 0) {
                    return '';
                }
                segments.pop();
                continue;
            }
            segments.push(segment);
        }
        return segments.join('/').replace(/\.(?:md|markdown)$/i, '').toLowerCase();
    }

    function cleanCapacitorReference(rawReference) {
        let reference = String(rawReference || '').trim();
        const wikiMatch = reference.match(/^\[\[(.*?)(?:\|.*?)?\]\]$/);
        if (wikiMatch) {
            reference = String(wikiMatch[1] || '').trim();
        }
        reference = reference.replace(/^['"]|['"]$/g, '').trim();
        reference = reference.split('#')[0].split('?')[0].trim();
        if (!reference || /^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith('/')) {
            return '';
        }
        try {
            reference = decodeURIComponent(reference);
        } catch (_error) {
            return '';
        }
        return reference;
    }

    function resolveCapacitorReferencePath(sourceCanonicalId, rawReference) {
        const reference = cleanCapacitorReference(rawReference);
        if (!reference) {
            return '';
        }
        const direct = normalizeCapacitorCanonicalId(reference);
        const sourceSegments = normalizeCapacitorCanonicalId(sourceCanonicalId).split('/').filter(Boolean);
        sourceSegments.pop();
        const relative = normalizeCapacitorCanonicalId([...sourceSegments, reference].join('/'));
        return { direct, relative };
    }

    function buildCapacitorReferenceIndex(files) {
        const byCanonicalId = new Map();
        const byLegacyId = new Map();
        const byUniqueStem = new Map();
        files.forEach((file) => {
            const canonicalId = normalizeCapacitorCanonicalId(
                file.canonicalId || canonicalMobileNodeIdFromIdentity(file) || file.path || file.id
            );
            if (!file.id || !canonicalId) {
                return;
            }
            const legacyKey = String(file.id).normalize('NFC').toLowerCase();
            if (byLegacyId.has(legacyKey)) {
                throw new Error(`Capacitor graph contains an ambiguous legacy basename: ${file.id}`);
            }
            if (byCanonicalId.has(canonicalId)) {
                throw new Error(`Capacitor graph contains duplicate canonical node id: ${canonicalId}`);
            }
            byLegacyId.set(legacyKey, file);
            byCanonicalId.set(canonicalId, file);
            const stem = canonicalId.split('/').pop() || canonicalId;
            const stemCandidates = byUniqueStem.get(stem) || [];
            stemCandidates.push(file);
            byUniqueStem.set(stem, stemCandidates);
            file.__canonicalId = canonicalId;
        });
        return { byCanonicalId, byLegacyId, byUniqueStem };
    }

    function resolveCapacitorReference(sourceFile, rawReference, referenceIndex) {
        const paths = resolveCapacitorReferencePath(sourceFile.__canonicalId, rawReference);
        if (!paths) {
            return null;
        }
        const direct = referenceIndex.byCanonicalId.get(paths.direct);
        if (direct) {
            return direct;
        }
        const relative = referenceIndex.byCanonicalId.get(paths.relative);
        if (relative) {
            return relative;
        }
        const stem = paths.direct.split('/').pop() || paths.direct;
        const candidates = referenceIndex.byUniqueStem.get(stem) || [];
        return candidates.length === 1 ? candidates[0] : null;
    }

    function normalizeCapacitorPath(pathValue, options) {
        const allowCurrentDir = Boolean(options && options.allowCurrentDir);
        const normalized = String(pathValue || '').replace(/\\/g, '/').replace(/^\/+/, '');
        if (!normalized) {
            if (allowCurrentDir) {
                return '.';
            }
            throw new Error('Missing Capacitor read path.');
        }

        if (normalized === '.') {
            if (allowCurrentDir) {
                return normalized;
            }
            throw new Error('Invalid Capacitor read path.');
        }

        const segments = normalized.split('/').filter((segment) => segment.length > 0);
        if (!segments.length) {
            if (allowCurrentDir) {
                return '.';
            }
            throw new Error('Invalid Capacitor read path.');
        }
        if (segments.some((segment) => segment === '.' || segment === '..')) {
            throw new Error(`Unsafe Capacitor path is not allowed: ${normalized}`);
        }

        return segments.join('/');
    }

    function extractRelativePathFromKbMarker(rawFilePath) {
        const normalized = String(rawFilePath || '').replace(/\\/g, '/');
        const lowered = normalized.toLowerCase();
        const marker = '/knowledge_base/';
        const markerNoPrefix = 'knowledge_base/';
        const markerIndex = lowered.indexOf(marker);

        if (markerIndex >= 0) {
            const relative = normalized.slice(markerIndex + marker.length);
            return relative.length > 0 ? relative : null;
        }

        if (lowered.startsWith(markerNoPrefix)) {
            const relative = normalized.slice(markerNoPrefix.length);
            return relative.length > 0 ? relative : null;
        }

        return null;
    }

    function extractRelativePathFromWorkspaceUri(rawFilePath) {
        const normalized = String(rawFilePath || '').replace(/\\/g, '/');
        const prefix = 'note://workspace/v1/';
        if (!normalized.toLowerCase().startsWith(prefix)) {
            return null;
        }
        try {
            const relative = decodeURIComponent(normalized.slice(prefix.length));
            return relative.length > 0 ? relative : null;
        } catch (_error) {
            throw new Error('Invalid workspace source URI for Capacitor content read.');
        }
    }

    function resolveCapacitorContentCandidatePath(rawFilePath) {
        const raw = String(rawFilePath || '').trim();
        if (!raw) {
            throw new Error('Missing content path for Capacitor runtime.');
        }

        const normalized = raw.replace(/\\/g, '/');
        const relativeFromKb = extractRelativePathFromKbMarker(raw);
        if (relativeFromKb) {
            return normalizeCapacitorPath(`Knowledge_Base/${relativeFromKb}`);
        }

        const relativeFromWorkspaceUri = extractRelativePathFromWorkspaceUri(raw);
        if (relativeFromWorkspaceUri) {
            return normalizeCapacitorPath(`Knowledge_Base/${relativeFromWorkspaceUri}`);
        }

        if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(normalized)) {
            throw new Error('Cannot map non-workspace URI on Capacitor without Knowledge_Base marker.');
        }

        if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
            throw new Error('Cannot map absolute desktop path on Capacitor without Knowledge_Base marker.');
        }

        if (/^knowledge_base\//i.test(normalized)) {
            return normalizeCapacitorPath(normalized);
        }
        return normalizeCapacitorPath(`Knowledge_Base/${normalized}`);
    }

    function isGrantedPermissionValue(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'granted' || normalized === 'limited';
    }

    function resolveFilesystemPermissionValue(permissionResult) {
        if (!permissionResult || typeof permissionResult !== 'object') {
            return '';
        }

        const result = permissionResult;
        const candidates = [
            result.publicStorage,
            result.filesystem,
            result.storage,
            result.readExternalStorage,
            result.read
        ];
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                return candidate.trim();
            }
        }
        return '';
    }

    async function ensureCapacitorFilesystemPermission(filesystem) {
        if (capacitorFsPermissionGranted) {
            return;
        }
        if (!filesystem) {
            return;
        }

        const supportsCheck = typeof filesystem.checkPermissions === 'function';
        const supportsRequest = typeof filesystem.requestPermissions === 'function';
        if (!supportsCheck && !supportsRequest) {
            // Some runtimes do not expose storage permission APIs. Proceed with best effort.
            capacitorFsPermissionGranted = true;
            return;
        }

        if (capacitorFsPermissionPromise) {
            await capacitorFsPermissionPromise;
            return;
        }

        capacitorFsPermissionPromise = (async () => {
            let currentPermission = '';
            if (supportsCheck) {
                const status = await filesystem.checkPermissions();
                currentPermission = resolveFilesystemPermissionValue(status);
            }

            if (!isGrantedPermissionValue(currentPermission) && supportsRequest) {
                const requested = await filesystem.requestPermissions();
                currentPermission = resolveFilesystemPermissionValue(requested);
            }

            if (!currentPermission) {
                // Some platforms expose APIs but no explicit storage state; use best effort.
                capacitorFsPermissionGranted = true;
                return;
            }
            if (!isGrantedPermissionValue(currentPermission)) {
                throw new Error('Filesystem permission is not granted on this device.');
            }

            capacitorFsPermissionGranted = true;
        })().finally(() => {
            capacitorFsPermissionPromise = null;
        });

        await capacitorFsPermissionPromise;
    }

    function decodeCapacitorTextPayload(rawData) {
        if (typeof rawData === 'string') {
            return rawData;
        }
        if (rawData && typeof rawData.data === 'string') {
            return rawData.data;
        }
        return '';
    }

    function normalizeCapacitorEntryType(rawType) {
        const normalized = String(rawType || '').trim().toLowerCase();
        if (!normalized) {
            return '';
        }
        if (
            normalized === 'directory' ||
            normalized === 'dir' ||
            normalized === 'folder'
        ) {
            return 'directory';
        }
        if (
            normalized === 'file' ||
            normalized === 'regular' ||
            normalized === 'regular_file'
        ) {
            return 'file';
        }
        return '';
    }

    function isHighSurrogateCodeUnit(codeUnit) {
        return codeUnit >= 0xD800 && codeUnit <= 0xDBFF;
    }

    function isLowSurrogateCodeUnit(codeUnit) {
        return codeUnit >= 0xDC00 && codeUnit <= 0xDFFF;
    }

    function* splitCapacitorPayloadIntoChunks(textPayload, maxChunkBytes) {
        const text = String(textPayload || '');
        const boundedChunkBytes = Math.max(
            1024,
            Math.floor(Number(maxChunkBytes) || CAPACITOR_BRIDGE_MAX_CHUNK_BYTES)
        );
        const maxChunkChars = Math.max(256, Math.floor(boundedChunkBytes / 3));

        if (text.length === 0) {
            yield '';
            return;
        }

        let cursor = 0;
        while (cursor < text.length) {
            let end = Math.min(text.length, cursor + maxChunkChars);
            if (end < text.length && end > cursor) {
                const previousCodeUnit = text.charCodeAt(end - 1);
                const nextCodeUnit = text.charCodeAt(end);
                if (isHighSurrogateCodeUnit(previousCodeUnit) && isLowSurrogateCodeUnit(nextCodeUnit)) {
                    end -= 1;
                }
            }
            if (end <= cursor) {
                end = Math.min(text.length, cursor + 1);
            }
            yield text.slice(cursor, end);
            cursor = end;
        }
    }

    async function writeCapacitorChunkSequenceToDirectory(filesystem, normalizedPath, chunkSequenceFactory, options) {
        const directory = options && Object.prototype.hasOwnProperty.call(options, 'directory')
            ? options.directory
            : undefined;
        const maxPayloadBytes = Math.max(
            1024,
            Math.floor(Number(options && options.maxPayloadBytes) || CAPACITOR_BRIDGE_MAX_TEXT_PAYLOAD_BYTES)
        );
        const payloadLabel = options && typeof options.payloadLabel === 'string'
            ? options.payloadLabel
            : normalizedPath;
        const canAppend = typeof filesystem.appendFile === 'function';

        let totalBytes = 0;
        let wroteChunk = false;

        const appendArgsBase = {
            path: normalizedPath,
            encoding: 'utf8'
        };
        if (directory) {
            appendArgsBase.directory = directory;
        }

        for (const rawChunk of chunkSequenceFactory()) {
            const sourceChunk = String(rawChunk || '');
            for (const chunk of splitCapacitorPayloadIntoChunks(sourceChunk, CAPACITOR_BRIDGE_MAX_CHUNK_BYTES)) {
                const chunkBytes = measureUtf8Bytes(chunk);
                if (chunkBytes > CAPACITOR_BRIDGE_MAX_CHUNK_BYTES) {
                    throw new Error(
                        `Capacitor bridge chunk exceeds ${CAPACITOR_BRIDGE_MAX_CHUNK_BYTES} bytes for ${payloadLabel}.`
                    );
                }
                if (chunk === '' && wroteChunk) {
                    continue;
                }

                totalBytes += chunkBytes;
                if (totalBytes > maxPayloadBytes) {
                    throw new Error(
                        `Capacitor bridge payload for ${payloadLabel} exceeds ${maxPayloadBytes} bytes.`
                    );
                }

                if (!wroteChunk) {
                    const writeArgs = {
                        ...appendArgsBase,
                        data: chunk,
                        recursive: true
                    };
                    await filesystem.writeFile(writeArgs);
                    wroteChunk = true;
                    continue;
                }

                if (!canAppend) {
                    throw new Error(
                        'Capacitor Filesystem appendFile API is required for chunked graph serialization writes.'
                    );
                }
                await filesystem.appendFile({
                    ...appendArgsBase,
                    data: chunk
                });
            }
        }

        if (!wroteChunk) {
            await filesystem.writeFile({
                ...appendArgsBase,
                data: '',
                recursive: true
            });
        }
    }

    async function capacitorWriteChunkSequence(pathValue, chunkSequenceFactory, options) {
        const filesystem = getCapacitorFilesystemPlugin();
        if (!filesystem || typeof filesystem.writeFile !== 'function') {
            throw new Error('Capacitor Filesystem write API is unavailable.');
        }

        if (typeof chunkSequenceFactory !== 'function') {
            throw new Error('Capacitor write sequence factory must be a function.');
        }

        await ensureCapacitorFilesystemPermission(filesystem);
        const normalizedPath = normalizeCapacitorPath(pathValue);

        const explicitDirectory = options && Object.prototype.hasOwnProperty.call(options, 'directory')
            ? options.directory
            : undefined;
        const directoryHints = explicitDirectory === undefined
            ? getCapacitorDirectoryHints(filesystem)
            : [explicitDirectory];

        let lastError = null;
        for (const directory of directoryHints) {
            try {
                await writeCapacitorChunkSequenceToDirectory(
                    filesystem,
                    normalizedPath,
                    chunkSequenceFactory,
                    {
                        ...options,
                        directory
                    }
                );
                return true;
            } catch (err) {
                lastError = err;
            }
        }

        throw lastError || new Error(`Failed to write Capacitor file: ${normalizedPath}`);
    }

    async function capacitorStat(pathValue, options) {
        const filesystem = getCapacitorFilesystemPlugin();
        if (!filesystem || typeof filesystem.stat !== 'function') {
            return null;
        }

        await ensureCapacitorFilesystemPermission(filesystem);
        const normalizedPath = normalizeCapacitorPath(pathValue, { allowCurrentDir: true });
        const explicitDirectory = options && Object.prototype.hasOwnProperty.call(options, 'directory')
            ? options.directory
            : undefined;
        const hints = explicitDirectory === undefined
            ? getCapacitorDirectoryHints(filesystem)
            : [explicitDirectory];

        for (const directory of hints) {
            try {
                const args = { path: normalizedPath };
                if (directory) {
                    args.directory = directory;
                }
                const statResult = await filesystem.stat(args);
                return {
                    stat: statResult || {},
                    directory
                };
            } catch (_err) {
                // Try next directory hint.
            }
        }

        return null;
    }

    async function capacitorReadText(pathValue, options) {
        const filesystem = getCapacitorFilesystemPlugin();
        if (!filesystem || typeof filesystem.readFile !== 'function') {
            throw new Error('Capacitor Filesystem plugin is unavailable.');
        }

        await ensureCapacitorFilesystemPermission(filesystem);
        const normalizedPath = normalizeCapacitorPath(pathValue);
        const explicitDirectory = options && Object.prototype.hasOwnProperty.call(options, 'directory')
            ? options.directory
            : undefined;
        const maxBytes = Math.max(
            1024,
            Math.floor(Number(options && options.maxBytes) || CAPACITOR_BRIDGE_MAX_TEXT_PAYLOAD_BYTES)
        );
        const directoryHints = explicitDirectory === undefined
            ? getCapacitorDirectoryHints(filesystem)
            : [explicitDirectory];

        let lastError = null;
        for (const directory of directoryHints) {
            try {
                const args = { path: normalizedPath, encoding: 'utf8' };
                if (directory) {
                    args.directory = directory;
                }
                // Stat is a preflight guard: reading an oversized note first would
                // defeat the low-memory contract even if the decoded text is later rejected.
                if (typeof filesystem.stat === 'function') {
                    try {
                        const statResult = await filesystem.stat(args);
                        const reportedBytes = Number(statResult && statResult.size);
                        if (Number.isFinite(reportedBytes) && reportedBytes > maxBytes) {
                            const budgetError = new Error(
                                `Capacitor file exceeds ${maxBytes} bytes: ${normalizedPath}`
                            );
                            budgetError.code = 'MOBILE_BUDGET_EXCEEDED';
                            throw budgetError;
                        }
                    } catch (err) {
                        if (err && err.code === 'MOBILE_BUDGET_EXCEEDED') {
                            throw err;
                        }
                        // Some Capacitor versions do not expose stat for SAF handles;
                        // the bounded decoded-text check below remains the fallback.
                    }
                }
                const result = await filesystem.readFile(args);
                const text = decodeCapacitorTextPayload(result);
                if (measureUtf8Bytes(text) > maxBytes) {
                    const budgetError = new Error(
                        `Capacitor file exceeds ${maxBytes} bytes: ${normalizedPath}`
                    );
                    budgetError.code = 'MOBILE_BUDGET_EXCEEDED';
                    throw budgetError;
                }
                return text;
            } catch (err) {
                if (err && err.code === 'MOBILE_BUDGET_EXCEEDED') {
                    throw err;
                }
                lastError = err;
            }
        }

        throw lastError || new Error(`Failed to read Capacitor file: ${normalizedPath}`);
    }

    async function capacitorWriteText(pathValue, textPayload, options) {
        const payload = String(textPayload || '');
        return await capacitorWriteChunkSequence(
            pathValue,
            () => splitCapacitorPayloadIntoChunks(payload, CAPACITOR_BRIDGE_MAX_CHUNK_BYTES),
            {
                ...options,
                maxPayloadBytes: options && Number.isFinite(options.maxPayloadBytes)
                    ? Number(options.maxPayloadBytes)
                    : CAPACITOR_BRIDGE_MAX_TEXT_PAYLOAD_BYTES
            }
        );
    }

    async function capacitorReadDirectoryEntries(pathValue) {
        const filesystem = getCapacitorFilesystemPlugin();
        if (!filesystem || typeof filesystem.readdir !== 'function') {
            return [];
        }

        await ensureCapacitorFilesystemPermission(filesystem);
        const normalizedPath = normalizeCapacitorPath(pathValue, { allowCurrentDir: true });
        const directoryHints = getCapacitorDirectoryHints(filesystem);

        for (const directory of directoryHints) {
            try {
                const args = { path: normalizedPath };
                if (directory) {
                    args.directory = directory;
                }
                const result = await filesystem.readdir(args);
                const files = Array.isArray(result && result.files) ? result.files : [];
                const entries = [];

                for (const entry of files) {
                    const name = typeof entry === 'string'
                        ? entry
                        : (entry && typeof entry.name === 'string' ? entry.name : '');
                    if (!name) {
                        continue;
                    }

                    const explicitType = normalizeCapacitorEntryType(
                        entry && typeof entry === 'object'
                            ? (entry.type || entry.kind || entry.fileType || '')
                            : ''
                    );
                    let isDirectory = null;
                    if (explicitType === 'directory') {
                        isDirectory = true;
                    } else if (explicitType === 'file') {
                        isDirectory = false;
                    } else if (typeof filesystem.stat === 'function') {
                        const childPath = normalizedPath === '.'
                            ? normalizeCapacitorPath(name)
                            : normalizeCapacitorPath(`${normalizedPath}/${name}`);
                        const statResult = await capacitorStat(childPath, { directory });
                        if (statResult && statResult.stat) {
                            const statType = normalizeCapacitorEntryType(
                                statResult.stat.type || statResult.stat.kind || statResult.stat.fileType || ''
                            );
                            if (statType === 'directory') {
                                isDirectory = true;
                            } else if (statType === 'file') {
                                isDirectory = false;
                            }
                        }
                    }

                    entries.push({
                        name,
                        path: normalizedPath === '.'
                            ? normalizeCapacitorPath(name)
                            : normalizeCapacitorPath(`${normalizedPath}/${name}`),
                        isDirectory,
                        directory
                    });
                }

                return entries;
            } catch (_err) {
                // Try next directory hint.
            }
        }

        return [];
    }

    async function capacitorReadDirectory(pathValue) {
        const entries = await capacitorReadDirectoryEntries(pathValue);
        return entries.map((entry) => entry.name).filter(Boolean);
    }

    async function capacitorReadTextIfExists(pathValue) {
        try {
            const text = await capacitorReadText(pathValue);
            return text;
        } catch (_err) {
            return null;
        }
    }

    async function collectCapacitorMarkdownFiles(targetPath) {
        const budget = getMobileRuntimeBudget();
        const queue = [{
            path: normalizeCapacitorPath(targetPath, { allowCurrentDir: true }),
            depth: 0
        }];
        const visited = new Set();
        const files = [];
        let totalBytes = 0;

        while (queue.length > 0) {
            const currentEntry = queue.shift();
            const current = currentEntry && currentEntry.path;
            const currentDepth = currentEntry && Number.isInteger(currentEntry.depth)
                ? currentEntry.depth
                : 0;
            if (!current || visited.has(current)) {
                continue;
            }
            visited.add(current);

            const entries = await capacitorReadDirectoryEntries(current);
            for (const entry of entries) {
                if (!entry || !entry.name || entry.name.startsWith('.')) {
                    continue;
                }

                const looksLikeMarkdown = /\.md$/i.test(entry.name);
                const entryDepth = currentDepth + 1;
                if (entryDepth > budget.maxDepth) {
                    throw new Error(
                        `Capacitor local build directory depth exceeds ${budget.maxDepth}. ` +
                        'Please flatten the knowledge base or build on desktop.'
                    );
                }
                if (entry.isDirectory === true) {
                    queue.push({ path: entry.path, depth: entryDepth });
                    continue;
                }
                if (entry.isDirectory === null && !looksLikeMarkdown) {
                    queue.push({ path: entry.path, depth: entryDepth });
                    continue;
                }
                if (!looksLikeMarkdown) {
                    continue;
                }

                if (files.length >= budget.maxDocuments) {
                    throw new Error(
                        `Capacitor local build file count exceeds ${budget.maxDocuments}. ` +
                        'Please build on desktop for large datasets.'
                    );
                }

                const rawText = await capacitorReadText(entry.path, {
                    directory: entry.directory,
                    maxBytes: budget.maxDocumentBytes
                });
                const documentBytes = measureUtf8Bytes(rawText);
                if (documentBytes > budget.maxDocumentBytes) {
                    throw new Error(
                        `Capacitor local build document exceeds ${budget.maxDocumentBytes} bytes. ` +
                        'Please split the note or build on desktop.'
                    );
                }
                totalBytes += documentBytes;
                if (totalBytes > budget.maxTotalInputBytes) {
                    throw new Error(
                        `Capacitor local build payload exceeds ${budget.maxTotalInputBytes} bytes. ` +
                        'Please build on desktop for large datasets.'
                    );
                }

                const filename = stripMarkdownExtension(entry.name);
                if (!filename) {
                    continue;
                }

                const metadata = parseCapacitorFrontmatter(rawText);
                const relativePath = entry.path;
                const segments = relativePath.split('/').filter(Boolean);
                const clusterId = segments.length > 1 ? segments[segments.length - 2] : 'root';
                const identity = await createMobileResourceIdentity(relativePath, filename, rawText);

                files.push({
                    id: filename,
                    canonicalId: identity.canonicalId || canonicalMobileNodeIdFromIdentity(identity),
                    label: filename,
                    path: relativePath,
                    sourceUri: identity.sourceUri,
                    revision: identity.revision,
                    identityAliases: identity.identityAliases,
                    content: rawText,
                    metadata,
                    clusterId
                });

            }
        }

        return files;
    }

    function buildCapacitorGraphData(files) {
        const nodeMap = new Map();
        const edgeMap = new Map();
        const sourceFiles = Array.isArray(files) ? files.filter((file) => file && file.id) : [];
        const referenceIndex = buildCapacitorReferenceIndex(sourceFiles);

        const addEdge = (source, target, type) => {
            if (!source || !target || source === target) {
                return;
            }
            if (!nodeMap.has(source) || !nodeMap.has(target)) {
                return;
            }
            const edgeType = type || 'association';
            const key = `${source}->${target}:${edgeType}`;
            if (edgeMap.has(key)) {
                return;
            }
            const sourceNode = nodeMap.get(source);
            const targetNode = nodeMap.get(target);
            edgeMap.set(key, {
                source,
                target,
                type: edgeType,
                kind: 'explicit',
                provenance: edgeType,
                sourceUri: sourceNode && sourceNode.sourceUri ? sourceNode.sourceUri : '',
                targetUri: targetNode && targetNode.sourceUri ? targetNode.sourceUri : '',
                weight: 1
            });
        };

        sourceFiles.forEach((file) => {
            if (!file || !file.id) {
                return;
            }
            if (nodeMap.has(file.id)) {
                throw new Error(`Capacitor graph contains duplicate legacy node id: ${file.id}`);
            }
            nodeMap.set(file.id, {
                id: file.id,
                canonicalId: file.canonicalId || file.__canonicalId || '',
                label: file.label || file.id,
                sourceUri: file.sourceUri || '',
                revision: file.revision || '',
                identityAliases: Array.isArray(file.identityAliases) ? file.identityAliases : [],
                inDegree: 0,
                outDegree: 0,
                metadata: {
                    filepath: file.path,
                    tags: Array.isArray(file.metadata && file.metadata.tags) ? file.metadata.tags : [],
                    prerequisites: Array.isArray(file.metadata && file.metadata.prerequisites) ? file.metadata.prerequisites : [],
                    next: Array.isArray(file.metadata && file.metadata.next) ? file.metadata.next : []
                },
                clusterId: file.clusterId || 'root',
                centrality: 0,
                rank: 0
            });
        });

        sourceFiles.forEach((file) => {
            const sourceId = file.id;
            if (!nodeMap.has(sourceId)) {
                return;
            }

            const prerequisites = Array.isArray(file.metadata && file.metadata.prerequisites)
                ? file.metadata.prerequisites
                : [];
            prerequisites.forEach((rawPrereq) => {
                const prerequisiteFile = resolveCapacitorReference(file, rawPrereq, referenceIndex);
                addEdge(prerequisiteFile && prerequisiteFile.id, sourceId, 'explicit-prerequisite');
            });

            const nextItems = Array.isArray(file.metadata && file.metadata.next)
                ? file.metadata.next
                : [];
            nextItems.forEach((rawNext) => {
                const nextFile = resolveCapacitorReference(file, rawNext, referenceIndex);
                addEdge(sourceId, nextFile && nextFile.id, 'explicit-next');
            });

            extractWikiLinks(file.content).forEach((rawLink) => {
                const linkedFile = resolveCapacitorReference(file, rawLink, referenceIndex);
                addEdge(sourceId, linkedFile && linkedFile.id, 'wiki-link');
            });

            extractMarkdownLinks(file.content).forEach((rawLink) => {
                const linkedFile = resolveCapacitorReference(file, rawLink, referenceIndex);
                addEdge(sourceId, linkedFile && linkedFile.id, 'markdown-link');
            });
        });

        const edges = Array.from(edgeMap.values());
        const budget = getMobileRuntimeBudget();
        if (edges.length > budget.maxEdges) {
            throw new Error(
                `Capacitor graph edge count exceeds ${budget.maxEdges}. ` +
                'Please reduce links or build on desktop for large datasets.'
            );
        }
        edges.forEach((edge) => {
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);
            if (sourceNode) {
                sourceNode.outDegree = (sourceNode.outDegree || 0) + 1;
            }
            if (targetNode) {
                targetNode.inDegree = (targetNode.inDegree || 0) + 1;
            }
        });

        return {
            nodes: Array.from(nodeMap.values()),
            edges
        };
    }

    function getRuntimeUrlApi() {
        if (typeof window === 'undefined') {
            return null;
        }
        return window.URL || window.webkitURL || null;
    }

    function supportsCapacitorGraphBuildWorker() {
        const urlApi = getRuntimeUrlApi();
        return Boolean(
            typeof window !== 'undefined' &&
            typeof window.Worker === 'function' &&
            typeof window.Blob === 'function' &&
            urlApi &&
            typeof urlApi.createObjectURL === 'function' &&
            typeof urlApi.revokeObjectURL === 'function'
        );
    }

    function getCapacitorGraphBuildWorkerSource() {
        return [
            'self.onmessage = function(event) {',
            '  try {',
            '    var files = Array.isArray(event.data && event.data.files) ? event.data.files : [];',
            '    function stripMarkdownExtension(value) {',
            '      var normalized = String(value || "").trim()',
            "        .replace(/\\.(?:md|markdown)$/i, '')",
            "        .replace(/\\\\/g, '/')",
            '        .replace(/^knowledge_base\\//i, "")',
            '        .replace(/^\\/+/, "");',
            '      var parts = [];',
            '      normalized.split("/").forEach(function(part) {',
            '        if (!part || part === ".") return;',
            '        if (part === "..") { if (parts.length > 0) parts.pop(); return; }',
            '        parts.push(part);',
            '      });',
            '      return parts.join("/").normalize("NFC").toLowerCase();',
            '    }',
            '',
            '    function cleanReference(rawReference) {',
            '      var reference = String(rawReference || "").trim();',
            '      var wikiMatch = reference.match(/^\\[\\[(.*?)(?:\\|.*?)?\\]\\]$/);',
            '      if (wikiMatch) reference = String(wikiMatch[1] || "").trim();',
            '      reference = reference.replace(/^[\'\"]|[\'\"]$/g, "").split("#")[0].split("?")[0].trim();',
            '      if (!reference || /^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.charAt(0) === "/") return "";',
            '      try { return decodeURIComponent(reference); } catch (_error) { return ""; }',
            '    }',
            '',
            '    function canonicalIdFromSourceUri(file) {',
            '      var sourceUri = String(file && file.sourceUri || "");',
            '      var prefix = "note://workspace/v1/";',
            '      if (!sourceUri.startsWith(prefix)) return "";',
            '      try { return stripMarkdownExtension(decodeURIComponent(sourceUri.slice(prefix.length))); }',
            '      catch (_error) { return ""; }',
            '    }',
            '',
            '    function resolveReferencePath(sourceCanonicalId, rawReference) {',
            '      var reference = cleanReference(rawReference);',
            '      if (!reference) return null;',
            '      var direct = stripMarkdownExtension(reference);',
            '      var sourceSegments = stripMarkdownExtension(sourceCanonicalId).split("/").filter(Boolean);',
            '      sourceSegments.pop();',
            '      var relative = stripMarkdownExtension(sourceSegments.concat([reference]).join("/"));',
            '      return { direct: direct, relative: relative };',
            '    }',
            '',
            '    function buildReferenceIndex(files) {',
            '      var byCanonicalId = new Map();',
            '      var byLegacyId = new Map();',
            '      var byUniqueStem = new Map();',
            '      files.forEach(function(file) {',
            '        var canonicalId = stripMarkdownExtension(file.canonicalId || canonicalIdFromSourceUri(file) || file.path || file.id);',
            '        var legacyKey = String(file.id || "").normalize("NFC").toLowerCase();',
            '        if (!file.id || !canonicalId) return;',
            '        if (byLegacyId.has(legacyKey)) throw new Error("Capacitor graph contains an ambiguous legacy basename: " + file.id);',
            '        if (byCanonicalId.has(canonicalId)) throw new Error("Capacitor graph contains duplicate canonical node id: " + canonicalId);',
            '        file.__canonicalId = canonicalId;',
            '        byLegacyId.set(legacyKey, file);',
            '        byCanonicalId.set(canonicalId, file);',
            '        var stem = canonicalId.split("/").pop() || canonicalId;',
            '        var candidates = byUniqueStem.get(stem) || [];',
            '        candidates.push(file);',
            '        byUniqueStem.set(stem, candidates);',
            '      });',
            '      return { byCanonicalId: byCanonicalId, byUniqueStem: byUniqueStem };',
            '    }',
            '',
            '    function resolveReference(sourceFile, rawReference, index) {',
            '      var paths = resolveReferencePath(sourceFile.__canonicalId, rawReference);',
            '      if (!paths) return null;',
            '      var direct = index.byCanonicalId.get(paths.direct);',
            '      if (direct) return direct;',
            '      var relative = index.byCanonicalId.get(paths.relative);',
            '      if (relative) return relative;',
            '      var stem = paths.direct.split("/").pop() || paths.direct;',
            '      var candidates = index.byUniqueStem.get(stem) || [];',
            '      return candidates.length === 1 ? candidates[0] : null;',
            '    }',
            '',
            '    function extractWikiLinks(content) {',
            '      var links = new Set();',
            '      var regex = /\\[\\[(.*?)(?:\\|.*?)?\\]\\]/g;',
            "      var text = String(content || '');",
            '      var match;',
            '      while ((match = regex.exec(text)) !== null) {',
            '        var linked = String(match[1] || "").trim();',
            '        if (linked) {',
            '          links.add(linked);',
            '        }',
            '      }',
            '      return Array.from(links);',
            '    }',
            '',
            '    function extractMarkdownLinks(content) {',
            '      var links = new Set();',
            '      var regex = /\\]\\(([^)]+)\\)/g;',
            "      var text = String(content || '');",
            '      var match;',
            '      while ((match = regex.exec(text)) !== null) {',
            "        var linked = String(match[1] || '').trim();",
            '        if (linked) {',
            '          links.add(linked);',
            '        }',
            '      }',
            '      return Array.from(links);',
            '    }',
            '',
            '    var nodeMap = new Map();',
            '    var edgeMap = new Map();',
            '    var referenceIndex = buildReferenceIndex(files);',
            '',
            '    function addEdge(source, target, type) {',
            '      if (!source || !target || source === target) {',
            '        return;',
            '      }',
            '      if (!nodeMap.has(source) || !nodeMap.has(target)) {',
            '        return;',
            '      }',
            '      var edgeType = type || "association";',
            '      var key = source + "->" + target + ":" + edgeType;',
            '      if (edgeMap.has(key)) {',
            '        return;',
            '      }',
            '      var sourceNode = nodeMap.get(source);',
            '      var targetNode = nodeMap.get(target);',
            '      edgeMap.set(key, {',
            '        source: source,',
            '        target: target,',
            '        type: edgeType,',
            '        kind: "explicit",',
            '        provenance: edgeType,',
            '        sourceUri: sourceNode && sourceNode.sourceUri ? sourceNode.sourceUri : "",',
            '        targetUri: targetNode && targetNode.sourceUri ? targetNode.sourceUri : "",',
            '        weight: 1',
            '      });',
            '    }',
            '',
            '    files.forEach(function(file) {',
            '      if (!file || !file.id) {',
            '        return;',
            '      }',
            '      if (nodeMap.has(file.id)) {',
            '        throw new Error("Capacitor graph contains duplicate legacy node id: " + file.id);',
            '      }',
            '      var metadata = file.metadata || {};',
            '      nodeMap.set(file.id, {',
            '        id: file.id,',
            '        canonicalId: file.canonicalId || file.__canonicalId || "",',
            '        label: file.label || file.id,',
            '        sourceUri: file.sourceUri || "",',
            '        revision: file.revision || "",',
            '        identityAliases: Array.isArray(file.identityAliases) ? file.identityAliases : [],',
            '        inDegree: 0,',
            '        outDegree: 0,',
            '        metadata: {',
            '          filepath: file.path,',
            '          tags: Array.isArray(metadata.tags) ? metadata.tags : [],',
            '          prerequisites: Array.isArray(metadata.prerequisites) ? metadata.prerequisites : [],',
            '          next: Array.isArray(metadata.next) ? metadata.next : []',
            '        },',
            "        clusterId: file.clusterId || 'root',",
            '        centrality: 0,',
            '        rank: 0',
            '      });',
            '    });',
            '',
            '    files.forEach(function(file) {',
            '      var sourceId = file && file.id;',
            '      if (!sourceId || !nodeMap.has(sourceId)) {',
            '        return;',
            '      }',
            '      var metadata = file.metadata || {};',
            '      var prerequisites = Array.isArray(metadata.prerequisites) ? metadata.prerequisites : [];',
            '      prerequisites.forEach(function(rawPrereq) {',
            '        var prerequisiteFile = resolveReference(file, rawPrereq, referenceIndex);',
            '        addEdge(prerequisiteFile && prerequisiteFile.id, sourceId, "explicit-prerequisite");',
            '      });',
            '',
            '      var nextItems = Array.isArray(metadata.next) ? metadata.next : [];',
            '      nextItems.forEach(function(rawNext) {',
            '        var nextFile = resolveReference(file, rawNext, referenceIndex);',
            '        addEdge(sourceId, nextFile && nextFile.id, "explicit-next");',
            '      });',
            '',
            '      extractWikiLinks(file.content).forEach(function(rawLink) {',
            '        var linkedFile = resolveReference(file, rawLink, referenceIndex);',
            '        addEdge(sourceId, linkedFile && linkedFile.id, "wiki-link");',
            '      });',
            '',
            '      extractMarkdownLinks(file.content).forEach(function(rawLink) {',
            '        var linkedFile = resolveReference(file, rawLink, referenceIndex);',
            '        addEdge(sourceId, linkedFile && linkedFile.id, "markdown-link");',
            '      });',
            '    });',
            '',
            '    var edges = Array.from(edgeMap.values());',
            '    edges.forEach(function(edge) {',
            '      var sourceNode = nodeMap.get(edge.source);',
            '      var targetNode = nodeMap.get(edge.target);',
            '      if (sourceNode) {',
            '        sourceNode.outDegree = (sourceNode.outDegree || 0) + 1;',
            '      }',
            '      if (targetNode) {',
            '        targetNode.inDegree = (targetNode.inDegree || 0) + 1;',
            '      }',
            '    });',
            '',
            '    self.postMessage({',
            '      ok: true,',
            '      graphData: {',
            '        nodes: Array.from(nodeMap.values()),',
            '        edges: edges',
            '      }',
            '    });',
            '  } catch (err) {',
            '    self.postMessage({',
            '      ok: false,',
            '      error: err && err.message ? String(err.message) : String(err)',
            '    });',
            '  }',
            '};'
        ].join('\n');
    }

    function validateCapacitorGraphDataPayload(graphData) {
        return Boolean(
            graphData &&
            typeof graphData === 'object' &&
            Array.isArray(graphData.nodes) &&
            Array.isArray(graphData.edges)
        );
    }

    function* createCapacitorGraphDataJsonChunks(graphData) {
        const payload = graphData && typeof graphData === 'object' ? graphData : {};
        const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
        const edges = Array.isArray(payload.edges) ? payload.edges : [];
        const extraKeys = Object.keys(payload).filter((key) => key !== 'nodes' && key !== 'edges');

        yield '{"nodes":[';
        for (let index = 0; index < nodes.length; index += 1) {
            if (index > 0) {
                yield ',';
            }
            yield JSON.stringify(nodes[index] ?? null);
        }

        yield '],"edges":[';
        for (let index = 0; index < edges.length; index += 1) {
            if (index > 0) {
                yield ',';
            }
            yield JSON.stringify(edges[index] ?? null);
        }
        yield ']';

        for (const key of extraKeys) {
            yield `,${JSON.stringify(key)}:${JSON.stringify(payload[key] ?? null)}`;
        }
        yield '}';
    }

    function createCapacitorGraphJsonChunkFactory(graphData) {
        return function* graphJsonFactory() {
            yield* createCapacitorGraphDataJsonChunks(graphData);
        };
    }

    function createCapacitorGraphJavascriptChunkFactory(graphData) {
        return function* graphJavascriptFactory() {
            yield 'const graphData = ';
            yield* createCapacitorGraphDataJsonChunks(graphData);
            yield ';';
        };
    }

    async function runCapacitorGraphBuildWorker(files) {
        if (!supportsCapacitorGraphBuildWorker()) {
            throw new Error('Capacitor graph build worker is unavailable in this runtime.');
        }

        const urlApi = getRuntimeUrlApi();
        if (!urlApi) {
            throw new Error('URL API is unavailable for Capacitor graph build worker.');
        }

        return await new Promise((resolve, reject) => {
            let worker = null;
            let workerUrl = '';
            let timeoutId = null;
            let settled = false;

            const cleanup = () => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (worker) {
                    try {
                        worker.terminate();
                    } catch (_terminateErr) {
                        // Ignore cleanup errors.
                    }
                    worker = null;
                }
                if (workerUrl) {
                    try {
                        urlApi.revokeObjectURL(workerUrl);
                    } catch (_revokeErr) {
                        // Ignore cleanup errors.
                    }
                    workerUrl = '';
                }
            };

            const settle = (handler, value) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                handler(value);
            };

            try {
                const source = getCapacitorGraphBuildWorkerSource();
                const blob = new window.Blob([source], { type: 'application/javascript' });
                workerUrl = urlApi.createObjectURL(blob);
                worker = new window.Worker(workerUrl);
            } catch (createErr) {
                settle(reject, createErr);
                return;
            }

            timeoutId = setTimeout(() => {
                settle(reject, new Error(
                    `Capacitor worker build timed out after ${CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS}ms.`
                ));
            }, CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS);

            worker.onmessage = (event) => {
                const payload = event && event.data ? event.data : {};
                if (!payload || payload.ok !== true) {
                    const reason = payload && payload.error ? String(payload.error) : 'Unknown worker failure.';
                    settle(reject, new Error(reason));
                    return;
                }
                settle(resolve, payload.graphData);
            };

            worker.onerror = (event) => {
                const reason = event && event.message ? event.message : 'Unknown worker runtime error.';
                settle(reject, new Error(reason));
            };

            try {
                worker.postMessage({ files: Array.isArray(files) ? files : [] });
            } catch (postErr) {
                settle(reject, postErr);
            }
        });
    }

    async function buildCapacitorGraphDataWithWorkerFallback(files) {
        const budget = getMobileRuntimeBudget();
        const validateGraphBudget = (graphData) => {
            if (!graphData || !Array.isArray(graphData.nodes) || !Array.isArray(graphData.edges)) {
                throw new Error('Capacitor graph payload is invalid.');
            }
            if (graphData.nodes.length > budget.maxDocuments) {
                throw new Error(`Capacitor graph node count exceeds ${budget.maxDocuments}.`);
            }
            if (graphData.edges.length > budget.maxEdges) {
                throw new Error(`Capacitor graph edge count exceeds ${budget.maxEdges}.`);
            }
            return graphData;
        };
        if (!supportsCapacitorGraphBuildWorker()) {
            return {
                graphData: validateGraphBudget(buildCapacitorGraphData(files)),
                buildMode: 'single-thread'
            };
        }

        try {
            const workerGraph = await runCapacitorGraphBuildWorker(files);
            if (!validateCapacitorGraphDataPayload(workerGraph)) {
                throw new Error('Capacitor worker returned invalid graph payload.');
            }
            return {
                graphData: validateGraphBudget(workerGraph),
                buildMode: 'worker'
            };
        } catch (workerErr) {
            const warning = workerErr && workerErr.message ? String(workerErr.message) : String(workerErr);
            console.warn(
                '[StorageProvider] Worker-based Capacitor graph build failed. Falling back to single-thread mode.',
                workerErr
            );
            return {
                graphData: validateGraphBudget(buildCapacitorGraphData(files)),
                buildMode: 'single-thread-fallback',
                warning
            };
        }
    }

    function resolveCapacitorBuildModeDetail(buildMode, runtimeCaps) {
        const supportsMobileWasmCompute = Boolean(
            runtimeCaps &&
            runtimeCaps.supports_mobile_wasm_compute === true
        );
        const mobileWasmReason = runtimeCaps && typeof runtimeCaps.mobile_wasm_reason === 'string'
            ? runtimeCaps.mobile_wasm_reason
            : 'runtime-unreported';

        if (buildMode === 'worker') {
            return supportsMobileWasmCompute
                ? 'worker-wasm-ready'
                : `worker-wasm-not-ready:${mobileWasmReason}`;
        }

        if (buildMode === 'single-thread') {
            return `single-thread-worker-unavailable:${mobileWasmReason}`;
        }

        if (buildMode === 'single-thread-fallback') {
            return `single-thread-worker-fallback:${mobileWasmReason}`;
        }

        return `unknown-mode:${mobileWasmReason}`;
    }

    async function capacitorBuildGraph(requestPayload, runtimeCaps) {
        const payload = requestPayload || {};
        const rawTarget = String(payload.target || 'ALL_FOLDERS').trim() || 'ALL_FOLDERS';
        const targetPath = rawTarget === 'ALL_FOLDERS'
            ? 'Knowledge_Base'
            : normalizeCapacitorPath(`Knowledge_Base/${rawTarget}`);

        const files = await collectCapacitorMarkdownFiles(targetPath);
        const buildResult = await buildCapacitorGraphDataWithWorkerFallback(files);
        const projectionApi = window.NoteConnectionKnowledgeProjection;
        if (!projectionApi || typeof projectionApi.createKnowledgeProjection !== 'function') {
            throw new Error('Knowledge projection contract is unavailable in the mobile runtime.');
        }
        const graphData = projectionApi.createKnowledgeProjection(buildResult.graphData, {
            workspaceId: 'mobile-workspace',
        });
        const projectionMaxBytes = getMobileRuntimeBudget().maxProjectionBytes;
        const graphSerializationMaxBytes = Math.min(
            CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES,
            projectionMaxBytes
        );
        const graphJsChunkFactory = createCapacitorGraphJavascriptChunkFactory(graphData);
        const graphJsonChunkFactory = createCapacitorGraphJsonChunkFactory(graphData);

        await capacitorWriteChunkSequence('data.js', graphJsChunkFactory, {
            maxPayloadBytes: graphSerializationMaxBytes,
            payloadLabel: 'data.js graph payload'
        });
        await capacitorWriteChunkSequence('graph_data.json', graphJsonChunkFactory, {
            maxPayloadBytes: graphSerializationMaxBytes,
            payloadLabel: 'graph_data.json graph payload'
        });

        if (rawTarget !== 'ALL_FOLDERS') {
            const targetName = sanitizeTargetName(rawTarget);
            if (targetName) {
                await capacitorWriteChunkSequence(`data_${targetName}.js`, graphJsChunkFactory, {
                    maxPayloadBytes: graphSerializationMaxBytes,
                    payloadLabel: `data_${targetName}.js graph payload`
                });
                await capacitorWriteChunkSequence(`graph_data_${targetName}.json`, graphJsonChunkFactory, {
                    maxPayloadBytes: graphSerializationMaxBytes,
                    payloadLabel: `graph_data_${targetName}.json graph payload`
                });
            }
        }

        return {
            success: true,
            stats: {
                target: rawTarget,
                fileCount: files.length,
                nodeCount: graphData.nodes.length,
                edgeCount: graphData.edges.length,
                buildMode: buildResult.buildMode,
                buildModeDetail: resolveCapacitorBuildModeDetail(buildResult.buildMode, runtimeCaps || {}),
                serializationMode: 'chunked-bridge-json-stream',
                supportsMobileWasmCompute: Boolean(runtimeCaps && runtimeCaps.supports_mobile_wasm_compute === true),
                mobileWasmReason: runtimeCaps && typeof runtimeCaps.mobile_wasm_reason === 'string'
                    ? runtimeCaps.mobile_wasm_reason
                    : 'runtime-unreported'
            },
            warning: buildResult.warning || ''
        };
    }

    function ensureRuntimeBridge() {
        const bridge = getRuntimeBridge();
        if (!bridge || typeof bridge.buildUrl !== 'function' || typeof bridge.buildFetchOptions !== 'function') {
            throw new Error('Runtime bridge is unavailable for sidecar transport.');
        }
        return bridge;
    }

    async function sidecarFetchJson(resourcePath, init, query) {
        const bridge = ensureRuntimeBridge();
        const url = bridge.buildUrl(resourcePath, query || undefined);
        const response = await fetch(url, bridge.buildFetchOptions(init || {}));
        if (!response.ok) {
            let detail = `HTTP ${response.status}`;
            try {
                const payload = await response.json();
                if (payload && payload.error) {
                    detail = String(payload.error);
                }
            } catch (_parseErr) {
                // Keep default status detail.
            }
            throw new Error(`Sidecar request failed for ${resourcePath}: ${detail}`);
        }
        return await response.json();
    }

    async function sidecarFetchText(resourcePath, query) {
        const bridge = ensureRuntimeBridge();
        const url = bridge.buildUrl(resourcePath, query || undefined);
        const response = await fetch(url, bridge.buildFetchOptions({}));
        if (!response.ok) {
            throw new Error(`Sidecar request failed for ${resourcePath}: HTTP ${response.status}`);
        }
        return await response.text();
    }

    function unsupportedOperationError(operation) {
        return new Error(`Storage provider operation is unsupported in this runtime: ${operation}`);
    }

    function normalizeStorageProviderKind(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'sqlite' || normalized === 'embedded' || normalized === 'embedded-sqlite' || normalized === 'embedded_sqlite') {
            return 'sqlite';
        }
        if (normalized === 'file' || normalized === 'local-file' || normalized === 'snapshot') {
            return 'file';
        }
        if (normalized === 'projection' || normalized === 'mobile_projection' || normalized === 'mobile-slim') {
            return 'projection';
        }
        if (normalized === 'remote' || normalized === 'http' || normalized === 'external_http' || normalized === 'remote-http' || normalized === 'service') {
            return 'remote';
        }
        return null;
    }

    function formatCapacitorMtime(statObject) {
        if (!statObject || typeof statObject !== 'object') {
            return '';
        }
        const raw = statObject.mtime || statObject.modificationTime || statObject.modifiedAt || '';
        if (!raw) {
            return '';
        }
        try {
            return new Date(raw).toLocaleString();
        } catch (_err) {
            return String(raw);
        }
    }

    function resolveCapacitorSize(statObject, fallbackText) {
        if (statObject && typeof statObject.size === 'number' && Number.isFinite(statObject.size)) {
            return statObject.size;
        }
        return String(fallbackText || '').length;
    }

    class RuntimeStorageProvider {
        constructor(runtimeCaps) {
            this.runtimeCaps = runtimeCaps || {};
            this.mobileExactIndexPromise = null;
        }

        getStorageResolution() {
            const runtimePlatform = String(this.runtimeCaps.platform || '').trim().toLowerCase();
            const mobileRuntime = isCapacitorNativeRuntime()
                || runtimePlatform.includes('android')
                || runtimePlatform.includes('ios')
                || runtimePlatform === 'mobile';
            const requestedProvider = normalizeStorageProviderKind(
                this.runtimeCaps.storage_requested_provider
            ) || (mobileRuntime ? 'projection' : 'sqlite');
            const reportedProvider = normalizeStorageProviderKind(this.runtimeCaps.storage_resolved_provider);
            const resolvedProvider = mobileRuntime
                ? 'projection'
                : reportedProvider || undefined;
            const fallbackReason = String(
                this.runtimeCaps.storage_fallback_reason
                || (mobileRuntime && requestedProvider === 'sqlite' ? 'native_sqlite_runtime_unavailable' : '')
            ).trim();
            return Object.freeze({
                requestedProvider,
                resolvedProvider,
                fallbackReason: fallbackReason || undefined,
                supportsSqlite: !mobileRuntime && resolvedProvider === 'sqlite',
                supportsProjection: this.runtimeCaps.supports_projection_store !== false
                    && resolvedProvider === 'projection',
            });
        }

        async refreshStorageResolution() {
            const current = this.getStorageResolution();
            if (isCapacitorNativeRuntime() || !this._supportsSidecar()) {
                return current;
            }
            try {
                const payload = await sidecarFetchJson('api/knowledge/store-diagnostics');
                const store = payload && payload.store && typeof payload.store === 'object'
                    ? payload.store
                    : null;
                const resolvedProvider = normalizeStorageProviderKind(
                    store && (store.resolvedProvider || store.storageEngine || store.provider)
                );
                if (resolvedProvider) {
                    this.runtimeCaps = {
                        ...this.runtimeCaps,
                        storage_requested_provider: normalizeStorageProviderKind(
                            store.requestedProvider
                        ) || current.requestedProvider,
                        storage_resolved_provider: resolvedProvider,
                        storage_fallback_reason: String(store.fallbackReason || '').trim(),
                        supports_sqlite: resolvedProvider === 'sqlite',
                    };
                }
            } catch (_error) {
                // Capability probing is advisory; the normal storage operation
                // still owns the authoritative failure/fallback behavior.
            }
            return this.getStorageResolution();
        }

        _supportsSidecar() {
            return this.runtimeCaps.supports_sidecar === true;
        }

        _supportsBuild() {
            if (isCapacitorNativeRuntime()) {
                const filesystem = getCapacitorFilesystemPlugin();
                return Boolean(
                    filesystem &&
                    typeof filesystem.readdir === 'function' &&
                    typeof filesystem.readFile === 'function' &&
                    typeof filesystem.writeFile === 'function'
                );
            }
            return this.runtimeCaps.supports_build !== false;
        }

        _supportsContentApi() {
            return this.runtimeCaps.supports_content_api !== false;
        }

        _invoke(command, args) {
            const invoke = getTauriInvoke();
            if (!invoke) {
                throw unsupportedOperationError(`tauri:${command}`);
            }
            return invoke(command, args || {});
        }

        async getKbPath() {
            if (this._supportsSidecar()) {
                try {
                    const payload = await sidecarFetchJson('api/kb-path');
                    return String(payload && payload.kbPath ? payload.kbPath : '');
                } catch (err) {
                    if (!getTauriInvoke()) {
                        throw err;
                    }
                }
            }
            if (getTauriInvoke()) {
                return await this._invoke('get_kb_path');
            }
            if (isCapacitorNativeRuntime()) {
                return 'Knowledge_Base';
            }
            const payload = await sidecarFetchJson('api/kb-path');
            return String(payload && payload.kbPath ? payload.kbPath : '');
        }

        async listFolders() {
            if (this._supportsSidecar()) {
                try {
                    const payload = await sidecarFetchJson('api/folders');
                    return Array.isArray(payload && payload.folders) ? payload.folders : [];
                } catch (err) {
                    if (!getTauriInvoke()) {
                        throw err;
                    }
                }
            }
            if (getTauriInvoke()) {
                return await this._invoke('get_folders');
            }
            if (isCapacitorNativeRuntime()) {
                const entries = await capacitorReadDirectory('Knowledge_Base');
                return entries.filter((entry) => !entry.startsWith('.'));
            }
            const payload = await sidecarFetchJson('api/folders');
            return Array.isArray(payload && payload.folders) ? payload.folders : [];
        }

        async listAvailableTargets() {
            if (this._supportsSidecar()) {
                try {
                    const payload = await sidecarFetchJson('api/available-targets');
                    return Array.isArray(payload && payload.targets) ? payload.targets : [];
                } catch (err) {
                    if (!getTauriInvoke()) {
                        throw err;
                    }
                }
            }
            if (getTauriInvoke()) {
                return await this._invoke('get_available_targets');
            }
            if (isCapacitorNativeRuntime()) {
                const folders = await this.listFolders();
                const assets = await capacitorReadDirectory('');
                const cachedTargets = assets
                    .filter((name) => /^data_.+\.js$/i.test(name))
                    .map((name) => name.replace(/^data_/i, '').replace(/\.js$/i, ''));
                return Array.from(new Set([...(folders || []), ...cachedTargets])).sort();
            }
            const payload = await sidecarFetchJson('api/available-targets');
            return Array.isArray(payload && payload.targets) ? payload.targets : [];
        }

        async checkCache(target) {
            if (!target) {
                return null;
            }
            if (this._supportsSidecar()) {
                try {
                    return await sidecarFetchJson('api/check-cache', null, { target });
                } catch (err) {
                    if (!getTauriInvoke()) {
                        throw err;
                    }
                }
            }
            if (getTauriInvoke()) {
                return await this._invoke('check_cache', { target });
            }
            if (isCapacitorNativeRuntime()) {
                if (target === 'ALL_FOLDERS') {
                    const activeText = await capacitorReadTextIfExists('data.js');
                    if (!activeText) {
                        return null;
                    }
                    const activeStat = await capacitorStat('data.js');
                    const statObject = activeStat && activeStat.stat ? activeStat.stat : null;
                    return {
                        date: formatCapacitorMtime(statObject),
                        size: resolveCapacitorSize(statObject, activeText),
                        source: 'active'
                    };
                }

                const targetName = sanitizeTargetName(target);
                if (!targetName) {
                    return null;
                }
                const cacheAssetName = `data_${targetName}.js`;
                const cacheText = await capacitorReadTextIfExists(cacheAssetName);
                if (!cacheText) {
                    return null;
                }
                const cacheStat = await capacitorStat(cacheAssetName);
                const statObject = cacheStat && cacheStat.stat ? cacheStat.stat : null;
                return {
                    date: formatCapacitorMtime(statObject),
                    size: resolveCapacitorSize(statObject, cacheText)
                };
            }
            return await sidecarFetchJson('api/check-cache', null, { target });
        }

        async restoreCache(target) {
            if (!target) {
                return false;
            }
            if (this._supportsSidecar()) {
                try {
                    const payload = await sidecarFetchJson('api/restore-cache', null, { target });
                    return Boolean(payload && payload.success);
                } catch (err) {
                    if (!getTauriInvoke()) {
                        throw err;
                    }
                }
            }
            if (getTauriInvoke()) {
                return Boolean(await this._invoke('restore_cache', { target }));
            }
            if (isCapacitorNativeRuntime()) {
                if (target === 'ALL_FOLDERS') {
                    return Boolean(await capacitorReadTextIfExists('data.js'));
                }

                const targetName = sanitizeTargetName(target);
                if (!targetName) {
                    return false;
                }

                const cacheJs = await capacitorReadTextIfExists(`data_${targetName}.js`);
                if (!cacheJs) {
                    return false;
                }

                await capacitorWriteText('data.js', cacheJs);

                const cacheJson = await capacitorReadTextIfExists(`graph_data_${targetName}.json`);
                if (cacheJson) {
                    await capacitorWriteText('graph_data.json', cacheJson);
                }
                return true;
            }
            const payload = await sidecarFetchJson('api/restore-cache', null, { target });
            return Boolean(payload && payload.success);
        }

        async buildGraph(requestPayload) {
            if (!this._supportsBuild()) {
                throw unsupportedOperationError('buildGraph');
            }

            if (this._supportsSidecar()) {
                try {
                    const payload = await sidecarFetchJson('api/build', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestPayload || {})
                    });
                    return {
                        success: payload && payload.success !== false,
                        error: payload && payload.error ? String(payload.error) : ''
                    };
                } catch (err) {
                    if (!getTauriInvoke()) {
                        throw err;
                    }
                }
            }

            if (getTauriInvoke()) {
                const result = await this._invoke('build_graph_runtime', { request: requestPayload || {} });
                return {
                    success: Boolean(result && result.success !== false),
                    error: result && result.error ? String(result.error) : ''
                };
            }

            if (isCapacitorNativeRuntime()) {
                const result = await capacitorBuildGraph(requestPayload || {}, this.runtimeCaps || {});
                return {
                    success: Boolean(result && result.success),
                    error: result && result.error ? String(result.error) : '',
                    stats: result && result.stats ? result.stats : null,
                    warning: result && result.warning ? String(result.warning) : ''
                };
            }

            throw unsupportedOperationError('buildGraph');
        }

        async _loadMobileExactIndex() {
            if (this.mobileExactIndexPromise) {
                return await this.mobileExactIndexPromise;
            }

            this.mobileExactIndexPromise = (async () => {
                const analyzer = window.NoteConnectionMobileExactAnalyzer;
                if (!analyzer || typeof analyzer.createMobileExactIndex !== 'function') {
                    throw unsupportedOperationError('mobileExactAnalysis');
                }
                const storeApi = window.NoteConnectionKnowledgeProjectionStore;
                if (!storeApi || typeof storeApi.createProjectionStore !== 'function') {
                    throw unsupportedOperationError('projectionStore');
                }
                const projectionStore = typeof storeApi.createFileProjectionStore === 'function'
                    ? storeApi.createFileProjectionStore({
                        fileName: 'graph_data.json',
                        maxBytes: getMobileRuntimeBudget().maxProjectionBytes,
                        readFile: async (filename) => await this.readGeneratedAsset(filename),
                    })
                    : storeApi.createProjectionStore({
                        maxBytes: getMobileRuntimeBudget().maxProjectionBytes,
                        read: async () => await this.readGeneratedAsset('graph_data.json'),
                    });
                const graph = await projectionStore.load();
                return analyzer.createMobileExactIndex(graph);
            })();

            try {
                return await this.mobileExactIndexPromise;
            } catch (error) {
                this.mobileExactIndexPromise = null;
                throw error;
            }
        }

        async queryKnowledgeBaseExact(request) {
            const payload = request && typeof request === 'object' ? request : {};
            const query = typeof payload.query === 'string' ? payload.query.trim() : '';
            if (!query) {
                throw new Error('Local exact query requires a non-empty query.');
            }
            const index = await this._loadMobileExactIndex();
            const matches = index.searchExact(query, payload.maxMatches);
            return {
                query,
                matches: matches.map((node) => ({
                    ...node,
                    neighbors: index.neighbors(
                        node.id,
                        payload.maxNeighborsPerMatch,
                        payload.edgeKinds
                    ),
                    learningRoute: typeof index.learningRoute === 'function'
                        ? index.learningRoute(node.id, 6)
                        : []
                })),
                statistics: index.statistics({ includeProvenance: true }),
                execution: 'local-exact',
                remoteInferenceUsed: false
            };
        }

        async findKnowledgePath(request) {
            const payload = request && typeof request === 'object' ? request : {};
            const sourceNodeId = typeof payload.sourceNodeId === 'string'
                ? payload.sourceNodeId.trim()
                : '';
            const targetNodeId = typeof payload.targetNodeId === 'string'
                ? payload.targetNodeId.trim()
                : '';
            if (!sourceNodeId || !targetNodeId) {
                throw new Error('Local knowledge path requires sourceNodeId and targetNodeId.');
            }
            const index = await this._loadMobileExactIndex();
            return {
                sourceNodeId,
                targetNodeId,
                path: index.shortestPath(
                    sourceNodeId,
                    targetNodeId,
                    payload.maxDepth,
                    payload.maxVisitedNodes
                ),
                execution: 'local-exact',
                remoteInferenceUsed: false
            };
        }

        async readContent(filePath) {
            if (!this._supportsContentApi()) {
                throw unsupportedOperationError('readContent');
            }

            if (isCapacitorNativeRuntime()) {
                const capacitorPath = resolveCapacitorContentCandidatePath(filePath);
                return await capacitorReadText(capacitorPath, {
                    maxBytes: getMobileRuntimeBudget().maxDocumentBytes
                });
            }

            if (this._supportsSidecar()) {
                try {
                    const payload = await sidecarFetchJson('api/content', null, { path: filePath });
                    return String(payload && payload.content ? payload.content : '');
                } catch (err) {
                    if (!getTauriInvoke()) {
                        throw err;
                    }
                }
            }

            if (getTauriInvoke()) {
                return await this._invoke('read_node_content', { filePath });
            }

            const payload = await sidecarFetchJson('api/content', null, { path: filePath });
            return String(payload && payload.content ? payload.content : '');
        }

        async setKbPath(kbPath) {
            const normalized = String(kbPath || '').trim();
            if (!normalized) {
                throw new Error('Missing kbPath');
            }

            if (getTauriInvoke()) {
                try {
                    await this._invoke('set_kb_path', { kbPath: normalized });
                } catch (_err) {
                    // Continue and try sidecar sync as fallback.
                }
            }

            if (this._supportsSidecar()) {
                await sidecarFetchJson('api/kb-path', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kbPath: normalized })
                });
            }

            return normalized;
        }

        async readGeneratedAsset(filename) {
            const normalized = String(filename || '').trim();
            if (!normalized) {
                throw new Error('Missing filename');
            }

            if (getTauriInvoke()) {
                try {
                    return await this._invoke('read_generated_asset', { filename: normalized });
                } catch (_err) {
                    // Fall through to sidecar for web/desktop fallback.
                }
            }

            if (isCapacitorNativeRuntime()) {
                try {
                    // Prefer local runtime-generated assets first so on-device builds
                    // are picked up without requiring an app rebundle.
                    return await capacitorReadText(normalized, {
                        maxBytes: getMobileRuntimeBudget().maxProjectionBytes
                    });
                } catch (_fsErr) {
                    // Fall through to bundled asset fetch.
                }

                try {
                    const response = await fetch(`${normalized}?v=${Date.now()}`);
                    if (response.ok) {
                        return await response.text();
                    }
                    throw unsupportedOperationError(`readGeneratedAsset:${normalized}`);
                } catch (_fetchErr) {
                    throw unsupportedOperationError(`readGeneratedAsset:${normalized}`);
                }
            }

            return await sidecarFetchText(normalized, { v: Date.now() });
        }
    }

    function createProvider(options) {
        const runtimeCaps = options && options.runtimeCaps
            ? options.runtimeCaps
            : (window.__NC_RUNTIME_CAPS || {});
        return new RuntimeStorageProvider(runtimeCaps);
    }

    window.NoteConnectionStorage = {
        createProvider,
        measureUtf8Bytes
    };

    if (typeof module === 'object' && module.exports) {
        module.exports = {
            createProvider,
            buildCapacitorGraphData,
            getCapacitorGraphBuildWorkerSource,
            createMobileResourceIdentity,
            getMobileRuntimeBudget,
            measureUtf8Bytes,
        };
    }
}());
