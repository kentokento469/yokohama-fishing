#!/usr/bin/env python3
"""国土地理院ベクトルタイル（data-build/gsi/16、tools/gsi/fetch_tiles.py で取得）→ ゲーム用の実在地図データ（等倍）。
  python3 tools/gsi/build_world.py yokohama
出力：
  data/world/<名前>-base.js   … 陸（海・川を除いた多角形）、道路（種別・幅）、鉄道（駅部分つき）、地名・施設名、防波堤など。window.HamaWorldData[名前]
  data/world/<名前>-bld/<i>_<j>.bin … 建物の形（440m 四方ごと。Int16、0.1m 単位、タイルの左上から）
座標：geo.js と同じ変換（北緯35.345°・東経139.56° → (2400, 8300)、x 東・y 南、メートル）。
出典：国土地理院ベクトルタイル（optimal_bvmap-v1）を加工して作成（国土地理院コンテンツ利用規約、CC BY 4.0 互換）。
"""
import gzip, json, math, struct, sys
from collections import defaultdict
from pathlib import Path
import mapbox_vector_tile as mvt
from shapely.geometry import shape, box, Polygon, MultiPolygon, LineString, MultiLineString, GeometryCollection
from shapely.ops import unary_union, linemerge, transform as shapely_transform
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)

ROOT = Path(__file__).resolve().parents[2]
Z = 16
LAT0, LON0, X0, Y0, M_LON, M_LAT = 35.345, 139.56, 2400, 8300, 90826, 110950  # geo.js の SHONAN と同じ
BT = 440  # 建物ファイルの大きさ（m）＝チャンク 220m の 2×2


def to_game(lon, lat):
    return X0 + (lon - LON0) * M_LON, Y0 + (LAT0 - lat) * M_LAT


def tile_tf(tx, ty, ext):
    n = 2 ** Z

    def f(px, py, z=None):
        lon = (tx + px / ext) / n * 360 - 180
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + py / ext) / n))))
        return to_game(lon, lat)
    return f


def gtf(f):
    return lambda xs, ys, z=None: tuple(zip(*[f(x, y) for x, y in zip(xs, ys)])) if hasattr(xs, '__iter__') else f(xs, ys)


def parts(g, kind):
    if g.is_empty:
        return []
    if isinstance(g, (GeometryCollection, MultiPolygon, MultiLineString)):
        return [p for q in g.geoms for p in parts(q, kind)]
    if kind == 'poly' and isinstance(g, Polygon):
        return [g]
    if kind == 'line' and isinstance(g, LineString):
        return [g]
    return []


def q(v):  # 0.1m に丸めた整数
    return int(round(v * 10))


def flat(coords):  # 0.1m 単位、最初の点は絶対値・以降は前の点との差（ファイルを小さくする）
    out = []
    px = py = 0
    for k, (x, y) in enumerate(coords):
        X, Y = q(x), q(y)
        out += [X - px, Y - py]
        px, py = X, Y
    return out


CTG = {'市区町村道等': 0, '国道': 1, '都道府県道': 2, '高速自動車国道等': 3}
RT = {'JR': 0, 'JR以外': 1, '地下鉄': 2}
RS = {'通常部': 0, '橋・高架': 1, 'トンネル': 2, '地下': 3, '雪覆い': 4, '運休中': 5}


def snap_ends(lines, tol):
    """道の端が別の道の途中に接している所（T字路・タイルの境目）をつなぐ：端を一番近い道の上へ動かし、その道に点を足す（経路探索で道がつながるように）"""
    from shapely.strtree import STRtree
    from shapely.geometry import Point
    geoms = [l for _, l in lines]
    tree = STRtree(geoms)
    coords = [list(l.coords) for l in geoms]
    inserts = defaultdict(list)
    for i, l in enumerate(geoms):
        for end in (0, -1):
            p = Point(coords[i][end])
            best = None
            for j in tree.query(p.buffer(tol)):
                if j == i:
                    continue
                d = geoms[j].distance(p)
                if d < tol and (best is None or d < best[0]):
                    best = (d, j)
            if best:
                g = geoms[best[1]]
                t = g.project(p)
                q = g.interpolate(t)
                coords[i][end] = (q.x, q.y)
                if 1e-3 < t < g.length - 1e-3:
                    inserts[best[1]].append(t)
    out = []
    for i, (k, l) in enumerate(lines):
        c = coords[i]
        if inserts.get(i):
            # 線に沿った距離の順に点を足す
            g = LineString(c)
            pts = [(g.project(Point(xy)), xy) for xy in c] + [(t, tuple(g.interpolate(t).coords[0])) for t in inserts[i]]
            pts.sort(key=lambda v: v[0])
            c = [xy for _, xy in pts]
        out.append((k, LineString(c)))
    return out


