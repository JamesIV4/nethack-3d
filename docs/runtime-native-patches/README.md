# Applied native callback bridge patches

These review patches were generated before WSL source modification and then applied with user authorization. They are retained to make the small upstream integration delta easy to review.

| Patch | Applied commit |
| --- | --- |
| `367.patch` | NetHack 3.6.7 `692645376` |
| `5.patch` | NetHack 5.0 `1bf23b861` |
| `slashem.patch` | SLASH’EM `1d0efa3` |

The NetHack monorepo records the two updated submodule pointers in `555f43f`. Generated JavaScript and WASM artifacts are intentionally absent from these patches.
