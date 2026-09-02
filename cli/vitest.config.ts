import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@framework": resolve(__dirname, "packages/framework/src"),
      "@": resolve(__dirname, "src"),
      "@tests": resolve(__dirname, "tests"),
    },
  },
  test: {
    globals: true,
    testTimeout: 10_000,
  },
});
