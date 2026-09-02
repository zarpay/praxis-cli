import type { InitProjectResult } from "@/types.js";
import type { View } from "@framework/types.js";

/**
 * What `praxis init` reports once a project is scaffolded.
 *
 * The orchestrator decides which next steps apply — they differ for an
 * eval-only project and one with the authoring taxonomy — and this only
 * frames them.
 */
const initView: View<InitProjectResult> = ({ created, skipped, nextSteps }) => [
  { channel: "blank" },
  {
    channel: "heading",
    text: `Initialized Praxis project: ${created} files created, ${skipped} skipped`,
  },
  { channel: "content", entries: ["", "Next steps:", ...nextSteps] },
];

export default initView;
