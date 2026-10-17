"""WorldPop 2025 100m grid clipped to the Bangmod bbox."""
import json
from pathlib import Path

import rasterio
import requests
from rasterio.windows import from_bounds

import manifest
from config import BBOX, CACHE, OUT, WORLDPOP_URL


def local_raster() -> Path:
    """WorldPop's server rejects HTTP range reads, so cache the national file once (~120 MB)."""
    path = CACHE / WORLDPOP_URL.rsplit("/", 1)[-1]
    if not path.exists():
        tmp = path.with_suffix(".part")
        with requests.get(WORLDPOP_URL, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 20):
                    f.write(chunk)
        tmp.rename(path)
    return path


def main() -> None:
    with rasterio.open(local_raster()) as src:
        window = from_bounds(*BBOX, transform=src.transform).round_offsets().round_lengths()
        data = src.read(1, window=window)
        transform = src.window_transform(window)
        nodata = src.nodata

    features, total = [], 0.0
    for row in range(data.shape[0]):
        for col in range(data.shape[1]):
            pop = float(data[row, col])
            if (nodata is not None and pop == nodata) or pop <= 0:
                continue
            x0, y0 = transform * (col, row)
            x1, y1 = transform * (col + 1, row + 1)
            total += pop
            features.append({
                "type": "Feature",
                "properties": {"pop": round(pop, 1)},
                "geometry": {"type": "Polygon", "coordinates": [[
                    [round(x0, 6), round(y0, 6)], [round(x1, 6), round(y0, 6)],
                    [round(x1, 6), round(y1, 6)], [round(x0, 6), round(y1, 6)],
                    [round(x0, 6), round(y0, 6)],
                ]]},
            })

    (OUT / "population.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")),
        encoding="utf-8",
    )
    manifest.record("population", "worldpop", "population.geojson", len(features),
                    total_pop=round(total), cell_m=100, year=2025)
    print(f"population cells: {len(features)}, total ≈ {total:,.0f}")


if __name__ == "__main__":
    main()
