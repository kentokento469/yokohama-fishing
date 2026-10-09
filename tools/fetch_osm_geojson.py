#!/usr/bin/env python3
# 提供された地図データパック（Shonan_Game_Map_Data.zip）の tools/fetch_osm.py。出力先だけ data/geo/src に変えた。変換後は node tools/import_geo.mjs
"""Download OSM *vector geometry* through Overpass or convert a saved Overpass JSON.
Use from outside restricted networks; no tiles or API credentials are needed.
Python 3.9+ standard library only.
Examples:
    python tools/fetch_osm.py --fetch --region hiratsuka --detail light
    python tools/fetch_osm.py --fetch --region shonan --detail full
    python tools/fetch_osm.py --from-json raw_osm
"""
from __future__ import annotations
import argparse, json, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from collections import defaultdict

BASE=Path(__file__).resolve().parents[1]
DATA=BASE/'data'/'geo'/'src'
RAW=BASE/'data'/'geo'/'raw_osm'
# These are extraction boxes, NOT municipal boundary geometries.
REGIONS={
    'hiratsuka':(139.30,35.28,139.39,35.37),
    'oiso':(139.26,35.25,139.34,35.36),
    'chigasaki':(139.38,35.29,139.46,35.39),
    'fujisawa':(139.44,35.27,139.54,35.39),
    'kamakura':(139.52,35.26,139.63,35.40),
    'shonan':(139.26,35.25,139.63,35.40),
}
ENDPOINTS=[
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
]

def query(bbox,detail):
    w,s,e,n=bbox
    bboxtext=f'({s:.6f},{w:.6f},{n:.6f},{e:.6f})'
    # Omit buildings by default to lighten traffic and keep public API polite.
    rules=[
        'way["highway"]',
        'way["natural"~"^(coastline|beach|water|wetland|cliff|rock|wood)$"]',
        'way["waterway"]',
        'way["man_made"~"^(pier|breakwater|groyne|embankment)$"]',
        'nwr["amenity"~"^(parking|bicycle_parking)$"]',
        'way["leisure"~"^(park|marina)$"]',
        'way["landuse"~"^(grass|forest|recreation_ground)$"]',
    ]
    if detail=='full':rules.append('way["building"]')
    return '[out:json][timeout:160];(' + ''.join(r+bboxtext+';' for r in rules) + ');out geom;'

def fetch_one(bbox,detail,timeout):
    q=query(bbox,detail)
    body=urllib.parse.urlencode({'data':q}).encode()
    problems=[]
    for url in ENDPOINTS:
        for attempt in range(2):
            try:
                req=urllib.request.Request(url, data=body, headers={'User-Agent':'ShonanFishingGameDataPreparation/1.0 (individual non-commercial use)', 'Accept':'application/json'})
                with urllib.request.urlopen(req,timeout=timeout) as resp:
                    obj=json.loads(resp.read().decode('utf-8'))
                if not isinstance(obj.get('elements'),list):raise ValueError('Overpass response missing elements')
                return obj
            except Exception as exc:
                problems.append(f'{url} attempt {attempt+1}: {exc}')
                time.sleep(2+attempt*3)
    raise RuntimeError('All Overpass endpoints failed: '+' / '.join(problems))

def tiles(region):
    if region!='shonan':return [(region,REGIONS[region])]
    # Bounded strips, to avoid a single enormous overpass query.
    w,s,e,n=REGIONS[region]
    out=[]
    strips=6
    for j in range(strips):
        a=w+(e-w)*j/strips; b=w+(e-w)*(j+1)/strips
        for k in range(2):
            c=s+(n-s)*k/2; d=s+(n-s)*(k+1)/2
            out.append((f'shonan_{j+1:02}_{k+1}',(a,c,b,d)))
    return out

def layer_for(tags):
    if 'highway' in tags:return 'roads'
    if tags.get('natural')=='coastline':return 'osm_coastline'
    if tags.get('natural')=='beach':return 'beaches'
    if tags.get('natural') in ['water','wetland']:return 'water'
    if tags.get('natural') in ['cliff','rock','wood']:return 'terrain'
    if 'waterway' in tags:return 'waterways'
    if tags.get('amenity')=='parking':return 'parking'
    if tags.get('amenity')=='bicycle_parking':return 'bicycle_parking'
    if tags.get('man_made') in ['pier','breakwater','groyne','embankment']:return 'coastal_structures'
    if tags.get('leisure') in ['park','marina']:return 'parks'
    if 'building' in tags:return 'buildings'
    if 'landuse' in tags:return 'landuse'
    return 'other'

