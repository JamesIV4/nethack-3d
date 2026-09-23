# NetHack 5 upstream update — September 23, 2026

The WSL package checkout is `/home/james/Repos/forked/neth4ck-monorepo`, on
`forked-367-37-5`. Its nested `packages/wasm-5/NetHack` source checkout is on
`forked-wasm-5`; these are branches in separate repositories.

## Source update

- Previous source: `1bf23b861c9b3c5d0faea883c46cf4501806425e`.
- Official upstream: `NetHack/NetHack`, branch `NetHack-5.0`, commit
  `f3fc8537a47331578fe6ba67a7949fe46d1486a8` (September 23, 2026).
- Local source HEAD: `e76b93423a3dd4432e2a46bc47066a8ba529f468`, incorporating
  596 upstream commits and preserving the existing NetHack 3D integration.
  The initial merge was `6992ec32c9c96dee8773f19ef314c92374a1ae4e`; the final
  fetch added a README change and its revert, with no net source changes.
- Recovery branch in the source repository:
  `backup/wasm-5-before-upstream-20260923`.

The only merge conflict was in `sys/unix/hints/include/cross-pre2.500`.
The resolution retains the custom `tile.o` window object and upstream's empty
`UUIDOBJ` override. The callback bridge, checkpoint helpers, and unlimited
score support remain present.

Built with the existing `packages/wasm-5/build-wasm.sh` and WSL Emscripten SDK.
The matching build outputs were copied to `public/nethack-5.js` and
`public/nethack-5.wasm`. Other game variants were not replaced.

Upstream now exports `GLYPH_PILETOP_OFF`. The catalog generator splits that
range into object, corpse, and statue ranges and validates their sizes.
Vulture identity lookup now handles multiple ranges for the same kind,
including ordinary and pile-top objects with randomized appearances.
The NetHack 5 glyph catalog was regenerated from the new artifacts.

## Validation

- Native WASM build completed successfully.
- NetHack 5 package smoke tests: 17 passed.
- Native callback and glyph-range checks: 12 passed.
- Client suite: 919 tests passed in 139 files.
- TypeScript check passed.
- Updated JS syntax and WASM compilation checks passed.
- NetHack 5 catalog regeneration is deterministic and matches the checked-in file.
- A Node harness started a fresh game, rendered dungeon glyphs, accepted input,
  saved, restored that save in a separate process, and saved again.
- Both public artifacts are byte-identical to the WSL package build outputs.

This validates saves created by the updated runtime, not migration of older
saves. Browser and headset interaction were not tested. The all-variant glyph
check stalled while initializing the unchanged 3.6.7 runtime and was stopped;
NetHack 5 was checked directly instead.

| Artifact | SHA-256 |
| --- | --- |
| `public/nethack-5.js` | `62af4ecf38d024ae94edeca7c2d483fe3e3455c40c2e9085317397644b052c52` |
| `public/nethack-5.wasm` | `ec08721fb0a0ddb2f7724ba5a641e07264e635c4caf6c6f864305c9e2307625a` |

The source merge is committed locally. The parent package checkout retains the
updated submodule pointer and build outputs as working-tree changes. The game
repository changes are also uncommitted. Nothing was pushed.
