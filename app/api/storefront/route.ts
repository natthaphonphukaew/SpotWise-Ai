import { createHash } from "node:crypto";
import { z } from "zod";
import { LlmCacheMiss, LlmOutputError, runTask } from "@/lib/llm";
import { storefrontTask } from "@/lib/llm/tasks/storefront";

// ~1.5 MB of base64: the client downsizes photos to 1024 px JPEG before sending.
const Body = z.object({
  site: z.string().max(8),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(100).max(2_000_000),
});

/** POST { site, mimeType, data(base64) } → storefront checklist from the vision model (cached by image hash). */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "รูปไม่ถูกต้องหรือใหญ่เกินไป" }, { status: 400 });
  const sha = createHash("sha256").update(body.data.data).digest("hex").slice(0, 32);
  try {
    const { data, meta } = await runTask(storefrontTask({ mimeType: body.data.mimeType, data: body.data.data, sha }, body.data.site));
    return Response.json({ result: data, meta });
  } catch (e) {
    if (e instanceof LlmCacheMiss) {
      return Response.json({ error: "โหมดเดโม: ยังไม่ได้ต่อ Gemini จึงวิเคราะห์รูปใหม่ไม่ได้" }, { status: 409 });
    }
    if (e instanceof LlmOutputError) return Response.json({ error: "AI ตอบกลับในรูปแบบที่ใช้ไม่ได้ ลองอีกครั้ง" }, { status: 502 });
    console.error("storefront route failed", e);
    return Response.json({ error: "เรียก AI ไม่สำเร็จ (อาจเกินโควตาฟรีวันนี้) ลองใหม่ภายหลัง" }, { status: 503 });
  }
}
