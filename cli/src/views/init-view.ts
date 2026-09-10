import type { View } from "@framework/types.js";

/** What scaffolding produced. */
interface InitProjectResult {
  /** Paths written, relative to the new project. */
  created: string[];
  /** Files left alone because they already existed. */
  skipped: number;
  /** Guidance to show the author, matched to what was scaffolded. */
  nextSteps: string[];
}

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
