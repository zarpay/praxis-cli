import type { View } from "@framework/types.js";

import chalk from "chalk";

/** What `praxis config show` renders: the file's location and its raw contents. */
interface ShowConfigResult {
  configPath: string;
  config: unknown;
}

/** Horizontal rule under the config header. */
const DIVIDER = "─".repeat(40);

/**
 * The config file `praxis config show` prints, with a header naming
 * where it came from — the raw file as written, not the normalized view
 * of it.
 */
const configView: View<ShowConfigResult> = ({ configPath, config }) => [
  {
    channel: "content",
    entries: [
      "",
      "  " + chalk.bold("Praxis Config"),
      "  " + DIVIDER,
      "  " + chalk.dim(configPath),
      "",
      JSON.stringify(config, null, 2),
      "",
    ],
  },
];

export default configView;
