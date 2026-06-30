const { app, BrowserWindow, ipcMain, screen, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const packageJson = require("../package.json");

if (typeof packageJson.version === "string") {
  app.setVersion(packageJson.version);
}

function configureLinuxChromiumRuntime() {
  if (process.platform !== "linux") {
    return;
  }

  app.commandLine.appendSwitch("ozone-platform-hint", "auto");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

configureLinuxChromiumRuntime();

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const quitIpcChannel = "nh3d:quit-app";
const appRenderedIpcChannel = "nh3d:app-rendered";
const updaterGetActiveInfoIpcChannel = "nh3d:updater-get-active-info";
const updaterApplyIpcChannel = "nh3d:updater-apply";
const updaterCancelIpcChannel = "nh3d:updater-cancel";
const updaterProgressIpcChannel = "nh3d:updater-progress";
const updaterActivateIpcChannel = "nh3d:updater-activate";
const mainWindowStateById = new Map();
const activeUpdateJobBySenderId = new Map();

const updateRootDirPath = path.join(app.getPath("userData"), "game-updates");
const updateCurrentFilesDirPath = path.join(updateRootDirPath, "current");
const updateStagingDirPath = path.join(updateRootDirPath, "staging");
const updateFailureLogsDirPath = path.join(updateRootDirPath, "failure-logs");
const updateLastFailureLogPath = path.join(
  updateRootDirPath,
  "last-update-failure.json",
);
const updateFetchTimeoutMs = 30000;
const updateDownloadProgressStartPercent = 12;
const updateDownloadProgressEndPercent = 90;
const activeUpdateMetadataPath = path.join(
  updateRootDirPath,
  "active-update.json",
);
const updateFallbackNoticePath = path.join(
  updateRootDirPath,
  "fallback-notice.json",
);
const updateFallbackUserMessage =
  "Game update data was corrupted and had to be cleared out. If this keeps happening, download the latest proper client update and try again.";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeRelativePath(value) {
  const normalized = normalizeString(value).replace(/\\/g, "/");
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("/") || normalized.includes("..")) {
    return null;
  }
  return normalized;
}

function parseManifestFileEntry(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  const relativePath = normalizeRelativePath(value.path);
  if (!relativePath) {
    return null;
  }
  const size =
    typeof value.size === "number" && Number.isFinite(value.size)
      ? Math.max(0, Math.trunc(value.size))
      : null;
  const sha256 = normalizeNullableString(value.sha256);
  const url = normalizeNullableString(value.url);
  return {
    path: relativePath,
    size,
    sha256,
    url,
  };
}

function parseManifestLatestEntry(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  const buildId = normalizeString(value.buildId);
  const filesBasePath = normalizeRelativePath(value.filesBasePath);
  const rawFiles = Array.isArray(value.files) ? value.files : [];
  const files = rawFiles
    .map((entry) => parseManifestFileEntry(entry))
    .filter(Boolean);
  if (!buildId || !filesBasePath || files.length === 0) {
    return null;
  }

  return {
    buildId,
    commitSha: normalizeNullableString(value.commitSha),
    clientVersion: normalizeNullableString(value.clientVersion),
    requiresClientUpgrade: normalizeBoolean(value.requiresClientUpgrade),
    filesBasePath,
    files,
  };
}

function parseUpdateManifest(payload) {
  if (!isPlainObject(payload)) {
    return null;
  }
  const latest = parseManifestLatestEntry(payload.latest);
  if (!latest) {
    return null;
  }
  return { latest };
}

function normalizePositiveInteger(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.max(0, Math.trunc(value));
  return normalized > 0 ? normalized : null;
}

function normalizeProgressPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeProgressStatus(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (
    normalized === "info" ||
    normalized === "success" ||
    normalized === "warning" ||
    normalized === "error"
  ) {
    return normalized;
  }
  return "info";
}

function normalizeUpdateProgressPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};
  const phase = normalizeNullableString(source.phase) ?? "unknown";
  const message =
    normalizeNullableString(source.message) ?? "Updater status changed.";
  return {
    at: new Date().toISOString(),
    phase,
    status: normalizeProgressStatus(source.status),
    message,
    detail: normalizeNullableString(source.detail),
    progressPercent: normalizeProgressPercent(source.progressPercent),
    fileIndex: normalizePositiveInteger(source.fileIndex),
    fileCount: normalizePositiveInteger(source.fileCount),
    filePath: normalizeNullableString(source.filePath),
  };
}

function emitUpdateProgress(progressReporter, payload) {
  if (typeof progressReporter !== "function") {
    return;
  }
  progressReporter(normalizeUpdateProgressPayload(payload));
}

function resolveUpdateDownloadProgressPercent(completedFiles, totalFiles) {
  const normalizedTotal = normalizePositiveInteger(totalFiles);
  if (!normalizedTotal) {
    return normalizeProgressPercent(updateDownloadProgressStartPercent);
  }
  const completed = Math.max(0, Math.min(normalizedTotal, Math.trunc(completedFiles)));
  const span = updateDownloadProgressEndPercent - updateDownloadProgressStartPercent;
  return normalizeProgressPercent(
    updateDownloadProgressStartPercent + (completed / normalizedTotal) * span,
  );
}

