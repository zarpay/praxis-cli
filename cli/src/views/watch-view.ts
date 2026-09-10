import type { View } from "@framework/types.js";

/** One event from a compile watch session. */
type WatchEvent =
  { kind: "watching"; dir: string } | { kind: "recompiling"; filename: string | null };

/** What a watch session says as it starts and as it reacts to a change. */
const watchView: View<WatchEvent> = (event) => {
  if (event.kind === "watching") {
    return [{ channel: "heading", text: `Watching ${event.dir} for changes...` }];
  }

  return [
    {
      channel: "heading",
      text: `Change detected${event.filename ? `: ${event.filename}` : ""}, recompiling...`,
    },
  ];
};

export default watchView;
