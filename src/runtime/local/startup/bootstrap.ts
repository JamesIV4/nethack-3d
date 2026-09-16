// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
import { ensureBundledTerminalSymbolSetsFile } from "../../nethack-symbols";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeAssets } from "./runtime-assets";
import type { RuntimeStatus } from "../status/status";
import type { RuntimeStartupConfiguration } from "./startup-configuration";
import type { RuntimeTextInput } from "../input/text-input";
import type { RuntimePersistence } from "../persistence/startup-persistence";
import type { RuntimePointerContract } from "../abi/pointer-contract";
import type { RuntimeCheckpointRecovery } from "../persistence/checkpoint-recovery";
import type { RuntimeWindows } from "../messages/windows";

export function createNethackCallbackDispatcher(handleUICallback) {
  return (name, ...args) => {
    try {
      const result = handleUICallback(name, args);
      const supportsSynchronousGlyphCallbacks =
        globalThis.nethackGlobal?.nh3dSynchronousGlyphCallbacks === 1;
      if (
        supportsSynchronousGlyphCallbacks &&
        name === "shim_print_glyph" &&
        !(result && typeof result.then === "function")
      ) {
        return result;
      }
      return Promise.resolve(result);
    } catch (error) {
      // Preserve the previous async wrapper's rejected-Promise behavior.
      return Promise.reject(error);
    }
  };
}
import type { RuntimeSlashEmLocks } from "../persistence/slashem-locks";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimeStartupDiagnostics } from "../diagnostics/startup-diagnostics";

export interface RuntimeBootstrapDependencies {
  readonly assets: Pick<
    RuntimeAssets,
    "getRuntimeWasmAssetPath"
    | "loadRuntimeFactory"
    | "normalizeRuntimeVersion"
    | "readRuntimeBuildTag"
    | "resolveWasmAssetUrl"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "emitRuntimeTerminated"
    | "handleUICallback"
    | "nethackInstance"
    | "nethackModule"
    | "runtimeVersion"
    | "startupOptions"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "installHelperCompatibilityShims"
  >;
  readonly persistence: Pick<
    RuntimePersistence,
    "installRuntimeStartupPersistence"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "runtimePointerContract"
    | "runtimePointerContractValidated"
    | "validateRuntimePointerContract"
  >;
  readonly recovery: Pick<
    RuntimeCheckpointRecovery,
    "queueCheckpointAutosaveResumeBeforeStartup"
    | "updateCheckpointRecoverySupport"
  >;
  readonly slashEmLocks: Pick<
    RuntimeSlashEmLocks,
    "patchSlashEmLockLinkFallback"
  >;
  readonly startupDiagnostics: Pick<
    RuntimeStartupDiagnostics,
    "scheduleStartupNoCallbackDiagnostic"
  >;
  readonly startupOptions: Pick<
    RuntimeStartupConfiguration,
    "buildRuntimeModuleStartupOptions"
    | "lastConfiguredNethackOptions"
  >;
  readonly status: Pick<
    RuntimeStatus,
    "seedRuntimeStatusFieldConstants"
  >;
  readonly textInput: Pick<
    RuntimeTextInput,
    "consumeStdinByte"
  >;
  readonly windows: Pick<
    RuntimeWindows,
    "getDefaultRuntimeWindowGlobals"
    | "getRuntimeWindowTypeLabels"
  >;
}

/** Ordered WASM loading, globals setup, hydration and main invocation. */
export class RuntimeBootstrap {

  constructor(private readonly deps: RuntimeBootstrapDependencies) {}

