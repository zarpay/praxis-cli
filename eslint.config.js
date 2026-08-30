import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
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
      // Braces required whenever a statement spans multiple lines;
      // single-line guards like `if (x) return;` stay legal.
      curly: ["error", "multi-line"],
      // Type-only imports must use `import type`, keeping runtime
      // imports distinct from erased ones.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
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
      // Commander's .action() accepts async callbacks by design; without
      // this exception every async CLI action would be flagged.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false } },
      ],
    },
  },
  {
    // File and path operations go through the standard core modules;
    // node:fs and node:path are importable only inside them. Tests may
    // use the node primitives directly to set up fixtures.
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
        },
      ],
    },
  },
  {
    // The config file itself is plain JS and outside the tsconfig project.
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
