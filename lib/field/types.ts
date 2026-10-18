import { z } from "zod";

/** One footfall count done on site (Field Mode, SPEC §5 W2). */
export type FootfallSession = {
  id: string;
  site: string;
  startedAt: string; // ISO
  seconds: number;
  count: number;
  slot: TimeSlot;
};

export type TimeSlot = "morning" | "noon" | "evening" | "other";
export const SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "เช้า 07–09",
  noon: "เที่ยง 11–13",
  evening: "เย็น 16–18",
  other: "ช่วงอื่น",
};

export function slotOf(d: Date): TimeSlot {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 9.5) return "morning";
  if (h >= 11 && h < 13.5) return "noon";
  if (h >= 16 && h < 18.5) return "evening";
  return "other";
}

/** Vision AI read of a storefront photo. Only what is visible; "unclear" when it can't tell. */
export const StorefrontSchema = z.object({
  visibility: z.number().int().min(1).max(5).describe("มองเห็นร้านจากถนน/ทางเดินชัดแค่ไหน 1–5"),
  frontage: z.enum(["narrow", "medium", "wide", "unclear"]).describe("ความกว้างหน้าร้าน"),
  motorbike_parking: z.enum(["yes", "no", "unclear"]),
  sidewalk: z.enum(["good", "narrow", "none", "unclear"]),
  shade: z.enum(["yes", "partial", "no", "unclear"]),
  signage_space: z.enum(["yes", "limited", "no", "unclear"]),
  obstacles: z.array(z.string()).max(5).describe("สิ่งที่บังหรือเป็นอุปสรรค เช่น เสาไฟ ต้นไม้ แผงลอย"),
  summary: z.string().describe("สรุป 1–2 ประโยค ภาษาไทย จากสิ่งที่เห็นในภาพเท่านั้น"),
  cannot_judge: z.array(z.string()).max(5).describe("สิ่งที่ภาพนี้บอกไม่ได้ ต้องไปดูเอง"),
});
export type Storefront = z.infer<typeof StorefrontSchema>;

/** What Field Mode knows about one site, as fed into Loc-Score. */
export type FieldSummary = {
  footfallPerMin: number | null;
  minutesCounted: number;
  slots: TimeSlot[];
  storefront: Storefront | null;
  lastAt: string | null;
};

const MIN_SECONDS = 120; // shorter counts are too noisy to use

export function summarizeField(site: string, sessions: FootfallSession[], storefront: Storefront | null): FieldSummary {
  const usable = sessions.filter((s) => s.site === site && s.seconds >= MIN_SECONDS);
  const seconds = usable.reduce((a, s) => a + s.seconds, 0);
  const count = usable.reduce((a, s) => a + s.count, 0);
  const last = [...usable].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return {
    footfallPerMin: seconds > 0 ? count / (seconds / 60) : null,
    minutesCounted: seconds / 60,
    slots: [...new Set(usable.map((s) => s.slot))],
    storefront,
    lastAt: last?.startedAt ?? null,
  };
}
