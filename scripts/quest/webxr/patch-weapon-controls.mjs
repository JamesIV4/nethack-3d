import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
export function patchWeaponControls(checkout){
 const edit=(name,fn)=>{const p=path.join(checkout,name);writeFileSync(p,fn(readFileSync(p,"utf8").replaceAll("\r\n","\n")));};
 edit("app/src/main/cpp/BrowserWorld.cpp",s=>{
  const foreground=`  // NH3D controllers in front of UI, with the UI still over the world.
  VRB_GL_CHECK(glClear(GL_DEPTH_BUFFER_BIT));
  m.drawList->Reset(); m.rootController->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);
`;
  s=s.replaceAll(foreground,"");
  s=s.replace("  m.drawList->Reset(); m.rootController->Cull(*m.cullVisitor, *m.drawList); m.drawList->Draw(*camera);", "  // Controller models are drawn after the HTML panes.");
  s=s.replace("  // Draw controllers\n  m.drawList->Reset();\n  m.rootController->Cull(*m.cullVisitor, *m.drawList);\n  m.drawList->Draw(*camera);", "  // Controller models are drawn after the HTML panes.");
  return s.replaceAll("  m.DrawGamePointers(*camera);", foreground+"  m.DrawGamePointers(*camera);");
 });
 edit("app/src/main/cpp/ExternalVR.cpp",s=>s.replace(/immersiveController.buttonPressed = controller.gameUiGrip \? (?:0|controller.immersivePressedState & \(uint64_t\(1\) << device::kImmersiveButtonSqueeze\)) :/, "immersiveController.buttonPressed = controller.gameUiGrip ? (uint64_t(1) << device::kImmersiveButtonSqueeze) :"));
}
