"""関東 OSM のゲーム用レイヤー定義（build_tiles.py が使い、data/tiles/layers.json に書き出してゲームも読む）。
各レイヤー：どのタグを拾うか（classify）、表示を始めるズーム（minzoom）、タイルに入れる属性（keep）。
タイルには表示用の属性だけを入れ、全タグは特徴ストア（features.sqlite）とマスターの PBF に残す。
釣りに関係する岸の種類（shore）：beach 砂浜 / rocky 磯・岩 / pier 桟橋 / breakwater 防波堤 / groyne 突堤 / seawall 護岸 /
  harbour 港 / marina マリーナ / fishing 釣り場（leisure=fishing）/ estuary 河口（川の終点が海岸線の近く。後処理で求める）
"""

ROAD_Z = {'motorway': 6, 'trunk': 6, 'motorway_link': 9, 'trunk_link': 9, 'primary': 8, 'primary_link': 11, 'secondary': 9, 'secondary_link': 12,
          'tertiary': 10, 'tertiary_link': 12, 'unclassified': 12, 'residential': 12, 'living_street': 13, 'service': 13, 'road': 12,
          'pedestrian': 13, 'track': 13, 'footway': 14, 'path': 14, 'cycleway': 13, 'steps': 14, 'bridleway': 14, 'busway': 12, 'corridor': 14}
RAIL_Z = {'rail': 8, 'subway': 10, 'light_rail': 10, 'monorail': 10, 'tram': 11, 'narrow_gauge': 10, 'funicular': 12, 'preserved': 12}
WATERWAY_Z = {'river': 8, 'canal': 10, 'stream': 12, 'drain': 13, 'ditch': 14, 'tidal_channel': 12}
PLACE_Z = {'city': 6, 'town': 8, 'village': 10, 'suburb': 11, 'quarter': 12, 'neighbourhood': 13, 'island': 9, 'islet': 12, 'hamlet': 12}
POI_Z = {'station': 10, 'halt': 11, 'ferry_terminal': 10, 'parking': 13, 'bicycle_parking': 14, 'fuel': 13, 'fishing': 11, 'harbour': 10}
SHORE_Z = {'beach': 10, 'rocky': 11, 'pier': 11, 'breakwater': 11, 'groyne': 12, 'seawall': 12, 'harbour': 10, 'marina': 11, 'fishing': 11, 'estuary': 10}

KEEP_COMMON = ['name', 'name:en']
KEEP = {
    'roads': ['highway', 'bridge', 'tunnel', 'layer', 'oneway', 'access', 'motor_vehicle', 'bicycle', 'foot', 'surface', 'lanes', 'ref', 'maxspeed'],
    'railway': ['railway', 'service', 'usage', 'bridge', 'tunnel', 'layer'],
    'waterway': ['waterway', 'tunnel', 'intermittent', 'tidal'],
    'water': ['natural', 'water', 'landuse', 'waterway', 'intermittent', 'salt'],
    'coastline': [],
    'shore': ['natural', 'man_made', 'harbour', 'landuse', 'leisure', 'barrier', 'access', 'fishing', 'surface'],
    'buildings': ['building', 'building:levels', 'height', 'min_height', 'building:min_level', 'roof:shape', 'roof:levels', 'amenity', 'shop'],
    'landuse': ['landuse', 'leisure', 'amenity'],
    'natural': ['natural', 'leaf_type', 'surface'],
    'park': ['leisure', 'boundary', 'protect_class'],
    'boundary': ['admin_level', 'boundary'],
    'place': ['place', 'population'],
    'poi': ['amenity', 'shop', 'tourism', 'railway', 'public_transport', 'leisure', 'man_made', 'harbour', 'capacity', 'fee', 'opening_hours', 'operator'],
}
LAYERS = [
    # name, label, geometry, description
    ('land', '陸地', 'polygon', '海岸線（natural=coastline）からタイルごとに組み立てた陸。海はタイルが無い所'),
    ('coastline', '海岸線', 'line', 'natural=coastline（陸が進行方向の左）'),
    ('water', '水域', 'polygon', '湖・池・川の面・貯水池・港内の水面など'),
    ('waterway', '河川（線）', 'line', '川・運河・小川・水路'),
    ('shore', '岸の地物', 'any', '砂浜・磯・桟橋・防波堤・突堤・護岸・港・マリーナ・釣り場・河口（釣りの判定用）'),
    ('landuse', '土地利用', 'polygon', '住宅・商業・工業・農地・港湾など'),
    ('natural', '自然', 'polygon', '森林・草地・湿地・岩・砂など'),
    ('park', '公園', 'polygon', '公園・緑地・自然保護区'),
    ('roads', '道路', 'line', 'highway=*（歩道・自転車道を含む）'),
    ('railway', '鉄道', 'line', 'railway=*'),
    ('buildings', '建物', 'polygon', 'building=*'),
    ('boundary', '行政界', 'line', 'boundary=administrative（都県・市区町村）'),
    ('place', '地名', 'point', 'place=*'),
    ('poi', '施設', 'point', '駅・駐車場・駐輪場・給油所・店・観光地など'),
]


