#!/usr/bin/env python3
# 提供パック（Yokohama_Kamakura_Oiso_Map_Data.zip）の tools/import_osm_geojson.py。入出力を data/geo/src に変えた。そのあと node tools/import_geo.mjs
"""Import a user-downloaded OSM GeoJSON or ZIP GeoJSON extract into area layers.
Usage: python tools/import_osm_geojson.py downloads/your_BBBike_extract.zip
Python deps: shapely (pip install shapely). This script makes NO network requests.
"""
import argparse, json, zipfile, hashlib
from pathlib import Path
from collections import defaultdict
from shapely.geometry import shape, mapping, box
from shapely.errors import GEOSException

BASE=Path(__file__).resolve().parents[1]
MANIFEST=json.loads((BASE/'data/geo/src/manifest.json').read_text(encoding='utf-8'))
AREAS={k:box(*v['bbox_wsen']) for k,v in MANIFEST['areas'].items()}
BBOX=box(*MANIFEST['coverage_bbox_wsen'])

FILTER_TAGS={'highway','building','natural','waterway','amenity','leisure','man_made','landuse','barrier','name','access','foot','bicycle','motor_vehicle','oneway','surface','bridge','tunnel','area'}
def tags_of(props):
 t=props.get('tags',{})
 if isinstance(t,str):
  try:t=json.loads(t)
  except json.JSONDecodeError:t={}
 if not isinstance(t,dict):t={}
 for k,v in props.items():
  if k in FILTER_TAGS and v is not None and v!='':t.setdefault(k,v)
 return t

def layers_of(tags):
 result=[]
 if tags.get('highway'):
  result.append('roads')
  if tags['highway'] in ['footway','pedestrian','steps','path','living_street']:result.append('walking_paths')
  if tags['highway'] in ['cycleway','path'] or tags.get('bicycle') in ['yes','designated']:result.append('cycle_routes')
 if tags.get('building'):result.append('buildings')
 if tags.get('natural')=='coastline':result.append('coastline')
 if tags.get('natural')=='beach':result.append('beaches')
 if tags.get('natural') in ['water','wetland']:result.append('water')
 if tags.get('natural') in ['wood','cliff','rock','scree','sand']:result.append('terrain')
 if tags.get('waterway'):result.append('waterways')
 if tags.get('amenity')=='parking':result.append('parking')
 if tags.get('amenity')=='bicycle_parking':result.append('bicycle_parking')
 if tags.get('man_made') in ['pier','breakwater','groyne','embankment','seawall'] or tags.get('barrier')=='sea_wall':result.append('coastal_structures')
 if tags.get('leisure') in ['park','marina']:result.append('parks')
 if tags.get('landuse'):result.append('landuse')
 return list(dict.fromkeys(result))

def fiter(source:Path):
 if source.suffix.lower()=='.zip':
  with zipfile.ZipFile(source) as z:
   entries=[s for s in z.namelist() if s.lower().endswith(('.geojson','.json')) and not s.startswith('__MACOSX')]
   for e in entries:
    try:
     with z.open(e) as fh:
      obj=json.load(fh)
    except (ValueError,UnicodeError):continue
    if isinstance(obj,dict) and obj.get('type')=='FeatureCollection':
     for f in obj.get('features',[]):yield f
 elif source.suffix.lower() in ('.geojson','.json'):
  obj=json.loads(source.read_text(encoding='utf-8'))
  if not isinstance(obj,dict) or obj.get('type')!='FeatureCollection':raise ValueError('Input must be GeoJSON FeatureCollection')
  yield from obj.get('features',[])
 else:raise ValueError('Use a GeoJSON file or ZIP with GeoJSON files, NOT a Kanto PBF')

def main():
 ap=argparse.ArgumentParser();ap.add_argument('geojson_or_zip',type=Path);args=ap.parse_args()
 src=args.geojson_or_zip
 if not src.exists():raise SystemExit('Missing input file '+str(src))
 aggregated=defaultdict(dict);regions=defaultdict(lambda:defaultdict(dict)); skipped=0;read=0
 for f in fiter(src):
  read+=1
  props=f.get('properties') or {}
  tags=tags_of(props)
  categories=layers_of(tags)
  if not categories:continue
  try:
   g=shape(f['geometry'])
   if g.is_empty or not g.intersects(BBOX):continue
   if not g.is_valid:g=g.buffer(0)
   g=g.intersection(BBOX)
   if g.is_empty:continue
  except (KeyError,ValueError,GEOSException,TypeError):skipped+=1;continue
  ident=str(f.get('id') or props.get('@id') or props.get('osm_id') or props.get('id') or hashlib.md5(json.dumps(f.get('geometry'),sort_keys=True).encode()).hexdigest())
  for category in categories:
   if ident in aggregated[category]:continue
   feature={'type':'Feature','id':ident,'properties':{'source':'OpenStreetMap','license':'ODbL-1.0', 'osm_tags':tags,'name':tags.get('name',props.get('name',''))},'geometry':mapping(g)}
   aggregated[category][ident]=feature
   for region,area in AREAS.items():
    if not g.intersects(area):continue
    cut=g.intersection(area)
    if cut.is_empty:continue
    per={**feature,'geometry':mapping(cut)}
    regions[region][category][ident]=per
 (BASE/'data/geo/src/osm').mkdir(exist_ok=True)
 all_counts={}
 for category,items in aggregated.items():
  output=BASE/f'data/geo/src/osm/{category}.geojson'
  output.write_text(json.dumps({'type':'FeatureCollection','features':list(items.values()),'metadata':{'source':'OpenStreetMap','license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','import_source':src.name}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
  all_counts[category]=len(items)
 for area,group in regions.items():
  for category,items in group.items():
   output=BASE/f'data/geo/src/osm/{area}_{category}.geojson'
   output.write_text(json.dumps({'type':'FeatureCollection','features':list(items.values()),'metadata':{'source':'OpenStreetMap','license':'ODbL-1.0','area':area}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 metadata={'imported_from':src.name,'status':'OSM GeoJSON imported','input_features':read,'skipped_invalid_geometry':skipped,'counts_all':all_counts,'area_counts':{a:{l:len(items) for l,items in layers.items()} for a,layers in regions.items()},'crs':'EPSG:4326','license':'ODbL-1.0','attribution':'© OpenStreetMap contributors', 'advisory':'not navigation grade; respect access and fishing prohibitions'}
 (BASE/'data/geo/src/osm/osm_import_manifest.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(metadata,ensure_ascii=False,indent=2))
 if not all_counts:raise SystemExit('No OSM features with relevant tags were imported; check extract format')
if __name__=='__main__':main()