def main():
    name = sys.argv[1]
    lat0, lon0, lat1, lon1 = [float(v) for v in (ROOT / 'data-build' / 'gsi' / f'{name}.bbox').read_text().split(',')]
    n = 2 ** Z

    def tl(lat, lon):
        r = math.radians(lat)
        return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)
    tx0, ty0 = tl(lat1, lon0)
    tx1, ty1 = tl(lat0, lon1)
    water, roads, rails, names, blds, strl, strca = [], defaultdict(list), defaultdict(list), [], [], [], []
    n_tiles = 0
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            f = ROOT / 'data-build' / 'gsi' / str(Z) / str(tx) / f'{ty}.pbf'
            if not f.exists():
                continue
            if f.stat().st_size == 0:  # データなし（404）＝沖の海
                water.append(shapely_transform(gtf(tile_tf(tx, ty, 4096)), box(0, 0, 4096, 4096)))
                continue
            b = f.read_bytes()
            if b[:2] == b'\x1f\x8b':
                b = gzip.decompress(b)
            t = mvt.decode(b, default_options={'y_coord_down': True})
            n_tiles += 1
            for lname, L in t.items():
                ext = L.get('extent', 4096)
                clip = box(0, 0, ext, ext)
                T = gtf(tile_tf(tx, ty, ext))
                for ft in L['features']:
                    p = ft['properties']
                    try:
                        g = shape(ft['geometry'])
                    except Exception:
                        continue
                    if lname == 'Anno':
                        if g.geom_type == 'Point' and 0 <= g.x < ext and 0 <= g.y < ext and p.get('vt_text'):
                            x, y = tile_tf(tx, ty, ext)(g.x, g.y)
                            names.append([p['vt_text'], p.get('vt_code', 0), round(x, 1), round(y, 1)])
                        continue
                    if lname not in ('WA', 'RdCL', 'RailCL', 'BldA', 'WStrL', 'StrctArea'):
                        continue
                    if not g.is_valid:
                        g = g.buffer(0)
                    g = g.intersection(clip)
                    if g.is_empty:
                        continue
                    g = shapely_transform(T, g)
                    c = p.get('vt_code', 0)
                    if lname == 'WA':
                        water += parts(g, 'poly')
                    elif lname == 'RdCL':
                        k = (c, p.get('vt_rdctg', ''), p.get('vt_width', 0), p.get('vt_lvorder', 0), p.get('vt_motorway', 9))
                        roads[k] += parts(g, 'line')
                    elif lname == 'RailCL':
                        k = (c, p.get('vt_rtcode', ''), p.get('vt_railstate', ''), p.get('vt_sngldbl', ''), p.get('vt_lvorder', 0))
                        rails[k] += parts(g, 'line')
                    elif lname == 'BldA':
                        blds += [(c, pp) for pp in parts(g, 'poly')]
                    elif lname == 'WStrL':
                        strl += [(c, pp) for pp in parts(g, 'line')]
                    elif lname == 'StrctArea':
                        strca += [(c, pp) for pp in parts(g, 'poly')]
    print('タイル', n_tiles, '水', len(water), '道路', sum(map(len, roads.values())), '鉄道', sum(map(len, rails.values())), '建物', len(blds), '地名', len(names))
    # 範囲（ゲーム座標）
    gx0, gy0 = to_game(lon0, lat1)
    gx1, gy1 = to_game(lon1, lat0)
    # 陸 = 範囲 − 水（海・川）。タイルの外側（データなし）は海とみなさない
    W = unary_union([w.buffer(0.05) for w in water]).buffer(-0.05)
    land = box(gx0, gy0, gx1, gy1).difference(W).simplify(0.8, preserve_topology=True)
    land_polys = [p for p in parts(land, 'poly') if p.area > 30]
    print('陸の多角形', len(land_polys), '頂点', sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors) for p in land_polys))

    def merge(groups, tol):
        out = []
        for k, ls in groups.items():
            m = linemerge(unary_union(ls)) if len(ls) > 1 else ls[0]
            for l in parts(m, 'line'):
                l = l.simplify(tol)
                if l.length > 1:
                    out.append((k, l))
        return out
    road_l = merge(roads, 0.6)
    road_l = snap_ends(road_l, 2.5)
    rail_l = merge(rails, 0.8)
    base = {
        'name': name, 'bbox': [round(gx0, 1), round(gy0, 1), round(gx1, 1), round(gy1, 1)], 'unit': 0.1,
        'source': '国土地理院ベクトルタイル（optimal_bvmap-v1）', 'license': '国土地理院コンテンツ利用規約（CC BY 4.0 互換）',
        'attribution': '「国土地理院ベクトルタイル」を加工して作成',
        'land': [[flat(p.exterior.coords)] + [flat(i.coords) for i in p.interiors] for p in land_polys],
        # 道路：[種類コード, 区分(0 市区町村道等・1 国道・2 都道府県道・3 高速・4 その他), 幅(m), 高さの順位(0 地上・1以上 高架), 自動車専用(1), 座標（差分）]
        'roads': [[k[0], CTG.get(k[1], 4), round(k[2] / 100, 1), k[3], 1 if k[4] == 1 else 0, flat(l.coords)] for k, l in road_l],
        # 鉄道：[種類コード, 区分(0 JR・1 JR以外・2 地下鉄・3 その他), 状態(0 通常・1 橋/高架・2 トンネル・3 地下・9 その他), 駅部分(1), 高さの順位, 座標（差分）]
        'rails': [[k[0], RT.get(k[1], 3), RS.get(k[2], 9), 1 if k[3] == '駅部分' else 0, k[4], flat(l.coords)] for k, l in rail_l],
        'names': names,
        'breakwaters': [[c, flat(l.simplify(0.5).coords)] for c, l in strl],
        'structs': [[c, flat(p.simplify(0.5).exterior.coords)] for c, p in strca if p.area > 4],
    }
    out = ROOT / 'data' / 'world'
    out.mkdir(parents=True, exist_ok=True)
    js = json.dumps(base, ensure_ascii=False, separators=(',', ':'))
    (out / f'{name}-base.js').write_text(f'/* 自動生成：tools/gsi/build_world.py（{base["attribution"]}）。直接編集しない */\n'
                                         f'(function(root){{const D={js};if(typeof module!=="undefined"&&module.exports)module.exports=D;else(root.HamaWorldData=root.HamaWorldData||{{}})[D.name]=D;}})(typeof self!=="undefined"?self:this);\n')
    print('base', round(len(js) / 1024), 'KB', '道路', len(road_l), '鉄道', len(rail_l), '防波堤', len(strl), '構造物', len(strca))
    # 建物：440m の区画ごと（区画の左上からの 0.1m 単位 Int16）。[種類(u16), 頂点数(u16), x,y …]
    bd = out / f'{name}-bld'
    bd.mkdir(exist_ok=True)
    for f in bd.glob('*.bin'):
        f.unlink()
    cells = defaultdict(list)
    for c, p in blds:
        p = p.simplify(0.3)
        if p.area < 6 or p.is_empty or not isinstance(p, Polygon):
            continue
        cx, cy = p.centroid.x, p.centroid.y
        i, j = math.floor(cx / BT), math.floor(cy / BT)
        cells[(i, j)].append((c, p))
    total = 0
    idx = []
    for (i, j), lst in cells.items():
        buf = bytearray()
        ox, oy = i * BT, j * BT
        for c, p in lst:
            pts = list(p.exterior.coords)[:-1]
            if len(pts) > 2000:
                continue
            buf += struct.pack('<HH', c, len(pts))
            for x, y in pts:
                buf += struct.pack('<hh', max(-32768, min(32767, q(x - ox))), max(-32768, min(32767, q(y - oy))))
        (bd / f'{i}_{j}.bin').write_bytes(bytes(buf))
        total += len(buf)
        idx.append([i, j, len(lst)])
    (bd / 'index.json').write_text(json.dumps({'size': BT, 'unit': 0.1, 'cells': idx}, separators=(',', ':')))
    print('建物', sum(len(v) for v in cells.values()), '区画', len(cells), round(total / 1024 / 1024, 1), 'MB')


if __name__ == '__main__':
    main()
