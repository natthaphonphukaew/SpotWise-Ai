import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import type { Candidate } from "@/lib/data/bangmod";
import type { IsochroneFC } from "@/lib/geo/catchment";
import { distanceM, type LngLat } from "@/lib/scoring/huff";
import {
  activeSites,
  addPin,
  checkPin,
  circle,
  EMPTY_SITES,
  MAX_SITES,
  nextPinId,
  removePin,
  toggleSite,
  withSiteCatchments,
} from "./sites";

const centre: LngLat = [100.4943, 13.6512];
const base: Candidate[] = ["A", "B", "C", "D"].map((id, i) => ({ id, label: id, lon: centre[0] + i * 0.002, lat: centre[1], rent_thb: null }));
const near: LngLat = [centre[0] + 0.003, centre[1] + 0.003];
const ids = (s: typeof EMPTY_SITES) => activeSites(base, s).map((c) => c.id);

describe("site selection", () => {
  it("defaults to the first surveyed candidates", () => {
    expect(ids(EMPTY_SITES)).toEqual(["A", "B", "C"]);
  });

  it("never selects more than MAX_SITES", () => {
    const s = toggleSite(base, EMPTY_SITES, "D");
    expect(ids(s)).toHaveLength(MAX_SITES);
    expect(ids(s)).not.toContain("D");
  });

  it("keeps at least one site when deselecting", () => {
    let s = toggleSite(base, EMPTY_SITES, "A");
    s = toggleSite(base, s, "B");
    expect(ids(s)).toEqual(["C"]);
    expect(ids(toggleSite(base, s, "C"))).toEqual(["C"]);
  });

  it("adds a pin to the comparison only when there is room", () => {
    const full = addPin(base, EMPTY_SITES, near, "ซอย 45");
    expect(full.custom[0]).toMatchObject({ id: "P1", label: "ซอย 45" });
    expect(ids(full)).toEqual(["A", "B", "C"]);
    const room = addPin(base, toggleSite(base, EMPTY_SITES, "C"), near, "");
    expect(ids(room)).toEqual(["A", "B", "P1"]);
    expect(room.custom[0].label).toBe("หมุด P1");
  });

  it("removing a pin also drops it from the comparison", () => {
    const s = addPin(base, toggleSite(base, EMPTY_SITES, "C"), near, "x");
    expect(ids(removePin(base, s, "P1"))).toEqual(["A", "B"]);
  });

  it("does not reuse pin ids that still exist", () => {
    let s = addPin(base, EMPTY_SITES, near, "a");
    s = addPin(base, s, near, "b");
    s = removePin(base, s, "P1");
    expect(nextPinId(s)).toBe("P1");
    expect(addPin(base, s, near, "c").custom.map((c) => c.id)).toEqual(["P2", "P1"]);
  });
});

describe("checkPin", () => {
  const campus: FeatureCollection = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: circle(centre, 200) }] };
  it("refuses pins outside the data area or inside the campus", () => {
    expect(checkPin([centre[0] + 0.03, centre[1]], centre, campus).ok).toBe(false);
    expect(checkPin(centre, centre, campus).ok).toBe(false);
    expect(checkPin(near, centre, campus).ok).toBe(true);
  });
});

describe("withSiteCatchments", () => {
  const iso: IsochroneFC = { type: "FeatureCollection", features: [{ type: "Feature", properties: { candidate: "A", minutes: 5, snap_m: 3 }, geometry: circle(centre, 250) }] };
  it("adds 5/10-minute radius circles only for sites without an isochrone", () => {
    const pin: Candidate = { id: "P1", label: "p", lon: near[0], lat: near[1], rent_thb: null, custom: true };
    const out = withSiteCatchments(iso, [base[0], pin]);
    const added = out.features.filter((f) => f.properties.candidate === "P1");
    expect(out.features).toHaveLength(3);
    expect(added.map((f) => [f.properties.minutes, f.properties.radius_m])).toEqual([[5, 300], [10, 600]]);
  });
  it("draws circles with the requested radius", () => {
    const ring = circle(centre, 600).coordinates[0];
    ring.forEach((p) => expect(Math.abs(distanceM(centre, p as LngLat) - 600)).toBeLessThan(6));
  });
});
