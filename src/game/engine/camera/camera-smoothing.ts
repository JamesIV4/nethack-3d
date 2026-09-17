/** Shared follow response, matching the heavier VR tabletop movement. */
export const CAMERA_FOLLOW_HALF_LIFE_MS = 500;

export function cameraFollowAlpha(elapsedMs: number, halfLifeMs = CAMERA_FOLLOW_HALF_LIFE_MS): number {
  return 1 - Math.exp((-Math.LN2 * Math.max(0, elapsedMs)) / halfLifeMs);
}
