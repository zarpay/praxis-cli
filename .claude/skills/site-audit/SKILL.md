---
name: site-audit
description: Check the published docs (site/) against the source they describe — command surface, flags, exit codes, config keys, extension-point contracts, sample outputs. Run when a command's surface or output changes, and before a release.
---

# Site Audit — does the documentation still describe this program?

`site/` is what users read. Nothing in the build checks it, so it drifts
silently: a flag gains an option, a summary line changes shape, a config
key is renamed, and the docs keep describing the program as it was. This
skill compares the docs against the source they claim to describe.

**The bar is what a reader would do.** Not "is this sentence defensible"
but "if someone ran what this page tells them to run, would they get
what the page says". A stale example is worse than a missing one,
because it is believed.

## The audits, in order

1. **Command surface is complete, in both directions.** Every command
   and subcommand the CLI registers has a documented home; every command
   the docs describe still exists. The CLI is its own source of truth:
   ```bash
   cd cli && node dist/index.js --help
   # and per family:
   node dist/index.js eval --help; node dist/index.js axioms --help
   ```
   A command with no page is undocumented; a documented command that
   errors as unknown is a lie with a URL.

2. **Flags match, per command.** For each documented command, diff the
   flag table in the docs against `--help`. Watch for the cheap drift: a
   flag that gained a value (`--dismiss <id>` → `<ids...>`), a default
   that moved, a negatable flag written as if it were positive.

3. **Exit codes.** Every documented exit code is a claim that can be
   tested — run the failure and check `$?`. Exit 2 for usage mistakes
   and 1 for failures is the project's policy; a page promising
   otherwise is a bug in the page or in the code.

4. **Config reference against the type.** `site/reference/config.md`
   describes the shape of `.praxis/config.json`. Compare each documented
   key against `cli/src/types/config.ts` (`RawConfig`) and the defaults
   `PraxisConfig` resolves. A key in the type and not the docs is
   undiscoverable; a key in the docs and not the type is fiction.

5. **Extension-point contracts, quoted verbatim.** The config reference
   publishes a copy-pasteable provider module and lists the fields a
   `request` carries. Those must match `cli/src/types/extension-points.ts`
   exactly — third parties write code against this page, and a missing
   field is a broken integration.

6. **Sample outputs are real.** Every fenced block claiming to be CLI
   output gets run and compared. This is where drift hides: a summary
   line that gained a `[SPEND]` row, a heading that now prints a path
   instead of a filename, a card whose frame changed width. Run the
   command in `demo/` and read both.

7. **The running example is one project.** Scoop Society is the example
   across every page (`.claude/rules/milestones.md`). Its file names,
   reviewer names and numbers should be recognisable as the same
   project — and where a page shows a reviewer or a figure the demo no
   longer has, decide deliberately: **generic configuration examples and
   historical report output may legitimately name a retired reviewer**,
   because the ledger keeps its evidence; a page describing *current*
   state may not.

8. **Links and nav resolve.** Every internal link points at a page that
   exists, every page is reachable from `site/.vitepress/config.ts`, and
   anchors match real headings.
   ```bash
   grep -rhoE "\]\(/[a-z0-9/#-]+\)" site --include="*.md" | sort -u
   ```

9. **Vocabulary matches the specs.** Terms are the ones
   `cli/specs/vocabulary.md` fixes — reviewer, verdict, critique, axiom,
   epoch, unit — not synonyms a page invented.

## Gate and prove

Build first (`cd cli && npm run build`), because every output comparison
must run the current code, not the last publish. Run sample commands
from `demo/` with the offline `counter` reviewer where a verdict's
*content* does not matter, and with a real reviewer where it does.

`npm run docs:build` (or the site's build script) must still pass — a
broken link is a build failure, not a judgment call.

## Fixing

Fix the docs when the code is right, and say so in the commit. Fix the
code when the docs describe the better behavior and the code drifted —
that happens, and the page is then the bug report. When a page documents
a deliberate decision, carry the decision's date across from the spec so
the two read the same.

Report what you could not check — a paid row, an interactive session, a
platform-specific path — rather than implying the page was verified.
