"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Readout, TopBar } from "@/components/TopBar";
import { CERTAINTY_LABEL, RulerBar } from "@/components/compare/RulerBar";
import { saveCompareInputs, useCompareInputs } from "@/lib/compare/store";
import type { Candidate, Manifest } from "@/lib/data/bangmod";
import { loadBangmod, type BangmodData } from "@/lib/data/load";
import { centreOf, siteInputs } from "@/lib/geo/site";
import { rolesFor, WEIGHT_KEYS, type WeightKey } from "@/lib/profile/schema";
import { useStoredProfile } from "@/lib/profile/store";
import { CAMPUS_STUDENTS_SOURCE, DEFAULT_ASSUMPTIONS, scoreSite, type EvidenceItem, type SiteScore } from "@/lib/scoring/locscore";

const DIM_LABEL: Record<WeightKey, string> = {
  target: "กลุ่มเป้าหมาย",
  access: "การเข้าถึง",
  market: "ความอิ่มตัวตลาด",
  rent: "ความคุ้มค่าค่าเช่า",
  synergy: "สถานที่เกื้อหนุน",
};
// SPEC §4 defaults, used until the user has an AI profile
const DEFAULT_WEIGHTS: Record<WeightKey, number> = { target: 25, access: 20, market: 20, rent: 20, synergy: 15 };

const n = (v: number) => v.toLocaleString("en-US");

