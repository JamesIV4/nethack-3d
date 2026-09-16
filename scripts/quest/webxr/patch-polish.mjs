import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";
export function patchPolish(checkout) {
  const edit = (name, fn) => { const p = path.join(checkout, name); writeFileSync(p, fn(readFileSync(p,"utf8").replaceAll("\r\n","\n"))); };
  const assets = path.join(checkout, "app/src/main/assets");
  mkdirSync(assets, { recursive: true });
  copyFileSync(new URL("../../../public/NetHack3D-splash.png", import.meta.url), path.join(assets, "NetHack3D-splash.png"));
  edit("app/src/main/cpp/SplashAnimation.cpp", s => s.includes('LoadTexture("NetHack3D-splash.png")') ? s : replaceOnce(
    s, 'LoadTexture("logo.png")', 'LoadTexture("NetHack3D-splash.png")', "NetHack splash texture"));
  // Also restore the splash in checkouts already patched for direct startup.
  edit("app/src/main/cpp/BrowserWorld.cpp", s => s.replace(
    "    splashAnimation = nullptr; // NH3D direct game startup.",
    "    splashAnimation = SplashAnimation::Create(create);"));
  const values = path.join(checkout, "app/src/main/res/values"); mkdirSync(values, { recursive: true });
  writeFileSync(path.join(values, "nh3d-startup.xml"), `<resources>
    <style name="Nh3d.Game" parent="FxR.Dark">
      <item name="android:windowBackground">@android:color/black</item>
      <item name="android:windowDisablePreview">true</item>
      <item name="android:windowSplashScreenBackground">@android:color/black</item>
      <item name="android:windowSplashScreenAnimatedIcon">@android:color/transparent</item>
      <item name="android:windowSplashScreenBrandingImage">@android:color/transparent</item>
    </style>
  </resources>`);
  edit("app/src/main/AndroidManifest.xml", s => s.replace('android:theme="@style/FxR.Dark"', 'android:theme="@style/Nh3d.Game"'));
  edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java", s => {
    if (s.includes("NH3D startup without browser dialogs")) return s;
    for (const name of ["showTermsServiceDialogIfNeeded", "showPrivacyDialogIfNeeded"])
      s = replaceOnce(s, `    private boolean ${name}() {`, `    private boolean ${name}() {\n        // NH3D startup without browser dialogs; do not record consent.\n        if (BuildConfig.NH3D_GAME_HOST) return false;`, name);
    return s;
  });
  edit("app/src/common/shared/com/igalia/wolvic/ui/widgets/Windows.java", s => s.includes("NH3D large flat window") ? s : replaceOnce(s,
    "        mFocusedWindow.setSession(session, WindowWidget.DEACTIVATE_CURRENT_SESSION);\n        mFocusedWindow.setKioskMode(true);",
    "        mFocusedWindow.setSession(session, WindowWidget.DEACTIVATE_CURRENT_SESSION);\n        mFocusedWindow.setKioskMode(true);\n        // NH3D large flat window uses Wolvic's own 2x size preset.\n        mFocusedWindow.resizeByMultiplier((float)mFocusedWindow.getWindowWidth() / mFocusedWindow.getWindowHeight(), 2.0f);", "large flat window"));
  edit("app/src/common/shared/com/igalia/wolvic/ui/widgets/WindowWidget.java", s => s.replace("aPlacement.density = 1.0f;", "aPlacement.density = 1.5f;"));
  edit("app/src/main/cpp/VRBrowser.cpp", s => s.replace("length >= 18 && length <= 555", "length >= 24 && length <= 571"));
  edit("app/src/main/cpp/BrowserWorld.cpp", s => {
    if (s.includes("NH3D polished table presentation")) return s;
    const start = s.indexOf("BrowserWorld::UpdateEnvironment() {");
    const end = s.indexOf("\n}\n", start);
    if (start < 0 || end < 0) throw new Error("Missing environment loader");
    s = s.slice(0,start) + "BrowserWorld::UpdateEnvironment() {\n  ASSERT_ON_RENDER_THREAD();\n  CreateSkyBox(\"\", \"\"); // Bundled game uses a black void.\n" + s.slice(end);
    s = s.replaceAll("gamePointerState.size() < 18", "gamePointerState.size() < 24")
      .replaceAll("size_t i = 18", "size_t i = 24").replaceAll("18 + size_t(gamePointerState[1])", "24 + size_t(gamePointerState[1])");
    s = replaceOnce(s, "    gamePanels->Update(gameWindow, gamePointerState, board, center);", `    auto popup = center;
    if (gamePointerState[20] == 1) {
      const auto point = externalVR->GetGameLocalFromFloor().MultiplyPosition(vrb::Vector(gamePointerState[21], gamePointerState[22], gamePointerState[23]));
      popup = vrb::Matrix::Translation(point).PostMultiply(vrb::Matrix::Rotation(vrb::Vector(0,1,0), gamePointerState[17]));
    }
    gamePanels->Update(gameWindow, gamePointerState, board, popup, device->GetHeadTransform().GetTranslation());`, "tile popup and status pitch");
    s = s.replace("3.0f/width, 3.0f/width, 3.0f/width", "3.0f*gamePointerState[19]/width, 3.0f*gamePointerState[19]/width, 3.0f*gamePointerState[19]/width");
    s = replaceOnce(s, "  TransformPtr rootTransparent;", "  // NH3D polished table presentation: reticles draw after every HTML pane.\n  TransformPtr rootPointer;\n  TransformPtr rootTransparent;\n  void DrawGamePointers(const vrb::Camera& camera);", "reticle root");
    s = s.replace("    rootTransparent = Transform::Create(create);", "    rootTransparent = Transform::Create(create);\n    rootPointer = Transform::Create(create);")
      .replace("controllers = ControllerContainer::Create(create, rootTransparent, loader);", "controllers = ControllerContainer::Create(create, rootPointer, loader);");
    for (const name of ["DrawWorld", "DrawImmersive"]) {
      const begin = s.indexOf(`BrowserWorld::${name}(device::Eye aEye)`);
      const finish = s.indexOf("\n}\n", begin);
      if (begin < 0 || finish < 0) throw new Error("Missing draw function");
      s = s.slice(0,finish) + "\n  m.DrawGamePointers(*camera);" + s.slice(finish);
    }
    return s + `
void crow::BrowserWorld::State::DrawGamePointers(const vrb::Camera& camera) {
  rootPointer->SetTransform(rootTransparent->GetTransform());
  VRB_GL_CHECK(glDisable(GL_DEPTH_TEST));
  VRB_GL_CHECK(glDepthMask(GL_FALSE));
  drawList->Reset(); rootPointer->Cull(*cullVisitor, *drawList); drawList->Draw(camera);
  VRB_GL_CHECK(glDepthMask(GL_TRUE));
  VRB_GL_CHECK(glEnable(GL_DEPTH_TEST));
}
`;
  });
}
