import type { PoiGroup } from "@/lib/data/bangmod";
import type { Role } from "@/lib/profile/schema";

/**
 * Activity profile by time of day (SPEC §6 Should): how many places around a site are active at
 * each hour of a weekday, split by role. Open data almost never has opening hours here (18 of
 * ~4,200 places), so most places use the typical hours of their group below — an assumption,
 * shown as such. Counts are places, not people.
 */

/** First hour bucket shown (06:00) and one past the last (24:00). Bucket h covers h:00–h+1:00. */
export const DAY_START = 6;
export const DAY_END = 24;
export const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

type Window = [from: number, to: number]; // hours, `to` exclusive, may be fractional

/** Typical weekday active hours per group (assumption; see TYPICAL_HOURS_BASIS). */
export const TYPICAL_HOURS: Record<PoiGroup, Window[]> = {
  bubble_tea: [[10, 21]],
  coffee: [[7, 18]],
  drink_dessert: [[10, 21]],
  education: [[7, 17]],
  dormitory: [[6, 9], [17, 24]], // residents leave in the morning and are back in the evening
  office: [[8, 17]],
  market: [[6, 10], [16, 21]], // morning and evening markets
  food: [[9, 21]],
  convenience: [[6, 24]],
  health: [[8, 20]],
  leisure: [[5, 9], [16, 21]], // parks and sports: before and after work
  retail: [[10, 20]],
  other: [],
};
export const TYPICAL_HOURS_BASIS = "เวลาทำการทั่วไปของแต่ละหมวด (สมมติฐาน วันธรรมดา)";

/**
 * Read the first time range of an OSM `opening_hours` string, ignoring the days ("Mo-Fr 08:30-16:30",
 * "0800 - 1630", "24/7"). Ranges past midnight are cut at 24:00. Null when it can't be read.
 */
export function parseOpeningHours(s: string | null | undefined): Window[] | null {
  if (!s) return null;
  if (/24\s*\/\s*7/.test(s)) return [[0, 24]];
  const m = s.match(/(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})/);
  if (!m) return null;
  const from = Number(m[1]) + Number(m[2]) / 60;
  const to = Number(m[3]) + Number(m[4]) / 60;
  if (from >= 24 || to > 24 || from === to) return null;
  return [[from, to > from ? to : 24]];
}

const activeIn = (windows: Window[], h: number) => windows.some(([a, b]) => a < h + 1 && b > h);

export type ActivityPlace = { group: PoiGroup; opening_hours: string | null };
export type HourRow = { hour: number; synergy: number; comp: number; indirect: number };
export type ActivityProfile = {
  rows: HourRow[];
  /** places counted (synergy + competitors) and how many of them had real opening hours */
  places: number;
  withHours: number;
};

/** Places active per hour, by role. Context places are left out. Pure. */
export function activityProfile(places: ActivityPlace[], roles: Record<PoiGroup, Role>): ActivityProfile {
  const rows: HourRow[] = HOURS.map((hour) => ({ hour, synergy: 0, comp: 0, indirect: 0 }));
  let counted = 0;
  let withHours = 0;
  for (const p of places) {
    const role = roles[p.group];
    if (role === "context") continue;
    const real = parseOpeningHours(p.opening_hours);
    const windows = real ?? TYPICAL_HOURS[p.group];
    counted++;
    if (real) withHours++;
    for (const r of rows) {
      if (!activeIn(windows, r.hour)) continue;
      if (role === "synergy") r.synergy++;
      else if (role === "comp") r.comp++;
      else r.indirect++;
    }
  }
  return { rows, places: counted, withHours };
}

/** Hour buckets that overlap the shop's peak hours ("HH:MM" pairs from the profile; may wrap midnight). */
export function peakHourSet(peaks: { from: string; to: string }[]): Set<number> {
  const hm = (s: string) => {
    const m = s.match(/(\d{1,2})[:.](\d{2})/);
    return m ? Number(m[1]) + Number(m[2]) / 60 : null;
  };
  const out = new Set<number>();
  for (const p of peaks) {
    const a = hm(p.from);
    const b = hm(p.to);
    if (a == null || b == null || a === b) continue;
    const windows: Window[] = b > a ? [[a, b]] : [[a, 24], [0, b]];
    HOURS.forEach((h) => activeIn(windows, h) && out.add(h));
  }
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export type ActivitySummary = {
  /** average places active per hour inside the peak hours (null without peak hours) */
  peak: { synergy: number; comp: number; indirect: number } | null;
  allDay: { synergy: number; comp: number; indirect: number };
  /** hours with anchors active but no direct competitor open: a gap the shop could own */
  gapHours: number[];
};

export function summarizeActivity(profile: ActivityProfile, peak: Set<number>): ActivitySummary {
  const avg = (rows: HourRow[]) => ({
    synergy: mean(rows.map((r) => r.synergy)),
    comp: mean(rows.map((r) => r.comp)),
    indirect: mean(rows.map((r) => r.indirect)),
  });
  const inPeak = profile.rows.filter((r) => peak.has(r.hour));
  return {
    peak: inPeak.length ? avg(inPeak) : null,
    allDay: avg(profile.rows),
    gapHours: profile.rows.filter((r) => r.synergy > 0 && r.comp === 0).map((r) => r.hour),
  };
}

/** [21, 22, 23] → "21–24 น." · [7, 8, 18] → "07–09, 18–19 น." */
export function formatHourRanges(hours: number[]): string {
  const sorted = [...hours].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    parts.push(`${String(start).padStart(2, "0")}–${String(sorted[i] + 1).padStart(2, "0")}`);
  }
  return parts.length ? `${parts.join(", ")} น.` : "—";
}
