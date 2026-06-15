// Post-process evilhack.js to inject a robust assignWasmExports using a mapping table
import fs from 'fs';
import path from 'path';

const evilhackJsPath = process.argv[2] || 'public/evilhack.js';
const mappingDocPath = path.resolve('EVILHACK_WASM_EXPORT_MAP.md');


// The mapping table (should match the obfuscated export names as in slashem.js)
const evilhackWasmExportMap = {
  memory: 'H',
  _malloc: 'J',
  _free: 'L',
  _shim_graphics_set_callback: 'T',
  _main: 'R',
  __emscripten_stack_restore: 'U',
  __emscripten_stack_alloc: 'V',
  _emscripten_stack_get_current: 'W',
  dynCall_i: 'X',
  dynCall_ii: 'Y',
  dynCall_iiii: 'Z',
  dynCall_iii: '_',
  dynCall_viii: '$',
  dynCall_vi: 'aa',
  dynCall_vii: 'ba',
  dynCall_v: 'ca',
  dynCall_viiiiiiii: 'da',
  dynCall_viiii: 'ea',
  dynCall_jiji: 'fa',
  dynCall_iidiiii: 'ga',
  _asyncify_start_unwind: 'ha',
  _asyncify_stop_unwind: 'ia',
  _asyncify_start_rewind: 'ja',
  _asyncify_stop_rewind: 'ka',
  __indirect_function_table: 'K',
};

let js = fs.readFileSync(evilhackJsPath, 'utf8');

// Replace the assignWasmExports function with a mapping-based version
js = js.replace(/function assignWasmExports\(wasmExports\) \{[\s\S]*?\n\s*\}/, `function assignWasmExports(wasmExports) {\n  // This function is auto-patched by scripts/wasm/patch-evilhack-glue.mjs\n  // See EVILHACK_WASM_EXPORT_MAP.md for the mapping table.\n  const map = ${JSON.stringify(evilhackWasmExportMap, null, 2)};\n  for (const [jsName, wasmKey] of Object.entries(map)) {\n    if (jsName.startsWith('dynCall_')) {\n      if (typeof dynCalls !== 'undefined') {\n        dynCalls[jsName.replace('dynCall_', '')] = wasmExports[wasmKey];\n      }\n      if (typeof Module !== 'undefined') {\n        Module[jsName] = wasmExports[wasmKey];\n      }\n    } else if (jsName === 'memory') {\n      memory = wasmMemory = wasmExports[wasmKey];\n    } else if (jsName === '__indirect_function_table') {\n      __indirect_function_table = wasmExports[wasmKey];\n    } else {\n      if (typeof Module !== 'undefined') {\n        Module[jsName] = wasmExports[wasmKey];\n      }\n    }\n  }\n}`);

fs.writeFileSync(evilhackJsPath, js, 'utf8');
console.log('Patched assignWasmExports in', evilhackJsPath, '\nMapping doc:', mappingDocPath);
