"""Merge Overture + OSM POIs, dedupe, and assign a coarse rule-based group.

The group is only a first pass. The LLM POI classifier (week 2) decides
direct vs. indirect competitor per business profile; this file just gives it
clean, deduplicated input with provenance.
"""
import difflib
import re

import geopandas as gpd
import pandas as pd

import manifest
from config import CACHE, GEOJSON_OPTS, METRIC_CRS, OUT

DEDUPE_M = 40

# Ordered: first match wins. (group, keywords matched against category/tags/name)
GROUP_RULES: list[tuple[str, list[str]]] = [
    ("bubble_tea", ["bubble_tea", "boba", "bubble", "milk tea", "ชานม", "ไข่มุก", "ชาไต้หวัน",
                    "ตรามือ", "tiger sugar", "เสือพ่นไฟ", "koi th"]),
    ("coffee", ["coffee", "cafe", "café", "กาแฟ", "คาเฟ่", "amazon", "อเมซอน", "starbucks",
                "inthanin", "อินทนิล", "พันธุ์ไทย", "punthai"]),
    ("drink_dessert", ["juice", "smoothie", "tea_room", "tea_house", "dessert", "ice_cream",
                       "bakery", "น้ำปั่น", "บิงซู", "ไอศกรีม", "ขนม", "เบเกอรี่"]),
    ("food", ["restaurant", "food", "noodle", "fast_food", "diner", "ร้านอาหาร", "ก๋วยเตี๋ยว",
              "ข้าว", "หมูกระทะ", "ส้มตำ"]),
    ("convenience", ["convenience", "supermarket", "grocery", "7-eleven", "เซเว่น", "lotus",
                     "โลตัส", "familymart", "big c", "บิ๊กซี", "cj more", "tops"]),
    ("education", ["university", "college", "school", "kindergarten", "library", "education",
                   "tutor", "มหาวิทยาลัย", "โรงเรียน", "วิทยาลัย", "กวดวิชา"]),
    ("dormitory", ["dormitory", "hostel", "apartment", "guest_house", "lodging", "hotel", "resort",
                   "หอพัก", "อพาร์ท", "แมนชั่น", "เรสซิเดนซ์", "residence", "mansion", "โรงแรม", "รีสอร์ท"]),
    ("market", ["marketplace", "market", "ตลาด"]),
    ("office", ["office", "coworking", "government", "สำนักงาน", "บริษัท"]),
    ("health", ["hospital", "clinic", "pharmacy", "dentist", "โรงพยาบาล", "คลินิก", "ร้านยา"]),
    ("leisure", ["park", "sports", "fitness", "gym", "สวน", "ฟิตเนส"]),
    ("retail", ["shop", "store", "retail", "ร้าน"]),
]


def group_for(haystack: str) -> str:
    h = haystack.lower()
    for group, kws in GROUP_RULES:
        if any(k in h for k in kws):
            return group
    return "other"


def norm_name(s: str | None) -> str:
    return re.sub(r"[\s\-_.,()'\"]+", "", (s or "").lower())


def load_overture() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(CACHE / "overture_places.geojson")
    gdf["source"] = "overture"
    gdf["haystack"] = (gdf["category"].fillna("") + " " + gdf["alt_categories"].fillna("") + " "
                       + gdf["name"].fillna("") + " " + gdf["name_en"].fillna("") + " " + gdf["brand"].fillna(""))
    return gdf


def load_osm() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(CACHE / "osm_poi.geojson")
    tag_cols = [c for c in ["amenity", "shop", "office", "building", "leisure", "tourism", "cuisine"] if c in gdf]
    tags = gdf[tag_cols].fillna("").astype(str).agg(" ".join, axis=1)
    out = gpd.GeoDataFrame({
        "id": gdf["osm_id"],
        "name": gdf.get("name:th", pd.Series(dtype=object)).fillna(gdf["name"]),
        "name_en": gdf.get("name:en", pd.Series(index=gdf.index, dtype=object)),
        "category": tags.str.split().str.join(" "),
        "brand": gdf.get("brand", pd.Series(index=gdf.index, dtype=object)),
        "confidence": None,
        "opening_hours": gdf.get("opening_hours", pd.Series(index=gdf.index, dtype=object)),
        "source": "osm",
    }, geometry=gdf.geometry, crs=4326)
    out["haystack"] = (out["category"].fillna("") + " " + out["name"].fillna("") + " "
                       + out["name_en"].fillna("") + " " + out["brand"].fillna(""))
    return out


def dedupe(ov: gpd.GeoDataFrame, osm: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Drop OSM records that match a nearby Overture record by name; keep the OSM id as a cross-ref."""
    ov_m, osm_m = ov.to_crs(METRIC_CRS), osm.to_crs(METRIC_CRS)
    ov["osm_ref"] = None
    pairs = gpd.sjoin_nearest(osm_m[["id", "name", "geometry"]], ov_m[["name", "geometry"]],
                              max_distance=DEDUPE_M, distance_col="dist", lsuffix="osm", rsuffix="ov")
    drop = set()
    for _, r in pairs.iterrows():
        a, b = norm_name(r["name_osm"]), norm_name(r["name_ov"])
        if a and b and (a in b or b in a or difflib.SequenceMatcher(None, a, b).ratio() > 0.8):
            drop.add(r["id"])
            ov.loc[r["index_ov"], "osm_ref"] = r["id"]
    return osm[~osm["id"].isin(drop)]


def main() -> None:
    ov, osm = load_overture(), load_osm()
    osm_only = dedupe(ov, osm)
    poi = pd.concat([ov, osm_only], ignore_index=True)
    poi = gpd.GeoDataFrame(poi, geometry="geometry", crs=4326)
    poi["group"] = poi["haystack"].map(group_for)
    poi = poi[poi["name"].notna() & (poi["name"].str.strip() != "")]
    poi["confidence"] = pd.to_numeric(poi["confidence"], errors="coerce")

    cols = ["id", "name", "name_en", "group", "category", "brand", "confidence",
            "opening_hours", "source", "osm_ref", "geometry"]
    poi = poi[[c for c in cols if c in poi.columns]]
    poi.to_file(OUT / "poi.geojson", driver="GeoJSON", **GEOJSON_OPTS)

    counts = poi["group"].value_counts().to_dict()
    manifest.record("poi", ["overture", "osm"], "poi.geojson", len(poi),
                    by_group=counts, by_source=poi["source"].value_counts().to_dict(),
                    classification="rule-based (pre-LLM)")
    print(f"poi: {len(poi)} (overture {len(ov)}, osm-only {len(osm_only)} of {len(osm)})")
    print(counts)


if __name__ == "__main__":
    main()
