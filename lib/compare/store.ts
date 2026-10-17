"use client";

import { useSyncExternalStore } from "react";

/** Compare-page inputs kept per browser: rents the user typed and assumption overrides. */
export type CompareInputs = {
  rents: Record<string, number | null>;
  dailyPurchaseRate: number | null; // null = default
  campusPresence: number | null;
};

const KEY = "spotwise.compare.v1";
const EMPTY: CompareInputs = { rents: {}, dailyPurchaseRate: null, campusPresence: null };
const listeners = new Set<() => void>();
let snapshot: { raw: string | null; value: CompareInputs } = { raw: null, value: EMPTY };

function getSnapshot(): CompareInputs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== snapshot.raw) {
    let value = EMPTY;
    try {
      value = raw ? { ...EMPTY, ...(JSON.parse(raw) as CompareInputs) } : EMPTY;
    } catch {
      value = EMPTY;
    }
    snapshot = { raw, value };
  }
  return snapshot.value;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function saveCompareInputs(next: CompareInputs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: values live only until reload
  }
  listeners.forEach((l) => l());
}

export function useCompareInputs(): CompareInputs {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
