import type { XrAvailabilityState } from "../../game/ui-types";
import { isLoggingEnabled, logWithOriginal } from "../../logging";

type XrProbeFailureReason =
  | "insecure-context"
  | "api-missing"
  | "unsupported-session"
  | "probe-error";

type XrProbeResult =
  | { available: true }
  | { available: false; reason: XrProbeFailureReason; errorMessage?: string };

type NavigatorWithUaData = Navigator & {
  userAgentData?: {
    brands?: Array<{ brand?: string; version?: string }>;
  };
};

type XrDebugWindow = Window & {
  __NH3D_XR_DEBUG_HISTORY__?: Array<Record<string, unknown>>;
  __NH3D_XR_DEBUG_LAST__?: Record<string, unknown>;
};

let lastAvailabilityFingerprint = "";

function xrDebugLog(message: string, details?: unknown): void {
  if (!isLoggingEnabled()) {
    return;
  }
  if (typeof details === "undefined") {
    logWithOriginal("[NH3D XR]", message);
    return;
  }
  logWithOriginal("[NH3D XR]", message, details);
}

function detectQuestLikeUserAgent(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const userAgent = String(navigator.userAgent || "").toLowerCase();
  if (
    userAgent.includes("quest") ||
    userAgent.includes("oculus") ||
    userAgent.includes("oculusbrowser")
  ) {
    return true;
  }
  const uaBrands = (navigator as NavigatorWithUaData).userAgentData?.brands;
  if (!Array.isArray(uaBrands)) {
    return false;
  }
  return uaBrands.some((brandEntry) => {
    const brand = String(brandEntry?.brand || "").toLowerCase();
    return brand.includes("quest") || brand.includes("oculus");
  });
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string") {
      return value;
    }
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

async function probeDirectWebXrSupport(): Promise<XrProbeResult> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { available: false, reason: "insecure-context" };
  }
  if (typeof navigator === "undefined") {
    return { available: false, reason: "api-missing" };
  }
  const xr = navigator.xr;
  if (!xr || typeof xr.isSessionSupported !== "function") {
    return { available: false, reason: "api-missing" };
  }
  try {
    const supported = await xr.isSessionSupported("immersive-vr");
    if (supported) {
      return { available: true };
    }
    return { available: false, reason: "unsupported-session" };
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    const normalized = errorMessage.toLowerCase();
    if (
      normalized.includes("secure context") ||
      normalized.includes("https") ||
      normalized.includes("not allowed in this document")
    ) {
      return {
        available: false,
        reason: "insecure-context",
        errorMessage,
      };
    }
    return { available: false, reason: "probe-error", errorMessage };
  }
}

function resolveUnavailableStatusText(
  probe: Exclude<XrProbeResult, { available: true }>,
  isHeadsetShell: boolean,
): string {
  if (probe.reason === "insecure-context") {
    return "WebXR needs a secure context. Use https:// or localhost via adb reverse.";
  }
  if (probe.reason === "api-missing") {
    return isHeadsetShell
      ? "WebXR API is unavailable in this Quest Browser session. Disable Desktop mode and reload."
      : "WebXR API is unavailable in this browser.";
  }
  if (probe.reason === "unsupported-session") {
    return isHeadsetShell
      ? "Quest Browser reported no immersive VR support for this page. Reload and try again."
      : "Immersive VR is unavailable in this browser session.";
  }
  if (probe.errorMessage) {
    return `WebXR probe failed: ${probe.errorMessage}`;
  }
  return "WebXR probe failed in this browser session.";
}

function buildAvailabilityFingerprint(params: {
  offerEnabled: boolean;
  isHeadsetShell: boolean;
  probeResult: XrProbeResult;
  secureContext: boolean | null;
  hasNavigatorXr: boolean;
  hasSessionSupportFn: boolean;
}): string {
  const probeState = params.probeResult.available
    ? "available"
    : `unavailable:${params.probeResult.reason}:${params.probeResult.errorMessage || ""}`;
  return [
    params.offerEnabled ? "offer=1" : "offer=0",
    params.isHeadsetShell ? "headset=1" : "headset=0",
    `secure=${params.secureContext === null ? "na" : params.secureContext ? "1" : "0"}`,
    params.hasNavigatorXr ? "xr=1" : "xr=0",
    params.hasSessionSupportFn ? "supportFn=1" : "supportFn=0",
    probeState,
  ].join("|");
}

