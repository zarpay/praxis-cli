import { describe, expect, it } from "vitest";

import expertFileTemplate from "@/templates/expert-file-template.js";

describe("expertFileTemplate", () => {
  const rendered = expertFileTemplate({ title: "Code Reviewer", alias: "code-reviewer" });

  it("fills the title into the frontmatter and the heading", () => {
    expect(rendered).toContain('title: "Code Reviewer"');
    expect(rendered).toContain("# Code Reviewer (a.k.a **Code Reviewer**)");
  });

  it("fills the alias the compiler keys on, as typed rather than titled", () => {
    expect(rendered).toContain('alias: "code-reviewer"');
  });

  it("leaves no substituted placeholder behind", () => {
    expect(rendered).not.toContain("{expert_name}");
    expect(rendered).not.toContain("{required_alias}");
  });

  it("keeps the author's guidance tokens for them to fill in", () => {
    expect(rendered).toContain("practices/{verb}-{noun}.md");
  });

  it("declares the frontmatter the compiler requires", () => {
    expect(rendered.startsWith("---\n")).toBe(true);
    expect(rendered).toContain("type: expert");
  });
});
