import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const isParallel = args.has("--parallel");
const isDryRun = args.has("--dry-run");
const parallelOutputRoot = "release/.parallel";
const windowsParallelOutputDir = `${parallelOutputRoot}/win`;
const linuxParallelOutputDir = `${parallelOutputRoot}/linux`;
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

async function runOrExit(command, commandArgs, extraEnv = {}) {
  const printable = `${command} ${commandArgs.join(" ")}`;
  if (isDryRun) {
    logInfo(`[dry-run] ${printable}`);
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(shouldUseColor() && process.env.FORCE_COLOR == null ? { FORCE_COLOR: "1" } : {}),
        ...extraEnv,
      },
    });

    forwardStreamWithPrefix(child.stdout, process.stdout, "");
    forwardStreamWithPrefix(child.stderr, process.stderr, "");

    child.on("error", (error) => {
      const message = error.code === "ENOENT"
        ? `Required command not found: ${command}`
        : error.message;
      reject(new Error(message));
    });

    child.on("exit", (code, signal) => {
      if (typeof code === "number" && code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }

      if (signal) {
        reject(new Error(`${command} exited due to signal ${signal}`));
        return;
      }

      resolve();
    });
  });
}

async function runNpmOrExit(npmArgs, extraEnv = {}) {
  await runOrExit(
    npmRunner.command,
    [...npmRunner.baseArgs, ...npmArgs],
    extraEnv,
  );
}

