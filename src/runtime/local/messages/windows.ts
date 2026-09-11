// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";

export interface RuntimeWindowsDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "runtimeVersion"
  >;
}

/** Runtime-specific window identifiers and classification. */
export class RuntimeWindows {

  constructor(private readonly deps: RuntimeWindowsDependencies) {}

  getDefaultRuntimeWindowGlobals(runtimeVersion = this.deps.coordinator.runtimeVersion) {
    return {
      WIN_MESSAGE: 1,
      WIN_STATUS: 2,
      WIN_MAP: 3,
      WIN_INVEN: 4,
    };
  }

  getRuntimeWindowGlobals() {
    const defaults = this.getDefaultRuntimeWindowGlobals(this.deps.coordinator.runtimeVersion);
    const globals =
      globalThis.nethackGlobal &&
        globalThis.nethackGlobal.globals &&
        typeof globalThis.nethackGlobal.globals === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals) {
      return defaults;
    }

    const merged = { ...defaults };
    for (const [name, fallback] of Object.entries(defaults)) {
      const candidate = Number(globals[name]);
      if (Number.isInteger(candidate)) {
        merged[name] = candidate;
      } else if (Number.isInteger(fallback)) {
        merged[name] = fallback;
      }
    }
    return merged;
  }

  getRuntimeWindowTypeLabels(runtimeVersion = this.deps.coordinator.runtimeVersion) {
    const globals = this.getDefaultRuntimeWindowGlobals(runtimeVersion);
    return Object.fromEntries(
      Object.entries(globals).map(([name, id]) => [id, name]),
    );
  }

  getRuntimeWindowId(name) {
    const globals = this.getRuntimeWindowGlobals();
    const candidate = Number(globals?.[name]);
    if (Number.isInteger(candidate)) {
      return candidate;
    }
    const fallback = Number(
      this.getDefaultRuntimeWindowGlobals(this.deps.coordinator.runtimeVersion)?.[name],
    );
    return Number.isInteger(fallback) ? fallback : null;
  }

  isMessageWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_MESSAGE");
  }

  isStatusWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_STATUS");
  }

  shouldSuppressRedundantStatusWindowText(winId) {
    return this.deps.coordinator.runtimeVersion === "slashem" && this.isStatusWindow(winId);
  }

  isMapWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_MAP");
  }

  isInventoryWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_INVEN");
  }
}
