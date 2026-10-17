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

ทุกสคริปต์รันแยกได้ (`python s05_merge_poi.py` ฯลฯ) และบันทึก metadata ลง `manifest.json` (แหล่ง, วันที่ดึง, license, จำนวน, ผลการตรวจ) ซึ่งเว็บใช้แสดง evidence

| ขั้น | สคริปต์ | ผลลัพธ์ |
|---|---|---|
| 0 | `s00_osm_reference.py` | รายชื่อสถาบัน (โรงเรียน โรงพยาบาล วัด ฯลฯ) จาก OSM ทั่วกรุงเทพฯ และปริมณฑล → `cache/osm_reference.parquet` ใช้จับสถานที่ที่ถูกปักผิดย่าน |
| 1 | `s01_overture.py` | สถานที่จาก Overture (ตัด confidence < 0.35 และร้านที่ปิดแล้ว) → `cache/overture_places.geojson` ใช้ cache เดิม ถ้าจะดึงใหม่ใส่ `--refresh` |
| 2 | `s02_osm.py` | POI + ป้ายรถจาก OSM → `transit.geojson`, เครือข่ายทางเดิน → `cache/walk.graphml`, รั้ว มจธ. → `campus.geojson` |
| 3 | `s03_population.py` | WorldPop 2025 100 ม. ตัดเฉพาะ bbox → `population.geojson` |
| 4 | `s05_merge_poi.py` | ตรวจพิกัด → รวม Overture + OSM + CampusSpot → ตัดรายการซ้ำ → จัดกลุ่มด้วยกฎ → `poi.geojson` และ `cache/rejected.csv` |
| 5 | `s04_isochrones.py` | พื้นที่เดินถึง 5/10 นาทีของทุกทำเลใน `candidates.json` → `isochrones.geojson` |

## การตรวจพิกัด (`validate.py`)

สถานที่ใน Overture ย่านนี้ราว 97% มาจาก **เพจ Facebook (Meta) แหล่งเดียว** และบางเพจถูกปักหมุดผิดที่ เช่น โรงเรียนปทุมคงคา (เอกมัย) หรือ รพ.ศิริราช ที่โผล่มาในบางมด จึงตัดออกด้วยกฎต่อไปนี้ และบันทึกเหตุผลทุกรายการลง `cache/rejected.csv`

| กฎ | ตัดเมื่อ |
|---|---|
| `postcode_outside` | รหัสไปรษณีย์ในที่อยู่ไม่ใช่ 10140 / 10150 / 10130 |
| `locality_outside` | ที่อยู่ระบุจังหวัด/อำเภออื่น |
| `name_mentions_elsewhere` | ชื่อระบุย่านหรือจังหวัดอื่น (เช่น "สยามพารากอน", "จ.ชลบุรี") **ยกเว้นร้านอาหารและร้านค้า** เพราะร้านไทยนิยมตั้งชื่อตามย่านดัง ("ข้าวขาหมูเยาวราช") |
| `osm_name_elsewhere` | เป็นสถาบัน และ OSM รู้จักชื่อนี้เฉพาะที่ที่ไกลเกิน 3 กม. (ไม่ใช้กับชื่อที่ซ้ำกันหลายที่อย่าง "วัดโพธิ์ทอง" และไม่ใช้กับที่อยู่ในรั้ว มจธ.) |

ชื่อที่ระบุย่านนี้ (บางมด, มจธ., ประชาอุทิศ, พุทธบูชา, ทุ่งครุ ฯลฯ) ถือเป็นหลักฐานว่าอยู่จริง จึงไม่ถูกตัดด้วยกฎที่อยู่

ทุกจุดที่เหลือมีฟิลด์ `verification`:

| ค่า | ความหมาย |
|---|---|
| `curated` | อยู่ในรายชื่อร้าน CampusSpot ที่คัดด้วยมือ (`reference/campusspot_shops.geojson`) |
| `osm` | มีใน OpenStreetMap |
| `multi_source` | Overture รวมจากแหล่งอื่นนอกจาก Meta ด้วย |
| `local_name` | ชื่อระบุย่านนี้ |
| `unverified` | มาจากเพจ Facebook แหล่งเดียว (หน้าเว็บแสดงเป็นจุดจาง และมีปุ่มซ่อนได้) |

รายชื่อ CampusSpot มีสิทธิ์เหนือกฎอัตโนมัติ ถ้าร้านในรายชื่อไม่ผ่านกฎใด สคริปต์จะพิมพ์ชื่อออกมาให้ไปตรวจหน้างาน

## หมายเหตุ

- `candidates.json` ตอนนี้เป็น **ทำเลตัวอย่าง** (`placeholder: true`) ต้องแทนด้วยทำเลที่เดินสำรวจจริงพร้อมค่าเช่า แล้วรัน `s04_isochrones.py` ใหม่
- การจัดกลุ่มใน `s05` เป็นแค่รอบแรกแบบกฎ ส่วนการตัดสินว่าร้านไหนเป็นคู่แข่งตรงหรืออ้อมจะให้ LLM classifier ทำ (สัปดาห์ที่ 2)
- ชื่อที่สระ/วรรณยุกต์หายในแหล่งข้อมูล (เช่น "ราดหน ายอดผ ก") ติดธง `name_issue: vowels_missing`
- Foursquare OS Places ยังไม่ได้ใช้ เพราะต้องลงทะเบียนรับ token ก่อน
- `cache/` และ `.venv/` ไม่ถูก commit
