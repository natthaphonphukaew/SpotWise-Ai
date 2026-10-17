"use client";

import { GROUPS, type PoiGroup } from "@/lib/data/bangmod";
import {
  normalizeWeights,
  PROFILE_GROUPS,
  rolesFor,
  WEIGHT_KEYS,
  type BusinessProfile,
  type Role,
  type WeightKey,
} from "@/lib/profile/schema";
import type { StoredProfile } from "@/lib/profile/store";

const ROLE_ORDER: Role[] = ["comp", "comp-indirect", "synergy", "context"];
const ROLE_LABEL: Record<Role, string> = {
  comp: "คู่แข่งตรง",
  "comp-indirect": "คู่แข่งอ้อม",
  synergy: "เกื้อหนุน",
  context: "ไม่เกี่ยว",
};
const WEIGHT_LABEL: Record<WeightKey, string> = {
  target: "กลุ่มเป้าหมาย",
  access: "การเข้าถึง",
  market: "ความอิ่มตัวตลาด",
  rent: "ค่าเช่า",
  synergy: "สถานที่เกื้อหนุน",
};

const baht = (n: number | null) => (n == null ? null : n.toLocaleString("en-US"));

/** Profile from the AI, editable by the user. AI-assumed values are marked (hatched) per DESIGN.md §1. */
export function ProfileCard({ value, onChange }: { value: StoredProfile; onChange: (v: StoredProfile) => void }) {
  const p = value.profile;
  const roles = rolesFor(p);
  const set = (profile: BusinessProfile) => onChange({ ...value, profile, edited: true });

  function cycleRole(g: PoiGroup) {
    const next = ROLE_ORDER[(ROLE_ORDER.indexOf(roles[g]) + 1) % ROLE_ORDER.length];
    const keep = (list: PoiGroup[]) => list.filter((x) => x !== g);
    set({
      ...p,
      direct_competitors: next === "comp" ? [...keep(p.direct_competitors), g] : keep(p.direct_competitors),
      indirect_competitors:
        next === "comp-indirect" ? [...keep(p.indirect_competitors), g] : keep(p.indirect_competitors),
      synergy:
        next === "synergy"
          ? [...p.synergy.filter((s) => s.group !== g), { group: g, reason: "ผู้ใช้เพิ่มเอง" }]
          : p.synergy.filter((s) => s.group !== g),
    });
  }

  function setWeight(k: WeightKey, v: number) {
    set({ ...p, weights: normalizeWeights({ ...p.weights, [k]: v }) });
  }

  const price =
    p.price_min_thb != null || p.price_max_thb != null
      ? `${baht(p.price_min_thb) ?? "?"}–${baht(p.price_max_thb) ?? "?"} บาท`
      : null;

  return (
    <article className="rounded-sm border border-rule bg-paper-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-3">
        <span className="label">โปรไฟล์ธุรกิจ · ตีความโดย AI{value.edited ? " · ผู้ใช้แก้ไขแล้ว" : ""}</span>
        <span className="font-mono text-[11px] text-ink-3">
          {value.meta.model.toUpperCase()} · {value.meta.cached ? "จาก CACHE" : "เรียกใหม่"}
        </span>
      </header>

      <div className="grid gap-8 px-5 py-5 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="font-display text-[28px] leading-snug font-semibold">{p.business_label}</h2>
          <p className="mt-1 text-ink-2">{p.summary}</p>

          <dl className="mt-5 grid grid-cols-3 border-y border-ink text-sm">
            <Fact k="ราคาต่อชิ้น" v={price} />
            <Fact k="ยอดเฉลี่ย/บิล" v={`${baht(p.avg_ticket_thb)} บาท`} assumed={p.avg_ticket_source === "assumed"} />
            <Fact k="งบเปิดร้าน" v={p.budget_thb != null ? `${baht(p.budget_thb)} บาท` : null} />
          </dl>
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-3">
            <span className="hatch inline-block h-2.5 w-6 border border-ink-3 text-ink-3" /> ลายทแยง = AI สันนิษฐาน
            ผู้ใช้ไม่ได้บอก
          </p>

          <h3 className="label mt-6 mb-2">กลุ่มลูกค้า</h3>
          <ul className="space-y-1.5">
            {p.target_segments.map((s) => (
              <li key={s.label} className="grid grid-cols-[1fr_120px_36px] items-center gap-3 text-[15px]">
                <span>{s.label}</span>
                <span className="h-1.5 border border-ink">
                  <span className="block h-full bg-ink" style={{ width: `${Math.min(100, s.share)}%` }} />
                </span>
                <span className="text-right font-mono text-xs tabular-nums">{s.share}%</span>
              </li>
            ))}
          </ul>

          {p.peak_hours.length > 0 && (
            <>
              <h3 className="label mt-6 mb-2">ช่วงขายดี (คาดการณ์)</h3>
              <ul className="space-y-1 text-[15px]">
                {p.peak_hours.map((h) => (
                  <li key={h.from + h.to}>
                    <span className="font-mono text-sm tabular-nums">
                      {h.from}–{h.to}
                    </span>{" "}
                    <span className="text-ink-2">{h.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <h3 className="label mb-2">สถานที่บนแผนที่ · คลิกเพื่อเปลี่ยนบทบาท</h3>
          <div className="space-y-3">
            {ROLE_ORDER.map((role) => {
              const groups = PROFILE_GROUPS.filter((g) => roles[g] === role);
              return (
                <div key={role} className="grid grid-cols-[88px_1fr] items-start gap-3">
                  <span className="pt-1 text-sm text-ink-2">{ROLE_LABEL[role]}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {groups.length === 0 && <span className="pt-1 text-sm text-ink-3">—</span>}
                    {groups.map((g) => (
                      <button
                        key={g}
                        onClick={() => cycleRole(g)}
                        title={p.synergy.find((s) => s.group === g)?.reason}
                        className={`rounded-xs border px-2 py-0.5 text-sm ${chip(role)}`}
                      >
                        {GROUPS[g].label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <h3 className="label mt-6 mb-2">น้ำหนักคะแนน (รวม 100)</h3>
          <div className="space-y-2">
            {WEIGHT_KEYS.map((k) => (
              <label key={k} className="grid grid-cols-[120px_1fr_36px] items-center gap-3 text-[15px]">
                <span>{WEIGHT_LABEL[k]}</span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={p.weights[k]}
                  onChange={(e) => setWeight(k, Number(e.target.value))}
                  className="accent-ink"
                  aria-label={`น้ำหนัก ${WEIGHT_LABEL[k]}`}
                />
                <span className="text-right font-mono text-sm tabular-nums">{p.weights[k]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-t border-rule px-5 py-4 md:grid-cols-2">
        <List title="AI สันนิษฐาน" items={p.assumptions} muted />
        <List title="ควรไปเช็กหน้างาน" items={p.to_verify} />
      </div>
    </article>
  );
}

function chip(role: Role) {
  switch (role) {
    case "comp":
      return "border-comp bg-comp text-paper";
    case "comp-indirect":
      return "border-comp text-ink";
    case "synergy":
      return "border-edu bg-edu/15 text-ink";
    default:
      return "border-rule text-ink-3 hover:border-ink-3";
  }
}

function Fact({ k, v, assumed = false }: { k: string; v: string | null; assumed?: boolean }) {
  return (
    <div className="border-r border-rule px-3 py-2 last:border-r-0">
      <dt className="label">{k}</dt>
      <dd className="mt-0.5 font-mono text-[15px] tabular-nums">
        {v == null ? (
          <span className="text-ink-3">ไม่ได้ระบุ</span>
        ) : assumed ? (
          <span className="relative">
            <span className="hatch absolute inset-x-0 -bottom-0.5 h-1.5 text-ink-3" aria-hidden />
            {v}
            <span className="sr-only"> (AI สันนิษฐาน)</span>
          </span>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}

function List({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="label mb-1.5">{title}</h3>
      <ul className={`list-disc space-y-1 pl-5 text-[15px] ${muted ? "text-ink-2" : ""}`}>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
