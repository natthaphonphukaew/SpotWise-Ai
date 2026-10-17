import type { Certainty } from "@/lib/scoring/locscore";

/**
 * Score as a ruler with 10% ticks (style tile §04). Fill encodes certainty:
 * surveyed = solid ink · open data = solid light ink · estimated = hatch · missing = empty.
 */
export function RulerBar({ score, certainty }: { score: number | null; certainty: Certainty }) {
  const fill =
    certainty === "surveyed" ? "bg-ink" : certainty === "open" ? "bg-ink-3" : certainty === "estimated" ? "hatch text-ink" : "";
  return (
    <div
      className="relative h-3.5 border border-ink"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, transparent 0 calc(10% - 1px), var(--color-rule) calc(10% - 1px) 10%)",
      }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score ?? undefined}
    >
      {score != null && <div className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${fill}`} style={{ width: `${score}%` }} />}
    </div>
  );
}

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  surveyed: "ข้อมูลจริง",
  open: "ข้อมูลเปิด",
  estimated: "ประมาณการ",
  missing: "ยังไม่มีข้อมูล",
};
