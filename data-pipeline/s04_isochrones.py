"""Walking isochrones (5/10 min) for each candidate location, from the OSM walk graph."""
import json

import geopandas as gpd
import networkx as nx
import osmnx as ox
from shapely.geometry import LineString, Point
from shapely.ops import unary_union

import manifest
from config import CACHE, GEOJSON_OPTS, ISOCHRONE_MINUTES, METRIC_CRS, OUT, PIPELINE, WALK_SPEED_M_PER_MIN

EDGE_BUFFER_M = 30


def isochrone(G, node, meters: float):
    sub = nx.ego_graph(G, node, radius=meters, distance="length", undirected=True)
    lines = []
    for u, v, data in sub.edges(data=True):
        geom = data.get("geometry")
        if geom is None:
            geom = LineString([(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])])
        lines.append(geom)
    pts = [Point(G.nodes[n]["x"], G.nodes[n]["y"]) for n in sub.nodes]
    shape = unary_union([g.buffer(EDGE_BUFFER_M) for g in lines + pts])
    return shape.buffer(15).buffer(-15)  # smooth small gaps


def main() -> None:
    candidates = json.loads((PIPELINE / "candidates.json").read_text(encoding="utf-8"))
    G = ox.project_graph(ox.load_graphml(CACHE / "walk.graphml"), to_crs=METRIC_CRS)

    rows = []
    for c in candidates:
        x, y = gpd.GeoSeries([Point(c["lon"], c["lat"])], crs=4326).to_crs(METRIC_CRS).iloc[0].coords[0]
        node, snap_m = ox.distance.nearest_nodes(G, x, y, return_dist=True)
        for minutes in ISOCHRONE_MINUTES:
            rows.append({
                "candidate": c["id"], "minutes": minutes, "snap_m": round(snap_m),
                "geometry": isochrone(G, node, minutes * WALK_SPEED_M_PER_MIN),
            })

    gdf = gpd.GeoDataFrame(rows, crs=METRIC_CRS).to_crs(4326)
    gdf["geometry"] = gdf.geometry.simplify(0.00003)
    gdf.to_file(OUT / "isochrones.geojson", driver="GeoJSON", **GEOJSON_OPTS)
    (OUT / "candidates.json").write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest.record("isochrones", "osm", "isochrones.geojson", len(gdf),
                    walk_speed_m_per_min=WALK_SPEED_M_PER_MIN, minutes=list(ISOCHRONE_MINUTES))
    print(f"isochrones: {len(gdf)} for {len(candidates)} candidates")


if __name__ == "__main__":
    main()
