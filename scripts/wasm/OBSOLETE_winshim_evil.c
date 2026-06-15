/*
 * winshim_evil.c - EvilHack WASM/JS window and runtime shim
 *
 * This file provides the WASM/JS bridge for EvilHack, analogous to NetHack 3.6.7 and SLASHEM WASM shims.
 * It exports all required hack_* entrypoints, window system glue, and JS callback routing for browser integration.
 *
 * Adapted from winshim_367.c and SLASHEM WASM shims.
 */

#include "hack.h"
#include <string.h>
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif
#include <stdlib.h>

// Debug macro
#ifdef SHIM_DEBUG
#define debugf printf
#else
#define debugf(...)
#endif

// JS callback routing (copied/adapted from winshim_367.c)
static char *shim_callback_name = NULL;
void shim_graphics_set_callback(char *cbName) {
    if (shim_callback_name != NULL) free(shim_callback_name);
    if(cbName && strlen(cbName) > 0) {
        debugf("setting shim_callback_name: %s\n", cbName);
        shim_callback_name = strdup(cbName);
    } else {
        debugf("un-setting shim_callback_name\n");
        shim_callback_name = NULL;
    }
}

#ifdef __EMSCRIPTEN__
EM_JS(void, local_callback, (const char *cb_name, const char *shim_name, void *ret_ptr, const char *fmt_str, void *args), {
    // See winshim_367.c for full implementation details
    // This is a placeholder for Asyncify/JS callback integration
});
#endif

// Macro helpers for callback boilerplate (from winshim_367.c)
#define A2P &
#define P2V (void *)
#define DECLCB(ret_type, name, fn_args, fmt, ...) \
ret_type name fn_args; \
ret_type name fn_args { \
    void *args[] = { __VA_ARGS__ }; \
    ret_type ret = (ret_type) 0; \
    debugf("SHIM GRAPHICS: " #name "\n"); \
    if (!shim_callback_name) return ret; \
    local_callback(shim_callback_name, #name, (void *)&ret, fmt, args); \
    debugf("SHIM GRAPHICS: " #name " done.\n"); \
    return ret; \
}
#define VDECLCB(name, fn_args, fmt, ...) \
void name fn_args; \
void name fn_args { \
    void *args[] = { __VA_ARGS__ }; \
    debugf("SHIM GRAPHICS: " #name "\n"); \
    if (!shim_callback_name) return; \
    local_callback(shim_callback_name, #name, NULL, fmt, args); \
    debugf("SHIM GRAPHICS: " #name " done.\n"); \
}


// ===== WASM/JS Entry Points (exported, NetHack3D/EvilHack integration) =====

// Game lifecycle and event entrypoints
int hack_init(void) { /* TODO: Initialize EvilHack game state */ return 0; }
int hack_exit(void) { /* TODO: Clean up EvilHack state */ return 0; }
int hack_tick(void) { /* TODO: Advance game by one tick/turn */ return 0; }
int hack_key(int key, int mod) { /* TODO: Inject key event */ return 0; }
int hack_mouse(int x, int y, int button, int mod) { /* TODO: Inject mouse event */ return 0; }
int hack_resize(int w, int h) { /* TODO: Handle window resize */ return 0; }
int hack_clipboard(const char* str) { /* TODO: Clipboard integration */ return 0; }
int hack_debug(int code, int val) { /* TODO: Debug hooks */ return 0; }

// Save/restore entrypoints (stubbed, to be mapped to EvilHack logic)
int hack_save(void) { /* TODO: Call EvilHack's dosave or equivalent */ return 0; }
int hack_restore(void) { /* TODO: Call EvilHack's dorestore or equivalent */ return 0; }

// NetHack3D-specific runtime entrypoints (stubbed)
int nh_wasm_init(void) { /* TODO: WASM-specific game init */ return 0; }
int nh3d_glyph_at(int x, int y) { /* TODO: Return glyph at (x, y) */ return 0; }
int nh_top_item_glyph_under_player(void) { /* TODO: Return top item glyph under player */ return 0; }
int recover_savefile(void) { /* TODO: Recover from checkpoint save */ return 0; }
int resume_checkpoint_save(void) { /* TODO: Resume from checkpoint save */ return 0; }

// Add more window system glue and callback wrappers as needed, following winshim_367.c and SLASHEM WASM shims

// End of winshim_evil.c
