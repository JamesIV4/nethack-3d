import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchTouchOwnershipSource(source) {
  source = source.replaceAll("\r\n", "\n");
  if (source.includes("NH3D immersive touch ownership")) return source;
  return replaceOnce(source,
    "        boolean moving = (device.mCoords[0].x != aX) || (device.mCoords[0].y != aY);",
    `        // NH3D immersive touch ownership: only a delivered DOWN owns a touch.
        // A suppressed second hand must neither block the owner's UP nor send
        // MOVE events into its gesture. Require release before retrying.
        if (BuildConfig.NH3D_GAME_HOST && gameImmersive) {
            if (aWidget == null) {
                if (device.mTouchStartWidget != null) {
                    generateEvent(device.mTouchStartWidget, device, aFocused, MotionEvent.ACTION_CANCEL, false);
                }
                if (device.mHoverStartWidget != null) {
                    generateEvent(device.mHoverStartWidget, device, aFocused, MotionEvent.ACTION_HOVER_EXIT, true, device.mMouseOutCoords);
                }
                device.mTouchStartWidget = null;
                device.mPreviousWidget = null;
                device.mHoverStartWidget = null;
                device.mGameMouse = false;
                device.mWasPressed = aPressed;
                return;
            }
            if (aPressed && !device.mWasPressed && isOtherDeviceDown(device.mDevice)) {
                device.mWasPressed = true;
                return;
            }
            if (aPressed && device.mWasPressed && device.mTouchStartWidget == null) return;
        }
        boolean moving = (device.mCoords[0].x != aX) || (device.mCoords[0].y != aY);`,
    "immersive touch ownership");
}

export function patchTouchOwnership(checkout) {
  const file = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java");
  writeFileSync(file, patchTouchOwnershipSource(readFileSync(file, "utf8")));
}
