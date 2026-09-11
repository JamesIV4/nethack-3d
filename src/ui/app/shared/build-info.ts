/** Build version, commit and debug-unlock presentation. */
export const nh3dAppVersion =
  typeof import.meta.env.VITE_NH3D_APP_VERSION === "string" &&
    import.meta.env.VITE_NH3D_APP_VERSION.trim()
    ? import.meta.env.VITE_NH3D_APP_VERSION.trim()
    : "0.0.0";

export const nh3dBuildCommitSha =
  typeof import.meta.env.VITE_NH3D_BUILD_COMMIT_SHA === "string"
    ? import.meta.env.VITE_NH3D_BUILD_COMMIT_SHA.trim()
    : "";

export const nh3dBuildLabel = nh3dBuildCommitSha
  ? `v${nh3dAppVersion} (${nh3dBuildCommitSha.slice(0, 7)})`
  : `v${nh3dAppVersion}`;

export const nh3dBuildLabelDebugEnableClickCount = 10;
