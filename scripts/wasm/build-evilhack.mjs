// scripts/wasm/build-evilhack.mjs
// Build EvilHack WASM/JS for NetHack-3D
// Usage: node scripts/wasm/build-evilhack.mjs

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const srcDir = path.resolve('imported/role-sources/evilhack');
const outDir = path.resolve('public');
const outBase = 'evilhack';

if (!existsSync(srcDir)) {
  throw new Error(`Source directory not found: ${srcDir}`);
}
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

// Automatically include all .c files from EvilHack's src directory
import { readdirSync } from 'fs';
const evilhackSrcDir = path.resolve('../EvilHack/src');
const cFiles = readdirSync(evilhackSrcDir)
  .filter(f => f.endsWith('.c'))
  .map(f => path.join(evilhackSrcDir, f))
  .join(' ');

const emccCmd = [
  'emcc',
  cFiles,
  '-O2',
  '-s', 'MODULARIZE=1',
  '-s', 'EXPORT_NAME=EvilHackModule',
  '-o', path.join(outDir, `${outBase}.js`),
  '-I', '../EvilHack/include', // for evilhack, placed at root dir, same level of nethack-3d.
  '-I', '../EvilHack/src', // for evilhack, placed at root dir, same level of nethack-3d.
  // Add any required include paths or flags here
].join(' ');

console.log('Building EvilHack WASM/JS...');
console.log(emccCmd);
execSync(emccCmd, { stdio: 'inherit' });
console.log('Done. Output:', path.join(outDir, `${outBase}.js`), path.join(outDir, `${outBase}.wasm`));
