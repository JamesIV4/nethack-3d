/** Some XR runtimes timestamp frames from session start; game effects use performance.now(). */
export function gameFrameTime(animationTime: number, xrPresenting: boolean, now: number): number {
  return xrPresenting ? now : animationTime;
}