function createUpdateProgressReporter(webContents) {
  if (!webContents || typeof webContents.send !== "function") {
    return null;
  }
  return (payload) => {
    if (webContents.isDestroyed?.()) {
      return;
    }
    try {
      webContents.send(updaterProgressIpcChannel, payload);
    } catch (error) {
      console.warn("Failed to dispatch updater progress event:", error);
    }
  };
}

function readJsonFileSync(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath, payload) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function hasRootRelativeUrlReferences(indexHtmlRaw) {
  if (typeof indexHtmlRaw !== "string" || !indexHtmlRaw) {
    return false;
  }
  return /\b(?:src|href)=["']\/(?!\/)/i.test(indexHtmlRaw);
}

function parseActiveUpdateMetadata(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  const buildId = normalizeNullableString(value.buildId);
  const buildRootPath = normalizeNullableString(value.buildRootPath);
  const commitSha = normalizeNullableString(value.commitSha);
  const updatedAt = normalizeNullableString(value.updatedAt);
  const manifestUrl = normalizeNullableString(value.manifestUrl);
  const clientVersion = normalizeNullableString(value.clientVersion);
  if (!buildId || !buildRootPath) {
    return null;
  }
  return {
    buildId,
    buildRootPath,
    commitSha,
    updatedAt,
    manifestUrl,
    clientVersion,
  };
}

function persistUpdateFallbackNoticeSync(reason) {
  const payload = {
    at: new Date().toISOString(),
    message: updateFallbackUserMessage,
    reason: normalizeNullableString(reason),
  };
  try {
    fs.mkdirSync(updateRootDirPath, { recursive: true });
    fs.writeFileSync(
      updateFallbackNoticePath,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    console.warn("Failed to persist update fallback notice:", error);
  }
}

function clearCorruptUpdateDataSync(reason) {
  const normalizedReason =
    normalizeNullableString(reason) ?? "Corrupt active update metadata.";
  console.warn(
    `Falling back to bundled build after invalid game update data: ${normalizedReason}`,
  );
  try {
    fs.rmSync(updateCurrentFilesDirPath, { recursive: true, force: true });
    fs.rmSync(updateStagingDirPath, { recursive: true, force: true });
    fs.rmSync(activeUpdateMetadataPath, { force: true });
  } catch (error) {
    console.warn("Failed to clear corrupt update data:", error);
  }
  persistUpdateFallbackNoticeSync(normalizedReason);
}

function readAndClearUpdateFallbackNoticeSync() {
  const payload = readJsonFileSync(updateFallbackNoticePath);
  if (!payload || !isPlainObject(payload)) {
    return null;
  }
  const message =
    normalizeNullableString(payload.message) ?? updateFallbackUserMessage;
  try {
    fs.rmSync(updateFallbackNoticePath, { force: true });
  } catch {
    // Ignore fallback-notice cleanup failures.
  }
  return message;
}

function readActiveUpdateMetadataSync() {
  const metadataExists = fs.existsSync(activeUpdateMetadataPath);
  const parsed = parseActiveUpdateMetadata(readJsonFileSync(activeUpdateMetadataPath));
  if (!parsed) {
    if (metadataExists) {
      clearCorruptUpdateDataSync("Active update metadata is invalid.");
    }
    return null;
  }
  const indexHtmlPath = path.join(parsed.buildRootPath, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    clearCorruptUpdateDataSync(
      "Active update index.html is missing from the update bundle.",
    );
    return null;
  }
  try {
    const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
    if (hasRootRelativeUrlReferences(indexHtml)) {
      clearCorruptUpdateDataSync(
        "Active update index.html contains root-relative URLs incompatible with file:// launches.",
      );
      return null;
    }
  } catch (error) {
    clearCorruptUpdateDataSync(
      `Active update index.html could not be read: ${normalizeNullableString(error?.message) ?? "unknown read error"}.`,
    );
    return null;
  }
  return parsed;
}

function toPublicActiveUpdateInfo(metadata, hostWarningMessage = null) {
  const normalizedHostWarning = normalizeNullableString(hostWarningMessage);
  if (!metadata && !normalizedHostWarning) {
    return null;
  }
  return {
    buildId: metadata?.buildId ?? null,
    commitSha: metadata?.commitSha ?? null,
    updatedAt: metadata?.updatedAt ?? null,
    clientVersion: metadata?.clientVersion ?? null,
    manifestUrl: metadata?.manifestUrl ?? null,
    hostWarningMessage: normalizedHostWarning,
  };
}

function resolveLaunchIndexHtmlPath() {
  const activeUpdate = readActiveUpdateMetadataSync();
  if (activeUpdate) {
    return path.join(activeUpdate.buildRootPath, "index.html");
  }
  return path.join(__dirname, "..", "dist", "index.html");
}

async function removeDirectoryIfPresent(targetPath) {
  await fsp.rm(targetPath, { recursive: true, force: true });
}

function resolveManifestFileUrl(manifestUrl, latestManifestEntry, fileEntry) {
  if (fileEntry.url) {
    return new URL(fileEntry.url, manifestUrl).toString();
  }
  const basePath = latestManifestEntry.filesBasePath.replace(/\/+$/, "");
  const relativePath = fileEntry.path.replace(/^\/+/, "");
  return new URL(`${basePath}/${relativePath}`, manifestUrl).toString();
}

function normalizeErrorForLog(error) {
  if (error instanceof Error) {
    return {
      name: normalizeNullableString(error.name),
      message: normalizeNullableString(error.message),
      stack: normalizeNullableString(error.stack),
      code: normalizeNullableString(error.code),
    };
  }
  return {
    name: null,
    message: normalizeNullableString(String(error ?? "")),
    stack: null,
    code: null,
  };
}

function createUpdateAttemptTrace(manifestUrl) {
  return {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    manifestUrl,
    appVersion: app.getVersion(),
    platform: process.platform,
    versions: {
      node: normalizeNullableString(process.versions?.node ?? process.version),
      electron: normalizeNullableString(process.versions?.electron),
      chrome: normalizeNullableString(process.versions?.chrome),
    },
    events: [],
    calls: [],
  };
}

function appendUpdateTraceEvent(updateTrace, stage, details = null) {
  if (!updateTrace || !normalizeString(stage)) {
    return;
  }
  const entry = {
    at: new Date().toISOString(),
    stage,
  };
  if (details !== null && details !== undefined) {
    entry.details = details;
  }
  updateTrace.events.push(entry);
}

function beginUpdateTraceCall(updateTrace, call) {
  if (!updateTrace || !isPlainObject(call)) {
    return null;
  }
  const startedAt = new Date();
  const entry = {
    index: updateTrace.calls.length + 1,
    type: normalizeString(call.type) || "unknown",
    url: normalizeNullableString(call.url),
    path: normalizeNullableString(call.path),
    expectedSize:
      typeof call.expectedSize === "number" && Number.isFinite(call.expectedSize)
        ? Math.max(0, Math.trunc(call.expectedSize))
        : null,
    expectedSha256: normalizeNullableString(call.expectedSha256),
    startedAt: startedAt.toISOString(),
    completedAt: null,
    durationMs: null,
    outcome: "pending",
    httpStatus: null,
    httpStatusText: null,
    responseContentLength: null,
    bytesReceived: null,
    error: null,
  };
  updateTrace.calls.push(entry);
  return {
    entry,
    startedAtMs: startedAt.getTime(),
  };
}

function completeUpdateTraceCall(traceHandle, patch) {
  if (!traceHandle) {
    return;
  }
  const completedAt = new Date();
  traceHandle.entry.completedAt = completedAt.toISOString();
  traceHandle.entry.durationMs = Math.max(
    0,
    completedAt.getTime() - traceHandle.startedAtMs,
  );
  if (isPlainObject(patch)) {
    for (const [key, value] of Object.entries(patch)) {
      traceHandle.entry[key] = value;
    }
  }
}

function resolveUpdateFailureLogPath(timestampIsoUtc) {
  const safeTimestamp = String(timestampIsoUtc || "")
    .replace(/[:.]/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  const suffix = safeTimestamp || String(Date.now());
  return path.join(updateFailureLogsDirPath, `update-failure-${suffix}.json`);
}

async function persistUpdateFailureTrace(updateTrace, error) {
  if (!updateTrace) {
    return null;
  }
  const failedAt = new Date().toISOString();
  const payload = {
    ...updateTrace,
    failedAt,
    error: normalizeErrorForLog(error),
  };
  const logPath = resolveUpdateFailureLogPath(failedAt);
  try {
    await writeJsonFile(logPath, payload);
    await writeJsonFile(updateLastFailureLogPath, payload);
    return logPath;
  } catch (writeError) {
    console.warn("Failed to persist update failure trace:", writeError);
    return null;
  }
}

function createUpdateAbortError() {
  const error = new Error("Update download canceled.");
  error.name = "AbortError";
  return error;
}

function createUpdateTimeoutError() {
  const error = new Error("Update download timed out.");
  error.name = "TimeoutError";
  return error;
}

function resolveAbortReasonAsError(reason) {
  if (reason instanceof Error) {
    return reason;
  }
  const normalizedReason =
    reason === undefined || reason === null ? "" : normalizeString(String(reason));
  if (normalizedReason) {
    const error = new Error(normalizedReason);
    error.name = "AbortError";
    return error;
  }
  return createUpdateAbortError();
}

function createUpdateFetchScope(cancellationSignal = null) {
  const abortController = new AbortController();
  let timeoutHandle = null;
  let cancelListener = null;
  const abortIfNeeded = (reason) => {
    if (!abortController.signal.aborted) {
      abortController.abort(resolveAbortReasonAsError(reason));
    }
  };

  if (cancellationSignal) {
    if (cancellationSignal.aborted) {
      abortIfNeeded(cancellationSignal.reason);
    } else {
      cancelListener = () => {
        abortIfNeeded(cancellationSignal.reason);
      };
      cancellationSignal.addEventListener("abort", cancelListener, {
        once: true,
      });
    }
  }

  timeoutHandle = setTimeout(() => {
    abortIfNeeded(createUpdateTimeoutError());
  }, updateFetchTimeoutMs);

  return {
    signal: abortController.signal,
    cleanup: () => {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (cancellationSignal && cancelListener) {
        cancellationSignal.removeEventListener("abort", cancelListener);
      }
    },
  };
}

function normalizeUpdateFetchError(error, fetchSignal) {
  if (fetchSignal?.aborted) {
    return resolveAbortReasonAsError(fetchSignal.reason);
  }
  return error;
}

function resolveUpdateFailureMessage(error) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return "Update download timed out. Check your connection and try again.";
    }
    const normalizedMessage = normalizeString(error.message);
    if (normalizedMessage) {
      return normalizedMessage;
    }
  }
  return "Failed to apply update.";
}

