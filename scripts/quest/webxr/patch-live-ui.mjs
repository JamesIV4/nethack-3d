import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchLiveUi(checkout) {
  const edit = (name, fn) => {
    const file = path.join(checkout, name);
    writeFileSync(file, fn(readFileSync(file, "utf8").replaceAll("\r\n", "\n")));
  };
  edit("app/src/main/cpp/VRBrowser.cpp", s => s.replace("length >= 14 && length <= 551", "length >= 18 && length <= 555"));
  edit("app/src/main/cpp/ExternalVR.h", s => s.includes("GetGameFrameEyeTransform") ? s : replaceOnce(s,
    "  bool WaitFrameResult();", "  bool WaitFrameResult();\n  bool GetGameFrameEyeTransform(device::Eye eye, vrb::Matrix& transform) const;\n  vrb::Matrix GetGameLocalFromFloor() const;", "UI frame pose API"));
  edit("app/src/main/cpp/ExternalVR.cpp", s => {
    if (s.includes("ExternalVR::GetGameFrameEyeTransform")) return s;
    s = replaceOnce(s, "  uint64_t lastFrameId = 0;", `  // Bounded history keyed by the input pose used for the completed WebXR image.
  struct GameFramePose { uint64_t id = 0; vrb::Matrix eyes[2]; };
  std::array<GameFramePose, 32> gameFramePoses;
  uint64_t lastFrameId = 0;`, "UI frame pose history");
    s = replaceOnce(s, "  m.system.sensorState.inputFrameID++;", `  m.system.sensorState.inputFrameID++;
  auto& gamePose = m.gameFramePoses[m.system.sensorState.inputFrameID % m.gameFramePoses.size()];
  gamePose.id = m.system.sensorState.inputFrameID;
  for (int eye = 0; eye < 2; ++eye) gamePose.eyes[eye] = aHeadTransform.PostMultiply(m.eyeTransforms[eye]);`, "record submitted input poses");
    return s + `
bool crow::ExternalVR::GetGameFrameEyeTransform(device::Eye eye, vrb::Matrix& transform) const {
  const auto id = m.browser.layerState[0].layer_stereo_immersive.inputFrameId;
  const auto& pose = m.gameFramePoses[id % m.gameFramePoses.size()];
  if (!id || pose.id != id) return false;
  transform = pose.eyes[device::EyeIndex(eye)];
  return true;
}
vrb::Matrix crow::ExternalVR::GetGameLocalFromFloor() const {
  return vrb::Matrix::Translation(vrb::Vector(0, -m.system.displayState.sittingToStandingTransform[13], 0));
}
`;
  });
  edit("app/src/main/cpp/BrowserWorld.cpp", s => {
    if (s.includes("NH3D live UI frame alignment")) return s;
    s = '#include "vrb/CameraEye.h"\n' + s;
    s = replaceOnce(s, "  WidgetPtr gameWindow;", "  WidgetPtr gameWindow;\n  vrb::CameraEyePtr gameUiCameras[2];", "UI cameras");
    s = s.replaceAll("gamePointerState.size() < 14", "gamePointerState.size() < 18")
      .replaceAll("gamePointerState.size() >= 14", "gamePointerState.size() >= 18")
      .replaceAll("size_t i = 14", "size_t i = 18").replaceAll("14 + size_t(gamePointerState[1])", "18 + size_t(gamePointerState[1])");
    const begin = s.indexOf("  const float revision = gamePointerState.empty()", s.indexOf("void BrowserWorld::State::UpdateGameControls()"));
    const end = s.indexOf("  rootTransparent->SetTransform(gameUiTransform);", begin);
    if (begin < 0 || end < 0) throw new Error("Missing table UI anchor implementation");
    s = s.slice(0, begin) + `  // NH3D live UI frame alignment: use the game's fixed local-floor anchor.
  // Never derive a pane transform from the current native headset pose.
  if (gamePointerState.size() < 18) return;
  const float revision = gamePointerState[0];
  if (!gameUiAnchored || revision != gameAnchorRevision) {
    for (const auto& widget : widgets) {
      if (widget->GetPlacement()->name == "Window" && widget->IsVisible()) {
        gameWindow = widget; gameUiAnchored = true; gameAnchorRevision = revision; break;
      }
    }
  }
  if (gameWindow) {
    const auto floorAnchor = vrb::Matrix::Translation(vrb::Vector(gamePointerState[14], gamePointerState[15], gamePointerState[16]))
        .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(0,1,0), gamePointerState[17]));
    gameAnchor = externalVR->GetGameLocalFromFloor().PostMultiply(floorAnchor);
    const auto board = gameAnchor.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, gamePointerState[12], -1.55f)))
        .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(1,0,0), gamePointerState[11]));
    const auto center = gameAnchor.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, gamePointerState[12] + 0.55f, -0.95f)));
    if (!gamePanels) gamePanels = std::make_unique<GameUiPanels>(create);
    gamePanels->Update(gameWindow, gamePointerState, board, center);
    float width, height; gameWindow->GetWorldSize(width, height);
    gameUiTransform = center.PostMultiply(vrb::Matrix::Identity().Scale(vrb::Vector(3.0f/width, 3.0f/width, 3.0f/width)))
        .PostMultiply(gameWindow->GetTransform().AfineInverse());
  }
` + s.slice(end);
    const draw = s.indexOf("BrowserWorld::DrawImmersive(device::Eye aEye)");
    const old = "  const CameraPtr camera = aEye == device::Eye::Left ? m.leftCamera : m.rightCamera;";
    const drawEnd = s.indexOf("\n}\n", draw) + 3;
    const body = s.slice(draw, drawEnd);
    s = s.slice(0, draw) + replaceOnce(body, old, `  const CameraPtr liveCamera = aEye == device::Eye::Left ? m.leftCamera : m.rightCamera;
  vrb::Matrix frameEye;
  if (!m.externalVR->GetGameFrameEyeTransform(aEye, frameEye)) return;
  auto& camera = m.gameUiCameras[device::EyeIndex(aEye)];
  if (!camera) camera = vrb::CameraEye::Create(m.create);
  camera->SetPerspective(liveCamera->GetPerspective());
  camera->SetHeadTransform(frameEye);
  camera->SetEyeTransform(vrb::Matrix::Identity());`, "composite UI with rendered frame pose") + s.slice(drawEnd);
    return s;
  });
}
