import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchControllerMouse(checkout) {
  const edit = (name, fn) => { const file = path.join(checkout, name); writeFileSync(file, fn(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))); };
  edit("app/src/main/cpp/BrowserWorld.cpp", s => {
    if (s.includes("NH3D UI pane grip priority")) return s;
    let begin = s.indexOf("    // NH3D grip is the secondary mouse button");
    if (begin < 0) begin = s.indexOf("    // NH3D movable action row:");
    const end = s.indexOf("    const bool runHand", begin);
    if (begin < 0 || end < 0) throw new Error("Missing native grip ownership block");
    s = s.slice(0, begin) + `    // NH3D grip is the secondary mouse button over the world.
    // NH3D UI pane grip priority: capture the pane before publishing WebXR buttons.
    const bool wasUiGrip = controller.gameUiGrip;
    const bool gripDown = externalVR->IsPresenting() && (controller.buttonState & ControllerDelegate::BUTTON_SQUEEZE);
    const auto clickButtons = ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A |
        ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD;
    const bool grabbing = externalVR->IsPresenting() && controller.hasAim && gamePanels && gamePanels->Grip(
        controller.index, gripDown, (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE) ||
            (controller.buttonState & clickButtons), controller.transformMatrix.GetTranslation(), controller.StartPoint(), controller.Direction());
    if ((!externalVR->IsPresenting() || !controller.hasAim) && gamePanels) gamePanels->EndGrip(controller.index);
    controller.gameUiGrip = grabbing || (wasUiGrip && (gripDown || (controller.buttonState & clickButtons)));
    if (grabbing && !wasUiGrip && controller.widget) {
      VRBrowser::HandleMotionEvent(0, controller.index, jboolean(controller.focused), false, 0, 0);
      controller.widget = 0;
    }
    const bool gameSecondary = !controller.gameUiGrip && !wasUiGrip && gripDown;
    const bool wasGameSecondary = externalVR->IsPresenting() && !wasUiGrip && (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE);
` + s.slice(end);
    s = s.replace(/    const bool pressed = [\s\S]*?;/, `    const bool pressed = !controller.gameUiGrip && (gameSecondary ||
        (!runHand && (controller.buttonState & ControllerDelegate::BUTTON_TRIGGER)) ||
        (controller.buttonState & (ControllerDelegate::BUTTON_TOUCHPAD | ControllerDelegate::BUTTON_A | ControllerDelegate::BUTTON_X)));`)
      .replace(/    const bool wasPressed = [\s\S]*?;/, `    const bool wasPressed = !wasUiGrip && (wasGameSecondary ||
        (!runHand && (controller.lastButtonState & ControllerDelegate::BUTTON_TRIGGER)) ||
        (controller.lastButtonState & (ControllerDelegate::BUTTON_TOUCHPAD | ControllerDelegate::BUTTON_A | ControllerDelegate::BUTTON_X)));`);
    return s.replace(
      "VRBrowser::HandleMotionEvent(handle, controller.index, jboolean(controller.focused), jboolean(pressed), controller.pointerX, controller.pointerY);",
      "VRBrowser::HandleMotionEvent(handle, controller.index, jboolean(controller.focused), jboolean(pressed), controller.pointerX, controller.pointerY, (gameSecondary || wasGameSecondary) ? 2 : 1);");
  });
  edit("app/src/main/cpp/ExternalVR.cpp", s => s.replace(
    "(uint64_t(1) << device::kImmersiveButtonTouchpad) | (uint64_t(1) << device::kImmersiveButtonA);",
    "(uint64_t(1) << device::kImmersiveButtonTouchpad) | (uint64_t(1) << device::kImmersiveButtonA) | (uint64_t(1) << device::kImmersiveButtonSqueeze);").replace("controller.gameUiGrip ? (uint64_t(1) << device::kImmersiveButtonSqueeze) :", "controller.gameUiGrip ? 0 :"));
  edit("app/src/main/cpp/VRBrowser.h", s => s.replace(
    "void HandleMotionEvent(jint aWidgetHandle, jint aController, jboolean aFocused, jboolean aPressed, jfloat aX, jfloat aY);",
    "void HandleMotionEvent(jint aWidgetHandle, jint aController, jboolean aFocused, jboolean aPressed, jfloat aX, jfloat aY, jint aButtons = 1);"));
  edit("app/src/main/cpp/VRBrowser.cpp", s => s.replace('kHandleMotionEventSignature = "(IIZZFF)V"', 'kHandleMotionEventSignature = "(IIZZFFI)V"')
    .replace("VRBrowser::HandleMotionEvent(jint aWidgetHandle, jint aController, jboolean aFocused, jboolean aPressed, jfloat aX, jfloat aY)", "VRBrowser::HandleMotionEvent(jint aWidgetHandle, jint aController, jboolean aFocused, jboolean aPressed, jfloat aX, jfloat aY, jint aButtons)")
    .replace("sHandleMotionEvent, aWidgetHandle, aController, aFocused, aPressed, aX, aY);", "sHandleMotionEvent, aWidgetHandle, aController, aFocused, aPressed, aX, aY, aButtons);"));
  edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java", s => {
    if (s.includes("final float aY, final int aButtons)")) return s;
    const begin = s.indexOf("    void handleMotionEvent("), end = s.indexOf("\n    @Keep", begin);
    if (begin < 0 || end < 0) throw new Error("Missing Java mouse callback");
    const section = s.slice(begin, end).replace("final float aY)", "final float aY, final int aButtons)")
      .replaceAll("aPressed, x, y);", "aPressed, x, y, aButtons);")
      .replace("aPressed, x - border, y - border);", "aPressed, x - border, y - border, aButtons);");
    return s.slice(0, begin) + section + s.slice(end);
  });
  edit("app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java", s => {
    if (s.includes("int mMouseButton")) return s;
    s = replaceOnce(s, "        boolean mWasPressed;", "        boolean mWasPressed;\n        int mMouseButton = MotionEvent.BUTTON_PRIMARY;", "latched mouse button");
    s = replaceOnce(s, "? MotionEvent.BUTTON_PRIMARY : 0;", "? aDevice.mMouseButton : 0;", "mouse button state");
    s = replaceOnce(s,
      "    public static void dispatch(WidgetManagerDelegate widgetManager, Widget aWidget, int aDevice, boolean aFocused, boolean aPressed, float aX, float aY) {",
      `    public static void dispatch(WidgetManagerDelegate widgetManager, Widget aWidget, int aDevice, boolean aFocused, boolean aPressed, float aX, float aY) {
        dispatch(widgetManager, aWidget, aDevice, aFocused, aPressed, aX, aY, MotionEvent.BUTTON_PRIMARY);
    }
    public static void dispatch(WidgetManagerDelegate widgetManager, Widget aWidget, int aDevice, boolean aFocused, boolean aPressed, float aX, float aY, int aButtons) {
        // Secondary clicks are HTML mouse events, never keyboard/touch activation.
        if (aPressed && aButtons == MotionEvent.BUTTON_SECONDARY && !isGameMouseWidget(aWidget)) return;`, "secondary mouse dispatch");
    return replaceOnce(s, "        if (aPressed && !device.mWasPressed) {", `        if (aPressed && !device.mWasPressed) {
            device.mMouseButton = aButtons == MotionEvent.BUTTON_SECONDARY ? MotionEvent.BUTTON_SECONDARY : MotionEvent.BUTTON_PRIMARY;`, "latch mouse button on press");
  });
}
