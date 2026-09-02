import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { OpenRouterProvider } from "@/domains/eval/services/providers/openrouter.js";
import resolveProvider from "@/domains/eval/services/providers/resolve-provider-service.js";

/** A well-formed local provider module returning a canned verdict. */
const ECHO_PROVIDER_SOURCE = `export default function echoProvider() {
  return {
    name: "echo",
    async review(request) {
      return {
        verdict: { compliant: true, issues: [], reason: "echo: " + request.model },
        usage: null,
      };
    },
  };
}
`;

describe("resolveProvider", () => {
  const dirs: string[] = [];

  /** A fresh project root holding the given provider module source. */
  function makeProjectWithModule(source: string, filename = "echo.mjs"): string {
    const root = join(tmpdir(), `praxis-provider-test-${randomUUID()}`);
    mkdirSync(join(root, "praxis-providers"), { recursive: true });
    writeFileSync(join(root, "praxis-providers", filename), source);
    dirs.push(root);
    return root;
  }

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("resolves the built-in openrouter provider by name", async () => {
    const provider = await resolveProvider("openrouter");

    expect(provider).toBeInstanceOf(OpenRouterProvider);
    expect(provider.name).toBe("openrouter");
  });

  it("rejects an unknown provider name, listing the built-ins", async () => {
    const resolution = resolveProvider("bogus");

    await expect(resolution).rejects.toThrow(
      'Unknown reviewer provider: "bogus". Built-in providers: openrouter',
    );
  });

  it("loads a local provider module from a relative path", async () => {
    const root = makeProjectWithModule(ECHO_PROVIDER_SOURCE);

    const provider = await resolveProvider("./praxis-providers/echo.mjs", root);
    const result = await provider.review({
      systemPrompt: "s",
      userPrompt: "u",
      tools: [],
      model: "m",
      temperature: 0,
      baseUrl: "https://unused.example",
      apiKey: "k",
      options: {},
    });

    expect(provider.name).toBe("echo");
    expect(result.verdict.reason).toBe("echo: m");
  });

  it("rejects a relative path when no project root is available", async () => {
    const resolution = resolveProvider("./praxis-providers/echo.mjs");

    await expect(resolution).rejects.toThrow("Failed to load reviewer provider");
  });

  it("rejects a module that cannot be imported", async () => {
    const root = makeProjectWithModule(ECHO_PROVIDER_SOURCE);

    const resolution = resolveProvider("./praxis-providers/missing.mjs", root);

    await expect(resolution).rejects.toThrow(
      'Failed to load reviewer provider "./praxis-providers/missing.mjs"',
    );
  });

  it("rejects a module whose default export is not a function", async () => {
    const root = makeProjectWithModule("export default { not: 'a factory' };\n");

    const resolution = resolveProvider("./praxis-providers/echo.mjs", root);

    await expect(resolution).rejects.toThrow("default export is not a factory function");
  });

  it("rejects a factory whose result does not implement the contract", async () => {
    const root = makeProjectWithModule("export default () => ({ name: 'broken' });\n");

    const resolution = resolveProvider("./praxis-providers/echo.mjs", root);

    await expect(resolution).rejects.toThrow("factory returned an object without a review()");
  });
});
