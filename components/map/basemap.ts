import type { Map as MapLibreMap } from "maplibre-gl";
import { cssVar } from "@/lib/css-var";

export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/** Recolour OpenFreeMap Positron to the paper & ink palette (docs/DESIGN.md §7). */
export function restyleBasemap(map: MapLibreMap) {
  const paper = cssVar("--color-paper");
  const paper2 = cssVar("--color-paper-2");
  const road = cssVar("--color-road");
  const road2 = cssVar("--color-road-2");
  const water = cssVar("--color-water");
  const park = cssVar("--color-park");
  const ink2 = cssVar("--color-ink-2");
  const ink3 = cssVar("--color-ink-3");

  for (const layer of map.getStyle().layers) {
    const { id, type } = layer;
    if (type === "background") map.setPaintProperty(id, "background-color", paper);
    else if (id === "water") map.setPaintProperty(id, "fill-color", water);
    else if (id === "waterway") map.setPaintProperty(id, "line-color", water);
    else if (id === "park") {
      map.setPaintProperty(id, "fill-color", park);
      map.setPaintProperty(id, "fill-opacity", 0.25);
    } else if (id.startsWith("landuse") || id.startsWith("landcover")) map.setPaintProperty(id, "fill-color", paper2);
    else if (id === "building") {
      map.setPaintProperty(id, "fill-color", paper);
      map.setPaintProperty(id, "fill-outline-color", road2);
    } else if (type === "line" && id.startsWith("highway")) {
      const major = id.includes("major") || id.includes("motorway");
      map.setPaintProperty(id, "line-color", id.includes("casing") ? road2 : major ? road2 : road);
    } else if (type === "line" && id.startsWith("railway")) map.setPaintProperty(id, "line-color", ink3);
    else if (type === "line" && id.startsWith("boundary")) map.setLayoutProperty(id, "visibility", "none");
    else if (type === "symbol") {
      // Keep only road and water names; our own Thai labels are drawn as HTML (MapLibre Thai shaping is unreliable).
      const keep = id.startsWith("highway-name") || id.startsWith("water_name") || id === "waterway_line_label";
      if (!keep) map.setLayoutProperty(id, "visibility", "none");
      else {
        // One label per road (Thai when available) instead of Positron's "latin + nonlatin" pair.
        map.setLayoutProperty(id, "text-field", ["coalesce", ["get", "name:th"], ["get", "name"]]);
        map.setPaintProperty(id, "text-color", ink2);
        map.setPaintProperty(id, "text-halo-color", paper);
      }
    }
  }
}

/** Diagonal hatch tile for "estimated" areas (catchments). */
export function hatchImage(color: string, size = 8): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-size / 2, size / 2);
  ctx.lineTo(size / 2, -size / 2);
  ctx.moveTo(size / 2, size * 1.5);
  ctx.lineTo(size * 1.5, size / 2);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/** Small filled square icon (transit stops, per the style tile legend). */
export function squareImage(fill: string, stroke: string, size = 12): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = stroke;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fill;
  ctx.fillRect(2, 2, size - 4, size - 4);
  return ctx.getImageData(0, 0, size, size);
}
