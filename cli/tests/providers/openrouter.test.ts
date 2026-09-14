import type { ProviderRequest } from "@/types.js";

import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { OpenRouterProvider } from "@/providers/openrouter.js";
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
        issues: [{ text: "Minor gap", axiomId: null, axiomVersion: null }],
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
        issues: [{ text: "Broken", axiomId: null, axiomVersion: null }],
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

  describe("malformed tool-call arguments", () => {
    /** A response whose tool call carries `args` verbatim, valid JSON or not. */
    function rawArgumentsResponse(args: string, finishReason: string): object {
      return {
        choices: [
          {
            finish_reason: finishReason,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "validation_fail", arguments: args },
                },
              ],
            },
          },
        ],
      };
    }

    /** The message of the error one review threw. */
    async function failureMessage(args: string, finishReason: string): Promise<string> {
      useOpenRouterResponse(server, rawArgumentsResponse(args, finishReason));

      return await new OpenRouterProvider()
        .review(request())
        .then(() => "")
        .catch((err: Error) => err.message);
    }

    it("reports the parser's own complaint rather than swallowing it", async () => {
      const broken = `{"reason": "${"padding ".repeat(20)}" "issues": []}`;
      const message = await failureMessage(broken, "tool_calls");

      expect(message).toContain("not valid JSON");
      // The parser names what it expected and where; that is the whole
      // diagnostic, and it used to be discarded.
      expect(message).toMatch(/position \d+|Expected|Unexpected/);
    });

    it("shows the text around the failure, not just a length", async () => {
      const broken = `{"reason": "${"padding ".repeat(20)}" "issues": []}`;
      const message = await failureMessage(broken, "tool_calls");

      expect(message).toContain("near:");
      expect(message).toContain("padding");
    });

    it("does not blame max_tokens for a complete but malformed payload", async () => {
      const message = await failureMessage('{"reason": "a" "issues": []}', "tool_calls");

      expect(message).toContain("complete but malformed");
      expect(message).not.toContain("raise max_tokens");
    });

    it("blames max_tokens when the response was cut off", async () => {
      const message = await failureMessage('{"reason": "cut off here', "length");

      expect(message).toContain("cut off");
      expect(message).toContain("raise max_tokens");
    });

    it("trusts where the parser died over a finish_reason that says otherwise", async () => {
      // Observed on deepseek via OpenRouter: arguments cut mid-array,
      // finish_reason still "tool_calls". The position is at the end of
      // the payload, which is what truncation looks like.
      const cut = '{"reason": "ok", "issues": [{"text": "unclosed"}';
      const message = await failureMessage(cut, "tool_calls");

      expect(message).toContain("end before the JSON closes");
      expect(message).toContain('despite finish_reason "tool_calls"');
      expect(message).toContain("raise max_tokens");
    });

    it("makes a raw newline visible instead of breaking the message over lines", async () => {
      const message = await failureMessage('{"reason": "line one\nline two"}', "tool_calls");

      expect(message).toContain("\\n");
      expect(message.split("\n")).toHaveLength(1);
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

    it("asks for one whole body, never a stream", async () => {
      const bodies: Record<string, unknown>[] = [];
      captureBody(bodies);

      await new OpenRouterProvider().review(request({}));

      expect(bodies[0]["stream"]).toBe(false);
    });

    it("refuses to stream even when options ask for it", async () => {
      const bodies: Record<string, unknown>[] = [];
      captureBody(bodies);

      // Spread first, `stream` would reach the wire and come back as SSE
      // — which response.json() cannot parse. It is praxis's field.
      await new OpenRouterProvider().review(request({ options: { stream: true } }));

      expect(bodies[0]["stream"]).toBe(false);
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
