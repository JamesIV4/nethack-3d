import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyWasm } from "./scripts/wasm/copy-wasm.mjs";

function copyWasmPlugin() {
  return {
    name: "copy-nethack-wasm",
    buildStart() {
      copyWasm();
    },
  };
}

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  plugins: [copyWasmPlugin(), react()],
  base: isGitHubActions ? "/nethack-3d/" : "/",
  server: {
    allowedHosts: true,
  },
});
