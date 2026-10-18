"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompareInputs } from "@/lib/compare/store";
import type { Candidate } from "@/lib/data/bangmod";
import { loadBangmod, type BangmodData } from "@/lib/data/load";
import { centreOf, siteInputs } from "@/lib/geo/site";
import { rolesFor, type WeightKey } from "@/lib/profile/schema";
import { useStoredProfile } from "@/lib/profile/store";
import { DEFAULT_ASSUMPTIONS, scoreSite, type SiteScore } from "@/lib/scoring/locscore";

// SPEC §4 defaults, used until the user has an AI profile
export const DEFAULT_WEIGHTS: Record<WeightKey, number> = { target: 25, access: 20, market: 20, rent: 20, synergy: 15 };

/** Loc-Score for every candidate from the shared data, the stored profile and the user's inputs. */
export function useSiteScores(candidates: Candidate[]) {
  const [data, setData] = useState<BangmodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stored = useStoredProfile();
  const inputs = useCompareInputs();

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
    const centre = centreOf(data.campus);
    const campus = centre ? [{ at: centre, pop: assumptions.campusStudents * assumptions.campusPresence }] : [];
    return Object.fromEntries(
      candidates.map((c) => {
        const rent = inputs.rents[c.id] ?? c.rent_thb ?? null;
        return [c.id, scoreSite(siteInputs(c, data, roles, rent, campus), weights, assumptions)];
      }),
    ) as Record<string, SiteScore>;
  }, [data, profile, weights, assumptions, candidates, inputs.rents]);

  return { data, error, scores, stored, profile, weights, assumptions, inputs };
}
