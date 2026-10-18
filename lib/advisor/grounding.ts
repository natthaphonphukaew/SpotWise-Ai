import type { EvidenceRef } from "./evidence";

export type Statement = { text: string; cites: string[] };
export type Check = { ok: boolean; problems: string[] };

/** Numbers as written in Thai report text: 1,234 · 3.9 · 45%. */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/(?<![\w.])-?\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, "")));
}

/** Small counts and ordinals ("3 ทำเล", "ภาค 1", "10 นาที") are allowed without a citation. */
const TRIVIAL = (n: number) => Number.isInteger(n) && Math.abs(n) <= 12;

/** Prose states losses as positive amounts ("ขาดทุน 9,185 บาท"), so signs are ignored. */
function close(x: number, y: number) {
  const a = Math.abs(x);
  const b = Math.abs(y);
  if (a === b) return true;
  const tol = Math.max(0.5, Math.abs(b) * 0.02); // rounding in prose: 9,185 ≈ 9,200, 3.9 ≈ 4
  return Math.abs(a - b) <= tol;
}

/**
 * A statement is grounded when it cites at least one evidence id that exists, and every
 * non-trivial number in it appears in what it cites (values, ranges, or numbers in labels/units).
 */
export function checkStatement(st: Statement, byId: Map<string, EvidenceRef>): Check {
  const problems: string[] = [];
  const cited = st.cites.map((id) => byId.get(id)).filter((e): e is EvidenceRef => !!e);
  const unknown = st.cites.filter((id) => !byId.has(id));
  if (unknown.length) problems.push(`อ้างหลักฐานที่ไม่มีอยู่: ${unknown.join(", ")}`);
  if (cited.length === 0) problems.push("ไม่ได้อ้างหลักฐาน");

  const allowed = cited.flatMap((e) => [
    ...(typeof e.value === "number" ? [e.value] : numbersIn(String(e.value ?? ""))),
    ...numbersIn(e.label),
    ...numbersIn(e.unit),
  ]);
  for (const n of numbersIn(st.text)) {
    if (TRIVIAL(n)) continue;
    if (!allowed.some((a) => close(n, a))) problems.push(`ตัวเลข ${n.toLocaleString("en-US")} ไม่อยู่ในหลักฐานที่อ้าง`);
  }
  return { ok: problems.length === 0, problems };
}

export function groundingRate(statements: Statement[], evidence: EvidenceRef[]) {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const checks = statements.map((s) => checkStatement(s, byId));
  const ok = checks.filter((c) => c.ok).length;
  return { ok, total: statements.length, rate: statements.length ? ok / statements.length : 1, checks };
}
