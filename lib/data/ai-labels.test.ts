import { describe, expect, it } from "vitest";
import type { FeatureCollection, Point } from "geojson";
import { applyAiLabels } from "./ai-labels";
import type { PoiAiFile, PoiProps } from "./bangmod";

const poi = (id: string, group: PoiProps["group"]): FeatureCollection<Point, PoiProps>["features"][number] => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [100.49, 13.65] },
  properties: {
    id, name: id, name_en: null, group, category: null, brand: null, confidence: null, opening_hours: null,
    source: "overture", osm_ref: null, verification: "unverified", in_campus: false, name_issue: null,
  },
});

const fc: FeatureCollection<Point, PoiProps> = { type: "FeatureCollection", features: [poi("a", "coffee"), poi("b", "food")] };
const ai: PoiAiFile = {
  task: "poi-classify", model: "m", created: "", center: [0, 0], radius_m: 1500, count: 1, total: 2,
  complete: false, batches_done: 1, batches_total: 2, changed: 1,
  items: { a: { g: "bubble_tea", c: "high", r: "ชื่อบอกว่าชานม" } },
};

describe("applyAiLabels", () => {
  it("replaces the group and keeps the rule group as evidence", () => {
    const [a, b] = applyAiLabels(fc, ai).features;
    expect(a.properties).toMatchObject({ group: "bubble_tea", rule_group: "coffee", group_source: "ai", ai_confidence: "high" });
    expect(b.properties).toMatchObject({ group: "food", group_source: "rule" });
  });

  it("does not mutate the input", () => {
    applyAiLabels(fc, ai);
    expect(fc.features[0].properties.group).toBe("coffee");
  });

  it("works without an AI file", () => {
    expect(applyAiLabels(fc, null).features.every((f) => f.properties.group_source === "rule")).toBe(true);
  });
});
