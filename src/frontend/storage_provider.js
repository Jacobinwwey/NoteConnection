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
    const CAPACITOR_GRAPH_BUILD_MAX_FILES = 2000;
    const CAPACITOR_GRAPH_BUILD_MAX_BYTES = 16 * 1024 * 1024;
    const CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS = 20000;
    const CAPACITOR_BRIDGE_MAX_CHUNK_BYTES = 192 * 1024;
    const CAPACITOR_BRIDGE_MAX_TEXT_PAYLOAD_BYTES = 64 * 1024 * 1024;
    const CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES = 48 * 1024 * 1024;

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

    function extractWikiLinks(content) {
        const links = new Set();
        const regex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
        const text = String(content || '');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const linked = stripMarkdownExtension(match[1]);
            if (linked) {
                links.add(linked);
            }
        }
        return Array.from(links);
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
                const result = await filesystem.readFile(args);
                return decodeCapacitorTextPayload(result);
            } catch (err) {
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
        const queue = [normalizeCapacitorPath(targetPath, { allowCurrentDir: true })];
        const visited = new Set();
        const files = [];
        let totalBytes = 0;

        while (queue.length > 0) {
            const current = queue.shift();
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
                if (entry.isDirectory === true) {
                    queue.push(entry.path);
                    continue;
                }
                if (entry.isDirectory === null && !looksLikeMarkdown) {
                    queue.push(entry.path);
                    continue;
                }
                if (!looksLikeMarkdown) {
                    continue;
                }

                const rawText = await capacitorReadText(entry.path, { directory: entry.directory });
                totalBytes += rawText.length;
                if (totalBytes > CAPACITOR_GRAPH_BUILD_MAX_BYTES) {
                    throw new Error(
                        `Capacitor local build payload exceeds ${CAPACITOR_GRAPH_BUILD_MAX_BYTES} bytes. ` +
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

                files.push({
                    id: filename,
                    label: filename,
                    path: relativePath,
                    content: rawText,
                    metadata,
                    clusterId
                });

                if (files.length > CAPACITOR_GRAPH_BUILD_MAX_FILES) {
                    throw new Error(
                        `Capacitor local build file count exceeds ${CAPACITOR_GRAPH_BUILD_MAX_FILES}. ` +
                        'Please build on desktop for large datasets.'
                    );
                }
            }
        }

        return files;
    }

    function buildCapacitorGraphData(files) {
        const nodeMap = new Map();
        const edgeMap = new Map();

        const addEdge = (source, target, type) => {
            if (!source || !target || source === target) {
                return;
            }
            if (!nodeMap.has(source) || !nodeMap.has(target)) {
                return;
            }
            const key = `${source}->${target}`;
            if (edgeMap.has(key)) {
                return;
            }
            edgeMap.set(key, {
                source,
                target,
                type: type || 'association',
                weight: 1
            });
        };

        files.forEach((file) => {
            if (!file || !file.id || nodeMap.has(file.id)) {
                return;
            }
            nodeMap.set(file.id, {
                id: file.id,
                label: file.label || file.id,
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

        files.forEach((file) => {
            const sourceId = file.id;
            if (!nodeMap.has(sourceId)) {
                return;
            }

            const prerequisites = Array.isArray(file.metadata && file.metadata.prerequisites)
                ? file.metadata.prerequisites
                : [];
            prerequisites.forEach((rawPrereq) => {
                const prereqId = stripMarkdownExtension(rawPrereq);
                addEdge(prereqId, sourceId, 'explicit-prerequisite');
            });

            const nextItems = Array.isArray(file.metadata && file.metadata.next)
                ? file.metadata.next
                : [];
            nextItems.forEach((rawNext) => {
                const nextId = stripMarkdownExtension(rawNext);
                addEdge(sourceId, nextId, 'explicit-next');
            });

            extractWikiLinks(file.content).forEach((linkedId) => {
                addEdge(linkedId, sourceId, 'wiki-link');
            });
        });

        const edges = Array.from(edgeMap.values());
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
            "      return String(value || '')",
            '        .trim()',
            "        .replace(/\\.md$/i, '')",
            "        .replace(/\\\\/g, '/')",
            "        .split('/')",
            '        .filter(Boolean)',
            '        .pop() || "";',
            '    }',
            '',
            '    function extractWikiLinks(content) {',
            '      var links = new Set();',
            '      var regex = /\\[\\[(.*?)(?:\\|.*?)?\\]\\]/g;',
            "      var text = String(content || '');",
            '      var match;',
            '      while ((match = regex.exec(text)) !== null) {',
            '        var linked = stripMarkdownExtension(match[1]);',
            '        if (linked) {',
            '          links.add(linked);',
            '        }',
            '      }',
            '      return Array.from(links);',
            '    }',
            '',
            '    var nodeMap = new Map();',
            '    var edgeMap = new Map();',
            '',
            '    function addEdge(source, target, type) {',
            '      if (!source || !target || source === target) {',
            '        return;',
            '      }',
            '      if (!nodeMap.has(source) || !nodeMap.has(target)) {',
            '        return;',
            '      }',
            '      var key = source + "->" + target;',
            '      if (edgeMap.has(key)) {',
            '        return;',
            '      }',
            '      edgeMap.set(key, { source: source, target: target, type: type || "association", weight: 1 });',
            '    }',
            '',
            '    files.forEach(function(file) {',
            '      if (!file || !file.id || nodeMap.has(file.id)) {',
            '        return;',
            '      }',
            '      var metadata = file.metadata || {};',
            '      nodeMap.set(file.id, {',
            '        id: file.id,',
            '        label: file.label || file.id,',
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
            '        var prereqId = stripMarkdownExtension(rawPrereq);',
            '        addEdge(prereqId, sourceId, "explicit-prerequisite");',
            '      });',
            '',
            '      var nextItems = Array.isArray(metadata.next) ? metadata.next : [];',
            '      nextItems.forEach(function(rawNext) {',
            '        var nextId = stripMarkdownExtension(rawNext);',
            '        addEdge(sourceId, nextId, "explicit-next");',
            '      });',
            '',
            '      extractWikiLinks(file.content).forEach(function(linkedId) {',
            '        addEdge(linkedId, sourceId, "wiki-link");',
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
        if (!supportsCapacitorGraphBuildWorker()) {
            return {
                graphData: buildCapacitorGraphData(files),
                buildMode: 'single-thread'
            };
        }

        try {
            const workerGraph = await runCapacitorGraphBuildWorker(files);
            if (!validateCapacitorGraphDataPayload(workerGraph)) {
                throw new Error('Capacitor worker returned invalid graph payload.');
            }
            return {
                graphData: workerGraph,
                buildMode: 'worker'
            };
        } catch (workerErr) {
            const warning = workerErr && workerErr.message ? String(workerErr.message) : String(workerErr);
            console.warn(
                '[StorageProvider] Worker-based Capacitor graph build failed. Falling back to single-thread mode.',
                workerErr
            );
            return {
                graphData: buildCapacitorGraphData(files),
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
        const graphData = buildResult.graphData;
        const graphJsChunkFactory = createCapacitorGraphJavascriptChunkFactory(graphData);
        const graphJsonChunkFactory = createCapacitorGraphJsonChunkFactory(graphData);

        await capacitorWriteChunkSequence('data.js', graphJsChunkFactory, {
            maxPayloadBytes: CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES,
            payloadLabel: 'data.js graph payload'
        });
        await capacitorWriteChunkSequence('graph_data.json', graphJsonChunkFactory, {
            maxPayloadBytes: CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES,
            payloadLabel: 'graph_data.json graph payload'
        });

        if (rawTarget !== 'ALL_FOLDERS') {
            const targetName = sanitizeTargetName(rawTarget);
            if (targetName) {
                await capacitorWriteChunkSequence(`data_${targetName}.js`, graphJsChunkFactory, {
                    maxPayloadBytes: CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES,
                    payloadLabel: `data_${targetName}.js graph payload`
                });
                await capacitorWriteChunkSequence(`graph_data_${targetName}.json`, graphJsonChunkFactory, {
                    maxPayloadBytes: CAPACITOR_GRAPH_SERIALIZATION_MAX_BYTES,
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

        async readContent(filePath) {
            if (!this._supportsContentApi()) {
                throw unsupportedOperationError('readContent');
            }

            if (isCapacitorNativeRuntime()) {
                const capacitorPath = resolveCapacitorContentCandidatePath(filePath);
                return await capacitorReadText(capacitorPath);
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
                    return await capacitorReadText(normalized);
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
        createProvider
    };
}());
