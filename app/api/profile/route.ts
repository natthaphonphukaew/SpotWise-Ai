import { z } from "zod";
import { listCachedInputs } from "@/lib/llm/cache";
import { LlmCacheMiss, LlmOutputError, llmConfig, runTask } from "@/lib/llm";
import { businessProfileTask, MAX_CONCEPT_CHARS } from "@/lib/llm/tasks/business-profile";

const Body = z.object({ concept: z.string().trim().min(5).max(MAX_CONCEPT_CHARS) });

/** POST { concept } → AI business profile (cached; demo mode answers from llm-cache/ only). */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: `กรอกคอนเซ็ปต์ร้าน 5–${MAX_CONCEPT_CHARS} ตัวอักษร` }, { status: 400 });
  }
  try {
    const { data, meta } = await runTask(businessProfileTask(body.data.concept));
    return Response.json({ profile: data, meta });
  } catch (e) {
    if (e instanceof LlmCacheMiss) {
      const examples = (await listCachedInputs("business-profile"))
        .map((i) => (i as { concept?: string }).concept)
        .filter(Boolean);
      return Response.json(
        { error: "โหมดเดโม: ยังไม่มีผลวิเคราะห์ที่บันทึกไว้สำหรับข้อความนี้", examples, mode: llmConfig().mode },
        { status: 409 },
      );
    }
    if (e instanceof LlmOutputError) {
      return Response.json({ error: "AI ตอบกลับในรูปแบบที่ใช้ไม่ได้ ลองอีกครั้ง" }, { status: 502 });
    }
    console.error("profile route failed", e);
    return Response.json({ error: "เรียก AI ไม่สำเร็จ (อาจเกินโควตาฟรี) ลองใหม่ภายหลัง" }, { status: 503 });
  }
}
