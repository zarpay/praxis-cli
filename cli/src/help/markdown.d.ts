/**
 * Help documents are markdown files imported as strings: tsup bundles
 * them with `loader: { ".md": "text" }`, and vitest mirrors that with
 * the markdown-as-text plugin. This declaration is what lets tsc agree.
 */
declare module "*.md" {
  const text: string;
  export default text;
}
