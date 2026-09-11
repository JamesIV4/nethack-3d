// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeStartupConfiguration } from "../startup/startup-configuration";

export interface RuntimeStartupDiagnosticsDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "isClosed"
    | "runtimeVersion"
  >;
  readonly startupOptions: Pick<
    RuntimeStartupConfiguration,
    "lastConfiguredNethackOptions"
  >;
}

/** Startup callback progress and missing-callback diagnostics. */
export class RuntimeStartupDiagnostics {
  declare startupNoCallbackTimer: any;
  declare uiCallbackCount: number;

  constructor(private readonly deps: RuntimeStartupDiagnosticsDependencies) {
    this.uiCallbackCount = 0;
    this.startupNoCallbackTimer = null;
  }

  clearStartupNoCallbackTimer() {
    if (this.startupNoCallbackTimer !== null) {
      clearTimeout(this.startupNoCallbackTimer);
      this.startupNoCallbackTimer = null;
    }
  }

  scheduleStartupNoCallbackDiagnostic() {
    this.clearStartupNoCallbackTimer();
    if (this.uiCallbackCount > 0 || this.deps.coordinator.isClosed) {
      return;
    }
    this.startupNoCallbackTimer = setTimeout(() => {
      this.startupNoCallbackTimer = null;
      if (this.uiCallbackCount > 0 || this.deps.coordinator.isClosed) {
        return;
      }
      const helpers =
        globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
          ? globalThis.nethackGlobal.helpers
          : null;
      const globals =
        globalThis.nethackGlobal && globalThis.nethackGlobal.globals
          ? globalThis.nethackGlobal.globals
          : null;
      const helperNames = helpers ? Object.keys(helpers) : [];
      const windowInited =
        globals &&
          globals.iflags &&
          typeof globals.iflags.window_inited !== "undefined"
          ? globals.iflags.window_inited
          : null;

      console.warn(
        "No shim UI callbacks received after startup. Runtime may be using a non-shim window port (for example tty), or callback wiring is broken.",
      );
      console.warn("Startup diagnostics:", {
        runtimeVersion: this.deps.coordinator.runtimeVersion,
        configuredNethackOptions: this.deps.startupOptions.lastConfiguredNethackOptions,
        helperCount: helperNames.length,
        helperNamesSample: helperNames.slice(0, 12),
        windowInited,
      });
    }, 3000);
  }
}
