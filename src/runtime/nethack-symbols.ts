import type { NethackRuntimeVersion } from "./types";

// The WASM builds do not currently embed NetHack's dat/symbols file. Keep the
// two symbol sets exposed by the startup UI here, using the definitions from
// NetHack 3.6.7's canonical dat/symbols file. String.raw preserves the byte
// escape syntax for NetHack's own parser.
export const bundledTerminalSymbolSets = String.raw`# NetHack 3.6 symbol sets bundled for the WASM runtime
start: IBMgraphics
Description: special line-drawing characters used for walls
Restrictions: primary
Handling: IBM
S_vwall: \xb3
S_hwall: \xc4
S_tlcorn: \xda
S_trcorn: \xbf
S_blcorn: \xc0
S_brcorn: \xd9
S_crwall: \xc5
S_tuwall: \xc1
S_tdwall: \xc2
S_tlwall: \xb4
S_trwall: \xc3
S_ndoor: \xfa
S_vodoor: \xfe
S_hodoor: \xfe
S_bars: \xf0
S_tree: \xf1
S_room: \xfa
S_corr: \xb0
S_litcorr: \xb1
S_fountain: \xf4
S_pool: \xf7
S_ice: \xfa
S_lava: \xf7
S_vodbridge: \xfa
S_hodbridge: \xfa
S_water: \xf7
S_vbeam: \xb3
S_hbeam: \xc4
S_sw_ml: \xb3
S_sw_mr: \xb3
S_explode4: \xb3
S_explode6: \xb3
finish

start: DECgraphics
Description: special line-drawing characters used for walls
Restrictions: primary
Handling: DEC
S_vwall: \xf8
S_hwall: \xf1
S_tlcorn: \xec
S_trcorn: \xeb
S_blcorn: \xed
S_brcorn: \xea
S_crwall: \xee
S_tuwall: \xf6
S_tdwall: \xf7
S_tlwall: \xf5
S_trwall: \xf4
S_ndoor: \xfe
S_vodoor: \xe1
S_hodoor: \xe1
S_bars: \xfc
S_tree: \xe7
S_room: \xfe
S_upladder: \xf9
S_dnladder: \xfa
S_altar: \xfb
S_pool: \xe0
S_ice: \xfe
S_lava: \xe0
S_vodbridge: \xfe
S_hodbridge: \xfe
S_water: \xe0
S_vbeam: \xf8
S_hbeam: \xf1
S_sw_tc: \xef
S_sw_ml: \xf8
S_sw_mr: \xf8
S_sw_bc: \xf3
S_explode2: \xef
S_explode4: \xf8
S_explode6: \xf8
S_explode8: \xf3
finish
`;

type RuntimeFileSystem = {
  analyzePath(path: string): { exists?: boolean } | null | undefined;
  writeFile(path: string, contents: string): void;
};

type RuntimeModuleWithFileSystem = {
  FS?: Partial<RuntimeFileSystem> | null;
};

export function ensureBundledTerminalSymbolSetsFile(
  runtimeModule: RuntimeModuleWithFileSystem,
  runtimeVersion: NethackRuntimeVersion,
): "created" | "present" | "unsupported" {
  if (runtimeVersion !== "3.6.7" && runtimeVersion !== "5.0") {
    return "unsupported";
  }

  const fs = runtimeModule?.FS;
  if (
    !fs ||
    typeof fs.analyzePath !== "function" ||
    typeof fs.writeFile !== "function"
  ) {
    return "unsupported";
  }

  if (fs.analyzePath("/symbols")?.exists) {
    return "present";
  }

  fs.writeFile("/symbols", bundledTerminalSymbolSets);
  return "created";
}
