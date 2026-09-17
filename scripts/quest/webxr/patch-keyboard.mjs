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
        // onCreateInputConnection can itself enqueue focus/show notifications.
        // Reusing a live connection breaks that feedback loop and preserves
        // hover, Shift, and a key held between ACTION_DOWN and ACTION_UP.
        if (mFocusedView == mAttachedWindow && mInputConnection != null) return;
        if (mAttachedWindow != null) updateFocusedView(mAttachedWindow);
    }

    private int mImmersiveInputRevision = 0;

    private void queueImmersiveInput(boolean show) {
        final int revision = mImmersiveInputRevision;
        final WindowWidget window = mAttachedWindow;
        post(() -> {
            if (revision != mImmersiveInputRevision || window != mAttachedWindow || mIsInVoiceInput) return;
            updateImmersiveInput();
            // An explicit request can reopen the same focused field without
            // replacing its keyboard. Focus notifications alone cannot.
            if (show && mInputConnection != null && mFocusedView == mAttachedWindow && !mWidgetPlacement.visible) {
                mWidgetManager.pushBackHandler(mBackHandler);
                mWidgetPlacement.visible = true;
                mWidgetManager.updateWidget(this);
            }
        });
    }

    @Override
    public void restartInput(@NonNull WSession session, int reason) {
        mInputRestarted = true;
        if (BuildConfig.NH3D_GAME_HOST && MotionEventGenerator.gameImmersive) {
            // Content changes must not reset a held key or reopen a dismissed keyboard.
            if (reason == RESTART_REASON_FOCUS) queueImmersiveInput(false);
            else if (reason == RESTART_REASON_BLUR) {
                final int revision = ++mImmersiveInputRevision;
                post(() -> {
                    if (revision == mImmersiveInputRevision) updateFocusedView(null);
                });
            }
        } else {
            resetKeyboardLayout();
        }
    }

    @Override
    public void showSoftInput(@NonNull WSession session) {
        if (BuildConfig.NH3D_GAME_HOST && MotionEventGenerator.gameImmersive) {
            queueImmersiveInput(true);
        } else if (mFocusedView != mAttachedWindow || getVisibility() != View.VISIBLE || mInputRestarted) {
            post(() -> updateFocusedView(mAttachedWindow));
        }
        mInputRestarted = false;
    }`;
  if (!source.includes(patchedCallbacks) && (source.includes("NH3D immersive page input") || source.includes("private void updateImmersiveInput()"))) {
    const helper = source.indexOf("    private void updateImmersiveInput() {");
    const begin = helper >= 0 ? helper : source.indexOf("    @Override\n    public void restartInput(@NonNull WSession session, int reason) {");
    const end = source.indexOf("\n\n    @Override\n    public void hideSoftInput", begin);
    if (begin < 0 || end <= begin) throw new Error("Missing prior keyboard callbacks");
    source = replaceOnce(source, source.slice(begin, end), patchedCallbacks, "upgrade Wolvic keyboard input callbacks");
  } else if (!source.includes(patchedCallbacks)) source = replaceOnce(source, stockCallbacks, patchedCallbacks, "Wolvic keyboard input callbacks");
  if (!source.includes("import com.igalia.wolvic.BuildConfig;")) source = source.replace(
    "import com.igalia.wolvic.R;",
    "import com.igalia.wolvic.R;\nimport com.igalia.wolvic.BuildConfig;\nimport com.igalia.wolvic.input.MotionEventGenerator;",
  );
  const keyboardMultiDeviceInput = `    @Override
    public boolean supportsMultipleInputDevices() {
        // Keep hover feedback alive while the native ray transfers focus.
        return BuildConfig.NH3D_GAME_HOST && MotionEventGenerator.gameImmersive;
    }

