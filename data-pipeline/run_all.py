"""Run the whole Bangmod pipeline in order."""
import s00_osm_reference
import s01_overture
import s02_osm
import s03_population
import s04_isochrones
import s05_merge_poi

if __name__ == "__main__":
    for step in (s00_osm_reference, s01_overture, s02_osm, s03_population, s05_merge_poi, s04_isochrones):
        print(f"== {step.__name__}")
        step.main()