function throwIfUpdateCanceled(cancellationSignal) {
  if (!cancellationSignal?.aborted) {
    return;
  }
  const cancellationReason = cancellationSignal.reason;
  if (cancellationReason instanceof Error) {
    throw cancellationReason;
  }
  throw createUpdateAbortError();
}

async function computeFileSha256Hex(filePath) {
  const fileBytes = await fsp.readFile(filePath);
  return crypto.createHash("sha256").update(fileBytes).digest("hex");
}

async function tryReuseLocalFileWithMatchingHash(
  sourcePath,
  destinationPath,
  expectedSha256,
  cancellationSignal = null,
) {
  const normalizedExpectedSha256 = normalizeNullableString(expectedSha256);
  if (!normalizedExpectedSha256) {
    return {
      reused: false,
      bytes: null,
    };
  }
  let sourceStats = null;
  try {
    sourceStats = await fsp.stat(sourcePath);
  } catch {
    return {
      reused: false,
      bytes: null,
    };
  }
  if (!sourceStats.isFile()) {
    return {
      reused: false,
      bytes: null,
    };
  }
  throwIfUpdateCanceled(cancellationSignal);
  const actualSha256 = await computeFileSha256Hex(sourcePath);
  if (actualSha256.toLowerCase() !== normalizedExpectedSha256.toLowerCase()) {
    return {
      reused: false,
      bytes:
        typeof sourceStats.size === "number" && Number.isFinite(sourceStats.size)
          ? Math.max(0, Math.trunc(sourceStats.size))
          : null,
    };
  }
  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  await fsp.copyFile(sourcePath, destinationPath);
  return {
    reused: true,
    bytes:
      typeof sourceStats.size === "number" && Number.isFinite(sourceStats.size)
        ? Math.max(0, Math.trunc(sourceStats.size))
        : null,
  };
}

