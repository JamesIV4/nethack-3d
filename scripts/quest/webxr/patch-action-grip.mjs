import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";
export function patchActionGrip(checkout) {
  const edit = (name, fn) => { const file=path.join(checkout,name);writeFileSync(file,fn(readFileSync(file,"utf8").replaceAll("\r\n","\n"))); };
  edit("app/src/main/cpp/Controller.h", s => s.includes("bool gameUiGrip") ? s : replaceOnce(s,
    "  bool gameWorldCaptured = false;", "  bool gameWorldCaptured = false;\n  bool gameUiGrip = false;", "UI grip state"));
  edit("app/src/main/cpp/Controller.cpp", s => s.includes("gameUiGrip") ? s : s
    .replace("  gameWorldCaptured = aController.gameWorldCaptured;", "  gameWorldCaptured = aController.gameWorldCaptured;\n  gameUiGrip = aController.gameUiGrip;")
    .replace("  gameWorldCaptured = false;", "  gameWorldCaptured = false;\n  gameUiGrip = false;"));
  edit("app/src/main/cpp/BrowserWorld.cpp", s => {
    if(s.includes("NH3D movable action row")) return s;
    s=replaceOnce(s,"    const bool runHand = externalVR->IsPresenting() && controller.leftHanded;",`    // NH3D movable action row: either squeeze/grip owns a drag; it is not a click.
    const bool wasUiGrip = controller.gameUiGrip;
    const bool grabbing = externalVR->IsPresenting() && controller.hasAim && gamePanels && gamePanels->Grip(
        controller.index, controller.buttonState & ControllerDelegate::BUTTON_SQUEEZE,
        (controller.lastButtonState & ControllerDelegate::BUTTON_SQUEEZE) ||
            (controller.buttonState & (ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A | ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD)),
        controller.transformMatrix.GetTranslation(), controller.StartPoint(), controller.Direction());
    if ((!externalVR->IsPresenting() || !controller.hasAim) && gamePanels) gamePanels->EndGrip(controller.index);
    const auto clickButtons = ControllerDelegate::BUTTON_TRIGGER | ControllerDelegate::BUTTON_A |
        ControllerDelegate::BUTTON_X | ControllerDelegate::BUTTON_TOUCHPAD;
    controller.gameUiGrip = grabbing || (wasUiGrip && (controller.buttonState & clickButtons));
    if (grabbing && !wasUiGrip && controller.widget) {
      VRBrowser::HandleMotionEvent(0, controller.index, jboolean(controller.focused), false, 0, 0);
      controller.widget = 0;
    }
    const bool runHand = externalVR->IsPresenting() && controller.leftHanded;`,"grip ownership");
    s=s.replace("    const bool pressed = (!runHand", "    const bool pressed = !controller.gameUiGrip && ((!runHand")
      .replace("                         controller.buttonState & ControllerDelegate::BUTTON_X;", "                         controller.buttonState & ControllerDelegate::BUTTON_X);")
      .replace("    const bool wasPressed = (!runHand", "    const bool wasPressed = !wasUiGrip && ((!runHand")
      .replace("                            controller.lastButtonState & ControllerDelegate::BUTTON_X;;", "                            controller.lastButtonState & ControllerDelegate::BUTTON_X);");
    const start=s.indexOf("void\nBrowserWorld::State::UpdateControllers");
    const end=s.indexOf("\n}\n",start)+3;
    const before=s.slice(0,start), body=s.slice(start,end);
    return before + replaceOnce(body,"    if (!controller.enabled || (controller.index < 0)) {",`    if (!controller.enabled || (controller.index < 0)) {
      controller.gameUiGrip = false;
      if (gamePanels) gamePanels->EndGrip(controller.index);`,"release lost controller grip") + s.slice(end);
  });
  edit("app/src/main/cpp/ExternalVR.cpp", s => {
    return s.replace("immersiveController.buttonPressed = controller.widget ?", "immersiveController.buttonPressed = controller.gameUiGrip ? 0 : controller.widget ?")
      .replace("immersiveController.buttonTouched = controller.widget ?", "immersiveController.buttonTouched = controller.gameUiGrip ? 0 : controller.widget ?")
      .replace("immersiveController.triggerValue[j] = controller.widget &&", "immersiveController.triggerValue[j] = controller.gameUiGrip ? 0.0f : controller.widget &&")
      .replace("immersiveController.axisValue[j] = controller.widget &&", "immersiveController.axisValue[j] = controller.gameUiGrip ? 0.0f : controller.widget &&");
  });
}