  async initializeNetHack() {
    try {
      console.log("Starting local NetHack session...");

      globalThis.nethackCallback = createNethackCallbackDispatcher(
        (name, args) => this.deps.coordinator.handleUICallback(name, args),
      );

      this.deps.coordinator.runtimeVersion = this.deps.assets.normalizeRuntimeVersion(
        this.deps.coordinator.startupOptions?.runtimeVersion,
      );

      /** @type {NethackRuntimeVersion} */
      const runtimeVersion = this.deps.assets.normalizeRuntimeVersion(
        this.deps.coordinator.startupOptions?.runtimeVersion,
      );
      const wasmAssetPath = this.deps.assets.getRuntimeWasmAssetPath(runtimeVersion);
      const startupHookLabel = `[WASM startup:${runtimeVersion}]`;
      let startupModule = null;
      let lastObservedRunDependencyCount = Number.NaN;
      const listDirectoryEntries = (mod, dirPath) => {
        if (!mod?.FS || typeof mod.FS.readdir !== "function") {
          return null;
        }
        try {
          return mod.FS
            .readdir(dirPath)
            .filter((entry) => entry !== "." && entry !== "..")
            .slice(0, 20);
        } catch (error) {
          return [`readdir-error:${String(error ?? "")}`];
        }
      };
      const summarizeModuleState = (mod) => {
        const activeModule = mod || startupModule;
        if (!activeModule) {
          return {
            hasModule: false,
          };
        }
        let cwd = null;
        if (activeModule.FS && typeof activeModule.FS.cwd === "function") {
          try {
            cwd = activeModule.FS.cwd();
          } catch (error) {
            cwd = `cwd-error:${String(error ?? "")}`;
          }
        }
        return {
          hasModule: true,
          hasFS: Boolean(activeModule.FS),
          hasIDBFS: Boolean(
            activeModule.IDBFS || activeModule.FS?.filesystems?.IDBFS,
          ),
          cwd,
          runDependencies: Number.isFinite(Number(activeModule.runDependencies))
            ? Number(activeModule.runDependencies)
            : null,
          calledRun:
            typeof activeModule.calledRun === "boolean"
              ? activeModule.calledRun
              : null,
        };
      };
      const logStartupHook = (hookName, mod, extraDetails = null) => {
        console.log(`${startupHookLabel} ${hookName}`, {
          ...summarizeModuleState(mod),
          ...(extraDetails && typeof extraDetails === "object"
            ? extraDetails
            : {}),
        });
      };
      this.installDefaultRuntimeGlobals(runtimeVersion);
      this.deps.status.seedRuntimeStatusFieldConstants();
      const { runtimeOptions, checkpointStartupOptionEnabled } = this.deps.startupOptions.buildRuntimeModuleStartupOptions(runtimeVersion);

      const resolvedWasmAssetUrl = this.deps.assets.resolveWasmAssetUrl(
        wasmAssetPath,
        runtimeVersion,
      );
      console.log("Resolved NetHack wasm asset URL", {
        runtimeVersion,
        wasmAssetPath,
        resolvedWasmAssetUrl,
        runtimeBuildTag: this.deps.assets.readRuntimeBuildTag(runtimeVersion) || null,
      });

      const createModule = await this.deps.assets.loadRuntimeFactory(runtimeVersion);

      this.deps.coordinator.nethackInstance = await createModule({
        noInitialRun: true,
        preInit: [
          (mod) => {
            startupModule = mod || startupModule;
            logStartupHook("preInit", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
          },
        ],
        locateFile: (assetPath) => {
          const resolvedAssetPath = assetPath.endsWith(".wasm")
            ? resolvedWasmAssetUrl
            : this.deps.assets.resolveWasmAssetUrl(assetPath, runtimeVersion);
          logStartupHook("locateFile", startupModule, {
            assetPath,
            resolvedAssetPath,
          });
          return resolvedAssetPath;
        },
        stdin: () => this.deps.textInput.consumeStdinByte(),
        print: (...args) => {
          console.log("[WASM stdout]", ...args);
        },
        printErr: (...args) => {
          console.warn("[WASM stderr]", ...args);
        },
        quit: (status, toThrow) => {
          const exitCode = Number.isFinite(status) ? Number(status) : 0;
          const exitReason =
            toThrow && typeof toThrow === "object" && toThrow.message
              ? String(toThrow.message)
              : `Program terminated with exit(${exitCode})`;
          logStartupHook("quit", startupModule, {
            exitCode,
            exitReason,
          });

          this.deps.coordinator.emitRuntimeTerminated(exitReason, exitCode);

          if (toThrow) {
            throw toThrow; // Emscripten expects this exception to unwind its execution stack
          }
        },
        onExit: (status) => {
          const exitCode = Number.isFinite(status) ? Number(status) : 0;
          logStartupHook("onExit", startupModule, {
            exitCode,
          });

          this.deps.coordinator.emitRuntimeTerminated(
            `Program terminated with exit(${exitCode})`,
            exitCode,
          );
        },
        onAbort: (reason) => {
          const errorText =
            typeof reason === "string" && reason.trim()
              ? reason.trim()
              : String(reason ?? "Runtime aborted");
          logStartupHook("onAbort", startupModule, {
            reason: errorText,
          });
          this.deps.coordinator.emit({
            type: "runtime_error",
            error: errorText,
          });
        },
        monitorRunDependencies: (remainingDependencies) => {
          const normalizedRemaining = Number(remainingDependencies);
          if (normalizedRemaining === lastObservedRunDependencyCount) {
            return;
          }
          lastObservedRunDependencyCount = normalizedRemaining;
          logStartupHook("runDependencies", startupModule, {
            remainingDependencies: Number.isFinite(normalizedRemaining)
              ? normalizedRemaining
              : remainingDependencies,
          });
        },
        onRuntimeInitialized: () => {
          logStartupHook("onRuntimeInitialized", startupModule, {
            rootEntries: listDirectoryEntries(startupModule, "/"),
            saveEntries: listDirectoryEntries(startupModule, "/save"),
          });
        },
        preRun: [
          (mod) => {
            startupModule = mod || startupModule;
            logStartupHook("preRun:start", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
            this.configureRuntimePreRunEnvironment(mod, runtimeVersion, runtimeOptions, logStartupHook);
            this.installRuntimeSysconfInjection(mod);
            this.deps.persistence.installRuntimeStartupPersistence(mod, runtimeVersion, checkpointStartupOptionEnabled, logStartupHook, listDirectoryEntries);
            logStartupHook("preRun:complete", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
          },
        ],
        postRun: [
          (mod) => {
            startupModule = mod || startupModule;
            if (typeof mod?.__nh3dFlushRootPersistence === "function") {
              mod.__nh3dFlushRootPersistence("postRun", (error) => {
                if (error) {
                  console.warn("NetHack root persistence postRun flush failed:", error);
                }
              });
            }
            logStartupHook("postRun", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
            // Inject sysconf after WASM is fully initialized
            if (typeof (mod as any).__nh3dInjectSysconfCallback === "function") {
              try {
                (mod as any).__nh3dInjectSysconfCallback();
              } catch (err) {
                console.warn("⚠️ sysconf injection callback failed:", err);
              }
            }
          },
        ],
      });

      startupModule = this.deps.coordinator.nethackInstance;
      logStartupHook("module-ready", this.deps.coordinator.nethackInstance, {
        rootEntries: listDirectoryEntries(this.deps.coordinator.nethackInstance, "/"),
        saveEntries: listDirectoryEntries(this.deps.coordinator.nethackInstance, "/save"),
        hasMain: typeof this.deps.coordinator.nethackInstance?._main === "function",
        hasSetCallback:
          typeof this.deps.coordinator.nethackInstance?._shim_graphics_set_callback ===
          "function",
      });
      this.deps.coordinator.nethackModule = this.deps.coordinator.nethackInstance;
      this.deps.pointerContract.runtimePointerContract = null;
      this.deps.pointerContract.runtimePointerContractValidated = false;
      this.deps.recovery.updateCheckpointRecoverySupport();

      if (typeof this.deps.coordinator.nethackInstance.__nh3dHydrateRootPersistence === "function") {
        await new Promise((resolve) => {
          let settled = false;
          const settle = () => {
            if (settled) {
              return;
            }
            settled = true;
            resolve();
          };
          try {
            this.deps.coordinator.nethackInstance.__nh3dHydrateRootPersistence((hydrateError) => {
              if (hydrateError) {
                console.warn(
                  "NetHack root persistence restore failed:",
                  hydrateError,
                );
                logStartupHook("root-persistence-error", this.deps.coordinator.nethackInstance, {
                  error:
                    hydrateError instanceof Error && hydrateError.message
                      ? hydrateError.message
                      : String(hydrateError ?? ""),
                });
              } else {
                logStartupHook("root-persistence-hydrated", this.deps.coordinator.nethackInstance, {
                  rootEntries: listDirectoryEntries(this.deps.coordinator.nethackInstance, "/"),
                  saveEntries: listDirectoryEntries(this.deps.coordinator.nethackInstance, "/save"),
                });
              }
              settle();
            });
          } catch (error) {
            console.warn("NetHack root persistence restore threw:", error);
            logStartupHook("root-persistence-error", this.deps.coordinator.nethackInstance, {
              error:
                error instanceof Error && error.message
                  ? error.message
                  : String(error ?? ""),
            });
            settle();
          }
        });
      }
      this.registerRuntimeCallbackAndStartMain(logStartupHook, listDirectoryEntries);
    } catch (error) {
      console.error("Error initializing local NetHack:", error);
      throw error;
    }
  }

  installDefaultRuntimeGlobals(runtimeVersion) {

    if (!globalThis.nethackGlobal) {
      const runtimeWindowGlobals =
        this.deps.windows.getDefaultRuntimeWindowGlobals(runtimeVersion);
      globalThis.nethackGlobal = {
        constants: {
          WIN_TYPE: this.deps.windows.getRuntimeWindowTypeLabels(runtimeVersion),
          STATUS_FIELD: {},
          MENU_SELECT: { PICK_NONE: 0, PICK_ONE: 1, PICK_ANY: 2 },
        },
        helpers: {
          getPointerValue: (name, ptr, type) => {
            if (!this.deps.coordinator.nethackModule) {
              return ptr;
            }

            switch (type) {
              case "s":
                if (!ptr) return "";
                return this.deps.coordinator.nethackModule.UTF8ToString(ptr);
              case "p":
                if (!ptr) return 0;
                return this.deps.coordinator.nethackModule.getValue(ptr, "*");
              case "c":
                return String.fromCharCode(
                  this.deps.coordinator.nethackModule.getValue(ptr, "i8"),
                );
              case "b":
                return this.deps.coordinator.nethackModule.getValue(ptr, "i8") !== 0;
              case "0":
                return this.deps.coordinator.nethackModule.getValue(ptr, "i8");
              case "1":
                return this.deps.coordinator.nethackModule.getValue(ptr, "i16");
              case "2":
              case "i":
              case "n":
                return this.deps.coordinator.nethackModule.getValue(ptr, "i32");
              case "f":
                return this.deps.coordinator.nethackModule.getValue(ptr, "float");
              case "d":
                return this.deps.coordinator.nethackModule.getValue(ptr, "double");
              case "o":
                return ptr;
              default:
                return ptr;
            }
          },
          setPointerValue: (name, ptr, type, value = 0) => {
            if (!this.deps.coordinator.nethackModule) {
              return;
            }

            switch (type) {
              case "p":
                this.deps.coordinator.nethackModule.setValue(ptr, value, "*");
                break;
              case "s":
                this.deps.coordinator.nethackModule.stringToUTF8(String(value), ptr, 1024);
                break;
              case "i":
                this.deps.coordinator.nethackModule.setValue(ptr, value, "i32");
                break;
              case "1":
                this.deps.coordinator.nethackModule.setValue(ptr, value, "i16");
                break;
              case "c":
                this.deps.coordinator.nethackModule.setValue(ptr, value, "i8");
                break;
              case "b":
                this.deps.coordinator.nethackModule.setValue(ptr, value ? 1 : 0, "i8");
                break;
              case "f":
              case "d":
                this.deps.coordinator.nethackModule.setValue(ptr, value, "double");
                break;
              case "v":
                break;
              default:
                break;
            }
          },
        },
        globals: runtimeWindowGlobals,
      };
    }
  }

  configureRuntimePreRunEnvironment(mod, runtimeVersion, runtimeOptions, logStartupHook) {
    mod.ENV = mod.ENV || {};
    const existingOptions =
      typeof mod.ENV.NETHACKOPTIONS === "string"
        ? mod.ENV.NETHACKOPTIONS.trim()
        : "";
    mod.ENV.NETHACKOPTIONS = existingOptions
      ? `${existingOptions},${runtimeOptions.join(",")}`
      : runtimeOptions.join(",");
    this.deps.startupOptions.lastConfiguredNethackOptions = mod.ENV.NETHACKOPTIONS;
    console.log(`Configured NETHACKOPTIONS: ${mod.ENV.NETHACKOPTIONS}`);

    const terminalSymbolSetsFileState =
      ensureBundledTerminalSymbolSetsFile(mod, runtimeVersion);
    if (terminalSymbolSetsFileState === "created") {
      console.log(
        "Installed bundled IBMgraphics and DECgraphics symbol sets into /symbols",
      );
    }

    // Ensure NetHack chdirs into a valid data root inside the wasm FS.
    // If HACKDIR/NETHACKDIR points at a host path, main() will abort
    // before js_helpers_init/js_constants_init run.
    const fallbackHackDir = "/";
    if (!mod.ENV.HACKDIR) {
      mod.ENV.HACKDIR = fallbackHackDir;
    }
    if (!mod.ENV.NETHACKDIR) {
      mod.ENV.NETHACKDIR = fallbackHackDir;
    }
    const resolvedHackDir = mod.ENV.NETHACKDIR || mod.ENV.HACKDIR;
    logStartupHook("preRun:env-configured", mod, {
      resolvedHackDir,
      configuredNethackOptions: mod.ENV.NETHACKOPTIONS,
    });
    if (mod.FS && typeof mod.FS.analyzePath === "function") {
      const exists = mod.FS.analyzePath(resolvedHackDir).exists;
      if (!exists) {
        console.warn(
          `HACKDIR/NETHACKDIR does not exist in wasm FS: ${resolvedHackDir}`,
        );
      }
    }

    // Slash'EM 3.4.3 still uses Unix hard-link lock files.
    // Browser-backed FS implementations can reject link() with EMLINK,
    // so install a narrow fallback before startup touches perm_lock.
    this.deps.slashEmLocks.patchSlashEmLockLinkFallback(mod);
    logStartupHook("preRun:slash-em-lock-hook", mod, {
      lockFallbackInstalled: Boolean(
        mod.FS?.__nh3dSlashEmLockLinkFallbackPatched,
      ),
    });
  }

  installRuntimeSysconfInjection(mod) {

    // Inject sysconf to enable wizard mode after IDBFS is synced
    // Defer this to postRun to ensure FS is fully initialized
    const injectSysconfLater = () => {
      try {
        const sysconfPath = "/sysconf";
        const lines = [
          "# NetHack configuration for WASM",
          "WIZARDS=wizard",
          "CHECK_PLNAME=1",
          "EXPLORERS=*",
        ];
        const sysconfContent = lines.join("\n") + "\n";
        if (mod.FS && typeof mod.FS.writeFile === "function") {
          mod.FS.writeFile(sysconfPath, sysconfContent);
          console.log("✅ Injected sysconf with WIZARDS=wizard and CHECK_PLNAME=1");
        }
      } catch (err) {
        console.warn("⚠️ Failed to inject sysconf:", err);
      }
    };
    // Store for injection in postRun callback (after full initialization)
    (mod as any).__nh3dInjectSysconfCallback = injectSysconfLater;
  }

  registerRuntimeCallbackAndStartMain(logStartupHook, listDirectoryEntries) {

    // Register the UI callback and start the game loop
    const setCallback = this.deps.coordinator.nethackInstance.cwrap(
      "shim_graphics_set_callback",
      null,
      ["string"],
    );
    console.log("Registering shim callback", {
      callbackName: "nethackCallback",
      callbackType: typeof globalThis.nethackCallback,
    });
    setCallback("nethackCallback");
    console.log("shim_graphics_set_callback invoked");

    // NetHack's generated helper may reject "v" (void) arg types in
    // local_callback argument decoding (observed in shim_get_ext_cmd).
    // Treat those as a no-op value to avoid worker crashes.
    this.deps.memory.installHelperCompatibilityShims();
    this.deps.pointerContract.validateRuntimePointerContract();

    // Start the game — ASYNCIFY pauses/resumes at each async callback boundary.
    // Pass a valid argc/argv block instead of _main(0, 0) to avoid undefined
    // behavior in main() when it reads argv[0].
    this.deps.recovery.queueCheckpointAutosaveResumeBeforeStartup();
    const programName = "nethack";
    const argv0Ptr = this.deps.coordinator.nethackInstance._malloc(programName.length + 1);
    this.deps.coordinator.nethackInstance.stringToUTF8(
      programName,
      argv0Ptr,
      programName.length + 1,
    );
    const argvPtr = this.deps.coordinator.nethackInstance._malloc(8);
    this.deps.coordinator.nethackInstance.setValue(argvPtr, argv0Ptr, "*");
    this.deps.coordinator.nethackInstance.setValue(argvPtr + 4, 0, "*");
    logStartupHook("before-main", this.deps.coordinator.nethackInstance, {
      argc: 1,
      argv0: programName,
      rootEntries: listDirectoryEntries(this.deps.coordinator.nethackInstance, "/"),
      saveEntries: listDirectoryEntries(this.deps.coordinator.nethackInstance, "/save"),
    });
    const mainReturn = this.deps.coordinator.nethackInstance._main(1, argvPtr);
    const helperNamesAfterMain =
      globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? Object.keys(globalThis.nethackGlobal.helpers)
        : [];
    console.log("NetHack _main invoked", {
      returnValue: mainReturn,
      argc: 1,
      argv0: programName,
      helperCountAfterMain: helperNamesAfterMain.length,
      helperNamesSample: helperNamesAfterMain.slice(0, 12),
    });
    this.deps.startupDiagnostics.scheduleStartupNoCallbackDiagnostic();
  }
}
