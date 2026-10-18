"use client";

import Link from "next/link";
import { lastReport } from "@/lib/advisor/store";

/** Grounding rate of the latest Advisor report in this browser (SPEC §9.4, target > 95%). */
export function GroundingCard() {
  const { saved } = lastReport.use();
  if (!saved) {
    return (
      <p className="text-sm text-ink-2">
        ยังไม่มีรายงานในเบราว์เซอร์นี้ ·{" "}
        <Link href="/advisor" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
          ให้ AI สรุปก่อน
        </Link>
      </p>
    );
  }
  const g = saved.grounding;
  const failed = g.checks.flatMap((c) => (c.ok ? [] : c.problems));
  return (
    <div>
      <p className="font-display text-score font-semibold tabular-nums">{Math.round(g.rate * 100)}%</p>
      <p className="mt-1 text-sm text-ink-2">
        อ้างอิงถูกต้อง {g.ok}/{g.total} ประโยค · เป้าหมาย &gt; 95% · {saved.meta.model} ·{" "}
        {saved.meta.createdAt.slice(0, 10)}
      </p>
      {failed.length > 0 && <p className="mt-2 text-xs text-comp">ไม่ผ่าน: {failed.slice(0, 3).join(" · ")}</p>}
    </div>
  );
}
