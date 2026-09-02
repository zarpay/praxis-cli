import type { ProviderRequest } from "@/domains/eval/types.js";

import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { OpenRouterProvider } from "@/domains/eval/providers/openrouter.js";
import {
  OPENROUTER_URL,
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";

const server = createOpenRouterServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A fully-prepared request; tests vary one field at a time. */
function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    systemPrompt: "You reviewer things.",
    userPrompt: "Reviewer this.",
    tools: [{ type: "function", function: { name: "validation_pass" } }],
    model: "test-model",
    temperature: 0.1,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "test-key",
    options: {},
    ...overrides,
  };
}

/** Captures the JSON body of the next OpenRouter request. */
function captureBody(bodies: Record<string, unknown>[]): void {
  server.use(
    http.post(OPENROUTER_URL, async ({ request: req }) => {
      bodies.push((await req.json()) as Record<string, unknown>);
      return HttpResponse.json(validationToolCallResponse("validation_pass", { reason: "Fine." }));
    }),
  );
}

describe("OpenRouterProvider", () => {
  describe("verdict mapping", () => {
    it("maps validation_pass to a compliant verdict", async () => {
      useOpenRouterResponse(
        server,
        validationToolCallResponse("validation_pass", { reason: "All good." }),
      );

      const result = await new OpenRouterProvider().review(request());

      expect(result.verdict).toEqual({ compliant: true, issues: [], reason: "All good." });
    });

    it("maps validation_warn to a warning verdict", async () => {
      useOpenRouterResponse(
        server,
        validationToolCallResponse("validation_warn", { reason: "Meh.", issues: ["Minor gap"] }),
      );

      const result = await new OpenRouterProvider().review(request());

      expect(result.verdict).toEqual({
        compliant: false,
        severity: "warning",
        issues: ["Minor gap"],
        reason: "Meh.",
      });
    });

    it("maps validation_fail to an error verdict", async () => {
      useOpenRouterResponse(
        server,
        validationToolCallResponse("validation_fail", { reason: "Bad.", issues: ["Broken"] }),
      );

      const result = await new OpenRouterProvider().review(request());

      expect(result.verdict).toEqual({
        compliant: false,
        severity: "error",
        issues: ["Broken"],
        reason: "Bad.",
      });
    });

    it("throws when the model returns no tool call", async () => {
      useOpenRouterResponse(server, { choices: [{ message: { role: "assistant" } }] });

      const review = new OpenRouterProvider().review(request());

      await expect(review).rejects.toThrow("did not return a tool call");
    });

    it("throws on an unexpected tool call", async () => {
      useOpenRouterResponse(
        server,
        validationToolCallResponse("validation_bogus" as never, { reason: "?" }),
      );

      const review = new OpenRouterProvider().review(request());

      await expect(review).rejects.toThrow("Unexpected validation tool call");
    });

    it("reports API failures with the provider's name", async () => {
      useOpenRouterResponse(server, { error: "upstream unavailable" }, 502);

      const review = new OpenRouterProvider().review(request());

      await expect(review).rejects.toThrow('Reviewer provider "openrouter" API error (502)');
    });
  });

  describe("request construction", () => {
    it("requests OpenRouter usage accounting on openrouter.ai hosts", async () => {
      const bodies: Record<string, unknown>[] = [];
      captureBody(bodies);

      await new OpenRouterProvider().review(request());

      expect(bodies[0]["usage"]).toEqual({ include: true });
    });

    it("omits usage accounting for other OpenAI-compatible hosts", async () => {
      const bodies: Record<string, unknown>[] = [];
      server.use(
        http.post("https://inference.internal/v1/chat/completions", async ({ request: req }) => {
          bodies.push((await req.json()) as Record<string, unknown>);
          return HttpResponse.json(
            validationToolCallResponse("validation_pass", { reason: "Fine." }),
          );
        }),
      );

      await new OpenRouterProvider().review(request({ baseUrl: "https://inference.internal/v1" }));

      expect(bodies[0]["usage"]).toBeUndefined();
    });

    it("merges options into the request body", async () => {
      const bodies: Record<string, unknown>[] = [];
      captureBody(bodies);

      await new OpenRouterProvider().review(request({ options: { reasoning: { effort: "low" } } }));

      expect(bodies[0]["reasoning"]).toEqual({ effort: "low" });
    });

    it("never lets options clobber the protocol fields", async () => {
      const bodies: Record<string, unknown>[] = [];
      captureBody(bodies);

      const clobbering = { model: "evil-model", tool_choice: "none", temperature: 2 };
      await new OpenRouterProvider().review(request({ options: clobbering }));

      expect(bodies[0]["model"]).toBe("test-model");
      expect(bodies[0]["tool_choice"]).toBe("required");
      expect(bodies[0]["temperature"]).toBe(0.1);
    });
  });

  describe("usage normalization", () => {
    it("normalizes tokens and cost when the backend reports them", async () => {
      useOpenRouterResponse(
        server,
        validationToolCallResponse(
          "validation_pass",
          { reason: "Fine." },
          { prompt_tokens: 812, completion_tokens: 41, cost: 0.00042 },
        ),
      );

      const result = await new OpenRouterProvider().review(request());

      expect(result.usage).toEqual({ promptTokens: 812, completionTokens: 41, costUsd: 0.00042 });
    });

    it("reports null cost when the backend reports tokens without cost", async () => {
      useOpenRouterResponse(
        server,
        validationToolCallResponse(
          "validation_pass",
          { reason: "Fine." },
          { prompt_tokens: 812, completion_tokens: 41 },
        ),
      );

      const result = await new OpenRouterProvider().review(request());

      expect(result.usage).toEqual({ promptTokens: 812, completionTokens: 41, costUsd: null });
    });

    it("reports null usage when the backend reports none", async () => {
      useOpenRouterResponse(
        server,
        validationToolCallResponse("validation_pass", { reason: "Fine." }),
      );

      const result = await new OpenRouterProvider().review(request());

      expect(result.usage).toBeNull();
    });
  });
});
