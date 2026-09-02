import type { InitProjectResult } from "@/types.js";
import type { View } from "@framework/types.js";

/**
 * What `praxis init` reports: each file it created as it stands, the
 * totals, and the next steps.
 *
 * The orchestrator decides which next steps apply — they differ for an
 * eval-only project and one with the authoring taxonomy — and this only
 * frames them.
 */
const initView: View<InitProjectResult> = ({ created, skipped, nextSteps }) => [
  ...created.map((path) => ({ channel: "success" as const, text: `Created ${path}` })),
  { channel: "blank" },
  {
    channel: "heading",
    text: `Initialized Praxis project: ${created.length} files created, ${skipped} skipped`,
  },
  { channel: "content", entries: ["", "Next steps:", ...nextSteps] },
];

export default initView;
