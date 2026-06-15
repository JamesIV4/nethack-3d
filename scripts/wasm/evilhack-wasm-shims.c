/* ===== More WASM stubs for TTY/SLASH'EM congruence (continued) ===== */
void backsp(void) {}
void term_start_bgcolor(int color) { (void)color; }
void term_start_raw_bold(void) {}
void term_end_raw_bold(void) {}
int term_attr_fixup(int attr) { (void)attr; return 0; }
int tty_yn_function(const char *q, const char *c, char d) { (void)q; (void)c; (void)d; return 0; }
int tty_get_ext_cmd(void) { return -1; }
void tty_number_pad(int n) { (void)n; }
void tty_delay_output(void) {}
void tty_start_screen(void) {}
void tty_end_screen(void) {}
char *tty_getmsghistory(int b) { (void)b; return (char *)0; }
void tty_putmsghistory(char *s, int b) { (void)s; (void)b; }
/* ===== More WASM stubs for TTY/SLASH'EM congruence ===== */
void tty_shutdown(void) {}
void standoutbeg(void) {}
void standoutend(void) {}
void xputs(const char *s) { (void)s; }
void xwaitforspace(const char *s) { (void)s; }
void term_start_color(int color) { (void)color; }
void tty_getlin(const char *q, char *b) { if (b) *b = 0; (void)q; }
void tty_nhbell(void) {}
int tty_doprev_message(void) { return 0; }
/* evilhack-wasm-shims.c
 * Stub implementations for EvilHack WASM build
 * These provide minimal implementations of Unix-specific functions
 * that aren't available in WebAssembly environments
 * 
 * IMPORTANT: EvilHack already defines:
 *   - error() -- actually in sys/share/unixtty.c (NOT compiled in WASM build)
 *   - sethanguphandler() -- in sys/unix/unixmain.c (NOT compiled in WASM build)
 *   - sys_random_seed() -- in sys/unix/unixmain.c (NOT compiled in WASM build)
 *
 * All three are now stubbed below since their platform files are not included.
 * These stubs replace what would normally come from the Unix platform layer.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Note: Regex functions (regex_init, regex_free, etc.) are provided by posixregex.c
 * so we don't stub them here. This file handles other Unix-specific functions only. */

/* ===== System functions (Unix-specific, not defined by EvilHack. Defined in unixmain.c) ===== */


void more(void) {
    /* no-op - paging handled by UI */
}

/* ===== TTY/termcap stubs for WASM (no-op, see SLASH'EM WASM) ===== */

void tty_startup(int *wid, int *hgt) {
    if (wid) *wid = 80;
    if (hgt) *hgt = 24;
}



void home(void) {}
void cl_end(void) {}
void clear_screen(void) {}
void cl_eos(void) {}
void term_start_attr(int attr) {(void)attr;}
void term_end_attr(int attr) {(void)attr;}

/* ===== End stubs ===== */

/* ===== Additional WASM stubs and globals for missing symbols (SLASH'EM style) ===== */

/* restore_savefile: not needed in WASM, provide no-op stub */
int restore_savefile(char *lock, const char *saveprefix) {
    (void)lock; (void)saveprefix;
    return 0;
}

/* ospeed: global terminal speed variable */
short ospeed = 0;

/* tc_lcl_data: dummy struct for tcap.h compatibility */
struct tc_lcl_data { int dummy; } tc_lcl_data;

/* cmov/nocmov: cursor movement stubs */
void cmov(int x, int y) { (void)x; (void)y; }
void nocmov(int x, int y) { (void)x; (void)y; }

/* topline functions and morc global (for wintty.c linkage) */
char morc = 0;
void addtopl(const char *s) { (void)s; }
void update_topl(const char *s) { (void)s; }
void remember_topl(void) {}
void show_topl(const char *s) { (void)s; }

/* graph_on/off and term_end_color stubs */
void graph_on(void) {}
void graph_off(void) {}
void term_end_color(void) {}

/* ===== System-level WASM stubs (platform-specific, not in WASM) ===== */

/* sethanguphandler and sys_random_seed: provided by sys/unix/unixmain.c now
 * that unixmain.c is in the EvilHack 0.9.3 SYSSRC. Stubs intentionally removed
 * to avoid duplicate-symbol link errors. */

/* introff/intron: keyboard interrupt enable/disable, no-op in WASM */
void introff(void) {}
void intron(void) {}

/* error: fatal error handler - print and abort */
#include <stdarg.h>
void error(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    vfprintf(stderr, fmt, args);
    va_end(args);
    fprintf(stderr, "\n");
    abort();
}

/* bot_set_handler: EvilHack-0.9.2 WASM extension for status bar bridging.
 * The vanilla EvilHack source does not have this function; provide a no-op.
 * Status updates will still work via the shim_status_update callback. */
void bot_set_handler(void (*fn)()) { (void)fn; }

/* ===== Missing WASM stubs (linker pass) ===== */
#include "hack.h"

/* check_user_string: provided by unixmain.o now that unixmain.c is in SYSSRC. */

/* dosh / dosuspend / regularize: provided by unixunix.o + ioctl.o now that
 * those compilation units are part of the EvilHack 0.9.3 build. Keeping them
 * here would cause "duplicate symbol" link errors. Stubs intentionally removed.
 */

/* tty_procs: dummy TTY window_procs struct (windows.c may reference it even
 * when TTY_GRAPHICS is undefined, depending on compile order) */
struct window_procs tty_procs = {
    "tty",
    0L, 0L,
    {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
};

/* win_tty_init: TTY window system init, no-op in WASM */
void win_tty_init(int dir) { (void)dir; }
