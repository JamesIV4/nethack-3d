import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

/**
 * The Quest laser is a touch source by default. A flat FPS world can opt in
 * to a latched mouse gesture only after the native host has classified the
 * target as world space; HTML controls never enter that exception.
 *
 * The host-side classification flag is deliberately separate from widget
 * identity: the game page and its HTML controls share one WindowWidget.
 */
export function patchLaserTouch(checkout) {
  const file = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java");
  let source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const stock = "    public static volatile boolean gameImmersive = false;";
  const patched = `    public static volatile boolean gameImmersive = false;
    // Set only by the native hit classifier for a flat first-person world ray.
    // It is consumed for the current hover dispatch and never applies to HTML.
    public static volatile boolean gameFlatFpsWorldHover = false;`;
  if (!source.includes("gameFlatFpsWorldHover")) source = replaceOnce(source, stock, patched, "flat FPS world-hover state");
  const oldMouse = "final boolean mouse = isGameMouseWidget(aWidget) && (gameImmersive || aAction == MotionEvent.ACTION_HOVER_ENTER || aAction == MotionEvent.ACTION_HOVER_MOVE || aAction == MotionEvent.ACTION_HOVER_EXIT);";
  const newMouse = "final boolean mouse = isGameMouseWidget(aWidget) && aDevice.mGameMouse;";
  if (!source.includes(newMouse)) source = replaceOnce(source, oldMouse, newMouse, "touch-first Quest laser event type");
  if (!source.includes("boolean mGameMouse;")) source = replaceOnce(source,
    "        int mMouseButton = MotionEvent.BUTTON_PRIMARY;",
    "        int mMouseButton = MotionEvent.BUTTON_PRIMARY;\n        boolean mGameMouse;",
    "latched Quest mouse gesture");
  if (!source.includes("!aPressed && !device.mWasPressed) device.mGameMouse")) source = replaceOnce(source,
    "        if (aWidget != device.mPreviousWidget && !aPressed) {",
    "        if (!aPressed && !device.mWasPressed) device.mGameMouse = isGameMouseWidget(aWidget) && !gameImmersive && gameFlatFpsWorldHover;\n        if (aWidget != device.mPreviousWidget && !aPressed) {",
    "classify Quest mouse hover");
  if (!source.includes("device.mGameMouse = isGameMouseWidget(aWidget) && !gameImmersive && gameFlatFpsWorldHover;\n            device.mDownTime")) source = replaceOnce(source,
    "            device.mMouseButton = aButtons == MotionEvent.BUTTON_SECONDARY ? MotionEvent.BUTTON_SECONDARY : MotionEvent.BUTTON_PRIMARY;\n            device.mDownTime",
    "            device.mMouseButton = aButtons == MotionEvent.BUTTON_SECONDARY ? MotionEvent.BUTTON_SECONDARY : MotionEvent.BUTTON_PRIMARY;\n            device.mGameMouse = isGameMouseWidget(aWidget) && !gameImmersive && gameFlatFpsWorldHover;\n            device.mDownTime",
    "classify Quest mouse gesture on press");
  if (!source.includes("device.mGameMouse = false;\n            device.mTouchStartWidget = null;")) source = replaceOnce(source,
    "            device.mTouchStartWidget = null;\n        } else if (moving && aPressed)",
    "            device.mGameMouse = false;\n            device.mTouchStartWidget = null;\n        } else if (moving && aPressed)",
    "clear Quest mouse gesture after release");
  writeFileSync(file, source);

  const activity = path.join(checkout, "app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java");
  source = readFileSync(activity, "utf8").replaceAll("\r\n", "\n");
  const inputMode = `            MotionEventGenerator.gameFlatFpsWorldHover = widget instanceof WindowWidget &&
                    !((WindowWidget)widget).isNativeContentVisible() &&
                    BundledGameServer.isFlatFpsWorldHover(x, y, widget.getPlacement().textureWidth(), widget.getPlacement().textureHeight());`;
  if (!source.includes("BundledGameServer.isFlatFpsWorldHover")) source = replaceOnce(source,
    "            final float y = aY / scale;",
    "            final float y = aY / scale;\n" + inputMode,
    "flat FPS world-hover classification");
  writeFileSync(activity, source);
}
