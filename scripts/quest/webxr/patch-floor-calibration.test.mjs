import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { patchFloorCalibration } from "./patch-floor-calibration.mjs";

test("validates the stage transform, retains a good floor and notifies recalibration idempotently", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "nh3d-floor-"));
  const file = path.join(root, "app/src/openxr/cpp/DeviceDelegateOpenXR.cpp");
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `  XrSpace stageSpace = XR_NULL_HANDLE;
      caps |= device::StageParameters;

      // Compute the transform between local and stage space
      XrSpaceLocation stageLocation{XR_TYPE_SPACE_LOCATION};
      xrLocateSpace(m.localSpace, m.stageSpace, m.predictedDisplayTime, &stageLocation);
      vrb::Matrix transform = XrPoseToMatrix(stageLocation.pose);
      m.immersiveDisplay->SetSittingToStandingTransform(transform);
      stageSpace = XR_NULL_HANDLE;
`);
    patchFloorCalibration(root);
    const result = readFileSync(file, "utf8");
    assert.match(result, /XR_SUCCEEDED\(floorResult\) && \(stageLocation.locationFlags & floorFlags\) == floorFlags/);
    assert.match(result, /if \(m.gameFloorValid\) caps \|= device::StageParameters/);
    assert.match(result, /if \(floorChanged\) \{\s+m.gameFloorHeight = height;\s+VRBrowser::OnGameSystemRecenter\(\);/);
    assert.match(result, /stageSpace = XR_NULL_HANDLE;\s+gameFloorValid = false/);
    patchFloorCalibration(root);
    assert.equal(readFileSync(file, "utf8"), result);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("nh3d-floor-"));
    rmSync(root, { recursive: true, force: true });
  }
});
