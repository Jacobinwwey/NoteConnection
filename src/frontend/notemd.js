(function () {
  const $ = (id) => document.getElementById(id);
  const logOutput = $("log-output");
  let currentSettings = null;
  const NOTEMD_EMBED_RPC_REQUEST = "noteconnection:notemd-rpc-request";
  const NOTEMD_EMBED_RPC_RESPONSE = "noteconnection:notemd-rpc-response";
  const NOTEMD_RUNTIME_READY_TIMEOUT_MS = 2000;
  const NOTEMD_INVOKE_TIMEOUT_MS = 300000;
  let notemdRpcSeq = 0;
  let runtimeReadyTimeoutWarned = false;

  function nowString() {
    const d = new Date();
    return d.toLocaleTimeString();
  }

  function appendLog(message, level) {
    const tag = level ? `[${level.toUpperCase()}]` : "[INFO]";
    const line = `${nowString()} ${tag} ${message}`;
    logOutput.textContent += `${line}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  function getBaseUrl() {
    if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.getBaseUrl === "function") {
      return window.NoteConnectionRuntime.getBaseUrl();
    }
    return `${window.location.protocol}//${window.location.host}`;
  }

  function buildUrl(resourcePath) {
    if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildUrl === "function") {
      return window.NoteConnectionRuntime.buildUrl(resourcePath.replace(/^\/+/, ""));
    }
    return new URL(resourcePath, `${getBaseUrl()}/`).toString();
  }

  function buildFetchOptions(init) {
    if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildFetchOptions === "function") {
      return window.NoteConnectionRuntime.buildFetchOptions(init);
    }
    return init;
  }

  let runtimeReadyPromise = null;
  function ensureRuntimeReady() {
    if (runtimeReadyPromise) {
      return runtimeReadyPromise;
    }
    if (
      window.NoteConnectionRuntime &&
      typeof window.NoteConnectionRuntime.whenReady === "function"
    ) {
      runtimeReadyPromise = new Promise((resolve) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          if (!runtimeReadyTimeoutWarned) {
            appendLog(
              `Runtime bridge readiness timed out after ${NOTEMD_RUNTIME_READY_TIMEOUT_MS}ms; continuing with fallback invoke.`,
              "warn"
            );
            runtimeReadyTimeoutWarned = true;
          }
          resolve();
        }, NOTEMD_RUNTIME_READY_TIMEOUT_MS);

        Promise.resolve(window.NoteConnectionRuntime.whenReady())
          .then(() => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve();
          })
          .catch((error) => {
            appendLog(
              `Runtime bridge initialization warning: ${
                error instanceof Error ? error.message : String(error)
              }`,
              "warn"
            );
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve();
          });
      });
      return runtimeReadyPromise;
    }
    runtimeReadyPromise = Promise.resolve();
    return runtimeReadyPromise;
  }

  function getTauriInvoke() {
    const candidateWindows = [];
    candidateWindows.push(window);

    try {
      if (window.parent && window.parent !== window) {
        candidateWindows.push(window.parent);
      }
    } catch (_error) {
      // Ignore cross-frame access errors.
    }

    try {
      if (window.top && window.top !== window && !candidateWindows.includes(window.top)) {
        candidateWindows.push(window.top);
      }
    } catch (_error) {
      // Ignore cross-frame access errors.
    }

    for (const candidate of candidateWindows) {
      try {
        const invoke =
          candidate &&
          candidate.__TAURI__ &&
          candidate.__TAURI__.core &&
          typeof candidate.__TAURI__.core.invoke === "function"
            ? candidate.__TAURI__.core.invoke
            : null;
        if (invoke) {
          return invoke.bind(candidate.__TAURI__.core);
        }
      } catch (_error) {
        // Ignore cross-frame access errors for inaccessible windows.
      }
    }

    return null;
  }

  function canUseParentRpcBridge() {
    try {
      return !!(window.parent && window.parent !== window);
    } catch (_error) {
      return false;
    }
  }

  function withTimeout(promise, timeoutMs, errorMessage) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(errorMessage));
      }, timeoutMs);

      Promise.resolve(promise)
        .then((value) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  function getParentHostInvoke() {
    if (!canUseParentRpcBridge()) {
      return null;
    }
    try {
      const hostInvoke = window.parent && window.parent.NoteConnectionHostInvoke;
      if (typeof hostInvoke === "function") {
        return hostInvoke.bind(window.parent);
      }
    } catch (_error) {
      // Ignore cross-frame access errors.
    }
    return null;
  }

  function invokeViaParentRpcBridge(command, payload, timeoutMs) {
    if (!canUseParentRpcBridge()) {
      return Promise.reject(new Error("Parent RPC bridge is unavailable."));
    }

    return new Promise((resolve, reject) => {
      const requestId = `notemd-rpc-${Date.now()}-${++notemdRpcSeq}`;
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error(`Timed out waiting for host RPC response (${command}).`));
      }, timeoutMs);

      function onMessage(event) {
        const data = event && event.data;
        if (!data || data.type !== NOTEMD_EMBED_RPC_RESPONSE || data.requestId !== requestId) {
          return;
        }

        clearTimeout(timer);
        window.removeEventListener("message", onMessage);

        if (data.error) {
          reject(new Error(String(data.error)));
          return;
        }

        resolve(data.result);
      }

      window.addEventListener("message", onMessage);

      try {
        window.parent.postMessage(
          {
            type: NOTEMD_EMBED_RPC_REQUEST,
            requestId,
            command,
            payload: payload || {},
          },
          "*"
        );
      } catch (error) {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async function invokeTauri(command, payload) {
    // Picker commands should not be blocked by runtime hydration.
    // Runtime readiness is only required for HTTP-sidecar API requests.
    const parentHostInvoke = getParentHostInvoke();
    if (parentHostInvoke) {
      appendLog(`Picker bridge: host invoke -> ${command}`);
      try {
        return await withTimeout(
          parentHostInvoke(command, payload || {}),
          NOTEMD_INVOKE_TIMEOUT_MS,
          `Host invoke timed out (${command}).`
        );
      } catch (error) {
        appendLog(
          `Direct host invoke fallback for '${command}' failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "warn"
        );
      }
    }

    const invoke = getTauriInvoke();
    if (invoke) {
      appendLog(`Picker bridge: direct invoke -> ${command}`);
      try {
        return await withTimeout(
          invoke(command, payload || {}),
          NOTEMD_INVOKE_TIMEOUT_MS,
          `Tauri invoke timed out (${command}).`
        );
      } catch (error) {
        appendLog(
          `Direct Tauri invoke fallback for '${command}' failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "warn"
        );
      }
    }

    const preferParentRpc = canUseParentRpcBridge();
    if (preferParentRpc) {
      appendLog(`Picker bridge: RPC fallback -> ${command}`, "warn");
      try {
        return await invokeViaParentRpcBridge(command, payload, NOTEMD_INVOKE_TIMEOUT_MS);
      } catch (error) {
        appendLog(
          `Host RPC fallback for '${command}' failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "warn"
        );
      }
    }

    throw new Error(`No available Tauri invoke bridge for command '${command}'.`);
  }

  async function apiRequest(resourcePath, options) {
    await ensureRuntimeReady();

    const method = (options && options.method) || "POST";
    const body = options && options.body !== undefined ? options.body : undefined;
    const headers = Object.assign({}, (options && options.headers) || {});
    const init = {
      method,
      headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    }

    const response = await fetch(buildUrl(resourcePath), buildFetchOptions(init));
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_error) {
      payload = text;
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && typeof payload.error === "string"
          ? payload.error
          : typeof payload === "string" && payload
          ? payload
          : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  function getOperationId() {
    return $("op-id").value.trim();
  }

  function getFilePath() {
    return $("file-path").value.trim();
  }

  function getFolderPath() {
    return $("folder-path").value.trim();
  }

  function isPdfPath(rawPath) {
    return typeof rawPath === "string" && rawPath.trim().toLowerCase().endsWith(".pdf");
  }

  function assertNotPdfInput(rawPath, label) {
    if (isPdfPath(rawPath)) {
      throw new Error(
        `${label} points to a PDF file. Please convert PDF to Markdown (.md) with Mineru before importing.`
      );
    }
  }

  function getTargetLanguage() {
    return $("target-language").value.trim() || "English";
  }

  function getOutputFolderNameFromFile(rawPath) {
    const normalized = String(rawPath || "").trim().replace(/\\/g, "/");
    const fileName = normalized.split("/").pop() || "";
    return fileName.replace(/\.[^.]+$/, "");
  }

  function updateOutputFolderPreview() {
    const preview = $("output-folder-preview");
    if (!preview) {
      return;
    }
    const filePath = getFilePath();
    const folderName = getOutputFolderNameFromFile(filePath);
    preview.value = folderName ? `Knowledge_Base/${folderName}` : "";
  }

  function getActiveProvider(settings) {
    const providers = Array.isArray(settings && settings.providers) ? settings.providers : [];
    return (
      providers.find((provider) => provider.name === settings.activeProvider) ||
      providers[0] ||
      null
    );
  }

  function updateDeveloperModeUi(enabled) {
    const advancedPanel = $("advanced-panel");
    const developerState = $("developer-state");
    if (advancedPanel) {
      advancedPanel.classList.toggle("is-hidden", !enabled);
    }
    if (developerState) {
      developerState.textContent = enabled
        ? "Developer mode is enabled. Step-by-step processing controls are visible."
        : "Developer mode is disabled. Only the built-in One-Click Extract workflow is shown.";
    }
  }

  function applySettingsToForm(settings) {
    currentSettings = settings;
    const activeProvider = getActiveProvider(settings);
    $("provider-name").value = activeProvider ? activeProvider.name : "";
    $("api-base-url").value = activeProvider ? activeProvider.baseUrl || "" : "";
    $("api-model").value = activeProvider ? activeProvider.model || "" : "";
    $("api-key").value = activeProvider ? activeProvider.apiKey || "" : "";
    $("api-version").value = activeProvider ? activeProvider.apiVersion || "" : "";
    $("api-temperature").value =
      activeProvider && Number.isFinite(Number(activeProvider.temperature))
        ? String(activeProvider.temperature)
        : "0.5";
    $("chunk-word-count").value = String(settings.chunkWordCount || 2800);
    $("max-tokens").value = String(settings.maxTokens || 4096);
    $("developer-mode").checked = settings.developerMode === true;
    updateDeveloperModeUi(settings.developerMode === true);
  }

  function buildSettingsPayload() {
    if (!currentSettings) {
      throw new Error("Settings have not been loaded yet.");
    }

    const providerName = $("provider-name").value.trim();
    if (!providerName) {
      throw new Error("Provider is required.");
    }

    const next = JSON.parse(JSON.stringify(currentSettings));
    const provider = next.providers.find((item) => item.name === providerName);
    if (!provider) {
      throw new Error(`Unsupported provider: ${providerName}`);
    }

    next.activeProvider = providerName;
    next.chunkWordCount = Math.max(300, Number($("chunk-word-count").value || next.chunkWordCount || 2800));
    next.maxTokens = Math.max(128, Number($("max-tokens").value || next.maxTokens || 4096));
    next.developerMode = $("developer-mode").checked;
    next.autoMermaidFixAfterGenerate = true;

    next.providers = next.providers.map((item) => {
      if (item.name !== providerName) {
        return item;
      }
      return {
        ...item,
        baseUrl: $("api-base-url").value.trim(),
        model: $("api-model").value.trim(),
        apiKey: $("api-key").value,
        apiVersion: $("api-version").value.trim(),
        temperature: Number($("api-temperature").value || item.temperature || 0.5),
      };
    });

    return next;
  }

  async function browseForFileInput(inputId, saveFile) {
    const input = $(inputId);
    if (!input) {
      return;
    }

    appendLog(`Opening ${saveFile ? "save-file" : "file"} picker...`);
    const command = saveFile ? "save_notemd_file" : "pick_notemd_file";
    const selectedPath = await invokeTauri(command, {
      initialPath: input.value.trim() || null,
    });
    if (typeof selectedPath === "string" && selectedPath.trim()) {
      input.value = selectedPath;
      updateOutputFolderPreview();
      appendLog(`Selected path: ${selectedPath}`);
    } else {
      appendLog("Path selection was cancelled.");
    }
  }

  async function browseForFolderInput(inputId) {
    const input = $(inputId);
    if (!input) {
      return;
    }

    appendLog("Opening folder picker...");
    const selectedPath = await invokeTauri("pick_notemd_folder", {
      initialPath: input.value.trim() || null,
    });
    if (typeof selectedPath === "string" && selectedPath.trim()) {
      input.value = selectedPath;
      appendLog(`Selected folder: ${selectedPath}`);
    } else {
      appendLog("Folder selection was cancelled.");
    }
  }

  async function loadSettings() {
    const payload = await apiRequest("/api/notemd/settings", { method: "GET" });
    applySettingsToForm(payload.settings || {});
    appendLog("Loaded NoteMD settings from app_config.toml.");
  }

  async function saveSettings() {
    const payload = await apiRequest("/api/notemd/settings", {
      method: "POST",
      body: buildSettingsPayload(),
    });
    applySettingsToForm(payload.settings || {});
    appendLog("Saved NoteMD settings to app_config.toml.");
  }

  async function testLlm() {
    const payload = await apiRequest("/api/notemd/test-llm", {
      body: {},
    });
    appendLog(payload.message || "LLM test completed.");
  }

  async function cancelOperation() {
    const operationId = getOperationId();
    if (!operationId) {
      throw new Error("Operation ID is required.");
    }
    const payload = await apiRequest("/api/notemd/cancel", {
      body: { operationId },
    });
    appendLog(`Operation ${payload.operationId || operationId} cancelled.`);
  }

  async function oneClickExtract() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("Source markdown file is required.");
    }
    assertNotPdfInput(filePath, "Source markdown file");
    const payload = await apiRequest("/api/notemd/one-click-extract", {
      body: {
        filePath,
        operationId: getOperationId() || undefined,
      },
    });

    $("folder-path").value = payload.result.outputFolderPath || "";
    $("output-folder-preview").value = payload.result.outputFolderPath || $("output-folder-preview").value;
    appendLog(
      `One-Click Extract completed. ${payload.result.concepts.length} concepts -> ${payload.result.generated.generatedFiles} generated files -> ${payload.result.mermaid.fixedFiles} Mermaid-fixed files.`
    );
    if (Array.isArray(payload.logs)) {
      payload.logs.forEach((item) => appendLog(item.message || JSON.stringify(item)));
    }
  }

  async function extractConcepts() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("Source markdown file is required.");
    }
    assertNotPdfInput(filePath, "Source markdown file");
    const payload = await apiRequest("/api/notemd/extract-concepts", {
      body: {
        filePath,
        operationId: getOperationId() || undefined,
      },
    });
    appendLog(`Extracted ${payload.result.concepts.length} concepts from the current file.`);
  }

  async function generateFolder() {
    const folderPath = getFolderPath();
    if (!folderPath) {
      throw new Error("Workflow folder is required.");
    }
    const payload = await apiRequest("/api/notemd/generate-folder-content", {
      body: { folderPath },
    });
    appendLog(
      `Batch generate completed: ${payload.result.generatedFiles}/${payload.result.totalFiles} files written.`
    );
  }

  async function batchFixMermaid() {
    const folderPath = getFolderPath();
    if (!folderPath) {
      throw new Error("Workflow folder is required.");
    }
    const payload = await apiRequest("/api/notemd/batch-fix-mermaid", {
      body: { folderPath, inPlace: true },
    });
    appendLog(
      `Batch Mermaid fix completed: ${payload.result.fixedFiles}/${payload.result.totalFiles} files changed.`
    );
  }

  function bind(id, handler) {
    const element = $(id);
    if (!element) {
      return;
    }
    element.addEventListener("click", async () => {
      try {
        await handler();
      } catch (error) {
        appendLog(error instanceof Error ? error.message : String(error), "error");
      }
    });
  }

  $("file-path").addEventListener("input", updateOutputFolderPreview);
  $("developer-mode").addEventListener("change", () => {
    updateDeveloperModeUi($("developer-mode").checked);
  });

  bind("btn-load-settings", loadSettings);
  bind("btn-save-settings", saveSettings);
  bind("btn-test-llm", testLlm);
  bind("btn-cancel-op", cancelOperation);
  bind("btn-one-click-extract", oneClickExtract);
  bind("btn-extract-concepts", extractConcepts);
  bind("btn-generate-folder", generateFolder);
  bind("btn-batch-fix-mermaid", batchFixMermaid);
  bind("btn-browse-file-path", () => browseForFileInput("file-path", false));
  bind("btn-browse-folder-path", () => browseForFolderInput("folder-path"));

  ensureRuntimeReady().finally(async () => {
    appendLog(`NoteMD UI initialized against ${getBaseUrl()}`);
    appendLog("Reminder: convert PDF files to Markdown with Mineru before importing.");
    if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.whenReady === "function") {
      appendLog(`Runtime bridge ready: ${getBaseUrl()}`);
    }
    try {
      await loadSettings();
      updateOutputFolderPreview();
    } catch (error) {
      appendLog(
        `Initial settings load failed: ${error instanceof Error ? error.message : String(error)}`,
        "warn"
      );
    }
  });
})();
