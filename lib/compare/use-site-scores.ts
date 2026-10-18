"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompareInputs } from "@/lib/compare/store";
import type { Candidate } from "@/lib/data/bangmod";
import { loadBangmod, type BangmodData } from "@/lib/data/load";
import { campusDemand, catchmentPlaces, siteInputs } from "@/lib/geo/site";
import {
  activityProfile,
  peakHourSet,
  summarizeActivity,
  type ActivityProfile,
  type ActivitySummary,
} from "@/lib/scoring/activity";
import { rolesFor, type WeightKey } from "@/lib/profile/schema";
import { useStoredProfile } from "@/lib/profile/store";
import { useFieldData } from "@/lib/field/store";
import { summarizeField, type FieldSummary } from "@/lib/field/types";
import { DEFAULT_ASSUMPTIONS, scoreSite, type SiteScore } from "@/lib/scoring/locscore";

// SPEC §4 defaults, used until the user has an AI profile
export const DEFAULT_WEIGHTS: Record<WeightKey, number> = { target: 25, access: 20, market: 20, rent: 20, synergy: 15 };

/** Loc-Score for every candidate from the shared data, the stored profile and the user's inputs. */
export function useSiteScores(candidates: Candidate[]) {
  const [data, setData] = useState<BangmodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stored = useStoredProfile();
  const inputs = useCompareInputs();
  const fieldData = useFieldData();
  const field = useMemo(
    () =>
      Object.fromEntries(
        candidates.map((c) => [c.id, summarizeField(c.id, fieldData.sessions, fieldData.storefront[c.id]?.result ?? null)]),
      ) as Record<string, FieldSummary>,
    [candidates, fieldData],
  );

  useEffect(() => {
    loadBangmod().then(setData, (e: Error) => setError(e.message));
  }, []);

  const profile = stored?.profile ?? null;
  const weights = profile?.weights ?? DEFAULT_WEIGHTS;
  const assumptions = useMemo(
    () => ({
      ...DEFAULT_ASSUMPTIONS,
      avgTicketThb: profile?.avg_ticket_thb ?? DEFAULT_ASSUMPTIONS.avgTicketThb,
      dailyPurchaseRate: inputs.dailyPurchaseRate ?? DEFAULT_ASSUMPTIONS.dailyPurchaseRate,
      campusPresence: inputs.campusPresence ?? DEFAULT_ASSUMPTIONS.campusPresence,
    }),
    [profile, inputs.dailyPurchaseRate, inputs.campusPresence],
  );

  const scores = useMemo(() => {
    if (!data) return null;
    const roles = rolesFor(profile);
    // Students and staff are on campus by day but not in WorldPop's residential counts.
    const campus = campusDemand(data.campus, assumptions.campusStudents * assumptions.campusPresence);
    return Object.fromEntries(
      candidates.map((c) => {
        const rent = inputs.rents[c.id] ?? c.rent_thb ?? null;
        return [c.id, scoreSite(siteInputs(c, data, roles, rent, campus, field[c.id]), weights, assumptions)];
      }),
    ) as Record<string, SiteScore>;
  }, [data, profile, weights, assumptions, candidates, inputs.rents, field]);

  const activity = useMemo(() => {
    if (!data) return null;
    const roles = rolesFor(profile);
    const peak = peakHourSet(profile?.peak_hours ?? []);
    return Object.fromEntries(
      candidates.map((c) => {
        const p = activityProfile(catchmentPlaces(c, data.poi, data.iso), roles);
        return [c.id, { profile: p, summary: summarizeActivity(p, peak) }];
      }),
    ) as Record<string, { profile: ActivityProfile; summary: ActivitySummary }>;
  }, [data, profile, candidates]);

  return { data, error, scores, stored, profile, weights, assumptions, inputs, field, fieldData, activity };
}
