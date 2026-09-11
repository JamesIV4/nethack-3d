import type LocalNetHackRuntime from "../LocalNetHackRuntime";

/** Root lifecycle state and operations used by the runtime owners. */
export type RuntimeCoordinator = Pick<
  LocalNetHackRuntime,
  "emit"
  | "emitRuntimeTerminated"
  | "eventHandler"
  | "handleUICallback"
  | "isClosed"
  | "nethackInstance"
  | "nethackModule"
  | "runtimeSourceUrl"
  | "runtimeTerminationEmitted"
  | "runtimeVersion"
  | "startupOptions"
>;
