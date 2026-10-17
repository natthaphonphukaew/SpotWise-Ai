"""OpenStreetMap: POIs, transit stops and the walking network for Bangmod."""
import geopandas as gpd
import osmnx as ox
import pandas as pd

import manifest
from config import BBOX, CACHE, GEOJSON_OPTS, METRIC_CRS, OUT

POI_TAGS = {
    "amenity": [
        "cafe", "restaurant", "fast_food", "food_court", "ice_cream", "bar",
        "school", "college", "university", "kindergarten", "library",
        "marketplace", "bus_station", "hospital", "clinic", "bank", "fuel",
    ],
    "shop": True,
    "office": True,
    "building": ["dormitory", "university", "school", "college", "apartments", "commercial", "retail"],
    "leisure": ["park", "sports_centre", "fitness_centre"],
    "tourism": ["hostel", "hotel", "guest_house", "apartment"],
}

TRANSIT_TAGS = {
    "highway": "bus_stop",
    "public_transport": ["platform", "stop_position", "station"],
    "amenity": ["bus_station", "taxi", "motorcycle_parking"],
}

KEEP = ["name", "name:th", "name:en", "brand", "amenity", "shop", "office", "building",
        "leisure", "tourism", "cuisine", "opening_hours", "highway", "public_transport"]


def to_points(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Polygons (e.g. campus, dorm buildings) become their representative point."""
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.to_crs(METRIC_CRS).representative_point().to_crs(4326)
    return gdf


def tidy(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf.reset_index()
    gdf["osm_id"] = gdf["element"].str[0] + gdf["id"].astype(str)
    cols = [c for c in KEEP if c in gdf.columns]
    return gpd.GeoDataFrame(gdf[["osm_id", *cols]], geometry=gdf.geometry, crs=4326)


def campus() -> None:
    """KMUTT campus outline: used to flag in-campus shops and drawn on the map."""
    uni = ox.features_from_bbox(BBOX, tags={"amenity": "university"}).reset_index()
    uni = uni[uni.geom_type.isin(["Polygon", "MultiPolygon"])]
    kmutt = uni[uni["name"].fillna("").str.contains("พระจอมเกล้าธนบุรี|King Mongkut's University of Technology Thonburi", regex=True)]
    out = gpd.GeoDataFrame({"name": kmutt["name"]}, geometry=kmutt.geometry, crs=4326).dissolve().reset_index(drop=True)
    out.to_file(OUT / "campus.geojson", driver="GeoJSON", **GEOJSON_OPTS)
    manifest.record("campus", "osm", "campus.geojson", len(kmutt))
    print(f"campus polygons: {len(kmutt)} -> {out.geometry.iloc[0].area * 111_000**2:,.0f} m2 approx")


def main() -> None:
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(CACHE / "osmnx")
    bbox = BBOX  # osmnx 2.x: (left, bottom, right, top)

    poi = tidy(to_points(ox.features_from_bbox(bbox, tags=POI_TAGS)))
    poi = poi[poi["name"].notna() | poi["amenity"].isin(["university", "school", "college", "marketplace"])]
    poi.to_file(CACHE / "osm_poi.geojson", driver="GeoJSON")
    print(f"osm poi: {len(poi)}")

    transit = tidy(to_points(ox.features_from_bbox(bbox, tags=TRANSIT_TAGS)))
    transit["kind"] = (
        transit.get("highway", pd.Series(index=transit.index, dtype=object))
        .fillna(transit.get("amenity"))
        .fillna(transit.get("public_transport"))
    )
    transit = transit[["osm_id", "name", "kind", "geometry"]]
    transit.to_file(OUT / "transit.geojson", driver="GeoJSON", **GEOJSON_OPTS)
    manifest.record("transit", "osm", "transit.geojson", len(transit))
    print(f"transit: {len(transit)}")

    walk = ox.graph_from_bbox(bbox, network_type="walk", simplify=True)
    ox.save_graphml(walk, CACHE / "walk.graphml")
    print(f"walk graph: {len(walk.nodes)} nodes, {len(walk.edges)} edges")

    campus()


if __name__ == "__main__":
    main()
