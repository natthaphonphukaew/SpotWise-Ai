/**
 * Loc-Score (SPEC §4): five explainable dimensions, each with a certainty level and the evidence
 * it was computed from. Pure: all inputs are passed in, nothing is fetched here.
 *
 * Scores are 0–100 "how favourable", NOT a probability of success (SPEC §4).
 */
import { normalizeWeights, WEIGHT_KEYS, type WeightKey } from "@/lib/profile/schema";

/** How solid a number is — drives hatching in the UI (DESIGN.md §1). */
export type Certainty = "surveyed" | "open" | "estimated" | "missing";

export type EvidenceItem = {
  label: string;
  value: number | null;
  unit: string;
  kind: Certainty | "assumption";
  source: string;
};

export type Dimension = {
  key: WeightKey;
  score: number | null;
  certainty: Certainty;
  confidence: number; // 0–1
  evidence: EvidenceItem[];
  /** One-line plain-Thai explanation of the formula */
  how: string;
};

/** Everything measured around one candidate site. */
export type SiteInputs = {
  pop10: number; // WorldPop people within the 10-min walk
  edu10: number; // education places within 10 min
  stops5: number; // transit stops within 5 min
  poi5: number; // all places within 5 min (activity proxy)
  direct10: number;
  indirect10: number;
  synergy10: number;
  huffShare: number; // our expected category share in reach (Huff)
  huffCapturedPop: number;
  campusDemand: number; // daytime campus population added as a demand point (assumption)
  rentThb: number | null; // monthly, user-entered
};

export type Assumptions = {
  avgTicketThb: number;
  /** KMUTT students (FTE) — Times Higher Education 2025, whole university */
  campusStudents: number;
  /** share of them on the Bangmod campus on a weekday */
  campusPresence: number;
  /** share of people in reach who buy this category on a given day */
  dailyPurchaseRate: number;
  openDaysPerMonth: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  avgTicketThb: 50,
  campusStudents: 14_866,
  campusPresence: 0.6,
  dailyPurchaseRate: 0.04,
  openDaysPerMonth: 26,
};
export const CAMPUS_STUDENTS_SOURCE = "Times Higher Education 2025 (นักศึกษา FTE ทั้ง มจธ. ทุกวิทยาเขต)";

const CONFIDENCE: Record<Certainty, number> = { surveyed: 0.9, open: 0.7, estimated: 0.45, missing: 0 };

/** Diminishing returns: 0 at x=0, ~63 at x=k, ~95 at x=3k. */
export const saturate = (x: number, k: number) => 100 * (1 - Math.exp(-Math.max(0, x) / k));
const round = (x: number) => Math.round(x);

/** Rent as a share of revenue: ≤10% is comfortable, ≥30% is not viable (common F&B rule of thumb). */
export function rentScore(ratio: number): number {
  if (ratio <= 0.1) return 100;
  if (ratio >= 0.3) return 0;
  return ((0.3 - ratio) / 0.2) * 100;
}

export function customersPerDay(inp: SiteInputs, a: Assumptions) {
  const mid = inp.huffCapturedPop * a.dailyPurchaseRate;
  return { low: mid * 0.5, mid, high: mid * 1.5 };
}

