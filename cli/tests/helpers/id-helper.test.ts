import { describe, expect, it, vi } from "vitest";

import { sortableId } from "@/helpers/id-helper.js";

describe("sortableId", () => {
  it("is filename-safe — no separators a path would choke on", () => {
    expect(sortableId()).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{8}$/);
  });

  it("sorts lexicographically into chronological order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T10:00:00.000Z"));
    const earlier = sortableId();

    vi.setSystemTime(new Date("2026-09-14T10:00:00.001Z"));
    const later = sortableId();
    vi.useRealTimers();

    // The whole point of the instant prefix: no sorting key to carry.
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });

  it("does not collide within the same millisecond", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T10:00:00.000Z"));

    const minted = new Set(Array.from({ length: 500 }, () => sortableId()));
    vi.useRealTimers();

    // Same-millisecond writers are real: a multi-reviewer fan-out, or two
    // machines on two branches. Nothing praxis mints is sequential.
    expect(minted.size).toBe(500);
  });

  it("carries the instant it was minted at, to the millisecond", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T21:07:35.164Z"));
    const id = sortableId();
    vi.useRealTimers();

    expect(id.startsWith("20260914T210735164Z-")).toBe(true);
  });
});
