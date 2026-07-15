export type Nh3dConstrainedTilesetMode = "ascii" | "tiles" | "terminal";

export function constrainFpsModeForTilesetMode(
  fpsMode: boolean,
  tilesetMode: Nh3dConstrainedTilesetMode,
): boolean {
  return tilesetMode === "terminal" ? false : fpsMode;
}
