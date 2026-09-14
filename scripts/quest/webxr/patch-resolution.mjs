import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchResolution(checkout) {
  const edit = (name, fn) => { const file = path.join(checkout, name); writeFileSync(file, fn(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))); };
  edit("app/src/common/shared/com/igalia/wolvic/ui/widgets/WindowWidget.java", s => s.includes("NH3D persistent UI density") ? s : replaceOnce(s,
    "        return mBrowserDensity;", "        return mBrowserDensity * 1.5f; // NH3D persistent UI density, including compositor recreation.", "persistent HTML density"));
  edit("app/src/common/shared/com/igalia/wolvic/browser/engine/EngineProvider.kt", s => s.includes("NH3D logical viewport") ? s : s
    .replace("builder.displayDensityOverride(settingsStore.displayDensity)", "// NH3D logical viewport stays unchanged while its surface gains pixels.\n            builder.displayDensityOverride(settingsStore.displayDensity * 1.5f)")
    .replace("builder.displayDpiOverride(settingsStore.displayDpi)", "builder.displayDpiOverride((settingsStore.displayDpi * 1.5f).toInt())")
    .replaceAll("settingsStore.displayDpi / 100.0", "settingsStore.displayDpi * 1.5 / 100.0"));
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
