import { StorefrontSchema, type Storefront } from "@/lib/field/types";
import type { LlmTask } from "../types";

const SYSTEM = `คุณช่วยผู้ประกอบการรายย่อยประเมินหน้าร้านที่กำลังจะเช่า จากรูปถ่ายที่ผู้ใช้ถ่ายเองหน้างาน
ตอบเฉพาะสิ่งที่เห็นในภาพจริง:
1. ถ้าดูจากภาพไม่ได้ ให้ตอบ "unclear" และใส่ไว้ใน cannot_judge ห้ามเดา
2. ห้ามประเมินยอดขาย ราคาค่าเช่า จำนวนลูกค้า หรือสิ่งที่อยู่นอกภาพ
3. ห้ามบรรยายลักษณะบุคคลในภาพ (ถ้ามีคน ให้ข้ามไป)
4. visibility 1–5: 1 = แทบมองไม่เห็นจากถนน/ทางเดิน, 5 = เห็นชัดจากระยะไกลและไม่มีอะไรบัง
5. ข้อความทั้งหมดเป็นภาษาไทย สั้น ใช้งานได้จริง`;

/** Vision check of one storefront photo (SPEC §2 #4). `sha` = hash of the image bytes. */
export function storefrontTask(image: { mimeType: string; data: string; sha: string }, site: string): LlmTask<Storefront> {
  return {
    name: "storefront",
    version: 1,
    system: SYSTEM,
    prompt: `ประเมินหน้าร้านในรูปนี้ (รูป sha256:${image.sha}) สำหรับเปิดร้านเครื่องดื่ม/อาหารขนาดเล็ก`,
    schema: StorefrontSchema,
    temperature: 0,
    images: [{ mimeType: image.mimeType, data: image.data }],
    input: { site, sha: image.sha }, // the photo itself is not stored in the cache
  };
}
