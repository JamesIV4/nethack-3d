import { defineConfig } from "vitest/config";

// Dedicated config so unit tests run in a clean Node environment without the
// app's heavy Vite plugin chain (React, WASM assets, build-time env defines).
// save-storage regression tests only rely on pure logic, so import.meta.env
// falls back to the in-code default compat tags.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