async function fetchJsonFromUrl(
  url,
  cancellationSignal = null,
  updateTrace = null,
) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is not available in the Electron host.");
  }
  const traceCall = beginUpdateTraceCall(updateTrace, {
    type: "manifest-fetch",
    url,
  });
  throwIfUpdateCanceled(cancellationSignal);
  const fetchScope = createUpdateFetchScope(cancellationSignal);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: fetchScope.signal,
    });
    if (traceCall) {
      traceCall.entry.httpStatus = response.status;
      traceCall.entry.httpStatusText = response.statusText;
    }
    if (!response.ok) {
      throw new Error(
        `Failed to fetch update manifest (${response.status} ${response.statusText}).`,
      );
    }
    throwIfUpdateCanceled(cancellationSignal);
    const payload = await response.json();
    completeUpdateTraceCall(traceCall, {
      outcome: "ok",
    });
    return {
      payload,
      httpStatus: response.status,
      httpStatusText: normalizeNullableString(response.statusText),
    };
  } catch (error) {
    const normalizedError = normalizeUpdateFetchError(error, fetchScope.signal);
    const outcome = normalizedError instanceof Error && normalizedError.name === "AbortError"
      ? "canceled"
      : normalizedError instanceof Error && normalizedError.name === "TimeoutError"
        ? "timeout"
        : "error";
    completeUpdateTraceCall(traceCall, {
      outcome,
      error: normalizeErrorForLog(normalizedError),
    });
    throw normalizedError;
  } finally {
    fetchScope.cleanup();
  }
}

