/**
 * Huff gravity model (SPEC §4): the probability that people in a population cell choose our
 * shop over nearby competitors, P = (A / d^λ) / Σ_k (A_k / d^λ). Pure and unit-free except metres.
 */

export type LngLat = [number, number];
export type DemandCell = { at: LngLat; pop: number };
export type Store = { at: LngLat; attractiveness: number };

export type HuffParams = {
  /** distance-decay exponent (2 = classic gravity) */
  lambda: number;
  /** only cells within this radius of the candidate count as demand */
  radiusM: number;
  /** distances below this are clamped (avoid division by ~0 for stores in the same cell) */
  minDistM: number;
};

export const DEFAULT_HUFF: HuffParams = { lambda: 2, radiusM: 1500, minDistM: 50 };

/** Planar metres between two lon/lat points (equirectangular; fine at neighbourhood scale). */
export function distanceM(a: LngLat, b: LngLat): number {
  const latRad = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const dx = (b[0] - a[0]) * 111_320 * Math.cos(latRad);
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}

export type HuffResult = {
  /** Σ pop × P(candidate) — people in reach expected to choose us over competitors */
  capturedPop: number;
  /** Σ pop of cells in the radius */
  reachPop: number;
  /** capturedPop / reachPop: our expected share of the category in the area */
  share: number;
};

const pull = (from: LngLat, to: LngLat, a: number, p: HuffParams) => a / Math.max(p.minDistM, distanceM(from, to)) ** p.lambda;

/**
 * Σ competitor pull felt in each demand cell. It does not depend on the candidate, so scoring many
 * candidates (Spot Finder grid, backtest) computes it once: O(cells × competitors) instead of per point.
 */
export function competitorPull(cells: DemandCell[], competitors: Store[], p: HuffParams = DEFAULT_HUFF): Float64Array {
  const out = new Float64Array(cells.length);
  cells.forEach((cell, i) => {
    let s = 0;
    for (const c of competitors) s += pull(cell.at, c.at, c.attractiveness, p);
    out[i] = s;
  });
  return out;
}

export function huffWithPull(candidate: LngLat, cells: DemandCell[], compPull: Float64Array, p: HuffParams = DEFAULT_HUFF): HuffResult {
  let captured = 0;
  let reach = 0;
  cells.forEach((cell, i) => {
    if (cell.pop <= 0 || distanceM(candidate, cell.at) > p.radiusM) return;
    const ours = pull(cell.at, candidate, 1, p);
    captured += cell.pop * (ours / (ours + compPull[i]));
    reach += cell.pop;
  });
  return { capturedPop: captured, reachPop: reach, share: reach > 0 ? captured / reach : 0 };
}

export function huff(candidate: LngLat, cells: DemandCell[], competitors: Store[], p: HuffParams = DEFAULT_HUFF): HuffResult {
  return huffWithPull(candidate, cells, competitorPull(cells, competitors, p), p);
}
