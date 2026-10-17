# SpotWise AI

Explainable AI สำหรับเลือกทำเลเปิดร้าน (เดโม: ร้านชาไข่มุก/กาแฟ รอบ มจธ. บางมด)
ส่งงานแข่งขัน **14 พ.ย. 2569** · ทำคนเดียวแบบ vibe coding · **ต้องฟรีล้วน**

- ขอบเขต ฟีเจอร์ ไทม์ไลน์: [docs/SPEC.md](docs/SPEC.md)
- ดีไซน์ (สี ฟอนต์ component กฎ anti-slop): [docs/DESIGN.md](docs/DESIGN.md)

## กฎที่ต้องทำตามเสมอ

1. **ห้ามเพิ่มฟีเจอร์นอก MoSCoW ใน SPEC.md** ถ้าคิดว่าควรเพิ่ม ให้ถามก่อน และเตือนเมื่อขอบเขตเสี่ยงไม่ทันเดดไลน์
2. **ห้ามใช้บริการที่มีค่าใช้จ่าย** (Google Maps/Places, Mapbox, LLM แบบเสียเงิน) ใช้ได้เฉพาะ free tier / open data ตามตารางใน SPEC.md ข้อ 8
3. **UI ต้องผ่าน Anti-Slop Checklist** (DESIGN.md ข้อ 10) และใช้ design tokens เท่านั้น ห้าม hardcode สี/ฟอนต์
4. **ทุกตัวเลขที่แสดงต้องมี evidence** (แหล่ง, วันที่, จริงหรือประมาณ) ห้ามให้ LLM สร้างตัวเลขหรือสถานที่ขึ้นมาเอง
5. **ผล LLM ทุกตัวต้องผ่าน cache** (key = hash ของ prompt + input + model) และต้องมีโหมดเดโมที่ไม่เรียก API
6. LLM เรียกผ่าน adapter เดียว (`lib/llm/`) ใช้ structured output + zod validate · provider หลัก Gemini free tier · ห้ามส่งข้อมูลส่วนบุคคล
7. คำนวณคะแนน/Huff/การเงินด้วยฟังก์ชัน pure ใน `lib/scoring/` และต้องมี unit test แบบ monotonicity
8. ข้อความ UI เป็นภาษาไทย ส่วนโค้ด ชื่อตัวแปร และคอมเมนต์เป็นภาษาอังกฤษ

## Stack

Next.js (App Router) + TypeScript + Tailwind · MapLibre GL + OpenFreeMap/Protomaps · Turf.js · Observable Plot/D3 · zod
Data pipeline แบบ offline: Python venv (`data-pipeline/.venv`) + overturemaps + OSMnx + geopandas + rasterio → `public/data/bangmod/` (ดู [data-pipeline/README.md](data-pipeline/README.md))
Deploy: Vercel Hobby

## ข้อควรรู้ทางเทคนิค

- **Next.js 16** มี breaking changes จากที่คุ้นเคย อ่าน [AGENTS.md](AGENTS.md) และเอกสารใน `node_modules/next/dist/docs/` ก่อนใช้ API ที่ไม่แน่ใจ (เปิด `cacheComponents` ไว้)
- **MapLibre GL v6** เป็น ESM และต้องโหลด worker แยก: `npm run dev/build` จะคัดลอก worker ไป `public/vendor/` ก่อนเสมอ (`scripts/copy-maplibre-worker.mjs`) และต้องเรียก `setWorkerUrl` ก่อนสร้างแผนที่
- class `.maplibregl-map` บังคับ `position: relative` ดังนั้น container ของแผนที่ต้องกำหนดขนาดเอง (`h-full w-full`) ห้ามใช้ `absolute inset-0`
- สีบนแผนที่ต้องอ่านจาก CSS token ผ่าน `cssVar()` (`lib/css-var.ts`) ห้าม hardcode hex
- ตอน dev มี `window.__map` ไว้ debug แผนที่

## โครงสร้าง (เป้าหมาย)

```
app/                 # หน้า: / (ปก+setup), /map, /compare, /simulate, /advisor, /field, /validation
scripts/             # build helpers (copy maplibre worker)
components/          # UI components (ใช้ design tokens)
lib/llm/             # provider adapter + cache + prompts + zod schemas
lib/scoring/         # loc-score, huff, finance, confidence (pure + tests)
lib/geo/             # catchment, turf helpers
public/data/bangmod/ # GeoJSON/JSON ที่ pipeline สร้าง (POI, population grid, isochrones, candidates)
data-pipeline/       # Python scripts (ไม่ deploy)
docs/                # SPEC, DESIGN
```

## สถานะ

- [x] วิเคราะห์ไอเดีย + ล็อกขอบเขต (17 ต.ค. 69)
- [x] style tile + design tokens (`app/globals.css`)
- [x] data pipeline ย่านบางมด (Overture 4,069 + OSM 155 = 4,224 สถานที่, ป้ายรถ 55, isochrones)
- [x] หน้า `/` (ปก) และ `/map` (แผนที่ + นับสถานที่ในระยะเดิน + evidence)
- [ ] ลงพื้นที่สำรวจทำเลจริง 6–10 จุด + ค่าเช่า → แทน `data-pipeline/candidates.json`
