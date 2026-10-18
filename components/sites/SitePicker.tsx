"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { useEffect, useRef, useState } from "react";
import { BASEMAP_STYLE, restyleBasemap } from "@/components/map/basemap";
import { surveyPinElement } from "@/components/map/survey-pin";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cssVar } from "@/lib/css-var";
import { DATA_BASE, type Candidate } from "@/lib/data/bangmod";
import type { LngLat } from "@/lib/scoring/huff";
import { addPin, checkPin, circle, MAX_SITES, PIN_RADIUS_M, removePin, toggleSite, type PinCheck } from "@/lib/sites/sites";
import { saveSites, useSites } from "@/lib/sites/store";

const MAX_PINS = 9; // keeps pin ids to two characters on the survey flag

type Draft = { at: LngLat; check: PinCheck };

/** SPEC §7 Setup: choose up to 3 sites from the surveyed list, or pin your own on the map. */
export function SitePicker({ candidates, center }: { candidates: Candidate[]; center: LngLat }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const campusRef = useRef<FeatureCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [name, setName] = useState("");
  const { state, sites, all } = useSites(candidates);
  const chosen = new Set(sites.map((s) => s.id));
  const full = sites.length >= MAX_SITES;

  // --- map (once) ---
  useEffect(() => {
    if (!containerRef.current) return;
    setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center,
      zoom: 14.2,
      minZoom: 13,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const campusP = fetch(`${DATA_BASE}/campus.geojson`)
      .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
      .catch(() => null);

    map.once("style.load", async () => {
      restyleBasemap(map);
      const ink3 = cssVar("--color-ink-3");
      const edu = cssVar("--color-edu");
      map.addSource("area", { type: "geojson", data: { type: "Feature", properties: {}, geometry: circle(center, PIN_RADIUS_M) } });
      map.addLayer({ id: "area", type: "line", source: "area", paint: { "line-color": ink3, "line-width": 1.2, "line-dasharray": [3, 3] } });
      const campus = await campusP;
      campusRef.current = campus;
      map.addSource("campus", { type: "geojson", data: campus ?? { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "campus-fill", type: "fill", source: "campus", paint: { "fill-color": edu, "fill-opacity": 0.1 } });
      map.addLayer({ id: "campus-line", type: "line", source: "campus", paint: { "line-color": edu, "line-width": 1.2 } });
      map.addSource("draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "draft-10", type: "line", source: "draft", paint: { "line-color": ink3, "line-width": 1, "line-dasharray": [2, 2] } });
      setReady(true);
    });

    map.on("click", (e) => {
      const at: LngLat = [e.lngLat.lng, e.lngLat.lat];
      setDraft({ at, check: checkPin(at, center, campusRef.current ?? { type: "FeatureCollection", features: [] }) });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [center]);

  // --- markers: chosen sites solid, the rest dashed, the pin being placed in accent ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    const marks = all.map((c) => {
      const el = surveyPinElement(c.id, chosen.has(c.id) ? "default" : "draft");
      el.title = c.label;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        saveSites(toggleSite(candidates, state, c.id));
      });
      return new Marker({ element: el, anchor: "bottom-left", offset: [-6, 6] }).setLngLat([c.lon, c.lat]).addTo(map);
    });
    if (draft) {
      const el = surveyPinElement("+", "selected");
      marks.push(new Marker({ element: el, anchor: "bottom-left", offset: [-6, 6] }).setLngLat(draft.at).addTo(map));
    }
    markersRef.current = marks;
    (map.getSource("draft") as GeoJSONSource | undefined)?.setData(
      draft?.check.ok
        ? { type: "Feature", properties: {}, geometry: circle(draft.at, 600) }
        : { type: "FeatureCollection", features: [] },
    );
    // `chosen` is derived from `sites`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, all, sites, draft, candidates, state]);

  const placePin = () => {
    if (!draft?.check.ok) return;
    saveSites(addPin(candidates, state, draft.at, name));
    setDraft(null);
    setName("");
  };

  return (
    <section className="mt-16 border-t border-ink pt-4">
      <div className="label">ขั้นที่ 2 · ทำเลที่จะเทียบ</div>
      <h2 className="mt-2 font-display text-[28px] leading-snug font-semibold">เลือกหรือปักทำเล สูงสุด {MAX_SITES} จุด</h2>
      <p className="mt-2 max-w-[70ch] text-sm text-ink-2">
        คลิกหมุดเพื่อเพิ่มหรือถอดออกจากการเทียบ · คลิกที่ว่างบนแผนที่เพื่อปักทำเลของคุณเอง (ภายในเส้นประ รัศมี 2 กม. รอบ มจธ. นอกรั้วมหาลัย)
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="relative h-[420px] overflow-hidden rounded-sm border border-ink">
          <div ref={containerRef} className="h-full w-full" aria-label="แผนที่สำหรับเลือกทำเล" />
          {!ready && <div className="absolute inset-0 grid place-items-center bg-paper font-mono text-xs text-ink-3">กำลังโหลดแผนที่…</div>}
        </div>

        <div>
          {draft && (
            <div className="mb-5 rounded-sm border border-ink bg-sheet p-4" aria-live="polite">
              <div className="label">ปักหมุดใหม่ · {draft.at[1].toFixed(5)}, {draft.at[0].toFixed(5)}</div>
              {draft.check.ok ? (
                <>
                  <label htmlFor="pin-name" className="mt-3 block text-sm">
                    ชื่อทำเล
                  </label>
                  <input
                    id="pin-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && placePin()}
                    placeholder="เช่น หน้าซอยประชาอุทิศ 45"
                    maxLength={60}
                    className="mt-1 w-full rounded-xs border border-rule bg-paper px-2 py-1.5 text-sm focus:border-ink"
                  />
                  <p className="mt-1 text-xs text-ink-3">ชื่อนี้จะถูกส่งให้ AI ตอนสรุปรายงาน อย่าใส่ชื่อหรือเบอร์โทรของคน</p>
                  {state.custom.length >= MAX_PINS ? (
                    <p className="mt-3 text-sm text-comp">ปักได้สูงสุด {MAX_PINS} หมุด ลบหมุดเก่าก่อน</p>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <Button onClick={placePin}>ปักหมุด</Button>
                      <Button variant="ghost" onClick={() => setDraft(null)}>
                        ยกเลิก
                      </Button>
                    </div>
                  )}
                  {full && <p className="mt-2 text-xs text-ink-3">เทียบครบ {MAX_SITES} จุดแล้ว หมุดจะเก็บไว้ในรายการ ถอดทำเลอื่นออกก่อนถ้าจะเทียบ</p>}
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-comp">{draft.check.reason}</p>
                  <Button variant="ghost" className="mt-3" onClick={() => setDraft(null)}>
                    ปิด
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
            <span className="label">ทำเลทั้งหมด</span>
            <span className="font-mono text-[11px] text-ink-2">
              เทียบ {sites.length}/{MAX_SITES}
            </span>
          </div>
          <ul className="divide-y divide-rule">
            {all.map((c) => {
              const on = chosen.has(c.id);
              return (
                <li key={c.id} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center font-mono text-[11px] font-semibold ${on ? "bg-ink text-paper" : "border border-dashed border-ink text-ink"}`}
                  >
                    {c.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-snug">{c.label}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                      {c.custom ? "ปักเอง · รัศมีเส้นตรง" : c.placeholder ? "จุดตัวอย่าง · ระยะเดินจริง" : "สำรวจแล้ว · ระยะเดินจริง"}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      onClick={() => saveSites(toggleSite(candidates, state, c.id))}
                      disabled={(!on && full) || (on && sites.length === 1)}
                      className="font-mono text-[11px] text-ink-2 underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink disabled:text-ink-3 disabled:no-underline"
                    >
                      {on ? "ถอดออก" : "เพิ่ม"}
                    </button>
                    {c.custom && (
                      <button
                        onClick={() => saveSites(removePin(candidates, state, c.id))}
                        className="font-mono text-[11px] text-comp hover:underline"
                      >
                        ลบหมุด
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-xs text-ink-3">
            ทำเลที่ปักเองยังไม่มีเส้นทางเดินจริง จึงใช้รัศมีเส้นตรง 300/600 ม. แทนระยะเดิน 5/10 นาที (ประมาณ) และยังไม่มีค่าเช่า
            กรอกได้ในหน้าเปรียบเทียบ หรือไปเก็บข้อมูลหน้างาน
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/compare">เปรียบเทียบ {sites.length} ทำเล</ButtonLink>
            <ButtonLink href="/map" variant="ghost">
              ดูบนแผนที่
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
