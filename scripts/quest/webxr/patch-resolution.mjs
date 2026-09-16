import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchResolution(checkout) {
  const edit = (name, fn) => { const file = path.join(checkout, name); writeFileSync(file, fn(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))); };
  // Flat view is 1080p; immersive HTML is 1440p, both at DPR 1.5.
  edit("app/src/common/shared/com/igalia/wolvic/ui/widgets/WindowWidget.java", s => {
    s = s.replace(/aPlacement.width = (1600|1920|2560);/, "aPlacement.width = gameViewportWidth();")
      .replace(/aPlacement.height = (1000|1080|1440);/, "aPlacement.height = gameViewportHeight();");
    if (!s.includes("// NH3D fixed viewport texture scale")) s = replaceOnce(s,
      "        aPlacement.density = 1.5f;",
      "        aPlacement.density = 1.5f;\n        aPlacement.textureScale = 1.0f; // NH3D fixed viewport texture scale", "fixed viewport texture scale");
    const density = s.match(/    private float getBrowserDensity\(\) \{[\s\S]*?\n    \}/)?.[0];
    if (!density) throw new Error("Missing browser density method");
    s = replaceOnce(s, density, `    private float getBrowserDensity() {
        return 1.5f; // NH3D persistent UI density: 1080p flat / 1440p immersive logical viewport.
    }`, "fixed browser density");
    if (!s.includes("void setGameImmersiveViewport")) s = replaceOnce(s,
      "    private float getBrowserDensity() {", `    private boolean mGameImmersiveViewport = false;
    private int gameViewportWidth() { return mGameImmersiveViewport ? 2560 : 1920; }
    private int gameViewportHeight() { return mGameImmersiveViewport ? 1440 : 1080; }
    public void setGameImmersiveViewport(boolean immersive) {
        if (mGameImmersiveViewport == immersive) return;
        mGameImmersiveViewport = immersive;
        mWidgetPlacement.width = gameViewportWidth();
        mWidgetPlacement.height = gameViewportHeight();
        mWidgetPlacement.density = getBrowserDensity();
        mWidgetPlacement.textureScale = 1.0f;
        mViewModel.setWidth(mWidgetPlacement.width);
        mViewModel.setHeight(mWidgetPlacement.height);
        mWidgetManager.updateWidget(this);
    }

    private float getBrowserDensity() {`, "mode-dependent logical viewport");
    return s.replace(/mWidgetPlacement.width = (1920|2560);/g, "mWidgetPlacement.width = gameViewportWidth();")
      .replace(/mWidgetPlacement.height = (1080|1440);/g, "mWidgetPlacement.height = gameViewportHeight();")
      .replace("mWidgetPlacement.width = width + mBorderWidth * 2;", "mWidgetPlacement.width = gameViewportWidth(); // NH3D fixed viewport on resize")
      .replace("mWidgetPlacement.height = height + mBorderWidth * 2;", "mWidgetPlacement.height = gameViewportHeight();")
      .replace("mWidgetPlacement.width = getWindowWidth(maxSize.first);", "mWidgetPlacement.width = gameViewportWidth(); // NH3D fixed viewport at maximum world scale")
      .replace("mWidgetPlacement.height = (int) Math.ceil((float)mWidgetPlacement.width / currentAspect);", "mWidgetPlacement.height = gameViewportHeight();");
  });
  edit("app/src/common/shared/com/igalia/wolvic/browser/engine/EngineProvider.kt", s => {
    s = s.replace(/            \/\/ NH3D logical viewport[^\n]*\n/, "");
    const display = s.match(/            builder.displayDensityOverride\([^\n]+\n[\s\S]*?builder.screenSizeOverride\([\s\S]*?\n            \)/)?.[0];
    if (!display) throw new Error("Missing Gecko display overrides");
    return replaceOnce(s, display, `            // NH3D logical viewport: 2560x1440 CSS pixels at DPR 1.5.
            builder.displayDensityOverride(1.5f)
            builder.displayDpiOverride(144)
            builder.screenSizeOverride(
                3840,
                2160
            )`, "1440p Gecko display");
  });
  edit("app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java", s => s.includes("setGameImmersiveViewport(presenting)") ? s : replaceOnce(s,
    "    private void onPresentingImmersiveChange(boolean presenting) {", `    private void onPresentingImmersiveChange(boolean presenting) {
        if (BuildConfig.NH3D_GAME_HOST && mWindows != null && mWindows.getFocusedWindow() != null) {
            mWindows.getFocusedWindow().setGameImmersiveViewport(presenting);
        }`, "switch HTML resolution with immersive mode"));
  edit("app/src/openxr/cpp/DeviceDelegateOpenXR.cpp", s => {
    if (s.includes("NH3D end-to-end render resolution")) return s;
    s = replaceOnce(s, "  XrSwapchainCreateInfo GetSwapChainCreateInfo(uint32_t w = 0, uint32_t h = 0) {", `  // NH3D end-to-end render resolution. Gecko clamps requests to the host's
  // advertised factor; its side-by-side framebuffer must fit the GL limits too.
  float gameMaximumScale = 0;
  float GameMaximumRenderScale() {
    if (gameMaximumScale > 0) return gameMaximumScale;
    GLint textureLimit = 0, renderbufferLimit = 0;
    glGetIntegerv(GL_MAX_TEXTURE_SIZE, &textureLimit);
    glGetIntegerv(GL_MAX_RENDERBUFFER_SIZE, &renderbufferLimit);
    gameMaximumScale = 2.0f;
    for (const auto& view : viewConfig) {
      const uint32_t maxWidth = std::min(view.maxImageRectWidth, systemProperties.graphicsProperties.maxSwapchainImageWidth);
      const uint32_t maxHeight = std::min(view.maxImageRectHeight, systemProperties.graphicsProperties.maxSwapchainImageHeight);
      gameMaximumScale = std::min(gameMaximumScale, float(maxWidth) / view.recommendedImageRectWidth);
      gameMaximumScale = std::min(gameMaximumScale, float(maxHeight) / view.recommendedImageRectHeight);
      for (const GLint limit : {textureLimit, renderbufferLimit}) {
        if (limit > 0) {
          gameMaximumScale = std::min(gameMaximumScale, float(limit) / (2 * view.recommendedImageRectWidth));
          gameMaximumScale = std::min(gameMaximumScale, float(limit) / view.recommendedImageRectHeight);
        }
      }
    }
    VRB_LOG("NH3D resolution limit: %.3fx (GL texture %d, renderbuffer %d)", gameMaximumScale, textureLimit, renderbufferLimit);
    return gameMaximumScale;
  }

  XrSwapchainCreateInfo GetSwapChainCreateInfo(uint32_t w = 0, uint32_t h = 0) {`, "native resolution limits");
    s = replaceOnce(s,
      "    immersiveDisplay->SetEyeResolution(viewConfig.front().recommendedImageRectWidth, viewConfig.front().recommendedImageRectHeight);",
      "    immersiveDisplay->SetEyeResolution(viewConfig.front().recommendedImageRectWidth, viewConfig.front().recommendedImageRectHeight);\n    immersiveDisplay->SetNativeFramebufferScaleFactor(GameMaximumRenderScale());", "Gecko scale ceiling");
    s = replaceOnce(s,
      "      w = viewConfig.front().recommendedImageRectWidth;\n      h = viewConfig.front().recommendedImageRectHeight;",
      "      const float scale = std::min(1.5f, GameMaximumRenderScale());\n      w = uint32_t(std::ceil(viewConfig.front().recommendedImageRectWidth * scale));\n      h = uint32_t(std::ceil(viewConfig.front().recommendedImageRectHeight * scale));", "sharp default projection buffers");
    return replaceOnce(s, `DeviceDelegateOpenXR::SetImmersiveSize(const uint32_t aEyeWidth, const uint32_t aEyeHeight) {

}`, `DeviceDelegateOpenXR::SetImmersiveSize(const uint32_t aEyeWidth, const uint32_t aEyeHeight) {
  if (!aEyeWidth || !aEyeHeight || m.eyeSwapChains.empty() || m.boundSwapChain) return;
  const auto& view = m.viewConfig.front();
  const float maximum = m.GameMaximumRenderScale();
  const uint32_t width = std::min(aEyeWidth, uint32_t(std::ceil(view.recommendedImageRectWidth * maximum)));
  const uint32_t height = std::min(aEyeHeight, uint32_t(std::ceil(view.recommendedImageRectHeight * maximum)));
  if (m.eyeSwapChains.front()->Width() == int32_t(width) && m.eyeSwapChains.front()->Height() == int32_t(height)) return;
  vrb::RenderContextPtr render = m.context.lock();
  for (auto& chain : m.eyeSwapChains) chain->InitFBO(render, m.session, m.GetSwapChainCreateInfo(width, height), m.GetFBOAttributes());
  VRB_LOG("NH3D resolution: WebXR eye %ux%u -> OpenXR eye %ux%u", aEyeWidth, aEyeHeight, width, height);
}`, "match output to WebXR framebuffer");
  });
  edit("app/src/main/cpp/BrowserWorld.cpp", s => s.includes("NH3D HTML surface:") ? s : replaceOnce(s,
    "    VRBrowser::DispatchCreateWidget(widget->GetHandle(), aSurface, width, height);",
    "    VRB_LOG(\"NH3D HTML surface: %dx%d\", width, height);\n    VRBrowser::DispatchCreateWidget(widget->GetHandle(), aSurface, width, height);", "HTML size diagnostics"));
}
