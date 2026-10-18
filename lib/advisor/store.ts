"use client";

import type { LlmMeta } from "@/lib/llm/types";
import type { AdvisorReport } from "@/lib/llm/tasks/advisor";
import { createLocalStore } from "@/lib/local-store";

export type Grounding = { ok: number; total: number; rate: number; checks: { ok: boolean; problems: string[] }[] };
export type SavedReport = { sig: string; report: AdvisorReport; meta: LlmMeta; grounding: Grounding } | null;

/** Latest Advisor report in this browser (shown only while the evidence signature matches). */
export const lastReport = createLocalStore<{ saved: SavedReport }>("spotwise.advisor.v1", { saved: null });
