import { z } from "zod";
import { GROUPS, type PoiGroup } from "@/lib/data/bangmod";
import type { LlmTask } from "../types";

/**
 * Re-classify places into map groups from their name + raw category.
 * Profile-independent ("what is this place?"); the business profile later maps groups to roles.
 * The model may only label ids it was given and only with known groups (rule 4: no invented places).
 */
export const POI_BATCH_SIZE = 80;

const ALL_GROUPS = Object.keys(GROUPS) as PoiGroup[];

export const PoiLabelSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      group: z.enum(ALL_GROUPS as [PoiGroup, ...PoiGroup[]]),
      confidence: z.enum(["high", "medium", "low"]),
      reason: z.string().describe("เหตุผลสั้นๆ ไม่เกิน 12 คำ ภาษาไทย"),
    }),
  ),
});
export type PoiLabels = z.infer<typeof PoiLabelSchema>;

export type PoiInput = { id: string; name: string; category: string | null; group: PoiGroup };

const DEFINITIONS: Record<PoiGroup, string> = {
  bubble_tea:
    "ร้านเครื่องดื่มที่มีชาเป็นเมนูหลัก: ชานม ชาไข่มุก ชาไทย ชาผลไม้ ชาชีส รวมแบรนด์ที่ขายชาคู่ไอศกรีม/ของหวาน เช่น Mixue, ชาตรามือ, KOI Thé",
  coffee: "ร้านกาแฟ คาเฟ่ ที่ขายกาแฟเป็นหลัก (รวมกาแฟสดในปั๊ม) ไม่รวมอินเทอร์เน็ตคาเฟ่",
  drink_dessert: "น้ำปั่น น้ำผลไม้ ของหวาน เบเกอรี่ ไอศกรีม บิงซู เครป โรตี ขนม",
  food: "ร้านอาหาร ร้านตามสั่ง ก๋วยเตี๋ยว ฟาสต์ฟู้ด ชาบู หมูกระทะ บาร์/ร้านเหล้าที่ขายอาหาร",
  convenience: "ร้านสะดวกซื้อ มินิมาร์ท ซูเปอร์มาร์เก็ต ร้านโชห่วย",
  education: "โรงเรียน มหาวิทยาลัย คณะ/ภาควิชา อาคารเรียน สถาบันกวดวิชา",
  dormitory: "ที่อยู่อาศัย: หอพัก อพาร์ตเมนต์ แมนชั่น คอนโด หมู่บ้าน โรงแรม",
  market: "ตลาด ตลาดนัด ลานค้า",
  office: "บริษัท สำนักงาน หน่วยงานราชการ สมาคม มูลนิธิ",
  health: "โรงพยาบาล คลินิก ร้านขายยา ทันตกรรม สัตวแพทย์",
  leisure: "สวน สนามกีฬา ฟิตเนส ที่เที่ยว สนามเด็กเล่น",
  retail: "ร้านค้าและบริการอื่น: เสื้อผ้า ซ่อมรถ ร้านเสริมสวย ซักผ้า ปริ้นต์ ฯลฯ",
  other: "ไม่เข้ากลุ่มใดหรือข้อมูลไม่พอ",
};

const SYSTEM = `คุณจัดหมวดสถานที่สำหรับแผนที่วิเคราะห์ทำเลร้านค้าในกรุงเทพฯ
ข้อมูลที่มีคือชื่อสถานที่และหมวดดิบจากแหล่งข้อมูลเปิด (มักผิด) กับกลุ่มที่ระบบเดาด้วยกฎ (มักผิด)

กลุ่มที่ใช้ได้ (id: ความหมาย):
${ALL_GROUPS.map((g) => `- ${g}: ${DEFINITIONS[g]}`).join("\n")}

กฎ:
1. ตอบครบทุก id ที่ได้รับ ห้ามเพิ่ม id ใหม่ ห้ามเปลี่ยน id
2. ตัดสินจากชื่อเป็นหลัก หมวดดิบใช้ประกอบ ถ้าชื่อบอกชัด (เช่น "หอพัก", "คอนโด", "ข้าวมันไก่") ให้เชื่อชื่อ
3. ถ้าข้อมูลไม่พอจะตัดสิน ให้คงกลุ่มเดิมและ confidence = "low"
4. ห้ามเดาข้อมูลอื่นนอกเหนือจากที่ให้ (ห้ามอ้างรีวิว ราคา ยอดขาย)
5. reason เป็นภาษาไทยสั้นๆ อธิบายว่าดูจากอะไร`;

export function poiClassifyTask(batch: PoiInput[]): LlmTask<PoiLabels> {
  // Short per-batch ids (p1, p2…) save tokens and stop the model from mangling long Overture ids.
  const short = batch.map((_, i) => `p${i + 1}`);
  const toReal = new Map(short.map((s, i) => [s, batch[i].id]));
  const lines = batch.map((p, i) => `${short[i]} | ${p.name} | ${p.category ?? "-"} | ${p.group}`).join("\n");
  return {
    name: "poi-classify",
    version: 2,
    system: SYSTEM,
    prompt: `จัดกลุ่มสถานที่ต่อไปนี้ (รูปแบบ: id | ชื่อ | หมวดดิบ | กลุ่มที่กฎเดา)\n${lines}`,
    schema: PoiLabelSchema,
    temperature: 0,
    input: { count: batch.length, first: batch[0]?.id },
    // Map back to real ids; drop ids we did not send and duplicates.
    postprocess: (out) => {
      const seen = new Set<string>();
      const items: PoiLabels["items"] = [];
      for (const it of out.items) {
        const id = toReal.get(it.id);
        if (id && !seen.has(id)) {
          seen.add(id);
          items.push({ ...it, id });
        }
      }
      return { items };
    },
  };
}
