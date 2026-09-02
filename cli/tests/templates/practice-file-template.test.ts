import { describe, expect, it } from "vitest";

import practiceFileTemplate from "@/templates/practice-file-template.js";

describe("practiceFileTemplate", () => {
  const rendered = practiceFileTemplate({ title: "Review Pull Requests" });

  it("fills the title into the frontmatter and the heading", () => {
    expect(rendered).toContain('title: "Review Pull Requests"');
    expect(rendered).toContain("# Review Pull Requests");
  });

  it("leaves no substituted placeholder behind", () => {
    expect(rendered).not.toContain("{practice_title}");
  });

  it("keeps the author's guidance tokens for them to fill in", () => {
    expect(rendered).toContain("{owner_role_alias}");
    expect(rendered).toContain("{optional_schedule}");
  });

  it("declares the frontmatter the compiler requires", () => {
    expect(rendered.startsWith("---\n")).toBe(true);
    expect(rendered).toContain("type: practice");
  });
});
