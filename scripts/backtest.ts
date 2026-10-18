/**
 * Chain backtest (SPEC §9.5): do branches that chain brands chose score higher than ordinary
 * locations? Chains pick sites with professional analysis, so a useful score should rank their
 * branches above (a) random points and (b) ordinary shops nearby. Reported as AUC.
 *
 *   npm run backtest  →  public/data/bangmod/backtest.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import { applyAiLabels } from "@/lib/data/ai-labels";
import type { PoiAiFile, PoiGroup, PoiProps } from "@/lib/data/bangmod";
import { campusDemand, demandCells, type PopulationFC } from "@/lib/geo/site";
import { gridAround, pointInputs, prepareContext } from "@/lib/geo/spot";
import { rolesFor, type Role } from "@/lib/profile/schema";
import { distanceM, type LngLat } from "@/lib/scoring/huff";
import { DEFAULT_ASSUMPTIONS, scoreSite } from "@/lib/scoring/locscore";

const D = "public/data/bangmod";
const j = <T>(f: string) => JSON.parse(readFileSync(`${D}/${f}`, "utf8")) as T;
const CENTER: LngLat = [100.4943, 13.6512];
const RADIUS_M = 2000;
const WEIGHTS = { target: 25, access: 20, market: 20, rent: 20, synergy: 15 };

const CHAINS = {
  bubble_tea:
    /mixue|มี่เสวี่ย|ตรามือ|maru-?\s?cha|มารุชา|ชาพะยอม|cha ?payom|koi th|tiger sugar|เสือพ่นไฟ|fire ?bear|หมีพ่นไฟ|nobicha|โนบิชา|ชานม ?วาฬ|whale milk|jian ?cha|เจี้ยนชา|chic ?cha|ชิคชา/i,
  coffee: /amazon|อเมซอน|starbucks|สตาร์บัค|inthanin|อินทนิล|punthai|พันธุ์ไทย|mezzo|black ?canyon|ชาวดอย|ดอยช้าง/i,
};
const NOT_A_BRANCH = /หน้าร้าน|กวดวิชา|โรงเรียน/;

function auc(pos: number[], neg: number[]) {
  let s = 0;
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

const raw = j<FeatureCollection<Point, PoiProps>>("poi.geojson");
const poi = applyAiLabels(raw, j<PoiAiFile>("poi_ai.json"));
const campus = j<FeatureCollection>("campus.geojson");
const cells = demandCells(j<PopulationFC>("population.geojson"));
const transit = j<FeatureCollection<Point>>("transit.geojson");
const extra = campusDemand(campus, DEFAULT_ASSUMPTIONS.campusStudents * DEFAULT_ASSUMPTIONS.campusPresence);
const onCampus = (p: LngLat) =>
  campus.features.some((f) => booleanPointInPolygon(p, f as Feature<Polygon | MultiPolygon>));
const near = (p: LngLat) => distanceM(CENTER, p) <= RADIUS_M;

const results: Record<string, unknown> = {};
for (const [kind, re] of Object.entries(CHAINS) as [keyof typeof CHAINS, RegExp][]) {
  // Roles as the business itself would see them.
  const roles: Record<PoiGroup, Role> = rolesFor(null);
  if (kind === "coffee") {
    roles.coffee = "comp";
    roles.bubble_tea = "comp-indirect";
  }
  const ctx = prepareContext({ poi, transit, cells }, roles, extra);

  // Branches: chain names, deduplicated within 80 m (the same branch is often listed twice).
  const branches: { name: string; at: LngLat; idx: number }[] = [];
  poi.features.forEach((f, idx) => {
    const at = f.geometry.coordinates as LngLat;
    const n = f.properties.name ?? "";
    if (!re.test(n) || NOT_A_BRANCH.test(n) || !near(at)) return;
    if (branches.some((b) => distanceM(b.at, at) < 80)) return;
    branches.push({ name: n, at, idx });
  });
  const scoreAt = (at: LngLat, exclude = new Set<number>()) =>
    scoreSite(pointInputs(at, ctx, exclude), WEIGHTS).total ?? 0;

  const chain = branches.map((b) => {
    // Drop the branch itself (and duplicate pins of it) so it does not compete with itself.
    const self = new Set(
      poi.features.flatMap((f, i) =>
        re.test(f.properties.name ?? "") && distanceM(b.at, f.geometry.coordinates as LngLat) < 80 ? [i] : [],
      ),
    );
    return { name: b.name, at: b.at, score: scoreAt(b.at, self) };
  });
  const randomPts = gridAround(CENTER, RADIUS_M, 120)
    .filter((p) => !onCampus(p))
    .map((p) => scoreAt(p));
  const shops = poi.features
    .filter(
      (f) =>
        ["food", "retail", "convenience"].includes(f.properties.group) &&
        !CHAINS.bubble_tea.test(f.properties.name ?? "") &&
        !CHAINS.coffee.test(f.properties.name ?? ""),
    )
    .map((f) => f.geometry.coordinates as LngLat)
    .filter((p) => near(p) && !onCampus(p))
    .map((p) => scoreAt(p));

  const cs = chain.map((c) => c.score);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  results[kind] = {
    branches: chain.length,
    auc_vs_random_points: Number(auc(cs, randomPts).toFixed(3)),
    auc_vs_ordinary_shops: Number(auc(cs, shops).toFixed(3)),
    mean_score: {
      chains: Number(mean(cs).toFixed(1)),
      random_points: Number(mean(randomPts).toFixed(1)),
      ordinary_shops: Number(mean(shops).toFixed(1)),
    },
    n_random_points: randomPts.length,
    n_ordinary_shops: shops.length,
    chain_scores: chain.map((c) => ({
      name: c.name,
      score: c.score,
      lat: Number(c.at[1].toFixed(5)),
      lon: Number(c.at[0].toFixed(5)),
    })),
  };
  const r = results[kind] as { auc_vs_random_points: number; auc_vs_ordinary_shops: number };
  console.log(
    `${kind}: ${chain.length} branches · AUC vs random ${r.auc_vs_random_points} · vs shops ${r.auc_vs_ordinary_shops}`,
  );
}

writeFileSync(
  `${D}/backtest.json`,
  JSON.stringify(
    {
      created: new Date().toISOString(),
      radius_m: RADIUS_M,
      method:
        "Loc-Score (ไม่รวมค่าเช่า) ที่ตำแหน่งสาขาเชน เทียบกับจุดสุ่มแบบกริด 120 ม. และร้านทั่วไป (อาหาร/ค้าปลีก) ในรัศมี 2 กม. นอกรั้ว มจธ. · AUC = โอกาสที่สาขาเชนได้คะแนนสูงกว่าจุดเปรียบเทียบ (0.5 = เดาสุ่ม)",
      caveats: [
        `สาขาน้อย (ชาไข่มุก ${(results.bubble_tea as { branches: number }).branches} · กาแฟ ${(results.coffee as { branches: number }).branches} สาขา) ผลแกว่งได้มาก`,
        "Café Amazon/พันธุ์ไทย หลายสาขาอยู่ในปั๊มน้ำมัน ซึ่งเลือกตามรถยนต์ ไม่ใช่คนเดินเท้าแบบที่ Loc-Score วัด",
        "ตำแหน่งสาขามาจากข้อมูลเปิด (ส่วนใหญ่เพจ Facebook) อาจคลาดเคลื่อน",
        "ใช้ระยะเส้นตรงแทนทางเดินจริง",
      ],
      ...results,
    },
    null,
    2,
  ) + "\n",
);
