import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";

/**
 * ESLint configuration.
 *
 * Layers, in order of application:
 * 1. eslint recommended — baseline JavaScript correctness rules
 * 2. typescript-eslint recommendedTypeChecked — type-aware safety rules
 *    (no-floating-promises, no-unsafe-*, await-thenable, ...)
 * 3. typescript-eslint stylisticTypeChecked — conventional idiom rules
 *    (prefer-nullish-coalescing, prefer-optional-chain, ...)
 * 4. Project rule overrides (documented inline below)
 * 5. eslint-config-prettier — disables any rule that would fight Prettier
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      "@stylistic": stylistic,
      "import-x": importX,
      perfectionist,
    },
    languageOptions: {
      parserOptions: {
        // Type-aware linting: derive type information from the nearest tsconfig.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Always use === / !==; loose equality hides coercion bugs.
      eqeqeq: ["error", "always"],
      // A ternary inside a ternary is unreadable; use if/else or a
      // small helper instead.
      "no-nested-ternary": "error",
      // Braces required whenever a statement spans multiple lines;
      // single-line guards like `if (x) return;` stay legal.
      curly: ["error", "multi-line"],
      // Type-only imports must use top-level `import type` statements,
      // so the import groups below can separate types from values.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      // Mixed imports (type + value from one module) are split so the
      // type half joins the type groups instead of hiding inline.
      "import-x/consistent-type-specifier-style": ["error", "prefer-top-level"],
      // Unused variables are errors, but underscore-prefixed parameters
      // are allowed (the conventional "intentionally unused" marker).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Bracket access is this codebase's convention for index-signature
      // lookups (process.env["KEY"], frontmatter["field"]) and the only
      // way tests can reach private members; dot access stays enforced
      // for declared properties.
      "@typescript-eslint/dot-notation": [
        "error",
        { allowIndexSignaturePropertyAccess: true, allowPrivateClassPropertyAccess: true },
      ],
      // Empty arrow functions are idiomatic no-op callbacks
      // (e.g. mockImplementation(() => {})); named empty functions
      // remain flagged.
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
      // Imports are grouped: third-party types, internal types,
      // third-party values, internal values — blank line between
      // groups, alphabetical within them. Autofixable.
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          newlinesBetween: 1,
          internalPattern: ["^@/", "^@tests/"],
          groups: [
            ["type-builtin", "type-external"],
            ["type-internal", "type-tsconfig-path"],
            ["builtin", "external"],
            ["internal", "tsconfig-path"],
            ["type-parent", "type-sibling", "type-index", "parent", "sibling", "index"],
            "unknown",
          ],
        },
      ],
      // Conditionals breathe: a blank line before and after every if
      // and switch — except at the start or end of a block, where
      // there is no neighboring statement to pad against.
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: ["if", "switch"] },
        { blankLine: "always", prev: ["if", "switch"], next: "*" },
      ],
      // Commander's .action() accepts async callbacks by design; without
      // this exception every async CLI action would be flagged.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false } },
      ],
    },
  },
  {
    // Imports always use path aliases (@/, @tests/), never relative
    // paths. The one exception is the package manifest, which lives
    // above src/ and has no alias.
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ (src) or @tests/ path aliases instead of relative imports.",
            },
          ],
        },
      ],
    },
  },
  {
    // File and path operations go through the standard core modules;
    // node:fs and node:path are importable only inside them. Tests may
    // use the node primitives directly to set up fixtures. (Rule
    // configs replace rather than merge, so the relative-import ban is
    // restated here.)
    files: ["src/**/*.ts"],
    ignores: ["src/core/files.ts", "src/core/paths.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/core/files.js instead." },
            { name: "node:path", message: "Use the helpers in @/core/paths.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
          ],
        },
      ],
    },
  },
  {
    // The two layers (11-spec-layer.md) never import each other: the
    // spec layer produces artifacts the eval layer consumes as plain
    // files, and the eval layer never calls back. Shared primitives
    // live in @/core; commands may wire both layers together. These
    // blocks come last and restate the fs/path and relative-import
    // bans, because rule configs replace rather than merge.
    files: ["src/eval/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/core/files.js instead." },
            { name: "node:path", message: "Use the helpers in @/core/paths.js instead." },
          ],
          patterns: [
            { group: ["./*", "../*", "!../package.json"], message: "Use the @/ path alias instead of relative imports." },
            { group: ["@/spec/*"], message: "The eval layer must not depend on the spec layer (11-spec-layer.md)." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/spec/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/core/files.js instead." },
            { name: "node:path", message: "Use the helpers in @/core/paths.js instead." },
          ],
          patterns: [
            { group: ["./*", "../*", "!../package.json"], message: "Use the @/ path alias instead of relative imports." },
            { group: ["@/eval/*"], message: "The spec layer must not depend on the eval layer (11-spec-layer.md)." },
          ],
        },
      ],
    },
  },
  {
    // All terminal output goes through the logger module: Display for
    // stdout reports, Logger for stderr diagnostics. Raw console calls
    // are allowed only inside that module.
    files: ["src/**/*.ts"],
    ignores: ["src/core/logger.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    // The config file itself is plain JS and outside the tsconfig project.
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
