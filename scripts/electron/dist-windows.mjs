import { spawnSync } from "node:child_process";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const isPortableOnly = args.delete("--portable-only");
const isDryRun = process.env.NH3D_WINDOWS_DRY_RUN === "1";
const shouldSkipElectronBuild = process.env.NH3D_SKIP_ELECTRON_BUILD === "1";
const outputDirOverride = process.env.NH3D_ELECTRON_OUTPUT_DIR?.trim() || null;
const legacyPortableArtifactName =
  "NetHack 3D ${version} Portable (Legacy x86).${ext}";
const npmExecPath = process.env.npm_execpath;
const npmRunner = npmExecPath
  ? {
      command: process.execPath,
      baseArgs: [npmExecPath],
    }
  : {
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      baseArgs: [],
    };

if (args.size > 0) {
  console.error(`Unknown argument(s): ${[...args].join(", ")}`);
  process.exit(1);
}

function runOrExit(command, commandArgs) {
  if (isDryRun) {
    console.log(`[dry-run] ${command} ${commandArgs.join(" ")}`);
    return;
  }

  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    const message =
      result.error.code === "ENOENT"
        ? `Required command not found: ${command}`
        : result.error.message;
    console.error(message);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function runNpmOrExit(npmArgs) {
  runOrExit(npmRunner.command, [...npmRunner.baseArgs, ...npmArgs]);
}

function getElectronBuilderArgs(targets, arch, extraConfig = []) {
  const builderArgs = [
    "exec",
    "--",
    "electron-builder",
    "--win",
    ...targets,
    `--${arch}`,
    ...extraConfig,
  ];

  if (outputDirOverride) {
    builderArgs.push(`-c.directories.output=${outputDirOverride}`);
  }

  return builderArgs;
}

if (!shouldSkipElectronBuild) {
  runNpmOrExit(["run", "build:electron"]);
}

const x64Targets = isPortableOnly ? ["portable"] : ["nsis", "portable"];
console.log(`Packaging Windows ${x64Targets.join(" + ")} for x64...`);
runNpmOrExit(getElectronBuilderArgs(x64Targets, "x64"));

console.log("Packaging legacy Windows portable executable for x86...");
runNpmOrExit(
  getElectronBuilderArgs(["portable"], "ia32", [
    `-c.portable.artifactName=${legacyPortableArtifactName}`,
  ]),
);
