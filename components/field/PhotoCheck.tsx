"use client";

import { useState } from "react";
import { getFieldData, saveFieldData, useFieldData } from "@/lib/field/store";
import type { Storefront } from "@/lib/field/types";

const LABEL: Record<string, Record<string, string>> = {
  frontage: { narrow: "แคบ", medium: "ปานกลาง", wide: "กว้าง", unclear: "ดูไม่ออก" },
  motorbike_parking: { yes: "มี", no: "ไม่มี", unclear: "ดูไม่ออก" },
  sidewalk: { good: "ดี", narrow: "แคบ", none: "ไม่มี", unclear: "ดูไม่ออก" },
  shade: { yes: "มี", partial: "บางส่วน", no: "ไม่มี", unclear: "ดูไม่ออก" },
  signage_space: { yes: "มี", limited: "จำกัด", no: "ไม่มี", unclear: "ดูไม่ออก" },
};

/** Downscale to ≤1024 px JPEG in the browser: smaller upload, no EXIF/GPS metadata sent. */
async function shrink(file: File): Promise<{ mimeType: "image/jpeg"; data: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.8);
  return { mimeType: "image/jpeg", data: preview.split(",")[1], preview };
}

export function PhotoCheck({ site }: { site: string }) {
  const fd = useFieldData();
  const saved = fd.storefront[site];
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const img = await shrink(file);
      setPreview(img.preview);
      const res = await fetch("/api/storefront", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site, mimeType: img.mimeType, data: img.data }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "วิเคราะห์ไม่สำเร็จ");
        return;
      }
      const cur = getFieldData();
      saveFieldData({
        ...cur,
        storefront: {
          ...cur.storefront,
          [site]: { result: json.result as Storefront, at: new Date().toISOString(), model: json.meta.model },
        },
      });
    } catch {
      setError("อ่านรูปไม่ได้ ลองถ่ายใหม่");
    } finally {
      setBusy(false);
    }
  }

  const r = saved?.result;
  return (
    <div className="space-y-4 px-4 py-4">
      <p className="text-sm text-ink-2">
        ถ่ายหน้าร้านจากฝั่งตรงข้ามหรือทางเดิน ให้เห็นทั้งหน้าร้านและทางเข้า{" "}
        <b className="font-medium text-ink">พยายามไม่ให้มีคนอยู่ในภาพ</b> ระบบย่อรูปและตัดข้อมูลตำแหน่ง GPS
        ในรูปก่อนส่งให้ AI
      </p>
      <label
        className={`block rounded-md border-2 border-dashed px-4 py-6 text-center ${busy ? "border-rule text-ink-3" : "border-ink"}`}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <span className="text-[15px] font-medium">
          {busy ? "AI กำลังดูรูป…" : saved ? "ถ่ายรูปใหม่" : "ถ่ายรูปหน้าร้าน"}
        </span>
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL preview, nothing to optimise */}
      {preview && <img src={preview} alt="รูปหน้าร้านที่ถ่าย" className="w-full rounded-sm border border-rule" />}
      {error && <p className="text-sm text-comp">{error}</p>}

      {r && (
        <section className="rounded-sm border border-ink bg-sheet">
          <div className="flex justify-between border-b border-rule px-3 py-2">
            <span className="label">ผลจาก AI · ดูจากรูปเท่านั้น</span>
            <span className="font-mono text-[11px] text-ink-3">{saved.model.toUpperCase()}</span>
          </div>
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 px-3 py-3 text-sm">
            <dt className="text-ink-2">มองเห็นจากถนน</dt>
            <dd className="font-mono">{r.visibility} / 5</dd>
            <dt className="text-ink-2">หน้าร้าน</dt>
            <dd>{LABEL.frontage[r.frontage]}</dd>
            <dt className="text-ink-2">ที่จอดมอไซค์</dt>
            <dd>{LABEL.motorbike_parking[r.motorbike_parking]}</dd>
            <dt className="text-ink-2">ทางเท้า</dt>
            <dd>{LABEL.sidewalk[r.sidewalk]}</dd>
            <dt className="text-ink-2">ร่มเงา</dt>
            <dd>{LABEL.shade[r.shade]}</dd>
            <dt className="text-ink-2">ที่ติดป้าย</dt>
            <dd>{LABEL.signage_space[r.signage_space]}</dd>
            {r.obstacles.length > 0 && (
              <>
                <dt className="text-ink-2">สิ่งกีดขวาง</dt>
                <dd>{r.obstacles.join(" · ")}</dd>
              </>
            )}
          </dl>
          <p className="border-t border-rule px-3 py-2 text-sm">{r.summary}</p>
          {r.cannot_judge.length > 0 && (
            <p className="border-t border-rule px-3 py-2 text-xs text-ink-3">ต้องดูเอง: {r.cannot_judge.join(" · ")}</p>
          )}
        </section>
      )}
    </div>
  );
}
