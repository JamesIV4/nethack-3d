/** Localhost detection and platform window bridges. */
import { isQuestApk } from "../../../quest/webxr/host";
import { t } from "./translations";
export function isRunningOnLocalhost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const hostname = String(window.location.hostname || "")
    .trim()
    .toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

export type Nh3dElectronBridge = {
  quitGame?: () => Promise<unknown>;
  signalAppRendered?: () => void;
};

export type Nh3dAndroidBridge = {
  quitGame?: () => void;
};

export type Nh3dWindowBridges = Window & {
  nh3dElectron?: Nh3dElectronBridge;
  nh3dAndroid?: Nh3dAndroidBridge;
};

export async function requestGameQuit(): Promise<void> {
  if (isQuestApk()) {
    const response = await fetch("/__xr/quit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[]",
    });
    if (!response.ok) throw new Error(t.webxr.hostQuitError);
    return;
  }
  const bridgeWindow = window as Nh3dWindowBridges;
  const electronBridge = bridgeWindow.nh3dElectron;
  if (typeof electronBridge?.quitGame === "function") {
    await electronBridge.quitGame();
    return;
  }

  const androidBridge = bridgeWindow.nh3dAndroid;
  if (typeof androidBridge?.quitGame === "function") {
    androidBridge.quitGame();
    return;
  }

  window.close();
}
