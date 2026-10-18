"use client";

import { createLocalStore } from "@/lib/local-store";
import type { FootfallSession, Storefront } from "./types";

/** Field Mode data, kept on the phone that collected it. */
export type FieldData = {
  sessions: FootfallSession[];
  storefront: Record<string, { result: Storefront; at: string; model: string }>;
  notes: Record<string, string>;
};

const store = createLocalStore<FieldData>("spotwise.field.v1", { sessions: [], storefront: {}, notes: {} });

export const useFieldData = store.use;
export const saveFieldData = store.save;
export const getFieldData = store.get;
