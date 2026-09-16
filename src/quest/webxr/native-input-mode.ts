import { uiHitRectangles } from "./dom-pointer";
import { isQuestBrowser } from "./host";

let flatFps = false;
let refresh: (() => void) | null = null;

/** Called by the engine whenever its flat play mode changes. */
export function setNativeInputModeFps(value: boolean): void {
  if (flatFps === value) return;
  flatFps = value;
  refresh?.();
}

/**
 * The native host sees one WindowWidget for both the game canvas and HTML.
 * Send its current FPS mode and HTML hit regions so it can retain mouse hover
 * only over flat FPS world space. The renderer canvas is deliberately absent:
 * it is the world-space exception, never an HTML control.
 */
export function initializeNativeInputMode(): () => void {
  if (!isQuestBrowser()) return () => undefined;
  const abort = new AbortController();
  let queued = false, sending = false, dirty = false, last = "", disposed = false;
  const update = (): void => {
    dirty = true;
    if (queued || sending || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (disposed) return;
      const mouseWorld = flatFps && !document.documentElement.classList.contains("nh3d-webxr-active");
      const body = JSON.stringify(mouseWorld ? [1, ...uiHitRectangles({ excludeRendererCanvas: true })] : [0]);
      dirty = false;
      if (body === last) return;
      sending = true;
      void fetch("/__xr/input-mode", {
        method: "POST", headers: { "Content-Type": "application/json" }, body, signal: abort.signal,
      }).then(response => {
        if (!response.ok) throw new Error("Native input-mode bridge: " + response.status);
        last = body;
      }).catch(error => { if (!disposed) console.warn(error); }).finally(() => {
        sending = false;
        if (dirty) update();
      });
    });
  };
  refresh = update;
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  window.addEventListener("resize", update, { signal: abort.signal });
  document.addEventListener("scroll", update, { capture: true, signal: abort.signal });
  update();
  return () => {
    disposed = true;
    if (refresh === update) refresh = null;
    observer.disconnect(); abort.abort();
  };
}
