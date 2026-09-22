import { defineConfig } from "vitest/config";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Loads .md imports as their raw text — the same contract as tsup's
 * `loader: { ".md": "text" }`, so tests resolve the help documents
 * exactly the way the build does.
 */
const markdownAsText = {
  name: "markdown-as-text",
  enforce: "pre" as const,
  load(id: string) {
    if (!id.endsWith(".md")) return null;

    return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
  },
};

export default defineConfig({
  plugins: [markdownAsText],
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
