import type { AddDocumentResult } from "@/types.js";
import type { View } from "@framework/types.js";

/** What `praxis add` confirms: what was created, and where. */
const documentCreatedView: View<AddDocumentResult> = ({ type, path }) => [
  { channel: "success", text: `Created ${type}: ${path}` },
];

export default documentCreatedView;
