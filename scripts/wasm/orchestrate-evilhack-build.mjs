#!/usr/bin/env node
/**
 * EvilHack WASM Build Orchestrator
 * 
 * Coordinates multi-phase build to work around Make's LFLAGS override issue.
 * 
 * Phase 1-2: Compile sources + build data (via LOCAL_build.wasm.sh)
 * Phase 3: Re-link with correct Emscripten flags (via phase3-relink-evilhack.sh)
 * 
 * Usage:
 *   node scripts/wasm/orchestrate-evilhack-build.mjs [options]
 * 
 * Options:
 *   --skip-phase-1-2   Skip compilation, re-link existing objects
 *   --skip-phase-3     Compile but don't link
 *   --local-build PATH Path to LOCAL_build.wasm.sh (auto-detected if not set)
 *   --help             Show this message
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, writeFileSync, cpSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const scriptsWasm = path.join(projectRoot, 'scripts', 'wasm');

// Parse arguments
const args = new Set(process.argv.slice(2));

if (args.has('--help')) {
  console.log(`
EvilHack WASM Build Orchestrator

Usage:
  node scripts/wasm/orchestrate-evilhack-build.mjs [options]

Options:
  --skip-phase-1-2   Skip phase 1-2 (compilation), re-link existing objects
  --skip-phase-3     Compile but skip final re-link
  --help             Show this message

Pipeline:
  Phase 1-2: Compile EvilHack sources + build data archives
  Phase 3:   Re-link with correct Emscripten flags

Expected directory structure:
  /home/simon/repos/
    ├── nethack-3d/
    ├── EvilHack/               (peer - for source)
    ├── imported/
    │   └── evilhack-wasm/      (for build scripts)
    └── emsdk/                  (Emscripten SDK)
  `);
  process.exit(0);
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║       EvilHack WASM Build Orchestrator                     ║
╚════════════════════════════════════════════════════════════╝
`);

// Verify emcc is available
try {
  execSync('which emcc > /dev/null 2>&1', { shell: true });
} catch {
  console.error(`
ERROR: emcc not found in PATH

Activate Emscripten SDK:
  source ~/emsdk/emsdk_env.sh

Or set EMSDK environment variable.
  `);
  process.exit(1);
}

// ============================================================================
// Phase 1-2: Compile objects + build data
// ============================================================================

if (!args.has('--skip-phase-1-2')) {
  console.log('📦 Phase 1-2: Compiling EvilHack sources + building data...\n');
  
  const localBuildScript = path.join(projectRoot, 'imported/evilhack-wasm/LOCAL_build.wasm.sh');
  
  if (!existsSync(localBuildScript)) {
    console.error(`
ERROR: LOCAL_build.wasm.sh not found at:
  ${localBuildScript}

Expected structure:
  imported/evilhack-wasm/LOCAL_build.wasm.sh

This script is critical for phases 1-2. Make sure it exists.
    `);
    process.exit(1);
  }
  
  try {
    execSync(`bash "${localBuildScript}"`, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: '/bin/bash'
    });
    console.log('\n✓ Phase 1-2 complete\n');
  } catch (err) {
    console.error('\n✗ Phase 1-2 failed');
    process.exit(err.status || 1);
  }
} else {
  console.log('⊘ Phase 1-2 skipped (--skip-phase-1-2)\n');
}

// ============================================================================
// Phase 3: Re-link with correct flags
// ============================================================================

if (!args.has('--skip-phase-3')) {
  console.log('🔗 Phase 3: Re-linking with correct Emscripten flags...\n');
  
  const phase3Script = path.join(scriptsWasm, 'phase3-relink-evilhack.sh');
  
  if (!existsSync(phase3Script)) {
    console.error(`
ERROR: phase3-relink-evilhack.sh not found at:
  ${phase3Script}

This script is critical for phase 3. Make sure it exists.
    `);
    process.exit(1);
  }
  
  try {
    execSync(`bash "${phase3Script}"`, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: '/bin/bash'
    });
    console.log('\n✓ Phase 3 complete\n');
  } catch (err) {
    console.error('\n✗ Phase 3 failed');
    process.exit(err.status || 1);
  }
} else {
  console.log('⊘ Phase 3 skipped (--skip-phase-3)\n');
}

// ============================================================================
// Phase 4: Copy data files to public assets
// ============================================================================

console.log('📋 Phase 4: Copying EvilHack data files to public/assets...\n');

const evilhackDataSource = path.join(projectRoot, 'imported/evilhack-wasm/EvilHack-0.9.2/dat');
const evilhackDataTarget = path.join(projectRoot, 'public/assets/evilhack/dat');

try {
  // Create target directory if it doesn't exist
  if (!existsSync(evilhackDataTarget)) {
    mkdirSync(evilhackDataTarget, { recursive: true });
    console.log(`  Created directory: ${evilhackDataTarget}`);
  }

  // Copy all data files
  if (existsSync(evilhackDataSource)) {
    cpSync(evilhackDataSource, evilhackDataTarget, { 
      recursive: true,
      force: true // Overwrite existing files
    });
    console.log(`  ✓ Copied data files from ${evilhackDataSource}`);
    
    // Verify some key files exist
    const keyFiles = ['quest.dat', 'rumors', 'oracles'];
    const missingFiles = keyFiles.filter(file => !existsSync(path.join(evilhackDataTarget, file)));
    
    if (missingFiles.length > 0) {
      console.warn(`  ⚠ Warning: Some expected files missing: ${missingFiles.join(', ')}`);
    } else {
      console.log(`  ✓ All key data files present (quest.dat, rumors, oracles)`);
    }
  } else {
    console.warn(`  ⚠ EvilHack data source not found: ${evilhackDataSource}`);
    console.warn(`     Data files may need to be copied manually or EvilHack source rebuilt`);
  }
} catch (err) {
  console.error(`  ✗ Failed to copy data files: ${err.message}`);
  process.exit(err.code || 1);
}

// ============================================================================
// Verification
// ============================================================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║                  ✓ Build Complete                          ║
╚════════════════════════════════════════════════════════════╝

Output files:
  public/evilhack.js
  public/evilhack.wasm

Next: Integrate into UI
  1. Add 'evilhack' to NethackRuntimeVersion type
  2. Add EvilHack to version selector UI
  3. Update loader to support evilhack.js/wasm
  4. Test with: npm run dev

Troubleshooting:
  If compilation fails, check:
    - Emscripten is active: source ~/emsdk/emsdk_env.sh
    - EvilHack source exists
    - Permissions on imported/evilhack-wasm/
  
  If re-link fails, check:
    - Object files exist in build tree
    - wasm-data/ directory is populated
  
  To re-run phases:
    node scripts/wasm/orchestrate-evilhack-build.mjs --skip-phase-1-2   # re-link only
    node scripts/wasm/orchestrate-evilhack-build.mjs --skip-phase-3     # compile only
`);
