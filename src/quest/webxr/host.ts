/** The bundled Quest browser uses controller taps as touch gestures outside XR. */
export function isQuestBrowser(): boolean {
  return typeof location !== "undefined" && (new URLSearchParams(location.search).get("xrHost") === "native" || location.origin === "http://127.0.0.1:18973");
}
