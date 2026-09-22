export const XR_STICK_PREVIEW_DEADZONE = .05;
export const XR_STICK_MOVE_DEADZONE = .30;
export const XR_HEADSET_RECLAIM_ANGLE = Math.PI / 6;
type Tile = {x:number;y:number};
type Direction = {dx:number;dy:number};
type Look = {x:number;y:number;z:number};

/** The last deliberate input owns highlighting; walking alone never selects the laser. */
export class MovementPreview {
  private stick: Direction | null = null;
  private relativeLaser: Tile | null = null;
  private owner: "headset" | "laser" = "laser";
  private laserLook: Look | null = null;
  get source(): "headset" | "laser" { return this.owner; }
  useHeadset(): void {
    this.owner="headset";
    this.laserLook=null;
    // A snap turn moves the ray in grid space without deliberate laser aiming.
    // Establish a fresh settled, player-relative reference before switching back.
    this.relativeLaser=null;
  }
  useLaser(): void {
    if (this.owner !== "laser") this.laserLook=null;
    this.owner="laser";
  }
  resolve(player: Tile, stick: Direction | null, laser: Tile | null, headset: Tile | null, settled = true, look?: Look): Tile | null {
    const newStick = !!stick && !this.stick;
    this.stick = stick;
    const length=look ? Math.hypot(look.x,look.y,look.z) : 0;
    const direction=look && Number.isFinite(length) && length>1e-6 ? {x:look.x/length,y:look.y/length,z:look.z/length} : null;
    const headMoved=this.owner === "laser" && direction && this.laserLook &&
      direction.x*this.laserLook.x+direction.y*this.laserLook.y+direction.z*this.laserLook.z <= Math.cos(XR_HEADSET_RECLAIM_ANGLE)+1e-9;
    const relative = laser ? {x:laser.x-player.x,y:laser.y-player.y} : null;
    if (newStick || headMoved) { this.owner = "headset";this.laserLook=null; }
    // During camera-follow interpolation, the ray can briefly hit the old cell.
    // Compare settled offsets so that this does not look like a deliberate aim change.
    if (settled && relative) {
      if (!newStick && !headMoved && this.owner === "headset" && this.relativeLaser &&
          (relative.x !== this.relativeLaser.x || relative.y !== this.relativeLaser.y)) this.useLaser();
      this.relativeLaser = relative;
    }
    if (this.owner === "laser" && !this.laserLook && direction) this.laserLook=direction;
    return this.owner === "headset" ? headset : laser;
  }
  reset(): void { this.stick=null;this.relativeLaser=null;this.owner="laser";this.laserLook=null; }
}
