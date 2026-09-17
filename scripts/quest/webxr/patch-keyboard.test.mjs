import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { patchKeyboard } from "./patch-keyboard.mjs";
import { patchKeyboardDialogs } from "./patch-keyboard-dialogs.mjs";

const checkout = mkdtempSync(path.join(os.tmpdir(), "nh3d-keyboard-"));
after(() => {
  const target = path.resolve(checkout);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith("nh3d-keyboard-"));
  rmSync(target, { recursive: true, force: true });
});

const source = (...parts) => path.join(checkout, ...parts);
mkdirSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets"), { recursive: true });
mkdirSync(source("app/src/common/shared/com/igalia/wolvic/input"), { recursive: true });
mkdirSync(source("app/src/main/cpp"), { recursive: true });
mkdirSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/dialogs"), { recursive: true });
writeFileSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/dialogs/UIDialog.java"), `
class UIDialog {
    void initialize() {
        mWidgetPlacement.cylinder = false;
    }
}
`);

writeFileSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java"), `
import com.igalia.wolvic.R;
class KeyboardWidget {
    public void dismiss() {
    }
    @Override
    protected void initializeWidgetPlacement(WidgetPlacement aPlacement) {
        // FIXME: keyboard is misplaced when rendered in a cylinder layer.
        aPlacement.cylinder = false;
        aPlacement.layerPriority = 1;
    }

    @Override
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
    }

    @Override
    public void hideSoftInput(@NonNull WSession session) {}

    public KeyboardWidget(Context aContext) {}
}
`);

writeFileSync(source("app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java"), `
import com.igalia.wolvic.ui.widgets.WindowWidget;
class MotionEventGenerator {
    public static volatile boolean gameImmersive = false;
    private static boolean isGameMouseWidget(Widget widget) { return false; }
    static final String LOGTAG = SystemUtils.createLogtag(MotionEventGenerator.class);
    public static void dispatch(Widget aWidget, boolean aPressed, int aButtons) {
        if (aPressed && aButtons == MotionEvent.BUTTON_SECONDARY && !isGameMouseWidget(aWidget)) return;
    }
}
`);

writeFileSync(source("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java"), `
class VRBrowserActivity {
    void handleBack() {
        runOnUiThread(() -> {
            dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK));
        });
    }
    public void onBackPressed() {
        if (mPlatformPlugin != null && mPlatformPlugin.onBackPressed()) {
            return;
        }
        if (mIsPresentingImmersive.getValue()) {
            queueRunnable(this::exitImmersiveNative);
            return;
        }
        if (mBackHandlers.size() > 0) {
            mBackHandlers.getLast().run();
        }
    }
}
`);

writeFileSync(source("app/src/main/cpp/BrowserWorld.cpp"), `
struct BrowserWorld::State {
  void UpdateTrackedKeyboard();
};

void
BrowserWorld::State::UpdateTrackedKeyboard() {}

void BrowserWorld::DrawImmersive() {
  m.drawList->Reset();
  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList);
  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);
  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);
  m.drawList->Draw(*camera);
  for (const auto& window : hiddenWindows) window->ToggleWidget(true);
}

void BrowserWorld::TickImmersive() {
    m.CheckBackButton();
    createPassthroughLayerIfNeeded();
  rootTransparent->SetTransform(gameUiTransform);
  drawList->Reset(); rootTransparent->Cull(*cullVisitor, *drawList);
  if (!controllers->IsVisible()) controllers->SetVisible(true);
    externalVR->StopPresenting();
  } else {
    m.gameUiAnchored = false;
  }
}

void BrowserWorld::CheckBackButton() {
    if (wasGoBackButtonClicked(controller, externalVR->IsPresenting())) {
      SimulateBack();
    }
}

