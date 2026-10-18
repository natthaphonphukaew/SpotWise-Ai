import { describe, expect, it } from "vitest";
import { slotOf, summarizeField, type FootfallSession } from "./types";

const s = (site: string, seconds: number, count: number, slot: FootfallSession["slot"] = "noon", at = "2026-10-18T05:00:00Z"): FootfallSession => ({
  id: `${site}${seconds}${count}`, site, startedAt: at, seconds, count, slot,
});

describe("summarizeField", () => {
  it("pools sessions per site into people per minute", () => {
    const r = summarizeField("B", [s("B", 600, 60), s("B", 300, 15, "evening"), s("A", 600, 999)], null);
    expect(r.footfallPerMin).toBeCloseTo(75 / 15, 6);
    expect(r.minutesCounted).toBe(15);
    expect(r.slots.sort()).toEqual(["evening", "noon"]);
  });

  it("ignores counts shorter than two minutes", () => {
    expect(summarizeField("B", [s("B", 60, 30)], null).footfallPerMin).toBeNull();
  });
});

describe("slotOf", () => {
  it("maps local clock time to survey slots", () => {
    expect(slotOf(new Date(2026, 9, 18, 8, 0))).toBe("morning");
    expect(slotOf(new Date(2026, 9, 18, 12, 15))).toBe("noon");
    expect(slotOf(new Date(2026, 9, 18, 17, 0))).toBe("evening");
    expect(slotOf(new Date(2026, 9, 18, 21, 0))).toBe("other");
  });
});
