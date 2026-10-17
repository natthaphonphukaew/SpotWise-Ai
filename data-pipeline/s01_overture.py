"""Overture Maps places for the Bangmod bbox, flattened to the fields the app needs."""
import geopandas as gpd
from overturemaps import core

import manifest
from config import BBOX, CACHE

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


def main() -> None:
    release = core.get_latest_release()
    raw = core.geodataframe("place", bbox=BBOX, release=release, stac=True)
    raw.to_parquet(CACHE / "overture_raw.parquet")

    common = raw["names"].map(lambda n: _get(n, "common") or {})
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
        "opening_hours": None,
    }, geometry=raw.geometry, crs=4326)

    kept = flat[(flat["confidence"] >= MIN_CONFIDENCE) & (flat["operating_status"].fillna("open") == "open")]
    kept.to_file(CACHE / "overture_places.geojson", driver="GeoJSON")
    manifest.record("overture_places", "overture", "(intermediate)", len(kept),
                    release=release, raw_count=len(raw), min_confidence=MIN_CONFIDENCE)
    print(f"overture {release}: {len(kept)} kept of {len(raw)}")


if __name__ == "__main__":
    main()