export function scoreSite(inp: SiteInputs, weights: Record<WeightKey, number>, a: Assumptions = DEFAULT_ASSUMPTIONS) {
  const cust = customersPerDay(inp, a);
  const revenueMonth = cust.mid * a.avgTicketThb * a.openDaysPerMonth;
  const WP = "WorldPop 2025 (ประมาณจากโมเดล)";
  const POI = "Overture + OSM + CampusSpot (จัดกลุ่มโดย AI/กฎ)";

  const dims: Dimension[] = [
    {
      key: "target",
      score: round(0.6 * saturate(inp.pop10, 6000) + 0.4 * saturate(inp.edu10, 30)),
      certainty: "estimated",
      confidence: CONFIDENCE.estimated,
      how: "ประชากรในระยะเดิน 10 นาที (60%) + สถานศึกษาในระยะเดิน 10 นาที (40%)",
      evidence: [
        { label: "ประชากรในระยะเดิน 10 นาที", value: round(inp.pop10), unit: "คน", kind: "estimated", source: WP },
        { label: "สถานศึกษาในระยะเดิน 10 นาที", value: inp.edu10, unit: "แห่ง", kind: "open", source: POI },
      ],
    },
    {
      key: "access",
      score: round(0.5 * saturate(inp.stops5, 3) + 0.5 * saturate(inp.poi5, 60)),
      certainty: "open",
      confidence: CONFIDENCE.open,
      how: "ป้ายรถ/วินในระยะเดิน 5 นาที (50%) + จำนวนสถานที่รอบตัว ซึ่งบอกว่าย่านคึกคักแค่ไหน (50%)",
      evidence: [
        { label: "ป้ายรถ/วินในระยะเดิน 5 นาที", value: inp.stops5, unit: "จุด", kind: "open", source: "OpenStreetMap" },
        { label: "สถานที่ทั้งหมดในระยะเดิน 5 นาที", value: inp.poi5, unit: "แห่ง", kind: "open", source: POI },
      ],
    },
    {
      key: "market",
      score: round(saturate(inp.huffShare, 0.02)),
      certainty: "estimated",
      confidence: CONFIDENCE.estimated,
      how: "ส่วนแบ่งลูกค้าที่ร้านเราน่าจะได้ในรัศมี 1.5 กม. ตาม Huff model (คู่แข่งตรงดึง 1 อ้อมดึง 0.2) ส่วนแบ่ง 2% ≈ 63 คะแนน 6% ≈ 95",
      evidence: [
        { label: "ส่วนแบ่งที่คาด (Huff)", value: Math.round(inp.huffShare * 1000) / 10, unit: "%", kind: "estimated", source: "Huff model จาก " + WP },
        { label: "คู่แข่งตรงในระยะเดิน 10 นาที", value: inp.direct10, unit: "ร้าน", kind: "open", source: POI },
        { label: "คู่แข่งอ้อมในระยะเดิน 10 นาที", value: inp.indirect10, unit: "ร้าน", kind: "open", source: POI },
        { label: "คนใน มจธ. ระหว่างวัน (นับเป็นดีมานด์)", value: round(inp.campusDemand), unit: "คน", kind: "assumption", source: CAMPUS_STUDENTS_SOURCE },
      ],
    },
    {
      key: "rent",
      score: inp.rentThb == null || revenueMonth <= 0 ? null : round(rentScore(inp.rentThb / revenueMonth)),
      certainty: inp.rentThb == null ? "missing" : "estimated",
      confidence: inp.rentThb == null ? 0 : CONFIDENCE.estimated,
      how: "ค่าเช่า ÷ รายได้คาดการณ์ (≤10% = 100, ≥30% = 0) รายได้ = ลูกค้า/วัน × ยอดต่อบิล × วันเปิด",
      evidence: [
        { label: "ค่าเช่าต่อเดือน", value: inp.rentThb, unit: "บาท", kind: inp.rentThb == null ? "missing" : "surveyed", source: "ผู้ใช้กรอก" },
        { label: "รายได้คาดการณ์ต่อเดือน", value: round(revenueMonth), unit: "บาท", kind: "estimated", source: "Huff × สมมติฐาน" },
        { label: "ค่าเช่าคิดเป็น", value: inp.rentThb == null || revenueMonth <= 0 ? null : Math.round((inp.rentThb / revenueMonth) * 1000) / 10, unit: "% ของรายได้", kind: "estimated", source: "คำนวณ" },
      ],
    },
    {
      key: "synergy",
      score: round(saturate(inp.synergy10, 40)),
      certainty: "open",
      confidence: CONFIDENCE.open,
      how: "จำนวนสถานที่เกื้อหนุน (ตามโปรไฟล์ร้าน) ในระยะเดิน 10 นาที",
      evidence: [{ label: "สถานที่เกื้อหนุนในระยะเดิน 10 นาที", value: inp.synergy10, unit: "แห่ง", kind: "open", source: POI }],
    },
  ];

  // Missing dimensions are left out of the total (weights re-normalised) and lower the confidence.
  const w = normalizeWeights(weights);
  const scored = dims.filter((d) => d.score != null);
  const wSum = scored.reduce((s, d) => s + w[d.key], 0);
  const total = wSum > 0 ? round(scored.reduce((s, d) => s + (d.score as number) * w[d.key], 0) / wSum) : null;
  const confidence = WEIGHT_KEYS.reduce((s, k) => s + (dims.find((d) => d.key === k)!.confidence * w[k]) / 100, 0);

  return {
    dims,
    total,
    confidence: Math.round(confidence * 100),
    customers: { low: round(cust.low), mid: round(cust.mid), high: round(cust.high) },
    revenueMonth: round(revenueMonth),
    assumptions: a,
  };
}

export type SiteScore = ReturnType<typeof scoreSite>;
