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

  it("leaves no substituted token behind, only the author's guidance", () => {
    expect(rendered).not.toMatch(/\{[a-z_]+\}/);
    expect(rendered).toContain("{Why it matters.}");
  });

  it("takes the shape the recruiter reviews for: a pass/fail pair and a never", () => {
    expect(rendered).toContain("passes.");
    expect(rendered).toContain("fails.");
    expect(rendered).toContain("Never {");
  });

  it("declares the frontmatter the compiler requires", () => {
    expect(rendered.startsWith("---\n")).toBe(true);
    expect(rendered).toContain("type: practice");
  });
});
