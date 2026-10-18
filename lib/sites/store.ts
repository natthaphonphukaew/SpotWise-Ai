"use client";

import { useMemo } from "react";
import type { Candidate } from "@/lib/data/bangmod";
import { createLocalStore } from "@/lib/local-store";
import { activeSites, allSites, EMPTY_SITES, type SitesState } from "./sites";

const store = createLocalStore<SitesState>("spotwise.sites.v1", EMPTY_SITES);

export const useSitesState = store.use;
export const saveSites = store.save;

/** The sites this browser is comparing (picked or pinned on the home page). */
export function useSites(base: Candidate[]) {
  const state = useSitesState();
  return useMemo(() => ({ state, sites: activeSites(base, state), all: allSites(base, state) }), [base, state]);
}