async function downloadFileWithValidation(
  fileUrl,
  destinationPath,
  expectedSize,
  expectedSha256,
  cancellationSignal = null,
  tracePath = null,
  updateTrace = null,
) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is not available in the Electron host.");
  }
  const traceCall = beginUpdateTraceCall(updateTrace, {
    type: "file-download",
    url: fileUrl,
    path: tracePath,
    expectedSize,
    expectedSha256,
  });
  throwIfUpdateCanceled(cancellationSignal);
  const fetchScope = createUpdateFetchScope(cancellationSignal);
  try {
    const response = await fetch(fileUrl, {
      cache: "no-store",
      signal: fetchScope.signal,
    });
    if (traceCall) {
      traceCall.entry.httpStatus = response.status;
      traceCall.entry.httpStatusText = response.statusText;
      const contentLengthValue = response.headers.get("content-length");
      const parsedContentLength =
        typeof contentLengthValue === "string" &&
        /^\d+$/.test(contentLengthValue.trim())
          ? Number.parseInt(contentLengthValue, 10)
          : null;
      traceCall.entry.responseContentLength =
        typeof parsedContentLength === "number" &&
        Number.isFinite(parsedContentLength)
          ? parsedContentLength
          : null;
    }
    if (!response.ok) {
      throw new Error(
        `Failed to download ${fileUrl} (${response.status} ${response.statusText}).`,
      );
    }

    const fileBytes = Buffer.from(await response.arrayBuffer());
    const bytesReceived = fileBytes.length;
    if (traceCall) {
      traceCall.entry.bytesReceived = bytesReceived;
    }
    throwIfUpdateCanceled(cancellationSignal);
    if (typeof expectedSize === "number" && bytesReceived !== expectedSize) {
      throw new Error(
        `Downloaded file size mismatch for ${fileUrl}: expected ${expectedSize}, got ${bytesReceived}.`,
      );
    }
    if (expectedSha256) {
      const actualSha256 = crypto
        .createHash("sha256")
        .update(fileBytes)
        .digest("hex");
      if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
        throw new Error(
          `SHA256 mismatch for ${fileUrl}: expected ${expectedSha256}, got ${actualSha256}.`,
        );
      }
    }

    await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
    await fsp.writeFile(destinationPath, fileBytes);
    completeUpdateTraceCall(traceCall, {
      outcome: "ok",
    });
    return {
      httpStatus: response.status,
      httpStatusText: normalizeNullableString(response.statusText),
      bytesReceived,
    };
  } catch (error) {
    const normalizedError = normalizeUpdateFetchError(error, fetchScope.signal);
    const outcome = normalizedError instanceof Error && normalizedError.name === "AbortError"
      ? "canceled"
      : normalizedError instanceof Error && normalizedError.name === "TimeoutError"
        ? "timeout"
        : "error";
    completeUpdateTraceCall(traceCall, {
      outcome,
      error: normalizeErrorForLog(normalizedError),
    });
    throw normalizedError;
  } finally {
    fetchScope.cleanup();
  }
}