function quoteShellArg(value) {
  if (/^[A-Za-z0-9_./:=+\\-]+$/.test(value)) {
    return value;
  }

  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatCommandForShell(command, args = []) {
  return [command, ...args].map(quoteShellArg).join(" ");
}

const ansiColors = {
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  gray: "\u001b[90m",
  reset: "\u001b[0m",
};

function shouldUseColor() {
  return (process.stdout.isTTY || process.stderr.isTTY) && !("NO_COLOR" in process.env);
}

function canUseStickyStatus() {
  return process.stdout.isTTY && process.stderr.isTTY;
}

function colorizeLabel(label, colorName) {
  if (!shouldUseColor()) {
    return label;
  }

  const colorCode = ansiColors[colorName] ?? "";
  if (!colorCode) {
    return label;
  }

  return `${colorCode}${label}${ansiColors.reset}`;
}

function formatSuccessBanner(message) {
  if (!shouldUseColor()) {
    return `DONE: ${message}`;
  }

  return `\u001b[1;30;102m DONE \u001b[0m \u001b[1;92m${message}\u001b[0m`;
}

function formatProgressLine(completedSteps, totalSteps, message) {
  const progressCount = `${completedSteps}/${totalSteps}`;
  const defaultBarWidth = 24;
  const minimumBarWidth = 10;
  const fixedWidth = "PROGRESS [] ".length + progressCount.length + 1 + message.length;
  const barWidth = process.stdout.isTTY && typeof process.stdout.columns === "number"
    ? Math.max(minimumBarWidth, process.stdout.columns - fixedWidth)
    : defaultBarWidth;
  const filledWidth = totalSteps === 0
    ? barWidth
    : Math.round((completedSteps / totalSteps) * barWidth);
  const emptyWidth = Math.max(0, barWidth - filledWidth);
  const bar = `${"#".repeat(filledWidth)}${"-".repeat(emptyWidth)}`;
  const baseLine = `PROGRESS [${bar}] ${progressCount} ${message}`;

  if (!shouldUseColor()) {
    return baseLine;
  }

  return `\u001b[1;36mPROGRESS\u001b[0m [\u001b[1;32m${"#".repeat(filledWidth)}\u001b[90m${"-".repeat(emptyWidth)}\u001b[0m] \u001b[1;36m${progressCount}\u001b[0m ${message}`;
}

function createStatusRenderer() {
  const stickyStatusEnabled = canUseStickyStatus();
  let footerText = "";
  let footerVisible = false;

  function clearFooter() {
    if (!stickyStatusEnabled || !footerVisible) {
      return;
    }

    process.stdout.write("\r\u001b[2K");
    footerVisible = false;
  }

  function drawFooter() {
    if (!stickyStatusEnabled || !footerText) {
      return;
    }

    process.stdout.write(`\r${footerText}`);
    footerVisible = true;
  }

  function write(destination, text) {
    if (!text) {
      return;
    }

    clearFooter();
    destination.write(text);
    drawFooter();
  }

  return {
    write,
    writeLine(destination, text) {
      write(destination, `${text}\n`);
    },
    updateStatus(text) {
      if (!stickyStatusEnabled) {
        return false;
      }

      footerText = text;
      clearFooter();
      drawFooter();
      return true;
    },
    clearStatus() {
      footerText = "";
      clearFooter();
    },
    finalize(text) {
      footerText = "";
      clearFooter();
      if (text) {
        process.stdout.write(`${text}\n`);
      }
    },
  };
}

const statusRenderer = createStatusRenderer();

function logInfo(message) {
  statusRenderer.writeLine(process.stdout, message);
}

function logWarn(message) {
  statusRenderer.writeLine(process.stderr, message);
}

function logError(message) {
  statusRenderer.writeLine(process.stderr, message);
}

function createProgressTracker(totalSteps) {
  let completedSteps = 0;

  function render(message) {
    const progressLine = formatProgressLine(completedSteps, totalSteps, message);
    if (!statusRenderer.updateStatus(progressLine)) {
      logInfo(progressLine);
    }
  }

  return {
    start(message) {
      render(message);
    },
    advance(message) {
      completedSteps += 1;
      render(message);
    },
  };
}

function getJobPrefix(job, longestLabelLength) {
  const paddedLabel = job.label.padEnd(longestLabelLength);
  return `${colorizeLabel(`[${paddedLabel}]`, job.prefixColor)} `;
}

function forwardStreamWithPrefix(stream, destination, prefix) {
  if (!stream) {
    return;
  }

  stream.setEncoding("utf8");
  let bufferedLine = "";

  function flushBufferedLine(forceNewline = false) {
    if (!bufferedLine) {
      return;
    }

    statusRenderer.write(destination, `${prefix}${bufferedLine}`);
    if (forceNewline && !bufferedLine.endsWith("\n")) {
      statusRenderer.write(destination, "\n");
    }
    bufferedLine = "";
  }

  stream.on("data", (chunk) => {
    const normalizedChunk = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const pieces = normalizedChunk.split("\n");

    bufferedLine += pieces.shift() ?? "";
    for (const piece of pieces) {
      statusRenderer.write(destination, `${prefix}${bufferedLine}\n`);
      bufferedLine = piece;
    }
  });

  stream.on("end", () => {
    flushBufferedLine(true);
  });
}

function runParallelJobsOrExit(jobs, options = {}) {
  if (isDryRun) {
    for (const job of jobs) {
      const cmd = formatCommandForShell(job.command, job.args);
      logInfo(`[dry-run] [${job.label}] ${cmd}`);
      options.onJobComplete?.(job);
    }
    return Promise.resolve();
  }

  const longestLabelLength = Math.max(...jobs.map((job) => job.label.length));
  const children = new Map();
  let remainingChildren = jobs.length;
  let firstError = null;

  function terminateChild(child, label) {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    if (process.platform === "win32") {
      const result = spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        shell: false,
      });
      if (result.error && result.error.code !== "ESRCH") {
        logWarn(`Failed to terminate ${label} job tree: ${result.error.message}`);
      }
      return;
    }

    try {
      child.kill("SIGTERM");
    } catch (error) {
      logWarn(`Failed to terminate ${label} job: ${error.message}`);
    }
  }

  return new Promise((resolve, reject) => {
    const settleIfDone = () => {
      if (remainingChildren > 0) {
        return;
      }

      if (firstError) {
        reject(firstError);
        return;
      }

      resolve();
    };

    const fail = (error, failedLabel) => {
      if (!firstError) {
        firstError = error;
      }

      for (const [label, child] of children.entries()) {
        if (label !== failedLabel) {
          terminateChild(child, label);
        }
      }
    };

    for (const job of jobs) {
      const child = spawn(job.command, job.args, {
        cwd: process.cwd(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          ...(shouldUseColor() && process.env.FORCE_COLOR == null ? { FORCE_COLOR: "1" } : {}),
          ...(job.env ?? {}),
        },
      });

      const prefix = getJobPrefix(job, longestLabelLength);
      forwardStreamWithPrefix(child.stdout, process.stdout, prefix);
      forwardStreamWithPrefix(child.stderr, process.stderr, prefix);

      children.set(job.label, child);
      let childFinished = false;

      child.on("error", (error) => {
        if (childFinished) {
          return;
        }
        childFinished = true;
        children.delete(job.label);
        remainingChildren -= 1;

        const message = error.code === "ENOENT"
          ? `Required command not found for ${job.label}: ${job.command}`
          : error.message;
        fail(new Error(message), job.label);
        settleIfDone();
      });

      child.on("exit", (code, signal) => {
        if (childFinished) {
          return;
        }
        childFinished = true;
        children.delete(job.label);
        remainingChildren -= 1;

        if (!firstError) {
          if (typeof code === "number" && code !== 0) {
            fail(new Error(`${job.label} job failed with exit code ${code}`), job.label);
          } else if (signal) {
            fail(new Error(`${job.label} job exited due to signal ${signal}`), job.label);
          } else {
            options.onJobComplete?.(job);
          }
        }

        settleIfDone();
      });
    }
  });
}

