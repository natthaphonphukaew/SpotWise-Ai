import type { MonthRow } from "@/lib/scoring/finance";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const thMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${TH_MONTH[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
};

/**
 * Monthly net cash flow (style tile §07): profit bars in ink, losses as outlined bars with the value in
 * parentheses (accounting style), months with term breaks shaded and labelled. Everything here is
 * an estimate, said once in the caption rather than hatching every bar.
 */
export function CashflowChart({ rows }: { rows: MonthRow[] }) {
  const W = 900,
    H = 280,
    L = 52,
    R = 8,
    T = 22,
    B = 40;
  const vals = rows.map((r) => r.net / 1000);
  // headroom so value labels never collide with the month labels or the top
  const max = Math.max(5, ...vals) * 1.12;
  const min = Math.min(-5, ...vals) * 1.25;
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - B);
  const bw = (W - L - R) / rows.length;
  const step = niceStep((max - min) / 4);
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label="กระแสเงินสดสุทธิรายเดือน 12 เดือน"
    >
      {rows.map((r, i) =>
        r.breakDays > 0 ? (
          <g key={`b${r.month}`}>
            <rect
              x={L + bw * i}
              y={T}
              width={bw}
              height={H - T - B}
              className="fill-paper-2"
              opacity={Math.min(1, 0.35 + r.breakDays / 31)}
            />
            <text x={L + bw * i + bw / 2} y={T - 7} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">
              {r.breakDays >= 28 ? "ปิดภาค" : `ปิด ${r.breakDays} วัน`}
            </text>
          </g>
        ) : null,
      )}
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={L}
            x2={W - R}
            y1={y(v)}
            y2={y(v)}
            className={v === 0 ? "stroke-ink" : "stroke-rule"}
            strokeWidth={1}
          />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-2 font-mono text-[11px]">
            {v === 0 ? "0" : v > 0 ? `${v}k` : `(${-v}k)`}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const v = vals[i];
        const x = L + bw * i + bw * 0.22;
        const w = bw * 0.56;
        const label = Math.abs(v) >= 10 ? Math.round(Math.abs(v)).toString() : Math.abs(v).toFixed(1);
        return (
          <g key={r.month}>
            {v >= 0 ? (
              <rect x={x} y={y(v)} width={w} height={y(0) - y(v)} className="fill-ink" />
            ) : (
              <rect
                x={x + 0.5}
                y={y(0)}
                width={w - 1}
                height={y(v) - y(0)}
                className="fill-paper stroke-ink"
                strokeWidth={1}
              />
            )}
            <text
              x={x + w / 2}
              y={v >= 0 ? y(v) - 5 : y(v) + 13}
              textAnchor="middle"
              className="fill-ink font-mono text-[11px]"
            >
              {v >= 0 ? label : `(${label})`}
            </text>
            <text x={x + w / 2} y={H - 22} textAnchor="middle" className="fill-ink-2 font-mono text-[11px]">
              {thMonth(r.month)}
            </text>
            {r.projected && (
              <text x={x + w / 2} y={H - 8} textAnchor="middle" className="fill-ink-3 font-mono text-[9px]">
                คาด
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