`;
  if (!source.includes("public boolean supportsMultipleInputDevices()")) source = replaceOnce(source,
    "    public KeyboardWidget(Context aContext) {",
    keyboardMultiDeviceInput + "    public KeyboardWidget(Context aContext) {",
    "immersive keyboard hover devices");
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
  if (!source.includes("NH3D cancel queued input")) source = replaceOnce(source,
    "    public void dismiss() {",
    `    public void dismiss() {
        // NH3D cancel queued input: closing must win over already posted shows.
        if (BuildConfig.NH3D_GAME_HOST && MotionEventGenerator.gameImmersive) ++mImmersiveInputRevision;`,
    "cancel queued keyboard requests on dismissal");
  writeFileSync(file, source);

  const motion = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java");
  source = readFileSync(motion, "utf8").replaceAll("\r\n", "\n");
  if (!source.includes("isGameKeyboardWidget")) {
    source = source.replace("import com.igalia.wolvic.ui.widgets.WindowWidget;", "import com.igalia.wolvic.ui.widgets.WindowWidget;\nimport com.igalia.wolvic.ui.widgets.KeyboardWidget;");
    source = replaceOnce(source,
      "    static final String LOGTAG = SystemUtils.createLogtag(MotionEventGenerator.class);",
      `    private static boolean isGameKeyboardWidget(Widget widget) {
        return BuildConfig.NH3D_GAME_HOST && gameImmersive && widget instanceof KeyboardWidget;
    }
    static final String LOGTAG = SystemUtils.createLogtag(MotionEventGenerator.class);`,
      "immersive keyboard touch classifier");
    source = replaceOnce(source,
      "        if (aPressed && aButtons == MotionEvent.BUTTON_SECONDARY && !isGameMouseWidget(aWidget)) return;",
      "        // A keyboard squeeze is still a touchscreen gesture, never an HTML right click.\n        if (aPressed && aButtons == MotionEvent.BUTTON_SECONDARY && !isGameMouseWidget(aWidget) && !isGameKeyboardWidget(aWidget)) return;",
      "immersive keyboard secondary touch");
    writeFileSync(motion, source);
  }

  const activity = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java");
  source = readFileSync(activity, "utf8").replaceAll("\r\n", "\n");
  if (!source.includes("NH3D keyboard back priority")) {
    source = replaceOnce(source,
      "        if (mIsPresentingImmersive.getValue()) {\n            queueRunnable(this::exitImmersiveNative);\n            return;\n        }",
      `        // NH3D keyboard back priority: this keyboard is a host overlay,
        // so dismiss it before Wolvic interprets back as Exit VR.
        if (BuildConfig.NH3D_GAME_HOST && mIsPresentingImmersive.getValue() && mKeyboard != null && mKeyboard.isVisible()) {
            mKeyboard.dismiss();
            return;
        }
        if (mIsPresentingImmersive.getValue()) {
            queueRunnable(this::exitImmersiveNative);
            return;
        }`,
      "keyboard back priority");
    writeFileSync(activity, source);
  }

  const world = path.join(checkout, "app/src/main/cpp/BrowserWorld.cpp");
  source = readFileSync(world, "utf8").replaceAll("\r\n", "\n");
  // CheckBackButton also advances lastButtonState. Running it before the
  // immersive UI pass eats stationary trigger DOWN/UP and B edges. Delete
  // repeats on DOWN, whereas letters and Android buttons need the missing UP.
  source = source.replace("    m.CheckBackButton();\n    createPassthroughLayerIfNeeded();",
    "    // NH3D input edges belong to UpdateGameControls, except in the loading interstitial.\n    if (m.webXRInterstialState != WebXRInterstialState::HIDDEN) m.CheckBackButton();\n    createPassthroughLayerIfNeeded();");
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
  float immersiveKeyboardGrabDistance = 1.0f;
  vrb::Vector immersiveKeyboardGrabLocal = vrb::Vector::Zero();
  void PrepareImmersiveKeyboard();
  vrb::Matrix ImmersiveKeyboardFacing(const vrb::Vector& center) const;
  bool KeyboardIntersection(const WidgetPtr& widget, const vrb::Vector& start, const vrb::Vector& direction,
      vrb::Vector& point, vrb::Vector& normal, bool& inside, float& distance) const;
  bool ImmersiveKeyboardHit(const vrb::Vector& start, const vrb::Vector& direction) const;
  void MoveImmersiveKeyboard(const vrb::Vector& start, const vrb::Vector& direction);
  void SyncImmersiveKeyboard();
  void RestoreImmersiveKeyboard();
  void DrawImmersiveKeyboard(const vrb::Camera& camera);
  void UpdateTrackedKeyboard();`;
  const oldKeyboardState = "  // The game pane root is transformed independently; keep Wolvic's keyboard in its own native pass.\n  void DrawImmersiveKeyboard(const vrb::Camera& camera);\n  void UpdateTrackedKeyboard();";
  if (source.includes("PrepareImmersiveKeyboard")) {
    if (!source.includes("  bool KeyboardIntersection(") || !source.includes("NH3D raw keyboard root") || !source.includes("  bool ImmersiveKeyboardHit(")) {
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

vrb::Matrix
BrowserWorld::State::ImmersiveKeyboardFacing(const vrb::Vector& center) const {
  const auto toHead = device->GetHeadTransform().GetTranslation() - center;
  const float horizontal = std::sqrt(toHead.x() * toHead.x() + toHead.z() * toHead.z());
  return vrb::Matrix::Rotation(vrb::Vector(0, 1, 0), std::atan2(toHead.x(), toHead.z()))
      .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1, 0, 0), -std::atan2(toHead.y(), horizontal)))
      .PostMultiply(vrb::Matrix::Identity().Scale(vrb::Vector(0.25f, 0.25f, 0.25f)));
}

