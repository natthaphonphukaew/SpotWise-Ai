/**
 * Re-classify POIs near KMUTT with the LLM (POI Relevance Classifier, SPEC §2 #2).
 *
 *   npm run classify:poi
 *
 * Batches go through runTask(), so every batch is cached in llm-cache/poi-classify/ and a
 * re-run only calls the API for batches whose input changed. Output: public/data/bangmod/poi_ai.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { FeatureCollection, Point } from "geojson";
import { llmConfig, runTask } from "@/lib/llm";
import { POI_BATCH_SIZE, poiClassifyTask, type PoiInput, type PoiLabels } from "@/lib/llm/tasks/poi-classify";
import type { PoiProps } from "@/lib/data/bangmod";

const CENTER: [number, number] = [100.4941, 13.6513]; // KMUTT, same as data-pipeline/reference
const RADIUS_M = 1500;
const POI_FILE = "public/data/bangmod/poi.geojson";
const OUT_FILE = "public/data/bangmod/poi_ai.json";
const PAUSE_MS = 4000; // stay well under the free-tier requests/minute

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function metres([lon1, lat1]: number[], [lon2, lat2]: number[]): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const retryable = (e: unknown) => /429|RESOURCE_EXHAUSTED|UNAVAILABLE|503|overloaded/i.test(String(e));
// Free tier also has a per-day cap (20 requests/model/day for gemini-3.8-flash in Oct 2026): waiting won't help.
const dailyQuota = (e: unknown) => /PerDay/i.test(String(e));

async function classify(batch: PoiInput[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runTask(poiClassifyTask(batch));
    } catch (e) {
      if (!retryable(e) || dailyQuota(e) || attempt >= 3) throw e;
      const wait = 20000 * (attempt + 1);
      console.log(`  rate-limited, waiting ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
}

async function main() {
  const cfg = llmConfig();
  const fc = JSON.parse(readFileSync(POI_FILE, "utf8")) as FeatureCollection<Point, PoiProps>;
  const inputs: PoiInput[] = fc.features
    .filter((f) => metres(f.geometry.coordinates, CENTER) <= RADIUS_M)
    .map((f) => ({ id: f.properties.id, name: f.properties.name, category: f.properties.category, group: f.properties.group }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const all: PoiInput[][] = [];
  for (let i = 0; i < inputs.length; i += POI_BATCH_SIZE) all.push(inputs.slice(i, i + POI_BATCH_SIZE));
  // --limit N: try the first N batches only (check quality before spending the quota)
  const limitArg = process.argv.indexOf("--limit");
  const batches = limitArg > 0 ? all.slice(0, Number(process.argv[limitArg + 1])) : all;
  if (batches.length < all.length) console.log(`--limit: running ${batches.length} of ${all.length} batches, not writing ${OUT_FILE}`);
  console.log(`${inputs.length} places within ${RADIUS_M} m → ${batches.length} batches · mode=${cfg.mode} model=${cfg.model}`);

  const labels: Record<string, { g: string; c: string; r: string }> = {};
  let calls = 0;
  let done = 0;
  let stopped: string | null = null;
  for (const [i, batch] of batches.entries()) {
    let result;
    try {
      result = await classify(batch);
    } catch (e) {
      if (!dailyQuota(e)) throw e;
      stopped = "daily free-tier quota reached";
      console.log(`batch ${i + 1}/${batches.length}: stopped — ${stopped}. Re-run tomorrow; finished batches come from cache.`);
      break;
    }
    const { data, meta } = result;
    done++;
    for (const it of (data as PoiLabels).items) labels[it.id] = { g: it.group, c: it.confidence, r: it.reason };
    const missing = batch.length - (data as PoiLabels).items.length;
    console.log(`batch ${i + 1}/${batches.length}: ${meta.cached ? "cache" : "live"}${missing ? ` · ${missing} unlabeled` : ""}`);
    if (!meta.cached) {
      calls++;
      if (i < batches.length - 1) await sleep(PAUSE_MS);
    }
  }

  const changed = inputs.filter((p) => labels[p.id] && labels[p.id].g !== p.group).length;
  if (batches.length < all.length) {
    const sample = inputs.filter((p) => labels[p.id] && labels[p.id].g !== p.group).slice(0, 40);
    for (const p of sample) console.log(`  ${p.group} → ${labels[p.id].g} (${labels[p.id].c}) ${p.name} · ${labels[p.id].r}`);
    console.log(`${changed} changed in ${Object.keys(labels).length} labeled`);
    return;
  }
  writeFileSync(
    OUT_FILE,
    JSON.stringify({
      task: "poi-classify",
      model: cfg.model,
      created: new Date().toISOString(),
      center: CENTER,
      radius_m: RADIUS_M,
      count: Object.keys(labels).length,
      total: inputs.length,
      complete: done === all.length,
      batches_done: done,
      batches_total: all.length,
      changed,
      items: labels,
    }) + "\n",
  );
  if (stopped) console.log(`PARTIAL: ${done}/${all.length} batches (${stopped})`);
  console.log(`wrote: ${Object.keys(labels).length}/${inputs.length} labeled · ${changed} changed group · ${calls} live calls → ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
