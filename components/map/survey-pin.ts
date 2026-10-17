import { cssVar } from "@/lib/css-var";

export type PinState = "default" | "selected" | "draft";

/** Survey-stake marker (see docs/design/style-tile.html §05) as a DOM element for maplibregl.Marker. */
export function surveyPinElement(letter: string, state: PinState = "default"): HTMLDivElement {
  const ink = cssVar("--color-ink");
  const paper = cssVar("--color-paper");
  const accent = cssVar("--color-accent");
  const flag = state === "selected" ? accent : state === "draft" ? paper : ink;
  const text = state === "default" ? paper : ink;

  const el = document.createElement("div");
  el.style.cursor = "pointer";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `ทำเล ${letter}`);
  el.innerHTML = `
    <svg width="34" height="48" viewBox="-6 -42 34 48" style="display:block;overflow:visible">
      ${state === "selected" ? `<circle cx="0" cy="0" r="7" fill="none" stroke="${accent}" stroke-width="1.2"/>` : ""}
      <ellipse cx="0" cy="0" rx="4" ry="1.6" fill="${ink}" opacity=".25"/>
      <line x1="0" y1="0" x2="0" y2="-38" stroke="${ink}" stroke-width="1.6" ${state === "draft" ? 'stroke-dasharray="3 2"' : ""}/>
      <rect x="0.8" y="-37.2" width="20.4" height="16.4" fill="${flag}" stroke="${state === "draft" ? ink : flag}" stroke-width="1.6"/>
      <text x="11" y="-25.5" text-anchor="middle" font-family="var(--font-mono)" font-size="11" font-weight="600" fill="${text}">${letter}</text>
    </svg>`;
  return el;
}
