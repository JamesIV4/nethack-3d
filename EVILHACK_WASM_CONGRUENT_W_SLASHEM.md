# EvilHack WASM: Congruence with SLASH'EM WASM Build

This document describes the changes and stubbing strategy used in the EvilHack WASM build to match the successful approach used by SLASH'EM's WASM port. This ensures compatibility and resolves linker errors for symbols not needed or not available in the WebAssembly environment.

## Key Changes and Stubs

### 1. Excluded Platform-Specific Source Files
- `win/tty/termcap.c` is excluded from the WASM build because it depends on `<term.h>`, which is not available in Emscripten.

### 2. WASM Shims for Missing Symbols
The following stubs and globals are provided in `scripts/wasm/evilhack-wasm-shims.c`:

- **restore_savefile**: Provided as a no-op stub, since savefile restoration is not needed in WASM.
  ```c
  int restore_savefile(char *lock, const char *saveprefix) { return 0; }
  ```
- **ospeed**: Defined as a global variable to satisfy TTY code.
  ```c
  short ospeed = 0;
  ```
- **tc_lcl_data**: Dummy struct for tcap.h compatibility.
  ```c
  struct tc_lcl_data { int dummy; } tc_lcl_data;
  ```
- **cmov, nocmov**: Cursor movement stubs.
  ```c
  void cmov(int x, int y) {}
  void nocmov(int x, int y) {}
  ```
- **Topline functions and morc global**: For TTY linkage.
  ```c
  char morc = 0;
  void addtopl(const char *s) {}
  void update_topl(const char *s) {}
  void remember_topl(void) {}
  void show_topl(const char *s) {}
  ```
- **TTY/termcap stubs**: No-op implementations for functions expected by TTY code.
  ```c
  void tty_startup(int *wid, int *hgt) { if (wid) *wid = 80; if (hgt) *hgt = 24; }
  void home(void) {}
  void cl_end(void) {}
  void clear_screen(void) {}
  void cl_eos(void) {}
  void term_start_attr(int attr) {}
  void term_end_attr(int attr) {}
  void graph_on(void) {}
  void graph_off(void) {}
  void term_end_color(void) {}
  /* Additional TTY/SLASH'EM congruent stubs: */
  void tty_shutdown(void) {}
  void standoutbeg(void) {}
  void standoutend(void) {}
  void xputs(const char *s) {}
  void xwaitforspace(const char *s) {}
  void term_start_color(int color) {}
  void tty_getlin(const char *q, char *b) { if (b) *b = 0; }
  void tty_nhbell(void) {}
  int tty_doprev_message(void) { return 0; }
  ```

### 3. Build Script Adjustments
- The build script (`scripts/wasm/build-evilhack.mjs`) was updated to:
  - Exclude `win/tty/termcap.c` from the build.
  - Always include the WASM shims file.
  - Ensure all required EvilHack source files for TTY/UNIX/graphical linkage are included.

## Rationale
- This approach mirrors SLASH'EM's WASM build, which provides stubs and globals for all symbols that are not needed or cannot be implemented in the browser environment.
- It avoids linker errors and ensures the EvilHack WASM build is robust and maintainable.

## References
- See SLASH'EM WASM: `sys/share/unixtty.c`, `sys/share/tclib.c`, `win/tty/topl.c`, and related shims.
- EvilHack WASM shims: `scripts/wasm/evilhack-wasm-shims.c`

---
_Last updated: April 14, 2026_
