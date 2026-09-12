export interface SourcePoint {
  x: number;
  y: number;
}

export interface SourceBounds {
  width: number;
  height: number;
}

/** Convert a Three.js plane hit into a browser viewport position in CSS pixels. */
export function uvToSourcePoint(
  uv: { x: number; y: number } | null | undefined,
  bounds: SourceBounds | null | undefined,
): SourcePoint | null {
  if (
    !uv ||
    !bounds ||
    !Number.isFinite(uv.x) ||
    !Number.isFinite(uv.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width < 1 ||
    bounds.height < 1
  ) {
    return null;
  }

  // The plane's V axis points up; browser Y points down. Keep edge hits inside
  // the source viewport so a release cannot land just beyond its last pixel.
  return {
    x: Math.max(0, Math.min(bounds.width - 1, uv.x * bounds.width)),
    y: Math.max(0, Math.min(bounds.height - 1, (1 - uv.y) * bounds.height)),
  };
}

/** Owns the one source mouse pointer while either XR controller is dragging. */
export class SinglePointerOwner {
  private owner: string | null = null;

  get activeOwner(): string | null {
    return this.owner;
  }

  claim(owner: string): boolean {
    if (this.owner !== null && this.owner !== owner) {
      return false;
    }
    this.owner = owner;
    return true;
  }

  owns(owner: string): boolean {
    return this.owner === owner;
  }

  // Call on selectend even when its ray no longer intersects the panel. Source
  // mouse-up should use the last valid position when the release has no hit.
  release(owner: string): boolean {
    if (!this.owns(owner)) {
      return false;
    }
    this.owner = null;
    return true;
  }

  // Session teardown cancels every drag. For one controller disconnecting, use
  // release(controllerId) so it cannot interrupt the other controller's drag.
  cancel(): string | null {
    const previousOwner = this.owner;
    this.owner = null;
    return previousOwner;
  }
}
