import { spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";

const isDryRun = process.env.NH3D_APPIMAGE_DRY_RUN === "1";
const isPrepareOnly = process.env.NH3D_APPIMAGE_PREPARE_ONLY === "1";
const shouldSkipPrepare = process.env.NH3D_APPIMAGE_SKIP_PREPARE === "1";
const shouldSkipElectronBuild = process.env.NH3D_SKIP_ELECTRON_BUILD === "1";
const outputDirOverride = process.env.NH3D_ELECTRON_OUTPUT_DIR?.trim() || null;
const stageLinuxRuntimeDepsCommand = [
  "mkdir -p build/linux-libs",
  "if [ -f /lib/x86_64-linux-gnu/libcups.so.2 ]; then cp -f /lib/x86_64-linux-gnu/libcups.so.2 build/linux-libs/libcups.so.2; " +
    "elif [ -f /usr/lib/x86_64-linux-gnu/libcups.so.2 ]; then cp -f /usr/lib/x86_64-linux-gnu/libcups.so.2 build/linux-libs/libcups.so.2; " +
    "else echo 'Missing libcups.so.2 on this Linux environment.' >&2; exit 1; fi",
].join(" && ");

function runOrExit(command, args) {
  if (isDryRun) {
    console.log(`[dry-run] ${command} ${args.join(" ")}`);
    return;
  }

  const started = performance.now();
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    const message = result.error.code === "ENOENT"
      ? `Required command not found: ${command}`
      : result.error.message;
    console.error(message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${command} failed${result.signal ? ` (${result.signal})` : ""}.`);
    process.exit(result.status || 1);
  }
  console.log(`[AppImage] ${command} finished in ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

function buildElectronAssets() {
  console.log("[AppImage] Building Electron web assets on the host...");
  // Running npm's JS entrypoint avoids Windows .cmd shell quoting problems.
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  if (process.platform === "win32") {
    runOrExit(process.execPath, [npmCli, "run", "build:electron"]);
  } else {
    runOrExit("npm", ["run", "build:electron"]);
  }
}

function bashQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getElectronBuilderArgs() {
  const args = ["electron-builder", "--linux", "AppImage", "--x64"];
  if (outputDirOverride) {
    args.push(`-c.directories.output=${outputDirOverride}`);
  }
  return args;
}

function resolveWslShell() {
  const result = spawnSync(
    "wsl",
    ["sh", "-lc", "getent passwd \"$USER\" | cut -d: -f7"],
    { encoding: "utf8", shell: false },
  );

  if (result.error || result.status !== 0) {
    return "bash";
  }

  const shellPath = result.stdout.trim();
  return shellPath || "bash";
}

function runNative() {
  console.log("Using native Linux/macOS AppImage build flow.");
  if (!shouldSkipPrepare && process.platform === "linux") {
    runOrExit("bash", ["-lc", stageLinuxRuntimeDepsCommand]);
  }
  if (isPrepareOnly) {
    return;
  }
  if (!shouldSkipElectronBuild) {
    buildElectronAssets();
  }
  runOrExit("npx", getElectronBuilderArgs());
}

function runViaWsl() {
  const windowsCwd = process.cwd().replace(/\\/g, "/");
  let wslCwd = "";

  const wslPathResult = spawnSync("wsl", ["wslpath", "-a", windowsCwd], {
    encoding: "utf8",
    shell: false,
  });

  if (!wslPathResult.error && wslPathResult.status === 0) {
    wslCwd = wslPathResult.stdout.trim();
  } else {
    const drivePathMatch = windowsCwd.match(/^([A-Za-z]):\/(.*)$/);
    if (drivePathMatch) {
      const driveLetter = drivePathMatch[1].toLowerCase();
      const pathRemainder = drivePathMatch[2];
      wslCwd = `/mnt/${driveLetter}/${pathRemainder}`;
    } else {
      console.error(
        "Failed to resolve the current path in WSL. Install and initialize a WSL distribution first.",
      );
      if (wslPathResult.stderr) {
        console.error(wslPathResult.stderr.trim());
      }
      process.exit(1);
    }
  }

  const wslShell = resolveWslShell();
  let wslOutput = `${wslCwd}/release`;
  if (outputDirOverride) {
    const outputPath = path.resolve(outputDirOverride).replace(/\\/g, "/");
    const result = spawnSync("wsl", ["wslpath", "-a", outputPath], { encoding: "utf8", shell: false });
    if (result.error || result.status !== 0) {
      throw new Error(`Cannot resolve AppImage output directory in WSL: ${outputPath}`);
    }
    wslOutput = result.stdout.trim();
  }
  const helperArgs = [
    `${wslCwd}/scripts/electron/wsl-appimage.mjs`,
    wslCwd,
    wslOutput,
    ...(isPrepareOnly ? ["--prepare-only"] : []),
    ...(shouldSkipPrepare ? ["--skip-prepare"] : []),
  ];

  if (!isDryRun) {
    const wslNodeCheck = spawnSync(
      "wsl",
      [wslShell, "-lic", "command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && command -v rsync >/dev/null 2>&1"],
      { shell: false },
    );
    if (wslNodeCheck.error || wslNodeCheck.status !== 0) {
      console.error(
        "WSL requires Linux node, npm, and rsync for AppImage packaging.",
      );
      console.error(`Ensure your shell init exposes Linux node/npm and rsync for \`wsl ${wslShell} -lic\` commands, then rerun.`);
      process.exit(1);
    }
  }

  if (!isPrepareOnly && !shouldSkipElectronBuild) {
    buildElectronAssets();
  }
  console.log(`Using cached WSL-local AppImage packaging (shell: ${wslShell}).`);
  runOrExit("wsl", [wslShell, "-lic", `node ${helperArgs.map(bashQuote).join(" ")}`]);
}

if (process.platform === "win32") {
  runViaWsl();
} else {
  runNative();
}
