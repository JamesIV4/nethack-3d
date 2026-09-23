import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { patchVisibleInput } from "./patch-visible-input.mjs";

for (const keyboardPatched of [false, true]) {
  test(`visibility patch preserves hit filters with keyboard patch ${keyboardPatched ? "present" : "absent"}`, t => {
    const root = mkdtempSync(path.join(os.tmpdir(), "nh3d-visible-input-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, "app/src/main/cpp/BrowserWorld.cpp");
    mkdirSync(path.dirname(file), { recursive: true });
    const keyboard = "        if (externalVR->IsPresenting() && KeyboardPriority(widget) == 0 && (!gamePanels || !gamePanels->Owns(widget))) continue;\n";
    writeFileSync(file, `  if (!gameUiAnchored || revision != gameAnchorRevision) {
    for (const auto& widget : widgets) {
      if (widget->GetPlacement()->name == "Window" && widget->IsVisible()) {
    WidgetPtr previousWidget = controller.widget ? GetWidget(controller.widget) : nullptr;
    // NH3D only the composited game window supplies browser hit regions in XR.
    bool isDragging = pressed && wasPressed && previousWidget && !isResizing;
    if (isDragging) {
      for (const WidgetPtr& widget: widgets) {
${keyboardPatched ? keyboard : ""}        if (externalVR->IsPresenting() && widget->GetPlacement()->name == "Window" &&
            (!gamePanels || !gamePanels->Owns(widget))) continue;
`);
    patchVisibleInput(root);
    const result = readFileSync(file, "utf8");
    assert.ok(result.includes("if (!widget->GetPlacement() || !widget->GetPlacement()->visible) continue;"));
    assert.ok(result.includes('widget->GetPlacement()->name == "Window" &&'));
    if (keyboardPatched) {
      assert.ok(result.includes(keyboard));
      assert.ok(result.indexOf("!widget->GetPlacement()->visible") < result.indexOf("KeyboardPriority(widget)"));
    }
    patchVisibleInput(root);
    assert.equal(readFileSync(file, "utf8"), result);
  });
}
