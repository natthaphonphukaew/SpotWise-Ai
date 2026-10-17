"""Merge Overture + OSM POIs, validate locations, dedupe, and assign a coarse rule-based group.

Validation (validate.py) rejects mis-pinned Overture records; within 1.5 km of KMUTT the
user's hand-curated CampusSpot shop list is the source of truth for food & drink.
Every POI carries a `verification` label; every rejection goes to cache/rejected.csv.

The group is only a first pass. The LLM POI classifier (week 2) decides
direct vs. indirect competitor per business profile.
"""
import difflib
import re

import geopandas as gpd
import pandas as pd

import manifest
import validate as v
from config import CACHE, GEOJSON_OPTS, METRIC_CRS, OUT, PIPELINE

DEDUPE_M = 40

CURATED = PIPELINE / "reference" / "campusspot_shops.geojson"
OSM_REFERENCE = CACHE / "osm_reference.parquet"

# Ordered: first match wins. (group, keywords matched against category/tags/name)
GROUP_RULES: list[tuple[str, list[str]]] = [
    ("bubble_tea", ["bubble_tea", "boba", "bubble", "milk tea", "ชานม", "ไข่มุก", "ชาไต้หวัน",
                    "ตรามือ", "tiger sugar", "เสือพ่นไฟ", "koi th"]),
    ("coffee", ["coffee", "cafe", "café", "กาแฟ", "คาเฟ่", "amazon", "อเมซอน", "starbucks",
                "inthanin", "อินทนิล", "พันธุ์ไทย", "punthai"]),
    ("drink_dessert", ["juice", "smoothie", "tea_room", "tea_house", "dessert", "ice_cream",
                       "bakery", "น้ำปั่น", "บิงซู", "ไอศกรีม", "ขนม", "เบเกอรี่"]),
    ("food", ["restaurant", "food", "noodle", "fast_food", "diner", "ร้านอาหาร", "ก๋วยเตี๋ยว",
              "ข้าว", "หมูกระทะ", "ส้มตำ", "ลาบ", "ไก่ย่าง", "หมูปิ้ง"]),
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


# Overture/Meta often files non-food places under food categories (a condo as "casual_eatery").
NONFOOD_CATEGORY = {"supplier_or_distributor", "event_or_party_service", "playground", "professional_service",
                    "community_center", "real_estate_service", "b2b_industrial_and_machine_service", "waterfall"}
NONFOOD_NAME = re.compile(r"คอนโด|condo|บริษัท|จำกัด|co\.?,? ?ltd|internet ?cafe|ศูนย์ฝึก|ซักอบรีด|ซักผ้า|laundry|"
                          r"น้ำแข็งแห้ง|dry ice", re.I)


def group_for(haystack: str, category: str | None = None, name: str | None = None) -> str:
    h = haystack.lower()
    nonfood = (category in NONFOOD_CATEGORY) or bool(NONFOOD_NAME.search(name or ""))
    for group, kws in GROUP_RULES:
        if nonfood and group in v.FOOD_GROUPS:
            continue
        if any(k in h for k in kws):
            return group
    return "other"


def assign_groups(gdf: gpd.GeoDataFrame) -> pd.Series:
    cat = gdf["category"] if "category" in gdf else pd.Series(None, index=gdf.index)
    return pd.Series([group_for(h, c if isinstance(c, str) else None, n if isinstance(n, str) else None)
                      for h, c, n in zip(gdf["haystack"], cat, gdf["name"])], index=gdf.index)


def norm_name(s: str | None) -> str:
    return re.sub(r"[\s\-_.,()'\"]+", "", (s or "").lower())


def similar(a: str | None, b: str | None) -> bool:
    a, b = norm_name(a), norm_name(b)
    return bool(a and b and (a in b or b in a or difflib.SequenceMatcher(None, a, b).ratio() > 0.8))


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


def load_curated() -> gpd.GeoDataFrame:
    c = gpd.read_file(CURATED)
    is_ov = c["source"] == "overture"
    c["id"] = ("ov:" + c["overture_id"].fillna("")).where(is_ov, "cs:osm" + c.index.astype(str))
    c["haystack"] = c["category"].fillna("") + " " + c["category_th"].fillna("") + " " + c["name"].fillna("")
    return c


def overture_address(ids: set[str]) -> pd.DataFrame:
    """Address fields for Overture ids (incl. low-confidence ones filtered out in s01)."""
    raw = gpd.read_parquet(CACHE / "overture_raw.parquet", columns=["id", "addresses", "sources", "geometry"])
    raw = raw[("ov:" + raw["id"]).isin(ids)]
    addr = raw["addresses"].map(lambda a: a[0] if a is not None and len(a) else {})
    return pd.DataFrame({
        "id": "ov:" + raw["id"],
        "postcode": addr.map(lambda a: v.clean_postcode(a.get("postcode"))),
        "locality": addr.map(lambda a: (a.get("locality") or "").strip() or None),
        "datasets": raw["sources"].map(lambda s: ",".join(sorted({x["dataset"] for x in s} - {"Overture"}))),
    })


def dedupe(ov: gpd.GeoDataFrame, osm: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Drop OSM records that match a nearby Overture record by name; keep the OSM id as a cross-ref."""
    ov_m, osm_m = ov.to_crs(METRIC_CRS), osm.to_crs(METRIC_CRS)
    ov["osm_ref"] = None
    pairs = gpd.sjoin_nearest(osm_m[["id", "name", "geometry"]], ov_m[["name", "geometry"]],
                              max_distance=DEDUPE_M, distance_col="dist", lsuffix="osm", rsuffix="ov")
    drop = set()
    for _, r in pairs.iterrows():
        if similar(r["name_osm"], r["name_ov"]):
            drop.add(r["id"])
            ov.loc[r["index_ov"], "osm_ref"] = r["id"]
    return osm[~osm["id"].isin(drop)]


def validate_overture(ov: gpd.GeoDataFrame) -> pd.Series:
    """Rejection reason per Overture record (None = keep)."""
    reason = pd.Series(None, index=ov.index, dtype=object)
    for i, r in ov.iterrows():
        if not r["local_name"]:
            reason[i] = v.address_reason(r.get("postcode"), r.get("locality")) or v.name_reason(r["name"], r["group"])

    if OSM_REFERENCE.exists():
        landmark = ov.apply(lambda r: v.is_landmark(r["category"], r["alt_categories"], r["name"]), axis=1)
        # KMUTT's own faculties share names with other universities: skip anything on campus.
        cand = ov[landmark & ~ov["local_name"] & ~ov["in_campus"] & reason.isna()]
        reason.update(v.osm_elsewhere(cand, gpd.read_parquet(OSM_REFERENCE)).dropna())
    else:
        print("! osm_reference.parquet missing: run s00_osm_reference.py (landmark check skipped)")

    return reason


def merge_curated_osm(osm_only: gpd.GeoDataFrame, cur: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Mark OSM shops that are on the curated list; add curated OSM shops we did not have."""
    osm_only = osm_only.copy()
    osm_only["curated"] = False
    cur_osm = cur[cur["source"] == "osm"]
    near = gpd.sjoin_nearest(cur_osm.to_crs(METRIC_CRS)[["id", "name", "geometry"]],
                             osm_only.to_crs(METRIC_CRS)[["name", "geometry"]],
                             max_distance=DEDUPE_M, lsuffix="cur", rsuffix="osm")
    matched = set()
    for _, r in near.iterrows():
        if similar(r["name_cur"], r["name_osm"]):
            osm_only.loc[r["index_osm"], "curated"] = True
            matched.add(r["id"])
    add = cur_osm[~cur_osm["id"].isin(matched)]
    added = gpd.GeoDataFrame({
        "id": add["id"], "name": add["name"], "name_en": None, "category": add["category"], "brand": None,
        "confidence": None, "opening_hours": None, "source": "osm", "haystack": add["haystack"], "curated": True,
    }, geometry=add.geometry, crs=4326)
    return gpd.GeoDataFrame(pd.concat([osm_only, added], ignore_index=True), geometry="geometry", crs=4326)


def main() -> None:
    ov, osm, cur = load_overture(), load_osm(), load_curated()
    campus = gpd.read_file(OUT / "campus.geojson").union_all()

    # Curated Overture shops that s01 dropped for low confidence come back from the curated file.
    missing = cur[(cur["source"] == "overture") & ~cur["id"].isin(ov["id"])]
    extra = gpd.GeoDataFrame({
        "id": missing["id"], "name": missing["name"], "name_en": None, "category": missing["category"],
        "alt_categories": "", "brand": None, "confidence": missing["confidence"], "opening_hours": None,
        "source": "overture", "haystack": missing["haystack"],
    }, geometry=missing.geometry, crs=4326).merge(overture_address(set(missing["id"])), on="id", how="left")
    ov = gpd.GeoDataFrame(pd.concat([ov, extra], ignore_index=True), geometry="geometry", crs=4326)

    ov["group"] = assign_groups(ov)
    ov["local_name"] = (ov["name"].fillna("") + " " + ov["name_en"].fillna("")).str.contains(v.LOCAL_NAME)
    ov["in_campus"] = ov.within(campus)
    ov["curated"] = ov["id"].isin(cur["id"])

    # The curated list is the user's local knowledge: it overrides the automatic checks,
    # but overridden records are printed so they can be re-checked on the ground.
    reason = validate_overture(ov)
    conflicts = ov[ov["curated"] & reason.notna()].assign(reason=reason)
    reason[ov["curated"]] = None
    rejected = ov[reason.notna()].assign(reason=reason[reason.notna()])
    ov = ov[reason.isna()].copy()

    osm_only = merge_curated_osm(dedupe(ov, osm), cur)
    osm_only["group"] = assign_groups(osm_only)
    osm_only["in_campus"] = osm_only.within(campus)

    poi = gpd.GeoDataFrame(pd.concat([ov, osm_only], ignore_index=True), geometry="geometry", crs=4326)
    poi = poi[poi["name"].notna() & (poi["name"].str.strip() != "")].copy()
    poi["confidence"] = pd.to_numeric(poi["confidence"], errors="coerce")
    non_meta = poi["datasets"].fillna("").str.contains("AllThePlaces|Foursquare|Microsoft")
    poi["verification"] = "unverified"
    poi.loc[poi["local_name"].fillna(False).astype(bool), "verification"] = "local_name"
    poi.loc[non_meta, "verification"] = "multi_source"
    poi.loc[(poi["source"] == "osm") | poi["osm_ref"].notna(), "verification"] = "osm"
    poi.loc[poi["curated"].fillna(False).astype(bool), "verification"] = "curated"
    poi["in_campus"] = poi["in_campus"].fillna(False).astype(bool)
    poi["name_issue"] = poi["name"].map(lambda n: "vowels_missing" if v.garbled_name(n) else None)

    cols = ["id", "name", "name_en", "group", "category", "brand", "confidence", "opening_hours",
            "source", "osm_ref", "verification", "in_campus", "name_issue", "geometry"]
    poi[cols].to_file(OUT / "poi.geojson", driver="GeoJSON", **GEOJSON_OPTS)

    rej = rejected[["id", "name", "group", "category", "confidence", "postcode", "locality", "datasets",
                    "curated", "reason"]].assign(lon=rejected.geometry.x.round(6), lat=rejected.geometry.y.round(6))
    rej.to_csv(CACHE / "rejected.csv", index=False, encoding="utf-8-sig")
    by_reason = rej["reason"].str.split(":").str[0].value_counts().to_dict()

    counts = poi["group"].value_counts().to_dict()
    manifest.record("poi", ["overture", "osm", "campusspot"], "poi.geojson", len(poi),
                    by_group=counts, by_source=poi["source"].value_counts().to_dict(),
                    by_verification=poi["verification"].value_counts().to_dict(),
                    rejected=len(rej), rejected_by_reason=by_reason, curated_conflicts=len(conflicts),
                    classification="rule-based (pre-LLM)")
    print(f"poi: {len(poi)} kept · rejected {len(rej)} {by_reason}")
    print("verification:", poi["verification"].value_counts().to_dict())
    print(f"curated records kept despite failing a check (re-check on the ground): {len(conflicts)}")
    if len(conflicts):
        print(conflicts[["name", "postcode", "locality", "reason"]].to_string())
    print(counts)


if __name__ == "__main__":
    main()
