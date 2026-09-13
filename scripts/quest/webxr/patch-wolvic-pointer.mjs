import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchWolvicPointer(checkout) {
  const edit = (file, fn) => { const p = path.join(checkout, file); writeFileSync(p, fn(readFileSync(p, "utf8").replaceAll("\r\n", "\n"))); };
  edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java", s => s.includes("float[] getGamePointerState()") ? s :
    replaceOnce(s, "    public float[] getGameUiPose() { return BundledGameServer.getUiPose(); }",
      "    public float[] getGameUiPose() { return BundledGameServer.getUiPose(); }\n    @Keep\n    public float[] getGamePointerState() { return BundledGameServer.getPointerState(); }", "native pointer snapshot"));
  edit("app/src/main/cpp/VRBrowser.h", s => s.includes("GetGamePointerState") ? s : s.replace("#include <memory>", "#include <memory>\n#include <vector>")
    .replace("bool GetGameUiPose(float aPose[17]);", "bool GetGameUiPose(float aPose[17]);\nvoid GetGamePointerState(std::vector<float>& aState);"));
  edit("app/src/main/cpp/VRBrowser.cpp", s => {
    if (s.includes("VRBrowser::GetGamePointerState")) return s;
    s = s.replace("jmethodID sGetGameUiPose = nullptr;", "jmethodID sGetGameUiPose = nullptr;\njmethodID sGetGamePointerState = nullptr;")
      .replace('  sGetGameUiPose = FindJNIMethodID(sEnv, sBrowserClass, "getGameUiPose", "()[F");',
        '  sGetGameUiPose = FindJNIMethodID(sEnv, sBrowserClass, "getGameUiPose", "()[F");\n  sGetGamePointerState = FindJNIMethodID(sEnv, sBrowserClass, "getGamePointerState", "()[F");');
    return s + `
void crow::VRBrowser::GetGamePointerState(std::vector<float>& aState) {
  if (!sEnv || !sActivity || !sGetGamePointerState) return;
  auto data = static_cast<jfloatArray>(sEnv->CallObjectMethod(sActivity, sGetGamePointerState));
  if (!data) return;
  const auto length = sEnv->GetArrayLength(data);
  if (length >= 10 && length <= 522) {
    aState.resize(length);
    sEnv->GetFloatArrayRegion(data, 0, length, aState.data());
  }
  sEnv->DeleteLocalRef(data);
}
`;
  });
  edit("app/src/main/cpp/Controller.h", s => s.includes("gameWorldCaptured") ? s : s.replace("  bool focused;", "  bool focused;\n  bool gameWorldCaptured = false;"));
  edit("app/src/main/cpp/Controller.cpp", s => s.includes("gameWorldCaptured") ? s : s
    .replace("  lastButtonState = aController.lastButtonState;", "  lastButtonState = aController.lastButtonState;\n  gameWorldCaptured = aController.gameWorldCaptured;")
    .replace("  lastButtonState = 0;", "  lastButtonState = 0;\n  gameWorldCaptured = false;"));
  edit("app/src/openxr/cpp/OpenXRInputSource.cpp", s => s.includes("NH3D native grip and aim") ? s :
    replaceOnce(s, "                delegate.SetImmersiveBeamTransform(mIndex,controllerTransform);", `                // NH3D native grip and aim match the WebXR target-ray pose.
                delegate.SetTransform(mIndex, controllerTransform);
                delegate.SetBeamTransform(mIndex, origAimTransform);
                delegate.SetImmersiveBeamTransform(mIndex,controllerTransform);`, "shared native aim"));
  edit("app/src/main/cpp/ExternalVR.cpp", s => {
    if (!s.includes("gameUiButtonMask")) s = s.replace("    immersiveController.numButtons = controller.numButtons;", `    immersiveController.numButtons = controller.numButtons;
    constexpr uint64_t gameUiButtonMask = (uint64_t(1) << device::kImmersiveButtonTrigger) |
        (uint64_t(1) << device::kImmersiveButtonTouchpad) | (uint64_t(1) << device::kImmersiveButtonA);`);
    s = s.replace(/immersiveController.buttonPressed = [^\n]+;/, "immersiveController.buttonPressed = controller.widget ? controller.immersivePressedState & ~gameUiButtonMask : controller.immersivePressedState;")
      .replace(/immersiveController.buttonTouched = [^\n]+;/, "immersiveController.buttonTouched = controller.widget ? controller.immersiveTouchedState & ~gameUiButtonMask : controller.immersiveTouchedState;")
      .replace(/immersiveController.triggerValue\[j\] = [^\n]+;/, "immersiveController.triggerValue[j] = controller.widget && (gameUiButtonMask & (uint64_t(1) << j)) ? 0.0f : controller.immersiveTriggerValues[j];");
    if (!s.includes("const auto gameTargetRay")) {
      s = s.replace("      vrb::Quaternion rotate(controller.transformMatrix.AfineInverse());", "      const auto gameTargetRay = controller.transformMatrix.PostMultiply(controller.beamTransformMatrix);\n      vrb::Quaternion rotate(gameTargetRay.AfineInverse());")
        .replace("vrb::Vector position(controller.transformMatrix.GetTranslation());", "vrb::Vector position(gameTargetRay.GetTranslation());");
    }
    return s;
  });
  edit("app/src/main/cpp/Pointer.cpp", s => s.includes("NH3D pointer geometry") ? s :
    replaceOnce(s, "  VRLayerQuadPtr layer = aDevice->CreateLayerQuad(36, 36, VRLayerQuad::SurfaceType::AndroidSurface);",
      "  // NH3D pointer geometry shares the page compositor in both modes.\n  VRLayerQuadPtr layer;", "continuous native pointer"));
  edit("app/src/main/cpp/BrowserWorld.cpp", s => {
    if (s.includes("NH3D unified Wolvic pointer")) return s
      .replace("  controllers->SetVisible(true);", "  if (!controllers->IsVisible()) controllers->SetVisible(true);")
      .replace("controller.gameWorldCaptured && pressed", "controller.gameWorldCaptured && (pressed || wasPressed)");
    s = s.replace("  void UpdateControllers(bool& aRelayoutWidgets);", `  // NH3D unified Wolvic pointer.
  std::vector<float> gamePointerState;
  bool gameUiAnchored = false;
  float gameAnchorRevision = -1;
  vrb::Matrix gameUiTransform = vrb::Matrix::Identity();
  void UpdateGameControls();
  bool GameUiHit(const WidgetPtr& widget, const vrb::Vector& point) const;
  void UpdateControllers(bool& aRelayoutWidgets);`);
    const helper = `
bool BrowserWorld::State::GameUiHit(const WidgetPtr& widget, const vrb::Vector& point) const {
  if (!externalVR->IsPresenting() || widget->GetPlacement()->name != "Window" || gamePointerState.size() < 10) return true;
  float x, y;
  widget->ConvertToWidgetCoordinates(point, x, y, false);
  int32_t width, height;
  widget->GetSurfaceTextureSize(width, height);
  if (width <= 0 || height <= 0) return false;
  x /= width; y /= height;
  for (size_t i = 10; i + 3 < gamePointerState.size(); i += 4) {
    if (x >= gamePointerState[i] && y >= gamePointerState[i + 1] && x <= gamePointerState[i + 2] && y <= gamePointerState[i + 3]) return true;
  }
  return false;
}

void BrowserWorld::State::UpdateGameControls() {
  VRBrowser::GetGamePointerState(gamePointerState);
  const float revision = gamePointerState.empty() ? 0 : gamePointerState[0];
  if (!gameUiAnchored || revision != gameAnchorRevision) {
    for (const auto& widget : widgets) {
      if (widget->GetPlacement()->name != "Window" || !widget->IsVisible()) continue;
      const auto head = device->GetHeadTransform();
      const auto forward = head.MultiplyDirection(vrb::Vector(0, 0, -1));
      const auto yaw = vrb::Matrix::Rotation(vrb::Vector(0, 1, 0), std::atan2(-forward.x(), -forward.z()));
      const auto center = head.GetTranslation() + yaw.MultiplyDirection(vrb::Vector(0, -0.20f, -1.45f));
      float width, height;
      widget->GetWorldSize(width, height);
      const float scale = 3.0f / width;
      gameUiTransform = vrb::Matrix::Translation(center).PostMultiply(yaw)
          .PostMultiply(vrb::Matrix::Identity().Scale(vrb::Vector(scale, scale, scale)))
          .PostMultiply(widget->GetTransform().AfineInverse());
      gameUiAnchored = true; gameAnchorRevision = revision;
      break;
    }
  }
  rootTransparent->SetTransform(gameUiTransform);
  drawList->Reset(); rootTransparent->Cull(*cullVisitor, *drawList);
  if (!controllers->IsVisible()) controllers->SetVisible(true);
  bool relayout = false;
  UpdateControllers(relayout);
}

`;
    s = replaceOnce(s, "void\nBrowserWorld::State::UpdateControllers(bool& aRelayoutWidgets) {", helper + "void\nBrowserWorld::State::UpdateControllers(bool& aRelayoutWidgets) {", "native pointer helpers");
    s = s.replace("    } else if (controllers->IsVisible()){", "    } else if (controllers->IsVisible() && !(externalVR->IsPresenting() && controller.gameWorldCaptured && (pressed || wasPressed))){")
      .replace("        hitWidget = previousWidget;\n        hitPoint = result;", "        hitWidget = previousWidget;\n        hitDistance = distance;\n        hitPoint = result;")
      .replace("          if (isInWidget && (distance < hitDistance)) {", "          if (isInWidget && (distance < hitDistance) && GameUiHit(widget, result)) {");
    s = s.replace("    // Used by some runtimes to perform visual optimizations", `    bool gameWorldHit = false;
    if (externalVR->IsPresenting()) {
      if (!pressed) controller.gameWorldCaptured = false;
      else if (!wasPressed && !hitWidget) controller.gameWorldCaptured = true;
      const size_t offset = controller.leftHanded ? 2 : 6;
      if (!hitWidget && gamePointerState.size() >= 10 && gamePointerState[offset] >= 0) {
        gameWorldHit = true;
        hitDistance = gamePointerState[offset];
        hitPoint = start + direction.Normalize() * hitDistance;
        hitNormal = controller.transformMatrix.PostMultiply(controller.beamTransformMatrix)
            .MultiplyDirection(vrb::Vector(gamePointerState[offset + 1], gamePointerState[offset + 2], gamePointerState[offset + 3])).Normalize();
      }
    }
    if (controller.beamParent) {
      const float distance = (hitWidget || gameWorldHit) ? hitDistance : 5.0f;
      controller.beamParent->SetTransform(controller.beamTransformMatrix.PostMultiply(vrb::Matrix::Identity().Scale(vrb::Vector(1, 1, distance))));
    }
    // Used by some runtimes to perform visual optimizations`);
    s = s.replace("!isMovingWindow && hitWidget.get() != nullptr && controller.hasAim", "!isMovingWindow && (hitWidget.get() != nullptr || gameWorldHit) && controller.hasAim")
      .replace("      if (hitWidget && controller.hasAim) {", "      if ((hitWidget || gameWorldHit) && controller.hasAim) {");
    const tick = s.indexOf("BrowserWorld::TickImmersive() {");
    const draw = s.indexOf("void\nBrowserWorld::DrawImmersive", tick);
    const section = s.slice(tick, draw).replaceAll("m.externalVR->PushFramePoses(", "m.UpdateGameControls();\n      m.externalVR->PushFramePoses(");
    s = s.slice(0, tick) + section + s.slice(draw);
    const start = s.indexOf("  // NH3D shared pane pose", s.indexOf("BrowserWorld::DrawImmersive"));
    const end = s.indexOf("\n}", start);
    if (start < 0 || end < 0) throw new Error("Missing game UI draw path");
    s = s.slice(0, start) + `  const CameraPtr camera = aEye == device::Eye::Left ? m.leftCamera : m.rightCamera;
  VRB_GL_CHECK(glClear(GL_DEPTH_BUFFER_BIT));
  m.drawList->Reset(); m.rootController->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);
  VRB_GL_CHECK(glDepthMask(GL_FALSE));
  m.rootTransparent->SetTransform(m.gameUiTransform);
  m.drawList->Reset(); m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);
  VRB_GL_CHECK(glDepthMask(GL_TRUE));` + s.slice(end);
    s = s.replace("    bool relayoutWidgets = false;", "    m.gameUiAnchored = false;\n    bool relayoutWidgets = false;");
    return s;
  });
}
