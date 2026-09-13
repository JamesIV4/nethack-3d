import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchHostInteraction(checkout) {
  const edit = (file, apply) => {
    const name = path.join(checkout, file);
    writeFileSync(name, apply(readFileSync(name, "utf8").replaceAll("\r\n", "\n")));
  };
  edit("app/src/common/gecko/com/igalia/wolvic/browser/api/impl/SessionImpl.java", (source) =>
    source.includes("setClearColor(android.graphics.Color.TRANSPARENT)") ? source : replaceOnce(source,
      "        mSettings = new SettingsImpl(mSession.getSettings());",
      "        mSession.getCompositorController().setClearColor(android.graphics.Color.TRANSPARENT);\n        mSettings = new SettingsImpl(mSession.getSettings());", "transparent Gecko clear"));
  edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java", (source) =>
    source.includes("float[] getGameUiPose()") ? source : replaceOnce(source,
      "    final Object mCompositorLock = new Object();",
      "    @Keep\n    public float[] getGameUiPose() { return BundledGameServer.getUiPose(); }\n\n    final Object mCompositorLock = new Object();", "pane pose bridge"));
  edit("app/src/main/cpp/VRBrowser.h", (source) => source.includes("GetGameUiPose") ? source :
    replaceOnce(source, "int32_t GetPointerColor();", "int32_t GetPointerColor();\nbool GetGameUiPose(float aPose[17]);", "pane JNI header"));
  edit("app/src/main/cpp/VRBrowser.cpp", (source) => {
    if (source.includes("VRBrowser::GetGameUiPose")) return source;
    source = replaceOnce(source, "jmethodID sGetPointerColor = nullptr;", "jmethodID sGetPointerColor = nullptr;\njmethodID sGetGameUiPose = nullptr;", "pane JNI method");
    source = replaceOnce(source,
      "  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);",
      "  sGetGameUiPose = FindJNIMethodID(sEnv, sBrowserClass, \"getGameUiPose\", \"()[F\");\n  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);", "pane JNI binding");
    return source + `
bool crow::VRBrowser::GetGameUiPose(float aPose[17]) {
  if (!sEnv || !sActivity || !sGetGameUiPose) return false;
  auto pose = static_cast<jfloatArray>(sEnv->CallObjectMethod(sActivity, sGetGameUiPose));
  if (!pose) return false;
  const bool valid = sEnv->GetArrayLength(pose) == 17;
  if (valid) sEnv->GetFloatArrayRegion(pose, 0, 17, aPose);
  sEnv->DeleteLocalRef(pose);
  return valid;
}
`;
  });
  edit("app/src/main/cpp/ExternalVR.cpp", (source) => source
    .replace("controller.widget ? 0 : controller.immersivePressedState", "controller.immersivePressedState")
    .replace("controller.widget ? 0 : controller.immersiveTouchedState", "controller.immersiveTouchedState")
    .replace("controller.widget ? 0.0f : controller.immersiveTriggerValues[j]", "controller.immersiveTriggerValues[j]"));
  edit("app/src/main/cpp/BrowserWorld.cpp", (source) => {
    if (source.includes("NH3D shared pane pose")) return source;
    source = replaceOnce(source, `    // NH3D: keep pointer interaction with the live HTML pane during WebXR.
    bool relayoutGamePane = false;
    m.UpdateControllers(relayoutGamePane);
    if (relayoutGamePane) UpdateVisibleWidgets();
`, "", "game-owned XR pointers");
    const begin = source.indexOf("  // NH3D: composite live page/keyboard surfaces after the original WebXR eye image.");
    const end = source.indexOf("\n}", begin);
    if (begin < 0 || end < 0) throw new Error("Missing immersive pane compositor");
    return source.slice(0, begin) + `  // NH3D shared pane pose: the page owns DOM hit testing in the same tracking space.
  float pose[17];
  if (!VRBrowser::GetGameUiPose(pose)) return;
  struct SavedPane { WidgetPtr widget; vrb::Matrix transform; };
  std::vector<SavedPane> saved;
  for (const auto& widget : m.widgets) {
    if (widget->GetPlacement()->name != "Window") continue;
    float width, height;
    widget->GetWorldSize(width, height);
    saved.push_back({widget, widget->GetTransform()});
    const float scale = pose[16] / width;
    widget->SetTransform(vrb::Matrix::FromColumnMajor(pose).PostMultiply(
        vrb::Matrix::Identity().Scale(vrb::Vector(scale, scale, scale))));
  }
  const CameraPtr camera = aEye == device::Eye::Left ? m.leftCamera : m.rightCamera;
  m.rootTransparent->SetTransform(vrb::Matrix::Identity());
  VRB_GL_CHECK(glClear(GL_DEPTH_BUFFER_BIT));
  VRB_GL_CHECK(glDepthMask(GL_FALSE));
  m.drawList->Reset();
  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList);
  m.drawList->Draw(*camera);
  VRB_GL_CHECK(glDepthMask(GL_TRUE));
  for (const auto& pane : saved) {
    pane.widget->SetTransform(pane.transform);
  }` + source.slice(end);
  });
}
