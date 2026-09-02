import type { PruneCacheResult } from "@/types.js";
import type { View } from "@framework/types.js";

/** What a prune reports: what fell, or that everything was current. */
const pruneView: View<PruneCacheResult> = ({ entriesPruned, filesRemoved }) => {
  if (entriesPruned === 0 && filesRemoved === 0) {
    return [{ channel: "success", text: "Nothing to prune — every cached verdict is current" }];
  }

  return [
    {
      channel: "success",
      text: `Pruned ${entriesPruned} stale verdict(s); removed ${filesRemoved} cache file(s)`,
    },
  ];
};

export default pruneView;
