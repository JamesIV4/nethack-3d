/** The bundled Quest browser uses controller taps as touch gestures outside XR. */
export function isWebXrHost(): boolean {
  return isQuestBrowser() || (typeof location !== "undefined" && new URLSearchParams(location.search).get("xrHost") === "wired");
}

export function isQuestBrowser(): boolean {
  return typeof location !== "undefined" && (new URLSearchParams(location.search).get("xrHost") === "native" || location.origin === "http://127.0.0.1:18973");
}
