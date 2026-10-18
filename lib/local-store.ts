"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny per-browser store on localStorage for convenience values (form inputs, last choices).
 * Never the source of truth; works (in memory) when storage is unavailable.
 */
export function createLocalStore<T extends object>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let snapshot: { raw: string | null; value: T } = { raw: null, value: empty };
  let memory: string | null = null; // fallback when localStorage throws

  const read = () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory;
    }
  };

  const getSnapshot = (): T => {
    const raw = read();
    if (raw !== snapshot.raw) {
      let value = empty;
      try {
        value = raw ? { ...empty, ...(JSON.parse(raw) as Partial<T>) } : empty;
      } catch {
        value = empty;
      }
      snapshot = { raw, value };
    }
    return snapshot.value;
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  };

  const save = (next: T) => {
    const raw = JSON.stringify(next);
    memory = raw;
    try {
      localStorage.setItem(key, raw);
    } catch {
      // keep the in-memory copy
    }
    listeners.forEach((l) => l());
  };

  const use = () => useSyncExternalStore(subscribe, getSnapshot, () => empty);

  return { use, save, get: getSnapshot };
}
