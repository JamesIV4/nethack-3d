import { spawnSync } from "node:child_process";
import process from "node:process";

const isDryRun = process.env.NH3D_APPIMAGE_DRY_RUN === "1";
const isPrepareOnly = process.env.NH3D_APPIMAGE_PREPARE_ONLY === "1";
const shouldSkipPrepare = process.env.NH3D_APPIMAGE_SKIP_PREPARE === "1";
const shouldSkipElectronBuild = process.env.NH3D_SKIP_ELECTRON_BUILD === "1";
const outputDirOverride = process.env.NH3D_ELECTRON_OUTPUT_DIR?.trim() || null;
const electronBuilderCliPath = "node_modules/electron-builder/out/cli/cli.js";
const legacyElectronBuilderConfigPath =
  "scripts/electron/electron-builder-legacy-linux.cjs";
const stagedLinuxRuntimeDepsDir = "build/linux-libs";
const stagedLinuxRuntimeDepPath = `${stagedLinuxRuntimeDepsDir}/libcups.so.2`;
const legacyLinuxLibcupsPackagePath =
  `${stagedLinuxRuntimeDepsDir}/libcups-bionic-i386.deb`;
const legacyLinuxLibcupsUrl =
  "https://security.ubuntu.com/ubuntu/pool/main/c/cups/libcups2_2.2.7-1ubuntu2.10_i386.deb";
const legacyLinuxLibcupsSha256 =
  "aa0d2d9f37ff2b5f3b9f815e46aff8e6611d172ca6ade0a4d6b3ba67d00b4603";
const legacyLinuxLibcupsArchivePath =
  "./usr/lib/i386-linux-gnu/libcups.so.2";
const linuxRuntimeDeps = {
  x64: {
    sourcePaths: [
      "/lib/x86_64-linux-gnu/libcups.so.2",
      "/usr/lib/x86_64-linux-gnu/libcups.so.2",
    ],
  },
};

function getSystemLinuxRuntimeDepCommand(arch, shouldCopy) {
  const dependency = linuxRuntimeDeps[arch];
  const copyAttempts = dependency.sourcePaths
    .map((sourcePath, index) => {
      const prefix = index === 0 ? "if" : "elif";
      const action = shouldCopy
        ? `cp -f ${bashQuote(sourcePath)} ${bashQuote(stagedLinuxRuntimeDepPath)}`
        : ":";
      return `${prefix} [ -f ${bashQuote(sourcePath)} ]; then ${action};`;
    })
    .join(" ");
  const dependencyCheck =
    `${copyAttempts} else echo ${bashQuote(`Missing ${arch} libcups.so.2. Install the ${arch} libcups package before packaging.`)} >&2; exit 1; fi`;

  if (!shouldCopy) {
    return dependencyCheck;
  }

  return `mkdir -p ${bashQuote(stagedLinuxRuntimeDepsDir)} && ${dependencyCheck}`;
}

const checkLinuxRuntimeDepsCommand = [
  getSystemLinuxRuntimeDepCommand("x64", false),
  "command -v curl >/dev/null 2>&1",
  "command -v dpkg-deb >/dev/null 2>&1",
  "command -v sha256sum >/dev/null 2>&1",
  "command -v tar >/dev/null 2>&1",
].join(" && ");

const cleanupLinuxRuntimeDepsCommand =
  `rm -f ${bashQuote(stagedLinuxRuntimeDepPath)} ${bashQuote(legacyLinuxLibcupsPackagePath)}; rmdir ${bashQuote(stagedLinuxRuntimeDepsDir)} 2>/dev/null || true`;

function getLegacyLinuxRuntimeDepCommand() {
  return [
    `mkdir -p ${bashQuote(stagedLinuxRuntimeDepsDir)}`,
    `curl -fsSL ${bashQuote(legacyLinuxLibcupsUrl)} -o ${bashQuote(legacyLinuxLibcupsPackagePath)}`,
    `printf '%s  %s\\n' ${bashQuote(legacyLinuxLibcupsSha256)} ${bashQuote(legacyLinuxLibcupsPackagePath)} | sha256sum -c -`,
    `dpkg-deb --fsys-tarfile ${bashQuote(legacyLinuxLibcupsPackagePath)} | tar -xOf - ${bashQuote(legacyLinuxLibcupsArchivePath)} > ${bashQuote(stagedLinuxRuntimeDepPath)}`,
    `rm -f ${bashQuote(legacyLinuxLibcupsPackagePath)}`,
  ].join(" && ");
}

