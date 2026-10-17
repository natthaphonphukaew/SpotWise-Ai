"""Overture Maps places for the Bangmod bbox, flattened to the fields the app needs."""
import sys

import geopandas as gpd
from overturemaps import core

import manifest
from config import BBOX, CACHE
from validate import clean_postcode

# Overture's own confidence score; very low values are mostly stale/closed listings.
MIN_CONFIDENCE = 0.35


def _get(d, *keys):
    for k in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d


def _join(xs) -> str:
    return " ".join(str(x) for x in xs) if xs is not None else ""


RAW = CACHE / "overture_raw.parquet"


def main(refresh: bool = "--refresh" in sys.argv) -> None:
    """Re-download only with --refresh; otherwise reuse the cached raw extract."""
    if refresh or not RAW.exists():
        release = core.get_latest_release()
        raw = core.geodataframe("place", bbox=BBOX, release=release, stac=True)
        raw.to_parquet(RAW)
        RAW.with_suffix(".release").write_text(release)
    else:
        raw = gpd.read_parquet(RAW)
        release = RAW.with_suffix(".release").read_text() if RAW.with_suffix(".release").exists() else "2026-09-23.1"

    common = raw["names"].map(lambda n: _get(n, "common") or {})
    addr = raw["addresses"].map(lambda a: a[0] if a is not None and len(a) else {})
    flat = gpd.GeoDataFrame({
        "id": "ov:" + raw["id"],
        "name": raw["names"].map(lambda n: _get(n, "primary")),
        "name_en": common.map(lambda c: dict(c).get("en") if c else None),
        "category": raw["basic_category"],
        "alt_categories": raw["taxonomy"].map(
            lambda t: _join(_get(t, "hierarchy")) + " " + _join(_get(t, "alternates"))),
        "brand": raw["brand"].map(lambda b: _get(b, "names", "primary")),
        "confidence": raw["confidence"].round(3),
        "operating_status": raw["operating_status"],
        # provenance for validate.py
        "postcode": addr.map(lambda a: clean_postcode(a.get("postcode"))),
        "locality": addr.map(lambda a: (a.get("locality") or "").strip() or None),
        "datasets": raw["sources"].map(lambda s: ",".join(sorted({x["dataset"] for x in s} - {"Overture"}))),
        "opening_hours": None,
    }, geometry=raw.geometry, crs=4326)

    kept = flat[(flat["confidence"] >= MIN_CONFIDENCE) & (flat["operating_status"].fillna("open") == "open")]
    kept.to_file(CACHE / "overture_places.geojson", driver="GeoJSON")
    manifest.record("overture_places", "overture", "(intermediate)", len(kept),
                    release=release, raw_count=len(raw), min_confidence=MIN_CONFIDENCE)
    print(f"overture {release}: {len(kept)} kept of {len(raw)}")


if __name__ == "__main__":
    main()
