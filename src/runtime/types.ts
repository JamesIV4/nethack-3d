export type RuntimeEvent = {
  type: string;
  [key: string]: unknown;
};

export type RuntimeEventHandler = (event: RuntimeEvent) => void;

export type NethackRuntimeVersion = "3.6.7" | "5.0" | "slashem";

export interface RuntimeBridge {
  start(): Promise<void>;
  sendInput(input: string, options?: { delayMs?: number }): void;
  sendInputSequence(inputs: string[], options?: { delayMs?: number }): void;
  sendMouseInput(x: number, y: number, button: number): void;
  requestTileUpdate(x: number, y: number): void;
  requestAreaUpdate(centerX: number, centerY: number, radius: number): void;
  requestRuntimeGlobalsSnapshot(): void;
  setLoggingEnabled(enabled: boolean): void;
  dispose(): void;
}

export type RuntimeCharacterCreationConfig = {
  mode: "random" | "create" | "resume";
  name?: string;
  role?: string;
  race?: string;
  gender?: string;
  align?: string;
  resumeCategory?: "manual" | "autosave";
};

export type RuntimeStartupOptions = {
  runtimeVersion?: NethackRuntimeVersion;
  characterCreation?: RuntimeCharacterCreationConfig;
  initOptions?: string[];
  loggingEnabled?: boolean;
};

export type RuntimeCommand =
  | { type: "start"; startupOptions?: RuntimeStartupOptions }
  | { type: "send_input"; input: string }
  | { type: "send_input_sequence"; inputs: string[] }
  | { type: "send_mouse_input"; x: number; y: number; button: number }
  | { type: "request_tile_update"; x: number; y: number }
  | {
      type: "request_area_update";
      centerX: number;
      centerY: number;
      radius: number;
    }
  | { type: "request_runtime_globals_snapshot" }
  | { type: "set_logging"; enabled: boolean }
  | { type: "shutdown" };

export type RuntimeWorkerEnvelope =
  | { type: "runtime_event"; event: RuntimeEvent }
  | { type: "runtime_ready" }
  | { type: "runtime_error"; error: string }
  | {
      type: "runtime_console";
      level: "log" | "info" | "warn" | "error" | "debug" | "trace" | "assert";
      source: string;
      args: unknown[];
    };
