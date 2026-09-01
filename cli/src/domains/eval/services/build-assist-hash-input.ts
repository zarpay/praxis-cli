import type { AssistInputs } from "@/domains/eval/types.js";

/**
 * Serializes assist inputs into the content hash's third component.
 *
 * Kind and path label each block so distinct assist states can never
 * serialize identically. Returns the empty string when the spec
 * declares no assist inputs, keeping plain specs' hashes unchanged.
 */
export default function assistHashInput(assist: AssistInputs): string {
  const blocks = [
    ...assist.exemplars.map((f) => `EXEMPLAR ${f.path}\n${f.content}`),
    ...assist.context.map((f) => `CONTEXT ${f.path}\n${f.content}`),
  ];

  return blocks.join("\n");
}