void
BrowserWorld::State::PrepareImmersiveKeyboard() {
  WidgetPtr keyboard;
  for (const auto& widget : widgets) if (widget->GetPlacement()->name == "KeyboardWidget") { keyboard = widget; break; }
  if (!keyboard || !keyboard->GetPlacement()->visible) { RestoreImmersiveKeyboard(); return; }
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
    immersiveKeyboardTransform = vrb::Matrix::Translation(center).PostMultiply(ImmersiveKeyboardFacing(center));
    immersiveKeyboard->SetTransform(immersiveKeyboardTransform);
    immersiveKeyboardAnchorRevision = revision;
    immersiveKeyboardPlaced = true;
  } else {
    const auto center = immersiveKeyboardTransform.GetTranslation();
    immersiveKeyboardTransform = vrb::Matrix::Translation(center).PostMultiply(ImmersiveKeyboardFacing(center));
    immersiveKeyboard->SetTransform(immersiveKeyboardTransform);
  }
  // The game-root cull would apply gameUiTransform a second time. Hide the
  // keyboard there, then cull its raw root before controller hit testing.
  immersiveKeyboard->ToggleWidget(false);
}

bool
BrowserWorld::State::KeyboardIntersection(const WidgetPtr& widget, const vrb::Vector& start,
    const vrb::Vector& direction, vrb::Vector& point, vrb::Vector& normal, bool& inside, float& distance) const {
  inside = false; distance = -1;
  if (!widget || !widget->GetPlacement()->visible || !widget->GetQuad()) return false;
  // Use the exact quad transform used for drawing and coordinate conversion.
  // The keyboard is visible from both sides, and a hand can cross its plane.
  // Stock Quad::TestIntersection rejects the back face and checks transient
  // root visibility, so visible keys can otherwise become unclickable.
  const auto transform = widget->GetQuad()->GetTransformNode()->GetWorldTransform();
  const auto inverse = transform.AfineInverse();
  const auto origin = inverse.MultiplyPosition(start);
  const auto ray = inverse.MultiplyDirection(direction);
  if (std::abs(ray.z()) < 0.000001f) return false;
  const float t = -origin.z() / ray.z();
  if (t < 0) return false;
  const auto local = origin + ray * t;
  vrb::Vector min, max;
  widget->GetWidgetMinAndMax(min, max);
  inside = local.x() >= min.x() && local.x() <= max.x() && local.y() >= min.y() && local.y() <= max.y();
  point = transform.MultiplyPosition(local);
  normal = transform.MultiplyDirection(vrb::Vector(0, 0, ray.z() < 0 ? 1 : -1)).Normalize();
  distance = (point - start).Magnitude();
  return true;
}

bool
BrowserWorld::State::ImmersiveKeyboardHit(const vrb::Vector& start, const vrb::Vector& direction) const {
  if (!immersiveKeyboardPlaced || !immersiveKeyboard) return false;
  vrb::Vector point, normal;
  float distance = -1.0f;
  bool inside = false;
  return KeyboardIntersection(immersiveKeyboard, start, direction, point, normal, inside, distance) && inside;
}