async function applyGameUpdateFromManifestUrl(
  manifestUrl,
  cancellationSignal = null,
  updateTraceOverride = null,
  progressReporter = null,
) {
  if (!app.isPackaged) {
    return {
      ok: false,
      applied: false,
      alreadyInstalled: false,
      canceled: false,
      buildId: null,
      reloadTriggered: false,
      clientUpdateRequired: false,
      error: "Updater is disabled in development builds.",
    };
  }

  const normalizedManifestUrl = normalizeNullableString(manifestUrl);
  if (!normalizedManifestUrl) {
    return {
      ok: false,
      applied: false,
      alreadyInstalled: false,
      canceled: false,
      buildId: null,
      reloadTriggered: false,
      clientUpdateRequired: false,
      error: "Update manifest URL is required.",
    };
  }

  const updateTrace =
    updateTraceOverride && isPlainObject(updateTraceOverride)
      ? updateTraceOverride
      : createUpdateAttemptTrace(normalizedManifestUrl);
  appendUpdateTraceEvent(updateTrace, "apply-started");
  emitUpdateProgress(progressReporter, {
    phase: "start",
    status: "info",
    message: "Starting game update download.",
    detail: "Preparing update workflow.",
    progressPercent: 1,
  });
  const stagingBuildDirPath = path.join(updateStagingDirPath, "current");
  const targetBuildDirPath = updateCurrentFilesDirPath;

  try {
    emitUpdateProgress(progressReporter, {
      phase: "manifest",
      status: "info",
      message: "Fetching update manifest.",
      detail: normalizedManifestUrl,
      progressPercent: 3,
    });
    const manifestResponse = await fetchJsonFromUrl(
      normalizedManifestUrl,
      cancellationSignal,
      updateTrace,
    );
    const parsedManifest = parseUpdateManifest(manifestResponse.payload);
    if (!parsedManifest?.latest) {
      throw new Error("Update manifest payload is invalid.");
    }
    appendUpdateTraceEvent(updateTrace, "manifest-parsed", {
      buildId: parsedManifest.latest.buildId,
      fileCount: parsedManifest.latest.files.length,
    });

    const latest = parsedManifest.latest;
    emitUpdateProgress(progressReporter, {
      phase: "manifest",
      status: "success",
      message: "Update manifest loaded.",
      detail: `HTTP ${manifestResponse.httpStatus} ${manifestResponse.httpStatusText ?? ""}`.trim(),
      progressPercent: 8,
      fileCount: latest.files.length,
    });
    const activeMetadata = readActiveUpdateMetadataSync();
    const localReuseBuildRootPath =
      activeMetadata?.buildRootPath ?? path.join(__dirname, "..", "dist");
    const localReuseSourceLabel = activeMetadata?.buildId
      ? `active build ${activeMetadata.buildId}`
      : "bundled dist";
    if (activeMetadata?.buildId === latest.buildId) {
      appendUpdateTraceEvent(updateTrace, "already-installed", {
        buildId: latest.buildId,
      });
      emitUpdateProgress(progressReporter, {
        phase: "complete",
        status: "success",
        message: "Latest game update is already installed.",
        detail: `Build ${latest.buildId}`,
        progressPercent: 100,
      });
      return {
        ok: true,
        applied: false,
        alreadyInstalled: true,
        canceled: false,
        buildId: latest.buildId,
        reloadTriggered: false,
        clientUpdateRequired: latest.requiresClientUpgrade,
        error: null,
      };
    }

    appendUpdateTraceEvent(updateTrace, "prepare-staging");
    emitUpdateProgress(progressReporter, {
      phase: "staging",
      status: "info",
      message: "Preparing staging folder.",
      detail: "Clearing previous staged files.",
      progressPercent: 10,
      fileCount: latest.files.length,
    });
    await removeDirectoryIfPresent(stagingBuildDirPath);
    await fsp.mkdir(stagingBuildDirPath, { recursive: true });
    emitUpdateProgress(progressReporter, {
      phase: "staging",
      status: "success",
      message: "Staging folder is ready.",
      detail: `Expecting ${latest.files.length} files; reusing unchanged files from ${localReuseSourceLabel} when possible.`,
      progressPercent: 12,
      fileCount: latest.files.length,
    });

    throwIfUpdateCanceled(cancellationSignal);
    let reusedFileCount = 0;
    let downloadedFileCount = 0;
    for (let fileIndex = 0; fileIndex < latest.files.length; fileIndex += 1) {
      const fileEntry = latest.files[fileIndex];
      throwIfUpdateCanceled(cancellationSignal);
      const relativePath = normalizeRelativePath(fileEntry.path);
      if (!relativePath) {
        throw new Error(`Unsafe update file path: ${String(fileEntry.path)}`);
      }
      const oneBasedFileIndex = fileIndex + 1;
      const totalFiles = latest.files.length;
      emitUpdateProgress(progressReporter, {
        phase: "download",
        status: "info",
        message: `Processing file ${oneBasedFileIndex}/${totalFiles}.`,
        detail: relativePath,
        filePath: relativePath,
        fileIndex: oneBasedFileIndex,
        fileCount: totalFiles,
        progressPercent: resolveUpdateDownloadProgressPercent(fileIndex, totalFiles),
      });
      const destinationPath = path.join(stagingBuildDirPath, relativePath);
      const reusableSourcePath = path.join(localReuseBuildRootPath, relativePath);
      const reuseResult = await tryReuseLocalFileWithMatchingHash(
        reusableSourcePath,
        destinationPath,
        fileEntry.sha256,
        cancellationSignal,
      );
      if (reuseResult.reused) {
        reusedFileCount += 1;
        emitUpdateProgress(progressReporter, {
          phase: "download",
          status: "success",
          message: `Reused unchanged file ${oneBasedFileIndex}/${totalFiles}.`,
          detail:
            typeof reuseResult.bytes === "number"
              ? `${relativePath} (${reuseResult.bytes} bytes, local cache hit)`
              : `${relativePath} (local cache hit)`,
          filePath: relativePath,
          fileIndex: oneBasedFileIndex,
          fileCount: totalFiles,
          progressPercent: resolveUpdateDownloadProgressPercent(
            oneBasedFileIndex,
            totalFiles,
          ),
        });
        continue;
      }

      const sourceUrl = resolveManifestFileUrl(
        normalizedManifestUrl,
        latest,
        fileEntry,
      );
      const downloadResult = await downloadFileWithValidation(
        sourceUrl,
        destinationPath,
        fileEntry.size,
        fileEntry.sha256,
        cancellationSignal,
        relativePath,
        updateTrace,
      );
      downloadedFileCount += 1;
      const expectedSizeDetail =
        typeof fileEntry.size === "number" ? `expected ${fileEntry.size} bytes` : "expected size unknown";
      emitUpdateProgress(progressReporter, {
        phase: "download",
        status: "success",
        message: `Downloaded and validated file ${oneBasedFileIndex}/${totalFiles}.`,
        detail: `${relativePath} (${downloadResult.bytesReceived} bytes, ${expectedSizeDetail}, HTTP ${downloadResult.httpStatus} ${downloadResult.httpStatusText ?? ""})`.trim(),
        filePath: relativePath,
        fileIndex: oneBasedFileIndex,
        fileCount: totalFiles,
        progressPercent: resolveUpdateDownloadProgressPercent(
          oneBasedFileIndex,
          totalFiles,
        ),
      });
    }

    emitUpdateProgress(progressReporter, {
      phase: "verify",
      status: "info",
      message: "Verifying staged update package.",
      detail: "Checking required launch files.",
      progressPercent: 92,
    });
    throwIfUpdateCanceled(cancellationSignal);
    const stagedIndexHtmlPath = path.join(stagingBuildDirPath, "index.html");
    if (!fs.existsSync(stagedIndexHtmlPath)) {
      throw new Error("Update package is missing index.html.");
    }

    appendUpdateTraceEvent(updateTrace, "activate-staged-build");
    emitUpdateProgress(progressReporter, {
      phase: "activate",
      status: "info",
      message: "Activating staged game update.",
      detail: "Replacing current update files.",
      progressPercent: 95,
    });
    await fsp.mkdir(updateRootDirPath, { recursive: true });
    await removeDirectoryIfPresent(targetBuildDirPath);
    await fsp.rename(stagingBuildDirPath, targetBuildDirPath);

    const updatedAt = new Date().toISOString();
    const nextMetadata = {
      buildId: latest.buildId,
      buildRootPath: targetBuildDirPath,
      commitSha: latest.commitSha,
      updatedAt,
      manifestUrl: normalizedManifestUrl,
      clientVersion: latest.clientVersion,
    };
    await writeJsonFile(activeUpdateMetadataPath, nextMetadata);
    appendUpdateTraceEvent(updateTrace, "metadata-written", {
      buildId: latest.buildId,
      updatedAt,
    });
    appendUpdateTraceEvent(updateTrace, "download-summary", {
      downloadedFiles: downloadedFileCount,
      reusedFiles: reusedFileCount,
      totalFiles: latest.files.length,
    });
    emitUpdateProgress(progressReporter, {
      phase: "complete",
      status: "success",
      message: "Game update applied successfully.",
      detail: `Build ${latest.buildId} is ready (downloaded ${downloadedFileCount}, reused ${reusedFileCount}).`,
      progressPercent: 100,
      fileCount: latest.files.length,
    });

    return {
      ok: true,
      applied: true,
      alreadyInstalled: false,
      canceled: false,
      buildId: latest.buildId,
      reloadTriggered: false,
      clientUpdateRequired: latest.requiresClientUpgrade,
      error: null,
    };
  } catch (error) {
    appendUpdateTraceEvent(updateTrace, "apply-failed", {
      error: normalizeErrorForLog(error),
    });
    await removeDirectoryIfPresent(stagingBuildDirPath);
    if (cancellationSignal?.aborted) {
      emitUpdateProgress(progressReporter, {
        phase: "cancel",
        status: "warning",
        message: "Update download canceled.",
        detail: "Canceled before completion.",
      });
      return {
        ok: false,
        applied: false,
        alreadyInstalled: false,
        canceled: true,
        buildId: null,
        reloadTriggered: false,
        clientUpdateRequired: false,
        error: "Update download canceled.",
      };
    }
    const normalizedErrorMessage = resolveUpdateFailureMessage(error);
    emitUpdateProgress(progressReporter, {
      phase: "error",
      status: "error",
      message: "Failed to apply game update.",
      detail: normalizedErrorMessage,
    });
    await persistUpdateFailureTrace(updateTrace, error);
    const baseErrorMessage = normalizedErrorMessage;
    const errorMessage = baseErrorMessage;
    return {
      ok: false,
      applied: false,
      alreadyInstalled: false,
      canceled: false,
      buildId: null,
      reloadTriggered: false,
      clientUpdateRequired: false,
      error: errorMessage,
    };
  }
}

