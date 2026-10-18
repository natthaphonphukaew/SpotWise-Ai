"use client";

import Link from "next/link";
import { useState } from "react";
import { Counter } from "@/components/field/Counter";
import { PhotoCheck } from "@/components/field/PhotoCheck";
import { saveCompareInputs, useCompareInputs } from "@/lib/compare/store";
import { useSiteScores } from "@/lib/compare/use-site-scores";
import type { Candidate } from "@/lib/data/bangmod";
import { getFieldData, saveFieldData, useFieldData } from "@/lib/field/store";
import { SLOT_LABEL } from "@/lib/field/types";
import { useSites } from "@/lib/sites/store";

type Tab = "count" | "photo" | "rent";
const TABS: { key: Tab; label: string }[] = [
  { key: "count", label: "นับคน" },
  { key: "photo", label: "ถ่ายหน้าร้าน" },
  { key: "rent", label: "ค่าเช่า/โน้ต" },
];

/** Field Mode (SPEC §5 W2): collect real data on site; Loc-Score confidence rises as it comes in. */
export function FieldView({ candidates: base }: { candidates: Candidate[] }) {
  const { sites: candidates } = useSites(base);
  const [picked, setSite] = useState<string | null>(null);
  const site = picked && candidates.some((c) => c.id === picked) ? picked : (candidates[1]?.id ?? candidates[0].id);
  const [tab, setTab] = useState<Tab>("count");
  const { scores, field } = useSiteScores(candidates);
  const fd = useFieldData();
  const compare = useCompareInputs();
  const sessions = fd.sessions.filter((s) => s.site === site).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const sum = field[site];
  const score = scores?.[site];
  const access = score?.dims.find((d) => d.key === "access");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-ink px-4 py-2.5 font-mono text-[11px]">
        <Link href="/compare" className="font-display text-base font-bold">
          SpotWise
        </Link>
        <span>FIELD · ทำเล {site}</span>
      </header>

      <div className="flex gap-1.5 border-b border-rule px-3 py-2" role="radiogroup" aria-label="เลือกทำเล">
        {candidates.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={c.id === site}
            onClick={() => setSite(c.id)}
            className={`flex-1 rounded-xs border py-1.5 text-sm ${c.id === site ? "border-ink bg-ink text-paper" : "border-rule"}`}
          >
            {c.id}
          </button>
        ))}
      </div>

      {/* What the field data does to the score — the demo moment */}
      <div className="grid grid-cols-3 border-b border-rule text-center">
        <Stat k="LOC-SCORE" v={score?.total ?? "—"} />
        <Stat k="CONFIDENCE" v={score ? `${score.confidence}%` : "—"} accent={access?.certainty === "surveyed"} />
        <Stat k="คน/นาที" v={sum?.footfallPerMin != null ? sum.footfallPerMin.toFixed(1) : "—"} />
      </div>

      <nav className="grid grid-cols-3 border-b border-ink" aria-label="เครื่องมือ">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key}
            className={`py-2.5 text-sm ${tab === t.key ? "bg-paper-2 font-medium" : "text-ink-2"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1">
        {tab === "count" && (
          <>
            <Counter key={site} site={site} />
            {sessions.length > 0 && (
              <section className="px-4 pb-6">
                <h2 className="label mt-2 mb-1">ที่นับแล้ว · ทำเล {site}</h2>
                <ul className="divide-y divide-rule border-y border-rule text-sm">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {SLOT_LABEL[s.slot]}{" "}
                        <span className="font-mono text-xs text-ink-3">
                          {new Date(s.startedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {s.count} คน · {(s.count / (s.seconds / 60)).toFixed(1)}/นาที
                      </span>
                      <button
                        onClick={() => {
                          const cur = getFieldData();
                          saveFieldData({ ...cur, sessions: cur.sessions.filter((x) => x.id !== s.id) });
                        }}
                        className="text-xs text-ink-3 underline"
                        aria-label="ลบรายการนี้"
                      >
                        ลบ
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-3">
                  นับให้ครบ 3 ช่วง (เช้า เที่ยง เย็น) และรวมอย่างน้อย 30 นาที Confidence ของมิติการเข้าถึงจึงขึ้นเต็ม
                </p>
              </section>
            )}
          </>
        )}
        {tab === "photo" && <PhotoCheck key={site} site={site} />}
        {tab === "rent" && (
          <div className="space-y-4 px-4 py-4">
            <label className="block text-sm">
              <span>ค่าเช่าต่อเดือน (บาท)</span>
              <input
                key={`rent-${site}`}
                inputMode="numeric"
                defaultValue={compare.rents[site] ?? ""}
                onBlur={(e) => {
                  const t = e.target.value.replace(/,/g, "").trim();
                  const v = t === "" ? null : Number(t);
                  saveCompareInputs({
                    ...compare,
                    rents: { ...compare.rents, [site]: v != null && Number.isFinite(v) ? v : null },
                  });
                }}
                className="mt-1 block w-full rounded-xs border border-ink bg-sheet px-3 py-2.5 text-right font-mono text-lg tabular-nums"
              />
              <span className="mt-1 block text-xs text-ink-3">ใช้ค่าเดียวกับหน้าเปรียบเทียบและจำลองการเงิน</span>
            </label>
            <label className="block text-sm">
              <span>โน้ตหน้างาน</span>
              <textarea
                key={`note-${site}`}
                rows={5}
                defaultValue={fd.notes[site] ?? ""}
                onBlur={(e) => {
                  const cur = getFieldData();
                  saveFieldData({ ...cur, notes: { ...cur.notes, [site]: e.target.value } });
                }}
                placeholder="มัดจำ สัญญากี่ปี ค่าส่วนกลาง เจ้าของบอกอะไร ร้านข้างๆ ขายดีไหม"
                className="mt-1 block w-full rounded-xs border border-rule bg-sheet px-3 py-2 text-[15px]"
              />
            </label>
          </div>
        )}
      </main>

      <footer className="border-t border-rule px-4 py-2 text-[11px] text-ink-3">
        ข้อมูลหน้างานเก็บในเครื่องนี้เท่านั้น · รูปส่งให้ AI วิเคราะห์ครั้งเดียว ไม่ได้เก็บรูปไว้
      </footer>
    </div>
  );
}

function Stat({ k, v, accent = false }: { k: string; v: string | number; accent?: boolean }) {
  return (
    <div className="border-r border-rule px-2 py-2 last:border-r-0">
      <div className="font-mono text-[10px] text-ink-3">{k}</div>
      <div className={`font-mono text-xl font-medium tabular-nums ${accent ? "text-accent" : ""}`}>{v}</div>
    </div>
  );
}
