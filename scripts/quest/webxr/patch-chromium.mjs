import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { replaceOnce, WOLVIC_REVISION } from "./runtime-patch.mjs";

export const CHROMIUM_REVISION = "c45f7339cd6d087c9a9cb9130d2b42555a87f6cb";
const files = {
  surface: "wolvic/java/org/chromium/wolvic/TabCompositorView.java",
  contents: "wolvic/browser/wolvic_contents.cc",
};
function patch(sources) {
  return {
    surface: replaceOnce(sources.surface, "mNativeContentViewRenderView, PixelFormat.OPAQUE, width, height, surface,",
      "mNativeContentViewRenderView, PixelFormat.RGBA_8888, width, height, surface,", "Chromium alpha surface"),
    contents: replaceOnce(
      replaceOnce(sources.contents, '#include "wolvic/browser/wolvic_contents.h"',
        '#include "wolvic/browser/wolvic_contents.h"\n#include "third_party/skia/include/core/SkColor.h"', "Skia color declaration"),
      "WolvicContents::Init() {", "WolvicContents::Init() {\n  // NH3D: preserve transparent HTML over the separate WebXR eye images.\n  web_contents_->SetPageBaseBackgroundColor(SK_ColorTRANSPARENT);", "transparent page base"),
  };
}
const verify = process.argv.includes("--verify-upstream");
const directory = process.argv[2];
if (!verify && !directory) throw new Error("Usage: node scripts/quest/webxr/patch-chromium.mjs <chromium/src> (before building AARs)");
const sources = {};
if (verify) {
  for (const [key, file] of Object.entries(files)) {
    const response = await fetch("https://raw.githubusercontent.com/Igalia/wolvic-chromium/" + CHROMIUM_REVISION + "/" + file);
    if (!response.ok) throw new Error("Cannot read " + file);
    sources[key] = await response.text();
  }
} else {
  const revision = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
  if (revision !== CHROMIUM_REVISION) throw new Error("Check out the pinned Chromium revision first: " + CHROMIUM_REVISION);
  for (const [key, file] of Object.entries(files)) sources[key] = readFileSync(path.join(directory, file), "utf8");
}
const patched = patch(sources);
if (!verify) {
  for (const [key, file] of Object.entries(files)) writeFileSync(path.join(directory, file), patched[key]);
  writeFileSync(path.join(directory, "nh3d-runtime.json"), JSON.stringify({
    version: 1, wolvic: WOLVIC_REVISION, chromium: CHROMIUM_REVISION, alphaSurface: true,
  }, null, 2) + "\n");
}
console.log(verify ? "Pinned Chromium transparency patches apply; compilation remains unverified." :
  "Chromium transparency source patched. Build and fix both AARs, then copy nh3d-runtime.json with the runtime artifacts.");