function runOrExit(command, args) {
  if (isDryRun) {
    console.log(`[dry-run] ${command} ${args.join(" ")}`);
    return;
  }

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

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function bashQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getElectronBuilderArgs(arch, configPath = null) {
  const args = [
    "--linux",
    "AppImage",
    `--${arch}`,
  ];
  if (configPath) {
    args.push("--config", configPath);
  }
  if (outputDirOverride) {
    args.push(`-c.directories.output=${outputDirOverride}`);
  }
  return args;
}

function getLinuxPackagingCommand() {
  const x64BuilderArgs = getElectronBuilderArgs("x64");
  const legacyBuilderArgs = getElectronBuilderArgs(
    "ia32",
    legacyElectronBuilderConfigPath,
  );

  return [
    `trap ${bashQuote(cleanupLinuxRuntimeDepsCommand)} EXIT`,
    getSystemLinuxRuntimeDepCommand("x64", true),
    `node ${bashQuote(electronBuilderCliPath)} ${x64BuilderArgs.map(bashQuote).join(" ")}`,
    getLegacyLinuxRuntimeDepCommand(),
    `node ${bashQuote(electronBuilderCliPath)} ${legacyBuilderArgs.map(bashQuote).join(" ")}`,
  ].join(" && ");
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
    runOrExit("bash", ["-lc", checkLinuxRuntimeDepsCommand]);
  }
  if (isPrepareOnly) {
    return;
  }
  if (!shouldSkipElectronBuild) {
    runOrExit("npm", ["run", "build:electron"]);
  }
  runOrExit("bash", ["-lc", getLinuxPackagingCommand()]);
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
  const wslElectronBuilderCommand = getLinuxPackagingCommand();
  const wslInstallOptionalDepsCommand =
    `cd ${bashQuote(wslCwd)} && npm install --include=optional --no-audit --no-fund --no-save --package-lock=false`;
  const wslCheckLinuxRuntimeDepsCommand =
    `cd ${bashQuote(wslCwd)} && ${checkLinuxRuntimeDepsCommand}`;
  const wslRollupOptionalDepCheckCommand =
    `cd ${bashQuote(wslCwd)} && [ -f node_modules/@rollup/rollup-linux-x64-gnu/package.json ]`;
  const wslCommand = shouldSkipElectronBuild
    ? `cd ${bashQuote(wslCwd)} && ${wslElectronBuilderCommand}`
    : `cd ${bashQuote(wslCwd)} && npm run build:electron && ${wslElectronBuilderCommand}`;

  if (!isDryRun) {
    const wslNodeCheck = spawnSync(
      "wsl",
      [wslShell, "-lic", "command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1"],
      { shell: false },
    );
    if (wslNodeCheck.error || wslNodeCheck.status !== 0) {
      console.error(
        "WSL is available, but node/npm were not found in the non-interactive shell used by this script.",
      );
      console.error(`Ensure your shell init exposes node/npm for \`wsl ${wslShell} -lic\` commands, then rerun.`);
      process.exit(1);
    }

    if (!shouldSkipPrepare) {
      if (!shouldSkipElectronBuild) {
        const wslRollupOptionalDepCheck = spawnSync(
          "wsl",
          [wslShell, "-lic", wslRollupOptionalDepCheckCommand],
          { shell: false },
        );
        if (wslRollupOptionalDepCheck.error || wslRollupOptionalDepCheck.status !== 0) {
          console.log(
            "Linux optional dependencies are missing in node_modules for the WSL build. Installing them in WSL...",
          );
          runOrExit("wsl", [wslShell, "-lic", wslInstallOptionalDepsCommand]);
        }
      }

      runOrExit("wsl", [wslShell, "-lic", wslCheckLinuxRuntimeDepsCommand]);
    }
  }

  console.log(`Using WSL AppImage build flow from: ${wslCwd} (shell: ${wslShell})`);
  if (isPrepareOnly) {
    return;
  }
  runOrExit("wsl", [wslShell, "-lic", wslCommand]);
}

if (process.platform === "win32") {
  runViaWsl();
} else {
  runNative();
}
