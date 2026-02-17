import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

const src = resolve(PROJECT_ROOT, "node_modules/@neth4ck/wasm-367/build/nethack.wasm");
const dest = resolve(PROJECT_ROOT, "public/nethack.wasm");

export function copyWasm() {
  if (!existsSync(src)) {
    throw new Error("@neth4ck/wasm-367 build not found -- run npm install first");
  }
  mkdirSync(resolve(PROJECT_ROOT, "public"), { recursive: true });
  copyFileSync(src, dest);
}
