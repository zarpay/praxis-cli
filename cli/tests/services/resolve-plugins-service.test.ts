import { describe, expect, it } from "vitest";

import { ClaudeCodePlugin } from "@/plugins/claude-code.js";
import resolvePluginsService from "@/services/resolve-plugins-service.js";
import { Logger } from "@framework/views/logger.js";

describe("resolvePluginsService", () => {
  const logger = new Logger({ color: false });

  it("returns an empty array for no entries", () => {
    expect(resolvePluginsService([], "/project", logger)).toEqual([]);
  });

  it("instantiates the claude-code plugin", () => {
    const plugins = resolvePluginsService([{ name: "claude-code" }], "/project", logger);

    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toBeInstanceOf(ClaudeCodePlugin);
    expect(plugins[0].name).toBe("claude-code");
  });

  it("throws for an unknown plugin name, listing available plugins", () => {
    expect(() => resolvePluginsService([{ name: "nonexistent" }], "/project", logger)).toThrow(
      'Unknown plugin: "nonexistent". Available plugins: claude-code',
    );
  });
});