function ensureCleanParallelOutputRoot() {
  const absoluteParallelOutputRoot = path.resolve(process.cwd(), parallelOutputRoot);
  fs.rmSync(absoluteParallelOutputRoot, { recursive: true, force: true });
  fs.mkdirSync(absoluteParallelOutputRoot, { recursive: true });
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function isRetryableFilesystemError(error) {
  return error && ["EBUSY", "ENOTEMPTY", "EPERM"].includes(error.code);
}

function replacePathWithRetries(sourcePath, destinationPath) {
  const maxAttempts = 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      fs.rmSync(destinationPath, { recursive: true, force: true });
      fs.renameSync(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (!isRetryableFilesystemError(error) || attempt === maxAttempts) {
        throw error;
      }

      sleep(500);
    }
  }
}

function renameParallelMetadataFile(fileName, label) {
  if (fileName === "builder-debug.yml") {
    return `builder-debug.${label}.yml`;
  }

  if (fileName === "builder-effective-config.yaml") {
    return `builder-effective-config.${label}.yaml`;
  }

  return fileName;
}

function moveParallelOutputIntoRelease(sourceRelativeDir, label) {
  const sourceDir = path.resolve(process.cwd(), sourceRelativeDir);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Expected ${label} output directory at ${sourceRelativeDir}, but it was not created.`);
  }

  const releaseDir = path.resolve(process.cwd(), "release");
  fs.mkdirSync(releaseDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(releaseDir, renameParallelMetadataFile(entry.name, label));
    replacePathWithRetries(sourcePath, destinationPath);
  }
}

function finalizeParallelOutputsOrExit() {
  if (isDryRun) {
    logInfo(`[dry-run] merge ${windowsParallelOutputDir} + ${linuxParallelOutputDir} into release/`);
    return;
  }

  moveParallelOutputIntoRelease(windowsParallelOutputDir, "win");
  moveParallelOutputIntoRelease(linuxParallelOutputDir, "linux");
  fs.rmSync(path.resolve(process.cwd(), parallelOutputRoot), { recursive: true, force: true });
}

async function main() {
  const progressTracker = createProgressTracker(isParallel ? 5 : 4);
  progressTracker.start("Starting Electron packaging pipeline");

  logInfo("Building Electron web assets once...");
  await runNpmOrExit(["run", "build:electron"]);
  progressTracker.advance("Built Electron web assets");

  const windowsAllTargetsArgs = ["scripts/electron/dist-windows.mjs"];
  const linuxAllTargetsArgs = ["scripts/electron/dist-linux-appimage.mjs"];

  if (isParallel) {
    logInfo("Preparing Linux packaging prerequisites before parallel packaging...");
    if (!isDryRun) {
      ensureCleanParallelOutputRoot();
    }
    await runOrExit("node", linuxAllTargetsArgs, {
      NH3D_SKIP_ELECTRON_BUILD: "1",
      NH3D_APPIMAGE_PREPARE_ONLY: "1",
      NH3D_ELECTRON_OUTPUT_DIR: linuxParallelOutputDir,
    });
    progressTracker.advance("Prepared Linux packaging prerequisites");

    logInfo("Packaging Windows and Linux targets in parallel...");
    await runParallelJobsOrExit([
      {
        label: "windows",
        command: process.execPath,
        args: windowsAllTargetsArgs,
        env: {
          NH3D_SKIP_ELECTRON_BUILD: "1",
          NH3D_ELECTRON_OUTPUT_DIR: windowsParallelOutputDir,
        },
        prefixColor: "blue",
      },
      {
        label: "linux",
        command: process.execPath,
        args: linuxAllTargetsArgs,
        env: {
          NH3D_SKIP_ELECTRON_BUILD: "1",
          NH3D_APPIMAGE_SKIP_PREPARE: "1",
          NH3D_ELECTRON_OUTPUT_DIR: linuxParallelOutputDir,
        },
        prefixColor: "magenta",
      },
    ], {
      onJobComplete(job) {
        if (job.label === "windows") {
          progressTracker.advance("Finished Windows packaging");
        } else if (job.label === "linux") {
          progressTracker.advance("Finished Linux packaging");
        }
      },
    });
    finalizeParallelOutputsOrExit();
    progressTracker.advance("Merged staged artifacts into release/");
  } else {
    logInfo("Packaging Windows setup + x64 and legacy x86 portable executables...");
    await runOrExit(process.execPath, windowsAllTargetsArgs, {
      NH3D_SKIP_ELECTRON_BUILD: "1",
    });
    progressTracker.advance("Finished Windows packaging");
    logInfo("Packaging Linux AppImage...");
    await runOrExit("node", linuxAllTargetsArgs, { NH3D_SKIP_ELECTRON_BUILD: "1" });
    progressTracker.advance("Finished Linux packaging");
    progressTracker.advance("Completed release packaging");
  }

  statusRenderer.finalize(formatSuccessBanner("Artifacts are in release/."));
}

main().catch((error) => {
  statusRenderer.clearStatus();
  logError(error.message);
  process.exit(1);
});
