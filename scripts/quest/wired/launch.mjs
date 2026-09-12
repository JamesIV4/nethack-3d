import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const environment = { ...process.env };
// Shells hosted by Electron can otherwise cause Electron to run as plain Node.
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(require("electron"), [fileURLToPath(new URL("./host.mjs", import.meta.url))], {
  cwd: fileURLToPath(new URL("../../../", import.meta.url)),
  env: environment,
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", (error) => {
  console.error(`[quest:wired] Could not start Electron: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
