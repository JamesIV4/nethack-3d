import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
export function patchPaneIsolation(checkout) {
 const edit=(p,fn)=>{const f=path.join(checkout,p);writeFileSync(f,fn(readFileSync(f,"utf8").replaceAll("\r\n","\n")));};
 edit("app/src/main/cpp/Controller.h",s=>s.includes("gameActionHover")?s:s.replace("  bool gameUiGrip", "  bool gameActionHover = false;\n  bool gameUiGrip"));
 edit("app/src/main/cpp/Controller.cpp",s=>s.includes("gameActionHover = aController")?s:s.replace("  gameUiGrip = aController.gameUiGrip;", "  gameUiGrip = aController.gameUiGrip;\n  gameActionHover = aController.gameActionHover;"));
 edit("app/src/main/cpp/BrowserWorld.cpp",s=>{
  if(!s.includes("controller.gameActionHover =")) s=s.replace("    bool gameWorldHit = false;", "    controller.gameActionHover = hitWidget && gamePanels && gamePanels->Owns(hitWidget) && gamePanels->IsAction(controller.index);\n    bool gameWorldHit = false;");
  if(!s.includes("// NH3D foreground modal pass"))s=s.replace("  for (const auto& window : hiddenWindows) window->ToggleWidget(true);", `  // NH3D foreground modal pass: table status cannot draw through dialogs.
  VRB_GL_CHECK(glDepthMask(GL_TRUE));
  VRB_GL_CHECK(glClear(GL_DEPTH_BUFFER_BIT));
  VRB_GL_CHECK(glDepthMask(GL_FALSE));
  m.drawList->Reset();
  if (m.gamePanels) m.gamePanels->Cull(*m.cullVisitor, *m.drawList, true);
  m.drawList->Draw(*camera);
  for (const auto& window : hiddenWindows) window->ToggleWidget(true);`);
  return s;
 });
 edit("app/src/main/cpp/ExternalVR.cpp",s=>s.replace("controller.widget && !(controller.leftHanded", "controller.widget && !controller.gameActionHover && !(controller.leftHanded"));
 edit("app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java",s=>{
  if(!s.includes("gameImmersive"))s=s.replace("public class MotionEventGenerator {", "public class MotionEventGenerator {\n    public static volatile boolean gameImmersive = false;");
  return s.replace("final boolean mouse = isGameMouseWidget(aWidget);", "final boolean mouse = isGameMouseWidget(aWidget) && (gameImmersive || aAction == MotionEvent.ACTION_HOVER_ENTER || aAction == MotionEvent.ACTION_HOVER_MOVE || aAction == MotionEvent.ACTION_HOVER_EXIT);");
 });
 edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java",s=>s.includes("MotionEventGenerator.gameImmersive")?s:s.replace("private void onPresentingImmersiveChange(boolean presenting) {", "private void onPresentingImmersiveChange(boolean presenting) {\n        com.igalia.wolvic.input.MotionEventGenerator.gameImmersive = presenting;"));
}
