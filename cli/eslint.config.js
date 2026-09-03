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
          internalPattern: ["^@/", "^@framework/", "^@tests/"],
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
    files: ["src/**/*.ts", "tests/**/*.ts", "packages/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message:
                "Use the @/ (src), @framework/ (packages/framework), or @tests/ path aliases instead of relative imports.",
            },
          ],
        },
      ],
    },
  },
  {
    // Layers, one directory each, dependencies flowing one way:
    //
    //   @framework (package)  ->  helpers, templates  ->  models  ->
    //   services  ->  orchestrators  ->  commands
    //
    // with views, prompts, providers and plugins as side branches that
    // never reach forward into services or orchestrators. The old
    // spec/eval isolation (11-spec-layer.md) is no longer expressible as
    // a path rule after the collapse; it survives as the documented
    // contract that the compiler writes files the eval side reads.
    //
    // First, the general wall: node:fs and node:path are importable only
    // inside the two helper modules that wrap them. Tests may use the
    // node primitives directly to set up fixtures. (Rule configs replace
    // rather than merge, so the relative-import ban is restated in every
    // block below.)
    files: ["src/**/*.ts", "packages/**/*.ts"],
    ignores: ["src/helpers/files-helper.ts", "src/helpers/paths-helper.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
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
    // The framework package is 'like' a separate npm package: the
    // machinery a CLI is built from, owning nothing of Praxis. It may
    // not import application code at all.
    files: ["packages/framework/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: ["@/*"],
              message:
                "the framework package must not import application code — it is built as if published separately.",
            },
          ],
        },
      ],
    },
  },
  {
    // Helpers are the reusable modules any service may lean on. They
    // may use models, types and the framework — never the layers above
    // them.
    files: ["src/helpers/**/*.ts"],
    ignores: ["src/helpers/files-helper.ts", "src/helpers/paths-helper.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: [
                "@/services/*",
                "@/orchestrators/*",
                "@/views/*",
                "@/commands/*",
                "@/prompts/*",
                "@/providers/*",
                "@/plugins/*",
                "@/templates/*",
              ],
              message:
                "a helper is below every working layer: it must not import services, orchestrators, views, prompts, providers, plugins or templates.",
            },
          ],
        },
      ],
    },
  },
  {
    // files-helper and paths-helper sit outside the node wall so they
    // can wrap node:fs and node:path. That exemption must not also buy
    // them the right to climb the stack, so the helper restriction is
    // restated here without the node: bans.
    files: ["src/helpers/files-helper.ts", "src/helpers/paths-helper.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: [
                "@/services/*",
                "@/orchestrators/*",
                "@/views/*",
                "@/commands/*",
                "@/prompts/*",
                "@/providers/*",
                "@/plugins/*",
                "@/templates/*",
              ],
              message:
                "a helper is below every working layer: it must not import services, orchestrators, views, prompts, providers, plugins or templates.",
            },
          ],
        },
      ],
    },
  },
  {
    // templates/ is a leaf: each file is one emitted document's body as
    // a typed function, importing its parameter types and nothing else.
    files: ["src/templates/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: [
                "@/models/*",
                "@/services/*",
                "@/orchestrators/*",
                "@/views/*",
                "@/commands/*",
                "@/helpers/*",
                "@/prompts/*",
                "@/providers/*",
                "@/plugins/*",
                "@framework/*",
              ],
              message:
                "a template is a body of text and its variables: it imports @/types.js and nothing else.",
            },
          ],
        },
      ],
    },
  },
  {
    // Models are data plus the helpers on that data. Services act on
    // models, never the reverse: an algorithm a model needs lives
    // module-private beside it. No rendering, no workflow.
    files: ["src/models/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: ["@/stores/*", "@/services/*", "@/orchestrators/*", "@/views/*", "@/commands/*"],
              message:
                "stores and services act on models, never the reverse: a model must not import stores, services, orchestrators, views or commands.",
            },
          ],
        },
      ],
    },
  },
  {
    // A store is one file-backed subsystem's handle: its layout, id
    // minting, reads and writes. Stores act on models and never reach
    // upward into services or rendering.
    files: ["src/stores/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: ["@/services/*", "@/orchestrators/*", "@/views/*", "@/commands/*", "@/prompts/*"],
              message:
                "a store owns one file-backed subsystem's IO: it must not import services, orchestrators, views, prompts or commands.",
            },
          ],
        },
      ],
    },
  },
  {
    // Services do the work and return it. They never render and never
    // coordinate each other into a command's workflow — that is the
    // orchestrator's job.
    files: ["src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: ["@/orchestrators/*", "@/views/*", "@/commands/*"],
              message:
                "a service returns its work: it must not import orchestrators, views or commands.",
            },
          ],
        },
      ],
    },
  },
  {
    // Views render and decide nothing. Prompts, providers and plugins
    // are likewise side branches: they may use models, helpers and
    // templates, never the workflow layers.
    files: [
      "src/views/**/*.ts",
      "src/prompts/**/*.ts",
      "src/providers/**/*.ts",
      "src/plugins/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: ["@/services/*", "@/orchestrators/*", "@/commands/*"],
              message:
                "views, prompts, providers and plugins are side branches: they must not import services, orchestrators or commands.",
            },
          ],
        },
      ],
    },
  },
  {
    // An orchestrator sequences services and renders views. It never
    // imports another orchestrator — two commands that share a workflow
    // share the services under it — and nothing imports commands.
    // (Previously convention; a single orchestrators/ directory makes it
    // a path rule.)
    files: ["src/orchestrators/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: ["@/orchestrators/*"],
              message:
                "orchestrators never import each other: what two commands share is a service that has not been extracted yet.",
            },
            {
              group: ["@/commands/*"],
              message: "dependencies flow one way: nothing imports commands.",
            },
          ],
        },
      ],
    },
  },
  {
    // A command is a route: it declares options and hands them to one
    // prepared orchestrator. If it needs anything else, work has leaked
    // upward.
    files: ["src/commands/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "Use the helpers in @/helpers/files-helper.js instead." },
            { name: "node:path", message: "Use the helpers in @/helpers/paths-helper.js instead." },
          ],
          patterns: [
            {
              group: ["./*", "../*", "!../package.json"],
              message: "Use the @/ path alias instead of relative imports.",
            },
            {
              group: [
                "@/services/*",
                "@/models/*",
                "@/views/*",
                "@/helpers/*",
                "@/prompts/*",
                "@/providers/*",
                "@/plugins/*",
                "@/templates/*",
              ],
              message:
                "a command imports its orchestrators and nothing else — no model, service, view or helper.",
            },
          ],
        },
      ],
    },
  },
  {
    // Every type and interface lives in a types.ts: the framework
    // package's for its machinery, src/types.ts for everything Praxis.
    // Modules declare behavior only.
    files: ["src/**/*.ts", "packages/**/*.ts"],
    ignores: ["src/types.ts", "packages/framework/src/types.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSInterfaceDeclaration",
          message:
            "Declare interfaces in src/types.ts (or packages/framework/src/types.ts for framework machinery).",
        },
        {
          selector: "TSTypeAliasDeclaration",
          message:
            "Declare type aliases in src/types.ts (or packages/framework/src/types.ts for framework machinery).",
        },
      ],
    },
  },
  {
    // All terminal output goes through the framework's view kit: Display
    // for stdout reports, Logger for stderr diagnostics. Raw console
    // calls are allowed only inside those two modules.
    files: ["src/**/*.ts", "packages/**/*.ts"],
    ignores: ["packages/framework/src/views/display.ts", "packages/framework/src/views/logger.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    // Every orchestrator is async so prepareOrchestrator has exactly one
    // shape to handle. Dropping `async` from the ones that never await
    // looks tidier and is not: a plain function returning
    // Promise.resolve() throws *synchronously*, so failures would arrive
    // on two different channels depending on the orchestrator. `async`
    // is the contract, not a claim that the body does I/O.
    files: ["src/orchestrators/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    // The config file itself is plain JS and outside the tsconfig project.
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
