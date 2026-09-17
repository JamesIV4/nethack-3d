import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchSystemUi(checkout) {
  function edit(name, marker, fn) {
    const file = path.join(checkout, name);
    const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
    if (!source.includes(marker)) writeFileSync(file, fn(source));
  }
  edit("app/src/openxr/cpp/DeviceDelegateOpenXR.cpp", "NH3D system recenter", source => {
    source = replaceOnce(source, "  bool reorientRequested { false };",
      "  bool reorientRequested { false };\n  XrTime gameRecenterTime = 0; // NH3D system recenter", "system recenter pending time");
    source = replaceOnce(source, `      case XR_TYPE_EVENT_DATA_REFERENCE_SPACE_CHANGE_PENDING:
        m.firstPose = std::nullopt;
        m.reorientRequested = true;
        VRB_DEBUG("OpenXR: reference space changed. User recentered the view?");
        break;`, `      case XR_TYPE_EVENT_DATA_REFERENCE_SPACE_CHANGE_PENDING: {
        m.firstPose = std::nullopt;
        m.reorientRequested = true;
        const auto& change = *reinterpret_cast<const XrEventDataReferenceSpaceChangePending*>(ev);
        if (change.referenceSpaceType == XR_REFERENCE_SPACE_TYPE_LOCAL || change.referenceSpaceType == XR_REFERENCE_SPACE_TYPE_STAGE)
          m.gameRecenterTime = change.changeTime;
        VRB_DEBUG("OpenXR: reference space changed. User recentered the view?");
        break;
      }`, "system reference space change");
    return replaceOnce(source, "  if (m.reorientRequested && m.renderMode == device::RenderMode::StandAlone) {", `  // Notify only once poses use the new origin; the page then runs its normal
  // world/UI recenter path. The reserved Meta button stays owned by the system.
  if (m.gameRecenterTime && m.predictedDisplayTime >= m.gameRecenterTime) {
    m.gameRecenterTime = 0;
    VRBrowser::OnGameSystemRecenter();
  }
  if (m.reorientRequested && m.renderMode == device::RenderMode::StandAlone) {`, "notify game at effective recenter time");
  });
  edit("app/src/main/cpp/VRBrowser.h", "OnGameSystemRecenter", source => replaceOnce(source,
    "void OnControllersAvailable();", "void OnControllersAvailable();\nvoid OnGameSystemRecenter();", "system recenter JNI declaration"));
  edit("app/src/main/cpp/VRBrowser.cpp", "OnGameSystemRecenter", source => {
    source = replaceOnce(source, "jmethodID sGetGamePointerState = nullptr;",
      "jmethodID sGetGamePointerState = nullptr;\njmethodID sOnGameSystemRecenter = nullptr;", "system recenter JNI state");
    source = replaceOnce(source, '  sGetGamePointerState = FindJNIMethodID(sEnv, sBrowserClass, "getGamePointerState", "()[F");',
      '  sGetGamePointerState = FindJNIMethodID(sEnv, sBrowserClass, "getGamePointerState", "()[F");\n  sOnGameSystemRecenter = FindJNIMethodID(sEnv, sBrowserClass, "onGameSystemRecenter", "()V");', "system recenter JNI lookup");
    return source + `
void crow::VRBrowser::OnGameSystemRecenter() {
  if (sEnv && sActivity && sOnGameSystemRecenter) sEnv->CallVoidMethod(sActivity, sOnGameSystemRecenter);
}
`;
  });
  edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java", "onGameSystemRecenter", source => replaceOnce(source,
    "    @Keep\n    @SuppressWarnings(\"unused\")\n    void handleMotionEvent", `    @Keep
    public void onGameSystemRecenter() {
        BundledGameServer.onSystemRecenter();
    }

    @Keep
    @SuppressWarnings("unused")
    void handleMotionEvent`, "system recenter activity callback"));
  edit("app/src/main/cpp/BrowserWorld.cpp", "NH3D exclude flat browser chrome", source => {
    const start = source.indexOf("BrowserWorld::DrawImmersive(device::Eye aEye) {");
    const end = source.indexOf("\nvoid\nBrowserWorld::TickWebXRInterstitial", start);
    if (start < 0 || end < 0) throw new Error("Missing immersive compositor");
    const body = replaceOnce(source.slice(start, end),
      "  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);",
      "  // NH3D exclude flat browser chrome: only game panes and the explicitly\n  // composed keyboard/speech/permission surfaces belong in immersive space.\n  m.drawList->Draw(*camera);", "hide flat browser chrome in VR");
    source = source.slice(0, start) + body + source.slice(end);
    return replaceOnce(source,
      '        if (externalVR->IsPresenting() && widget->GetPlacement()->name == "Window" &&',
      '        if (externalVR->IsPresenting() && KeyboardPriority(widget) == 0 && (!gamePanels || !gamePanels->Owns(widget))) continue;\n        if (externalVR->IsPresenting() && widget->GetPlacement()->name == "Window" &&', "exclude chrome from immersive ray hits");
  });
}
