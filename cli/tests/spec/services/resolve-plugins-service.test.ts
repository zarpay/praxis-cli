import { describe, expect, it } from "vitest";

import { Logger } from "@/framework/views/logger.js";
import { ClaudeCodePlugin } from "@/spec/plugins/claude-code.js";
import resolvePlugins from "@/spec/services/resolve-plugins-service.js";

describe("resolvePlugins", () => {
  const logger = new Logger({ color: false });

  it("returns an empty array for no entries", () => {
    expect(resolvePlugins([], "/project", logger)).toEqual([]);
  });

  it("instantiates the claude-code plugin", () => {
    const plugins = resolvePlugins([{ name: "claude-code" }], "/project", logger);

    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toBeInstanceOf(ClaudeCodePlugin);
    expect(plugins[0].name).toBe("claude-code");
  });

  it("throws for an unknown plugin name, listing available plugins", () => {
    expect(() => resolvePlugins([{ name: "nonexistent" }], "/project", logger)).toThrow(
      'Unknown plugin: "nonexistent". Available plugins: claude-code',
    );
  });
});
