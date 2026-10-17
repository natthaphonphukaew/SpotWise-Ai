import { GROUPS } from "@/lib/data/bangmod";
import { BusinessProfileSchema, cleanProfile, PROFILE_GROUPS, type BusinessProfile } from "@/lib/profile/schema";
import type { LlmTask } from "../types";

export const MAX_CONCEPT_CHARS = 400;

const groupList = PROFILE_GROUPS.map((g) => `- ${g}: ${GROUPS[g].label}`).join("\n");

const SYSTEM = `คุณคือที่ปรึกษาเลือกทำเลร้านค้าสำหรับผู้ประกอบการรายย่อยในไทย
งานของคุณ: อ่านคอนเซ็ปต์ร้านที่ผู้ใช้พิมพ์ แล้วแปลงเป็นโปรไฟล์ธุรกิจแบบมีโครงสร้าง เพื่อให้ระบบนำไปวิเคราะห์กับข้อมูลแผนที่จริง

กฎ:
1. ตีความเฉพาะคอนเซ็ปต์ร้าน ห้ามกล่าวถึงหรือแต่งข้อมูลเกี่ยวกับทำเล ร้านคู่แข่ง หรือตัวเลขของพื้นที่จริง
2. ตัวเลขที่ผู้ใช้บอกมา ให้ใช้ตามนั้นและตั้ง source เป็น "user" ตัวเลขที่คุณเดาเอง ให้ตั้ง source เป็น "assumed" และใส่เหตุผลใน assumptions
3. ถ้าผู้ใช้ไม่ได้บอกราคาหรืองบ ให้เป็น null ห้ามเดา
4. กลุ่มสถานที่ต้องเลือกจากรายการนี้เท่านั้น (ใช้ id ภาษาอังกฤษ):
${groupList}
5. กลุ่มหนึ่งอยู่ได้บทบาทเดียว (คู่แข่งตรง / คู่แข่งอ้อม / เกื้อหนุน)
6. น้ำหนัก 5 มิติรวมกัน 100 และสะท้อนว่าธุรกิจนี้พึ่งอะไรมากที่สุด
7. to_verify คือสิ่งที่ผู้ใช้ควรไปเช็กหน้างานเอง เขียนเป็นภาษาไทย สั้น ทำได้จริง
8. ข้อความทั้งหมดเป็นภาษาไทย`;

export function businessProfileTask(concept: string): LlmTask<BusinessProfile> {
  const text = concept.trim().slice(0, MAX_CONCEPT_CHARS);
  return {
    name: "business-profile",
    version: 1,
    system: SYSTEM,
    prompt: `คอนเซ็ปต์ร้าน:\n"""${text}"""\n\nย่านที่จะวิเคราะห์: รอบมหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี (มจธ.) บางมด กรุงเทพฯ`,
    schema: BusinessProfileSchema,
    temperature: 0.2,
    input: { concept: text },
    postprocess: cleanProfile,
  };
}
