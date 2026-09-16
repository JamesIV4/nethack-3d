import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { patchKeyboard } from "./patch-keyboard.mjs";

const checkout = mkdtempSync(path.join(os.tmpdir(), "nh3d-keyboard-"));
after(() => {
  const target = path.resolve(checkout);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith("nh3d-keyboard-"));
  rmSync(target, { recursive: true, force: true });
});

const source = (...parts) => path.join(checkout, ...parts);
mkdirSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets"), { recursive: true });
mkdirSync(source("app/src/main/cpp"), { recursive: true });

writeFileSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java"), `
import com.igalia.wolvic.R;
class KeyboardWidget {
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
  rootTransparent->SetTransform(gameUiTransform);
  drawList->Reset(); rootTransparent->Cull(*cullVisitor, *drawList);
  if (!controllers->IsVisible()) controllers->SetVisible(true);
    externalVR->StopPresenting();
  } else {
    m.gameUiAnchored = false;
  }
}
`);

test("game-host keyboard upgrades from an OpenXR layer to a GPU surface and remains idempotent", () => {
  patchKeyboard(checkout);
  const keyboard = readFileSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java"), "utf8");
  const world = readFileSync(source("app/src/main/cpp/BrowserWorld.cpp"), "utf8");
  assert.match(keyboard, /if \(BuildConfig\.NH3D_GAME_HOST\) aPlacement\.layer = false;/);
  assert.match(keyboard, /The game host draws this Android surface in its post-WebXR GPU pass/);
  assert.match(world, /PrepareImmersiveKeyboard\(\);/);
  assert.match(world, /DrawImmersiveKeyboard\(\*camera\);/);

  patchKeyboard(checkout);
  assert.equal(readFileSync(source("app/src/common/shared/com/igalia/wolvic/ui/widgets/KeyboardWidget.java"), "utf8"), keyboard);
  assert.equal(readFileSync(source("app/src/main/cpp/BrowserWorld.cpp"), "utf8"), world);
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
