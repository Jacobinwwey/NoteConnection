(function () {
  const $ = (id) => document.getElementById(id);
  const logOutput = $("log-output");
  const settingsEditor = $("settings-json");
  const NOTEMD_EMBED_RPC_REQUEST = "noteconnection:notemd-rpc-request";
  const NOTEMD_EMBED_RPC_RESPONSE = "noteconnection:notemd-rpc-response";
  let notemdRpcSeq = 0;

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
      runtimeReadyPromise = window.NoteConnectionRuntime.whenReady().catch((error) => {
        appendLog(
          `Runtime bridge initialization warning: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "warn"
        );
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
    await ensureRuntimeReady();
    const invoke = getTauriInvoke();
    if (!invoke) {
      return invokeViaParentRpcBridge(command, payload, 12000);
    }
    return invoke(command, payload || {});
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

  function getOutputPath() {
    return $("output-path").value.trim();
  }

  function getFolderPath() {
    return $("folder-path").value.trim();
  }

  function getOutputFolderPath() {
    return $("output-folder-path").value.trim();
  }

  function getTargetLanguage() {
    return $("target-language").value.trim() || "English";
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

  async function browseForFileInput(inputId, saveFile) {
    const input = $(inputId);
    if (!input) {
      return;
    }

    const command = saveFile ? "save_notemd_file" : "pick_notemd_file";
    const selectedPath = await invokeTauri(command, {
      initialPath: input.value.trim() || null,
    });
    if (typeof selectedPath === "string" && selectedPath.trim()) {
      input.value = selectedPath;
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
    settingsEditor.value = JSON.stringify(payload.settings || {}, null, 2);
    appendLog("Loaded NoteMD settings.");
  }

  async function saveSettings() {
    let parsed;
    try {
      parsed = JSON.parse(settingsEditor.value || "{}");
    } catch (error) {
      throw new Error(`Settings JSON parse failed: ${error.message}`);
    }

    const payload = await apiRequest("/api/notemd/settings", {
      method: "POST",
      body: parsed,
    });
    settingsEditor.value = JSON.stringify(payload.settings || {}, null, 2);
    appendLog("Saved NoteMD settings.");
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

  async function processFile() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("File path is required.");
    }
    assertNotPdfInput(filePath, "File path");
    const payload = await apiRequest("/api/notemd/process-file", {
      body: {
        filePath,
        outputPath: getOutputPath() || undefined,
        operationId: getOperationId() || undefined,
      },
    });
    appendLog(`Processed file with ${payload.result.linkCount} wiki-link inserts.`);
    if (Array.isArray(payload.logs)) {
      payload.logs.forEach((item) => appendLog(item.message || JSON.stringify(item)));
    }
  }

  async function processFolder() {
    const folderPath = getFolderPath();
    if (!folderPath) {
      throw new Error("Folder path is required.");
    }
    const payload = await apiRequest("/api/notemd/process-folder", {
      body: {
        folderPath,
        outputFolderPath: getOutputFolderPath() || undefined,
        operationId: getOperationId() || undefined,
      },
    });
    appendLog(
      `Processed folder: ${payload.result.processedFiles}/${payload.result.totalFiles} files succeeded.`
    );
  }

  async function translateFile() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("File path is required.");
    }
    assertNotPdfInput(filePath, "File path");
    const payload = await apiRequest("/api/notemd/translate-file", {
      body: {
        filePath,
        outputPath: getOutputPath() || undefined,
        targetLanguage: getTargetLanguage(),
      },
    });
    appendLog(`Translated file saved to: ${payload.result.outputPath}`);
  }

  async function translateFolder() {
    const folderPath = getFolderPath();
    if (!folderPath) {
      throw new Error("Folder path is required.");
    }
    const payload = await apiRequest("/api/notemd/translate-folder", {
      body: {
        folderPath,
        targetLanguage: getTargetLanguage(),
      },
    });
    appendLog(
      `Translated folder: ${payload.result.translatedFiles}/${payload.result.totalFiles} files succeeded.`
    );
  }

  async function fixMermaid() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("File path is required.");
    }
    assertNotPdfInput(filePath, "File path");
    const payload = await apiRequest("/api/notemd/fix-mermaid", {
      body: {
        filePath,
        inPlace: true,
      },
    });
    appendLog(
      payload.result.changed
        ? `Mermaid fixed (${payload.result.fixes.length} fix types).`
        : "No Mermaid changes needed."
    );
  }

  async function fixFormulas() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("File path is required.");
    }
    assertNotPdfInput(filePath, "File path");
    const payload = await apiRequest("/api/notemd/fix-formulas", {
      body: {
        filePath,
        inPlace: true,
      },
    });
    appendLog(
      payload.result.changed
        ? `Formula delimiters normalized (${payload.result.fixes.length} fix types).`
        : "No formula changes needed."
    );
  }

  async function checkDuplicates() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("File path is required.");
    }
    assertNotPdfInput(filePath, "File path");
    const payload = await apiRequest("/api/notemd/check-duplicates", {
      body: { filePath },
    });
    const dupTerms = payload.result.duplicateTerms || [];
    const dupLinks = payload.result.duplicateWikiLinks || [];
    appendLog(`Duplicate terms: ${dupTerms.length}, duplicate wiki-links: ${dupLinks.length}`);
  }

  async function extractConcepts() {
    const filePath = getFilePath();
    if (!filePath) {
      throw new Error("File path is required.");
    }
    assertNotPdfInput(filePath, "File path");
    const payload = await apiRequest("/api/notemd/extract-concepts", {
      body: {
        filePath,
        operationId: getOperationId() || undefined,
      },
    });
    appendLog(`Extracted ${payload.result.concepts.length} concepts.`);
  }

  async function generateContent() {
    const title = $("gen-title").value.trim();
    const filePath = $("gen-file").value.trim();
    if (!title && !filePath) {
      throw new Error("Title or file path is required.");
    }
    if (filePath) {
      assertNotPdfInput(filePath, "Save-to file path");
    }
    const payload = await apiRequest("/api/notemd/generate-content", {
      body: {
        title: title || undefined,
        filePath: filePath || undefined,
        context: $("gen-context").value.trim() || undefined,
      },
    });
    appendLog(
      payload.outputPath
        ? `Generated content saved to ${payload.outputPath}`
        : `Generated content for "${payload.title}"`
    );
    if (!payload.outputPath && payload.content) {
      appendLog("Generated markdown preview:");
      appendLog(payload.content.slice(0, 800));
    }
  }

  async function generateFolder() {
    const folderPath = getFolderPath();
    if (!folderPath) {
      throw new Error("Folder path is required.");
    }
    const payload = await apiRequest("/api/notemd/process-folder", {
      body: {
        folderPath,
        dryRun: true,
      },
    });
    appendLog(
      `Folder preflight: ${payload.result.totalFiles} files eligible. Use Process Folder for write mode.`
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

  bind("btn-load-settings", loadSettings);
  bind("btn-save-settings", saveSettings);
  bind("btn-test-llm", testLlm);
  bind("btn-cancel-op", cancelOperation);
  bind("btn-process-file", processFile);
  bind("btn-process-folder", processFolder);
  bind("btn-translate-file", translateFile);
  bind("btn-translate-folder", translateFolder);
  bind("btn-fix-mermaid", fixMermaid);
  bind("btn-fix-formulas", fixFormulas);
  bind("btn-check-duplicates", checkDuplicates);
  bind("btn-extract-concepts", extractConcepts);
  bind("btn-generate-content", generateContent);
  bind("btn-generate-folder", generateFolder);
  bind("btn-browse-file-path", () => browseForFileInput("file-path", false));
  bind("btn-browse-output-path", () => browseForFileInput("output-path", true));
  bind("btn-browse-folder-path", () => browseForFolderInput("folder-path"));
  bind("btn-browse-output-folder-path", () => browseForFolderInput("output-folder-path"));
  bind("btn-browse-gen-file", () => browseForFileInput("gen-file", true));

  ensureRuntimeReady().finally(() => {
    appendLog(`NoteMD UI initialized against ${getBaseUrl()}`);
    appendLog("Reminder: convert PDF files to Markdown with Mineru before importing.");
    if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.whenReady === "function") {
      appendLog(`Runtime bridge ready: ${getBaseUrl()}`);
    }
  });
})();
