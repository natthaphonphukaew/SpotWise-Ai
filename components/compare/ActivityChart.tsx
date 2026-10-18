import type { TimeSlot } from "@/lib/field/types";
import { DAY_END, DAY_START, HOURS, type ActivityProfile } from "@/lib/scoring/activity";

/** Hour range each Field Mode slot stands for on the chart (matches SLOT_LABEL). */
const SLOT_HOURS: Partial<Record<TimeSlot, [number, number]>> = { morning: [7, 9], noon: [11, 13], evening: [16, 18] };

/**
 * One site's weekday rhythm as a mirror chart: anchors active above the line (ink), competitors
 * open below it (direct solid, indirect outlined), the shop's peak hours shaded, real footfall
 * counts from Field Mode marked in accent. Scales are shared across sites so rows compare.
 */
export function ActivityChart({
  profile,
  peak,
  gaps,
  footfall,
  scale,
  label,
}: {
  profile: ActivityProfile;
  peak: Set<number>;
  gaps: number[];
  footfall: Partial<Record<TimeSlot, { perMin: number }>>;
  scale: { synergy: number; comp: number };
  label: string;
}) {
  const W = 900,
    L = 64,
    R = 8,
    T = 18,
    UP = 64,
    DOWN = 40,
    B = 22;
  const H = T + UP + DOWN + B;
  const base = T + UP;
  const bw = (W - L - R) / HOURS.length;
  const x = (h: number) => L + (h - DAY_START) * bw;
  const up = (v: number) => (v / Math.max(1, scale.synergy)) * (UP - 4);
  const down = (v: number) => (v / Math.max(1, scale.comp)) * (DOWN - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      {profile.rows.map((r) =>
        peak.has(r.hour) ? <rect key={`p${r.hour}`} x={x(r.hour)} y={T} width={bw} height={UP + DOWN} className="fill-paper-2" /> : null,
      )}
      {peak.size > 0 && (
        <text x={x(Math.min(...peak)) + 2} y={T - 6} className="fill-ink-3 font-mono text-[10px]">
          ช่วงขายหลัก
        </text>
      )}

      {profile.rows.map((r) => {
        const xi = x(r.hour) + bw * 0.18;
        const w = bw * 0.64;
        const d = down(r.comp);
        return (
          <g key={r.hour}>
            {r.synergy > 0 && <rect x={xi} y={base - up(r.synergy)} width={w} height={up(r.synergy)} className="fill-ink" />}
            {r.comp > 0 && <rect x={xi} y={base} width={w} height={d} className="fill-comp" />}
            {r.indirect > 0 && (
              <rect x={xi + 0.5} y={base + d} width={w - 1} height={down(r.indirect)} className="fill-none stroke-comp" strokeWidth={1} />
            )}
          </g>
        );
      })}

      <line x1={L} x2={W - R} y1={base} y2={base} className="stroke-ink" strokeWidth={1} />
      <text x={L - 6} y={T + 8} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">
        {scale.synergy} แห่ง
      </text>
      <text x={L - 6} y={base + DOWN - 2} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">
        {scale.comp} แห่ง
      </text>

      {gaps.map((h) => (
        <line key={`g${h}`} x1={x(h) + 1} x2={x(h) + bw - 1} y1={base + DOWN + 3} y2={base + DOWN + 3} className="stroke-accent" strokeWidth={2} />
      ))}

      {HOURS.filter((h) => h % 3 === 0).map((h) => (
        <text key={`t${h}`} x={x(h)} y={H - 4} textAnchor="middle" className="fill-ink-2 font-mono text-[10px]">
          {String(h).padStart(2, "0")}
        </text>
      ))}
      <text x={x(DAY_END)} y={H - 4} textAnchor="end" className="fill-ink-2 font-mono text-[10px]">
        24
      </text>

      {(Object.entries(footfall) as [TimeSlot, { perMin: number }][]).map(([slot, f]) => {
        const span = SLOT_HOURS[slot];
        if (!span) return null;
        const cx = (x(span[0]) + x(span[1])) / 2;
        return (
          <g key={slot}>
            <circle cx={cx} cy={T + 6} r={3.5} className="fill-accent" />
            <text x={cx + 7} y={T + 9} className="fill-ink font-mono text-[10px]">
              นับจริง {f.perMin.toFixed(1)} คน/นาที
            </text>
          </g>
        );
      })}
    </svg>
  );
}
