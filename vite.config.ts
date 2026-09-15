import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
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
const isQuestBuild = process.env.VITE_DEPLOY_TARGET === "quest";
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

// The native Quest proof serves a complete local HTTPS origin. Keep its HTML
// offline and its output separate from the Capacitor/desktop release assets.
function questBundlePlugin(): Plugin {
  return {
    name: "quest-bundled-ui-proof",
    transformIndexHtml(html) {
      return html.replace(
        /<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"']*["'][^>]*>/gi,
        "",
      );
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "quest-build.json",
        source: JSON.stringify({
          target: "quest-ui-proof",
          version: projectVersion,
          commit: resolvedBuildCommitSha,
          base: "/",
          entry: "quest-ui-probe.html",
        }, null, 2),
      });
    },
  };
}

const tileFaceTextureRotationFilePath = path.join(
  process.cwd(),
  ".wired-dev",
  "tile-face-texture-rotations.json",
);

function isLoopbackAddress(rawAddress: string | undefined): boolean {
  const address = String(rawAddress || "").toLowerCase();
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function normalizeTileFaceTextureRotationPayload(rawPayload: unknown) {
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as { rotations?: unknown })
      : {};
  const rawRotations =
    payload.rotations &&
    typeof payload.rotations === "object" &&
    !Array.isArray(payload.rotations)
      ? (payload.rotations as Record<string, unknown>)
      : {};
  const faceNames = ["east", "west", "north", "south", "top", "bottom"];
  const rotations: Record<string, Record<string, number>> = {};
  for (const [variant, rawFaces] of Object.entries(rawRotations).slice(0, 4096)) {
    if (
      !/^(?:3\.6\.7|5\.0|slashem):tile:\d+$/.test(variant) ||
      !rawFaces ||
      typeof rawFaces !== "object" ||
      Array.isArray(rawFaces)
    ) {
      continue;
    }
    const faces: Record<string, number> = {};
    for (const face of faceNames) {
      const rawRotation = (rawFaces as Record<string, unknown>)[face];
      if (
        typeof rawRotation === "number" &&
        Number.isFinite(rawRotation) &&
        [90, 180, 270].includes(rawRotation)
      ) {
        faces[face] = rawRotation;
      }
    }
    if (Object.keys(faces).length > 0) {
      rotations[variant] = faces;
    }
  }
  return { formatVersion: 1, rotations };
}

function tileFaceTextureRotationStorePlugin(): Plugin {
  const endpoint = "/__nh3d/tile-face-texture-rotations";
  return {
    name: "tile-face-texture-rotation-store",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(endpoint, (request, response) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        if (!isLoopbackAddress(request.socket.remoteAddress)) {
          response.statusCode = 403;
          response.end(JSON.stringify({ error: "Loopback access required." }));
          return;
        }
        if (request.method === "GET") {
          try {
            const payload = existsSync(tileFaceTextureRotationFilePath)
              ? JSON.parse(readFileSync(tileFaceTextureRotationFilePath, "utf8"))
              : { formatVersion: 1, rotations: {} };
            response.statusCode = 200;
            response.end(
              JSON.stringify(normalizeTileFaceTextureRotationPayload(payload)),
            );
          } catch (error) {
            response.statusCode = 500;
            response.end(
              JSON.stringify({ error: `Failed to read rotations: ${String(error)}` }),
            );
          }
          return;
        }
        if (request.method !== "PUT") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET, PUT");
          response.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }

        let body = "";
        let rejected = false;
        request.setEncoding("utf8");
        request.on("data", (chunk: string) => {
          if (rejected) {
            return;
          }
          body += chunk;
          if (body.length > 256 * 1024) {
            rejected = true;
            response.statusCode = 413;
            response.end(JSON.stringify({ error: "Payload too large." }));
          }
        });
        request.on("end", () => {
          if (rejected) {
            return;
          }
          try {
            const payload = normalizeTileFaceTextureRotationPayload(
              JSON.parse(body || "{}"),
            );
            mkdirSync(path.dirname(tileFaceTextureRotationFilePath), {
              recursive: true,
            });
            writeFileSync(
              tileFaceTextureRotationFilePath,
              `${JSON.stringify(payload, null, 2)}\n`,
              "utf8",
            );
            response.statusCode = 200;
            response.end(JSON.stringify(payload));
          } catch (error) {
            response.statusCode = 400;
            response.end(
              JSON.stringify({ error: `Invalid rotations: ${String(error)}` }),
            );
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tilesetManifestPlugin(),
    tileFaceTextureRotationStorePlugin(),
    react(),
    ...(isQuestBuild ? [questBundlePlugin()] : []),
  ],
  ...(isQuestBuild ? {
    build: {
      outDir: "dist-quest",
      rollupOptions: {
        input: {
          game: path.resolve(process.cwd(), "index.html"),
          probe: path.resolve(process.cwd(), "quest-ui-probe.html"),
        },
      },
    },
  } : {}),
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
  base: isQuestBuild ? "/" : isElectronBuild ? "./" : isGitHubActions ? "/nethack-3d/" : "/",
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
