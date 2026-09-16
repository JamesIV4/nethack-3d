/** The dungeon's cardinal and diagonal directions. */
export const GRID_UI_HEADING_STEP = Math.PI / 4;

export function wrapUiHeading(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Rounds a game-space yaw to the nearest dungeon-grid direction. */
export function snapGridUiHeading(gameYaw: number): number {
  return wrapUiHeading(Math.round(gameYaw / GRID_UI_HEADING_STEP) * GRID_UI_HEADING_STEP);
}

/**
 * Converts tracked-head yaw into the FPS game's yaw convention before snapping.
 *
 * `recenterTrackingYaw` is the yaw recorded into WebXrPresentation.heading at
 * recenter. `viewYaw` is the game's snap-turn/auto-turn offset.  Cancelling
 * the recenter tracking axis makes the HUD follow the dungeon grid instead of
 * the room's arbitrary physical axis.
 */
export function gridUiGameYaw(
  trackingYaw: number,
  recenterTrackingYaw: number,
  viewYaw: number,
): number {
  return snapGridUiHeading(Math.PI - trackingYaw + recenterTrackingYaw + viewYaw);
}

/**
 * Returns the tracking-space yaw consumed by HtmlUiPanel/native transport.
 * The selected grid direction is converted back so native placement stays in
 * tracking coordinates while representing a dungeon-aligned game direction.
 */
export function gridUiHeading(
  trackingYaw: number,
  recenterTrackingYaw: number,
  viewYaw: number,
): number {
  const gameYaw = gridUiGameYaw(trackingYaw, recenterTrackingYaw, viewYaw);
  return wrapUiHeading(Math.PI + recenterTrackingYaw + viewYaw - gameYaw);
}
