import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { patchLaserTouch } from "./patch-laser-touch.mjs";

const checkout = mkdtempSync(path.join(os.tmpdir(), "nh3d-laser-touch-"));
after(() => {
  const target = path.resolve(checkout);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
  assert.ok(path.basename(target).startsWith("nh3d-laser-touch-"));
  rmSync(target, { recursive: true, force: true });
});
const source = (...parts) => path.join(checkout, ...parts);
mkdirSync(source("app/src/common/shared/com/igalia/wolvic/input"), { recursive: true });
mkdirSync(source("app/src/common/shared/com/igalia/wolvic"), { recursive: true });
writeFileSync(source("app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java"), `
public class MotionEventGenerator {
    public static volatile boolean gameImmersive = false;
    static class Device {
        boolean mWasPressed;
        int mMouseButton = MotionEvent.BUTTON_PRIMARY;
    }
    private static boolean isGameMouseWidget(Widget widget) { return true; }
    private static void generateEvent(Widget aWidget, Device aDevice, boolean aFocused, int aAction, boolean aGeneric) {
        final boolean mouse = isGameMouseWidget(aWidget) && (gameImmersive || aAction == MotionEvent.ACTION_HOVER_ENTER || aAction == MotionEvent.ACTION_HOVER_MOVE || aAction == MotionEvent.ACTION_HOVER_EXIT);
    }
    public static void dispatch(WidgetManagerDelegate widgetManager, Widget aWidget, int aDevice, boolean aFocused, boolean aPressed, float aX, float aY, int aButtons) {
        Device device = new Device();
        if (aWidget != device.mPreviousWidget && !aPressed) {}
        if (aPressed && !device.mWasPressed) {
            device.mMouseButton = aButtons == MotionEvent.BUTTON_SECONDARY ? MotionEvent.BUTTON_SECONDARY : MotionEvent.BUTTON_PRIMARY;
            device.mDownTime = SystemClock.uptimeMillis();
        } else if (!aPressed && device.mWasPressed) {
            device.mTouchStartWidget = null;
        } else if (moving && aPressed) {}
    }
}
`);
writeFileSync(source("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java"), `
class VRBrowserActivity {
  void handle() {
            final float y = aY / scale;
  }
}
`);

test("flat FPS world pointer uses one latched mouse gesture while UI and immersive paths remain touch", () => {
  patchLaserTouch(checkout);
  const motion = readFileSync(source("app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java"), "utf8");
  const activity = readFileSync(source("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java"), "utf8");
  assert.match(motion, /final boolean mouse = isGameMouseWidget\(aWidget\) && aDevice\.mGameMouse/);
  assert.match(motion, /!aPressed && !device\.mWasPressed\) device\.mGameMouse = isGameMouseWidget\(aWidget\) && !gameImmersive && gameFlatFpsWorldHover/);
  assert.match(motion, /aPressed && !device\.mWasPressed\)[\s\S]*device\.mGameMouse = isGameMouseWidget\(aWidget\) && !gameImmersive && gameFlatFpsWorldHover/);
  assert.match(motion, /device\.mGameMouse = false;\s*device\.mTouchStartWidget = null/);
  assert.match(activity, /BundledGameServer\.isFlatFpsWorldHover\(x, y, widget\.getPlacement\(\)\.textureWidth\(\), widget\.getPlacement\(\)\.textureHeight\(\)\)/);
});
