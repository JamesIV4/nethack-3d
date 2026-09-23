import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce } from "./runtime-patch.mjs";

export function patchFloorCalibration(checkout) {
  const file = path.join(checkout, "app/src/openxr/cpp/DeviceDelegateOpenXR.cpp");
  let source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  if (source.includes("NH3D validated floor calibration")) return;
  source = replaceOnce(source, "  XrSpace stageSpace = XR_NULL_HANDLE;",
    "  XrSpace stageSpace = XR_NULL_HANDLE;\n  bool gameFloorValid = false; // NH3D validated floor calibration\n  float gameFloorHeight = 0.0f;", "floor calibration state");
  source = replaceOnce(source, `      caps |= device::StageParameters;

      // Compute the transform between local and stage space
      XrSpaceLocation stageLocation{XR_TYPE_SPACE_LOCATION};
      xrLocateSpace(m.localSpace, m.stageSpace, m.predictedDisplayTime, &stageLocation);
      vrb::Matrix transform = XrPoseToMatrix(stageLocation.pose);
      m.immersiveDisplay->SetSittingToStandingTransform(transform);`, `      // Keep the last valid floor while tracking initializes or is interrupted.
      XrSpaceLocation stageLocation{XR_TYPE_SPACE_LOCATION};
      const XrResult floorResult = xrLocateSpace(m.localSpace, m.stageSpace, m.predictedDisplayTime, &stageLocation);
      const XrSpaceLocationFlags floorFlags = XR_SPACE_LOCATION_POSITION_VALID_BIT | XR_SPACE_LOCATION_ORIENTATION_VALID_BIT;
      if (XR_SUCCEEDED(floorResult) && (stageLocation.locationFlags & floorFlags) == floorFlags) {
        const float height = stageLocation.pose.position.y;
        const bool floorChanged = !m.gameFloorValid || std::abs(height - m.gameFloorHeight) > 0.005f;
        m.gameFloorValid = true;
        m.immersiveDisplay->SetSittingToStandingTransform(XrPoseToMatrix(stageLocation.pose));
        if (floorChanged) {
          m.gameFloorHeight = height;
          VRBrowser::OnGameSystemRecenter();
        }
      }
      if (m.gameFloorValid) caps |= device::StageParameters;`, "validated stage floor transform");
  source = replaceOnce(source, "      stageSpace = XR_NULL_HANDLE;",
    "      stageSpace = XR_NULL_HANDLE;\n      gameFloorValid = false;", "reset destroyed floor space");
  writeFileSync(file, source);
}
