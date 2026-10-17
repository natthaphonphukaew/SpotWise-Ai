# ต่อ Gemini API (ฟรี)

## 1. ขอ API key

1. เข้า **Google AI Studio** → <https://aistudio.google.com/apikey> แล้วล็อกอินด้วยบัญชี Google
2. กด **Create API key** ระบบจะสร้าง Google Cloud project ให้ (ไม่ต้องผูกบัตร ใช้ free tier ได้เลย)
3. คัดลอก key (ขึ้นต้นด้วย `AIza…`) และ **ห้ามแชร์หรือ commit ลง git**

## 2. ใส่ key ในโปรเจกต์

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอก key:

```bash
cp .env.example .env.local
```

```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-3.8-flash
```

จากนั้นรีสตาร์ต `npm run dev` (Next อ่าน `.env.local` ตอนเริ่มเท่านั้น) ไฟล์ `.env.local` ถูก `.gitignore` ไว้แล้ว

## 3. ทดสอบ

เปิดหน้าแรก พิมพ์คอนเซ็ปต์ร้าน แล้วกด **ให้ AI ตีความ**

- สำเร็จ: การ์ดโปรไฟล์ขึ้น หัวการ์ดเขียน `GEMINI-3.8-FLASH · เรียกใหม่` และมีไฟล์ใหม่ใน `llm-cache/business-profile/`
- กดซ้ำด้วยข้อความเดิม: หัวการ์ดเปลี่ยนเป็น `จาก CACHE` (ไม่เสียโควตา)

## 4. ก่อนเดโม / deploy

- **commit โฟลเดอร์ `llm-cache/`** ทุกข้อความที่จะใช้ตอนเดโมต้องเคยรันตอนมี key อย่างน้อยหนึ่งครั้ง
- บน Vercel จะใส่ `GEMINI_API_KEY` ใน Environment Variables หรือไม่ใส่ก็ได้ ถ้าไม่ใส่ เว็บจะอยู่ในโหมดเดโม ตอบได้เฉพาะข้อความที่มีใน cache และจะเสนอข้อความเหล่านั้นให้กดแทน
- บังคับโหมดเดโมได้ด้วย `LLM_MODE=cache` (เหมาะตอนขึ้นเวที กันโควตาหมด)

## ข้อควรรู้

- **โควตาฟรีไม่แน่นอน:** Google ปรับบ่อย ดูของจริงได้ที่ AI Studio → Usage / Rate limits ถ้าเกินโควตา หน้าเว็บจะแจ้ง "เรียก AI ไม่สำเร็จ (อาจเกินโควตาฟรี)"
- **ข้อมูลใน free tier อาจถูกใช้ปรับปรุงโมเดลของ Google** จึงห้ามส่งข้อมูลส่วนบุคคล (CLAUDE.md กฎข้อ 6) ระบบส่งเฉพาะข้อความคอนเซ็ปต์ร้าน
- ถ้า `gemini-3.8-flash` ใช้ไม่ได้ ให้ลอง `GEMINI_MODEL=gemini-3.5-flash-lite` หรือดูรายชื่อโมเดลปัจจุบันที่ <https://ai.google.dev/gemini-api/docs/models>
- โค้ดทั้งหมดเรียกผ่าน `lib/llm/` ที่เดียว: cache → Gemini → ตรวจด้วย zod (ผิดรูปแบบลองใหม่ 1 ครั้ง) → เขียน cache
