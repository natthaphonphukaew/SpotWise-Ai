"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { Readout, TopBar } from "@/components/TopBar";
import { BASEMAP_STYLE, hatchImage, restyleBasemap, squareImage } from "@/components/map/basemap";
import { surveyPinElement } from "@/components/map/survey-pin";
import { cssVar } from "@/lib/css-var";
import {
  DATA_BASE,
  GROUPS,
  sourceNames,
  thaiShortDate,
  type Candidate,
  type Manifest,
  type PoiGroup,
  type PoiProps,
} from "@/lib/data/bangmod";
import { countByGroup, findIsochrone, type IsochroneFC, type PoiFC } from "@/lib/geo/catchment";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

type Layers = { population: boolean; context: boolean };
type Data = { poi: PoiFC; iso: IsochroneFC; transit: FeatureCollection<Point> };

const POI_LAYERS =["poi-context", "poi-synergy", "poi-comp-indirect", "poi-comp"];
const COUNT_ROWS: PoiGroup[] = ["bubble_tea", "coffee", "drink_dessert", "education", "dormitory", "office"];

export function MapExplorer({ manifest, candidates }: { manifest: Manifest; candidates: Candidate[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [cand, setCand] = useState(candidates.find((c) => c.id === "B")?.id ?? candidates[0]?.id);
  const [poi, setPoi] = useState<PoiProps | null>(null);
  const [layers, setLayers] = useState<Layers>({ population: true, context: false });
  const [cursor, setCursor] = useState({ lng: manifest.center[0], lat: manifest.center[1], zoom: 15 });

  const hasPopulation = Boolean(manifest.datasets.population);
  const release = manifest.datasets.overture_places?.release as string | undefined;

  // --- map setup (once) ---
  useEffect(() => {
    if (!containerRef.current) return;
    setWorkerUrl("/vendor/maplibre-gl-worker.mjs"); // served by scripts/copy-maplibre-worker.mjs
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: manifest.center,
      zoom: 15,
      minZoom: 13,
      maxBounds: [
        [manifest.bbox[0] - 0.01, manifest.bbox[1] - 0.01],
        [manifest.bbox[2] + 0.01, manifest.bbox[3] + 0.01],
      ],
      attributionControl: { compact: true, customAttribution: "Overture Maps Foundation · WorldPop" },
    });
    mapRef.current = map;
    if (process.env.NODE_ENV === "development") (window as unknown as { __map?: MapLibreMap }).__map = map; // debugging hook
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    const load = (f: string) => fetch(`${DATA_BASE}/${f}`).then((r) => r.json());
    const dataP = Promise.all([load("poi.geojson"), load("isochrones.geojson"), load("transit.geojson")]);

    // style.load (not load): add our layers as soon as the style is parsed, without waiting for every tile.
    map.once("style.load", async () => {
      const [poiFc, isoFc, transitFc] = (await dataP) as [PoiFC, IsochroneFC, FeatureCollection<Point>];
      restyleBasemap(map);

      const ink = cssVar("--color-ink");
      const ink3 = cssVar("--color-ink-3");
      const paper = cssVar("--color-paper");
      const comp = cssVar("--color-comp");
      const accent = cssVar("--color-accent");
      map.addImage("hatch", hatchImage(ink));
      map.addImage("stop", squareImage(cssVar("--color-civic"), paper));

      if (hasPopulation) {
        map.addSource("population", { type: "geojson", data: `${DATA_BASE}/population.geojson` });
        map.addLayer({
          id: "population",
          type: "fill",
          source: "population",
          paint: {
            "fill-color": [
              "interpolate", ["linear"], ["get", "pop"],
              0, cssVar("--color-pop-1"), 60, cssVar("--color-pop-2"), 150, cssVar("--color-pop-3"),
            ],
            "fill-opacity": 0.32,
          },
        });
      }

      map.addSource("iso", { type: "geojson", data: isoFc });
      map.addLayer({ id: "iso-10", type: "line", source: "iso", paint: { "line-color": ink3, "line-width": 1.2, "line-dasharray": [3, 3] } });
      map.addLayer({ id: "iso-5-fill", type: "fill", source: "iso", paint: { "fill-pattern": "hatch" } });
      map.addLayer({ id: "iso-5", type: "line", source: "iso", paint: { "line-color": ink, "line-width": 1.3, "line-dasharray": [4, 3] } });

      map.addSource("transit", { type: "geojson", data: transitFc });
      map.addLayer({ id: "transit", type: "symbol", source: "transit", layout: { "icon-image": "stop", "icon-allow-overlap": true } });

      const groupColor = [
        "match", ["get", "group"],
        ...Object.entries(GROUPS).flatMap(([g, s]) => [g, cssVar(s.color)]),
        ink3,
      ] as unknown as ExpressionSpecification;
      const byRole = (role: string) => ["in", ["get", "group"], ["literal", Object.entries(GROUPS).filter(([, s]) => s.role === role).map(([g]) => g)]] as unknown as ExpressionSpecification;

      map.addSource("poi", { type: "geojson", data: poiFc, promoteId: "id" });
      map.addLayer({ id: "poi-context", type: "circle", source: "poi", filter: byRole("context"),
        paint: { "circle-radius": 2.2, "circle-color": ink3, "circle-opacity": 0.55 } });
      map.addLayer({ id: "poi-synergy", type: "circle", source: "poi", filter: byRole("synergy"),
        paint: { "circle-radius": 4, "circle-color": groupColor, "circle-stroke-color": paper, "circle-stroke-width": 1 } });
      map.addLayer({ id: "poi-comp-indirect", type: "circle", source: "poi", filter: byRole("comp-indirect"),
        paint: { "circle-radius": 4, "circle-color": paper, "circle-stroke-color": comp, "circle-stroke-width": 1.6 } });
      map.addLayer({ id: "poi-comp", type: "circle", source: "poi", filter: byRole("comp"),
        paint: { "circle-radius": 5.5, "circle-color": comp, "circle-stroke-color": paper, "circle-stroke-width": 1.5 } });
      map.addLayer({ id: "poi-selected", type: "circle", source: "poi", filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": 10, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": accent, "circle-stroke-width": 2 } });

      const onClick = (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (f) setPoi(f.properties as PoiProps);
      };
      for (const id of POI_LAYERS) {
        map.on("click", id, onClick);
        map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      }

      setData({ poi: poiFc, iso: isoFc, transit: transitFc });
      setReady(true);
    });

    let raf = 0;
    map.on("mousemove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat, zoom: map.getZoom() }));
    });
    map.on("zoomend", () => setCursor((c) => ({ ...c, zoom: map.getZoom() })));

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      setReady(false); // a re-created map must finish loading before other effects touch it
    };
  }, [manifest, hasPopulation]);

  // --- candidate markers + catchment filter ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = candidates.map((c) => {
      const el = surveyPinElement(c.id, c.id === cand ? "selected" : "default");
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setCand(c.id);
      });
      return new Marker({ element: el, anchor: "bottom-left", offset: [-6, 6] }).setLngLat([c.lon, c.lat]).addTo(map);
    });
    const is = (m: number) => ["all", ["==", ["get", "candidate"], cand ?? ""], ["==", ["get", "minutes"], m]] as unknown as ExpressionSpecification;
    map.setFilter("iso-5", is(5));
    map.setFilter("iso-5-fill", is(5));
    map.setFilter("iso-10", is(10));
  }, [ready, cand, candidates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (hasPopulation) map.setLayoutProperty("population", "visibility", layers.population ? "visible" : "none");
    map.setLayoutProperty("poi-context", "visibility", layers.context ? "visible" : "none");
  }, [ready, layers, hasPopulation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("poi-selected", ["==", ["get", "id"], poi?.id ?? ""]);
  }, [ready, poi]);

  // --- counts inside the selected candidate's catchments (real data, rule-based grouping) ---
  const counts = useMemo(() => {
    if (!data || !cand) return null;
    const five = findIsochrone(data.iso, cand, 5);
    const ten = findIsochrone(data.iso, cand, 10);
    const stops = (area: typeof five) => (area ? data.transit.features.filter((f) => booleanPointInPolygon(f, area)).length : 0);
    return { five: countByGroup(data.poi, five), ten: countByGroup(data.poi, ten), stops5: stops(five), stops10: stops(ten) };
  }, [data, cand]);

  const poiDs = manifest.datasets.poi;
  const selected = candidates.find((c) => c.id === cand);

  return (
    <>
      <TopBar
        right={
          <>
            <Readout k="LAT" v={cursor.lat.toFixed(4)} className="hidden sm:inline" />
            <Readout k="LON" v={cursor.lng.toFixed(4)} className="hidden sm:inline" />
            <Readout k="Z" v={cursor.zoom.toFixed(1)} className="hidden md:inline" />
            {release && <Readout k="OVERTURE" v={release} />}
          </>
        }
      />
      <div className="flex flex-1 flex-col lg:fixed lg:inset-x-0 lg:top-11 lg:bottom-0 lg:grid lg:grid-cols-[400px_1fr] lg:grid-rows-[minmax(0,1fr)]">
        <div className="relative order-1 h-[58dvh] border-b border-ink lg:order-2 lg:h-auto lg:border-b-0">
          <div ref={containerRef} className="h-full w-full" aria-label="แผนที่ย่านบางมด" />
          {!ready && <div className="absolute inset-0 grid place-items-center bg-paper font-mono text-xs text-ink-3">กำลังโหลดแผนที่…</div>}
        </div>

        <aside className="order-2 lg:min-h-0 lg:overflow-y-auto border-ink bg-paper-2 px-4 py-6 sm:px-6 lg:order-1 lg:border-r">
          <div className="label">แผนที่ย่าน · No.001</div>
          <h1 className="mt-1 font-display text-[28px] leading-snug font-semibold">รอบ มจธ. บางมด</h1>
          <p className="mt-2 text-sm text-ink-2">
            เลือกทำเลเพื่อดูว่าในระยะเดินมีอะไรบ้าง คลิกจุดบนแผนที่เพื่อดูที่มาของข้อมูล
          </p>

          <Section title="ทำเลผู้สมัคร">
            <ul className="divide-y divide-rule border-y border-rule">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setCand(c.id);
                      mapRef.current?.flyTo({ center: [c.lon, c.lat], zoom: 16, duration: 1200 });
                    }}
                    className={`flex w-full items-baseline gap-3 py-2.5 text-left ${c.id === cand ? "" : "text-ink-2 hover:text-ink"}`}
                    aria-pressed={c.id === cand}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center font-mono text-[11px] font-semibold ${c.id === cand ? "bg-accent text-ink" : "bg-ink text-paper"}`}>
                      {c.id}
                    </span>
                    <span className="min-w-0 text-[15px] leading-snug">
                      {c.label}
                      {c.placeholder && <span className="mt-0.5 block font-mono text-[11px] text-ink-3">ตัวอย่าง · ยังไม่ได้สำรวจจริง</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`ในระยะเดิน · ทำเล ${selected?.id ?? ""}`}>
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-ink">
                  <th className="py-1.5 text-left font-medium" />
                  <th className="py-1.5 text-right font-mono text-[11px] font-normal text-ink-3">5 นาที</th>
                  <th className="py-1.5 text-right font-mono text-[11px] font-normal text-ink-3">10 นาที</th>
                </tr>
              </thead>
              <tbody>
                {COUNT_ROWS.map((g) => (
                  <tr key={g} className="border-b border-rule">
                    <td className="py-1.5">
                      <Swatch group={g} /> {GROUPS[g].label}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{counts ? (counts.five[g] ?? 0) : "–"}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-ink-2">{counts ? (counts.ten[g] ?? 0) : "–"}</td>
                  </tr>
                ))}
                <tr className="border-b border-rule">
                  <td className="py-1.5">
                    <span className="mr-2 inline-block h-2.5 w-2.5 bg-civic align-middle" /> ป้ายรถ/วิน
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{counts ? counts.stops5 : "–"}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-ink-2">{counts ? counts.stops10 : "–"}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">
              นับจากข้อมูลเปิด {poiDs ? `(${sourceNames(manifest, poiDs)} · ${thaiShortDate(poiDs.fetched)})` : ""} จัดกลุ่มด้วยกฎเบื้องต้น ยังไม่ผ่าน AI ·
              พื้นที่เดินถึงเป็น<span className="font-medium text-ink-2">ค่าประมาณ</span> (เดิน 75 ม./นาที ตามเครือข่ายทางเดิน OSM)
            </p>
          </Section>

          {poi && <Evidence poi={poi} manifest={manifest} onClose={() => setPoi(null)} />}

          <Section title="ชั้นข้อมูล">
            <div className="space-y-1.5 text-[15px]">
              {hasPopulation && (
                <Toggle checked={layers.population} onChange={(v) => setLayers((l) => ({ ...l, population: v }))}>
                  ประชากรต่อกริด 100 ม. <span className="font-mono text-[11px] text-ink-3">WORLDPOP</span>
                </Toggle>
              )}
              <Toggle checked={layers.context} onChange={(v) => setLayers((l) => ({ ...l, context: v }))}>
                สถานที่อื่นๆ (ร้านอาหาร ร้านค้า ฯลฯ)
              </Toggle>
            </div>
          </Section>

          <Section title="สัญลักษณ์">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-comp align-middle" />คู่แข่งตรง</li>
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full border-[1.6px] border-comp align-middle" />คู่แข่งอ้อม</li>
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-edu align-middle" />สถานศึกษา</li>
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-pop-2 align-middle" />หอพัก/ที่พัก</li>
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-civic align-middle" />สำนักงาน</li>
              <li><span className="mr-2 inline-block h-2.5 w-2.5 bg-civic align-middle" />ป้ายรถ/วิน</li>
              <li className="col-span-2">
                <span className="hatch mr-2 inline-block h-2.5 w-6 border border-dashed border-ink align-middle text-ink/40" />
                เดินถึงใน 5 นาที (ประมาณ) · เส้นประจาง = 10 นาที
              </li>
            </ul>
          </Section>

          <Sources manifest={manifest} />
        </aside>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="label mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ group }: { group: PoiGroup }) {
  const s = GROUPS[group];
  const cls =
    s.role === "comp" ? "bg-comp" :
    s.role === "comp-indirect" ? "border-[1.6px] border-comp" :
    group === "education" ? "bg-edu" : group === "dormitory" ? "bg-pop-2" : "bg-civic";
  return <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle ${cls}`} />;
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-ink" />
      <span>{children}</span>
    </label>
  );
}

