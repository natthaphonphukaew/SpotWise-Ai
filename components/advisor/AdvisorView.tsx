"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Readout, TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { buildEvidence, type EvidenceRef } from "@/lib/advisor/evidence";
import type { Statement } from "@/lib/advisor/grounding";
import { financeInputs, nextMonth } from "@/lib/compare/finance-inputs";
import { useSimulateInputs } from "@/lib/compare/store";
import { useSiteScores } from "@/lib/compare/use-site-scores";
import { DATA_BASE, type Candidate } from "@/lib/data/bangmod";
import { lastReport } from "@/lib/advisor/store";
import { summarize, type AcademicCalendar, type Summary } from "@/lib/scoring/finance";
import { useSites } from "@/lib/sites/store";

/** Cheap stable signature of the evidence, so a saved report is only shown for the same numbers. */
function signature(ev: EvidenceRef[]) {
  const s = JSON.stringify(ev);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const KIND: Record<string, string> = {
  surveyed: "ข้อมูลจริง",
  open: "ข้อมูลเปิด",
  estimated: "ประมาณการ",
  assumption: "สมมติฐาน",
  missing: "ไม่มีข้อมูล",
  score: "คะแนนที่คำนวณ",
  profile: "โปรไฟล์ร้าน",
};

export function AdvisorView({ candidates: base }: { candidates: Candidate[] }) {
  const { sites: candidates } = useSites(base);
  const { scores, profile, assumptions, inputs } = useSiteScores(candidates);
  const sim = useSimulateInputs();
  const { saved } = lastReport.use();
  const [cal, setCal] = useState<AcademicCalendar | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${DATA_BASE}/academic_calendar.json`)
      .then((r) => r.json())
      .then(setCal, () => setCal(null));
  }, []);

  const evidence = useMemo(() => {
    if (!scores || !cal) return null;
    const start = nextMonth();
    const finance: Record<string, Summary> = {};
    for (const c of candidates) {
      const rent = inputs.rents[c.id] ?? c.rent_thb ?? null;
      finance[c.id] = summarize(financeInputs(scores[c.id], sim, assumptions.avgTicketThb, rent, profile, start), cal);
    }
    return buildEvidence(candidates, scores, finance, profile, cal.source);
  }, [scores, cal, candidates, inputs.rents, sim, assumptions.avgTicketThb, profile]);

  const sig = evidence ? signature(evidence) : null;
  const current = saved && saved.sig === sig ? saved : null;
  const byId = useMemo(() => new Map((evidence ?? []).map((e) => [e.id, e])), [evidence]);

  async function generate() {
    if (!evidence || !sig) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence, focus: null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "เขียนรายงานไม่สำเร็จ");
        return;
      }
      lastReport.save({ saved: { sig, report: json.report, meta: json.meta, grounding: json.grounding } });
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  // Grounding result per statement, in the order statementsOf() produced them on the server.
  const checks = current?.grounding.checks ?? [];
  let k = 0;
  const line = (st: Statement, block: boolean) => (
    <Line key={k} st={st} check={checks[k++]} onCite={setOpen} block={block} />
  );
  const S = (st: Statement) => line(st, false);

  const r = current?.report;
  const best = r?.verdict.best_site && r.verdict.best_site !== "none" ? r.verdict.best_site : null;

  return (
    <>
      <TopBar right={<Readout k="EVIDENCE" v={evidence?.length ?? "—"} />} />
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-10 sm:px-8">
        <div className="label">รายงานที่ปรึกษา · No.001 · บางมด</div>
        <h1 className="mt-2 font-display text-4xl leading-tight font-semibold">สรุปทำเลจากหลักฐาน</h1>
        <p className="mt-3 max-w-[70ch] text-ink-2">
          AI เขียนรายงานจากรายการหลักฐานที่ระบบคำนวณไว้เท่านั้น ทุกประโยคต้องอ้างหลักฐาน
          และระบบตรวจซ้ำว่าตัวเลขตรงกับที่อ้างจริง ·{" "}
          <Link href="/compare" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
            ดูคะแนน
          </Link>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={!evidence || busy} aria-busy={busy}>
            {busy ? "AI กำลังเขียน…" : current ? "เขียนใหม่จากข้อมูลล่าสุด" : "ให้ AI สรุป"}
          </Button>
          {saved && !current && evidence && (
            <span className="text-sm text-ink-3">ตัวเลขเปลี่ยนไปจากรายงานล่าสุด ต้องให้ AI เขียนใหม่</span>
          )}
          {error && <span className="text-sm text-comp">{error}</span>}
        </div>

        {r && current && (
          <>
            <div className="mt-6 flex flex-wrap justify-between gap-2 border-y border-ink py-2 font-mono text-[11px] text-ink-2">
              <span>
                อ้างอิงถูกต้อง{" "}
                <b className={current.grounding.rate >= 0.95 ? "text-ink" : "text-comp"}>
                  {current.grounding.ok}/{current.grounding.total} ประโยค ({Math.round(current.grounding.rate * 100)}%)
                </b>
              </span>
              <span>
                {current.meta.model.toUpperCase()} · {current.meta.cached ? "จาก CACHE" : "เขียนใหม่"} ·{" "}
                {current.meta.createdAt.slice(0, 10)}
              </span>
            </div>

            <section className="mt-6 rounded-sm border border-rule bg-paper-2 p-5">
              <div className="label">คำตัดสิน</div>
              <h2 className="mt-1 font-display text-[32px] leading-snug font-semibold">
                {best ? `แนะนำทำเล ${best}` : "ข้อมูลยังไม่พอจะเลือก"}
              </h2>
              <div className="mt-2 text-[17px]">{line(r.verdict.headline, true)}</div>
              {r.verdict.conditions.length > 0 && (
                <>
                  <h3 className="label mt-4 mb-1">เปิดได้ ถ้า</h3>
                  <ul className="list-disc space-y-1 pl-5">{r.verdict.conditions.map(S)}</ul>
                </>
              )}
              {r.verdict.change_mind_if.length > 0 && (
                <>
                  <h3 className="label mt-4 mb-1">จะเปลี่ยนคำแนะนำ ถ้า</h3>
                  <ul className="list-disc space-y-1 pl-5 text-ink-2">{r.verdict.change_mind_if.map(S)}</ul>
                </>
              )}
            </section>

            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <section>
                <h3 className="label mb-2">ข้อเท็จจริง</h3>
                <ul className="list-disc space-y-1.5 pl-5">{r.facts.map(S)}</ul>
              </section>
              <section>
                <h3 className="label mb-2">สมมติฐานที่ผลลัพธ์พึ่งพา</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-ink-2">{r.assumptions.map(S)}</ul>
              </section>
            </div>

            <section className="mt-8">
              <h3 className="label mb-2">ข้อเสนอแนะ</h3>
              <ul className="list-disc space-y-1.5 pl-5">{r.recommendations.map(S)}</ul>
            </section>

            <section className="mt-8 grid rounded-sm border border-ink md:grid-cols-2">
              <div className="p-4">
                <div className="label">ฝ่ายหนุน</div>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px]">{r.debate.pro.map(S)}</ol>
              </div>
              <div className="border-t border-ink p-4 md:border-t-0 md:border-l">
                <div className="label">ฝ่ายค้าน</div>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px]">{r.debate.con.map(S)}</ol>
              </div>
            </section>

            <section className="mt-8 border-t border-ink pt-3">
              <h3 className="label mb-2">ต้องไปตรวจเองก่อนเซ็นสัญญา</h3>
              <ul className="space-y-1.5">
                {r.checklist.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="mt-1.5 inline-block h-3 w-3 shrink-0 border border-ink" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {open && byId.get(open) && <EvidenceDrawer e={byId.get(open)!} onClose={() => setOpen(null)} />}

        {evidence && (
          <details className="mt-10 border-t border-rule pt-3">
            <summary className="label cursor-pointer">หลักฐานทั้งหมดที่ส่งให้ AI ({evidence.length} รายการ)</summary>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id} className="border-b border-rule align-top">
                    <td className="py-1 pr-2 font-mono text-xs text-ink-3">{e.id}</td>
                    <td className="py-1 pr-2">{e.label}</td>
                    <td className="py-1 pr-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {e.value ?? "—"} {e.unit}
                    </td>
                    <td className="py-1 text-xs text-ink-3">{KIND[e.kind] ?? e.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </main>
    </>
  );
}

function Line({
  st,
  check,
  onCite,
  block,
}: {
  st: Statement;
  check?: { ok: boolean; problems: string[] };
  onCite: (id: string) => void;
  /** render as a paragraph instead of a list item */
  block: boolean;
}) {
  const Tag = block ? "p" : "li";
  return (
    <Tag>
      <span className={check && !check.ok ? "decoration-comp underline decoration-wavy underline-offset-4" : ""}>
        {st.text}
      </span>
      {st.cites.map((id) => (
        <button
          key={id}
          onClick={() => onCite(id)}
          className="ml-0.5 align-super font-mono text-[10px] text-ink-2 underline decoration-rule underline-offset-2 hover:text-accent"
        >
          [{id}]
        </button>
      ))}
      {check && !check.ok && <span className="block text-xs text-comp">ตรวจไม่ผ่าน: {check.problems.join(" · ")}</span>}
    </Tag>
  );
}

function EvidenceDrawer({ e, onClose }: { e: EvidenceRef; onClose: () => void }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-sheet px-4 py-3 shadow-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:rounded-sm sm:border"
      role="dialog"
      aria-label={`หลักฐาน ${e.id}`}
    >
      <div className="flex justify-between">
        <span className="label">
          Evidence [{e.id}]{e.site ? ` · ทำเล ${e.site}` : ""}
        </span>
        <button onClick={onClose} className="font-mono text-[11px] text-ink-3 hover:text-ink">
          ปิด
        </button>
      </div>
      <p className="mt-1 text-[15px]">{e.label}</p>
      <p className="font-mono text-lg tabular-nums">
        {e.value ?? "—"} <span className="text-sm text-ink-2">{e.unit}</span>
      </p>
      <p className="mt-1 text-xs text-ink-3">
        {KIND[e.kind] ?? e.kind} · {e.source}
      </p>
    </div>
  );
}
