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
- Loc-Score: ตัวเลขดีมานด์มาจาก WorldPop (ไม่นับนักศึกษา) + จุดดีมานด์ มจธ. จากจำนวนนักศึกษา FTE ของ THE 2025 ทั้งหมดเป็น "ประมาณการ" ห้ามนำเสนอเป็นยอดขายจริง หรือ % โอกาสรอด
- LLM: ทุกงานคือ `LlmTask` (`lib/llm/tasks/*`) ที่มี zod schema + `version` (เปลี่ยน prompt/schema ต้องเพิ่ม version) เรียกผ่าน `runTask()` เท่านั้น ไม่มี key = โหมดเดโม ห้ามเขียนผล AI ลง `llm-cache/` ด้วยมือ
- เทสต์: `npm test` (vitest 3 เพราะ vitest 5 ไม่รองรับ Node 23 ที่ใช้อยู่)
- **ข้อมูล Overture ย่านนี้ ~97% มาจากเพจ Facebook แหล่งเดียว** บางรายการปักหมุดผิดย่าน: ทุกจุดมี `verification` และต้องผ่าน `data-pipeline/validate.py` ห้ามแสดงสถานที่โดยไม่บอกสถานะการยืนยัน

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

รายการที่รู้ว่าต้องปรับภายหลังอยู่ใน [docs/SPEC.md §13 Backlog](docs/SPEC.md) (ผู้ใช้ให้ทำงาน Must ให้ครบก่อน)


- [x] วิเคราะห์ไอเดีย + ล็อกขอบเขต (17 ต.ค. 69)
- [x] style tile + design tokens (`app/globals.css`)
- [x] data pipeline ย่านบางมด: 4,183 สถานที่หลังตรวจพิกัด (ตัด 119 ที่ปักผิดย่าน ดู `data-pipeline/cache/rejected.csv`), รวมรายชื่อร้าน CampusSpot 632 ร้านที่ผู้ใช้คัดไว้, ป้ายรถ 55, รั้ว มจธ., isochrones
- [ ] ตรวจหน้างาน 7 ร้านใน CampusSpot ที่ที่อยู่ใน Overture ชี้ไปเขตอื่น (สคริปต์ `s05` พิมพ์รายชื่อ)
- [x] หน้า `/` (ปก) และ `/map` (แผนที่ + นับสถานที่ในระยะเดิน + evidence)
- [x] LLM adapter `lib/llm/` (cache ไฟล์ `llm-cache/` + โหมดเดโม + Gemini + zod) และ Business Profiler: หน้าแรกพิมพ์คอนเซ็ปต์ → การ์ดโปรไฟล์ที่แก้ได้ → แผนที่ใช้บทบาทคู่แข่ง/เกื้อหนุนตามโปรไฟล์
- [x] ต่อ Gemini (`gemini-3.8-flash`) เรียกจริงผ่าน (17 ต.ค. 69) ผลแรกอยู่ใน `llm-cache/business-profile/` (ดู [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md))
- [x] POI Classifier: `npm run classify:poi` ให้ AI จัดหมวดสถานที่ในรัศมี 1.5 กม. (batch ละ 80, cache ใน `llm-cache/poi-classify/`) → `public/data/bangmod/poi_ai.json` แผนที่ใช้หมวดของ AI ทับกฎ และแสดงเหตุผลใน Evidence · วัดผลเทียบ CampusSpot: `npm run eval:poi` → `eval_poi.json`
- [x] Loc-Score 5 มิติ + Huff model (`lib/scoring/`, เทสต์ monotonicity) และหน้า `/compare`: การ์ดคะแนน (แถบทึบ/ลายทแยงตามความแน่นอน), Evidence ต่อมิติ, ตาราง A/B/C, กรอกค่าเช่า, ปรับสมมติฐาน (อัตราซื้อ, คนใน มจธ. ระหว่างวัน)
- [x] W1 Scenario Simulator `/simulate`: กระแสเงินสด 12 เดือนตามปฏิทินการศึกษา มจธ. 2569 ของจริง (`public/data/bangmod/academic_calendar.json`, เกินปีที่ประกาศใช้รูปแบบปีก่อน + ติดป้าย "คาด"), 3 สถานการณ์, เงินสำรอง, คืนทุน, จุดคุ้มทุน (`lib/scoring/finance.ts` + เทสต์)
- [ ] รัน `npm run classify:poi` ต่อให้ครบ 25 batch (ได้ 18/25 — โควตาฟรีรีเซ็ตเที่ยงคืนเวลาแปซิฟิก ≈ 07:00 น. เวลาไทย)
- [x] W2 Field Mode `/field` (มือถือ): นับคนหน้าร้าน 10 นาที (เก็บแยกช่วงเวลา), ถ่ายรูปหน้าร้าน → Vision AI (`/api/storefront`, cache ตาม hash รูป, ย่อรูป/ตัด EXIF ก่อนส่ง), ค่าเช่า/โน้ต · ผลนับคนเปลี่ยนมิติการเข้าถึงเป็น "ข้อมูลจริง" และดัน Confidence ขึ้น (ข้อมูลหน้างานเก็บใน localStorage ของเครื่องที่เก็บเท่านั้น)
- [x] Grounded Advisor `/advisor` + Devil's Advocate (W3): ระบบสร้างรายการหลักฐานพร้อม id (`lib/advisor/evidence.ts`) → AI เขียนรายงานที่ทุกประโยคต้องอ้าง id → ตรวจ citation + ตัวเลขฝั่งเซิร์ฟเวอร์ (`lib/advisor/grounding.ts`) แสดงอัตราอ้างอิงถูกต้อง และขีดเส้นประโยคที่ตรวจไม่ผ่าน · ยังไม่ได้ทดสอบเรียกจริง (โควตาหมด)
- [x] Should: W4 Spot Finder (ชั้น "Spot Finder" บนแผนที่ ประเมินกริด 100 ม. นอกรั้ว มจธ. ด้วย Loc-Score แบบรัศมี + Huff แบบ precompute) · หน้า `/validation` รวมผล 5 ด้าน (ข้อมูล, classifier, monotonicity, backtest เชน, grounding) จากสคริปต์ `npm run eval:poi` `eval:labels` `backtest` `test:report`
- [x] Deploy (18 ต.ค. 69): https://spot-wise-ai.vercel.app · repo private `natthaphonphukaew/SpotWise-Ai` (branch `master`, push แล้ว Vercel deploy เอง) · ตั้งเป็นแอป Next.js ตัวเดียว ไม่ใช้ services (`data-pipeline/` รันในเครื่องเท่านั้น) · env `LLM_MODE=cache` (ไฟล์บน Vercel อ่านอย่างเดียว ผล AI ใหม่จึงต้องสร้างในเครื่องแล้ว commit `llm-cache/`)
- [ ] รัน `npm run test:report` / `eval:poi` / `backtest` ใหม่ทุกครั้งที่ข้อมูลหรือโมเดลเปลี่ยน (หน้า /validation อ่านไฟล์ JSON ที่สคริปต์สร้าง)
- [ ] เตรียมข้อความเดโมเพิ่ม (ร้านกาแฟ ฯลฯ) ให้มีผลใน `llm-cache/` ก่อนวันส่ง
- [ ] ถ้ารัน data pipeline ใหม่ (`poi.geojson` เปลี่ยน) ต้องรัน `npm run classify:poi` ใหม่ด้วย
- [ ] ลงพื้นที่สำรวจทำเลจริง 6–10 จุด + ค่าเช่า → แทน `data-pipeline/candidates.json`
