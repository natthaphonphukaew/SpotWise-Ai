/** Monotonicity tests (SPEC §9.3, CLAUDE.md rule 7): scores must move in the direction they claim to. */
import { describe, expect, it } from "vitest";
import { distanceM, huff, type DemandCell, type LngLat, type Store } from "./huff";
import { DEFAULT_ASSUMPTIONS, rentScore, saturate, scoreSite, type SiteInputs } from "./locscore";

const site: LngLat = [100.494, 13.651];
const ring = (n: number, r: number, pop: number): DemandCell[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { at: [site[0] + (r / 108_000) * Math.cos(a), site[1] + (r / 110_540) * Math.sin(a)] as LngLat, pop };
  });
const cells = [...ring(12, 200, 100), ...ring(24, 600, 80)];
const shop = (dLon: number, a = 1): Store => ({ at: [site[0] + dLon, site[1]], attractiveness: a });

const base: SiteInputs = {
  pop10: 5000, edu10: 20, stops5: 2, poi5: 40, direct10: 3, indirect10: 6, synergy10: 25,
  huffShare: 0.02, huffCapturedPop: 1500, campusDemand: 0, rentThb: 15000,
};
const W = { target: 25, access: 20, market: 20, rent: 20, synergy: 15 };
const total = (inp: Partial<SiteInputs>) => scoreSite({ ...base, ...inp }, W).total!;
const dim = (inp: Partial<SiteInputs>, key: string) => scoreSite({ ...base, ...inp }, W).dims.find((d) => d.key === key)!.score!;

describe("huff", () => {
  it("measures distance in metres", () => {
    expect(distanceM(site, [site[0], site[1] + 0.001])).toBeGreaterThan(100);
    expect(distanceM(site, [site[0], site[1] + 0.001])).toBeLessThan(115);
  });

  it("with no competitors captures all demand in reach", () => {
    const r = huff(site, cells, []);
    expect(r.share).toBeCloseTo(1, 5);
    expect(r.capturedPop).toBeCloseTo(r.reachPop, 5);
  });

  it("more competitors → lower share", () => {
    const one = huff(site, cells, [shop(0.003)]).share;
    const two = huff(site, cells, [shop(0.003), shop(-0.003)]).share;
    expect(two).toBeLessThan(one);
  });

  it("a closer competitor hurts more than a far one", () => {
    expect(huff(site, cells, [shop(0.001)]).share).toBeLessThan(huff(site, cells, [shop(0.008)]).share);
  });

  it("a more attractive competitor hurts more", () => {
    expect(huff(site, cells, [shop(0.003, 1)]).share).toBeLessThan(huff(site, cells, [shop(0.003, 0.5)]).share);
  });

  it("more people in reach → more captured customers", () => {
    const more = cells.map((c) => ({ ...c, pop: c.pop * 2 }));
    expect(huff(site, more, [shop(0.003)]).capturedPop).toBeGreaterThan(huff(site, cells, [shop(0.003)]).capturedPop);
  });
});

