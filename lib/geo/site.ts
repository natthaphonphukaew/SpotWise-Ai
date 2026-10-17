import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import type { Candidate, PoiGroup } from "@/lib/data/bangmod";
import type { Role } from "@/lib/profile/schema";
import { DEFAULT_HUFF, distanceM, huff, type DemandCell, type Store } from "@/lib/scoring/huff";
import type { SiteInputs } from "@/lib/scoring/locscore";
import { findIsochrone, type IsochroneFC, type PoiFC } from "./catchment";

export type PopulationFC = FeatureCollection<Polygon, { pop: number }>;

/** Pull of an indirect competitor relative to a direct one in the Huff model. */
export const INDIRECT_PULL = 0.2;

/** Rough centre of a (multi)polygon collection: mean of its outer-ring vertices. */
export function centreOf(fc: FeatureCollection): [number, number] | null {
  const pts: number[][] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === "Polygon") pts.push(...g.coordinates[0]);
    if (g.type === "MultiPolygon") g.coordinates.forEach((p) => pts.push(...p[0]));
  }
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** WorldPop grid as demand points (cell centres). */
export function demandCells(pop: PopulationFC): DemandCell[] {
  return pop.features.map((f) => {
    const ring = f.geometry.coordinates[0].slice(0, 4);
    const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return { at: [lon, lat], pop: f.properties.pop };
  });
}

type Area = Feature<Polygon | MultiPolygon> | undefined;
const inside = (pt: Feature<Point> | [number, number], area: Area) => (area ? booleanPointInPolygon(pt, area) : false);

/** Everything Loc-Score needs about one candidate, measured from the map data. Pure. */
export function siteInputs(
  cand: Candidate,
  data: { poi: PoiFC; iso: IsochroneFC; transit: FeatureCollection<Point>; cells: DemandCell[] },
  roles: Record<PoiGroup, Role>,
  rentThb: number | null,
  /** extra daytime demand points, e.g. the campus (people, not residents) */
  extraDemand: DemandCell[] = [],
): SiteInputs {
  const five = findIsochrone(data.iso, cand.id, 5);
  const ten = findIsochrone(data.iso, cand.id, 10);
  const at: [number, number] = [cand.lon, cand.lat];

  let edu10 = 0, poi5 = 0, direct10 = 0, indirect10 = 0, synergy10 = 0;
  const competitors: Store[] = [];
  for (const f of data.poi.features) {
    const role = roles[f.properties.group];
    const in10 = inside(f, ten);
    if (in10 && f.properties.group === "education") edu10++;
    if (in10 && role === "comp") direct10++;
    if (in10 && role === "comp-indirect") indirect10++;
    if (in10 && role === "synergy") synergy10++;
    if (inside(f, five)) poi5++;
    // Huff: direct competitors pull fully, indirect ones weakly (a coffee shop is only a partial
    // substitute for bubble tea); only stores that can reach our demand area are considered.
    if ((role === "comp" || role === "comp-indirect") && distanceM(at, f.geometry.coordinates as [number, number]) <= DEFAULT_HUFF.radiusM + 1000) {
      competitors.push({ at: f.geometry.coordinates as [number, number], attractiveness: role === "comp" ? 1 : INDIRECT_PULL });
    }
  }
  const pop10 = data.cells.filter((c) => inside(c.at, ten)).reduce((s, c) => s + c.pop, 0);
  const stops5 = data.transit.features.filter((f) => inside(f, five)).length;
  const h = huff(at, [...data.cells, ...extraDemand], competitors);
  const campusDemand = extraDemand.reduce((s, c) => s + c.pop, 0);

  return {
    pop10, edu10, stops5, poi5, direct10, indirect10, synergy10,
    huffShare: h.share, huffCapturedPop: h.capturedPop, campusDemand, rentThb,
  };
}
