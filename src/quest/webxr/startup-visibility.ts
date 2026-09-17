import { isQuestApk } from "./host";

/** Explicit flat startup or XR failure must remain recoverable in the APK. */
export async function revealFlatStartup(): Promise<void> {
  if (!isQuestApk()) return;
  try {
    const response = await fetch("/__xr/startup-flat-ready", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "[]",
    });
    if (!response.ok) throw new Error(`Startup visibility: ${response.status}`);
  } catch (error) { console.warn("Could not reveal the startup recovery UI", error); }
}
