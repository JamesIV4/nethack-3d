export const WOLVIC_REVISION = "5725712987a8f87eea3780834b5359cca4c5f5e1";
export const runtimePaths = {
  world: "app/src/main/cpp/BrowserWorld.cpp",
  external: "app/src/main/cpp/ExternalVR.cpp",
  activity: "app/src/common/shared/com/igalia/wolvic/VRBrowserActivity.java",
  window: "app/src/common/shared/com/igalia/wolvic/ui/widgets/WindowWidget.java",
  windows: "app/src/common/shared/com/igalia/wolvic/ui/widgets/Windows.java",
};
export function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error("Pinned runtime patch anchor changed: " + label);
  return source.replace(before, after);
}
/** Only the dedicated game-host checkout is patched. The browser owns WebXR eye buffers unchanged. */
export function patchRuntime(sources) {
  const out = { ...sources };
  const patch = (file, before, after, label) => { out[file] = replaceOnce(out[file].replaceAll("\r\n", "\n"), before, after, label); };
  patch("world", "    m.CheckBackButton();\n    createPassthroughLayerIfNeeded();\n    TickImmersive();", `    m.CheckBackButton();
    // NH3D: keep pointer interaction with the live HTML pane during WebXR.
    bool relayoutGamePane = false;
    m.UpdateControllers(relayoutGamePane);
    if (relayoutGamePane) UpdateVisibleWidgets();
    createPassthroughLayerIfNeeded();
    TickImmersive();`, "immersive pointer routing");
  patch("world", `  m.device->BindEye(aEye);
  m.blitter->Draw(aEye);
}`, `  m.device->BindEye(aEye);
  m.blitter->Draw(aEye);
  // NH3D: composite live page/keyboard surfaces after the original WebXR eye image.
  // No world meshes or materials cross this boundary.
  const CameraPtr camera = aEye == device::Eye::Left ? m.leftCamera : m.rightCamera;
  m.rootTransparent->SetTransform(m.device->GetReorientTransform().PostMultiply(m.widgetsYaw));
  VRB_GL_CHECK(glClear(GL_DEPTH_BUFFER_BIT));
  VRB_GL_CHECK(glDepthMask(GL_FALSE));
  m.drawList->Reset();
  m.rootTransparent->Cull(*m.cullVisitor, *m.drawList);
  m.drawList->Draw(*camera);
  VRB_GL_CHECK(glDepthMask(GL_TRUE));
}`, "eye image plus live pane");
  patch("activity", "        PauseCompositorRunnable runnable = new PauseCompositorRunnable();", `        // NH3D: the focused page must continue painting its HTML surface in WebXR.
        // Keep the lifecycle notification above; skip only the compositor pause.
        if (BuildConfig.NH3D_GAME_HOST) return;
        PauseCompositorRunnable runnable = new PauseCompositorRunnable();`, "live compositor");
  patch("activity", "    protected void onCreate(Bundle savedInstanceState) {", `    protected void onCreate(Bundle savedInstanceState) {
        BundledGameServer.start(getApplicationContext());
        getIntent().setData(android.net.Uri.parse(BundledGameServer.ORIGIN + "/?xrHost=native"));
        getIntent().putExtra(EXTRA_KIOSK, true);
        getIntent().putExtra(EXTRA_HIDE_WEBXR_INTERSTITIAL, true);
        SettingsStore.getInstance(this).setTelemetryEnabled(false);`, "bundled startup");
  patch("activity", "    protected void onDestroy() {", `    protected void onDestroy() {
        BundledGameServer.stop();`, "server lifecycle");
  patch("window", "        aPlacement.cylinder = true;\n        aPlacement.name = \"Window\";", `        aPlacement.cylinder = false;
        aPlacement.layer = false; // A GPU surface drawn alongside the WebXR projection.
        aPlacement.width = 1600;
        aPlacement.height = 1000;
        aPlacement.density = 1.0f;
        aPlacement.worldWidth = 1.6f;
        aPlacement.name = "Window";`, "frameless fixed-size page");
  patch("window", "        mTopBar = new TopBarWidget(aContext);", `        mWidgetPlacement.clearColor = 0;
        mTopBar = new TopBarWidget(aContext);`, "transparent pane clear");
  patch("windows", `    public void openInKioskMode(@NonNull String aUri) {
        Session session = SessionStore.get().createSuspendedSession(aUri, true);`, `    public void openInKioskMode(@NonNull String aUri) {
        // Bundled game saves must persist across launches.
        Session session = SessionStore.get().createSuspendedSession(aUri, false);`, "persistent game storage");
  // Prevent a controller interacting with the pane from simultaneously moving/selecting in the game.
  patch("external", "    immersiveController.buttonPressed = controller.immersivePressedState;",
    "    immersiveController.buttonPressed = controller.widget ? 0 : controller.immersivePressedState;", "UI trigger ownership");
  patch("external", "    immersiveController.buttonTouched = controller.immersiveTouchedState;",
    "    immersiveController.buttonTouched = controller.widget ? 0 : controller.immersiveTouchedState;", "UI touch ownership");
  patch("external", "      immersiveController.triggerValue[j] = controller.immersiveTriggerValues[j];",
    "      immersiveController.triggerValue[j] = controller.widget ? 0.0f : controller.immersiveTriggerValues[j];", "UI analog ownership");
  // Keep thumbsticks available for locomotion while the ray crosses transparent HUD space.
  // The game's existing modal/input gates suppress gameplay while HTML dialogs own input.
  return out;
}
