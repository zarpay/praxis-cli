import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  shims: true,
  // Help documents (src/help/*.md) import as plain strings, so the
  // long-form --help text ships inside the bundle. Vitest mirrors this
  // via the markdown-as-text plugin in vitest.config.ts.
  loader: {
    ".md": "text",
  },
  sourcemap: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
