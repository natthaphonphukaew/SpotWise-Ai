/**
 * How well do the rule-based groups and the AI groups agree with the hand-curated CampusSpot list?
 * (SPEC §9.2 — POI classifier accuracy.)
 *
 *   npm run eval:poi
 *
 * Ground truth: CampusSpot category (cafe / food / laundry / print_stationery), collapsed to
 * drink / food / service. Shops the pipeline added *from* CampusSpot are excluded, because their
 * rule-based group was derived from that same category. Output: public/data/bangmod/eval_poi.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { FeatureCollection, Point } from "geojson";
import type { PoiAiFile, PoiGroup, PoiProps } from "@/lib/data/bangmod";

type Coarse = "drink" | "food" | "service" | "other";

const TRUTH: Record<string, Coarse> = { cafe: "drink", food: "food", laundry: "service", print_stationery: "service" };
const coarse = (g: PoiGroup): Coarse =>
  g === "coffee" || g === "bubble_tea" || g === "drink_dessert" ? "drink" : g === "food" ? "food" : g === "retail" ? "service" : "other";

const curated = JSON.parse(readFileSync("data-pipeline/reference/campusspot_shops.geojson", "utf8")) as FeatureCollection<
  Point,
  { overture_id: string | null; category: string; name: string }
>;
const poi = JSON.parse(readFileSync("public/data/bangmod/poi.geojson", "utf8")) as FeatureCollection<Point, PoiProps>;
const ai = JSON.parse(readFileSync("public/data/bangmod/poi_ai.json", "utf8")) as PoiAiFile;

const truthById = new Map(
  curated.features.filter((f) => f.properties.overture_id).map((f) => [`ov:${f.properties.overture_id}`, TRUTH[f.properties.category]]),
);

type Row = { id: string; name: string; truth: Coarse; rule: Coarse; ai: Coarse; ruleGroup: PoiGroup; aiGroup: PoiGroup; reason: string };
const rows: Row[] = [];
for (const f of poi.features) {
  const p = f.properties;
  const truth = truthById.get(p.id);
  const label = ai.items[p.id];
  if (!truth || !label) continue;
  if (p.category && p.category in TRUTH) continue; // added from CampusSpot itself → not independent
  rows.push({ id: p.id, name: p.name, truth, rule: coarse(p.group), ai: coarse(label.g), ruleGroup: p.group, aiGroup: label.g, reason: label.r });
}

const acc = (k: "rule" | "ai") => rows.filter((r) => r[k] === r.truth).length / rows.length;
// CampusSpot only has cafe/food, so dessert & drink shops (drink_dessert) can legitimately sit in either.
const lenient = (k: "rule" | "ai") =>
  rows.filter((r) => r[k] === r.truth || ((k === "rule" ? r.ruleGroup : r.aiGroup) === "drink_dessert" && (r.truth === "food" || r.truth === "drink"))).length /
  rows.length;
const confusion = (k: "rule" | "ai") => {
  const m: Record<string, number> = {};
  for (const r of rows) m[`${r.truth}→${r[k]}`] = (m[`${r.truth}→${r[k]}`] ?? 0) + 1;
  return m;
};
const fixed = rows.filter((r) => r.rule !== r.truth && r.ai === r.truth);
const broke = rows.filter((r) => r.rule === r.truth && r.ai !== r.truth);

const result = {
  created: new Date().toISOString(),
  model: ai.model,
  n: rows.length,
  rule_accuracy: Number(acc("rule").toFixed(3)),
  ai_accuracy: Number(acc("ai").toFixed(3)),
  rule_accuracy_lenient: Number(lenient("rule").toFixed(3)),
  ai_accuracy_lenient: Number(lenient("ai").toFixed(3)),
  ai_labeled: `${ai.count}/${ai.total}`,
  fixed_by_ai: fixed.length,
  broken_by_ai: broke.length,
  confusion: { rule: confusion("rule"), ai: confusion("ai") },
  examples_fixed: fixed.slice(0, 15).map(({ name, truth, rule, ai: a, reason }) => ({ name, truth, rule, ai: a, reason })),
  examples_broken: broke.slice(0, 15).map(({ name, truth, rule, ai: a, aiGroup, reason }) => ({ name, truth, rule, ai: a, aiGroup, reason })),
  caveat:
    "ความจริงอ้างอิงคือหมวดใน CampusSpot (คาเฟ่/อาหาร/บริการ) ซึ่งคัดจากหมวดของ Overture เอง จึงเอนเข้าหาวิธีกฎ (กฎก็อ่านหมวด Overture) และไม่มีหมวดของหวาน ใช้เป็นตัวชี้วัดคร่าวๆ เท่านั้น ต้องมีชุดที่ label ด้วยมือ (SPEC §9.2) จึงจะสรุปได้",
};
writeFileSync("public/data/bangmod/eval_poi.json", JSON.stringify(result, null, 2) + "\n");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`n=${result.n} · strict rule ${pct(result.rule_accuracy)} vs AI ${pct(result.ai_accuracy)} · lenient rule ${pct(result.rule_accuracy_lenient)} vs AI ${pct(result.ai_accuracy_lenient)} · fixed ${fixed.length} · broke ${broke.length}`);
console.log("AI fixed:", result.examples_fixed.slice(0, 8));
console.log("AI broke:", result.examples_broken.slice(0, 8));
