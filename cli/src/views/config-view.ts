import type { View } from "@framework/types.js";

import chalk from "chalk";

/** What `praxis config show` renders: the file's location and its raw contents. */
interface ShowConfigResult {
  configPath: string;
  config: unknown;
}

/**
 * The config file `praxis config show` prints — the raw file as
 * written, not the normalized view of it. The heading names the file's
 * location and goes to stderr with every other heading, so stdout stays
 * pure JSON and pipes clean.
 */
const configView: View<ShowConfigResult> = ({ configPath, config }) => [
  { channel: "heading", text: `Praxis Config — ${chalk.dim(configPath)}` },
  {
    channel: "content",
    entries: [JSON.stringify(config, null, 2)],
  },
];

export default configView;
