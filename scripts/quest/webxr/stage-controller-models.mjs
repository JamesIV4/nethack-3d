import { cpSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const assets = fileURLToPath(new URL("../../../quest/webxr/controllers/meta-touch-plus/", import.meta.url));

export function stageControllerModels(checkout) {
  // Keep the native loader's existing names, model selection and grip transform.
  // Scope these Meta assets to the Oculus APK, not the web or other headsets.
  const target = path.join(checkout, "app/src/oculusvr/assets");
  mkdirSync(target, { recursive: true });
  for (const hand of ["left", "right"]) {
    for (const extension of ["obj", "mtl", "ktx"]) {
      const name = `vr_controller_metaquest3_${hand}.${extension}`;
      const source = path.join(assets, "native", name);
      if (!readFileSync(source).length) throw new Error(`Empty Meta controller asset: ${name}`);
      cpSync(source, path.join(target, name));
    }
  }
  const licenses = path.join(target, "licenses");
  mkdirSync(licenses, { recursive: true });
  cpSync(path.join(assets, "LICENSE.md"), path.join(licenses, "meta-touch-plus-LICENSE.txt"));
  cpSync(path.join(assets, "README.md"), path.join(licenses, "meta-touch-plus-NOTICE.txt"));
}
