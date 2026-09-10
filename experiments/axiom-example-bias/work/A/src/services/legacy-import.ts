// Structurally excluded from review via the services spec's
// excludes: frontmatter — the reviewer never sees this file, so its many
// violations (throws, console, vague errors, no run(), any) produce no
// verdict. If it ever shows up in eval output, excludes: is broken.
/* eslint-disable */
export function importLegacyReviews(rows: any[]): any {
  if (!rows) throw new Error("bad");

  console.log("importing", rows.length);

  return rows.map((r: any) => ({ ...r, migrated: true }));
}
