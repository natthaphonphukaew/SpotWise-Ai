import { z } from "zod";
import { GROUPS, type PoiGroup } from "@/lib/data/bangmod";

/** POI groups the profiler may use (everything the map knows except the "other" bucket). */
export const PROFILE_GROUPS = (Object.keys(GROUPS) as PoiGroup[]).filter((g) => g !== "other");
const Group = z.enum(PROFILE_GROUPS as [PoiGroup, ...PoiGroup[]]);

/** Values the user stated vs. values the AI filled in (shown hatched in the UI). */
const Source = z.enum(["user", "assumed"]);

export const WEIGHT_KEYS = ["target", "access", "market", "rent", "synergy"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

export const BusinessProfileSchema = z.object({
  business_label: z.string().describe("ประเภทธุรกิจสั้นๆ ภาษาไทย เช่น ร้านชาไข่มุก"),
  summary: z.string().describe("สรุปคอนเซ็ปต์ 1 ประโยค ภาษาไทย"),
  price_min_thb: z.number().nullable().describe("ราคาต่ำสุดต่อชิ้น ถ้าผู้ใช้ไม่ได้บอกให้เป็น null"),
  price_max_thb: z.number().nullable().describe("ราคาสูงสุดต่อชิ้น ถ้าผู้ใช้ไม่ได้บอกให้เป็น null"),
  avg_ticket_thb: z.number().describe("ยอดซื้อเฉลี่ยต่อบิล (บาท)"),
  avg_ticket_source: Source,
  budget_thb: z.number().nullable().describe("งบเปิดร้าน ถ้าผู้ใช้ไม่ได้บอกให้เป็น null"),
  target_segments: z.array(z.object({ label: z.string(), share: z.number().describe("สัดส่วน 0-100") })).min(1).max(4),
  direct_competitors: z.array(Group).describe("กลุ่มที่ขายสิ่งเดียวกัน แย่งลูกค้ากลุ่มเดียวกันโดยตรง"),
  indirect_competitors: z.array(Group).describe("กลุ่มที่ลูกค้าอาจเลือกแทน"),
  synergy: z.array(z.object({ group: Group, reason: z.string() })).describe("กลุ่มที่พาลูกค้ามาให้"),
  peak_hours: z.array(z.object({ from: z.string().describe("HH:MM"), to: z.string().describe("HH:MM"), reason: z.string() })).max(4),
  weights: z.object({
    target: z.number().describe("ความเหมาะกับกลุ่มเป้าหมาย"),
    access: z.number().describe("การเข้าถึง/กิจกรรมในพื้นที่"),
    market: z.number().describe("ความอิ่มตัวของตลาด"),
    rent: z.number().describe("ความคุ้มค่าค่าเช่า"),
    synergy: z.number().describe("สถานที่เกื้อหนุน"),
  }).describe("น้ำหนักคะแนน 5 มิติ รวมกัน 100"),
  assumptions: z.array(z.string()).describe("สิ่งที่ AI สันนิษฐานเอง ผู้ใช้ไม่ได้บอก"),
  to_verify: z.array(z.string()).describe("สิ่งที่ผู้ใช้ควรไปตรวจสอบเอง"),
});

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

/** Weights rounded to integers that sum to exactly 100 (largest remainder). */
export function normalizeWeights(w: Record<WeightKey, number>): Record<WeightKey, number> {
  let raw = WEIGHT_KEYS.map((k) => Math.max(0, w[k] || 0));
  if (raw.every((v) => v === 0)) raw = raw.map(() => 1); // no signal → equal weights
  const total = raw.reduce((a, b) => a + b, 0);
  const exact = raw.map((v) => (v / total) * 100);
  const floor = exact.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => ({ i, frac: v - floor[i] }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        floor[i]++;
        left--;
      }
    });
  return Object.fromEntries(WEIGHT_KEYS.map((k, i) => [k, floor[i]])) as Record<WeightKey, number>;
}

/** Deterministic clean-up after the model: no group in two roles, weights sum to 100. */
export function cleanProfile(p: BusinessProfile): BusinessProfile {
  const direct = [...new Set(p.direct_competitors)];
  const indirect = [...new Set(p.indirect_competitors)].filter((g) => !direct.includes(g));
  const taken = new Set([...direct, ...indirect]);
  const seen = new Set<PoiGroup>();
  const synergy = p.synergy.filter((s) => !taken.has(s.group) && !seen.has(s.group) && seen.add(s.group));
  return { ...p, direct_competitors: direct, indirect_competitors: indirect, synergy, weights: normalizeWeights(p.weights) };
}

export type Role = "comp" | "comp-indirect" | "synergy" | "context";

/** Map role per POI group: from the profile when there is one, else the defaults in GROUPS. */
export function rolesFor(profile: BusinessProfile | null): Record<PoiGroup, Role> {
  const roles = Object.fromEntries((Object.keys(GROUPS) as PoiGroup[]).map((g) => [g, profile ? "context" : GROUPS[g].role])) as Record<PoiGroup, Role>;
  if (!profile) return roles;
  profile.direct_competitors.forEach((g) => (roles[g] = "comp"));
  profile.indirect_competitors.forEach((g) => (roles[g] = "comp-indirect"));
  profile.synergy.forEach((s) => (roles[s.group] = "synergy"));
  return roles;
}