export function CompareView({ manifest, candidates }: { manifest: Manifest; candidates: Candidate[] }) {
  const [data, setData] = useState<BangmodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ cand: string; dim: WeightKey } | null>(null);
  const stored = useStoredProfile();
  const inputs = useCompareInputs();

  useEffect(() => {
    loadBangmod().then(setData, (e: Error) => setError(e.message));
  }, []);

  const profile = stored?.profile ?? null;
  const weights = profile?.weights ?? DEFAULT_WEIGHTS;
  const assumptions = useMemo(
    () => ({
      ...DEFAULT_ASSUMPTIONS,
      avgTicketThb: profile?.avg_ticket_thb ?? DEFAULT_ASSUMPTIONS.avgTicketThb,
      dailyPurchaseRate: inputs.dailyPurchaseRate ?? DEFAULT_ASSUMPTIONS.dailyPurchaseRate,
      campusPresence: inputs.campusPresence ?? DEFAULT_ASSUMPTIONS.campusPresence,
    }),
    [profile, inputs.dailyPurchaseRate, inputs.campusPresence],
  );

  const scores = useMemo(() => {
    if (!data) return null;
    const roles = rolesFor(profile);
    // Students and staff are on campus by day but not in WorldPop's residential counts.
    const centre = centreOf(data.campus);
    const campus = centre ? [{ at: centre, pop: assumptions.campusStudents * assumptions.campusPresence }] : [];
    return Object.fromEntries(
      candidates.map((c) => {
        const rent = inputs.rents[c.id] ?? c.rent_thb ?? null;
        return [c.id, scoreSite(siteInputs(c, data, roles, rent, campus), weights, assumptions)];
      }),
    ) as Record<string, SiteScore>;
  }, [data, profile, weights, assumptions, candidates, inputs.rents]);

  const best = (pick: (s: SiteScore) => number | null) => {
    if (!scores) return null;
    const vals = candidates.map((c) => pick(scores[c.id])).filter((v): v is number => v != null);
    return vals.length > 1 ? Math.max(...vals) : null;
  };

  const setRent = (id: string, value: string) => {
    const v = value.trim() === "" ? null : Math.max(0, Number(value.replace(/,/g, "")));
    saveCompareInputs({ ...inputs, rents: { ...inputs.rents, [id]: Number.isFinite(v) ? v : null } });
  };

  const focusDim = focus && scores ? scores[focus.cand].dims.find((d) => d.key === focus.dim) : null;

  return (
    <>
      <TopBar right={<Readout k="SITES" v={candidates.length} />} />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-10 sm:px-8">
        <div className="label">เปรียบเทียบทำเล · No.001 · บางมด</div>
        <h1 className="mt-2 font-display text-4xl leading-tight font-semibold">ทำเลไหนดีกว่า และเพราะอะไร</h1>
        <p className="mt-3 max-w-[70ch] text-ink-2">
          {profile ? (
            <>
              วิเคราะห์สำหรับ <span className="font-medium text-ink">{profile.business_label}</span> ใช้น้ำหนักและบทบาทคู่แข่งจากโปรไฟล์ ·{" "}
            </>
          ) : (
            <>ยังไม่มีโปรไฟล์ร้าน ใช้น้ำหนักเริ่มต้นของร้านชาไข่มุก · </>
          )}
          <Link href="/" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
            แก้โปรไฟล์
          </Link>{" "}
          ·{" "}
          <Link href="/map" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
            ดูบนแผนที่
          </Link>
        </p>
        {candidates.some((c) => c.placeholder) && (
          <p className="mt-2 text-sm text-ink-3">ทำเล A/B/C ตอนนี้เป็นจุดตัวอย่าง ยังไม่ได้สำรวจจริง ค่าเช่าให้กรอกเองด้านล่าง</p>
        )}

        {error && <p className="mt-8 text-comp">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
        {!scores && !error && <p className="mt-8 font-mono text-xs text-ink-3">กำลังคำนวณ…</p>}

        {scores && (
          <>
            {/* Score cards */}
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {candidates.map((c) => {
                const s = scores[c.id];
                return (
                  <article key={c.id} className="rounded-sm border border-rule bg-paper-2 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="label">ทำเล {c.id}{c.placeholder ? " · ตัวอย่าง" : ""}</div>
                        <h2 className="mt-1 text-[15px] leading-snug">{c.label}</h2>
                      </div>
                      <span className="grid h-6 w-6 shrink-0 place-items-center bg-ink font-mono text-xs font-semibold text-paper">{c.id}</span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-display text-score font-semibold tabular-nums">{s.total ?? "—"}</span>
                      <span className="font-mono text-xs text-ink-2">/100 · LOC-SCORE</span>
                    </div>
                    <div className="mt-3 flex justify-between border-y border-rule py-1.5 font-mono text-[11px] text-ink-2">
                      <span>
                        CONFIDENCE <b className="font-medium text-ink">{s.confidence}%</b>
                      </span>
                      <span>≈ {n(s.customers.low)}–{n(s.customers.high)} คน/วัน</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {s.dims.map((d) => (
                        <button
                          key={d.key}
                          onClick={() => setFocus({ cand: c.id, dim: d.key })}
                          className={`block w-full text-left ${focus?.cand === c.id && focus.dim === d.key ? "outline-2 outline-offset-4 outline-accent" : ""}`}
                        >
                          <div className="mb-1 flex items-baseline justify-between text-sm">
                            <span>
                              {DIM_LABEL[d.key]} <span className="font-mono text-[11px] text-ink-3">{weights[d.key]}%</span>
                            </span>
                            <span className="font-mono text-[13px] tabular-nums">{d.score ?? "—"}</span>
                          </div>
                          <RulerBar score={d.score} certainty={d.certainty} />
                          <div className="mt-0.5 font-mono text-[11px] text-ink-3">{CERTAINTY_LABEL[d.certainty]}</div>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
              <span><span className="mr-1.5 inline-block h-2.5 w-6 border border-ink bg-ink align-middle" />ข้อมูลจริง</span>
              <span><span className="mr-1.5 inline-block h-2.5 w-6 border border-ink bg-ink-3 align-middle" />ข้อมูลเปิด</span>
              <span><span className="hatch mr-1.5 inline-block h-2.5 w-6 border border-ink align-middle text-ink" />ประมาณการ</span>
              <span>คะแนนบอกว่าทำเลเอื้อแค่ไหน ไม่ใช่ % โอกาสรอดของร้าน · คลิกแถบเพื่อดูที่มา</span>
            </p>

            {/* Evidence */}
            {focus && focusDim && (
              <section className="mt-6 rounded-sm border border-ink bg-sheet" aria-live="polite">
                <div className="flex items-center justify-between border-b border-rule px-4 py-2">
                  <span className="label">
                    Evidence · ทำเล {focus.cand} · {DIM_LABEL[focus.dim]} · {focusDim.score ?? "—"}/100
                  </span>
                  <button onClick={() => setFocus(null)} className="font-mono text-[11px] text-ink-3 hover:text-ink">
                    ปิด
                  </button>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-ink-2">{focusDim.how}</p>
                  <ul className="mt-3 divide-y divide-rule border-y border-rule">
                    {focusDim.evidence.map((e) => (
                      <EvidenceRow key={e.label} e={e} />
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Table */}
            <h2 className="label mt-10 mb-2">ตารางเปรียบเทียบ</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-ink">
                    <th className="py-2 text-left font-medium">มิติ</th>
                    {candidates.map((c) => (
                      <th key={c.id} className="py-2 text-right font-mono font-medium">{c.id}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEIGHT_KEYS.map((k) => {
                    const top = best((s) => s.dims.find((d) => d.key === k)!.score);
                    return (
                      <tr key={k} className="border-b border-rule">
                        <td className="py-2">
                          {DIM_LABEL[k]} <span className="font-mono text-[11px] text-ink-3">{weights[k]}%</span>
                        </td>
                        {candidates.map((c) => {
                          const v = scores[c.id].dims.find((d) => d.key === k)!.score;
                          return (
                            <td key={c.id} className="py-2 text-right font-mono tabular-nums">
                              <span className={v != null && v === top ? "border-b-2 border-accent" : ""}>{v ?? "—"}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="border-b border-rule">
                    <td className="py-2">ลูกค้า/วัน <span className="text-xs text-ink-3">ประมาณ</span></td>
                    {candidates.map((c) => (
                      <td key={c.id} className="py-2 text-right font-mono tabular-nums">
                        {n(scores[c.id].customers.low)}–{n(scores[c.id].customers.high)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-rule">
                    <td className="py-2">รายได้/เดือน <span className="text-xs text-ink-3">ประมาณ</span></td>
                    {candidates.map((c) => (
                      <td key={c.id} className="py-2 text-right font-mono tabular-nums">{n(scores[c.id].revenueMonth)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-rule">
                    <td className="py-2">ค่าเช่า/เดือน <span className="text-xs text-ink-3">กรอกเอง</span></td>
                    {candidates.map((c) => (
                      <td key={c.id} className="py-1.5 text-right">
                        <input
                          inputMode="numeric"
                          aria-label={`ค่าเช่าทำเล ${c.id}`}
                          placeholder="—"
                          defaultValue={inputs.rents[c.id] ?? c.rent_thb ?? ""}
                          onBlur={(e) => setRent(c.id, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="w-28 rounded-xs border border-rule bg-sheet px-2 py-1 text-right font-mono text-sm tabular-nums focus:border-ink"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-y border-ink">
                    <td className="py-2 font-semibold">Loc-Score</td>
                    {candidates.map((c) => (
                      <td key={c.id} className="py-2 text-right font-display text-[28px] font-semibold tabular-nums">
                        {scores[c.id].total ?? "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1.5 font-mono text-[11px] text-ink-3">CONFIDENCE</td>
                    {candidates.map((c) => (
                      <td key={c.id} className="py-1.5 text-right font-mono text-xs text-ink-2">{scores[c.id].confidence}%</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Assumptions */}
            <section className="mt-10 grid gap-6 border-t border-ink pt-4 md:grid-cols-2">
              <div>
                <h2 className="label mb-2">สมมติฐานที่ใช้คำนวณ</h2>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                  <dt>ยอดเฉลี่ยต่อบิล</dt>
                  <dd className="text-right font-mono tabular-nums">
                    {n(assumptions.avgTicketThb)} บาท{" "}
                    <span className="text-[11px] text-ink-3">{profile ? (profile.avg_ticket_source === "user" ? "จากผู้ใช้" : "AI สันนิษฐาน") : "ค่าเริ่มต้น"}</span>
                  </dd>
                  <dt>
                    นักศึกษา มจธ.
                    <span className="block text-[11px] text-ink-3">{CAMPUS_STUDENTS_SOURCE}</span>
                  </dt>
                  <dd className="text-right font-mono tabular-nums">{n(assumptions.campusStudents)} คน</dd>
                  <dt>
                    <label htmlFor="presence">อยู่ในวิทยาเขตบางมดในวันปกติ</label>
                  </dt>
                  <dd className="text-right font-mono tabular-nums">{Math.round(assumptions.campusPresence * 100)}%</dd>
                  <dd className="col-span-2">
                    <input
                      id="presence"
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={assumptions.campusPresence * 100}
                      onChange={(e) => saveCompareInputs({ ...inputs, campusPresence: Number(e.target.value) / 100 })}
                      className="w-full accent-ink"
                    />
                  </dd>
                  <dt>วันเปิดร้านต่อเดือน</dt>
                  <dd className="text-right font-mono tabular-nums">{assumptions.openDaysPerMonth} วัน</dd>
                  <dt>
                    <label htmlFor="rate">คนในระยะที่ซื้อสินค้าประเภทนี้ต่อวัน</label>
                  </dt>
                  <dd className="text-right font-mono tabular-nums">{(assumptions.dailyPurchaseRate * 100).toFixed(1)}%</dd>
                </dl>
                <input
                  id="rate"
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={assumptions.dailyPurchaseRate * 100}
                  onChange={(e) => saveCompareInputs({ ...inputs, dailyPurchaseRate: Number(e.target.value) / 100 })}
                  className="mt-2 w-full accent-ink"
                />
                <p className="mt-1 text-xs text-ink-3">
                  ค่าเริ่มต้น 4% เหมาะกับเครื่องดื่ม ถ้าเป็นร้านอาหารที่คนซื้อกินทุกวันควรตั้งสูงกว่านี้มาก ค่านี้เป็นสมมติฐาน ไม่ใช่ข้อมูลจริง
                </p>
              </div>
              <div className="text-sm leading-relaxed text-ink-2">
                <h2 className="label mb-2">วิธีคิด</h2>
                <p>
                  ลูกค้า/วัน = (ประชากรรอบ 1.5 กม. จาก WorldPop + คนใน มจธ. ระหว่างวัน) × อัตราซื้อต่อวัน × ส่วนแบ่งที่ร้านเราน่าจะได้ตาม Huff model
                  ซึ่งคิดจากระยะทางถึงร้านเราเทียบกับคู่แข่ง (คู่แข่งตรงมีแรงดึง 1 อ้อม 0.2) ช่วงต่ำ–สูงคืออัตราซื้อ ±50%
                </p>
                <p className="mt-2">
                  ประชากรจาก WorldPop เป็นค่าประมาณและไม่นับนักศึกษาที่ไม่ได้ลงทะเบียนอยู่ในพื้นที่ ตัวเลขทั้งหมดจึงเป็นการเปรียบเทียบระหว่างทำเล ไม่ใช่การทำนายยอดขายจริง
                </p>
              </div>
            </section>
          </>
        )}
        <p className="mt-10 font-mono text-[11px] text-ink-3">
          ข้อมูล: {Object.values(manifest.sources).map((s) => s.name).join(" · ")}
        </p>
      </main>
    </>
  );
}

function EvidenceRow({ e }: { e: EvidenceItem }) {
  const kind =
    e.kind === "assumption" ? "สมมติฐาน" : e.kind === "surveyed" ? "ข้อมูลจริง" : e.kind === "open" ? "ข้อมูลเปิด" : e.kind === "estimated" ? "ประมาณการ" : "ไม่มีข้อมูล";
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-4 py-2 sm:grid-cols-[1fr_auto_220px]">
      <span>{e.label}</span>
      <span className="text-right font-mono tabular-nums">{e.value == null ? "—" : `${n(e.value)} ${e.unit}`}</span>
      <span className="col-span-2 text-xs text-ink-3 sm:col-span-1 sm:text-right">
        {kind} · {e.source}
      </span>
    </li>
  );
}
