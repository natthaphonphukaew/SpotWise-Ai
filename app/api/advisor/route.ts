import { z } from "zod";
import { groundingRate } from "@/lib/advisor/grounding";
import { LlmCacheMiss, LlmOutputError, runTask } from "@/lib/llm";
import { advisorTask, statementsOf } from "@/lib/llm/tasks/advisor";

const Evidence = z.object({
  id: z.string().max(8),
  site: z.string().max(8).nullable(),
  label: z.string().max(200),
  value: z.union([z.number(), z.string().max(120), z.null()]),
  unit: z.string().max(60),
  kind: z.string().max(20),
  source: z.string().max(300),
});
const Body = z.object({ evidence: z.array(Evidence).min(3).max(200), focus: z.string().max(8).nullable() });

/** POST { evidence, focus } → grounded report + server-side grounding check. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "ข้อมูลหลักฐานไม่ถูกต้อง" }, { status: 400 });
  const evidence = body.data.evidence as Parameters<typeof advisorTask>[0];
  try {
    const { data, meta } = await runTask(advisorTask(evidence, body.data.focus));
    const grounding = groundingRate(statementsOf(data), evidence);
    return Response.json({ report: data, meta, grounding });
  } catch (e) {
    if (e instanceof LlmCacheMiss) {
      return Response.json(
        { error: "โหมดเดโม: ยังไม่มีรายงานที่บันทึกไว้สำหรับข้อมูลชุดนี้ (ตัวเลขเปลี่ยนแล้วต้องให้ AI เขียนใหม่)" },
        { status: 409 },
      );
    }
    if (e instanceof LlmOutputError)
      return Response.json({ error: "AI ตอบกลับในรูปแบบที่ใช้ไม่ได้ ลองอีกครั้ง" }, { status: 502 });
    console.error("advisor route failed", e);
    return Response.json({ error: "เรียก AI ไม่สำเร็จ (อาจเกินโควตาฟรีวันนี้) ลองใหม่ภายหลัง" }, { status: 503 });
  }
}
