// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";

export interface RuntimeSlashEmLocksDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "runtimeVersion"
  >;
}

/** Slash-EM filesystem lock-link compatibility. */
export class RuntimeSlashEmLocks {

  constructor(private readonly deps: RuntimeSlashEmLocksDependencies) {}

  patchSlashEmLockLinkFallback(mod) {
    if (this.deps.coordinator.runtimeVersion !== "slashem") {
      return;
    }
    if (!mod?.FS) {
      console.warn(
        "[Slash'EM startup FS] Skipping lock fallback install because FS is unavailable.",
      );
      return;
    }
    if (typeof mod.FS.link !== "function") {
      console.warn(
        "[Slash'EM startup FS] Skipping lock fallback install because FS.link is unavailable.",
        {
          availableFsKeys: Object.keys(mod.FS).slice(0, 40),
        },
      );
      return;
    }
    if (mod.FS.__nh3dSlashEmLockLinkFallbackPatched) {
      console.log(
        "[Slash'EM startup FS] Lock fallback already installed on this module instance.",
      );
      return;
    }

    const logPrefix = "[Slash'EM startup FS]";
    const originalLink = mod.FS.link.bind(mod.FS);
    const safeCwd = () => {
      try {
        return typeof mod.FS.cwd === "function" ? mod.FS.cwd() : null;
      } catch (error) {
        return `cwd-error:${String(error ?? "")}`;
      }
    };
    const normalizePath = (rawPath) =>
      String(rawPath ?? "")
        .replace(/\\/g, "/")
        .trim();
    const readBaseName = (rawPath) => {
      const normalizedPath = normalizePath(rawPath);
      if (!normalizedPath) {
        return "";
      }
      const lastSlashIndex = normalizedPath.lastIndexOf("/");
      return lastSlashIndex >= 0
        ? normalizedPath.slice(lastSlashIndex + 1)
        : normalizedPath;
    };
    const summarizeError = (error) => ({
      message:
        error instanceof Error && error.message
          ? error.message
          : String(error ?? ""),
      errno: Number.isFinite(Number(error?.errno)) ? Number(error.errno) : null,
      code:
        typeof error?.code === "string" || typeof error?.code === "number"
          ? error.code
          : null,
    });
    const listDirEntries = (rawPath) => {
      if (!mod?.FS || typeof mod.FS.readdir !== "function") {
        return null;
      }
      try {
        return mod.FS
          .readdir(rawPath)
          .filter((entry) => entry !== "." && entry !== "..")
          .slice(0, 20);
      } catch (error) {
        return [`readdir-error:${String(error ?? "")}`];
      }
    };
    const describePathState = (rawPath) => {
      const normalizedPath = normalizePath(rawPath);
      if (!normalizedPath || typeof mod.FS.analyzePath !== "function") {
        return {
          path: normalizedPath || String(rawPath ?? ""),
          exists: null,
        };
      }
      try {
        const analyzed = mod.FS.analyzePath(normalizedPath);
        const objectMode = analyzed?.object?.mode;
        return {
          path: normalizedPath,
          exists: Boolean(analyzed?.exists),
          objectMode: Number.isFinite(Number(objectMode))
            ? Number(objectMode)
            : null,
          isDir:
            analyzed?.exists &&
              typeof mod.FS.isDir === "function" &&
              Number.isFinite(Number(objectMode))
              ? Boolean(mod.FS.isDir(objectMode))
              : null,
          isFile:
            analyzed?.exists &&
              typeof mod.FS.isFile === "function" &&
              Number.isFinite(Number(objectMode))
              ? Boolean(mod.FS.isFile(objectMode))
              : null,
        };
      } catch (error) {
        return {
          path: normalizedPath,
          exists: null,
          analyzeError:
            error instanceof Error && error.message
              ? error.message
              : String(error ?? ""),
        };
      }
    };
    const isStartupDiagnosticPath = (rawPath) => {
      const baseName = readBaseName(rawPath).toLowerCase();
      return (
        baseName === "perm" ||
        baseName === "record" ||
        baseName.endsWith("_lock")
      );
    };
    const isLockLinkPath = (rawPath) => {
      const normalizedPath = normalizePath(rawPath).toLowerCase();
      if (!normalizedPath) {
        return false;
      }
      const lastSlashIndex = normalizedPath.lastIndexOf("/");
      const baseName =
        lastSlashIndex >= 0
          ? normalizedPath.slice(lastSlashIndex + 1)
          : normalizedPath;
      return baseName.endsWith("_lock");
    };
    const isTooManyLinksError = (error) => {
      const normalizedErrno = Number(error?.errno);
      const normalizedMessage = String(error?.message ?? error ?? "")
        .trim()
        .toLowerCase();
      return (
        normalizedErrno === 31 ||
        normalizedErrno === 34 ||
        normalizedMessage.includes("too many links") ||
        normalizedMessage.includes("emlink")
      );
    };
    const tryCreateLockLinkFallback = (sourcePath, targetPath) => {
      if (
        typeof mod.FS.analyzePath !== "function" ||
        typeof mod.FS.readFile !== "function" ||
        typeof mod.FS.writeFile !== "function"
      ) {
        console.warn(`${logPrefix} Lock fallback prerequisites are unavailable.`, {
          hasAnalyzePath: typeof mod.FS.analyzePath === "function",
          hasReadFile: typeof mod.FS.readFile === "function",
          hasWriteFile: typeof mod.FS.writeFile === "function",
        });
        return false;
      }
      const sourceInfo = mod.FS.analyzePath(sourcePath);
      const targetInfo = mod.FS.analyzePath(targetPath);
      if (!sourceInfo?.exists || targetInfo?.exists) {
        console.warn(`${logPrefix} Lock fallback cannot proceed because source/target state is incompatible.`, {
          sourcePath: describePathState(sourcePath),
          targetPath: describePathState(targetPath),
        });
        return false;
      }
      if (typeof mod.FS.symlink === "function") {
        try {
          mod.FS.symlink(sourcePath, targetPath);
          return "symlink";
        } catch (error) {
          console.warn(
            `${logPrefix} Lock-file symlink fallback failed for ${sourcePath} -> ${targetPath}:`,
            summarizeError(error),
          );
        }
      }
      const sourceBytes = mod.FS.readFile(sourcePath);
      mod.FS.writeFile(targetPath, sourceBytes, { canOwn: true });
      return "copy";
    };
    const wrapPathTraceMethod = (methodName, pathIndexes) => {
      const originalMethod = mod.FS[methodName];
      if (
        typeof originalMethod !== "function" ||
        mod.FS[`__nh3dSlashEmStartupTrace_${methodName}`]
      ) {
        return;
      }
      mod.FS[methodName] = function (...args) {
        const tracedPaths = pathIndexes
          .map((index) => args[index])
          .filter((value) => isStartupDiagnosticPath(value));
        if (tracedPaths.length > 0) {
          console.log(`${logPrefix} ${methodName}() attempt`, {
            cwd: safeCwd(),
            args: pathIndexes.reduce((result, index) => {
              result[`arg${index}`] = normalizePath(args[index]);
              return result;
            }, {}),
            pathStates: tracedPaths.map((path) => describePathState(path)),
          });
        }
        try {
          const result = originalMethod.apply(this, args);
          if (tracedPaths.length > 0) {
            console.log(`${logPrefix} ${methodName}() success`, {
              cwd: safeCwd(),
              pathStates: tracedPaths.map((path) => describePathState(path)),
            });
          }
          return result;
        } catch (error) {
          if (tracedPaths.length > 0) {
            console.warn(`${logPrefix} ${methodName}() failed`, {
              cwd: safeCwd(),
              error: summarizeError(error),
              pathStates: tracedPaths.map((path) => describePathState(path)),
            });
          }
          throw error;
        }
      };
      mod.FS[`__nh3dSlashEmStartupTrace_${methodName}`] = true;
    };

    console.log(`${logPrefix} Installing lock fallback diagnostics.`, {
      cwd: safeCwd(),
      hasSymlink: typeof mod.FS.symlink === "function",
      hasOpen: typeof mod.FS.open === "function",
      hasUnlink: typeof mod.FS.unlink === "function",
      rootEntries: listDirEntries("/"),
      saveEntries: listDirEntries("/save"),
      permState: describePathState("perm"),
      permLockState: describePathState("perm_lock"),
    });
    wrapPathTraceMethod("open", [0]);
    wrapPathTraceMethod("unlink", [0]);

    mod.FS.link = (oldpath, newpath) => {
      const shouldTraceLink =
        isStartupDiagnosticPath(oldpath) || isStartupDiagnosticPath(newpath);
      if (shouldTraceLink) {
        console.log(`${logPrefix} link() attempt`, {
          cwd: safeCwd(),
          sourcePath: describePathState(oldpath),
          targetPath: describePathState(newpath),
        });
      }
      try {
        const result = originalLink(oldpath, newpath);
        if (shouldTraceLink) {
          console.log(`${logPrefix} link() success`, {
            cwd: safeCwd(),
            sourcePath: describePathState(oldpath),
            targetPath: describePathState(newpath),
          });
        }
        return result;
      } catch (error) {
        if (shouldTraceLink) {
          console.warn(`${logPrefix} link() failed`, {
            cwd: safeCwd(),
            error: summarizeError(error),
            sourcePath: describePathState(oldpath),
            targetPath: describePathState(newpath),
          });
        }
        if (!isLockLinkPath(newpath) || !isTooManyLinksError(error)) {
          throw error;
        }
        const fallbackMode = tryCreateLockLinkFallback(oldpath, newpath);
        if (!fallbackMode) {
          console.warn(`${logPrefix} link() fallback could not create replacement lock artifact.`, {
            cwd: safeCwd(),
            sourcePath: describePathState(oldpath),
            targetPath: describePathState(newpath),
          });
          throw error;
        }
        console.warn(
          `${logPrefix} Applied ${fallbackMode} fallback for lock-file link: ${oldpath} -> ${newpath}`,
        );
        console.log(`${logPrefix} link() fallback success`, {
          cwd: safeCwd(),
          fallbackMode,
          sourcePath: describePathState(oldpath),
          targetPath: describePathState(newpath),
        });
      }
    };
    mod.FS.__nh3dSlashEmLockLinkFallbackPatched = true;
  }
}
