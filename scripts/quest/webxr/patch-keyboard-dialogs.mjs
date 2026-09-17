import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

/** Native keyboard controls and speech/permission surfaces share the foreground VR pass. */
export function patchKeyboardDialogs(checkout) {
  function patch(relative, marker, apply) {
    const file = path.join(checkout, relative);
    const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
    if (!source.includes(marker)) writeFileSync(file, apply(source));
  }
  const java = "app/src/common/shared/com/igalia/wolvic/";
  patch(java + "ui/widgets/KeyboardWidget.java", "NH3D explicit keyboard dismissal", source => {
    source = replaceOnce(source, "    public void dismiss() {", `    public void dismiss() {
        // NH3D explicit keyboard dismissal: Close/B closes the whole keyboard,
        // even when a language, long-press or candidate overlay was visible.
        if (BuildConfig.NH3D_GAME_HOST && MotionEventGenerator.gameImmersive) hideOverlays();`, "dismiss full keyboard");
    return source;
  });
  patch(java + "VRBrowserActivity.java", "NH3D direct keyboard back", source => replaceOnce(source,
    "    void handleBack() {\n        runOnUiThread(() -> {", `    void handleBack() {
        runOnUiThread(() -> {
            // NH3D direct keyboard back: do not send a synthetic physical key
            // through Gecko's text connection before the native overlay closes.
            if (BuildConfig.NH3D_GAME_HOST && mIsPresentingImmersive.getValue()) {
                if (mActiveDialog != null && mActiveDialog.isVisible()) {
                    if (!mBackHandlers.isEmpty()) mBackHandlers.getLast().run();
                    return;
                }
                if (mKeyboard != null && mKeyboard.isVisible()) {
                    mKeyboard.dismiss();
                    return;
                }
            }`, "direct keyboard and speech back"));
  patch(java + "ui/widgets/dialogs/UIDialog.java", "NH3D native dialog GPU surface", source => replaceOnce(source,
    "        mWidgetPlacement.cylinder = false;", `        mWidgetPlacement.cylinder = false;
        // NH3D native dialog GPU surface: compositor layers sit behind WebXR.
        if (com.igalia.wolvic.BuildConfig.NH3D_GAME_HOST) mWidgetPlacement.layer = false;`, "speech and permission GPU surfaces"));

  patch("app/src/main/cpp/BrowserWorld.cpp", "NH3D keyboard auxiliary surfaces", source => {
    source = replaceOnce(source, "  void UpdateTrackedKeyboard();", `  // NH3D keyboard auxiliary surfaces: detached, like the keyboard itself.
  struct KeyboardDialog { WidgetPtr widget; vrb::Matrix original; vrb::Matrix pose; };
  std::vector<KeyboardDialog> keyboardDialogs;
  void PrepareKeyboardDialogs();
  void RestoreKeyboardDialogs();
  void DrawKeyboardDialogs(const vrb::Camera& camera);
  int KeyboardPriority(const WidgetPtr& widget) const;
  void UpdateTrackedKeyboard();`, "keyboard dialog state");
    const methods = `// NH3D keyboard dialog methods begin
int
BrowserWorld::State::KeyboardPriority(const WidgetPtr& widget) const {
  if (!widget || !externalVR->IsPresenting()) return 0;
  for (const auto& dialog : keyboardDialogs) if (dialog.widget == widget) return 2;
  return widget == immersiveKeyboard ? 1 : 0;
}

void
BrowserWorld::State::RestoreKeyboardDialogs() {
  for (const auto& dialog : keyboardDialogs) {
    dialog.widget->SetTransform(dialog.original);
    for (const auto& widget : widgets) if (widget == dialog.widget) {
      rootTransparent->AddNode(widget->GetRoot()); break;
    }
  }
  keyboardDialogs.clear();
}

void
BrowserWorld::State::PrepareKeyboardDialogs() {
  for (auto it = keyboardDialogs.begin(); it != keyboardDialogs.end();) {
    bool registered = false;
    for (const auto& widget : widgets) if (widget == it->widget) { registered = true; break; }
    if (!registered || !it->widget->GetPlacement()->visible) {
      it->widget->SetTransform(it->original);
      if (registered) rootTransparent->AddNode(it->widget->GetRoot());
      it = keyboardDialogs.erase(it);
    } else ++it;
  }
  for (const auto& widget : widgets) {
    const auto placement = widget->GetPlacement();
    if (!placement || !placement->visible ||
        (placement->name != "VoiceSearchWidget" && placement->name != "PermissionWidget")) continue;
    bool found = false;
    for (const auto& dialog : keyboardDialogs) if (dialog.widget == widget) { found = true; break; }
    if (!found) {
      const auto head = device->GetHeadTransform();
      const auto forward = head.MultiplyDirection(vrb::Vector(0, 0, -1));
      const auto yaw = vrb::Matrix::Rotation(vrb::Vector(0, 1, 0), std::atan2(-forward.x(), -forward.z()));
      const auto center = head.GetTranslation() + yaw.MultiplyDirection(vrb::Vector(0, -0.15f, -0.8f));
      keyboardDialogs.push_back({widget, widget->GetTransform(),
          vrb::Matrix::Translation(center).PostMultiply(ImmersiveKeyboardFacing(center))});
      widget->GetRoot()->RemoveFromParents();
    }
  }
  for (const auto& dialog : keyboardDialogs) {
    dialog.widget->SetTransform(dialog.pose);
    dialog.widget->ToggleWidget(true);
    drawList->Reset();
    dialog.widget->GetRoot()->Cull(*cullVisitor, *drawList);
  }
}

void
BrowserWorld::State::DrawKeyboardDialogs(const vrb::Camera& camera) {
  for (const auto& dialog : keyboardDialogs) {
    if (!dialog.widget->GetPlacement()->visible) continue;
    VRB_GL_CHECK(glDepthMask(GL_TRUE));
    VRB_GL_CHECK(glClear(GL_DEPTH_BUFFER_BIT));
    VRB_GL_CHECK(glDepthMask(GL_FALSE));
    drawList->Reset();
    dialog.widget->GetRoot()->Cull(*cullVisitor, *drawList);
    drawList->Draw(camera);
  }
}

`;
    source = replaceOnce(source, "void\nBrowserWorld::State::UpdateTrackedKeyboard() {", methods + "void\nBrowserWorld::State::UpdateTrackedKeyboard() {", "keyboard dialog methods");
    source = replaceOnce(source, "  SyncImmersiveKeyboard();", "  SyncImmersiveKeyboard();\n  PrepareKeyboardDialogs();", "keyboard dialog hit transforms");
    source = replaceOnce(source, "    externalVR->StopPresenting();", "    RestoreKeyboardDialogs();\n    externalVR->StopPresenting();", "restore dialogs on exit");
    source = replaceOnce(source, "    m.RestoreImmersiveKeyboard();", "    m.RestoreImmersiveKeyboard();\n    m.RestoreKeyboardDialogs();", "restore dialogs outside VR");
    source = replaceOnce(source, "  for (const auto& window : hiddenWindows) window->ToggleWidget(true);", "  m.DrawKeyboardDialogs(*camera);\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);", "foreground speech rendering");
    source = replaceOnce(source,
      `          if (isInWidget && (distance < hitDistance || keyboardForeground) &&
              (!immersiveKeyboard || hitWidget != immersiveKeyboard || keyboardForeground) && GameUiHit(widget, result)) {`,
      `          const int priority = KeyboardPriority(widget), previousPriority = KeyboardPriority(hitWidget);
          if (isInWidget && (priority > previousPriority || (priority == previousPriority && distance < hitDistance)) && GameUiHit(widget, result)) {`, "speech controls ahead of keyboard");
    source = source.replace("const bool keyboardVisible = externalVR->IsPresenting() && immersiveKeyboard && immersiveKeyboard->GetPlacement()->visible;",
      "const bool keyboardVisible = externalVR->IsPresenting() && (!keyboardDialogs.empty() || (immersiveKeyboard && immersiveKeyboard->GetPlacement()->visible));");
    source = source.replace("(keyboardBackHeld || (immersiveKeyboard && hitWidget == immersiveKeyboard))", "(keyboardBackHeld || KeyboardPriority(hitWidget) > 0)");
    source = replaceOnce(source,
      "            widget->TestControllerIntersection(start, direction, result, normal, clamp, isInWidget, distance);",
      "            KeyboardPriority(widget) > 0 ? KeyboardIntersection(widget, start, direction, result, normal, isInWidget, distance) :\n            widget->TestControllerIntersection(start, direction, result, normal, clamp, isInWidget, distance);", "keyboard ray uses rendered quad");
    source = replaceOnce(source,
      "          previousWidget->TestControllerIntersection(start, direction, result, normal, false, isInWidget, distance)) {",
      "          KeyboardPriority(previousWidget) > 0 ? KeyboardIntersection(previousWidget, start, direction, result, normal, isInWidget, distance) :\n          previousWidget->TestControllerIntersection(start, direction, result, normal, false, isInWidget, distance)) {", "keyboard drag ray uses rendered quad");
    return source;
  });
  patch("app/src/main/cpp/BrowserWorld.cpp", "NH3D dialog input focus", source => {
    source = replaceOnce(source, "  int KeyboardPriority(const WidgetPtr& widget) const;", `  int KeyboardPriority(const WidgetPtr& widget) const;
  bool KeyboardForegroundHit(const vrb::Vector& start, const vrb::Vector& direction) const;`, "dialog foreground helper");
    source = replaceOnce(source, "// NH3D keyboard dialog methods begin\n", `// NH3D keyboard dialog methods begin
// NH3D dialog input focus: speech/permission controls own the same input path.
bool
BrowserWorld::State::KeyboardForegroundHit(const vrb::Vector& start, const vrb::Vector& direction) const {
  if (ImmersiveKeyboardHit(start, direction)) return true;
  for (const auto& dialog : keyboardDialogs) {
    vrb::Vector point, normal; bool inside = false; float distance;
    if (KeyboardIntersection(dialog.widget, start, direction, point, normal, inside, distance) && inside) return true;
  }
  return false;
}

`, "dialog foreground ray");
    source = replaceOnce(source, "        ImmersiveKeyboardHit(controller.StartPoint(), controller.Direction());",
      "        KeyboardForegroundHit(controller.StartPoint(), controller.Direction());", "dialog controller focus");
    source = replaceOnce(source,
      `    const bool keyboardCapture = externalVR->IsPresenting() && immersiveKeyboard &&
        (keyboardForeground || controller.widget == immersiveKeyboard->GetHandle());`,
      `    const bool keyboardCapture = externalVR->IsPresenting() &&
        (keyboardForeground || controller.gameKeyboardCaptured);`, "dialog trigger ownership");
    source = replaceOnce(source,
      `    const bool wasKeyboardGrip = externalVR->IsPresenting() && immersiveKeyboard &&
        controller.widget == immersiveKeyboard->GetHandle() && (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE);`,
      `    const bool wasKeyboardGrip = externalVR->IsPresenting() && controller.gameKeyboardCaptured &&
        (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE);`, "dialog grip ownership");
    return source;
  });
}