function hasLaunchArgument(...switchNames) {
  return switchNames.some(
    (switchName) =>
      app.commandLine.hasSwitch(switchName) ||
      process.argv.includes(`--${switchName}`),
  );
}

function resolveWindowMode() {
  if (process.platform === "win32") {
    if (hasLaunchArgument("windowed", "window")) {
      return "windowed";
    }
    return "fullscreen";
  }
  if (hasLaunchArgument("windowed", "window")) {
    return "windowed";
  }
  if (
    hasLaunchArgument(
      "borderless",
      "borderless-window",
      "borderlesswindow",
    )
  ) {
    return "borderless";
  }
  return "fullscreen";
}

function showMainWindowIfReady(mainWindow, state) {
  if (state.shown || mainWindow.isDestroyed()) {
    return;
  }
  if (!state.readyToShow || (!state.appRendered && !state.didFinishLoad)) {
    return;
  }
  state.shown = true;
  mainWindow.show();
}

ipcMain.handle(quitIpcChannel, () => {
  // Bypass renderer beforeunload prompts for explicit in-game quit requests.
  for (const window of BrowserWindow.getAllWindows()) {
    window.destroy();
  }
  app.quit();
});

ipcMain.handle(updaterGetActiveInfoIpcChannel, () => {
  const activeMetadata = readActiveUpdateMetadataSync();
  const fallbackNotice = readAndClearUpdateFallbackNoticeSync();
  return toPublicActiveUpdateInfo(activeMetadata, fallbackNotice);
});

