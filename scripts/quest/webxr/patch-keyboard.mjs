import { readFileSync, writeFileSync } from "node:fs";
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
  if (source.includes("PrepareImmersiveKeyboard")) {
    if (source.includes(foregroundKeyboard)) return;
    const priorDraw = "  const bool drawImmersiveKeyboard = m.immersiveKeyboardPlaced && m.immersiveKeyboard;\n  if (drawImmersiveKeyboard) m.immersiveKeyboard->ToggleWidget(false);\n  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);\n  if (drawImmersiveKeyboard) { m.immersiveKeyboard->ToggleWidget(true); m.DrawImmersiveKeyboard(*camera); }";
    const draw = priorDraw.slice(0, priorDraw.lastIndexOf("\n  if (drawImmersiveKeyboard)"));
    source = replaceOnce(source, priorDraw, draw, "move existing keyboard above foreground modal");
    source = replaceOnce(source,
      "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
      "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n" + foregroundKeyboard + "\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
      "draw existing keyboard above foreground modal");
    writeFileSync(world, source);
    return;
  }
  const keyboardState = `  // The game pane root is transformed independently; keep Wolvic's keyboard
  // in one raw headset-facing transform for both culling and controller rays.
  WidgetPtr immersiveKeyboard;
  vrb::Matrix immersiveKeyboardOriginal = vrb::Matrix::Identity();
  vrb::Matrix immersiveKeyboardTransform = vrb::Matrix::Identity();
  float immersiveKeyboardAnchorRevision = -1;
  bool immersiveKeyboardPlaced = false;
  void PrepareImmersiveKeyboard();
  void SyncImmersiveKeyboard();
  void RestoreImmersiveKeyboard();
  void DrawImmersiveKeyboard(const vrb::Camera& camera);
  void UpdateTrackedKeyboard();`;
  const oldKeyboardState = "  // The game pane root is transformed independently; keep Wolvic's keyboard in its own native pass.\n  void DrawImmersiveKeyboard(const vrb::Camera& camera);\n  void UpdateTrackedKeyboard();";
  source = source.includes(oldKeyboardState)
    ? replaceOnce(source, oldKeyboardState, keyboardState, "upgrade immersive keyboard state")
    : replaceOnce(source, "  void UpdateTrackedKeyboard();", keyboardState, "immersive keyboard state");
  const drawKeyboard = `
void
BrowserWorld::State::RestoreImmersiveKeyboard() {
  if (immersiveKeyboardPlaced && immersiveKeyboard) immersiveKeyboard->SetTransform(immersiveKeyboardOriginal);
  immersiveKeyboard = nullptr;
  immersiveKeyboardPlaced = false;
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
    const auto head = device->GetHeadTransform();
    const auto forward = head.MultiplyDirection(vrb::Vector(0, 0, -1));
    const auto yaw = vrb::Matrix::Rotation(vrb::Vector(0, 1, 0), std::atan2(-forward.x(), -forward.z()));
    const auto center = head.GetTranslation() + yaw.MultiplyDirection(vrb::Vector(0, -0.35f, -1.0f));
    // Preserve Wolvic's keyboard size and local tilt, replacing only its flat-window pose.
    const auto local = immersiveKeyboardOriginal.Translate(-immersiveKeyboardOriginal.GetTranslation());
    immersiveKeyboardTransform = vrb::Matrix::Translation(center).PostMultiply(yaw).PostMultiply(local);
    immersiveKeyboard->SetTransform(immersiveKeyboardTransform);
    immersiveKeyboardAnchorRevision = revision;
    immersiveKeyboardPlaced = true;
  } else immersiveKeyboard->SetTransform(immersiveKeyboardTransform);
  // The game-root cull would apply gameUiTransform a second time. Hide the
  // keyboard there, then cull its raw root before controller hit testing.
  immersiveKeyboard->ToggleWidget(false);
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
  const trackedStart = source.indexOf("void\nBrowserWorld::State::UpdateTrackedKeyboard() {", oldDrawStart);
  if (oldDrawStart >= 0 && trackedStart > oldDrawStart) {
    source = replaceOnce(source, source.slice(oldDrawStart, trackedStart), drawKeyboard, "upgrade immersive keyboard draw implementation");
  } else source = replaceOnce(source,
    "void\nBrowserWorld::State::UpdateTrackedKeyboard() {",
    drawKeyboard + "void\nBrowserWorld::State::UpdateTrackedKeyboard() {",
    "immersive keyboard draw implementation");
  const keyboardDraw = "  const bool drawImmersiveKeyboard = m.immersiveKeyboardPlaced && m.immersiveKeyboard;\n  if (drawImmersiveKeyboard) m.immersiveKeyboard->ToggleWidget(false);\n  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);";
  const priorStateKeyboardDraw = keyboardDraw + "\n  if (drawImmersiveKeyboard) { m.immersiveKeyboard->ToggleWidget(true); m.DrawImmersiveKeyboard(*camera); }";
  const oldKeyboardDraw = "  WidgetPtr immersiveKeyboard;\n  for (const auto& widget : m.widgets) if (widget->GetPlacement()->name == \"KeyboardWidget\" && widget->IsVisible()) {\n    immersiveKeyboard = widget; widget->ToggleWidget(false); break;\n  }\n  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);\n  if (immersiveKeyboard) { immersiveKeyboard->ToggleWidget(true); m.DrawImmersiveKeyboard(*camera); }";
  const stockDraw = "  m.drawList->Reset();\n  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);\n  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);";
  source = source.includes(oldKeyboardDraw)
    ? replaceOnce(source, oldKeyboardDraw, keyboardDraw, "upgrade keyboard draw path")
    : source.includes(priorStateKeyboardDraw)
      ? replaceOnce(source, priorStateKeyboardDraw, keyboardDraw, "move keyboard above foreground modal")
    : replaceOnce(source, stockDraw, keyboardDraw, "exclude keyboard from transformed pane root");
  source = replaceOnce(source,
    "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
    "  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);\n  m.drawList->Draw(*camera);\n" + foregroundKeyboard + "\n  for (const auto& window : hiddenWindows) window->ToggleWidget(true);",
    "draw keyboard above foreground modal");
  source = replaceOnce(source,
    "  rootTransparent->SetTransform(gameUiTransform);\n  drawList->Reset(); rootTransparent->Cull(*cullVisitor, *drawList);\n  if (!controllers->IsVisible()) controllers->SetVisible(true);",
    "  PrepareImmersiveKeyboard();\n  rootTransparent->SetTransform(gameUiTransform);\n  drawList->Reset(); rootTransparent->Cull(*cullVisitor, *drawList);\n  SyncImmersiveKeyboard();\n  if (!controllers->IsVisible()) controllers->SetVisible(true);",
    "synchronize raw keyboard before controller rays");
  source = replaceOnce(source,
    "    externalVR->StopPresenting();",
    "    RestoreImmersiveKeyboard();\n    externalVR->StopPresenting();",
    "restore keyboard on immersive exit");
  source = replaceOnce(source,
    "  } else {\n    m.gameUiAnchored = false;",
    "  } else {\n    m.RestoreImmersiveKeyboard();\n    m.gameUiAnchored = false;",
    "restore keyboard outside immersive mode");
  writeFileSync(world, source);
}
