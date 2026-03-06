import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const DEFAULT_PORT = 5173;
const ADB_FALLBACK_PATHS = [
  process.env.ANDROID_SDK_ROOT
    ? path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe")
    : null,
  process.env.ANDROID_HOME
    ? path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe")
    : null,
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe")
    : null,
  path.join(os.homedir(), "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
];

let cachedAdbCommand = null;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveAdbCommand() {
  if (cachedAdbCommand) {
    return cachedAdbCommand;
  }

  const directLookup = spawnSync("adb", ["version"], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (!directLookup.error && directLookup.status === 0) {
    cachedAdbCommand = "adb";
    return cachedAdbCommand;
  }

  const fallbackPath = ADB_FALLBACK_PATHS.find((candidate) => candidate && existsSync(candidate));
  if (!fallbackPath) {
    return null;
  }

  const fallbackLookup = spawnSync(fallbackPath, ["version"], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (fallbackLookup.error || fallbackLookup.status !== 0) {
    return null;
  }

  cachedAdbCommand = fallbackPath;
  return cachedAdbCommand;
}

function runAdb(args) {
  const adbCommand = resolveAdbCommand();
  if (!adbCommand) {
    return {
      error: new Error("adb-not-found"),
      status: null,
      stdout: "",
      stderr: "",
    };
  }

  return spawnSync(adbCommand, args, {
    stdio: "pipe",
    encoding: "utf8",
  });
}

function ensureAdbAvailable() {
  const result = runAdb(["version"]);
  if (result.error) {
    fail(
      "Missing adb. Install Android Platform Tools. The helper checks your PATH and the default Android SDK install location before failing.",
    );
  }
  if (result.status !== 0) {
    fail(result.stderr || "Failed to run `adb version`.");
  }
}

function ensureQuestConnected() {
  const result = runAdb(["devices"]);
  if (result.error) {
    fail("Failed to run `adb devices`.");
  }
  if (result.status !== 0) {
    fail(result.stderr || "Failed to query connected adb devices.");
  }

  const connectedDevice = result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => /\bdevice$/.test(line));

  if (!connectedDevice) {
    fail(
      "No Quest headset is available over adb. Connect the headset over USB, accept the device prompt, and rerun `npm run vr:quest:dev`.",
    );
  }
}

function ensureReversePort(port) {
  const result = runAdb(["reverse", `tcp:${port}`, `tcp:${port}`]);
  if (result.error) {
    fail(`Failed to run \`adb reverse tcp:${port} tcp:${port}\`.`);
  }
  if (result.status !== 0) {
    fail(result.stderr || `Failed to forward tcp:${port} into the headset.`);
  }
}

function removeReversePort(port) {
  const adbCommand = resolveAdbCommand();
  if (!adbCommand) {
    return;
  }
  spawnSync(adbCommand, ["reverse", "--remove", `tcp:${port}`], {
    stdio: "ignore",
  });
}

function resolvePort() {
  const portText = process.env.NH3D_VR_PORT || String(DEFAULT_PORT);
  const port = Number.parseInt(portText, 10);
  if (!Number.isInteger(port) || port <= 0) {
    fail(`Invalid NH3D_VR_PORT value: ${portText}`);
  }
  return port;
}

function resolveViteBin() {
  try {
    const packageJsonPath = require.resolve("vite/package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const viteBinRelative =
      typeof packageJson.bin === "string"
        ? packageJson.bin
        : typeof packageJson.bin?.vite === "string"
          ? packageJson.bin.vite
          : null;

    if (!viteBinRelative) {
      fail("Failed to find Vite's CLI entrypoint.");
    }

    return path.join(path.dirname(packageJsonPath), viteBinRelative);
  } catch {
    fail("Missing Vite. Run `npm i` before running `npm run vr:quest:dev`.");
  }
}

function main() {
  const port = resolvePort();
  const viteBin = resolveViteBin();

  ensureAdbAvailable();
  ensureQuestConnected();
  ensureReversePort(port);

  console.log(`Quest Browser URL: http://localhost:${port}/`);
  console.log("Press Ctrl+C to stop the dev server.");

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    removeReversePort(port);
  };

  const child = spawn(
    process.execPath,
    [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  child.on("error", (error) => {
    cleanup();
    fail(error instanceof Error ? error.message : "Failed to start Vite.");
  });

  child.on("exit", (code, signal) => {
    cleanup();
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 0);
  });

  for (const eventName of ["SIGINT", "SIGTERM"]) {
    process.on(eventName, () => {
      cleanup();
      child.kill(eventName);
    });
  }
}

main();
