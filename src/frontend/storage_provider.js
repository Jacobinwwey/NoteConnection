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

    async function capacitorReadText(pathValue) {
        const filesystem = getCapacitorFilesystemPlugin();
        if (!filesystem || typeof filesystem.readFile !== 'function') {
            throw new Error('Capacitor Filesystem plugin is unavailable.');
        }

        await ensureCapacitorFilesystemPermission(filesystem);
        const normalizedPath = normalizeCapacitorPath(pathValue);

        const directoryHints = [];
        const directories = filesystem.Directory || {};
        if (directories.Documents) {
            directoryHints.push(directories.Documents);
        }
        if (directories.Data) {
            directoryHints.push(directories.Data);
        }
        if (directories.ExternalStorage) {
            directoryHints.push(directories.ExternalStorage);
        }
        directoryHints.push(null);

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

    async function capacitorReadDirectory(pathValue) {
        const filesystem = getCapacitorFilesystemPlugin();
        if (!filesystem || typeof filesystem.readdir !== 'function') {
            return [];
        }

        await ensureCapacitorFilesystemPermission(filesystem);
        const normalizedPath = normalizeCapacitorPath(pathValue, { allowCurrentDir: true });

        const directories = filesystem.Directory || {};
        const directoryHints = [];
        if (directories.Documents) {
            directoryHints.push(directories.Documents);
        }
        if (directories.Data) {
            directoryHints.push(directories.Data);
        }
        if (directories.ExternalStorage) {
            directoryHints.push(directories.ExternalStorage);
        }
        directoryHints.push(null);

        for (const directory of directoryHints) {
            try {
                const args = { path: normalizedPath };
                if (directory) {
                    args.directory = directory;
                }
                const result = await filesystem.readdir(args);
                const files = Array.isArray(result && result.files) ? result.files : [];
                return files
                    .map((entry) => {
                        if (typeof entry === 'string') {
                            return entry;
                        }
                        if (entry && typeof entry.name === 'string') {
                            return entry.name;
                        }
                        return '';
                    })
                    .filter(Boolean);
            } catch (_err) {
                // Try next directory hint.
            }
        }

        return [];
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

    class RuntimeStorageProvider {
        constructor(runtimeCaps) {
            this.runtimeCaps = runtimeCaps || {};
        }

        _supportsSidecar() {
            return this.runtimeCaps.supports_sidecar === true;
        }

        _supportsBuild() {
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
                return null;
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
                return false;
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
                    const response = await fetch(`${normalized}?v=${Date.now()}`);
                    if (response.ok) {
                        return await response.text();
                    }
                } catch (_fetchErr) {
                    // Fall through to filesystem fallback.
                }

                try {
                    return await capacitorReadText(normalized);
                } catch (_fsErr) {
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
