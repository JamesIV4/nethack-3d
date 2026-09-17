import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { patchSystemUi } from "./patch-system-ui.mjs";

test("system recenter and immersive-only chrome filtering apply once without changing standalone rendering", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "nh3d-system-ui-"));
  const files = {
    "app/src/openxr/cpp/DeviceDelegateOpenXR.cpp": `
  bool reorientRequested { false };
      case XR_TYPE_EVENT_DATA_REFERENCE_SPACE_CHANGE_PENDING:
        m.firstPose = std::nullopt;
        m.reorientRequested = true;
        VRB_DEBUG("OpenXR: reference space changed. User recentered the view?");
        break;
  if (m.reorientRequested && m.renderMode == device::RenderMode::StandAlone) {
  }
`,
    "app/src/main/cpp/VRBrowser.h": "void OnControllersAvailable();",
    "app/src/main/cpp/VRBrowser.cpp": `jmethodID sGetGamePointerState = nullptr;
  sGetGamePointerState = FindJNIMethodID(sEnv, sBrowserClass, "getGamePointerState", "()[F");`,
    "app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java": `    @Keep
    @SuppressWarnings("unused")
    void handleMotionEvent() {}`,
    "app/src/main/cpp/BrowserWorld.cpp": `
void BrowserWorld::DrawStandalone() {
  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);
}
void
BrowserWorld::DrawImmersive(device::Eye aEye) {
  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);
  m.DrawImmersiveKeyboard(*camera);
  m.DrawKeyboardDialogs(*camera);
}
void
BrowserWorld::TickWebXRInterstitial() {}
        if (externalVR->IsPresenting() && widget->GetPlacement()->name == "Window" &&
            condition) continue;
`,
  };
  try {
    for (const [file, source] of Object.entries(files)) {
      const target = path.join(root, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, source);
    }
    patchSystemUi(root);
    const result = Object.fromEntries(Object.keys(files).map(file => [file, readFileSync(path.join(root, file), "utf8")]));
    const world = result["app/src/main/cpp/BrowserWorld.cpp"];
    assert.equal(world.split("rootTransparent->Cull").length - 1, 1);
    assert.match(world, /DrawStandalone\(\)[\s\S]*rootTransparent->Cull/);
    assert.match(world, /KeyboardPriority\(widget\) == 0/);
    assert.match(world, /DrawImmersiveKeyboard\(\*camera\)/);
    assert.match(world, /DrawKeyboardDialogs\(\*camera\)/);
    assert.match(result["app/src/openxr/cpp/DeviceDelegateOpenXR.cpp"], /m.predictedDisplayTime >= m.gameRecenterTime/);
    assert.match(result["app/src/openxr/cpp/DeviceDelegateOpenXR.cpp"], /m.gameRecenterTime = 0;\n    VRBrowser::OnGameSystemRecenter/);
    patchSystemUi(root);
    for (const file of Object.keys(files)) assert.equal(readFileSync(path.join(root, file), "utf8"), result[file]);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("nh3d-system-ui-"));
    rmSync(root, { recursive: true, force: true });
  }
});