void
BrowserWorld::State::MoveImmersiveKeyboard(const vrb::Vector& start, const vrb::Vector& direction) {
  if (!immersiveKeyboardPlaced || !immersiveKeyboard) return;
  vrb::Vector point, normal;
  float distance = -1.0f;
  bool inside = false;
  if (!immersiveKeyboardGrabActive) {
    if (!KeyboardIntersection(immersiveKeyboard, start, direction, point, normal, inside, distance)) return;
    immersiveKeyboardGrabLocal = immersiveKeyboardTransform.AfineInverse().MultiplyPosition(point);
    immersiveKeyboardGrabDistance = distance;
    immersiveKeyboardGrabActive = true;
  }
  // Preserve ray depth, not the old plane: moving the hand towards/away from
  // the headset now moves the keyboard in depth as well as vertically/laterally.
  point = start + direction.Normalize() * immersiveKeyboardGrabDistance;
  const auto local = ImmersiveKeyboardFacing(immersiveKeyboardTransform.GetTranslation());
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
  const auxiliaryStart = source.indexOf("// NH3D keyboard dialog methods begin", oldDrawStart);
  const trackedStart = auxiliaryStart >= 0 ? auxiliaryStart : source.indexOf("void\nBrowserWorld::State::UpdateTrackedKeyboard() {", oldDrawStart);
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
  if (!source.includes("  const bool drawImmersiveKeyboard = m.immersiveKeyboardPlaced && m.immersiveKeyboard;")) source = source.includes(oldKeyboardDraw)
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
  if (!source.includes("    RestoreImmersiveKeyboard();")) source = replaceOnce(source,
    "    externalVR->StopPresenting();",
    "    RestoreImmersiveKeyboard();\n    externalVR->StopPresenting();",
    "restore keyboard on immersive exit");
  if (!source.includes("    m.RestoreImmersiveKeyboard();")) source = replaceOnce(source,
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
  if (!source.includes("NH3D raw keyboard focus")) {
    const start = source.search(/BrowserWorld::(?:State::)?UpdateControllers\([^;]*\) \{/);
    if (start < 0) throw new Error("Missing controller update implementation");
    const end = source.indexOf("\nvoid\n", start);
    const boundary = end < 0 ? source.length : end;
    const body = replaceOnce(source.slice(start, boundary),
    "    if (wasGoBackButtonClicked(controller, externalVR->IsPresenting())) {",
    `    // NH3D raw keyboard focus: generic Android hover is delivered only
    // to the focused controller, so claim focus before hover/down dispatch.
    const bool keyboardForeground = externalVR->IsPresenting() &&
        ImmersiveKeyboardHit(controller.StartPoint(), controller.Direction());
    if (keyboardForeground && !controller.focused) ChangeControllerFocus(controller);
    const bool keyboardVisible = externalVR->IsPresenting() && immersiveKeyboard && immersiveKeyboard->IsVisible();
    const bool keyboardBack = keyboardVisible &&
        !(controller.lastButtonState & ControllerDelegate::BUTTON_B) &&
        (controller.buttonState & ControllerDelegate::BUTTON_B);
    const bool keyboardBackHeld = (keyboardVisible || controller.gameKeyboardCaptured) &&
        ((controller.lastButtonState | controller.buttonState) & ControllerDelegate::BUTTON_B);
    if (keyboardBack) {
      SimulateBack();
    } else if (wasGoBackButtonClicked(controller, externalVR->IsPresenting())) {`,
    "focus and close immersive keyboard");
    source = source.slice(0, start) + body + source.slice(boundary);
  }
  source = source.replace("    const bool keyboardForeground = externalVR->IsPresenting() &&\n        ImmersiveKeyboardHit(controller.StartPoint(), controller.Direction());\n    const bool grabbing =",
    "    const bool grabbing =");
  source = source.replace(
    "    const bool keyboardBack = keyboardForeground &&\n        !(controller.lastButtonState & ControllerDelegate::BUTTON_B) &&\n        (controller.buttonState & ControllerDelegate::BUTTON_B);",
    "    const bool keyboardVisible = externalVR->IsPresenting() && immersiveKeyboard && immersiveKeyboard->IsVisible();\n    const bool keyboardBack = keyboardVisible &&\n        !(controller.lastButtonState & ControllerDelegate::BUTTON_B) &&\n        (controller.buttonState & ControllerDelegate::BUTTON_B);\n    const bool keyboardBackHeld = (keyboardVisible || controller.gameKeyboardCaptured) &&\n        ((controller.lastButtonState | controller.buttonState) & ControllerDelegate::BUTTON_B);",
  );
  if (!source.includes("NH3D raw keyboard grip")) {
    source = replaceOnce(source,
      "    const auto clickButtons = ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A |\n        ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD;\n    const bool grabbing = externalVR->IsPresenting() && controller.hasAim && gamePanels && gamePanels->Grip(",
      "    const auto clickButtons = ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A |\n        ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD;\n    const bool grabbing = externalVR->IsPresenting() && !keyboardForeground && controller.hasAim && gamePanels && gamePanels->Grip(",
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
  if (!source.includes("NH3D move-bar release")) source = replaceOnce(source,
    "          immersiveKeyboardGrabActive = false;\n          movingWidget->EndMoving();",
    "          immersiveKeyboardGrabActive = false;\n          movingWidget->EndMoving();\n          // NH3D move-bar release: finish the Android touch capture too.\n          VRBrowser::HandleMotionEvent(immersiveKeyboard->GetHandle(), controller.index, jboolean(controller.focused),\n              false, controller.pointerX, controller.pointerY, 1);",
    "release Android move bar capture");
  source = source.replace("const bool keyboardVisible = externalVR->IsPresenting() && immersiveKeyboard && immersiveKeyboard->IsVisible();",
    "const bool keyboardVisible = externalVR->IsPresenting() && immersiveKeyboard && immersiveKeyboard->GetPlacement()->visible;");
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
  source = source.replace(
    "    if (externalVR->IsPresenting() && immersiveKeyboard && hitWidget == immersiveKeyboard) controller.gameKeyboardCaptured = true;",
    "    if (externalVR->IsPresenting() && (keyboardBackHeld || (immersiveKeyboard && hitWidget == immersiveKeyboard))) controller.gameKeyboardCaptured = true;",
  );
  if (!source.includes("NH3D keyboard controller ownership")) {
    source = replaceOnce(source,
      "    controller.gameActionHover = hitWidget && gamePanels && gamePanels->Owns(hitWidget) && gamePanels->IsAction(controller.index);",
      `    // NH3D keyboard controller ownership reaches ExternalVR before it
    // publishes this frame's gamepad state, including the left trigger.
    if (externalVR->IsPresenting() && (keyboardBackHeld || (immersiveKeyboard && hitWidget == immersiveKeyboard))) controller.gameKeyboardCaptured = true;
    else if (!pressed) controller.gameKeyboardCaptured = false;
    controller.gameActionHover = hitWidget && gamePanels && gamePanels->Owns(hitWidget) && gamePanels->IsAction(controller.index);`,
      "record immersive keyboard controller ownership");
  }
  // Persist upgrades even when the ownership marker already exists.
  writeFileSync(world, source);

  source = readFileSync(external, "utf8").replaceAll("\r\n", "\n");
  source = source.replace(
    "    const uint64_t gameUiEffectiveMask = controller.leftHanded && !controller.gameKeyboardCaptured\n        ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;",
    "    const uint64_t gameUiEffectiveMask = controller.gameKeyboardCaptured\n        ? gameUiButtonMask | (uint64_t(1) << device::kImmersiveButtonB)\n        : controller.leftHanded ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;",
  );
  if (!source.includes("NH3D keyboard controller mask")) {
    source = replaceOnce(source,
      "    const uint64_t gameUiEffectiveMask = controller.leftHanded ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;",
      `    // NH3D keyboard controller mask: preserve left-trigger running except
    // while that controller is captured by the foreground native keyboard.
    const uint64_t gameUiEffectiveMask = controller.gameKeyboardCaptured
        ? gameUiButtonMask | (uint64_t(1) << device::kImmersiveButtonB)
        : controller.leftHanded ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;
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
  }
  writeFileSync(external, source);
}
