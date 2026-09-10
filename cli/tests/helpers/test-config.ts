import type { RawConfig } from "@/types.js";

import { PraxisConfig } from "@/models/praxis-config.js";

/**
 * A config for a throwaway project, overriding only what the test
 * cares about — assembled in memory, so no config file is written.
 */
export function testConfig(root: string, raw: RawConfig = {}): PraxisConfig {
  return PraxisConfig.inMemory(root, raw);
}
