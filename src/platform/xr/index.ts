import { Capacitor, registerPlugin } from "@capacitor/core";
import type { XrAvailabilityState } from "../../game/ui-types";

type NativeVrShellInfo = {
  isNativePlatform: boolean;
  manufacturer: string;
  model: string;
  isMetaQuest: boolean;
  hasQuestBrowser: boolean;
};

type LaunchVrBrowserResult = {
  launched: boolean;
};

type VrShellPlugin = {
  getDeviceInfo(): Promise<NativeVrShellInfo>;
  launchVrBrowser(options: { url: string }): Promise<LaunchVrBrowserResult>;
};

const VrShell = registerPlugin<VrShellPlugin>("VrShell", {
  web: () => import("./web").then((module) => new module.VrShellWeb()),
});

const defaultVrBrowserLaunchUrl = "https://jamesiv4.github.io/nethack-3d/";

function isPublicWebLaunchUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.href : undefined);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "[::1]"
    );
  } catch {
    return false;
  }
}

function resolveConfiguredVrBrowserLaunchUrl(): string {
  if (
    typeof window !== "undefined" &&
    isPublicWebLaunchUrl(window.location.href)
  ) {
    return window.location.href;
  }
  const configured =
    typeof import.meta.env.VITE_VR_LAUNCH_URL === "string"
      ? import.meta.env.VITE_VR_LAUNCH_URL.trim()
      : "";
  return configured || defaultVrBrowserLaunchUrl;
}

async function canDirectlyPresentWebXr(): Promise<boolean> {
  const xr = navigator.xr;
  if (!xr || typeof xr.isSessionSupported !== "function") {
    return false;
  }
  try {
    return await xr.isSessionSupported("immersive-vr");
  } catch {
    return false;
  }
}

async function readNativeVrShellInfo(): Promise<NativeVrShellInfo> {
  const isNativePlatform =
    typeof Capacitor?.isNativePlatform === "function"
      ? Capacitor.isNativePlatform()
      : Capacitor?.getPlatform?.() === "android" ||
        Capacitor?.getPlatform?.() === "ios";
  if (!isNativePlatform) {
    return {
      isNativePlatform: false,
      manufacturer: "",
      model: "",
      isMetaQuest: false,
      hasQuestBrowser: false,
    };
  }
  try {
    return await VrShell.getDeviceInfo();
  } catch {
    return {
      isNativePlatform: true,
      manufacturer: "",
      model: "",
      isMetaQuest: false,
      hasQuestBrowser: false,
    };
  }
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
      browserHandoffUrl: null,
      buttonLabel: "VR Disabled",
      statusText: "VR is disabled in client options.",
      usingDomOverlay: false,
    };
  }

  const [directWebXrAvailable, nativeInfo] = await Promise.all([
    canDirectlyPresentWebXr(),
    readNativeVrShellInfo(),
  ]);
  const browserHandoffUrl = resolveConfiguredVrBrowserLaunchUrl();

  if (directWebXrAvailable) {
    return {
      supported: true,
      launchMode: "webxr",
      directWebXrAvailable: true,
      isHeadsetShell: nativeInfo.isMetaQuest,
      browserHandoffUrl,
      buttonLabel: "Enter VR",
      statusText: "Immersive VR is available on this device.",
      usingDomOverlay: false,
    };
  }

  if (nativeInfo.isMetaQuest && nativeInfo.hasQuestBrowser) {
    return {
      supported: true,
      launchMode: "browser-handoff",
      directWebXrAvailable: false,
      isHeadsetShell: true,
      browserHandoffUrl,
      buttonLabel: "Open VR in Quest Browser",
      statusText:
        "This app shell cannot present immersive WebXR directly. Launch the web build in Quest Browser.",
      usingDomOverlay: false,
    };
  }

  return {
    supported: false,
    launchMode: "unavailable",
    directWebXrAvailable: false,
    isHeadsetShell: nativeInfo.isMetaQuest,
    browserHandoffUrl,
    buttonLabel: "VR Unavailable",
    statusText: "Immersive VR is unavailable on this device.",
    usingDomOverlay: false,
  };
}

export async function launchVrBrowserHandoff(url?: string): Promise<boolean> {
  const targetUrl = String(url || resolveConfiguredVrBrowserLaunchUrl()).trim();
  if (!targetUrl) {
    return false;
  }
  try {
    const result = await VrShell.launchVrBrowser({ url: targetUrl });
    return result.launched === true;
  } catch {
    if (typeof window === "undefined") {
      return false;
    }
    const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
    return opened !== null;
  }
}

export function getDefaultVrBrowserLaunchUrl(): string {
  return resolveConfiguredVrBrowserLaunchUrl();
}
