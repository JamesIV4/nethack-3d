import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import {
  TILESET_MANIFEST_SOURCE_DIRS,
  generateTilesetManifest,
} from "./scripts/tilesets/generate-tileset-manifest.mjs";

function resolveProjectPackageVersion(): string {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const payload = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return typeof payload.version === "string" && payload.version.trim()
      ? payload.version.trim()
      : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function resolveBuildCommitSha(): string {
  const explicitEnvSha =
    typeof process.env.VITE_NH3D_BUILD_COMMIT_SHA === "string"
      ? process.env.VITE_NH3D_BUILD_COMMIT_SHA.trim()
      : "";
  if (explicitEnvSha) {
    return explicitEnvSha;
  }

  const githubActionsSha =
    typeof process.env.GITHUB_SHA === "string"
      ? process.env.GITHUB_SHA.trim()
      : "";
  if (githubActionsSha) {
    return githubActionsSha;
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function buildFileContains(filePath: string, snippet: string): boolean {
  try {
    return readFileSync(filePath, "utf8").includes(snippet);
  } catch {
    return false;
  }
}

function buildRuntimeAssetTag(filePaths: string[]): string {
  const parts: string[] = [];
  for (const filePath of filePaths) {
    try {
      const stats = statSync(filePath);
      parts.push(`${stats.size}-${Math.trunc(stats.mtimeMs)}`);
    } catch {
      parts.push("missing");
    }
  }
  return parts.join(".");
}

function resolvePublicAssetPath(filename: string): string {
  return path.join(process.cwd(), "public", filename);
}

function tilesetManifestPlugin() {
  const watchedPaths = TILESET_MANIFEST_SOURCE_DIRS.map((sourceDir) =>
    sourceDir.replace(/\\/g, "/"),
  );
  const isTilesetAssetPath = (path: string): boolean => {
    const normalizedPath = path.replace(/\\/g, "/");
    return (
      watchedPaths.some((watchedPath) => normalizedPath.startsWith(watchedPath)) &&
      /\.(png|bmp|gif|jpe?g|webp)$/i.test(normalizedPath)
    );
  };

  const regenerate = () => {
    generateTilesetManifest();
  };

  return {
    name: "generate-tileset-manifest",
    buildStart() {
      regenerate();
    },
    configureServer(server: ViteDevServer) {
      regenerate();
      server.watcher.add(TILESET_MANIFEST_SOURCE_DIRS);
      const handleTilesetFileEvent = (path: string) => {
        if (!isTilesetAssetPath(path)) {
          return;
        }
        regenerate();
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", handleTilesetFileEvent);
      server.watcher.on("unlink", handleTilesetFileEvent);
      server.watcher.on("change", handleTilesetFileEvent);
    },
  };
}

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const isElectronBuild = process.env.BUILD_TARGET === "electron";
const enableCrossOriginIsolation =
  process.env.NH3D_ENABLE_CROSS_ORIGIN_ISOLATION === "true";
const wasm367RuntimeBuildJsPath = resolvePublicAssetPath("nethack-367.js");
const wasm5RuntimeBuildJsPath = resolvePublicAssetPath("nethack-5.js");
const slashemRuntimeBuildJsPath = resolvePublicAssetPath("slashem.js");
const wasm367CompatTag = "wasm-367-forked";
const wasm5CompatTag = "wasm-5-forked";
const slashemCompatTag = "slashem-343-forked";
const projectVersion = resolveProjectPackageVersion();
const wasm367RuntimeBuildTag = buildRuntimeAssetTag([
  wasm367RuntimeBuildJsPath,
  resolvePublicAssetPath("nethack-367.wasm"),
]);
const wasm5RuntimeBuildTag = buildRuntimeAssetTag([
  wasm5RuntimeBuildJsPath,
  resolvePublicAssetPath("nethack-5.wasm"),
]);
const slashemRuntimeBuildTag = buildRuntimeAssetTag([
  slashemRuntimeBuildJsPath,
  resolvePublicAssetPath("slashem.wasm"),
]);
const wasm367PointerAbiTag = "nh367-pointer-v1";
const wasm5PointerAbiTag = "nh5-pointer-v1";
const slashemPointerAbiTag = "slashem-pointer-v1";
const wasm367HasRecoverSavefile = buildFileContains(
  wasm367RuntimeBuildJsPath,
  'Module["_recover_savefile"]',
);
// The low-level recover_savefile() export alone is not sufficient for the web
// client. A usable browser-side autosave resume path also needs a dedicated
// bridge that can prepare lock state before libnhmain reaches unixunix.c/getlock().
const wasm367HasCheckpointResumeBridge = buildFileContains(
  wasm367RuntimeBuildJsPath,
  'Module["_resume_checkpoint_save"]',
);
const wasm5HasRecoverSavefile = buildFileContains(
  wasm5RuntimeBuildJsPath,
  'Module["_recover_savefile"]',
);
const wasm5HasCheckpointResumeBridge = buildFileContains(
  wasm5RuntimeBuildJsPath,
  'Module["_resume_checkpoint_save"]',
);
const slashemHasRecoverSavefile = buildFileContains(
  slashemRuntimeBuildJsPath,
  'Module["_recover_savefile"]',
);
const slashemHasCheckpointResumeBridge = buildFileContains(
  slashemRuntimeBuildJsPath,
  'Module["_resume_checkpoint_save"]',
);
const resolvedBuildCommitSha = resolveBuildCommitSha();
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};
const bundledClientUpdateState = (() => {
  const manifestPath = path.join(
    process.cwd(),
    "build",
    "client-updates",
    "manifest.json",
  );
  try {
    const payload = JSON.parse(readFileSync(manifestPath, "utf8"));
    const latest =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { latest?: unknown }).latest
        : null;
    if (!latest || typeof latest !== "object" || Array.isArray(latest)) {
      return {
        buildId: "",
        commitSha: "",
      };
    }
    const latestPayload = latest as Record<string, unknown>;
    return {
      buildId:
        typeof latestPayload.buildId === "string"
          ? latestPayload.buildId.trim()
          : "",
      commitSha:
        typeof latestPayload.commitSha === "string"
          ? latestPayload.commitSha.trim()
          : "",
    };
  } catch {
    return {
      buildId: "",
      commitSha: "",
    };
  }
})();

const devSessionTag = String(Date.now());

export default defineConfig({
  plugins: [tilesetManifestPlugin(), react()],
  define: {
    "import.meta.env.VITE_NH3D_APP_VERSION": JSON.stringify(projectVersion),
    "import.meta.env.VITE_NH3D_BUILD_COMMIT_SHA": JSON.stringify(
      resolvedBuildCommitSha,
    ),
    "import.meta.env.VITE_NH3D_BUNDLED_UPDATE_BUILD_ID": JSON.stringify(
      bundledClientUpdateState.buildId,
    ),
    "import.meta.env.VITE_NH3D_BUNDLED_UPDATE_COMMIT_SHA": JSON.stringify(
      bundledClientUpdateState.commitSha,
    ),
    "import.meta.env.VITE_NH3D_DEV_SESSION_TAG": JSON.stringify(devSessionTag),
    "import.meta.env.VITE_NH3D_WASM_367_COMPAT_TAG":
      JSON.stringify(wasm367CompatTag),
    "import.meta.env.VITE_NH3D_WASM_367_RUNTIME_BUILD_TAG":
      JSON.stringify(wasm367RuntimeBuildTag),
    "import.meta.env.VITE_NH3D_WASM_367_POINTER_ABI_TAG":
      JSON.stringify(wasm367PointerAbiTag),
    "import.meta.env.VITE_NH3D_WASM_367_HAS_RECOVER_SAVEFILE": JSON.stringify(
      wasm367HasRecoverSavefile,
    ),
    "import.meta.env.VITE_NH3D_WASM_367_HAS_CHECKPOINT_RESUME_BRIDGE":
      JSON.stringify(wasm367HasCheckpointResumeBridge),
    "import.meta.env.VITE_NH3D_WASM_5_COMPAT_TAG":
      JSON.stringify(wasm5CompatTag),
    "import.meta.env.VITE_NH3D_WASM_5_RUNTIME_BUILD_TAG":
      JSON.stringify(wasm5RuntimeBuildTag),
    "import.meta.env.VITE_NH3D_WASM_5_POINTER_ABI_TAG":
      JSON.stringify(wasm5PointerAbiTag),
    "import.meta.env.VITE_NH3D_WASM_5_HAS_RECOVER_SAVEFILE": JSON.stringify(
      wasm5HasRecoverSavefile,
    ),
    "import.meta.env.VITE_NH3D_WASM_5_HAS_CHECKPOINT_RESUME_BRIDGE":
      JSON.stringify(wasm5HasCheckpointResumeBridge),
    "import.meta.env.VITE_NH3D_WASM_SLASHEM_COMPAT_TAG":
      JSON.stringify(slashemCompatTag),
    "import.meta.env.VITE_NH3D_WASM_SLASHEM_RUNTIME_BUILD_TAG":
      JSON.stringify(slashemRuntimeBuildTag),
    "import.meta.env.VITE_NH3D_WASM_SLASHEM_POINTER_ABI_TAG":
      JSON.stringify(slashemPointerAbiTag),
    "import.meta.env.VITE_NH3D_WASM_SLASHEM_HAS_RECOVER_SAVEFILE":
      JSON.stringify(slashemHasRecoverSavefile),
    "import.meta.env.VITE_NH3D_WASM_SLASHEM_HAS_CHECKPOINT_RESUME_BRIDGE":
      JSON.stringify(slashemHasCheckpointResumeBridge),
  },
  base: isElectronBuild ? "./" : isGitHubActions ? "/nethack-3d/" : "/",
  server: {
    allowedHosts: true,
    ...(enableCrossOriginIsolation
      ? { headers: crossOriginIsolationHeaders }
      : {}),
  },
  ...(enableCrossOriginIsolation
    ? {
        preview: {
          headers: crossOriginIsolationHeaders,
        },
      }
    : {}),
  worker: {
    format: "es",
  },
});