ipcMain.handle(updaterApplyIpcChannel, async (event, payload) => {
  const manifestUrl = isPlainObject(payload)
    ? normalizeNullableString(payload.manifestUrl)
    : null;
  const senderId = event.sender.id;
  if (activeUpdateJobBySenderId.has(senderId)) {
    return {
      ok: false,
      applied: false,
      alreadyInstalled: false,
      canceled: false,
      buildId: null,
      reloadTriggered: false,
      clientUpdateRequired: false,
      error: "An update download is already in progress.",
    };
  }

  const abortController = new AbortController();
  const updateTrace = createUpdateAttemptTrace(manifestUrl);
  const reportProgress = createUpdateProgressReporter(event.sender);
  const activeJob = { abortController, updateTrace };
  activeUpdateJobBySenderId.set(senderId, activeJob);
  const handleSenderDestroyed = () => {
    abortController.abort(createUpdateAbortError());
  };
  event.sender.once("destroyed", handleSenderDestroyed);

  try {
    return await applyGameUpdateFromManifestUrl(
      manifestUrl,
      abortController.signal,
      updateTrace,
      reportProgress,
    );
  } finally {
    event.sender.removeListener("destroyed", handleSenderDestroyed);
    const existingJob = activeUpdateJobBySenderId.get(senderId);
    if (existingJob === activeJob) {
      activeUpdateJobBySenderId.delete(senderId);
    }
  }
});

ipcMain.handle(updaterCancelIpcChannel, (event) => {
  const activeJob = activeUpdateJobBySenderId.get(event.sender.id);
  if (!activeJob) {
    return {
      ok: true,
      canceled: false,
      error: null,
    };
  }
  activeJob.abortController.abort(createUpdateAbortError());
  return {
    ok: true,
    canceled: true,
    error: null,
  };
});

ipcMain.handle(updaterActivateIpcChannel, async (event) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { activated: false };
  }

  if (!app.isPackaged && devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return { activated: true };
  }

  const indexHtmlPath = resolveLaunchIndexHtmlPath();
  await mainWindow.loadFile(indexHtmlPath);
  return { activated: true };
});

ipcMain.on(appRenderedIpcChannel, (event) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  if (!mainWindow) {
    return;
  }
  const state = mainWindowStateById.get(mainWindow.id);
  if (!state) {
    return;
  }
  state.appRendered = true;
  showMainWindowIfReady(mainWindow, state);
});

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const primaryBounds = primaryDisplay.bounds;
  const workAreaBounds = primaryDisplay.workArea;
  const windowMode = resolveWindowMode();
  const baseWindowOptions = {
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      backgroundThrottling: false,
    },
  };
  let mainWindowOptions;
  if (windowMode === "windowed") {
    mainWindowOptions = {
      ...baseWindowOptions,
      width: Math.max(1024, Math.min(workAreaBounds.width, 1280)),
      height: Math.max(700, Math.min(workAreaBounds.height, 800)),
      center: true,
      frame: true,
      fullscreen: false,
      fullscreenable: true,
    };
  } else if (windowMode === "borderless") {
    mainWindowOptions = {
      ...baseWindowOptions,
      x: primaryBounds.x,
      y: primaryBounds.y,
      width: primaryBounds.width,
      height: primaryBounds.height,
      frame: false,
      fullscreen: false,
      fullscreenable: true,
    };
  } else {
    mainWindowOptions = {
      ...baseWindowOptions,
      x: primaryBounds.x,
      y: primaryBounds.y,
      width: primaryBounds.width,
      height: primaryBounds.height,
      frame: false,
      fullscreen: true,
      fullscreenable: true,
    };
  }
  const mainWindow = new BrowserWindow(mainWindowOptions);
  mainWindow.webContents.setZoomFactor(1);
  const state = {
    readyToShow: false,
    appRendered: false,
    didFinishLoad: false,
    shown: false,
  };
  mainWindowStateById.set(mainWindow.id, state);

  mainWindow.once("ready-to-show", () => {
    state.readyToShow = true;
    showMainWindowIfReady(mainWindow, state);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    state.didFinishLoad = true;
    showMainWindowIfReady(mainWindow, state);
  });

  mainWindow.webContents.on("did-fail-load", () => {
    state.shown = true;
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindowStateById.delete(mainWindow.id);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {
      // Ignore external browser launch errors.
    });
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-prevent-unload", (event) => {
    // Allow Alt+F4 / native close to quit immediately even if the renderer
    // registered a beforeunload prompt while gameplay is active.
    event.preventDefault();
  });

  if (!app.isPackaged && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const indexHtmlPath = resolveLaunchIndexHtmlPath();
  mainWindow.loadFile(indexHtmlPath);
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("child-process-gone", (_event, details) => {
  if (details.type !== "GPU") {
    return;
  }
  console.error(
    `Electron GPU process exited (reason=${details.reason}, exitCode=${details.exitCode ?? "n/a"})`,
  );
});

app.on("render-process-gone", (_event, _webContents, details) => {
  console.error(
    `Electron renderer process exited (reason=${details.reason}, exitCode=${details.exitCode ?? "n/a"})`,
  );
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
