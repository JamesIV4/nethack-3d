import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";
export function patchPointerInput(checkout) {
  const edit=(name,fn)=>{const file=path.join(checkout,name);writeFileSync(file,fn(readFileSync(file,"utf8").replaceAll("\r\n","\n")));};
  edit("app/src/main/cpp/VRBrowser.cpp",s=>s.replace("length >= 29 && length <= 576","length >= 29 && length <= 581"));
  edit("app/src/main/cpp/Pointer.cpp",s=>s.replace("kInnerRadius = 0.005f", "kInnerRadius = 0.0025f").replace("kOuterRadius = 0.0066f", "kOuterRadius = 0.0033f"));
  edit("app/src/main/cpp/BrowserWorld.cpp",s=>{
    if(s.includes("NH3D only the composited game window")) return s;
    s=replaceOnce(s,"    WidgetPtr previousWidget = controller.widget ? GetWidget(controller.widget) : nullptr;",`    WidgetPtr previousWidget = controller.widget ? GetWidget(controller.widget) : nullptr;
    // NH3D only the composited game window supplies browser hit regions in XR.
    if (externalVR->IsPresenting() && previousWidget && previousWidget->GetPlacement()->name == "Window" &&
        (!gamePanels || !gamePanels->Owns(previousWidget))) previousWidget = nullptr;`,"discard old window capture");
    s=replaceOnce(s,"      for (const WidgetPtr& widget: widgets) {\n        if (controller.focused)",`      for (const WidgetPtr& widget: widgets) {
        if (externalVR->IsPresenting() && widget->GetPlacement()->name == "Window" &&
            (!gamePanels || !gamePanels->Owns(widget))) continue;
        if (controller.focused)`,"skip legacy window hit planes");
    s=replaceOnce(s,`  const auto source = m.gamePanels ? m.gamePanels->Source() : nullptr;
  if (source) source->ToggleWidget(false);`, `  std::vector<WidgetPtr> hiddenWindows;
  for (const auto& window : m.widgets) if (window->GetPlacement()->name == "Window" && window->IsVisible()) {
    hiddenWindows.push_back(window); window->ToggleWidget(false);
  }`,"hide legacy flat browser quads");
    return replaceOnce(s,"  if (source) source->ToggleWidget(true);","  for (const auto& window : hiddenWindows) window->ToggleWidget(true);","restore browser visibility after XR draw");
  });
  edit("app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java",s=>{
    if(s.includes("isGameMouseWidget")) return s;
    s=s.replace("import android.os.SystemClock;", "import android.os.SystemClock;\nimport com.igalia.wolvic.BuildConfig;\nimport com.igalia.wolvic.ui.widgets.WindowWidget;");
    s=s.replace("public class MotionEventGenerator {",`public class MotionEventGenerator {
    private static boolean isGameMouseWidget(Widget widget) {
        return BuildConfig.NH3D_GAME_HOST && widget instanceof WindowWidget && !((WindowWidget)widget).isNativeContentVisible();
    }`);
    s=replaceOnce(s,"        MotionEvent event = MotionEvent.obtain(",`        if (aWidget == null) return;
        final boolean mouse = isGameMouseWidget(aWidget);
        aDevice.mProperties[0].toolType = mouse ? MotionEvent.TOOL_TYPE_MOUSE : MotionEvent.TOOL_TYPE_FINGER;
        final int buttons = mouse && (aAction == MotionEvent.ACTION_DOWN || (aAction == MotionEvent.ACTION_MOVE && aDevice.mWasPressed)) ? MotionEvent.BUTTON_PRIMARY : 0;
        MotionEvent event = MotionEvent.obtain(`,"consistent mouse event type");
    s=s.replace("/*buttonState*/ 0,", "/*buttonState*/ buttons,").replace("/*source*/ InputDevice.SOURCE_TOUCHSCREEN,", "/*source*/ mouse ? InputDevice.SOURCE_MOUSE : InputDevice.SOURCE_TOUCHSCREEN,");
    s=s.replace("                generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_HOVER_EXIT, true);\n                generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_DOWN, false);\n                device.mHoverStartWidget = null;",`                if (!isGameMouseWidget(aWidget)) generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_HOVER_EXIT, true);
                else if (device.mHoverStartWidget != aWidget) generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_HOVER_ENTER, true);
                if (isGameMouseWidget(aWidget)) generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_HOVER_MOVE, true);
                generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_DOWN, false);
                device.mHoverStartWidget = isGameMouseWidget(aWidget) ? aWidget : null;`);
    s=s.replace("            for (int i=0; i<devices.size(); i++) {", "            if (!isGameMouseWidget(aWidget)) for (int i=0; i<devices.size(); i++) {");
    return s.replace("                generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_UP, false);", "                generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_UP, false);")
      .replace("                generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_HOVER_ENTER, true);\n                widgetManager.triggerHapticFeedback", "                if (!isGameMouseWidget(aWidget)) generateEvent(aWidget, device, aFocused, MotionEvent.ACTION_HOVER_ENTER, true);\n                widgetManager.triggerHapticFeedback");
  });
  edit("app/src/common/shared/com/igalia/wolvic/ui/widgets/WindowWidget.java",s=>{
    s = s.replace("        if (!mActive) {\n            // Do not send touch events to not focused windows.", "        if (!mActive && !(com.igalia.wolvic.BuildConfig.NH3D_GAME_HOST && mView == null && aEvent.getToolType(0) == MotionEvent.TOOL_TYPE_MOUSE)) {\n            // Do not send touch events to not focused windows.");
    return s.includes("NH3D focus before mouse press")?s:replaceOnce(s,
    "    public void handleHoverEvent(MotionEvent aEvent) {",`    public void handleHoverEvent(MotionEvent aEvent) {
        // NH3D focus before mouse press, rather than spending the first click on focus.
        if (com.igalia.wolvic.BuildConfig.NH3D_GAME_HOST && mView == null && aEvent.getAction() == MotionEvent.ACTION_HOVER_ENTER) {
            if (!mActive) focusWindow();
            requestFocus();
            WSession session = mSession.getWSession();
            if (session != null) session.setFocused(true);
        }`,"focus game on hover");
  });
}
