"""Evidence metadata for every dataset the app shows (source, date, licence, limits)."""
import json

from config import BBOX, CENTER, FETCHED, OUT

MANIFEST = OUT / "manifest.json"

SOURCES = {
    "overture": {
        "name": "Overture Maps Places",
        "url": "https://docs.overturemaps.org/guides/places",
        "license": "CDLA-Permissive-2.0 / Apache-2.0 / CC0-1.0",
        "limits": "ร้านเล็ก/ร้านรถเข็น/ร้านเปิดใหม่อาจตกหล่น หมวดหมู่ไม่สม่ำเสมอ",
    },
    "osm": {
        "name": "OpenStreetMap",
        "url": "https://www.openstreetmap.org/copyright",
        "license": "ODbL-1.0 (© OpenStreetMap contributors)",
        "limits": "ความครอบคลุมร้านค้าในไทยไม่สม่ำเสมอ ขึ้นกับอาสาสมัคร",
    },
    "campusspot": {
        "name": "CampusSpot — รายชื่อร้านรอบ มจธ. ที่คัดกรองแล้ว",
        "url": "data-pipeline/reference/campusspot_README.md",
        "license": "CDLA-Permissive-2.0 / CC0-1.0 / Apache-2.0 (Overture) + ODbL-1.0 (OSM)",
        "limits": "เฉพาะร้านกาแฟ อาหาร ซักผ้า ปริ้นต์ ในรัศมี 1.5 กม. ไม่รวมร้านในมหาวิทยาลัย ข้อมูล 16.10.69",
    },
    "worldpop": {
        "name": "WorldPop 2025 constrained 100m (R2025A v1)",
        "url": "https://hub.worldpop.org/geodata/summary?id=75663",
        "license": "CC BY 4.0",
        "limits": "เป็นค่าประมาณจากโมเดล (alpha) ไม่ได้นับจริง ไม่สะท้อนประชากรแฝง/นักศึกษาหอพัก",
    },
}


def load() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"area": "bangmod", "center": CENTER, "bbox": BBOX, "datasets": {}, "sources": SOURCES}


def record(dataset: str, source: str | list[str], file: str, count: int, **extra) -> None:
    m = load()
    m["sources"] = SOURCES
    m["datasets"][dataset] = {
        "file": file,
        "source": source,
        "fetched": FETCHED,
        "count": count,
        **extra,
    }
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")
