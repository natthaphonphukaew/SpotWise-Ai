"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CashflowChart, thMonth } from "@/components/simulate/CashflowChart";
import { Readout, TopBar } from "@/components/TopBar";
import { saveCompareInputs, saveSimulateInputs, useSimulateInputs, type SimulateInputs } from "@/lib/compare/store";
import { useSiteScores } from "@/lib/compare/use-site-scores";
import { DATA_BASE, type Candidate } from "@/lib/data/bangmod";
import {
  addMonths,
  FINANCE_DEFAULTS,
  SCENARIOS,
  simulate,
  summarize,
  type AcademicCalendar,
  type FinanceInputs,
} from "@/lib/scoring/finance";

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const money = (v: number) => (v < 0 ? `(${n(-v)})` : n(v));

/** First month after today, as the default opening month. */
function nextMonth(): string {
  const d = new Date();
  return addMonths(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 1);
}

export function SimulateView({ candidates }: { candidates: Candidate[] }) {
  const { error, scores, profile, assumptions, inputs: compareInputs } = useSiteScores(candidates);
  const sim = useSimulateInputs();
  const [cal, setCal] = useState<AcademicCalendar | null>(null);

  useEffect(() => {
    fetch(`${DATA_BASE}/academic_calendar.json`)
      .then((r) => r.json())
      .then(setCal, () => setCal(null));
  }, []);

  const site = sim.site ?? candidates[1]?.id ?? candidates[0].id;
  const cand = candidates.find((c) => c.id === site)!;
  const score = scores?.[site];
  const rent = compareInputs.rents[site] ?? cand.rent_thb ?? null;
  const set = (patch: Partial<SimulateInputs>) => saveSimulateInputs({ ...sim, ...patch });

  const fin: FinanceInputs | null = useMemo(() => {
    if (!score) return null;
    return {
      customersPerDay: sim.customersPerDay ?? score.customers.mid,
      avgTicketThb: assumptions.avgTicketThb,
      cogsShare: sim.cogsShare ?? FINANCE_DEFAULTS.cogsShare,
      rentThb: rent ?? 0,
      staffThb: sim.staffThb ?? FINANCE_DEFAULTS.staffThb,
      otherFixedThb: sim.otherFixedThb ?? FINANCE_DEFAULTS.otherFixedThb,
      setupThb: sim.setupThb ?? profile?.budget_thb ?? FINANCE_DEFAULTS.setupThb,
      openDaysPerMonth: FINANCE_DEFAULTS.openDaysPerMonth,
      breakFactor: sim.breakFactor ?? FINANCE_DEFAULTS.breakFactor,
      specialFactor: sim.specialFactor ?? FINANCE_DEFAULTS.specialFactor,
      startMonth: sim.startMonth ?? nextMonth(),
    };
  }, [score, sim, assumptions.avgTicketThb, rent, profile]);

  const base = useMemo(() => (fin && cal ? simulate(fin, cal) : null), [fin, cal]);
  const scenarios = useMemo(
    () =>
      fin && cal
        ? SCENARIOS.map((s) => ({
            ...s,
            sum: summarize({ ...fin, customersPerDay: fin.customersPerDay * s.mult }, cal),
          }))
        : null,
    [fin, cal],
  );
  const baseSum = scenarios?.find((s) => s.key === "base")?.sum;

  return (
    <>
      <TopBar right={<Readout k="SITE" v={site} />} />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-10 sm:px-8">
        <div className="label">จำลองการเงิน · No.001 · บางมด</div>
        <h1 className="mt-2 font-display text-4xl leading-tight font-semibold">เงินพอถึงหลังปิดเทอมไหม</h1>
        <p className="mt-3 max-w-[72ch] text-ink-2">
          ร้านรอบมหาวิทยาลัยขายดีช่วงเปิดเทอม แต่ลูกค้าหายไปมากช่วงปิดภาค
          หน้านี้คำนวณเงินสดรายเดือนตามปฏิทินการศึกษาจริงของ มจธ. เพื่อดูว่าต้องมีเงินสำรองเท่าไร ·{" "}
          <Link href="/compare" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
            กลับไปหน้าเปรียบเทียบ
          </Link>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="เลือกทำเล">
          {candidates.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={c.id === site}
              onClick={() => set({ site: c.id, customersPerDay: null })}
              className={`rounded-xs border px-3 py-1.5 text-sm ${c.id === site ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink"}`}
            >
              ทำเล {c.id}
              {scores && <span className="ml-2 font-mono text-[11px] opacity-70">{scores[c.id].total ?? "—"}</span>}
            </button>
          ))}
          <span className="ml-1 text-sm text-ink-3">{cand.label}</span>
        </div>

        {error && <p className="mt-8 text-comp">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
        {(!base || !scenarios || !fin) && !error && <p className="mt-8 font-mono text-xs text-ink-3">กำลังคำนวณ…</p>}

        {base && scenarios && fin && baseSum && cal && (
          <>
            {rent == null && (
              <p className="mt-6 border-l-2 border-accent pl-3 text-sm">
                ยังไม่มีค่าเช่าของทำเล {site} ตัวเลขด้านล่างจึงยังไม่รวมค่าเช่า ใส่ค่าเช่าในช่องด้านขวาได้เลย
              </p>
            )}

            <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-ink pt-3">
                  <h2 className="label">กระแสเงินสดสุทธิรายเดือน · สถานการณ์กลาง · บาท · ประมาณการ</h2>
                  <span className="font-mono text-[11px] text-ink-3">แถบพื้นสีอ่อน = เดือนที่มีวันปิดภาค</span>
                </div>
                <div className="mt-3">
                  <CashflowChart rows={base} />
                </div>

                <p className="mt-4 text-[15px] leading-relaxed">
                  <b className="font-semibold">ข้อสังเกต:</b> เดือนที่แย่ที่สุดคือ{" "}
                  <b>{thMonth(baseSum.worstMonth.month)}</b>{" "}
                  {baseSum.worstMonth.net < 0
                    ? `ขาดทุน ${n(-baseSum.worstMonth.net)} บาท`
                    : `กำไรเหลือ ${n(baseSum.worstMonth.net)} บาท`}
                  {baseSum.reserveThb > 0 ? (
                    <>
                      {" "}
                      ต้องมีเงินสำรองนอกเหนือจากงบเปิดร้านอย่างน้อย <b className="font-mono">
                        {n(baseSum.reserveThb)}
                      </b>{" "}
                      บาท จึงจะผ่านช่วงที่ขาดทุนสะสมไปได้
                    </>
                  ) : (
                    <> และไม่มีช่วงที่ขาดทุนสะสมเกินเงินที่ได้มา (ไม่ต้องเตรียมเงินสำรองเพิ่ม)</>
                  )}
                  · จุดคุ้มทุนต่อเดือนต้องมีลูกค้าช่วงเปิดเทอมประมาณ{" "}
                  <b className="font-mono">{n(baseSum.breakevenCustomers)}</b> คน/วัน
                </p>

                <h2 className="label mt-8 mb-2">3 สถานการณ์ (ลูกค้า ×0.5 / ×1 / ×1.5)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[15px]">
                    <thead>
                      <tr className="border-b border-ink">
                        <th className="py-2 text-left font-medium" />
                        {scenarios.map((s) => (
                          <th key={s.key} className="py-2 text-right font-medium">
                            {s.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <Row
                        label="ลูกค้าช่วงเปิดเทอม (คน/วัน)"
                        vals={scenarios.map((s) => n(fin.customersPerDay * s.mult))}
                      />
                      <Row label="กำไร/ขาดทุนเฉลี่ยต่อเดือน" vals={scenarios.map((s) => money(s.sum.avgNetMonth))} />
                      <Row
                        label="เดือนที่แย่ที่สุด"
                        vals={scenarios.map(
                          (s) => `${money(s.sum.worstMonth.net)} · ${thMonth(s.sum.worstMonth.month)}`,
                        )}
                      />
                      <Row label="เงินสำรองที่ควรมี" vals={scenarios.map((s) => n(s.sum.reserveThb))} />
                      <Row
                        label="คืนทุนงบเปิดร้าน"
                        vals={scenarios.map((s) =>
                          s.sum.paybackMonths ? `${s.sum.paybackMonths} เดือน` : "เกิน 3 ปี",
                        )}
                        strong
                      />
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 grid gap-6 border-t border-rule pt-4 text-sm leading-relaxed text-ink-2 md:grid-cols-2">
                  <div>
                    <h3 className="label mb-1">ที่มาของตัวเลข</h3>
                    <p>
                      ลูกค้าช่วงเปิดเทอมเริ่มจากค่ากลางของ Loc-Score (Huff model) ทำเล {site} ≈{" "}
                      {n(score!.customers.mid)} คน/วัน · ยอดต่อบิล {n(fin.avgTicketThb)} บาท{" "}
                      {profile ? "จากโปรไฟล์ร้าน" : "(ค่าเริ่มต้น)"} · ค่าเช่า{" "}
                      {rent == null ? "ยังไม่ได้กรอก" : `${n(rent)} บาท (ผู้ใช้กรอก)`}
                    </p>
                  </div>
                  <div>
                    <h3 className="label mb-1">ปฏิทินการศึกษา</h3>
                    <p>
                      <a
                        href={cal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-rule underline-offset-2 hover:decoration-ink"
                      >
                        {cal.source}
                      </a>{" "}
                      · {cal.note}
                    </p>
                  </div>
                </div>
              </section>

              <aside className="space-y-5 lg:border-l lg:border-rule lg:pl-6">
                <h2 className="label">ปรับสมมติฐาน</h2>
                <Field
                  label="ค่าเช่า/เดือน"
                  note="ใช้ค่าเดียวกับหน้าเปรียบเทียบ"
                  value={rent}
                  onCommit={(v) =>
                    saveCompareInputs({ ...compareInputs, rents: { ...compareInputs.rents, [site]: v } })
                  }
                />
                <Field
                  label="ลูกค้าช่วงเปิดเทอม (คน/วัน)"
                  note="ว่าง = ใช้ค่าจาก Loc-Score"
                  value={sim.customersPerDay}
                  placeholder={n(score!.customers.mid)}
                  onCommit={(v) => set({ customersPerDay: v })}
                />
                <Field
                  label="งบเปิดร้าน"
                  note={profile?.budget_thb ? "จากโปรไฟล์ร้าน" : "สมมติฐาน"}
                  value={sim.setupThb ?? fin.setupThb}
                  onCommit={(v) => set({ setupThb: v })}
                />
                <Field
                  label="ค่าจ้างพนักงาน/เดือน"
                  note="สมมติฐาน: ผู้ช่วย 1 คน"
                  value={sim.staffThb ?? fin.staffThb}
                  onCommit={(v) => set({ staffThb: v })}
                />
                <Field
                  label="ค่าน้ำไฟและอื่นๆ/เดือน"
                  note="สมมติฐาน"
                  value={sim.otherFixedThb ?? fin.otherFixedThb}
                  onCommit={(v) => set({ otherFixedThb: v })}
                />
                <Slider
                  label="ต้นทุนวัตถุดิบ"
                  unit="% ของยอดขาย"
                  min={15}
                  max={70}
                  value={fin.cogsShare * 100}
                  onChange={(v) => set({ cogsShare: v / 100 })}
                  note="สมมติฐาน: เครื่องดื่ม ~30–40% อาหาร ~40–50%"
                />
                <Slider
                  label="ลูกค้าช่วงปิดภาค"
                  unit="% ของช่วงเปิดเทอม"
                  min={5}
                  max={100}
                  value={fin.breakFactor * 100}
                  onChange={(v) => set({ breakFactor: v / 100 })}
                  note="สมมติฐาน ควรถามร้านแถวนั้นจริง 2–3 ร้าน"
                />
                <Slider
                  label="ลูกค้าช่วงภาคพิเศษ"
                  unit="% ของช่วงเปิดเทอม"
                  min={5}
                  max={100}
                  value={fin.specialFactor * 100}
                  onChange={(v) => set({ specialFactor: v / 100 })}
                  note="ภาคฤดูร้อนมีนักศึกษาเรียนน้อยกว่าปกติ"
                />
                <label className="block text-sm">
                  <span>เดือนที่เปิดร้าน</span>
                  <select
                    value={fin.startMonth}
                    onChange={(e) => set({ startMonth: e.target.value })}
                    className="mt-1 block w-full rounded-xs border border-rule bg-sheet px-2 py-1.5 font-mono text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => addMonths(nextMonth(), i)).map((m) => (
                      <option key={m} value={m}>
                        {thMonth(m)}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-ink-3">ลองเปิดก่อนปิดภาคเทียบกับเปิดต้นเทอม</span>
                </label>
                <button
                  onClick={() =>
                    saveSimulateInputs({
                      site: sim.site,
                      customersPerDay: null,
                      cogsShare: null,
                      staffThb: null,
                      otherFixedThb: null,
                      setupThb: null,
                      breakFactor: null,
                      specialFactor: null,
                      startMonth: null,
                    })
                  }
                  className="text-sm underline decoration-rule underline-offset-4 hover:decoration-ink"
                >
                  คืนค่าเริ่มต้น
                </button>
              </aside>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Row({ label, vals, strong = false }: { label: string; vals: string[]; strong?: boolean }) {
  return (
    <tr className={strong ? "border-y border-ink" : "border-b border-rule"}>
      <td className={`py-2 ${strong ? "font-semibold" : ""}`}>{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={`py-2 text-right font-mono tabular-nums ${strong ? "font-semibold" : ""}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}

function Field({
  label,
  note,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  note: string;
  value: number | null;
  placeholder?: string;
  onCommit: (v: number | null) => void;
}) {
  return (
    <label className="block text-sm">
      <span>{label}</span>
      <input
        inputMode="numeric"
        key={String(value)}
        defaultValue={value == null ? "" : String(Math.round(value))}
        placeholder={placeholder ?? "—"}
        onBlur={(e) => {
          const t = e.target.value.replace(/,/g, "").trim();
          const v = t === "" ? null : Number(t);
          onCommit(v != null && Number.isFinite(v) && v >= 0 ? v : null);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="mt-1 block w-full rounded-xs border border-rule bg-sheet px-2 py-1.5 text-right font-mono text-sm tabular-nums focus:border-ink"
      />
      <span className="mt-1 block text-xs text-ink-3">{note}</span>
    </label>
  );
}

function Slider({
  label,
  unit,
  min,
  max,
  value,
  onChange,
  note,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  note: string;
}) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{Math.round(value)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-ink"
        aria-label={`${label} ${unit}`}
      />
      <span className="block text-xs text-ink-3">{note}</span>
    </label>
  );
}
