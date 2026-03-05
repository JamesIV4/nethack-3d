import { WebPlugin } from "@capacitor/core";

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

export class VrShellWeb
  extends WebPlugin
{
  async getDeviceInfo(): Promise<NativeVrShellInfo> {
    const userAgent =
      typeof navigator === "undefined"
        ? ""
        : String(navigator.userAgent || "").toLowerCase();
    const isMetaQuest =
      userAgent.includes("quest") || userAgent.includes("oculus");
    return {
      isNativePlatform: false,
      manufacturer: "",
      model: "",
      isMetaQuest,
      hasQuestBrowser: isMetaQuest,
    };
  }

  async launchVrBrowser(options: {
    url: string;
  }): Promise<LaunchVrBrowserResult> {
    const url = String(options?.url || "").trim();
    if (!url || typeof window === "undefined") {
      return { launched: false };
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return { launched: opened !== null };
  }
}
