/**
 * Prepare method for a prompt. Templates all supplied values and throws
 * an error if a provided variable name is not present in the template.
 */
export function preparePrompt(
  template: string, 
  variables: Record<string, string> 
) {
  const keys = Object.values(variables);

  let prompt = template;

  for (let key of keys) {
    let variablePresent = template.includes(key)
    
    if (variablePresent) {
      prompt = prompt.replaceAll(key, variables[key])
      continue
    } 
    throw new Error(`Unmatched template variable: The variable name #{key} is not present in the provided prompt`)
  }

  return prompt;
};
