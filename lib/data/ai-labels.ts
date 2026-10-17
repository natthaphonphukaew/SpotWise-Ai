import type { FeatureCollection, Point } from "geojson";
import type { PoiAiFile, PoiProps } from "./bangmod";

/**
 * Overlay LLM group labels on the rule-based groups. Pure: returns a new collection.
 * Every feature records where its group came from so the evidence panel can show it.
 */
export function applyAiLabels(
  fc: FeatureCollection<Point, PoiProps>,
  ai: PoiAiFile | null,
): FeatureCollection<Point, PoiProps> {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const label = ai?.items[f.properties.id];
      if (!label) return { ...f, properties: { ...f.properties, group_source: "rule" } };
      return {
        ...f,
        properties: {
          ...f.properties,
          group: label.g,
          rule_group: f.properties.group,
          group_source: "ai",
          ai_confidence: label.c,
          ai_reason: label.r,
        },
      };
    }),
  };
}
