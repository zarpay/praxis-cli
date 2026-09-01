// Underscore-prefixed files are treated as templates/scratch and are
// never reviewed, even when a spec's paths: glob matches them. If this
// file shows up in eval output, the underscore skip is broken.
export function wipRefund(): never {
  throw new Error("not implemented");
}