describe("Loc-Score monotonicity", () => {
  it("higher rent → lower rent score and lower total", () => {
    expect(dim({ rentThb: 30000 }, "rent")).toBeLessThan(dim({ rentThb: 10000 }, "rent"));
    expect(total({ rentThb: 30000 })).toBeLessThan(total({ rentThb: 10000 }));
  });

  it("lower expected share (more competition) → lower market score", () => {
    expect(dim({ huffShare: 0.005 }, "market")).toBeLessThan(dim({ huffShare: 0.02 }, "market"));
  });

  it("more people / schools → higher target score", () => {
    expect(dim({ pop10: 9000 }, "target")).toBeGreaterThan(dim({ pop10: 3000 }, "target"));
    expect(dim({ edu10: 40 }, "target")).toBeGreaterThan(dim({ edu10: 5 }, "target"));
  });

  it("more synergy places → higher synergy score", () => {
    expect(dim({ synergy10: 60 }, "synergy")).toBeGreaterThan(dim({ synergy10: 10 }, "synergy"));
  });

  it("counting more people on site → higher access score, and higher confidence than open data", () => {
    const field = (perMin: number) => ({ footfallPerMin: perMin, minutesCounted: 30, slots: ["noon" as const], storefront: null, lastAt: null });
    expect(dim({ field: field(10) }, "access")).toBeGreaterThan(dim({ field: field(2) }, "access"));
    const open = scoreSite(base, W);
    const surveyed = scoreSite({ ...base, field: field(5) }, W);
    expect(surveyed.confidence).toBeGreaterThan(open.confidence);
    expect(surveyed.dims.find((d) => d.key === "access")!.certainty).toBe("surveyed");
  });

  it("better storefront visibility → higher access score", () => {
    const sf = (v: number) => ({
      visibility: v, frontage: "medium" as const, motorbike_parking: "yes" as const, sidewalk: "good" as const,
      shade: "no" as const, signage_space: "yes" as const, obstacles: [], summary: "", cannot_judge: [],
    });
    const field = (v: number) => ({ footfallPerMin: 4, minutesCounted: 20, slots: ["noon" as const], storefront: sf(v), lastAt: null });
    expect(dim({ field: field(5) }, "access")).toBeGreaterThan(dim({ field: field(1) }, "access"));
  });

  it("more transit → higher access score", () => {
    expect(dim({ stops5: 5 }, "access")).toBeGreaterThan(dim({ stops5: 0 }, "access"));
  });

  it("more captured customers → more revenue → better rent score at the same rent", () => {
    expect(dim({ huffCapturedPop: 3000 }, "rent")).toBeGreaterThan(dim({ huffCapturedPop: 800 }, "rent"));
  });
});

describe("Loc-Score bookkeeping", () => {
  it("scores stay within 0–100", () => {
    const extreme = scoreSite({ ...base, pop10: 1e7, edu10: 1e4, stops5: 1e3, poi5: 1e4, synergy10: 1e4, huffShare: 1, rentThb: 0 }, W);
    extreme.dims.forEach((d) => expect(d.score).toBeLessThanOrEqual(100));
    const empty = scoreSite({ ...base, pop10: 0, edu10: 0, stops5: 0, poi5: 0, synergy10: 0, huffShare: 0, huffCapturedPop: 0 }, W);
    empty.dims.forEach((d) => d.score != null && expect(d.score).toBeGreaterThanOrEqual(0));
  });

  it("missing rent is excluded from the total and lowers confidence", () => {
    const withRent = scoreSite(base, W);
    const without = scoreSite({ ...base, rentThb: null }, W);
    expect(without.dims.find((d) => d.key === "rent")!.score).toBeNull();
    expect(without.total).not.toBeNull();
    expect(without.confidence).toBeLessThan(withRent.confidence);
  });

  it("customer range brackets the middle estimate", () => {
    const c = scoreSite(base, W, DEFAULT_ASSUMPTIONS).customers;
    expect(c.low).toBeLessThan(c.mid);
    expect(c.high).toBeGreaterThan(c.mid);
  });

  it("helpers behave", () => {
    expect(saturate(0, 10)).toBe(0);
    expect(saturate(30, 10)).toBeGreaterThan(94);
    expect(rentScore(0.1)).toBe(100);
    expect(rentScore(0.3)).toBe(0);
  });
});

describe("fast Huff", () => {
  it("precomputed competitor pull gives the same result as the direct formula", async () => {
    const { competitorPull, huffWithPull } = await import("./huff");
    const comps = [shop(0.003), shop(-0.002, 0.2)];
    const direct = huff(site, cells, comps);
    const fast = huffWithPull(site, cells, competitorPull(cells, comps));
    expect(fast.share).toBeCloseTo(direct.share, 12);
  });
});
