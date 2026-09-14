import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";
export function patchUiFollow(checkout) {
  const edit = (name, fn) => { const file = path.join(checkout,name); writeFileSync(file, fn(readFileSync(file,"utf8").replaceAll("\r\n","\n"))); };
  edit("app/src/main/cpp/VRBrowser.cpp", s => s.replace("length >= 24 && length <= 571", "length >= 29 && length <= 576"));
  edit("app/src/main/cpp/BrowserWorld.cpp", s => {
    if (!s.includes("m.gameFpsUiActive = false;")) s = replaceOnce(s, "    m.gameUiAnchored = false;", "    m.gameUiAnchored = false;\n    m.gameFpsUiActive = false;", "reset UI follow on XR exit");
    if (s.includes("NH3D horizontal UI follow")) return s;
    s = replaceOnce(s, "  WidgetPtr gameWindow;", `  WidgetPtr gameWindow;
  // NH3D horizontal UI follow: interpolate the game-owned pose between packets.
  vrb::Vector gameFpsUiPosition;
  float gameFpsUiYaw = 0, gameFpsUiRevision = -1;
  double gameFpsUiTime = 0;
  bool gameFpsUiActive = false;`, "first-person UI interpolation state");
    s = s.replaceAll("gamePointerState.size() < 24", "gamePointerState.size() < 29")
      .replaceAll("size_t i = 24", "size_t i = 29").replaceAll("24 + size_t(gamePointerState[1])", "29 + size_t(gamePointerState[1])");
    const old = "    const auto center = gameAnchor.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, gamePointerState[12] + 0.55f, -0.95f)));";
    s = replaceOnce(s, old, `    auto center = gameAnchor.PostMultiply(vrb::Matrix::Translation(vrb::Vector(0, gamePointerState[12] + 0.55f, -0.95f)));
    const double now = context->GetTimestamp();
    if (gamePointerState[10] == 1) {
      const vrb::Vector target(gamePointerState[24], gamePointerState[25], gamePointerState[26]);
      const float yaw = gamePointerState[27], revision = gamePointerState[28];
      if (!gameFpsUiActive || revision != gameFpsUiRevision) {
        gameFpsUiPosition = target; gameFpsUiYaw = yaw;
      } else {
        const float alpha = 1.0f - std::exp(-float(std::min(0.1, std::max(0.0, now - gameFpsUiTime))) / 0.025f);
        gameFpsUiPosition = gameFpsUiPosition + (target - gameFpsUiPosition) * alpha;
        gameFpsUiYaw += std::atan2(std::sin(yaw - gameFpsUiYaw), std::cos(yaw - gameFpsUiYaw)) * alpha;
      }
      gameFpsUiActive = true; gameFpsUiRevision = revision;
      center = externalVR->GetGameLocalFromFloor().PostMultiply(vrb::Matrix::Translation(gameFpsUiPosition))
          .PostMultiply(vrb::Matrix::Rotation(vrb::Vector(0,1,0), gameFpsUiYaw))
          .PostMultiply(vrb::Matrix::Translation(vrb::Vector(0,gamePointerState[12] + 0.55f,-0.95f)));
    } else gameFpsUiActive = false;
    gameFpsUiTime = now;`, "first-person frame pose");
    return replaceOnce(s,
      "gamePanels->Update(gameWindow, gamePointerState, board, popup, device->GetHeadTransform().GetTranslation());",
      "gamePanels->Update(gameWindow, gamePointerState, board, popup, device->GetHeadTransform().GetTranslation(), center);", "separate HUD and modal poses");
  });
}
