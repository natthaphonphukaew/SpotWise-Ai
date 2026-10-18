/**
 * Which sites the user is comparing (SPEC §7 Setup: pick or pin 3 sites). Surveyed candidates come
 * from candidates.json with walking isochrones; pins dropped by the user have none, so they get
 * straight-line radii instead (same as Spot Finder) and are labelled as an approximation.
 */
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Candidate } from "@/lib/data/bangmod";
import type { IsochroneFC, IsochroneProps } from "@/lib/geo/catchment";
import { RADIUS_10_MIN, RADIUS_5_MIN } from "@/lib/geo/spot";
import { distanceM, type LngLat } from "@/lib/scoring/huff";

export const MAX_SITES = 3;
/** Pins must sit inside the area the data covers (SPEC §1: ~2 km around KMUTT). */
export const PIN_RADIUS_M = 2000;

export type CustomSite = { id: string; label: string; lon: number; lat: number };
export type SitesState = {
  custom: CustomSite[];
  /** ids in comparison order; null = not chosen yet (use the first surveyed candidates) */
  selected: string[] | null;
};
export const EMPTY_SITES: SitesState = { custom: [], selected: null };

const asCandidate = (s: CustomSite): Candidate => ({ ...s, rent_thb: null, custom: true });

/** Every site the user can choose from: surveyed candidates first, then their own pins. */
export function allSites(base: Candidate[], state: SitesState): Candidate[] {
  return [...base, ...state.custom.map(asCandidate)];
}

/** The sites being compared, in order. Falls back to the first surveyed candidates. */
export function activeSites(base: Candidate[], state: SitesState): Candidate[] {
  const pool = allSites(base, state);
  const picked = (state.selected ?? []).map((id) => pool.find((c) => c.id === id)).filter((c): c is Candidate => !!c);
  return picked.length ? picked.slice(0, MAX_SITES) : base.slice(0, MAX_SITES);
}

const selectedIds = (base: Candidate[], state: SitesState) => activeSites(base, state).map((c) => c.id);

/** Add or remove a site from the comparison; adding beyond MAX_SITES is refused (returns state unchanged). */
export function toggleSite(base: Candidate[], state: SitesState, id: string): SitesState {
  const ids = selectedIds(base, state);
  if (ids.includes(id)) {
    const rest = ids.filter((x) => x !== id);
    return rest.length ? { ...state, selected: rest } : state; // keep at least one site
  }
  if (ids.length >= MAX_SITES) return state;
  return { ...state, selected: [...ids, id] };
}

/** Next free pin id: P1, P2, … (never reused while the pin exists). */
export function nextPinId(state: SitesState): string {
  const used = new Set(state.custom.map((c) => c.id));
  let i = 1;
  while (used.has(`P${i}`)) i++;
  return `P${i}`;
}

export type PinCheck = { ok: true } | { ok: false; reason: string };

/** Pins the model can't score honestly are refused, with the reason shown to the user. */
export function checkPin(at: LngLat, centre: LngLat, campus: FeatureCollection): PinCheck {
  if (distanceM(centre, at) > PIN_RADIUS_M) return { ok: false, reason: "อยู่นอกพื้นที่ที่มีข้อมูล (รัศมี 2 กม. รอบ มจธ.)" };
  const onCampus = campus.features.some(
    (f) =>
      (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") &&
      booleanPointInPolygon(at, f as Feature<Polygon | MultiPolygon>),
  );
  if (onCampus) return { ok: false, reason: "อยู่ในรั้ว มจธ. ซึ่งโมเดลกระจายคนในมหาลัยไว้ทั่วพื้นที่ จึงให้คะแนนในรั้วไม่ได้" };
  return { ok: true };
}

/** Add a pin and put it in the comparison when there is room. */
export function addPin(base: Candidate[], state: SitesState, at: LngLat, label: string): SitesState {
  const id = nextPinId(state);
  const pin: CustomSite = { id, label: label.trim() || `หมุด ${id}`, lon: at[0], lat: at[1] };
  const next = { ...state, custom: [...state.custom, pin] };
  const ids = selectedIds(base, state);
  return ids.length < MAX_SITES ? { ...next, selected: [...ids, id] } : { ...next, selected: ids };
}

export function removePin(base: Candidate[], state: SitesState, id: string): SitesState {
  const ids = selectedIds(base, state).filter((x) => x !== id);
  return { custom: state.custom.filter((c) => c.id !== id), selected: ids.length ? ids : null };
}

/** Circle polygon around a point (64 segments), good enough at this scale. */
export function circle(at: LngLat, radiusM: number, steps = 64): Polygon {
  const dLat = radiusM / 110_540;
  const dLon = radiusM / (111_320 * Math.cos((at[1] * Math.PI) / 180));
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (2 * Math.PI * (i % steps)) / steps;
    return [at[0] + dLon * Math.cos(a), at[1] + dLat * Math.sin(a)];
  });
  return { type: "Polygon", coordinates: [ring] };
}

/** Isochrones plus 5/10-minute radius circles for any site that has no walking isochrone. */
export function withSiteCatchments(iso: IsochroneFC, sites: Candidate[]): IsochroneFC {
  const has = new Set(iso.features.map((f) => f.properties.candidate));
  const extra = sites
    .filter((s) => !has.has(s.id))
    .flatMap((s) =>
      (
        [
          [5, RADIUS_5_MIN],
          [10, RADIUS_10_MIN],
        ] as const
      ).map(([minutes, r]) => ({
        type: "Feature" as const,
        properties: { candidate: s.id, minutes, snap_m: 0, radius_m: r } satisfies IsochroneProps,
        geometry: circle([s.lon, s.lat], r),
      })),
    );
  return extra.length ? { ...iso, features: [...iso.features, ...extra] } : iso;
}
