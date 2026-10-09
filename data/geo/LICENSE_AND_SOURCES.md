# 地理データ出典と注意事項

## ZIP内の実データ

- GSHHS / GSHHG: Global Self-consistent Hierarchical High-resolution Geography Database
- Authors: Paul Wessel, Walter H. F. Smith
- Source: Basemap package's bundled GSHHS intermediate-resolution coastline and land polygons.
- Official reference: https://www.soest.hawaii.edu/wessel/gshhg/
- NOAA documentation: https://www.ngdc.noaa.gov/mgg/shorelines/shorelines.html
- GSHHG is released under the GNU Lesser General Public License (LGPL). When redistributing, preserve source attribution and applicable notices; see official terms for compliance.
- This bundle contains extracted geometry and scripts, not original Basemap binary files.

## OSM data (not yet acquired)

- © OpenStreetMap contributors, Open Database License (ODbL 1.0)
- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/
- OSM datasets **are not bundled** in this ZIP; source attribution and ODbL obligations apply if `fetch_osm.py` is run elsewhere and derived data published.
- Do not download OSM raster tiles in bulk. Use suitable permitted vector extracts instead.

## Accuracy

Shoreline is a **generalized, regional-scale shape**. Road access, fishing regulations, private property and water/shore changes are not represented. Never use as navigational or legal authority.
