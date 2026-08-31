/**
 * A custom judge provider — the demo's proof that judges are not tied
 * to OpenRouter. It implements the provider contract with no network
 * call at all: a crude mechanical "judge" that warns when the target
 * is suspiciously short relative to its spec. Real custom providers
 * would call a private inference endpoint here instead.
 *
 * The default export is a factory returning `{ name, judge(request) }`;
 * judge() receives rendered prompts, resolved settings, and `options`,
 * and returns a normalized verdict plus usage.
 */
export default function wordCountProvider() {
  return {
    name: "word-count",

    async judge(request) {
      const minWords = request.options.minWords ?? 20;
      const words = request.userPrompt.split(/\s+/).length;
      const compliant = words >= minWords;

      return {
        verdict: compliant
          ? { compliant: true, issues: [], reason: `Judgment input has ${words} words.` }
          : {
              compliant: false,
              severity: "warning",
              issues: [`Judgment input has only ${words} words (minimum ${minWords}).`],
              reason: "Suspiciously little content to judge.",
            },
        usage: { promptTokens: words, completionTokens: 0, costUsd: 0 },
      };
    },
  };
}
