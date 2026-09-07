import type { Prompt } from "@framework/types.js";

/**
 * Wraps a prompt template into its `Prompt`: the returned function
 * fills the template's `{name}` placeholders from its variables record
 * and returns the finished string. A supplied variable with no
 * placeholder in the template throws — a renamed placeholder must fail
 * loudly, never ship a prompt with a hole in it. A template with no
 * slots wraps into a plain prompt that takes no variables.
 */
export function preparePrompt<Variables extends Record<keyof Variables, string> | void = void>(
  template: string,
): Prompt<Variables> {
  const fill = (variables?: Record<string, string>): string => {
    let prompt = template;

    for (const [name, value] of Object.entries(variables ?? {})) {
      const placeholder = `{${name}}`;

      if (!template.includes(placeholder)) {
        throw new Error(
          `Unmatched template variable: "${name}" has no {${name}} placeholder in the prompt template`,
        );
      }

      prompt = prompt.replaceAll(placeholder, value);
    }

    return prompt;
  };

  return fill as Prompt<Variables>;
}
