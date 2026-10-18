/**
 * Scoring arbitrary points (Spot Finder grid, chain backtest). Walking isochrones only exist for the
 * candidate sites, so here catchments are straight-line radii with a detour factor — an
 * approximation, labelled as such wherever it is shown.
 */
import type { FeatureCollection, Point } from "geojson";
import type { PoiGroup } from "@/lib/data/bangmod";
import type { Role } from "@/lib/profile/schema";
import {
  competitorPull,
  DEFAULT_HUFF,
  distanceM,
  huffWithPull,
  type DemandCell,
  type LngLat,
  type Store,
} from "@/lib/scoring/huff";
import type { SiteInputs } from "@/lib/scoring/locscore";
import type { PoiFC } from "./catchment";
import { INDIRECT_PULL } from "./site";

/** Straight-line radius ≈ walking minutes × 75 m/min ÷ 1.25 detour. */
export const RADIUS_5_MIN = 300;
export const RADIUS_10_MIN = 600;

export type PointContext = {
  cells: DemandCell[];
  pull: Float64Array;
  comps: (Store & { idx: number })[];
  pois: { at: LngLat; group: PoiGroup; idx: number }[];
  stops: LngLat[];
  roles: Record<PoiGroup, Role>;
  /** cells[0..residents) are WorldPop residents; the rest are daytime demand points (campus) */
  residents: number;
  campusDemand: number;
};

export function prepareContext(
  data: { poi: PoiFC; transit: FeatureCollection<Point>; cells: DemandCell[] },
  roles: Record<PoiGroup, Role>,
  extraDemand: DemandCell[] = [],
): PointContext {
  const pois = data.poi.features.map((f, idx) => ({
    at: f.geometry.coordinates as LngLat,
    group: f.properties.group,
    idx,
  }));
  const comps = pois
    .filter((p) => roles[p.group] === "comp" || roles[p.group] === "comp-indirect")
    .map((p) => ({ at: p.at, attractiveness: roles[p.group] === "comp" ? 1 : INDIRECT_PULL, idx: p.idx }));
  const cells = [...data.cells, ...extraDemand];
  return {
    cells,
    pull: competitorPull(cells, comps),
    comps,
    pois,
    stops: data.transit.features.map((f) => f.geometry.coordinates as LngLat),
    roles,
    residents: data.cells.length,
    campusDemand: extraDemand.reduce((s, c) => s + c.pop, 0),
  };
}

/**
 * Loc-Score inputs for any point. `exclude` drops POIs (by index) from counts and from the
 * competitor pull — used in the backtest so a chain branch does not compete with itself.
 */
export function pointInputs(at: LngLat, ctx: PointContext, exclude: Set<number> = new Set()): SiteInputs {
  let edu10 = 0,
    poi5 = 0,
    direct10 = 0,
    indirect10 = 0,
    synergy10 = 0;
  for (const p of ctx.pois) {
    if (exclude.has(p.idx)) continue;
    const d = distanceM(at, p.at);
    if (d <= RADIUS_5_MIN) poi5++;
    if (d > RADIUS_10_MIN) continue;
    const role = ctx.roles[p.group];
    if (p.group === "education") edu10++;
    if (role === "comp") direct10++;
    else if (role === "comp-indirect") indirect10++;
    else if (role === "synergy") synergy10++;
  }
  let pull = ctx.pull;
  const removed = ctx.comps.filter((c) => exclude.has(c.idx));
  if (removed.length) {
    pull = Float64Array.from(ctx.pull);
    ctx.cells.forEach((cell, i) => {
      for (const c of removed)
        pull[i] -= c.attractiveness / Math.max(DEFAULT_HUFF.minDistM, distanceM(cell.at, c.at)) ** DEFAULT_HUFF.lambda;
    });
  }
  const h = huffWithPull(at, ctx.cells, pull);
  let pop10 = 0;
  for (let i = 0; i < ctx.residents; i++)
    if (distanceM(at, ctx.cells[i].at) <= RADIUS_10_MIN) pop10 += ctx.cells[i].pop;
  const stops5 = ctx.stops.filter((s) => distanceM(at, s) <= RADIUS_5_MIN).length;
  return {
    pop10,
    edu10,
    stops5,
    poi5,
    direct10,
    indirect10,
    synergy10,
    huffShare: h.share,
    huffCapturedPop: h.capturedPop,
    campusDemand: ctx.campusDemand,
    rentThb: null,
  };
}

/** Regular grid of points within `radiusM` of a centre. */
export function gridAround(center: LngLat, radiusM: number, stepM: number): LngLat[] {
  const out: LngLat[] = [];
  const dLat = stepM / 110_540;
  const dLon = stepM / (111_320 * Math.cos((center[1] * Math.PI) / 180));
  const n = Math.ceil(radiusM / stepM);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const p: LngLat = [center[0] + j * dLon, center[1] + i * dLat];
      if (distanceM(center, p) <= radiusM) out.push(p);
    }
  }
  return out;
}
