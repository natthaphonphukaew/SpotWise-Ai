import { describe, expect, it } from "vitest";
import { cleanProfile, normalizeWeights, rolesFor, type BusinessProfile } from "./schema";

const base: BusinessProfile = {
  business_label: "ร้านชาไข่มุก",
  summary: "ชาไข่มุกราคานักศึกษา",
  price_min_thb: 40,
  price_max_thb: 60,
  avg_ticket_thb: 55,
  avg_ticket_source: "assumed",
  budget_thb: 300000,
  target_segments: [{ label: "นักศึกษา", share: 80 }],
  direct_competitors: ["bubble_tea", "bubble_tea"],
  indirect_competitors: ["bubble_tea", "coffee", "drink_dessert"],
  synergy: [
    { group: "education", reason: "นักศึกษา" },
    { group: "coffee", reason: "ซ้ำกับคู่แข่ง" },
    { group: "education", reason: "ซ้ำ" },
    { group: "dormitory", reason: "หอพัก" },
  ],
  peak_hours: [],
  weights: { target: 30, access: 20, market: 20, rent: 20, synergy: 15 },
  assumptions: [],
  to_verify: [],
};

describe("normalizeWeights", () => {
  it("always sums to exactly 100 with integers", () => {
    for (const w of [
      { target: 1, access: 1, market: 1, rent: 1, synergy: 1 },
      { target: 33.3, access: 33.3, market: 33.3, rent: 0, synergy: 0 },
      { target: 30, access: 20, market: 20, rent: 20, synergy: 15 },
    ]) {
      const n = normalizeWeights(w);
      expect(Object.values(n).reduce((a, b) => a + b, 0)).toBe(100);
      Object.values(n).forEach((v) => expect(Number.isInteger(v)).toBe(true));
    }
  });

  it("keeps the order of importance", () => {
    const n = normalizeWeights({ target: 50, access: 10, market: 20, rent: 10, synergy: 10 });
    expect(n.target).toBeGreaterThan(n.market);
    expect(n.market).toBeGreaterThan(n.access);
  });

  it("survives all-zero input", () => {
    const n = normalizeWeights({ target: 0, access: 0, market: 0, rent: 0, synergy: 0 });
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("cleanProfile", () => {
  it("puts each group in one role only and dedupes", () => {
    const p = cleanProfile(base);
    expect(p.direct_competitors).toEqual(["bubble_tea"]);
    expect(p.indirect_competitors).toEqual(["coffee", "drink_dessert"]);
    expect(p.synergy.map((s) => s.group)).toEqual(["education", "dormitory"]);
  });
});

describe("rolesFor", () => {
  it("maps profile roles and leaves everything else as context", () => {
    const r = rolesFor(cleanProfile(base));
    expect(r.bubble_tea).toBe("comp");
    expect(r.coffee).toBe("comp-indirect");
    expect(r.education).toBe("synergy");
    expect(r.office).toBe("context");
  });

  it("falls back to default roles without a profile", () => {
    expect(rolesFor(null).bubble_tea).toBe("comp");
  });
});
