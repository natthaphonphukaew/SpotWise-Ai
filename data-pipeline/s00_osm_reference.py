"""Bangkok-wide OSM gazetteer of named institutions, used to catch misplaced Overture records.

Overture places sourced only from Meta (Facebook pages) are sometimes pinned far from the
real place, e.g. a Sukhumvit school showing up in Bangmod. If an institution's name exists
in OSM elsewhere in greater Bangkok but not near our area, the Bangmod copy is misplaced.
"""
import geopandas as gpd
import osmnx as ox

from config import CACHE, METRIC_CRS

# Greater Bangkok + nearby provinces (where mis-pinned pages usually really are)
REF_BBOX = (100.25, 13.45, 100.95, 14.10)  # west, south, east, north

TAGS = {
    "amenity": ["school", "college", "university", "kindergarten", "hospital", "clinic",
                "place_of_worship", "library", "townhall", "police", "marketplace"],
    "office": ["government"],
    "shop": ["mall", "department_store"],
}

OUT_FILE = CACHE / "osm_reference.parquet"


def main() -> None:
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(CACHE / "osmnx")
    ox.settings.requests_timeout = 300
    gdf = ox.features_from_bbox(REF_BBOX, tags=TAGS)
    gdf = gdf[gdf["name"].notna()].reset_index()
    names = gdf[[c for c in ["name", "name:th", "name:en"] if c in gdf.columns]]
    pts = gdf.geometry.to_crs(METRIC_CRS).representative_point().to_crs(4326)
    ref = gpd.GeoDataFrame(names, geometry=pts, crs=4326)
    ref.to_parquet(OUT_FILE)
    print(f"osm reference: {len(ref)} named institutions")


if __name__ == "__main__":
    main()
