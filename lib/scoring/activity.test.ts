/** Activity profile by time of day: parsing, counting and monotonicity (CLAUDE.md rule 7). */
import { describe, expect, it } from "vitest";
import { rolesFor } from "@/lib/profile/schema";
import {
  activityProfile,
  formatHourRanges,
  HOURS,
  parseOpeningHours,
  peakHourSet,
  summarizeActivity,
  type ActivityPlace,
} from "./activity";

const roles = rolesFor(null); // bubble tea = comp, coffee = indirect, dormitory/education = synergy, food = context
const at = (places: ActivityPlace[], hour: number) => activityProfile(places, roles).rows.find((r) => r.hour === hour)!;
const P = (group: ActivityPlace["group"], opening_hours: string | null = null): ActivityPlace => ({ group, opening_hours });

describe("parseOpeningHours", () => {
  it("reads common OSM forms", () => {
    expect(parseOpeningHours("Mo-Fr 08:30-16:30")).toEqual([[8.5, 16.5]]);
    expect(parseOpeningHours("0800 - 1630")).toEqual([[8, 16.5]]);
    expect(parseOpeningHours("24/7")).toEqual([[0, 24]]);
  });
  it("cuts ranges past midnight at 24:00", () => {
    expect(parseOpeningHours("Mo-Su 11:00-02:00")).toEqual([[11, 24]]);
  });
  it("returns null when it can't read the string", () => {
    expect(parseOpeningHours(null)).toBeNull();
    expect(parseOpeningHours("by appointment")).toBeNull();
  });
});

describe("activityProfile", () => {
  it("covers 06:00–24:00 in hour buckets", () => {
    expect(HOURS[0]).toBe(6);
    expect(HOURS.at(-1)).toBe(23);
  });

  it("an anchor raises the count only in the hours it is active", () => {
    const before = activityProfile([], roles).rows;
    const after = activityProfile([P("dormitory")], roles).rows; // typical 06–09, 17–24
    after.forEach((r, i) => {
      const active = (r.hour >= 6 && r.hour < 9) || r.hour >= 17;
      expect(r.synergy - before[i].synergy).toBe(active ? 1 : 0);
    });
  });

  it("real opening hours override the group's typical hours", () => {
    expect(at([P("bubble_tea")], 22).comp).toBe(0); // typical 10–21
    expect(at([P("bubble_tea", "Mo-Su 16:00-24:00")], 22).comp).toBe(1);
    expect(activityProfile([P("bubble_tea", "16:00-24:00"), P("coffee")], roles).withHours).toBe(1);
  });

  it("splits roles and leaves context places out", () => {
    const r = at([P("bubble_tea"), P("coffee"), P("education"), P("food")], 12);
    expect(r).toMatchObject({ comp: 1, indirect: 1, synergy: 1 });
    expect(activityProfile([P("food")], roles).places).toBe(0);
  });
});

describe("summarizeActivity", () => {
  const places = [P("dormitory"), P("dormitory"), P("education"), P("bubble_tea")];

  it("finds hours with anchors active and no direct competitor open", () => {
    const s = summarizeActivity(activityProfile(places, roles), new Set());
    // bubble tea 10–21 → gaps 06–10 and 21–24
    expect(s.gapHours).toEqual([6, 7, 8, 9, 21, 22, 23]);
    expect(s.peak).toBeNull();
  });

  it("more competitors never add gap hours (monotonic)", () => {
    const gaps = (extra: ActivityPlace[]) => summarizeActivity(activityProfile([...places, ...extra], roles), new Set()).gapHours;
    const base = gaps([]);
    const more = gaps([P("bubble_tea", "18:00-24:00")]);
    expect(more.every((h) => base.includes(h))).toBe(true);
    expect(more.length).toBeLessThan(base.length);
  });

  it("averages only the peak hours", () => {
    const s = summarizeActivity(activityProfile(places, roles), peakHourSet([{ from: "21:00", to: "23:00" }]));
    expect(s.peak).toEqual({ synergy: 2, comp: 0, indirect: 0 });
  });
});

describe("peakHourSet", () => {
  it("maps HH:MM ranges to overlapping hour buckets", () => {
    expect([...peakHourSet([{ from: "11:30", to: "13:30" }])]).toEqual([11, 12, 13]);
  });
  it("wraps past midnight", () => {
    expect([...peakHourSet([{ from: "22:00", to: "01:00" }])]).toEqual([22, 23]);
  });
});

describe("formatHourRanges", () => {
  it("joins consecutive hours", () => {
    expect(formatHourRanges([21, 22, 23])).toBe("21–24 น.");
    expect(formatHourRanges([18, 7, 8])).toBe("07–09, 18–19 น.");
    expect(formatHourRanges([])).toBe("—");
  });
});
