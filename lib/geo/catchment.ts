import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import type { PoiGroup, PoiProps } from "@/lib/data/bangmod";

export type IsochroneProps = { candidate: string; minutes: number; snap_m: number };
export type IsochroneFC = FeatureCollection<Polygon | MultiPolygon, IsochroneProps>;
export type PoiFC = FeatureCollection<Point, PoiProps>;

export function findIsochrone(iso: IsochroneFC, candidate: string, minutes: number) {
  return iso.features.find((f) => f.properties.candidate === candidate && f.properties.minutes === minutes);
}

/** Count POIs per group that fall inside a catchment polygon. */
export function countByGroup(poi: PoiFC, area: Feature<Polygon | MultiPolygon> | undefined) {
  const counts: Partial<Record<PoiGroup, number>> = {};
  if (!area) return counts;
  for (const f of poi.features) {
    if (booleanPointInPolygon(f, area)) counts[f.properties.group] = (counts[f.properties.group] ?? 0) + 1;
  }
  return counts;
}
