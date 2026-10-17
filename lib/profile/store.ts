"use client";

import { useSyncExternalStore } from "react";
import type { LlmMeta } from "@/lib/llm/types";
import type { BusinessProfile } from "./schema";

/** The active business profile, kept per browser (a convenience, not a source of truth). */
export type StoredProfile = {
  concept: string;
  profile: BusinessProfile;
  meta: LlmMeta;
  edited: boolean;
};

const KEY = "spotwise.profile.v1";
const listeners = new Set<() => void>();
let snapshot: { raw: string | null; value: StoredProfile | null } = { raw: null, value: null };

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): StoredProfile | null {
  const raw = read();
  if (raw !== snapshot.raw) {
    let value: StoredProfile | null = null;
    try {
      value = raw ? (JSON.parse(raw) as StoredProfile) : null;
    } catch {
      value = null;
    }
    snapshot = { raw, value };
  }
  return snapshot.value;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function saveProfile(p: StoredProfile | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable (private mode): nothing persists, the page still works
  }
  listeners.forEach((l) => l());
}

/** Current profile; null on the server and before anything was saved. */
export function useStoredProfile(): StoredProfile | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
