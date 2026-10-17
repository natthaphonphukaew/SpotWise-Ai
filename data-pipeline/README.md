# Data pipeline — ย่านบางมด

สคริปต์ offline ที่สร้างไฟล์ข้อมูลใน `public/data/bangmod/` ให้เว็บใช้ (เว็บไม่เรียก API ข้อมูลเหล่านี้ตอนรันจริง)

## ติดตั้ง (ครั้งแรก)

```bash
python -m venv data-pipeline/.venv
data-pipeline/.venv/Scripts/python -m pip install -r data-pipeline/requirements.txt
```

## รัน

```bash
cd data-pipeline && PYTHONIOENCODING=utf-8 .venv/Scripts/python run_all.py
```

ทุกสคริปต์รันแยกได้ (`python s02_osm.py` ฯลฯ) และบันทึก metadata ลง `manifest.json` (แหล่ง, วันที่ดึง, license, จำนวน) ซึ่งเว็บใช้แสดง evidence

| ขั้น | สคริปต์ | ผลลัพธ์ |
|---|---|---|
| 1 | `s01_overture.py` | สถานที่จาก Overture (ตัด confidence < 0.35 และร้านที่ปิดแล้ว) → `cache/overture_places.geojson` |
| 2 | `s02_osm.py` | POI + ป้ายรถจาก OSM → `transit.geojson` และเครือข่ายทางเดิน → `cache/walk.graphml` |
| 3 | `s03_population.py` | WorldPop 2025 100 ม. ตัดเฉพาะ bbox → `population.geojson` (ครั้งแรกโหลดไฟล์ทั้งประเทศ ~120 MB มาเก็บใน cache เพราะ server ไม่รองรับการอ่านบางส่วน) |
| 4 | `s05_merge_poi.py` | รวม Overture + OSM, ตัดรายการซ้ำ (≤ 40 ม. + ชื่อคล้ายกัน), จัดกลุ่มด้วยกฎ → `poi.geojson` |
| 5 | `s04_isochrones.py` | พื้นที่เดินถึง 5/10 นาทีของทุกทำเลใน `candidates.json` → `isochrones.geojson` |

## หมายเหตุ

- `candidates.json` ตอนนี้เป็น **ทำเลตัวอย่าง** (`placeholder: true`) ต้องแทนด้วยทำเลที่เดินสำรวจจริงพร้อมค่าเช่า แล้วรัน `s04_isochrones.py` ใหม่
- การจัดกลุ่มใน `s05` เป็นแค่รอบแรกแบบกฎ ส่วนการตัดสินว่าร้านไหนเป็นคู่แข่งตรงหรืออ้อมจะให้ LLM classifier ทำ (สัปดาห์ที่ 2)
- Foursquare OS Places ยังไม่ได้ใช้ เพราะต้องลงทะเบียนรับ token ก่อน
- `cache/` และ `.venv/` ไม่ถูก commit
