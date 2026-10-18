import type { Candidate } from "@/lib/data/bangmod";
import type { BusinessProfile, WeightKey } from "@/lib/profile/schema";
import type { Summary } from "@/lib/scoring/finance";
import type { EvidenceItem, SiteScore } from "@/lib/scoring/locscore";

/** One citable fact for the Advisor. `id` is what the report cites: "B3", "G1". */
export type EvidenceRef = {
  id: string;
  site: string | null; // null = applies to all sites
  label: string;
  value: number | string | null;
  unit: string;
  kind: EvidenceItem["kind"] | "score" | "profile";
  source: string;
};

const DIM_LABEL: Record<WeightKey, string> = {
  target: "คะแนนกลุ่มเป้าหมาย",
  access: "คะแนนการเข้าถึง",
  market: "คะแนนความอิ่มตัวตลาด",
  rent: "คะแนนความคุ้มค่าค่าเช่า",
  synergy: "คะแนนสถานที่เกื้อหนุน",
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Everything the Advisor may cite, numbered per site. Built only from computed data — the LLM
 * gets this list and nothing else about the area, so it cannot invent places or numbers (rule 4).
 */
export function buildEvidence(
  candidates: Candidate[],
  scores: Record<string, SiteScore>,
  finance: Record<string, Summary> | null,
  profile: BusinessProfile | null,
  calendarSource: string | null,
): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  let g = 0;
  const global = (e: Omit<EvidenceRef, "id" | "site">) => out.push({ ...e, id: `G${++g}`, site: null });

  if (profile) {
    global({
      label: "ประเภทร้าน",
      value: profile.business_label,
      unit: "",
      kind: "profile",
      source: "โปรไฟล์ร้าน (AI + ผู้ใช้)",
    });
    global({
      label: "ยอดเฉลี่ยต่อบิล",
      value: profile.avg_ticket_thb,
      unit: "บาท",
      kind: profile.avg_ticket_source === "user" ? "surveyed" : "assumption",
      source: "โปรไฟล์ร้าน",
    });
    if (profile.budget_thb != null)
      global({ label: "งบเปิดร้าน", value: profile.budget_thb, unit: "บาท", kind: "surveyed", source: "ผู้ใช้บอก" });
  }
  if (calendarSource) {
    global({
      label: "ปฏิทินการศึกษาที่ใช้คำนวณช่วงปิดภาค",
      value: null,
      unit: "",
      kind: "open",
      source: calendarSource,
    });
  }

  for (const c of candidates) {
    const s = scores[c.id];
    if (!s) continue;
    let n = 0;
    const add = (e: Omit<EvidenceRef, "id" | "site">) => out.push({ ...e, id: `${c.id}${++n}`, site: c.id });
    add({
      label: `ทำเล ${c.id}: ${c.label}`,
      value: c.placeholder ? "จุดตัวอย่าง ยังไม่ได้สำรวจ" : "สำรวจแล้ว",
      unit: "",
      kind: c.placeholder ? "assumption" : "surveyed",
      source: "candidates.json",
    });
    add({ label: "Loc-Score รวม", value: s.total, unit: "/100", kind: "score", source: "SpotWise Loc-Score" });
    add({ label: "Confidence", value: s.confidence, unit: "%", kind: "score", source: "SpotWise Loc-Score" });
    add({
      label: "ลูกค้าคาดการณ์ต่อวัน (ต่ำ–สูง)",
      value: `${s.customers.low}–${s.customers.high}`,
      unit: "คน/วัน",
      kind: "estimated",
      source: "Huff model × สมมติฐานอัตราซื้อ",
    });
    for (const d of s.dims) {
      add({ label: DIM_LABEL[d.key], value: d.score, unit: "/100", kind: "score", source: `วิธีคิด: ${d.how}` });
      for (const e of d.evidence) {
        add({
          label: e.label,
          value: typeof e.value === "number" ? round1(e.value) : e.value,
          unit: e.unit,
          kind: e.kind,
          source: e.source,
        });
      }
    }
    const f = finance?.[c.id];
    if (f) {
      add({
        label: "กำไร/ขาดทุนเฉลี่ยต่อเดือน (สถานการณ์กลาง)",
        value: Math.round(f.avgNetMonth),
        unit: "บาท",
        kind: "estimated",
        source: "จำลองการเงิน",
      });
      add({
        label: "เดือนที่แย่ที่สุด (สถานการณ์กลาง)",
        value: Math.round(f.worstMonth.net),
        unit: `บาท (${f.worstMonth.month})`,
        kind: "estimated",
        source: "จำลองการเงินตามปฏิทินการศึกษา",
      });
      add({
        label: "เงินสำรองที่ควรมีนอกจากงบเปิดร้าน",
        value: Math.round(f.reserveThb),
        unit: "บาท",
        kind: "estimated",
        source: "จำลองการเงิน",
      });
      add({
        label: "คืนทุนงบเปิดร้าน",
        value: f.paybackMonths,
        unit: f.paybackMonths ? "เดือน" : "(เกิน 36 เดือน)",
        kind: "estimated",
        source: "จำลองการเงิน",
      });
      add({
        label: "ลูกค้าช่วงเปิดเทอมที่ต้องได้เพื่อคุ้มทุน",
        value: Math.round(f.breakevenCustomers),
        unit: "คน/วัน",
        kind: "estimated",
        source: "จำลองการเงิน",
      });
    }
  }
  return out;
}

/** Compact line format sent to the LLM. */
export function evidenceLines(ev: EvidenceRef[]): string {
  return ev.map((e) => `${e.id} | ${e.label} | ${e.value ?? "—"} ${e.unit} | ${e.kind} | ${e.source}`).join("\n");
}
