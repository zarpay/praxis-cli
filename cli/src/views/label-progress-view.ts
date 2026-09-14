import type { LabelProgressEvent } from "@/types.js";
import type { View } from "@framework/types.js";

import { card } from "@framework/views/card.js";
import { palette } from "@framework/views/palette.js";

/**
 * One labeling verdict as it lands, on the same card every other
 * critique surface uses — counter and id in the title, where it was
 * said as an attribute, the reviewer's words as the body, and the
 * verdict as the footer.
 *
 * A critique looks the same wherever it is shown: `eval critiques`,
 * `eval review` and this stream all frame it identically, so a reader
 * learns the shape once. The words are no longer elided at a fixed
 * width either — the card wraps them, and the words are the whole
 * reason a human is watching the pass.
 */
const labelProgressView: View<LabelProgressEvent> = (event) => {
  const critiqueCard = card({
    title: `[${event.done}/${event.total}] critique ${event.critiqueId}`,
    attrs: [["file", event.filePath]],
    body: [event.text],
    footer: `${palette.meta("verdict")}  ${verdict(event)}`,
  });

  return [{ channel: "content", entries: [...critiqueCard, ""] }];
};

export default labelProgressView;

/** The verdict, colored by what it asks of the human. */
function verdict(event: LabelProgressEvent): string {
  if (event.outcome === "labeled") {
    return palette.ref(event.axiomId ?? "");
  }

  if (event.outcome === "unmatched") {
    return `${palette.warn("no match")} — goes to curate`;
  }

  return `${palette.bad("call failed")} — stays untriaged; rerun triage to retry`;
}
