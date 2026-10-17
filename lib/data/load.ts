"use client";

import type { FeatureCollection, Point } from "geojson";
import { applyAiLabels } from "./ai-labels";
import { DATA_BASE, type PoiAiFile } from "./bangmod";
import type { IsochroneFC, PoiFC } from "@/lib/geo/catchment";
import { demandCells, type PopulationFC } from "@/lib/geo/site";
import type { DemandCell } from "@/lib/scoring/huff";

export type BangmodData = {
  poi: PoiFC; // AI labels applied when poi_ai.json exists
  iso: IsochroneFC;
  transit: FeatureCollection<Point>;
  campus: FeatureCollection;
  population: PopulationFC | null;
  cells: DemandCell[];
  ai: PoiAiFile | null;
};

const json = <T,>(f: string) => fetch(`${DATA_BASE}/${f}`).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);

let cached: Promise<BangmodData> | null = null;

/** Static Bangmod dataset, fetched once per page load and shared by the map and the compare page. */
export function loadBangmod(): Promise<BangmodData> {
  cached ??= Promise.all([
    json<PoiFC>("poi.geojson"),
    json<IsochroneFC>("isochrones.geojson"),
    json<FeatureCollection<Point>>("transit.geojson"),
    json<FeatureCollection>("campus.geojson"),
    json<PopulationFC>("population.geojson"),
    json<PoiAiFile>("poi_ai.json"),
  ]).then(([poi, iso, transit, campus, population, ai]) => {
    if (!poi || !iso || !transit || !campus) throw new Error("Bangmod data files are missing");
    return { poi: applyAiLabels(poi, ai), iso, transit, campus, population, cells: population ? demandCells(population) : [], ai };
  });
  return cached;
}