void BrowserWorld::UpdateControllers() {
      const bool hit = panel ? true :
            widget->TestControllerIntersection(start, direction, result, normal, clamp, isInWidget, distance);
      if (panel ? true :
          previousWidget->TestControllerIntersection(start, direction, result, normal, false, isInWidget, distance)) {
      }
    if (wasGoBackButtonClicked(controller, externalVR->IsPresenting())) {
      SimulateBack();
    }
    const auto clickButtons = ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A |
        ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD;
    const bool grabbing = externalVR->IsPresenting() && controller.hasAim && gamePanels && gamePanels->Grip(
    if ((!externalVR->IsPresenting() || !controller.hasAim) && gamePanels) gamePanels->EndGrip(controller.index);
    controller.gameUiGrip = grabbing || (wasUiGrip && (gripDown || (controller.buttonState & clickButtons)));
    const bool gameSecondary = !controller.gameUiGrip && !wasUiGrip && gripDown;
    const bool wasGameSecondary = externalVR->IsPresenting() && !wasUiGrip && (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE);
    const bool pressed = !controller.gameUiGrip && (gameSecondary || false);
    const bool wasPressed = !wasUiGrip && (wasGameSecondary || false);
    const bool runHand = externalVR->IsPresenting() && controller.leftHanded;
          if (isInWidget && (distance < hitDistance) && GameUiHit(widget, result)) {}
    controller.gameActionHover = hitWidget && gamePanels && gamePanels->Owns(hitWidget) && gamePanels->IsAction(controller.index);
    if (controller.focused && movingWidget && movingWidget->IsMoving(controller.index)) {
      if (!pressed && wasPressed) {
        movingWidget->EndMoving();
      }
    }
}
`);

writeFileSync(source("app/src/main/cpp/Controller.h"), `
class Controller {
  int32_t index;
  bool enabled;
  bool focused;
  bool gameWorldCaptured = false;
  bool gameActionHover = false;
  bool gameUiGrip = false;
};
`);
writeFileSync(source("app/src/main/cpp/Controller.cpp"), `
Controller& Controller::operator=(const Controller& aController) {
  index = aController.index;
  enabled = aController.enabled;
  focused = aController.focused;
  gameWorldCaptured = aController.gameWorldCaptured;
  return *this;
}
void Controller::Reset() {
  buttonState = lastButtonState = 0;
}
`);
writeFileSync(source("app/src/main/cpp/ExternalVR.cpp"), `
void ExternalVR::PushFramePoses() {
  for (int i = 0; i < aControllers.size(); ++i) {
    const Controller& controller = aControllers[i];
    const uint64_t gameUiEffectiveMask = controller.leftHanded ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;
    immersiveController.buttonPressed = controller.gameUiGrip ? 0 : controller.widget ? controller.immersivePressedState & ~gameUiEffectiveMask : controller.immersivePressedState;
    immersiveController.buttonTouched = controller.gameUiGrip ? 0 : controller.widget ? controller.immersiveTouchedState & ~gameUiEffectiveMask : controller.immersiveTouchedState;
      immersiveController.triggerValue[j] = controller.gameUiGrip ? 0.0f : controller.widget && (gameUiEffectiveMask & (uint64_t(1) << j)) ? 0.0f : controller.immersiveTriggerValues[j];
      immersiveController.axisValue[j] = controller.gameUiGrip ? 0.0f : controller.widget && !controller.gameActionHover && !(controller.leftHanded && (controller.buttonState & ControllerDelegate::BUTTON_TRIGGER)) ? 0.0f : controller.immersiveAxes[j];
  }
}
`);

test("game-host keyboard upgrades from an OpenXR layer to a GPU surface and remains idempotent", () => {
  patchKeyboard(checkout);
  const keyboard = readFileSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java"), "utf8");
  const motion = readFileSync(source("app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java"), "utf8");
  const activity = readFileSync(source("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java"), "utf8");
  const world = readFileSync(source("app/src/main/cpp/BrowserWorld.cpp"), "utf8");
  const controller = readFileSync(source("app/src/main/cpp/Controller.h"), "utf8");
  const controllerCpp = readFileSync(source("app/src/main/cpp/Controller.cpp"), "utf8");
  const external = readFileSync(source("app/src/main/cpp/ExternalVR.cpp"), "utf8");
  assert.match(keyboard, /if \(BuildConfig\.NH3D_GAME_HOST\) aPlacement\.layer = false;/);
  assert.match(keyboard, /The game host draws this Android surface in its post-WebXR GPU pass/);
  assert.match(world, /PrepareImmersiveKeyboard\(\);/);
  assert.match(world, /DrawImmersiveKeyboard\(\*camera\);/);
  assert.match(world, /NH3D raw keyboard root/);
  assert.match(world, /GetRoot\(\)->RemoveFromParents\(\)/);
  assert.match(world, /PostMultiply\(vrb::Matrix::Identity\(\)\.Scale\(vrb::Vector\(0\.25f, 0\.25f, 0\.25f\)\)\)/);
  assert.match(world, /NH3D raw keyboard focus/);
  assert.match(world, /keyboardBack/);
  assert.match(world, /keyboardVisible/);
  assert.match(world, /keyboardBackHeld/);
  assert.match(keyboard, /supportsMultipleInputDevices/);
  assert.match(motion, /isGameKeyboardWidget/);
  assert.match(motion, /!isGameMouseWidget\(aWidget\) && !isGameKeyboardWidget\(aWidget\)/);
  assert.match(activity, /NH3D keyboard back priority/);
  assert.match(activity, /mKeyboard\.dismiss\(\);[\s\S]*return;[\s\S]*mIsPresentingImmersive/);
  assert.match(world, /NH3D raw keyboard move/);
  assert.match(world, /NH3D raw keyboard grip/);
  assert.match(world, /keyboardForeground/);
  assert.match(world, /ImmersiveKeyboardHit\(controller\.StartPoint\(\), controller\.Direction\(\)\)/);
  assert.match(world, /stillRegistered/);
  assert.match(world, /gameKeyboardCaptured/);
  assert.match(world, /immersiveKeyboard && hitWidget == immersiveKeyboard/);
  assert.match(world, /!immersiveKeyboard \|\| hitWidget != immersiveKeyboard \|\| keyboardForeground/);
  assert.match(controller, /bool gameKeyboardCaptured = false/);
  assert.match(controllerCpp, /gameKeyboardCaptured = aController\.gameKeyboardCaptured/);
  assert.match(controllerCpp, /gameKeyboardCaptured = false/);
  assert.match(external, /NH3D keyboard controller mask/);
  assert.match(external, /controller\.gameKeyboardCaptured[\s\S]*kImmersiveButtonB/);
  assert.match(external, /const bool gameUiCapture = controller\.widget \|\| controller\.gameKeyboardCaptured/);

  patchKeyboard(checkout);
  assert.equal(readFileSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java"), "utf8"), keyboard);
  assert.equal(readFileSync(source("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java"), "utf8"), activity);
  assert.equal(readFileSync(source("app/src/main/cpp/BrowserWorld.cpp"), "utf8"), world);
  assert.equal(readFileSync(source("app/src/main/cpp/Controller.h"), "utf8"), controller);
  assert.equal(readFileSync(source("app/src/main/cpp/Controller.cpp"), "utf8"), controllerCpp);
  assert.equal(readFileSync(source("app/src/main/cpp/ExternalVR.cpp"), "utf8"), external);
});

test("prior keyboard patch gains the game-host GPU surface without changing its callbacks", () => {
  const keyboardFile = source("app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java");
  const olderPatchedKeyboard = readFileSync(keyboardFile, "utf8").replace(
    `        // A native VRLayer is submitted behind the opaque WebXR projection.
        // The game host draws this Android surface in its post-WebXR GPU pass.
        if (BuildConfig.NH3D_GAME_HOST) aPlacement.layer = false;
`,
    "",
  );
  writeFileSync(keyboardFile, olderPatchedKeyboard);

  patchKeyboard(checkout);
  const upgraded = readFileSync(keyboardFile, "utf8");
  assert.match(upgraded, /if \(BuildConfig\.NH3D_GAME_HOST\) aPlacement\.layer = false;/);
  assert.equal((upgraded.match(/private void updateImmersiveInput/g) ?? []).length, 1);
});

test("prior raw keyboard patch upgrades its root, ray, move, and grip lifecycle", () => {
  const worldFile = source("app/src/main/cpp/BrowserWorld.cpp");
  const legacy = readFileSync(worldFile, "utf8")
    .replace("  // NH3D raw keyboard root: it must not inherit gameUiTransform.\n", "")
    .replace("  bool ImmersiveKeyboardHit(const vrb::Vector& start, const vrb::Vector& direction) const;\n", "");
  const helperStart = legacy.indexOf("bool\nBrowserWorld::State::ImmersiveKeyboardHit(");
  const moveStart = legacy.indexOf("void\nBrowserWorld::State::MoveImmersiveKeyboard(", helperStart);
  assert.ok(helperStart >= 0 && moveStart > helperStart);
  writeFileSync(worldFile, legacy.slice(0, helperStart) + legacy.slice(moveStart));

  patchKeyboard(checkout);
  const upgraded = readFileSync(worldFile, "utf8");
  assert.match(upgraded, /NH3D raw keyboard root/);
  assert.match(upgraded, /bool\nBrowserWorld::State::ImmersiveKeyboardHit/);
  assert.match(upgraded, /movingWidget && movingWidget->GetWidget\(\) == immersiveKeyboard/);
  assert.match(upgraded, /ImmersiveKeyboardHit/);

  patchKeyboard(checkout);
  assert.equal(readFileSync(worldFile, "utf8"), upgraded);
});

test("stationary button edges are handled once and keyboard rays/drag use the visible quad", () => {
  const world = readFileSync(source("app/src/main/cpp/BrowserWorld.cpp"), "utf8");
  assert.match(world, /if \(m.webXRInterstialState != WebXRInterstialState::HIDDEN\) m.CheckBackButton\(\);/);
  assert.doesNotMatch(world, /\n    m.CheckBackButton\(\);/);
  assert.match(world, /GetQuad\(\)->GetTransformNode\(\)->GetWorldTransform\(\)/);
  assert.match(world, /std::abs\(ray.z\(\)\)/);
  assert.match(world, /if \(t < 0\) return false/);
  assert.match(world, /point = start \+ direction.Normalize\(\) \* immersiveKeyboardGrabDistance/);
  assert.match(world, /NH3D move-bar release[\s\S]*VRBrowser::HandleMotionEvent/);
  assert.match(world, /std::atan2\(toHead.y\(\), horizontal\)/);
});

test("existing ownership markers still receive B capture and button-mask upgrades", () => {
  const worldFile = source("app/src/main/cpp/BrowserWorld.cpp");
  const externalFile = source("app/src/main/cpp/ExternalVR.cpp");
  writeFileSync(worldFile, readFileSync(worldFile, "utf8").replace(
    "(keyboardBackHeld || (immersiveKeyboard && hitWidget == immersiveKeyboard))",
    "immersiveKeyboard && hitWidget == immersiveKeyboard"));
  writeFileSync(externalFile, readFileSync(externalFile, "utf8").replace(
    `controller.gameKeyboardCaptured
        ? gameUiButtonMask | (uint64_t(1) << device::kImmersiveButtonB)
        : controller.leftHanded ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;`,
    `controller.leftHanded && !controller.gameKeyboardCaptured
        ? gameUiButtonMask & ~(uint64_t(1) << device::kImmersiveButtonTrigger) : gameUiButtonMask;`));
  patchKeyboard(checkout);
  assert.match(readFileSync(worldFile, "utf8"), /keyboardBackHeld \|\|/);
  assert.match(readFileSync(externalFile, "utf8"), /controller.gameKeyboardCaptured[\s\S]*kImmersiveButtonB/);
});

test("speech dialogs render and receive foreground input, and the complete patch chain can run twice", () => {
  patchKeyboardDialogs(checkout);
  const paths = ["app/src/main/cpp/BrowserWorld.cpp", "app/src/main/cpp/ExternalVR.cpp",
    "app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java",
    "app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java",
    "app/src/common/shared/com/igalia/wolvic/ui/widgets/dialogs/UIDialog.java"];
  const before = paths.map(p => readFileSync(source(p), "utf8"));
  assert.match(before[0], /KeyboardPriority\(widget\) > 0 \? KeyboardIntersection/);
  assert.match(before[0], /KeyboardPriority\(previousWidget\) > 0 \? KeyboardIntersection/);
  assert.match(before[0], /KeyboardForegroundHit\(controller.StartPoint/);
  assert.match(before[0], /placement->name != "VoiceSearchWidget" && placement->name != "PermissionWidget"/);
  assert.match(before[0], /m.DrawKeyboardDialogs\(\*camera\)/);
  assert.match(before[2], /gameImmersive\) hideOverlays\(\)/);
  assert.match(before[2], /reason == RESTART_REASON_FOCUS/);
  assert.match(before[3], /NH3D direct keyboard back/);
  assert.match(before[4], /NH3D_GAME_HOST\) mWidgetPlacement.layer = false/);
  patchKeyboard(checkout);
  patchKeyboardDialogs(checkout);
  assert.deepEqual(paths.map(p => readFileSync(source(p), "utf8")), before);
});