function logAvailabilityResolution(params: {
  offerEnabled: boolean;
  isHeadsetShell: boolean;
  probeResult: XrProbeResult;
  secureContext: boolean | null;
  hasNavigatorXr: boolean;
  hasSessionSupportFn: boolean;
  userAgent: string;
}): void {
  const fingerprint = buildAvailabilityFingerprint(params);
  const snapshot: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    fingerprint,
    offerEnabled: params.offerEnabled,
    isHeadsetShell: params.isHeadsetShell,
    probeResult: params.probeResult,
    secureContext: params.secureContext,
    hasNavigatorXr: params.hasNavigatorXr,
    hasSessionSupportFn: params.hasSessionSupportFn,
    userAgent: params.userAgent,
  };
  if (typeof window !== "undefined") {
    const debugWindow = window as XrDebugWindow;
    const history = debugWindow.__NH3D_XR_DEBUG_HISTORY__ || [];
    history.push(snapshot);
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    debugWindow.__NH3D_XR_DEBUG_HISTORY__ = history;
    debugWindow.__NH3D_XR_DEBUG_LAST__ = snapshot;
  }
  if (fingerprint === lastAvailabilityFingerprint) {
    return;
  }
  lastAvailabilityFingerprint = fingerprint;

  xrDebugLog("Resolved WebXR availability", snapshot);
}

export async function resolveXrAvailability(options: {
  vrOfferOnSupportedDevice: boolean;
}): Promise<XrAvailabilityState> {
  if (!options.vrOfferOnSupportedDevice) {
    return {
      supported: false,
      launchMode: "unavailable",
      directWebXrAvailable: false,
      isHeadsetShell: false,
      buttonLabel: "VR Disabled",
      statusText: "VR is disabled in client options.",
      usingDomOverlay: false,
    };
  }

  const [probeResult, isHeadsetShell] = await Promise.all([
    probeDirectWebXrSupport(),
    Promise.resolve(detectQuestLikeUserAgent()),
  ]);
  const secureContext =
    typeof window === "undefined" ? null : window.isSecureContext;
  const hasNavigatorXr =
    typeof navigator !== "undefined" &&
    typeof navigator.xr !== "undefined" &&
    navigator.xr !== null;
  const hasSessionSupportFn =
    hasNavigatorXr &&
    typeof (navigator.xr as XRSystem).isSessionSupported === "function";
  const userAgent =
    typeof navigator === "undefined" ? "" : String(navigator.userAgent || "");

  if (probeResult.available) {
    const result: XrAvailabilityState = {
      supported: true,
      launchMode: "webxr",
      directWebXrAvailable: true,
      isHeadsetShell,
      buttonLabel: "Enter VR",
      statusText: "Immersive VR is available on this device.",
      usingDomOverlay: false,
    };
    logAvailabilityResolution({
      offerEnabled: options.vrOfferOnSupportedDevice,
      isHeadsetShell,
      probeResult,
      secureContext,
      hasNavigatorXr,
      hasSessionSupportFn,
      userAgent,
    });
    return result;
  }

  const result: XrAvailabilityState = {
    supported: false,
    launchMode: "unavailable",
    directWebXrAvailable: false,
    isHeadsetShell,
    buttonLabel: "VR Unavailable",
    statusText: resolveUnavailableStatusText(probeResult, isHeadsetShell),
    usingDomOverlay: false,
  };
  logAvailabilityResolution({
    offerEnabled: options.vrOfferOnSupportedDevice,
    isHeadsetShell,
    probeResult,
    secureContext,
    hasNavigatorXr,
    hasSessionSupportFn,
    userAgent,
  });
  return result;
}
