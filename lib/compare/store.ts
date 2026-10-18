"use client";

import { createLocalStore } from "@/lib/local-store";

/** Compare-page inputs kept per browser: rents the user typed and assumption overrides. */
export type CompareInputs = {
  rents: Record<string, number | null>;
  dailyPurchaseRate: number | null; // null = default
  campusPresence: number | null;
};

const store = createLocalStore<CompareInputs>("spotwise.compare.v1", {
  rents: {},
  dailyPurchaseRate: null,
  campusPresence: null,
});

export const useCompareInputs = store.use;
export const saveCompareInputs = store.save;

/** Simulator inputs; null = use the default / the value derived from Loc-Score. */
export type SimulateInputs = {
  site: string | null;
  customersPerDay: number | null;
  cogsShare: number | null;
  staffThb: number | null;
  otherFixedThb: number | null;
  setupThb: number | null;
  breakFactor: number | null;
  specialFactor: number | null;
  startMonth: string | null;
};

const sim = createLocalStore<SimulateInputs>("spotwise.simulate.v1", {
  site: null,
  customersPerDay: null,
  cogsShare: null,
  staffThb: null,
  otherFixedThb: null,
  setupThb: null,
  breakFactor: null,
  specialFactor: null,
  startMonth: null,
});

export const useSimulateInputs = sim.use;
export const saveSimulateInputs = sim.save;