def classify(tags, geom):
    """タグ → (layer, kind, minzoom) のリスト。geom は 'point' / 'line' / 'area'。"""
    out = []
    t = tags.get
    hw, rw, ww, nat, mm, lu, le = t('highway'), t('railway'), t('waterway'), t('natural'), t('man_made'), t('landuse'), t('leisure')
    if geom == 'line':
        if nat == 'coastline':
            out.append(('coastline', 'coastline', 4))
        if hw and t('area') != 'yes' and hw in ROAD_Z:
            out.append(('roads', hw, ROAD_Z[hw]))
        if rw in RAIL_Z:
            out.append(('railway', rw, RAIL_Z[rw]))
        if ww in WATERWAY_Z:
            out.append(('waterway', ww, WATERWAY_Z[ww]))
        if mm in ('pier', 'breakwater', 'groyne', 'quay'):
            out.append(('shore', {'quay': 'seawall'}.get(mm, mm), SHORE_Z.get(mm, 12)))
        if t('barrier') in ('sea_wall', 'seawall') or mm == 'dyke':
            out.append(('shore', 'seawall', 12))
        if nat == 'cliff':
            out.append(('shore', 'rocky', 12))
    elif geom == 'area':
        if t('building') and t('building') != 'no':
            out.append(('buildings', t('building'), 14))
        if nat in ('water', 'bay', 'strait') or t('water') or lu in ('reservoir', 'basin') or ww in ('riverbank', 'dock'):
            out.append(('water', t('water') or nat or lu or ww, 9))
        if nat == 'beach' or (nat == 'sand' and t('surface') == 'sand'):
            out.append(('shore', 'beach', SHORE_Z['beach']))
        if nat in ('bare_rock', 'rock', 'reef', 'shingle'):
            out.append(('shore', 'rocky', SHORE_Z['rocky']))
        if mm in ('pier', 'breakwater', 'groyne'):
            out.append(('shore', mm, SHORE_Z[mm]))
        if lu in ('harbour', 'port') or t('harbour') in ('yes', 'port') or t('industrial') == 'port':
            out.append(('shore', 'harbour', SHORE_Z['harbour']))
        if le == 'marina':
            out.append(('shore', 'marina', SHORE_Z['marina']))
        if le == 'fishing':
            out.append(('shore', 'fishing', SHORE_Z['fishing']))
        if lu:
            out.append(('landuse', lu, 10 if lu in ('forest', 'residential', 'industrial', 'farmland', 'commercial', 'military') else 12))
        if nat in ('wood', 'scrub', 'grassland', 'heath', 'wetland', 'sand', 'scree', 'glacier', 'mud'):
            out.append(('natural', nat, 10))
        if le in ('park', 'garden', 'nature_reserve', 'golf_course', 'pitch', 'playground', 'recreation_ground') or t('boundary') in ('national_park', 'protected_area'):
            out.append(('park', le or t('boundary'), 11))
        if t('boundary') == 'administrative' and t('admin_level') in ('2', '4', '7', '8'):
            out.append(('boundary', 'admin' + t('admin_level'), {'2': 4, '4': 5, '7': 9, '8': 10}[t('admin_level')]))
        if t('amenity') in ('parking', 'bicycle_parking'):
            out.append(('poi', t('amenity'), POI_Z[t('amenity')]))
    else:  # point
        pl = t('place')
        if pl in PLACE_Z:
            out.append(('place', pl, PLACE_Z[pl]))
        if le == 'fishing':
            out.append(('shore', 'fishing', SHORE_Z['fishing']))
        if t('railway') in ('station', 'halt') or t('public_transport') == 'station':
            out.append(('poi', 'station', POI_Z['station']))
        elif t('amenity') == 'ferry_terminal':
            out.append(('poi', 'ferry_terminal', POI_Z['ferry_terminal']))
        elif t('amenity') in POI_Z:
            out.append(('poi', t('amenity'), POI_Z[t('amenity')]))
        elif t('amenity') or t('shop') or t('tourism') or t('harbour') or t('historic'):
            k = t('amenity') or ('shop' if t('shop') else None) or t('tourism') or ('harbour' if t('harbour') else None) or 'historic'
            out.append(('poi', k, 14))
    return out


def props(layer, kind, tags):
    p = {'kind': kind}
    for k in KEEP_COMMON + KEEP.get(layer, []):
        v = tags.get(k)
        if v is not None:
            p[k] = v
    return p
