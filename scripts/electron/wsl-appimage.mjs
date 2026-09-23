import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function dependencyKey(projectDir, runtime = `${process.version}/${process.platform}/${process.arch}`) {
  const hash = createHash("sha256").update(runtime);
  for (const name of ["package.json", "package-lock.json", ".npmrc"]) {
    hash.update(name);
    hash.update(fs.existsSync(path.join(projectDir, name)) ? fs.readFileSync(path.join(projectDir, name)) : "missing");
  }
  return hash.digest("hex");
}

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.signal || result.status}).`);
  }
}

function timed(label, action) {
  console.log(`[AppImage] ${label}...`);
  const start = performance.now();
  const result = action();
  console.log(`[AppImage] ${label}: ${((performance.now() - start) / 1000).toFixed(1)}s`);
  return result;
}

export function copyArtifacts(packagingOutput, destination) {
  const files = fs.readdirSync(packagingOutput, { withFileTypes: true }).filter((entry) => entry.isFile());
  if (!files.some((entry) => entry.name.endsWith(".AppImage"))) {
    throw new Error("Packaging produced no AppImage; no artifacts were copied.");
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of files) {
    // Only completed top-level artifacts and diagnostics cross back to Windows.
    // Never mirror/delete the destination: it may also contain Windows releases.
    const target = path.join(destination, entry.name);
    const temporary = `${target}.tmp-${process.pid}`;
    try {
      fs.copyFileSync(path.join(packagingOutput, entry.name), temporary);
      fs.renameSync(temporary, target);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
}

export function main(args = process.argv.slice(2)) {
  if (process.platform !== "linux") throw new Error("The WSL packaging helper requires Linux Node.js.");
  const [sourceArg, destinationArg, ...flags] = args;
  if (!sourceArg || !destinationArg || flags.some((flag) => !["--prepare-only", "--skip-prepare"].includes(flag))) {
    throw new Error("Usage: wsl-appimage.mjs SOURCE OUTPUT [--prepare-only] [--skip-prepare]");
  }
  const source = fs.realpathSync(sourceArg);
  const destination = path.resolve(destinationArg);
  const projectId = createHash("sha256").update(source).digest("hex").slice(0, 16);
  // Deliberately use Linux home, not a cache environment variable that might point at /mnt/c.
  const workspace = path.join(os.homedir(), ".cache", "nethack3d", "appimage", projectId);
  const project = path.join(workspace, "project");
  const output = path.join(project, "release");
  const prepared = path.join(workspace, "prepared");
  const lock = path.join(workspace, "lock");
  fs.mkdirSync(workspace, { recursive: true });
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error(`Another AppImage build owns ${lock}. If a previous build was interrupted, remove that empty lock directory and retry.`);
  }
  console.log(`[AppImage] Linux workspace: ${workspace}`);
  try {
    if (!flags.includes("--skip-prepare")) {
      fs.rmSync(prepared, { force: true });
      timed("Sync packaging inputs", () => {
        fs.mkdirSync(project, { recursive: true });
        for (const name of ["package.json", "package-lock.json"]) {
          fs.copyFileSync(path.join(source, name), path.join(project, name));
        }
        const npmrc = path.join(source, ".npmrc");
        if (fs.existsSync(npmrc)) fs.copyFileSync(npmrc, path.join(project, ".npmrc"));
        else fs.rmSync(path.join(project, ".npmrc"), { force: true });
        for (const name of ["dist", "electron", "build/icons", "scripts/electron"]) {
          const target = path.join(project, name);
          fs.mkdirSync(target, { recursive: true });
          // Checksums also detect same-size edits whose mtimes were preserved.
          // Deletions are scoped to each dedicated staged input directory.
          run("rsync", ["-rlt", "--checksum", "--delete", "--", `${path.join(source, name)}/`, `${target}/`], project);
        }
      });
      timed("Prepare Linux dependencies", () => {
        const key = dependencyKey(project);
        const stamp = path.join(workspace, "dependencies.sha256");
        const builderCli = path.join(project, "node_modules/electron-builder/cli.js");
        if (!fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== key || !fs.existsSync(builderCli)) {
          // npm install honors locked versions while filling optional Linux entries
          // absent from a Windows-generated lock. Only the staged lock is updated;
          // the stamp describes the source metadata copied above.
          // electron-builder downloads its own target Electron archive when packaging.
          fs.rmSync(stamp, { force: true });
          run("npm", ["install", "--include=dev", "--include=optional", "--no-audit", "--no-fund"], project, {
            ELECTRON_SKIP_BINARY_DOWNLOAD: "1",
          });
          fs.writeFileSync(stamp, key);
        } else {
          console.log("[AppImage] Reusing cached Linux node_modules.");
        }
        const cups = ["/lib/x86_64-linux-gnu/libcups.so.2", "/usr/lib/x86_64-linux-gnu/libcups.so.2"].find((file) => fs.existsSync(file));
        if (!cups) throw new Error("Missing libcups.so.2 in WSL.");
        fs.mkdirSync(path.join(project, "build/linux-libs"), { recursive: true });
        fs.copyFileSync(cups, path.join(project, "build/linux-libs/libcups.so.2"));
      });
      fs.writeFileSync(prepared, "ready\n");
    }
    if (flags.includes("--prepare-only")) return;
    if (!fs.existsSync(prepared)) throw new Error("No completed preparation; rerun without NH3D_APPIMAGE_SKIP_PREPARE.");
    for (const name of ["dist/index.html", "node_modules/electron-builder/cli.js", "build/linux-libs/libcups.so.2"]) {
      if (!fs.existsSync(path.join(project, name))) throw new Error(`Missing staged ${name}; rerun without NH3D_APPIMAGE_SKIP_PREPARE.`);
    }
    timed("Package Linux AppImage", () => {
      // This fixed output belongs only to this workspace. Clear it so stale artifacts
      // can never be copied after a successful build of a different version.
      fs.rmSync(output, { recursive: true, force: true });
      run(process.execPath, ["node_modules/electron-builder/cli.js", "--linux", "AppImage", "--x64", "--publish", "never", "-c.directories.output=release"], project);
    });
    timed("Copy release artifacts", () => copyArtifacts(output, destination));
  } finally {
    fs.rmdirSync(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