function Evidence({ poi, manifest, onClose }: { poi: PoiProps; manifest: Manifest; onClose: () => void }) {
  const src = manifest.sources[poi.source];
  const ds = manifest.datasets.poi;
  const rows: [string, React.ReactNode][] = [
    ["ชื่อ", poi.name + (poi.name_en ? ` · ${poi.name_en}` : "")],
    ["กลุ่ม", `${GROUPS[poi.group]?.label ?? poi.group} (กฎเบื้องต้น)`],
    ["หมวดดิบ", <span key="c" className="font-mono text-[13px]">{poi.category ?? "—"}</span>],
    ["แหล่ง", src?.name ?? poi.source],
    ["ความมั่นใจ", poi.confidence != null ? <span key="k" className="font-mono text-[13px]">{Math.round(poi.confidence * 100)}% (คะแนนของ Overture)</span> : "—"],
    ["ดึงข้อมูล", <span key="d" className="font-mono text-[13px]">{ds ? thaiShortDate(ds.fetched) : "—"}</span>],
    ["License", <span key="l" className="font-mono text-[13px]">{src?.license ?? "—"}</span>],
    ["ข้อจำกัด", <span key="x" className="text-ink-2">{src?.limits}</span>],
  ];
  return (
    <section className="mt-7 rounded-sm border border-ink bg-sheet">
      <div className="flex items-center justify-between border-b border-rule px-3.5 py-2">
        <span className="label">Evidence · สถานที่ที่เลือก</span>
        <button onClick={onClose} className="font-mono text-[11px] text-ink-3 hover:text-ink">ปิด</button>
      </div>
      <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 px-3.5 py-3 text-sm leading-normal">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="pt-0.5 font-mono text-[11px] text-ink-3 uppercase">{k}</dt>
            <dd className="m-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Sources({ manifest }: { manifest: Manifest }) {
  return (
    <section className="mt-8 border-t border-ink pt-3">
      <h2 className="label mb-2">แหล่งข้อมูล</h2>
      <ol className="space-y-1.5 text-xs leading-relaxed text-ink-2">
        {Object.entries(manifest.sources).map(([id, s], i) => (
          <li key={id}>
            <span className="font-mono text-ink-3">[{i + 1}]</span>{" "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-2 hover:decoration-ink">
              {s.name}
            </a>{" "}
            · <span className="font-mono">{s.license}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
