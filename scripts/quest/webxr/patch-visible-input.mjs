import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

/**
 * Native Widget::IsVisible reflects both logical placement visibility and the
 * short DrawImmersive compositor hide. Hit testing must follow the former;
 * the HTML pane snapshot separately determines whether a captured pane still
 * exists. This runs after the other BrowserWorld patches.
 */
export function patchVisibleInput(checkout) {
  const file = path.join(checkout, "app/src/main/cpp/BrowserWorld.cpp");
  let source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  if (source.includes("NH3D visible native input")) return;

  source = replaceOnce(source,
    `  if (!gameUiAnchored || revision != gameAnchorRevision) {
    for (const auto& widget : widgets) {
      if (widget->GetPlacement()->name == "Window" && widget->IsVisible()) {`,
    `  if (gameWindow && (!gameWindow->GetPlacement() || !gameWindow->GetPlacement()->visible)) {
    gameWindow.reset(); gameUiAnchored = false;
  }
  if (!gameUiAnchored || revision != gameAnchorRevision) {
    for (const auto& widget : widgets) {
      // Placement visibility is stable while DrawImmersive temporarily hides
      // Window roots with ToggleWidget(false).
      if (widget->GetPlacement() && widget->GetPlacement()->name == "Window" && widget->GetPlacement()->visible) {`,
    "active game Window source");

  source = replaceOnce(source,
    `    WidgetPtr previousWidget = controller.widget ? GetWidget(controller.widget) : nullptr;
    // NH3D only the composited game window supplies browser hit regions in XR.`,
    `    WidgetPtr previousWidget = controller.widget ? GetWidget(controller.widget) : nullptr;
    // NH3D visible native input: a placement-hidden widget cannot retain a
    // hover or capture just because its root was previously enabled.
    if (previousWidget && (!previousWidget->GetPlacement() || !previousWidget->GetPlacement()->visible)) previousWidget = nullptr;
    // NH3D only the composited game window supplies browser hit regions in XR.`,
    "discard hidden native capture");

  source = replaceOnce(source,
    `    bool isDragging = pressed && wasPressed && previousWidget && !isResizing;
    if (isDragging) {`,
    `    // Retain a live pane capture outside its bounds, but never retain a
    // pane removed from the newest DOM snapshot.
    if (previousWidget && externalVR->IsPresenting() && gamePanels && gamePanels->Owns(previousWidget) &&
        !gamePanels->HasCapture(controller.index)) previousWidget = nullptr;
    bool isDragging = pressed && wasPressed && previousWidget && !isResizing;
    if (isDragging) {`,
    "discard vanished pane capture");

  source = replaceOnce(source,
    `      for (const WidgetPtr& widget: widgets) {`,
    `      for (const WidgetPtr& widget: widgets) {
        // Widget roots may be temporarily hidden for composition. Use the
        // placement flag here so only a logically hidden native widget loses
        // hit testing.
        if (!widget->GetPlacement() || !widget->GetPlacement()->visible) continue;`,
    "skip hidden native widgets");

  writeFileSync(file, source);
}
