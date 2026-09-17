import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchAppQuit(checkout) {
  const file = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java");
  const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  if (source.includes("// NH3D quit exits the Android task, not the Gecko tab.")) return;
  writeFileSync(file, replaceOnce(source, "        BundledGameServer.start(getApplicationContext());", `        BundledGameServer.start(getApplicationContext());
        // NH3D quit exits the Android task, not the Gecko tab.
        if (BuildConfig.NH3D_GAME_HOST) {
            BundledGameServer.setQuitHandler(() -> runOnUiThread(this::finishAndRemoveTask));
        }`, "VR app quit lifecycle"));
}
