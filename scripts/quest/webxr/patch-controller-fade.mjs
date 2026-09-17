import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {replaceOnce} from './runtime-patch.mjs';
export function patchControllerFade(checkout) {
 const edit=(file,marker,apply)=>{const p=path.join(checkout,file),s=readFileSync(p,'utf8').replaceAll('\r\n','\n');if(!s.includes(marker))writeFileSync(p,apply(s));};
 edit('app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java','getGameControllerOpacity',s=>{
  s=replaceOnce(s,'    void onEnterWebXR() {','    void onEnterWebXR() {\n        BundledGameServer.resetControllerOpacity();','controller fade session reset');
  return replaceOnce(s,'    final Object mCompositorLock = new Object();','    @Keep\n    public int getGameControllerOpacity() { return BundledGameServer.getControllerOpacity(); }\n    final Object mCompositorLock = new Object();','controller fade JNI getter');
 });
 edit('app/src/main/cpp/VRBrowser.h','GetGameControllerOpacity',s=>replaceOnce(s,'JNIEnv * Env();','JNIEnv * Env();\nint GetGameControllerOpacity();','controller opacity declaration'));
 edit('app/src/main/cpp/VRBrowser.cpp','GetGameControllerOpacity',s=>{
  s=replaceOnce(s,'jmethodID sGetPointerColor = nullptr;','jmethodID sGetPointerColor = nullptr;\njmethodID sGetGameControllerOpacity = nullptr;','controller opacity binding');
  s=replaceOnce(s,'  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);','  sGetGameControllerOpacity = FindJNIMethodID(sEnv, sBrowserClass, "getGameControllerOpacity", "()I");\n  sGetPointerColor = FindJNIMethodID(sEnv, sBrowserClass, kGetPointerColor, kGetPointerColorSignature);','controller opacity lookup');
  return s+'\nint crow::VRBrowser::GetGameControllerOpacity() {\n  return sEnv && sActivity && sGetGameControllerOpacity ? sEnv->CallIntMethod(sActivity, sGetGameControllerOpacity) : 0;\n}\n';
 });
 // Each hand needs its own material. Sharing the beam render state would let
 // whichever controller updates last determine the opacity of both lasers.
 edit('app/src/main/cpp/ControllerContainer.cpp','CreateGameBeam',s=>{
  s=replaceOnce(s,'  void updatePointerColor(Controller& aController) {',`  GeometryPtr CreateGameBeam() {
    auto create = context.lock();
    auto geometry = Geometry::Create(create);
    geometry->SetVertexArray(beamModel->GetVertexArray());
    for (int i = 0; i < beamModel->GetFaceCount(); ++i) {
      const auto& face = beamModel->GetFace(i);
      geometry->AddFace(std::vector<int>(face.vertices.begin(), face.vertices.end()),
        std::vector<int>(face.uvs.begin(), face.uvs.end()), std::vector<int>(face.normals.begin(), face.normals.end()));
    }
    auto state = RenderState::Create(create);
    auto program = create->GetProgramFactory()->CreateProgram(create, 0);
    state->SetProgram(program); state->SetLightsEnabled(false);
    state->SetMaterial(pointerColor, pointerColor, Color(0, 0, 0), 0);
    geometry->SetRenderState(state);
    return geometry;
  }
  void updatePointerColor(Controller& aController) {`,'per-controller laser material');
  return s.replaceAll('controller.beamParent->AddNode(m.beamModel);','controller.beamParent->AddNode(m.CreateGameBeam());');
 });
 edit('app/src/main/cpp/BrowserWorld.cpp','NH3D controller-ready fade',s=>{
  s=replaceOnce(s,'BrowserWorld::State::UpdateControllers(bool& aRelayoutWidgets) {','BrowserWorld::State::UpdateControllers(bool& aRelayoutWidgets) {\n  const int controllerOpacity = externalVR->IsPresenting() ? VRBrowser::GetGameControllerOpacity() : 65535;','read controller opacity once');
  const anchor='    if (controller.pointer) {\n      const bool isMovingWindow';
  s=replaceOnce(s,anchor,`    // NH3D controller-ready fade: visuals only; input and hand tracking stay live.
    const float modelAlpha = externalVR->IsPresenting() && controller.mode == ControllerMode::Device
      ? ((controllerOpacity >> (controller.leftHanded ? 0 : 8)) & 255) / 255.0f : 1.0f;
    if (controller.beamParent && controller.beamParent->GetNodeCount() > 0) {
      auto beam = std::dynamic_pointer_cast<vrb::Geometry>(controller.beamParent->GetNode(0));
      if (beam) beam->GetRenderState()->SetTintColor(vrb::Color(1, 1, 1, modelAlpha));
    }
    if (controller.pointer) {
      const bool isMovingWindow`,'controller-ready fade');
  s=s.replace('controller.pointer->SetVisible(!isMovingWindow &&','controller.pointer->SetVisible(modelAlpha > 0 && !isMovingWindow &&');
  s=s.replace(`        if (controller.selectFactor >= device->GetSelectThreshold(controller.index))
          controller.pointer->SetPointerColor(kPointerColorSelected);
        else
          controller.pointer->SetPointerColor(VRBrowser::GetPointerColor());`,`        const vrb::Color color = controller.selectFactor >= device->GetSelectThreshold(controller.index)
          ? vrb::Color(kPointerColorSelected) : vrb::Color(VRBrowser::GetPointerColor());
        controller.pointer->SetPointerColor(vrb::Color(color.Red(), color.Green(), color.Blue(), color.Alpha() * modelAlpha));`);
  return s.replace('controller.beamToggle->ToggleAll(controller.hasAim);','controller.beamToggle->ToggleAll(controller.hasAim && modelAlpha > 0);');
 });
}
