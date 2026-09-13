import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchTableUi(checkout) {
  const edit = (name, fn) => { const file = path.join(checkout, name); writeFileSync(file, fn(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))); };
  copyFileSync(fileURLToPath(new URL("../../../quest/webxr/host/GameUiPanels.h", import.meta.url)), path.join(checkout, "app/src/main/cpp/GameUiPanels.h"));
  edit("app/src/main/cpp/Quad.h", s => s.includes("void SetTextureRect") ? s : s.replace("  void SetTextureSize(int32_t aWidth, int32_t aHeight);", "  void SetTextureSize(int32_t aWidth, int32_t aHeight);\n  void SetTextureRect(const device::EyeRect& rect);"));
  edit("app/src/main/cpp/Quad.cpp", s => s.includes("Quad::SetTextureRect") ? s : s + `
void crow::Quad::SetTextureRect(const device::EyeRect& r) {
  auto array = m.geometry->GetVertexArray();
  array->SetUV(0, vrb::Vector(r.mX, r.mY + r.mHeight, 0));
  array->SetUV(1, vrb::Vector(r.mX + r.mWidth, r.mY + r.mHeight, 0));
  array->SetUV(2, vrb::Vector(r.mX + r.mWidth, r.mY, 0));
  array->SetUV(3, vrb::Vector(r.mX, r.mY, 0));
  m.geometry->UpdateBuffers();
}
`);
  edit("app/src/main/cpp/VRBrowser.cpp", s => s.replace("length >= 10 && length <= 522", "length >= 14 && length <= 551"));
  edit("app/src/main/cpp/ExternalVR.cpp", s => {
    if (!s.includes("gameUiEffectiveMask")) s = s.replace("    immersiveController.buttonPressed =", `    const uint64_t gameUiEffectiveMask = controller.leftHanded ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;
    immersiveController.buttonPressed =`);
    s = s.replaceAll("& ~gameUiButtonMask", "& ~gameUiEffectiveMask").replace("(gameUiButtonMask & (uint64_t(1) << j))", "(gameUiEffectiveMask & (uint64_t(1) << j))")
      .replace("immersiveController.axisValue[j] = controller.immersiveAxes[j];", "immersiveController.axisValue[j] = controller.widget && !(controller.leftHanded && (controller.buttonState & ControllerDelegate::BUTTON_TRIGGER)) ? 0.0f : controller.immersiveAxes[j];");
    return s;
  });
  edit("app/src/main/cpp/BrowserWorld.cpp", s => {
    const captureAnchor = "      const bool panel = externalVR->IsPresenting() && gamePanels && gamePanels->Owns(previousWidget);";
    const retainCapture = source => source.includes("Retain the browser capture") ? source : source.replace(captureAnchor, captureAnchor + `
      // Retain the browser capture if its pane disappears during a held gesture.
      if (panel) {
        hitWidget = previousWidget; hitPoint = controller.pointerWorldPoint;
        hitNormal = (start - hitPoint).Normalize(); hitDistance = (start - hitPoint).Magnitude();
      }`);
    if (s.includes("NH3D table UI panels")) return retainCapture(s);
    s = '#include "GameUiPanels.h"\n' + s;
    s = s.replace("  std::vector<float> gamePointerState;", `  // NH3D table UI panels share one browser surface.
  std::unique_ptr<GameUiPanels> gamePanels;
  vrb::Matrix gameAnchor = vrb::Matrix::Identity();
  WidgetPtr gameWindow;
  std::vector<float> gamePointerState;`);
    s = s.replace('  if (!externalVR->IsPresenting() || widget->GetPlacement()->name != "Window" || gamePointerState.size() < 10) return true;',
      '  if (!externalVR->IsPresenting() || widget->GetPlacement()->name != "Window" || gamePointerState.size() < 14 || (gamePanels && gamePanels->Owns(widget))) return true;');
    s = s.replace("for (size_t i = 10; i + 3 < gamePointerState.size(); i += 4)", "for (size_t i = 14; i + 3 < 14 + size_t(gamePointerState[1]) * 4; i += 4)");
    s = s.replace("      const auto center = head.GetTranslation() + yaw.MultiplyDirection(vrb::Vector(0, -0.20f, -1.45f));", `      gameAnchor = vrb::Matrix::Translation(head.GetTranslation()).PostMultiply(yaw);
      gameWindow = widget;
      const auto center = head.GetTranslation() + yaw.MultiplyDirection(vrb::Vector(0, -0.20f, -1.45f));`);
    s = s.replace("  rootTransparent->SetTransform(gameUiTransform);", `  if (gameWindow && gamePointerState.size() >= 14) {
    if (!gamePanels) gamePanels = std::make_unique<GameUiPanels>(create);
    const auto board = gameAnchor.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, gamePointerState[12], -1.55f)))
        .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), gamePointerState[11]));
    const auto center = gameAnchor.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, -0.20f, -1.45f)));
    gamePanels->Update(gameWindow, gamePointerState, board, center);
  }
  rootTransparent->SetTransform(gameUiTransform);`);
    s = replaceOnce(s, `      if (previousWidget->TestControllerIntersection(start, direction, result, normal, false,
                                                     isInWidget, distance)) {`, `      const bool panel = externalVR->IsPresenting() && gamePanels && gamePanels->Owns(previousWidget);
      if (panel ? gamePanels->Hit(controller.index, true, start, direction, gamePointerState, result, normal, distance) :
          previousWidget->TestControllerIntersection(start, direction, result, normal, false, isInWidget, distance)) {`, "captured pane picking");
    s = replaceOnce(s, "        if (widget->TestControllerIntersection(start, direction, result, normal, clamp, isInWidget, distance)) {", `        const bool panel = externalVR->IsPresenting() && gamePanels && gamePanels->Owns(widget);
        const bool hit = panel ? gamePanels->Hit(controller.index, false, start, direction, gamePointerState, result, normal, distance) :
            widget->TestControllerIntersection(start, direction, result, normal, clamp, isInWidget, distance);
        if (panel) isInWidget = hit;
        if (hit) {`, "multi-pane picking");
    s = s.replace("      hitWidget->ConvertToWidgetCoordinates(hitPoint, theX, theY, !isDragging);", `      if (externalVR->IsPresenting() && gamePanels && gamePanels->Owns(hitWidget)) gamePanels->Coordinates(controller.index, theX, theY);
      else hitWidget->ConvertToWidgetCoordinates(hitPoint, theX, theY, !isDragging);`);
    s = s.replace("    const bool pressed = controller.buttonState & ControllerDelegate::BUTTON_TRIGGER ||", "    const bool runHand = externalVR->IsPresenting() && controller.leftHanded;\n    const bool pressed = (!runHand && (controller.buttonState & ControllerDelegate::BUTTON_TRIGGER)) ||")
      .replace("    const bool wasPressed = controller.lastButtonState & ControllerDelegate::BUTTON_TRIGGER ||", "    const bool wasPressed = (!runHand && (controller.lastButtonState & ControllerDelegate::BUTTON_TRIGGER)) ||")
      .replace("      HandleControllerScroll(controller, controller.widget);", "      if (!(runHand && (controller.buttonState & ControllerDelegate::BUTTON_TRIGGER))) HandleControllerScroll(controller, controller.widget);");
    s = s.replace("  m.drawList->Reset(); m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);", `  const auto source = m.gamePanels ? m.gamePanels->Source() : nullptr;
  if (source) source->ToggleWidget(false);
  m.drawList->Reset();
  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);
  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);
  if (source) source->ToggleWidget(true);`);
    return retainCapture(s);
  });
}