def convert(data):
    layers=defaultdict(list)
    for el in data.get('elements',[]):
        tags=el.get('tags') or {}
        if not tags:continue
        layer=layer_for(tags)
        if layer=='other':continue
        typ=el.get('type','')
        coords=None; geomtype=None
        if typ=='node' and 'lon' in el and 'lat' in el:
            coords=[el['lon'],el['lat']]; geomtype='Point'
        elif typ=='way' and 'geometry' in el:
            coords=[[p['lon'],p['lat']] for p in el['geometry'] if 'lat' in p and 'lon' in p]
            if len(coords)<2:continue
            is_area=(len(coords)>=4 and coords[0]==coords[-1] and layer in ['beaches','water','parking','parks','buildings','landuse','terrain'])
            geomtype='Polygon' if is_area else 'LineString'
            if is_area:coords=[coords]
        elif typ=='relation':
            # OSM multipolygon relations need a ring assembler; do not emit false polygons.
            continue
        if not geomtype:continue
        props={'osm_type':typ,'osm_id':el.get('id'),'source':'OpenStreetMap','tags':tags}
        if typ=='way':props['osm_node_ids']=el.get('nodes',[])
        layers[layer].append({'type':'Feature','id':f'osm-{typ}-{el.get("id")}', 'properties':props,'geometry':{'type':geomtype,'coordinates':coords}})
    return layers

def main():
    ap=argparse.ArgumentParser(description='Collect OSM vector data for the Shonan fishing game')
    mux=ap.add_mutually_exclusive_group(required=True)
    mux.add_argument('--fetch',action='store_true',help='download using Overpass')
    mux.add_argument('--from-json',type=Path,help='process a local saved Overpass JSON file or folder')
    ap.add_argument('--region',choices=sorted(REGIONS),default='hiratsuka')
    ap.add_argument('--detail',choices=['light','full'],default='light')
    ap.add_argument('--timeout',type=int,default=210)
    args=ap.parse_args()
    DATA.mkdir(parents=True,exist_ok=True);RAW.mkdir(parents=True,exist_ok=True)
    files=[]
    if args.fetch:
        for label,bbox in tiles(args.region):
            dest=RAW/f'{label}_{args.detail}.json'
            if dest.exists() and dest.stat().st_size>100:
                print('using cached raw JSON',dest)
            else:
                print('requesting',label,bbox,flush=True)
                obj=fetch_one(bbox,args.detail,args.timeout)
                dest.write_text(json.dumps(obj,ensure_ascii=False),encoding='utf-8')
                time.sleep(3)
            files.append(dest)
    else:
        src=args.from_json
        files=sorted(src.glob('*.json')) if src.is_dir() else [src]
    if not files:raise SystemExit('No JSON files to process')
    collected=defaultdict(dict)
    loaded=0
    for path in files:
        obj=json.loads(path.read_text(encoding='utf-8'))
        loaded+=len(obj.get('elements',[]))
        for layer,features in convert(obj).items():
            for f in features:collected[layer][f['id']]=f
    counts={}
    for name,byid in collected.items():
        features=list(byid.values())
        counts[name]=len(features)
        (DATA/f'{name}_osm.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features,'metadata':{'source':'OpenStreetMap via Overpass','crs':'EPSG:4326','license':'ODbL 1.0','attribution':'© OpenStreetMap contributors','geo_scope':args.region,'partial_relations':True}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    manifest={'region':args.region,'detail':args.detail,'files_processed':len(files),'raw_osm_elements':loaded,'feature_counts':counts,'source':'OpenStreetMap contributors','license':'ODbL 1.0','notes':'Relations/multipolygons not assembled; ways may be incomplete along bbox edges; validate routing/access on original tags.'}
    (DATA/'osm_import_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('IMPORTED',json.dumps(manifest,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
