import { describe, expect, it } from "vitest";

import { PraxisError, errors } from "@/core/errors.js";

describe("errors", () => {
  it("factories produce PraxisError instances that are also Errors", () => {
    const err = errors.rootNotFound();
    expect(err).toBeInstanceOf(PraxisError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PraxisError");
  });

  it("rootNotFound", () => {
    const err = errors.rootNotFound();
    expect(err.code).toBe("ROOT_NOT_FOUND");
    expect(err.message).toBe("Could not find Praxis root (no .praxis/ directory found)");
  });

  it("invalidConfigJson", () => {
    const err = errors.invalidConfigJson("/p/.praxis/config.json", "Unexpected token");
    expect(err.code).toBe("INVALID_CONFIG_JSON");
    expect(err.message).toBe("Invalid JSON in /p/.praxis/config.json: Unexpected token");
  });

  it("unknownPlugin", () => {
    const err = errors.unknownPlugin("bogus", ["claude-code", "other"]);
    expect(err.code).toBe("UNKNOWN_PLUGIN");
    expect(err.message).toBe('Unknown plugin: "bogus". Available plugins: claude-code, other');
  });

  it("fileAlreadyExists", () => {
    const err = errors.fileAlreadyExists("roles/dup.md");
    expect(err.code).toBe("FILE_ALREADY_EXISTS");
    expect(err.message).toBe("File already exists: roles/dup.md");
  });

  it("templateNotFound", () => {
    const err = errors.templateNotFound("/scaffold/core/roles/_template.md");
    expect(err.code).toBe("TEMPLATE_NOT_FOUND");
    expect(err.message).toBe("Template not found: /scaffold/core/roles/_template.md");
  });

  it("duplicateJudgeName", () => {
    const err = errors.duplicateJudgeName("flash");
    expect(err.code).toBe("INVALID_JUDGE_CONFIG");
    expect(err.message).toBe(
      'Duplicate judge name "flash" in .praxis/config.json — judge names must be unique',
    );
  });

  it("judgeMissingField", () => {
    const err = errors.judgeMissingField("flash", "apiKeyEnvVar");
    expect(err.code).toBe("INVALID_JUDGE_CONFIG");
    expect(err.message).toBe(
      'Judge "flash" is missing "apiKeyEnvVar" — every judge needs "name", "model", and "apiKeyEnvVar"',
    );
  });

  it("unknownJudge", () => {
    const err = errors.unknownJudge("bogus", ["flash", "local"]);
    expect(err.code).toBe("UNKNOWN_JUDGE");
    expect(err.message).toBe('No judge named "bogus" — configured judges: flash, local');
  });

  it("missingJudges", () => {
    const err = errors.missingJudges();
    expect(err.code).toBe("JUDGES_NOT_CONFIGURED");
    expect(err.message).toContain('"judges": [');
  });

  it("invalidCohortValue", () => {
    const err = errors.invalidCohortValue("by_magic", "docs/services.sme.md");
    expect(err.code).toBe("INVALID_COHORT");
    expect(err.message).toBe(
      'Invalid cohort value "by_magic" in docs/services.sme.md — expected "by_file" or "by_directory"',
    );
  });

  it("unknownDocumentType", () => {
    const err = errors.unknownDocumentType("bogus");
    expect(err.code).toBe("UNKNOWN_DOCUMENT_TYPE");
    expect(err.message).toBe("Unknown document type: bogus");
  });

  it("specNotFound", () => {
    const err = errors.specNotFound("SPEC.md", "/p/roles", "/p/roles/doc.md");
    expect(err.code).toBe("SPEC_NOT_FOUND");
    expect(err.message).toBe("No SPEC.md found in /p/roles for /p/roles/doc.md");
  });

  it("specPatternNotFound", () => {
    const err = errors.specPatternNotFound("*.sme.md", "/p/roles", "/p/roles/doc.md");
    expect(err.code).toBe("SPEC_NOT_FOUND");
    expect(err.message).toBe("No file matching '*.sme.md' found in /p/roles for /p/roles/doc.md");
  });

  it("apiKeyNotSet", () => {
    const err = errors.apiKeyNotSet("OPENROUTER_API_KEY");
    expect(err.code).toBe("API_KEY_NOT_SET");
    expect(err.message).toBe("OPENROUTER_API_KEY environment variable not set");
  });

  it("judgeApiError", () => {
    const err = errors.judgeApiError("openrouter", 502, "upstream unavailable");
    expect(err.code).toBe("JUDGE_API_ERROR");
    expect(err.message).toBe('Judge provider "openrouter" API error (502): upstream unavailable');
  });

  it("unknownJudgeProvider", () => {
    const err = errors.unknownJudgeProvider("bogus", ["openrouter"]);
    expect(err.code).toBe("UNKNOWN_JUDGE_PROVIDER");
    expect(err.message).toBe(
      'Unknown judge provider: "bogus". Built-in providers: openrouter. ' +
        "A custom provider must be a ./relative module path.",
    );
  });

  it("judgeProviderLoadFailed", () => {
    const err = errors.judgeProviderLoadFailed("./providers/echo.js", "Cannot find module");
    expect(err.code).toBe("JUDGE_PROVIDER_LOAD_FAILED");
    expect(err.message).toBe(
      'Failed to load judge provider "./providers/echo.js": Cannot find module',
    );
  });

  it("invalidJudgeProvider", () => {
    const err = errors.invalidJudgeProvider(
      "./providers/echo.js",
      "default export is not a function",
    );
    expect(err.code).toBe("INVALID_JUDGE_PROVIDER");
    expect(err.message).toBe(
      'Invalid judge provider "./providers/echo.js": default export is not a function — ' +
        "a provider module's default export must be a factory returning { name, judge() }",
    );
  });

  it("judgeProviderFailed", () => {
    const err = errors.judgeProviderFailed("echo", "socket hang up");
    expect(err.code).toBe("JUDGE_PROVIDER_FAILED");
    expect(err.message).toBe('Judge provider "echo" failed: socket hang up');
  });

  it("noToolCall", () => {
    const err = errors.noToolCall();
    expect(err.code).toBe("NO_TOOL_CALL");
    expect(err.message).toBe(
      "Model did not return a tool call. Ensure the configured model supports tool calling.",
    );
  });

  it("unexpectedToolCall", () => {
    const err = errors.unexpectedToolCall("validation_bogus");
    expect(err.code).toBe("UNEXPECTED_TOOL_CALL");
    expect(err.message).toBe("Unexpected validation tool call: validation_bogus");
  });
});
