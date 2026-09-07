/**
 * Fills a prompt template's `{name}` placeholders from a variables
 * record, throwing when a supplied variable has no placeholder in the
 * template — a renamed placeholder must fail loudly, never ship a
 * prompt with a hole in it.
 */
export function preparePrompt<Variables extends object>(
  template: string,
  variables: Variables,
): string {
  let prompt = template;

  for (const [name, value] of Object.entries(variables) as [string, string][]) {
    const placeholder = `{${name}}`;

    if (!template.includes(placeholder)) {
      throw new Error(
        `Unmatched template variable: "${name}" has no {${name}} placeholder in the prompt template`,
      );
    }

    prompt = prompt.replaceAll(placeholder, value);
  }

  return prompt;
}
