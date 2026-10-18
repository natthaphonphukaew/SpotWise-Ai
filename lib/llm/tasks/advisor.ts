import { z } from "zod";
import { evidenceLines, type EvidenceRef } from "@/lib/advisor/evidence";
import type { LlmTask } from "../types";

const Cited = z.object({
  text: z.string().describe("หนึ่งประโยค ภาษาไทย"),
  cites: z.array(z.string()).min(1).describe("id ของหลักฐานที่ประโยคนี้ใช้ เช่น B3, G1"),
});

/** Grounded Advisor report (SPEC §2 #5) + Devil's Advocate (SPEC §5 W3). */
export const AdvisorSchema = z.object({
  verdict: z.object({
    best_site: z.string().describe("ทำเลที่แนะนำ (A/B/C) หรือ none ถ้าข้อมูลยังไม่พอ"),
    headline: Cited.describe("คำตัดสินหนึ่งประโยค"),
    conditions: z.array(Cited).max(3).describe("เงื่อนไขที่ต้องเป็นจริงก่อนเปิด"),
    change_mind_if: z.array(Cited).max(2).describe("จะเปลี่ยนคำแนะนำถ้า…"),
  }),
  facts: z.array(Cited).max(6).describe("ข้อเท็จจริงจากข้อมูล (kind: open/surveyed/score)"),
  assumptions: z.array(Cited).max(4).describe("สิ่งที่ผลลัพธ์พึ่งพาแต่เป็นค่าประมาณ/สมมติฐาน"),
  recommendations: z.array(Cited).max(4),
  debate: z.object({
    pro: z.array(Cited).min(1).max(3).describe("ฝ่ายหนุนทำเลที่แนะนำ"),
    con: z.array(Cited).min(1).max(3).describe("ฝ่ายค้านทำเลที่แนะนำ"),
  }),
  checklist: z.array(z.string()).max(6).describe("สิ่งที่ต้องไปตรวจเองก่อนเซ็นสัญญา ภาษาไทย สั้น"),
});
export type AdvisorReport = z.infer<typeof AdvisorSchema>;

const SYSTEM = `คุณคือที่ปรึกษาเลือกทำเลร้านค้า เขียนรายงานสั้นจาก "รายการหลักฐาน" ที่ให้เท่านั้น

กฎ (สำคัญที่สุด):
1. ทุกประโยคต้องอ้าง id หลักฐานใน cites อย่างน้อย 1 ตัว และ id ต้องมาจากรายการเท่านั้น
2. ตัวเลขทุกตัวในประโยคต้องมาจากหลักฐานที่อ้าง ห้ามคำนวณเลขใหม่ ห้ามประมาณเอง ห้ามสร้างสถานที่ ร้าน หรือข้อมูลที่ไม่มีในรายการ
3. แยกให้ชัด: facts ใช้หลักฐานชนิด open/surveyed/score ส่วนสิ่งที่เป็น estimated/assumption ให้อยู่ใน assumptions หรือบอกว่า "ประมาณ"
4. ห้ามพูดถึง % โอกาสรอดหรือรับประกันยอดขาย Loc-Score คือความเอื้อของทำเล ไม่ใช่ความน่าจะเป็น
5. ถ้าทำเลเป็น "จุดตัวอย่าง ยังไม่ได้สำรวจ" ให้บอกในรายงานว่าผลยังใช้ตัดสินใจจริงไม่ได้
6. ฝ่ายหนุนและฝ่ายค้าน ใช้หลักฐานชุดเดียวกัน ฝ่ายค้านต้องหาจุดอ่อนจริง ไม่ใช่เขียนให้ดูสมดุล
7. ถ้าหลักฐานไม่พอจะเลือก ให้ best_site = "none" และบอกว่าขาดอะไร
8. ภาษาไทย กระชับ เขียนแบบรายงาน ไม่ใช่แชต`;

export function advisorTask(evidence: EvidenceRef[], focus: string | null): LlmTask<AdvisorReport> {
  return {
    name: "advisor",
    version: 1,
    system: SYSTEM,
    prompt:
      `รายการหลักฐาน (id | หัวข้อ | ค่า หน่วย | ชนิด | แหล่ง):\n${evidenceLines(evidence)}\n\n` +
      (focus ? `ผู้ใช้สนใจทำเล ${focus} เป็นพิเศษ แต่ให้เทียบกับทำเลอื่นด้วย\n` : "") +
      "เขียนรายงานตาม schema",
    schema: AdvisorSchema,
    temperature: 0.2,
    input: { evidence_count: evidence.length, sites: [...new Set(evidence.map((e) => e.site).filter(Boolean))] },
  };
}

/** Every cited statement in a report, for the grounding check. */
export function statementsOf(r: AdvisorReport) {
  return [
    r.verdict.headline,
    ...r.verdict.conditions,
    ...r.verdict.change_mind_if,
    ...r.facts,
    ...r.assumptions,
    ...r.recommendations,
    ...r.debate.pro,
    ...r.debate.con,
  ];
}
