import type { NethackRuntimeVersion, RuntimeEvent } from "../types";

export const runtimeProtocolVersion = 1 as const;
export interface RuntimeLevelIdentity { dnum: number; dlevel: number }
export interface RuntimeObservationScope {
  presentationGeneration: number;
  levelGeneration: number;
  level: RuntimeLevelIdentity | null;
}
export type RuntimeBoundary = "task" | "size" | "control" | "map-display" | "status-flush" |
  "input-wait" | "snapshot-complete" | "presentation-reset" | "level-change" | "shutdown";
export interface RuntimeEventBatch {
  type: "runtime_events";
  protocolVersion: typeof runtimeProtocolVersion;
  sessionId: string;
  batchId: number;
  sequenceStart: number;
  sequenceEnd: number;
  scope: RuntimeObservationScope;
  boundary: RuntimeBoundary;
  events: RuntimeEvent[];
}
export interface RuntimeProtocolHandshake {
  protocolVersion: typeof runtimeProtocolVersion;
  sessionId: string;
  runtimeVersion: NethackRuntimeVersion;
  artifactTag: string | null;
  pointerAbi: string;
  pointerAbiValidated: boolean;
  mapDimensions: { columns: number; rows: number } | null;
  capabilities: {
    orderedBatches: true;
    refreshSets: boolean;
    inputRequestIdentity: boolean;
    synchronousGlyphCallbacks: boolean;
    glyphQuery: boolean;
    floorQuery: boolean;
    underPlayerItemQuery: boolean;
  };
}
export interface RuntimeCell { x: number; y: number }
export interface RuntimeRefreshOptions { includeUnderPlayer?: boolean }
export type RuntimeRefreshStatus = "fresh" | "cached" | "deferred" | "unavailable" | "failed" | "cancelled";
export interface RuntimeRefreshCellResult extends RuntimeCell { status: RuntimeRefreshStatus; cached?: boolean }
export interface RuntimeRefreshResult extends RuntimeEvent {
  type: "refresh_result";
  requestId: number;
  complete: boolean;
  observedThroughSequence?: number;
  cells: RuntimeRefreshCellResult[];
}
export type RuntimeInputPurpose = "command-or-position" | "question" | "menu" | "text" | "extended-command" | "unknown";
export interface RuntimeInputWaitEvent extends RuntimeEvent {
  type: "input_wait";
  requestId: number;
  callback: string;
  purpose: RuntimeInputPurpose;
  state: "waiting" | "consumed" | "cancelled";
}
export interface RuntimeCommandIdentity {
  sessionId: string;
  commandId: number;
  lastProcessedSequence: number;
  requestId?: number;
}
