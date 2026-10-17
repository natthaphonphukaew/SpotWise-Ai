"""Shared settings for the Bangmod data pipeline."""
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "data-pipeline"
CACHE = PIPELINE / "cache"
OUT = ROOT / "public" / "data" / "bangmod"

# KMUTT Bangmod campus (approx. centre of the main campus)
CENTER = (100.4943, 13.6512)  # lon, lat

# ~2.5 km around KMUTT: catchments + competitors just outside the walk zone
BBOX = (100.4712, 13.6287, 100.5174, 13.6737)  # west, south, east, north

# Projected CRS for metric operations (UTM 47N)
METRIC_CRS = "EPSG:32647"

WALK_SPEED_M_PER_MIN = 75  # ~4.5 km/h
ISOCHRONE_MINUTES = (5, 10)

WORLDPOP_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2025/THA/v1/100m/"
    "constrained/tha_pop_2025_CN_100m_R2025A_v1.tif"
)

FETCHED = date.today().isoformat()

# Compact, standards-compliant GeoJSON for the web app
GEOJSON_OPTS = {"RFC7946": "YES", "COORDINATE_PRECISION": 6}

CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
