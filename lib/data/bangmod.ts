/** Types and labels for the static Bangmod dataset produced by data-pipeline/. */

export const DATA_BASE = "/data/bangmod";

export type PoiGroup =
  | "bubble_tea"
  | "coffee"
  | "drink_dessert"
  | "food"
  | "convenience"
  | "education"
  | "dormitory"
  | "market"
  | "office"
  | "health"
  | "leisure"
  | "retail"
  | "other";

export type PoiProps = {
  id: string;
  name: string;
  name_en: string | null;
  group: PoiGroup;
  category: string | null;
  brand: string | null;
  confidence: number | null;
  opening_hours: string | null;
  source: "overture" | "osm";
  osm_ref: string | null;
  verification: Verification;
  in_campus: boolean;
  name_issue: "vowels_missing" | null;
};

/** How a place's existence/location was corroborated (set by data-pipeline/s05_merge_poi.py). */
export type Verification = "curated" | "osm" | "multi_source" | "local_name" | "unverified";

export const VERIFICATION: Record<Verification, { label: string; note: string }> = {
  curated: { label: "คัดกรองแล้ว", note: "อยู่ในรายชื่อร้าน CampusSpot ที่คัดด้วยมือ" },
  osm: { label: "ยืนยันจาก OSM", note: "มีใน OpenStreetMap ซึ่งอาสาสมัครปักหมุดเอง" },
  multi_source: { label: "พบหลายแหล่ง", note: "Overture รวมจากแหล่งอื่นนอกจาก Facebook ด้วย" },
  local_name: { label: "ชื่อระบุย่านนี้", note: "ชื่อสถานที่อ้างถึงบางมด/มจธ./ประชาอุทิศ ฯลฯ" },
  unverified: { label: "ยังไม่ยืนยัน", note: "มาจากเพจ Facebook ผ่าน Overture แหล่งเดียว พิกัดอาจคลาดเคลื่อน" },
};

export type SourceInfo = { name: string; url: string; license: string; limits: string };

export type DatasetInfo = {
  file: string;
  source: string | string[];
  fetched: string;
  count: number;
  [extra: string]: unknown;
};

export type Manifest = {
  area: string;
  center: [number, number];
  bbox: [number, number, number, number];
  datasets: Record<string, DatasetInfo>;
  sources: Record<string, SourceInfo>;
};

export type Candidate = {
  id: string;
  label: string;
  lon: number;
  lat: number;
  rent_thb: number | null;
  placeholder?: boolean;
};

/** Thai label + token used to colour each group on the map. Order = legend order. */
export const GROUPS: Record<PoiGroup, { label: string; color: string; role: "comp" | "comp-indirect" | "synergy" | "context" }> = {
  bubble_tea: { label: "ร้านชาไข่มุก", color: "--color-comp", role: "comp" },
  coffee: { label: "ร้านกาแฟ", color: "--color-comp", role: "comp-indirect" },
  drink_dessert: { label: "เครื่องดื่ม/ของหวาน", color: "--color-comp", role: "comp-indirect" },
  education: { label: "สถานศึกษา", color: "--color-edu", role: "synergy" },
  dormitory: { label: "หอพัก/ที่พัก", color: "--color-pop-2", role: "synergy" },
  office: { label: "สำนักงาน", color: "--color-civic", role: "synergy" },
  market: { label: "ตลาด", color: "--color-pop-3", role: "synergy" },
  food: { label: "ร้านอาหาร", color: "--color-ink-3", role: "context" },
  convenience: { label: "ร้านสะดวกซื้อ", color: "--color-ink-3", role: "context" },
  health: { label: "สุขภาพ", color: "--color-ink-3", role: "context" },
  leisure: { label: "สวน/กีฬา", color: "--color-park", role: "context" },
  retail: { label: "ร้านค้าอื่น", color: "--color-ink-3", role: "context" },
  other: { label: "อื่นๆ", color: "--color-ink-3", role: "context" },
};

export function sourceNames(manifest: Manifest, ds: DatasetInfo): string {
  const ids = Array.isArray(ds.source) ? ds.source : [ds.source];
  return ids.map((id) => manifest.sources[id]?.name ?? id).join(" + ");
}

/** "2026-10-17" → "17.10.69" (Thai Buddhist-era short date, as in the style tile). */
export function thaiShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${String((y + 543) % 100).padStart(2, "0")}`;
}
