import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

export const GECKO_REVISION = "dc6d11938934f4490158a1334dda9d143dffab46";
export const PAINT_PREFERENCE = "dom.vr.webxr.paint-document";
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function readGeckoArtifact(directory) {
  let receipt;
  try { receipt = JSON.parse(readFileSync(path.join(directory, "nh3d-gecko-runtime.json"), "utf8")); }
  catch { throw new Error("Patched GeckoView is missing. Run scripts/quest/webxr/build-gecko-runtime.sh in Linux/WSL first."); }
  if (receipt.schema !== 1 || receipt.revision !== GECKO_REVISION || receipt.paintDocument !== true || receipt.transparentDocument !== true || receipt.compositeDocument !== true ||
      !/^org\.mozilla\.geckoview:geckoview-default-omni:[\w.-]+$/.test(receipt.coordinate)) {
    throw new Error("Unexpected GeckoView artifact metadata.");
  }
  if (receipt.patchSha256 !== sha256(readFileSync(new URL("./patch-gecko-paint.py", import.meta.url)))) {
    throw new Error("Rebuild GeckoView: the paint patch has changed.");
  }
  const root = path.resolve(directory);
  for (const [name, hash] of Object.entries(receipt.files)) {
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || sha256(readFileSync(file)) !== hash) {
      throw new Error("GeckoView artifact failed verification: " + name);
    }
  }
  for (const extension of [".aar", ".pom", ".module"]) {
    if (!receipt.files[receipt.aar.replace(/\.aar$/, extension)]) throw new Error("Incomplete GeckoView Maven module.");
  }
  return receipt;
}
