import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

/**
 * Keep Wolvic's keyboard on one cached headset-facing transform while the
 * game replaces the ordinary WindowWidget draw with cropped HTML panes. Gecko
 * reports input focus through restartInput (including viewless sessions);
 * showSoftInput is only the visibility request that follows it.
 */
export function patchKeyboard(checkout) {
  const file = path.join(
    checkout,
    "app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java",
  );
  let source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const stockCallbacks = `    @Override
    public void restartInput(@NonNull WSession session, int reason) {
        resetKeyboardLayout();
        mInputRestarted = true;
    }

    @Override
    public void showSoftInput(@NonNull WSession session) {
        if (mFocusedView != mAttachedWindow || getVisibility() != View.VISIBLE || mInputRestarted) {
            post(() -> updateFocusedView(mAttachedWindow));
        }
        mInputRestarted = false;
    }`;
  const patchedCallbacks = `    private void updateImmersiveInput() {
        if (mAttachedWindow != null) updateFocusedView(mAttachedWindow);
    }

    @Override
    public void restartInput(@NonNull WSession session, int reason) {
        mInputRestarted = true;
        if (BuildConfig.NH3D_GAME_HOST && MotionEventGenerator.gameImmersive) {
            // Gecko guarantees this focus callback for viewless sessions.
            post(this::updateImmersiveInput);
        } else {
            resetKeyboardLayout();
        }
    }

    @Override
    public void showSoftInput(@NonNull WSession session) {
        if (BuildConfig.NH3D_GAME_HOST && MotionEventGenerator.gameImmersive) {
            post(this::updateImmersiveInput);
        } else if (mFocusedView != mAttachedWindow || getVisibility() != View.VISIBLE || mInputRestarted) {
            post(() -> updateFocusedView(mAttachedWindow));
        }
        mInputRestarted = false;
    }`;
  if (!source.includes(patchedCallbacks) && source.includes("NH3D immersive page input")) {
    const begin = source.indexOf("    @Override\n    public void restartInput(@NonNull WSession session, int reason) {");
    const end = source.indexOf("\n\n    @Override\n    public void hideSoftInput", begin);
    if (begin < 0 || end <= begin) throw new Error("Missing prior keyboard callbacks");
    source = replaceOnce(source, source.slice(begin, end), patchedCallbacks, "upgrade Wolvic keyboard input callbacks");
  } else if (!source.includes(patchedCallbacks)) source = replaceOnce(source, stockCallbacks, patchedCallbacks, "Wolvic keyboard input callbacks");
  if (!source.includes("import com.igalia.wolvic.BuildConfig;")) source = source.replace(
    "import com.igalia.wolvic.R;",
    "import com.igalia.wolvic.R;\nimport com.igalia.wolvic.BuildConfig;\nimport com.igalia.wolvic.input.MotionEventGenerator;",
  );
  const stockKeyboardSurface = `        // FIXME: keyboard is misplaced when rendered in a cylinder layer.
        aPlacement.cylinder = false;
        aPlacement.layerPriority = 1;`;
  const gameKeyboardSurface = `        // FIXME: keyboard is misplaced when rendered in a cylinder layer.
        aPlacement.cylinder = false;
        // A native VRLayer is submitted behind the opaque WebXR projection.
        // The game host draws this Android surface in its post-WebXR GPU pass.
        if (BuildConfig.NH3D_GAME_HOST) aPlacement.layer = false;
        aPlacement.layerPriority = 1;`;
  if (!source.includes(gameKeyboardSurface)) {
    source = replaceOnce(source, stockKeyboardSurface, gameKeyboardSurface, "game-host keyboard GPU surface");
  }
  writeFileSync(file, source);

  const world = path.join(checkout, "app/src/main/cpp/BrowserWorld.cpp");
  source = readFileSync(world, "utf8").replaceAll("\r\n", "\n");
  const foregroundKeyboard = "  if (drawImmersiveKeyboard) {\n    VRB_GL_CHECK(glDepthMask(GL_TRUE));\n    VRB_GL_CHECK(glClear(GL_DEPTH_BUFFER_BIT));\n    VRB_GL_CHECK(glDepthMask(GL_FALSE));\n    m.immersiveKeyboard->ToggleWidget(true);\n    m.DrawImmersiveKeyboard(*camera);\n  }";
  if (source.includes("PrepareImmersiveKeyboard") && !source.includes("NH3D raw keyboard root")) {
    const priorDraw = "  const bool drawImmersiveKeyboard = m.immersiveKeyboardPlaced && m.immersiveKeyboard;\n  if (drawImmersiveKeyboard) m.immersiveKeyboard->ToggleWidget(false);\n  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);\n  if (drawImmersiveKeyboard) { m.immersiveKeyboard->ToggleWidget(true); m.DrawImmersiveKeyboard(*camera); }";
    if (source.includes(priorDraw)) {
      const draw = priorDraw.slice(0, priorDraw.lastIndexOf("\n  if (drawImmersiveKeyboard)"));
      source = replaceOnce(source, priorDraw, draw, "move existing keyboard above foreground modal");
    }
    if (!source.includes(foregroundKeyboard)) source = replaceOnce(source,
      "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
      "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n" + foregroundKeyboard + "\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
      "draw existing keyboard above foreground modal");
  }
  const keyboardState = `  // The game pane root is transformed independently; keep Wolvic's keyboard
  // in one detached raw transform for both culling and controller rays.
  // NH3D raw keyboard root: it must not inherit gameUiTransform.
  WidgetPtr immersiveKeyboard;
  vrb::Matrix immersiveKeyboardOriginal = vrb::Matrix::Identity();
  vrb::Matrix immersiveKeyboardTransform = vrb::Matrix::Identity();
  float immersiveKeyboardAnchorRevision = -1;
  bool immersiveKeyboardPlaced = false;
  bool immersiveKeyboardDetached = false;
  bool immersiveKeyboardGrabActive = false;
  vrb::Vector immersiveKeyboardGrabLocal = vrb::Vector::Zero();
  void PrepareImmersiveKeyboard();
  bool ImmersiveKeyboardHit(const vrb::Vector& start, const vrb::Vector& direction) const;
  void MoveImmersiveKeyboard(const vrb::Vector& start, const vrb::Vector& direction);
  void SyncImmersiveKeyboard();
  void RestoreImmersiveKeyboard();
  void DrawImmersiveKeyboard(const vrb::Camera& camera);
  void UpdateTrackedKeyboard();`;
  const oldKeyboardState = "  // The game pane root is transformed independently; keep Wolvic's keyboard in its own native pass.\n  void DrawImmersiveKeyboard(const vrb::Camera& camera);\n  void UpdateTrackedKeyboard();";
  if (source.includes("PrepareImmersiveKeyboard")) {
    if (!source.includes("  bool ImmersiveKeyboardHit(const vrb::Vector& start, const vrb::Vector& direction) const;")) {
      const stateStart = source.indexOf("  // The game pane root is transformed independently");
      const stateEnd = source.indexOf("  void UpdateTrackedKeyboard();", stateStart) + "  void UpdateTrackedKeyboard();".length;
      if (stateStart < 0 || stateEnd <= stateStart) throw new Error("Missing prior immersive keyboard state");
      source = replaceOnce(source, source.slice(stateStart, stateEnd), keyboardState, "upgrade immersive keyboard state");
    }
  } else {
    source = source.includes(oldKeyboardState)
      ? replaceOnce(source, oldKeyboardState, keyboardState, "upgrade immersive keyboard state")
      : replaceOnce(source, "  void UpdateTrackedKeyboard();", keyboardState, "immersive keyboard state");
  }
  const drawKeyboard = `void
BrowserWorld::State::RestoreImmersiveKeyboard() {
  if (movingWidget && movingWidget->GetWidget() == immersiveKeyboard) {
    movingWidget->EndMoving();
    movingWidget = nullptr;
  }
  if (immersiveKeyboard) {
    if (immersiveKeyboardPlaced) immersiveKeyboard->SetTransform(immersiveKeyboardOriginal);
    bool stillRegistered = false;
    for (const auto& widget : widgets) if (widget == immersiveKeyboard) { stillRegistered = true; break; }
    if (immersiveKeyboardDetached && stillRegistered) rootTransparent->AddNode(immersiveKeyboard->GetRoot());
  }
  immersiveKeyboard = nullptr;
  immersiveKeyboardPlaced = false;
  immersiveKeyboardDetached = false;
  immersiveKeyboardGrabActive = false;
  immersiveKeyboardAnchorRevision = -1;
}

void
BrowserWorld::State::PrepareImmersiveKeyboard() {
  WidgetPtr keyboard;
  for (const auto& widget : widgets) if (widget->GetPlacement()->name == "KeyboardWidget") { keyboard = widget; break; }
  if (!keyboard || !keyboard->IsVisible()) { RestoreImmersiveKeyboard(); return; }
  const float revision = gamePointerState.empty() ? 0 : gamePointerState[0];
  if (!immersiveKeyboardPlaced || immersiveKeyboard != keyboard || revision != immersiveKeyboardAnchorRevision) {
    RestoreImmersiveKeyboard();
    immersiveKeyboard = keyboard;
    immersiveKeyboardOriginal = keyboard->GetTransform();
    immersiveKeyboard->GetRoot()->RemoveFromParents();
    immersiveKeyboardDetached = true;
    const auto head = device->GetHeadTransform();
    const auto uiForward = gameUiTransform.MultiplyDirection(vrb::Vector(0, 0, -1));
    const auto yaw = vrb::Matrix::Rotation(vrb::Vector(0, 1, 0), std::atan2(-uiForward.x(), -uiForward.z()));
    const auto center = head.GetTranslation() + yaw.MultiplyDirection(vrb::Vector(0, -0.35f, -1.0f));
    // Match the current game UI yaw. Wolvic's flat keyboard is 3.25m wide
    // and tilted down; halve it here and remove that unrelated flat pose.
    immersiveKeyboardTransform = vrb::Matrix::Translation(center).PostMultiply(yaw)
        .PostMultiply(vrb::Matrix::Identity().Scale(vrb::Vector(0.5f, 0.5f, 0.5f)));
    immersiveKeyboard->SetTransform(immersiveKeyboardTransform);
    immersiveKeyboardAnchorRevision = revision;
    immersiveKeyboardPlaced = true;
  } else immersiveKeyboard->SetTransform(immersiveKeyboardTransform);
  // The game-root cull would apply gameUiTransform a second time. Hide the
  // keyboard there, then cull its raw root before controller hit testing.
  immersiveKeyboard->ToggleWidget(false);
}

bool
BrowserWorld::State::ImmersiveKeyboardHit(const vrb::Vector& start, const vrb::Vector& direction) const {
  if (!immersiveKeyboardPlaced || !immersiveKeyboard) return false;
  vrb::Vector point, normal;
  float distance = -1.0f;
  bool inside = false;
  return immersiveKeyboard->TestControllerIntersection(start, direction, point, normal, false, inside, distance) && inside;
}

void
BrowserWorld::State::MoveImmersiveKeyboard(const vrb::Vector& start, const vrb::Vector& direction) {
  if (!immersiveKeyboardPlaced || !immersiveKeyboard) return;
  vrb::Vector point, normal;
  float distance = -1.0f;
  bool inside = false;
  if (!immersiveKeyboard->TestControllerIntersection(start, direction, point, normal, false, inside, distance)) return;
  const auto local = immersiveKeyboardTransform.Translate(-immersiveKeyboardTransform.GetTranslation());
  if (!immersiveKeyboardGrabActive) {
    immersiveKeyboardGrabLocal = immersiveKeyboardTransform.AfineInverse().MultiplyPosition(point);
    immersiveKeyboardGrabActive = true;
  }
  const auto grabOffset = local.MultiplyDirection(immersiveKeyboardGrabLocal);
  immersiveKeyboardTransform = vrb::Matrix::Translation(point - grabOffset).PostMultiply(local);
  immersiveKeyboard->SetTransform(immersiveKeyboardTransform);
}

void
BrowserWorld::State::SyncImmersiveKeyboard() {
  if (!immersiveKeyboardPlaced || !immersiveKeyboard) return;
  immersiveKeyboard->ToggleWidget(true);
  drawList->Reset();
  immersiveKeyboard->GetRoot()->Cull(*cullVisitor, *drawList);
}

void
BrowserWorld::State::DrawImmersiveKeyboard(const vrb::Camera& camera) {
  if (!immersiveKeyboardPlaced || !immersiveKeyboard) return;
  // This raw-root cull updates the same world transform Quad::TestIntersection
  // reads in the next controller frame.
  drawList->Reset();
  immersiveKeyboard->GetRoot()->Cull(*cullVisitor, *drawList);
  drawList->Draw(camera);
}

`;
  const oldDrawStart = source.indexOf("void\nBrowserWorld::State::DrawImmersiveKeyboard(const vrb::Camera& camera) {");
  const restoreStart = source.indexOf("void\nBrowserWorld::State::RestoreImmersiveKeyboard() {");
  const trackedStart = source.indexOf("void\nBrowserWorld::State::UpdateTrackedKeyboard() {", oldDrawStart);
  if (restoreStart >= 0 && trackedStart > restoreStart) {
    source = replaceOnce(source, source.slice(restoreStart, trackedStart), drawKeyboard, "upgrade immersive keyboard draw implementation");
  } else if (oldDrawStart >= 0 && trackedStart > oldDrawStart) {
    source = replaceOnce(source, source.slice(oldDrawStart, trackedStart), drawKeyboard, "upgrade immersive keyboard draw implementation");
  } else source = replaceOnce(source,
    "void\nBrowserWorld::State::UpdateTrackedKeyboard() {",
    drawKeyboard + "void\nBrowserWorld::State::UpdateTrackedKeyboard() {",
    "immersive keyboard draw implementation");
  const keyboardDraw = "  const bool drawImmersiveKeyboard = m.immersiveKeyboardPlaced && m.immersiveKeyboard;\n  if (drawImmersiveKeyboard) m.immersiveKeyboard->ToggleWidget(false);\n  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);";
  const priorStateKeyboardDraw = keyboardDraw + "\n  if (drawImmersiveKeyboard) { m.immersiveKeyboard->ToggleWidget(true); m.DrawImmersiveKeyboard(*camera); }";
  const oldKeyboardDraw = "  WidgetPtr immersiveKeyboard;\n  for (const auto& widget : m.widgets) if (widget->GetPlacement()->name == \"KeyboardWidget\" && widget->IsVisible()) {\n    immersiveKeyboard = widget; widget->ToggleWidget(false); break;\n  }\n  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);\n  if (immersiveKeyboard) { immersiveKeyboard->ToggleWidget(true); m.DrawImmersiveKeyboard(*camera); }";
  const stockDraw = "  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);";
  if (!source.includes(keyboardDraw)) source = source.includes(oldKeyboardDraw)
    ? replaceOnce(source, oldKeyboardDraw, keyboardDraw, "upgrade keyboard draw path")
    : source.includes(priorStateKeyboardDraw)
      ? replaceOnce(source, priorStateKeyboardDraw, keyboardDraw, "move keyboard above foreground modal")
      : replaceOnce(source, stockDraw, keyboardDraw, "exclude keyboard from transformed pane root");
  if (!source.includes(foregroundKeyboard)) source = replaceOnce(source,
    "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
    "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n" + foregroundKeyboard + "\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
    "draw keyboard above foreground modal");
  if (!source.includes("  PrepareImmersiveKeyboard();\n  rootTransparent->SetTransform(gameUiTransform);")) source = replaceOnce(source,
    "  rootTransparent->SetTransform(gameUiTransform);\n  drawList->Reset(); rootTransparent->Cull(*cullVisitor, *drawList);\n  if (!controllers->IsVisible()) controllers->SetVisible(true);",
    "  PrepareImmersiveKeyboard();\n  rootTransparent->SetTransform(gameUiTransform);\n  drawList->Reset(); rootTransparent->Cull(*cullVisitor, *drawList);\n  SyncImmersiveKeyboard();\n  if (!controllers->IsVisible()) controllers->SetVisible(true);",
    "synchronize raw keyboard before controller rays");
  if (!source.includes("    RestoreImmersiveKeyboard();\n    externalVR->StopPresenting();")) source = replaceOnce(source,
    "    externalVR->StopPresenting();",
    "    RestoreImmersiveKeyboard();\n    externalVR->StopPresenting();",
    "restore keyboard on immersive exit");
  if (!source.includes("  } else {\n    m.RestoreImmersiveKeyboard();\n    m.gameUiAnchored = false;")) source = replaceOnce(source,
    "  } else {\n    m.gameUiAnchored = false;",
    "  } else {\n    m.RestoreImmersiveKeyboard();\n    m.gameUiAnchored = false;",
    "restore keyboard outside immersive mode");
  if (!source.includes("NH3D raw keyboard move")) source = replaceOnce(source,
    "    if (controller.focused && movingWidget && movingWidget->IsMoving(controller.index)) {\n      if (!pressed && wasPressed) {",
    `    if (controller.focused && movingWidget && movingWidget->IsMoving(controller.index)) {
      if (externalVR->IsPresenting() && movingWidget->GetWidget() == immersiveKeyboard) {
        // NH3D raw keyboard move: the Android move bar starts the normal
        // gesture, but its flat-window placement must not overwrite this pose.
        if (!pressed && wasPressed) {
          immersiveKeyboardGrabActive = false;
          movingWidget->EndMoving();
        } else {
          MoveImmersiveKeyboard(start, direction);
        }
      } else if (!pressed && wasPressed) {`,
    "move detached immersive keyboard");
  if (!source.includes("NH3D raw keyboard grip")) {
    source = replaceOnce(source,
      "    const auto clickButtons = ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A |\n        ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD;\n    const bool grabbing = externalVR->IsPresenting() && controller.hasAim && gamePanels && gamePanels->Grip(",
      "    const auto clickButtons = ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A |\n        ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD;\n    const bool keyboardForeground = externalVR->IsPresenting() &&\n        ImmersiveKeyboardHit(controller.StartPoint(), controller.Direction());\n    const bool grabbing = externalVR->IsPresenting() && !keyboardForeground && controller.hasAim && gamePanels && gamePanels->Grip(",
      "keep pane grip behind immersive keyboard");
    source = replaceOnce(source,
      "    const bool gameSecondary = !controller.gameUiGrip && !wasUiGrip && gripDown;\n    const bool wasGameSecondary = externalVR->IsPresenting() && !wasUiGrip && (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE);",
      `    // NH3D raw keyboard grip: keep the move bar's Android gesture primary
    // and prevent a squeeze over the foreground keyboard reaching WebXR/world input.
    const bool keyboardCapture = externalVR->IsPresenting() && immersiveKeyboard &&
        (keyboardForeground || controller.widget == immersiveKeyboard->GetHandle());
    const bool keyboardGrip = keyboardCapture && gripDown;
    const bool wasKeyboardGrip = externalVR->IsPresenting() && immersiveKeyboard &&
        controller.widget == immersiveKeyboard->GetHandle() && (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE);
    const bool gameSecondary = !controller.gameUiGrip && !wasUiGrip && !keyboardGrip && gripDown;
    const bool wasGameSecondary = externalVR->IsPresenting() && !wasUiGrip && !wasKeyboardGrip &&
        (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE);`,
      "claim immersive keyboard grip");
    source = replaceOnce(source,
      "    const bool pressed = !controller.gameUiGrip && (gameSecondary ||",
      "    const bool pressed = !controller.gameUiGrip && (keyboardGrip || gameSecondary ||",
      "press immersive keyboard grip");
    source = replaceOnce(source,
      "    const bool wasPressed = !wasUiGrip && (wasGameSecondary ||",
      "    const bool wasPressed = !wasUiGrip && (wasKeyboardGrip || wasGameSecondary ||",
      "release immersive keyboard grip");
    source = replaceOnce(source,
      "    const bool runHand = externalVR->IsPresenting() && controller.leftHanded;",
      "    const bool runHand = externalVR->IsPresenting() && controller.leftHanded && !keyboardCapture;",
      "allow left trigger on immersive keyboard");
    source = replaceOnce(source,
      "    if ((!externalVR->IsPresenting() || !controller.hasAim) && gamePanels) gamePanels->EndGrip(controller.index);\n    controller.gameUiGrip = grabbing || (wasUiGrip && (gripDown || (controller.buttonState & clickButtons)));",
      "    if ((keyboardForeground || !externalVR->IsPresenting() || !controller.hasAim) && gamePanels) gamePanels->EndGrip(controller.index);\n    controller.gameUiGrip = grabbing || (!keyboardForeground && wasUiGrip && (gripDown || (controller.buttonState & clickButtons)));",
      "release pane grip behind immersive keyboard");
    source = replaceOnce(source,
      "          if (isInWidget && (distance < hitDistance) && GameUiHit(widget, result)) {",
      "          const bool keyboardForeground = externalVR->IsPresenting() && widget == immersiveKeyboard;\n          if (isInWidget && (distance < hitDistance || keyboardForeground) &&\n              (!immersiveKeyboard || hitWidget != immersiveKeyboard || keyboardForeground) && GameUiHit(widget, result)) {",
      "prioritize foreground immersive keyboard");
  }
  source = source.replace("(hitWidget != immersiveKeyboard || keyboardForeground)",
    "(!immersiveKeyboard || hitWidget != immersiveKeyboard || keyboardForeground)");
  writeFileSync(world, source);

  const controllerHeader = path.join(checkout, "app/src/main/cpp/Controller.h");
  const controllerSource = path.join(checkout, "app/src/main/cpp/Controller.cpp");
  const external = path.join(checkout, "app/src/main/cpp/ExternalVR.cpp");
  if (!existsSync(controllerHeader) || !existsSync(controllerSource) || !existsSync(external)) return;

  source = readFileSync(controllerHeader, "utf8").replaceAll("\r\n", "\n");
  if (!source.includes("gameKeyboardCaptured")) {
    source = replaceOnce(source, "  bool gameWorldCaptured = false;", "  bool gameWorldCaptured = false;\n  bool gameKeyboardCaptured = false;", "keyboard controller ownership");
    writeFileSync(controllerHeader, source);
    source = readFileSync(controllerSource, "utf8").replaceAll("\r\n", "\n");
    source = replaceOnce(source, "  gameWorldCaptured = aController.gameWorldCaptured;", "  gameWorldCaptured = aController.gameWorldCaptured;\n  gameKeyboardCaptured = aController.gameKeyboardCaptured;", "copy keyboard controller ownership");
    source = replaceOnce(source, "  buttonState = lastButtonState = 0;", "  buttonState = lastButtonState = 0;\n  gameKeyboardCaptured = false;", "reset keyboard controller ownership");
    writeFileSync(controllerSource, source);
  }

  source = readFileSync(world, "utf8").replaceAll("\r\n", "\n");
  if (!source.includes("NH3D keyboard controller ownership")) {
    source = replaceOnce(source,
      "    controller.gameActionHover = hitWidget && gamePanels && gamePanels->Owns(hitWidget) && gamePanels->IsAction(controller.index);",
      `    // NH3D keyboard controller ownership reaches ExternalVR before it
    // publishes this frame's gamepad state, including the left trigger.
    if (externalVR->IsPresenting() && immersiveKeyboard && hitWidget == immersiveKeyboard) controller.gameKeyboardCaptured = true;
    else if (!pressed) controller.gameKeyboardCaptured = false;
    controller.gameActionHover = hitWidget && gamePanels && gamePanels->Owns(hitWidget) && gamePanels->IsAction(controller.index);`,
      "record immersive keyboard controller ownership");
    writeFileSync(world, source);
  }

  source = readFileSync(external, "utf8").replaceAll("\r\n", "\n");
  if (!source.includes("NH3D keyboard controller mask")) {
    source = replaceOnce(source,
      "    const uint64_t gameUiEffectiveMask = controller.leftHanded ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;",
      `    // NH3D keyboard controller mask: preserve left-trigger running except
    // while that controller is captured by the foreground native keyboard.
    const uint64_t gameUiEffectiveMask = controller.leftHanded && !controller.gameKeyboardCaptured
        ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;
    const bool gameUiCapture = controller.widget || controller.gameKeyboardCaptured;`,
      "mask left trigger while keyboard owns controller");
    source = replaceOnce(source,
      "    immersiveController.buttonPressed = controller.gameUiGrip ? 0 : controller.widget ? controller.immersivePressedState & ~gameUiEffectiveMask : controller.immersivePressedState;",
      "    immersiveController.buttonPressed = controller.gameUiGrip ? 0 : gameUiCapture ? controller.immersivePressedState & ~gameUiEffectiveMask : controller.immersivePressedState;",
      "mask keyboard buttons from WebXR");
    source = replaceOnce(source,
      "    immersiveController.buttonTouched = controller.gameUiGrip ? 0 : controller.widget ? controller.immersiveTouchedState & ~gameUiEffectiveMask : controller.immersiveTouchedState;",
      "    immersiveController.buttonTouched = controller.gameUiGrip ? 0 : gameUiCapture ? controller.immersiveTouchedState & ~gameUiEffectiveMask : controller.immersiveTouchedState;",
      "mask keyboard touches from WebXR");
    source = replaceOnce(source,
      "      immersiveController.triggerValue[j] = controller.gameUiGrip ? 0.0f : controller.widget && (gameUiEffectiveMask & (uint64_t(1) << j)) ? 0.0f : controller.immersiveTriggerValues[j];",
      "      immersiveController.triggerValue[j] = controller.gameUiGrip ? 0.0f : gameUiCapture && (gameUiEffectiveMask & (uint64_t(1) << j)) ? 0.0f : controller.immersiveTriggerValues[j];",
      "mask keyboard analog buttons from WebXR");
    source = replaceOnce(source,
      "      immersiveController.axisValue[j] = controller.gameUiGrip ? 0.0f : controller.widget && !controller.gameActionHover && !(controller.leftHanded && (controller.buttonState & ControllerDelegate::BUTTON_TRIGGER)) ? 0.0f : controller.immersiveAxes[j];",
      "      immersiveController.axisValue[j] = controller.gameUiGrip ? 0.0f : gameUiCapture && !controller.gameActionHover && !(controller.leftHanded && (controller.buttonState & ControllerDelegate::BUTTON_TRIGGER) && !controller.gameKeyboardCaptured) ? 0.0f : controller.immersiveAxes[j];",
      "mask keyboard axes from WebXR");
    writeFileSync(external, source);
  }
}
