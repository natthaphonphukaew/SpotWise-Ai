"use client";

import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, type RefObject } from "react";
import { cssVar } from "@/lib/css-var";
import type { PoiGroup } from "@/lib/data/bangmod";
import type { BangmodData } from "@/lib/data/load";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { campusDemand } from "@/lib/geo/site";
import { gridAround, pointInputs, prepareContext } from "@/lib/geo/spot";
import type { Role, WeightKey } from "@/lib/profile/schema";
import { distanceM, type LngLat } from "@/lib/scoring/huff";
import { DEFAULT_ASSUMPTIONS, scoreSite } from "@/lib/scoring/locscore";

export const SPOT_RADIUS_M = 1500;
export const SPOT_STEP_M = 100;
const TOP_N = 5;
const TOP_SEPARATION_M = 250;

export type Spot = { at: LngLat; total: number; customers: number; rank?: number };

/**
 * W4 Spot Finder: score a 100 m grid around KMUTT with the same Loc-Score (rent excluded) and
 * show it as a heat layer plus the best few, well-separated spots.
 */
export function useSpotFinder(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  data: BangmodData | null,
  center: LngLat,
  roles: Record<PoiGroup, Role>,
  weights: Record<WeightKey, number>,
  campusPresence: number,
  enabled: boolean,
) {
  const result = useMemo(() => {
    if (!enabled || !data) return null;
    const campus = campusDemand(data.campus, DEFAULT_ASSUMPTIONS.campusStudents * campusPresence);
    const ctx = prepareContext(data, roles, campus);
    // A shop cannot be rented inside the university fence.
    const onCampus = (p: LngLat) =>
      data.campus.features.some((f) => booleanPointInPolygon(p, f as Feature<Polygon | MultiPolygon>));
    const spots: Spot[] = gridAround(center, SPOT_RADIUS_M, SPOT_STEP_M)
      .filter((at) => !onCampus(at))
      .map((at) => {
        const s = scoreSite(pointInputs(at, ctx), weights);
        return { at, total: s.total ?? 0, customers: s.customers.mid };
      });
    const top: Spot[] = [];
    for (const s of [...spots].sort((a, b) => b.total - a.total)) {
      if (top.every((t) => distanceM(t.at, s.at) >= TOP_SEPARATION_M)) top.push({ ...s, rank: top.length + 1 });
      if (top.length === TOP_N) break;
    }
    return { spots, top };
  }, [enabled, data, center, roles, weights, campusPresence]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource("spots")) return;
    const half = SPOT_STEP_M / 2;
    const cells = (result?.spots ?? []).map((s) => {
      const dLat = half / 110_540;
      const dLon = half / (111_320 * Math.cos((s.at[1] * Math.PI) / 180));
      const [x, y] = s.at;
      return {
        type: "Feature" as const,
        properties: { total: s.total },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [x - dLon, y - dLat],
              [x + dLon, y - dLat],
              [x + dLon, y + dLat],
              [x - dLon, y + dLat],
              [x - dLon, y - dLat],
            ],
          ],
        },
      };
    });
    const tops = (result?.top ?? []).map((s) => ({
      type: "Feature" as const,
      properties: { rank: s.rank, total: s.total },
      geometry: { type: "Point" as const, coordinates: s.at },
    }));
    (map.getSource("spots") as GeoJSONSource).setData({ type: "FeatureCollection", features: cells });
    (map.getSource("spots-top") as GeoJSONSource).setData({ type: "FeatureCollection", features: tops });
  }, [mapRef, ready, result]);

  return result;
}

/** Empty sources + layers, added once on style load (below the POI layers). */
export function addSpotLayers(map: MapLibreMap, beforeId: string) {
  const empty = { type: "FeatureCollection" as const, features: [] };
  map.addSource("spots", { type: "geojson", data: empty });
  map.addSource("spots-top", { type: "geojson", data: empty });
  map.addLayer(
    {
      id: "spots",
      type: "fill",
      source: "spots",
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "total"],
          30,
          cssVar("--color-paper-2"),
          55,
          cssVar("--color-ink-3"),
          80,
          cssVar("--color-ink"),
        ] as unknown as ExpressionSpecification,
        "fill-opacity": 0.5,
      },
    },
    beforeId,
  );
  map.addLayer({
    id: "spots-top",
    type: "circle",
    source: "spots-top",
    paint: {
      "circle-radius": 11,
      "circle-color": cssVar("--color-paper"),
      "circle-stroke-color": cssVar("--color-accent"),
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "spots-top-label",
    type: "symbol",
    source: "spots-top",
    layout: {
      "text-field": ["to-string", ["get", "rank"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-allow-overlap": true,
    },
    paint: { "text-color": cssVar("--color-ink") },
  });
}
