# SLASHEM WASM Export Mapping

This table documents the mapping between the obfuscated WASM export keys and the JavaScript property names used in the SLASHEM JS glue code. This mapping is critical for correct WASM/JS interop in the NetHack-3D project.

| WASM Export Key | JS Name (Module property)                | Description / Notes                |
|----------------|------------------------------------------|------------------------------------|
| H              | memory                                   | WASM memory                        |
| I              |                                          | WASM constructors                  |
| J              | _malloc                                  | malloc function                    |
| K              | __indirect_function_table                | Indirect function table            |
| L              | _free                                    | free function                      |
| M              | _recover_savefile                        | recover savefile                   |
| N              | _mapglyph                                | mapglyph function                  |
| O              | _glyph_to_tile                           | glyph to tile                      |
| P              | _nh3d_glyph_at                           | glyph at                           |
| Q              | _nh_top_item_glyph_under_player          | top item glyph under player        |
| R              | _main                                    | main entry point                   |
| S              | _resume_checkpoint_save                  | resume checkpoint save             |
| T              | _shim_graphics_set_callback              | graphics callback                  |
| U              | __emscripten_stack_restore               | stack restore                      |
| V              | __emscripten_stack_alloc                 | stack alloc                        |
| W              | _emscripten_stack_get_current            | stack get current                  |
| X              | dynCall_i                                | dynamic call i                     |
| Y              | dynCall_ii                               | dynamic call ii                    |
| Z              | dynCall_iiii                             | dynamic call iiii                  |
| _              | dynCall_iii                              | dynamic call iii                   |
| $              | dynCall_viii                             | dynamic call viii                  |
| aa             | dynCall_vi                               | dynamic call vi                    |
| ba             | dynCall_vii                              | dynamic call vii                   |
| ca             | dynCall_v                                | dynamic call v                     |
| da             | dynCall_viiiiiiii                        | dynamic call viiiiiiii             |
| ea             | dynCall_viiii                            | dynamic call viiii                 |
| fa             | dynCall_jiji                             | dynamic call jiji                  |
| ga             | dynCall_iidiiii                          | dynamic call iidiiii               |
| ha             | _asyncify_start_unwind                   | asyncify start unwind              |
| ia             | _asyncify_stop_unwind                    | asyncify stop unwind               |
| ja             | _asyncify_start_rewind                   | asyncify start rewind              |
| ka             | _asyncify_stop_rewind                    | asyncify stop rewind               |

This mapping is used in the SLASHEM WASM build and glue code. If you change the Emscripten minification or export settings, update this table accordingly.
