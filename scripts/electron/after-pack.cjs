const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");

const launcherMarker = "NetHack 3D Linux launcher";

function fileStartsWithLauncherMarker(filePath) {
  let fileHandle = null;
  try {
    fileHandle = fs.openSync(filePath, "r");
    const prefixBuffer = Buffer.alloc(256);
    const bytesRead = fs.readSync(fileHandle, prefixBuffer, 0, prefixBuffer.length, 0);
    return prefixBuffer.toString("utf8", 0, bytesRead).includes(launcherMarker);
  } catch {
    return false;
  } finally {
    if (fileHandle !== null) {
      fs.closeSync(fileHandle);
    }
  }
}

function createLinuxLauncherScript(executableName) {
  const realExecutableName = `${executableName}.bin`;
  return `#!/bin/bash
# ${launcherMarker}
set -euo pipefail

APP_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
REAL_BIN="$APP_DIR/${realExecutableName}"
APP_CACHE_DIR_NAME="nethack3d"

ensure_private_dir() {
  local dir="$1"
  if [ -z "$dir" ] || [[ "$dir" != /* ]]; then
    return 1
  fi
  mkdir -p "$dir" 2>/dev/null || return 1
  chmod 700 "$dir" 2>/dev/null || true
  [ -d "$dir" ] && [ -w "$dir" ] && [ -x "$dir" ]
}

choose_runtime_root() {
  local runtime_root=""
  if [ -n "\${XDG_RUNTIME_DIR:-}" ]; then
    runtime_root="$XDG_RUNTIME_DIR/$APP_CACHE_DIR_NAME"
    if ensure_private_dir "$runtime_root"; then
      printf '%s\\n' "$runtime_root"
      return 0
    fi
  fi

  local cache_home="\${XDG_CACHE_HOME:-}"
  if [ -z "$cache_home" ] && [ -n "\${HOME:-}" ]; then
    cache_home="$HOME/.cache"
  fi
  if [ -n "$cache_home" ]; then
    runtime_root="$cache_home/$APP_CACHE_DIR_NAME/runtime"
    if ensure_private_dir "$runtime_root"; then
      printf '%s\\n' "$runtime_root"
      return 0
    fi
  fi

  local user_id
  user_id="$(id -u 2>/dev/null || printf 'unknown')"
  runtime_root="/var/tmp/$APP_CACHE_DIR_NAME-$user_id"
  ensure_private_dir "$runtime_root"
  printf '%s\\n' "$runtime_root"
}

RUNTIME_ROOT="$(choose_runtime_root)"
TMPDIR="$RUNTIME_ROOT/tmp"
ensure_private_dir "$TMPDIR"
export TMPDIR TMP="$TMPDIR" TEMP="$TMPDIR"

exec -a "$0" "$REAL_BIN" \\
  --ozone-platform-hint=auto \\
  --disable-dev-shm-usage \\
  --no-sandbox \\
  --disable-gpu-sandbox \\
  "$@"
`;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "linux") {
    return;
  }

  const executableName =
    context.packager?.executableName ||
    context.packager?.appInfo?.productFilename ||
    context.packager?.appInfo?.name;
  if (!executableName) {
    throw new Error("Unable to resolve Linux executable name for launcher wrapper.");
  }

  const launcherPath = path.join(context.appOutDir, executableName);
  const realExecutablePath = path.join(context.appOutDir, `${executableName}.bin`);
  if (!fs.existsSync(launcherPath)) {
    throw new Error(`Linux executable not found: ${launcherPath}`);
  }

  if (fileStartsWithLauncherMarker(launcherPath)) {
    if (!fs.existsSync(realExecutablePath)) {
      throw new Error(`Linux launcher is already wrapped, but the real executable is missing: ${realExecutablePath}`);
    }
  } else {
    if (fs.existsSync(realExecutablePath)) {
      throw new Error(`Refusing to overwrite existing Linux executable backup: ${realExecutablePath}`);
    }
    await fsp.rename(launcherPath, realExecutablePath);
    await fsp.chmod(realExecutablePath, 0o755);
  }

  await fsp.writeFile(launcherPath, createLinuxLauncherScript(executableName), {
    encoding: "utf8",
    mode: 0o755,
  });
  await fsp.chmod(launcherPath, 0o755);
};
