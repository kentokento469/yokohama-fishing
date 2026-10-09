#!/usr/bin/env python3
"""関東 OSM のマスター PBF から、ゲーム用のタイル（PMTiles・ベクトルタイル）と索引を作る。マスターは読むだけで書き換えない。
  python3 tools/kanto/build_tiles.py extract  [--pbf data-master/kanto-261008.osm.pbf]   # PBF → data-build/features.sqlite（全タグ付き）
  python3 tools/kanto/build_tiles.py tiles    [--minzoom 4 --maxzoom 14 --jobs 4]         # features.sqlite → data/tiles/kanto.pmtiles
  python3 tools/kanto/build_tiles.py all                                                  # 両方
  python3 tools/kanto/build_tiles.py tags w123456                                          # 地物の全タグを表示（後から属性を足すとき）
出力：
  data-build/features.sqlite … ゲーム用に分類した地物（緯度経度の WKB・全タグ JSON・R*Tree 索引）。PBF から作り直せる中間データ
  data/tiles/<name>.pmtiles … Web メルカトル z/x/y のベクトルタイル（MVT・gzip）。z の低い所は主要な地物だけ・簡略化（LOD）
  data/tiles/index.json     … タイル索引（範囲・ズーム・レイヤー・件数・出典・マスターの SHA256）
  data/tiles/regions.json   … 地域索引（都県・市区町村の名前・範囲・中心。OSM の行政界から）
  data/tiles/layers.json    … レイヤー定義（ゲームも読む）
タイル境界：地物は64px（4096中）の余白付きで切り、ゲーム側でタイルの枠で切って描くので、継ぎ目で途切れない。
陸地：海岸線（陸が左）をタイルごとにつないで閉じる。海岸線の無いタイルは隣のタイルから陸・海を受け継ぐ（幅優先）。
"""
import argparse, gzip, json, math, os, sqlite3, sys, time
from collections import deque
from multiprocessing import Pool
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import layers as L  # noqa: E402

BUILD = ROOT / 'data-build'
TILES = ROOT / 'data' / 'tiles'
EXTENT, BUFFER = 4096, 64


# ===== 抽出：PBF → features.sqlite =====
def extract(pbf, db_path):
    import osmium
    from shapely import wkb as swkb
    BUILD.mkdir(exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    db = sqlite3.connect(db_path)
    db.executescript('''
      PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
      CREATE TABLE f(id INTEGER PRIMARY KEY, osm TEXT, layer TEXT, kind TEXT, minzoom INT, props TEXT, tags TEXT, geom BLOB, gtype TEXT);
      CREATE VIRTUAL TABLE fx USING rtree(id, x0, x1, y0, y1);
      CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT);''')
    fab = osmium.geom.WKBFactory()
    stats = {'nodes': 0, 'ways': 0, 'relations': 0, 'areas': 0, 'features': 0, 'geom_errors': 0}
    buf = []

    def add(osm, geom_hex, gtype, tags, cls):
        try:
            g = swkb.loads(geom_hex, hex=True)
        except Exception:
            stats['geom_errors'] += 1
            return
        if g.is_empty:
            return
        x0, y0, x1, y1 = g.bounds
        b = g.wkb
        tj = json.dumps(tags, ensure_ascii=False)
        for layer, kind, mz in cls:
            buf.append((osm, layer, kind, mz, json.dumps(L.props(layer, kind, tags), ensure_ascii=False), tj, b, gtype, x0, x1, y0, y1))
        if len(buf) > 20000:
            flush()

    def flush():
        cur = db.cursor()
        for r in buf:
            cur.execute('INSERT INTO f(osm,layer,kind,minzoom,props,tags,geom,gtype) VALUES(?,?,?,?,?,?,?,?)', r[:8])
            cur.execute('INSERT INTO fx VALUES(?,?,?,?,?)', (cur.lastrowid,) + r[8:])
        stats['features'] += len(buf)
        buf.clear()

    class H(osmium.SimpleHandler):
        def node(self, n):
            stats['nodes'] += 1
            if not n.tags:
                return
            tags = {t.k: t.v for t in n.tags}
            cls = L.classify(tags, 'point')
            if cls:
                add('n%d' % n.id, fab.create_point(n), 'point', tags, cls)

        def way(self, w):
            stats['ways'] += 1
            if not w.tags:
                return
            tags = {t.k: t.v for t in w.tags}
            cls = L.classify(tags, 'line')
            if cls:
                try:
                    add('w%d' % w.id, fab.create_linestring(w), 'line', tags, cls)
                except Exception:
                    stats['geom_errors'] += 1

        def relation(self, r):
            stats['relations'] += 1

        def area(self, a):
            stats['areas'] += 1
            tags = {t.k: t.v for t in a.tags}
            cls = L.classify(tags, 'area')
            if not cls:
                return
            osm = ('w%d' if a.from_way() else 'r%d') % a.orig_id()
            try:
                g = fab.create_multipolygon(a)
            except Exception:
                stats['geom_errors'] += 1
                return
            # 行政界・駐車場は面のほかに（行政界は境界線、駐車場は点として）使う。面のまま保存し、タイル化で形を変える
            add(osm, g, 'area', tags, cls)

    t0 = time.time()
    idx = 'sparse_file_array,' + str(BUILD / 'nodes.idx')
    H().apply_file(str(pbf), locations=True, idx=idx)
    flush()
    postprocess(db, stats)
    db.execute('INSERT INTO meta VALUES(?,?)', ('stats', json.dumps(stats)))
    db.execute('INSERT INTO meta VALUES(?,?)', ('pbf', str(pbf)))
    db.execute('CREATE INDEX f_layer ON f(layer)')
    db.commit()
    try:
        os.remove(BUILD / 'nodes.idx')
    except OSError:
        pass
    print('抽出', json.dumps(stats), f'{time.time() - t0:.0f}秒', flush=True)


def postprocess(db, stats):
    """河口：川（river/stream/canal）の端点が海岸線から約50m以内なら、河口の点を足す"""
    from shapely import wkb as swkb
    from shapely.geometry import Point
    from shapely.strtree import STRtree
    coast = [swkb.loads(g) for (g,) in db.execute("SELECT geom FROM f WHERE layer='coastline'")]
    if not coast:
        return
    tree = STRtree(coast)
    near = 50 / 111000
    n = 0
    for osm, tags, g in db.execute("SELECT osm,tags,geom FROM f WHERE layer='waterway' AND kind IN ('river','stream','canal')").fetchall():
        line = swkb.loads(g)
        if line.geom_type != 'LineString':
            continue
        for p in (line.coords[0], line.coords[-1]):
            pt = Point(p)
            for i in tree.query(pt.buffer(near)):
                if coast[i].distance(pt) < near:
                    t = json.loads(tags)
                    pr = {'kind': 'estuary', 'name': t.get('name'), 'waterway': t.get('waterway'), 'from': osm}
                    cur = db.execute('INSERT INTO f(osm,layer,kind,minzoom,props,tags,geom,gtype) VALUES(?,?,?,?,?,?,?,?)',
                                     (osm + ':mouth', 'shore', 'estuary', L.SHORE_Z['estuary'], json.dumps(pr, ensure_ascii=False), tags, pt.wkb, 'point'))
                    db.execute('INSERT INTO fx VALUES(?,?,?,?,?)', (cur.lastrowid, p[0], p[0], p[1], p[1]))
                    n += 1
                    break
    stats['estuaries'] = n


# ===== タイルの計算（Web メルカトル） =====
def lon2x(lon, z):
    return (lon + 180) / 360 * (1 << z)


def lat2y(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * (1 << z)


def tile_bounds(z, x, y):
    n = 1 << z
    lon0, lon1 = x / n * 360 - 180, (x + 1) / n * 360 - 180
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat0 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return lon0, lat0, lon1, lat1


def tiles_for_bbox(b, z):
    x0, x1 = int(lon2x(b[0], z)), int(lon2x(b[2], z))
    y0, y1 = int(lat2y(b[3], z)), int(lat2y(b[1], z))
    return x0, y0, x1, y1


# ===== 陸地：海岸線をタイルの枠でつないで閉じる（陸は左） =====
def land_polys(lines, bb):
    """lines: 枠 bb=(x0,y0,x1,y1)（緯度経度、北が上）で切った海岸線の断片。戻り値 (陸の多角形のリスト, 成功したか)"""
    from shapely.geometry import Polygon
    x0, y0, x1, y1 = bb
    W, H = x1 - x0, y1 - y0
    Lp = 2 * (W + H)
    eps = max(W, H) * 1e-6

    def per(p):  # 反時計回り：下辺を右へ→右辺を上へ→上辺を左へ→左辺を下へ
        x, y = p
        d = [abs(y - y0), abs(x - x1), abs(y - y1), abs(x - x0)]
        s = d.index(min(d))
        if min(d) > eps * 10:
            return None
        return [x - x0, W + (y - y0), W + H + (x1 - x), 2 * W + H + (y1 - y)][s]

    corners = [(W, (x1, y0)), (W + H, (x1, y1)), (2 * W + H, (x0, y1)), (Lp, (x0, y0))]
    polys, chains = [], []
    for c in lines:
        pts = list(c.coords)
        if len(pts) < 2:
            continue
        if pts[0] == pts[-1] and len(pts) > 3:
            polys.append(Polygon(pts))  # 島（枠の中で閉じている）
            continue
        ps, pe = per(pts[0]), per(pts[-1])
        if ps is None or pe is None:
            return polys, False  # 途中で切れた海岸線（データの欠け）
        chains.append({'pts': pts, 's': ps, 'e': pe, 'used': False})
    for first in chains:
        if first['used']:
            continue
        ring, cur = [], first
        while True:
            cur['used'] = True
            ring += cur['pts']
            e = cur['e']
            best, bd = None, None
            for c in chains:
                if c['used'] and c is not first:
                    continue
                d = (c['s'] - e) % Lp
                if bd is None or d < bd:
                    best, bd = c, d
            for lap in (0, 1):
                for cv, pt in corners:
                    v = cv + lap * Lp
                    if e < v < e + bd:
                        ring.append(pt)
            if best is first or best is None:
                break
            cur = best
        if len(ring) >= 3:
            polys.append(Polygon(ring))
    return polys, True


# ===== タイル化 =====
_W = {}


def worker_init(db_path):
    _W['db'] = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)


def to_px(g, z, x, y):
    """緯度経度 → タイル内のピクセル（0〜4096、y は下向き）"""
    import numpy as np
    import shapely
    n = 1 << z

    def f(c):
        lat = np.radians(c[:, 1])
        px = ((c[:, 0] + 180) / 360 * n - x) * EXTENT
        py = ((1 - np.log(np.tan(lat) + 1 / np.cos(lat)) / math.pi) / 2 * n - y) * EXTENT
        return np.column_stack([px, py])
    return shapely.transform(g, f)


def make_tile(job):
    """1タイルを作る。戻り値 (z, x, y, gz bytes or None, land state per edge or None, has_coast)"""
    import mapbox_vector_tile
    from shapely import wkb as swkb
    from shapely.geometry import box, Point
    from shapely.ops import linemerge
    z, x, y, land_full = job
    db = _W['db']
    lon0, lat0, lon1, lat1 = tile_bounds(z, x, y)
    bx = (lon1 - lon0) * BUFFER / EXTENT
    by = (lat1 - lat0) * BUFFER / EXTENT
    q = db.execute('SELECT f.layer,f.kind,f.props,f.geom,f.osm FROM fx JOIN f ON f.id=fx.id WHERE fx.x1>=? AND fx.x0<=? AND fx.y1>=? AND fx.y0<=? AND f.minzoom<=?',
                   (lon0 - bx, lon1 + bx, lat0 - by, lat1 + by, z)).fetchall()
    clip = box(-BUFFER, -BUFFER, EXTENT + BUFFER, EXTENT + BUFFER)
    tol = 0.5 if z >= 14 else 1.5
    minarea = 0 if z >= 14 else 6.0
    out = {}
    coast = []
    for layer, kind, props, g, osm in q:
        geom = swkb.loads(g)
        if layer == 'coastline':
            coast.append(geom)
        p = json.loads(props)
        p['id'] = osm
        if layer == 'boundary':
            geom = geom.boundary  # 行政界は線で持つ
        if layer == 'poi' and geom.geom_type in ('Polygon', 'MultiPolygon'):
            geom = geom.representative_point()
        gp = to_px(geom, z, x, y)
        if gp.geom_type in ('Polygon', 'MultiPolygon'):
            if gp.area < minarea:
                continue
            gp = gp.simplify(tol, preserve_topology=True)
        elif gp.geom_type in ('LineString', 'MultiLineString'):
            gp = gp.simplify(tol, preserve_topology=False)
        gp = gp.intersection(clip) if gp.geom_type != 'Point' else gp
        if gp.is_empty:
            continue
        if gp.geom_type == 'Point' and not clip.contains(gp):
            continue
        out.setdefault(layer, []).append({'geometry': gp, 'properties': p})
    # 陸地
    edge = None
    has_coast = bool(coast)
    bb = (lon0 - bx, lat0 - by, lon1 + bx, lat1 + by)
    if coast:
        merged = linemerge([c for c in coast if c.geom_type == 'LineString'])
        parts = merged.intersection(box(*bb))
        parts = [parts] if parts.geom_type == 'LineString' else list(getattr(parts, 'geoms', []))
        parts = [p for p in parts if p.geom_type == 'LineString']
        polys, ok = land_polys(parts, bb)
        if ok:
            from shapely.ops import unary_union
            land = unary_union(polys) if polys else None
            # 枠の各辺の中点の少し内側が陸か：海岸線の無い隣のタイルに受け継がせる（上・右・下・左）
            mx, my = (lon0 + lon1) / 2, (lat0 + lat1) / 2
            dx, dy = (lon1 - lon0) * .01, (lat1 - lat0) * .01
            pts = [Point(mx, lat1 - dy), Point(lon1 - dx, my), Point(mx, lat0 + dy), Point(lon0 + dx, my)]
            edge = [bool(land is not None and land.contains(pt)) for pt in pts]
            if land is not None and not land.is_empty:
                lp = to_px(land, z, x, y).simplify(tol, preserve_topology=True).intersection(clip)
                if not lp.is_empty:
                    out.setdefault('land', []).append({'geometry': lp, 'properties': {'kind': 'land'}})
        else:
            has_coast = 'broken'  # 海岸線が途中で切れている（範囲の端など）：陸・海は隣から受け継ぐ
            if land_full:
                out.setdefault('land', []).append({'geometry': box(-BUFFER, -BUFFER, EXTENT + BUFFER, EXTENT + BUFFER), 'properties': {'kind': 'land'}})
    elif land_full:
        out['land'] = [{'geometry': box(-BUFFER, -BUFFER, EXTENT + BUFFER, EXTENT + BUFFER), 'properties': {'kind': 'land'}}]
    if not out:
        return z, x, y, None, edge, has_coast
    layers = [{'name': k, 'features': v} for k, v in out.items()]
    data = mapbox_vector_tile.encode(layers, default_options={'extents': EXTENT, 'y_coord_down': True, 'quantize_bounds': None})
    return z, x, y, gzip.compress(data, 6), edge, has_coast


def build_tiles(db_path, out_name, minzoom, maxzoom, jobs, bbox=None):
    from pmtiles.tile import zxy_to_tileid, TileType, Compression
    from pmtiles.writer import Writer
    TILES.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(db_path)
    if bbox is None:
        r = db.execute('SELECT min(x0),min(y0),max(x1),max(y1) FROM fx').fetchone()
        bbox = r
    stats = json.loads(db.execute("SELECT v FROM meta WHERE k='stats'").fetchone()[0])
    counts = dict(db.execute('SELECT layer,count(*) FROM f GROUP BY layer').fetchall())
    t0 = time.time()
    results = {}
    zstats = {}
    for z in range(minzoom, maxzoom + 1):
        # このズームで中身があるタイル
        need = set()
        for x0, y0, x1, y1 in db.execute('SELECT fx.x0,fx.y0,fx.x1,fx.y1 FROM fx JOIN f ON f.id=fx.id WHERE f.minzoom<=?', (z,)):
            tx0, ty0, tx1, ty1 = tiles_for_bbox((x0, y0, x1, y1), z)
            if (tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400000:
                continue
            for tx in range(tx0, tx1 + 1):
                for ty in range(ty0, ty1 + 1):
                    need.add((tx, ty))
        gx0, gy0, gx1, gy1 = tiles_for_bbox(bbox, z)
        # 1回目：海岸線のあるタイル（陸の判定の種）
        with Pool(jobs, initializer=worker_init, initargs=(str(db_path),)) as pool:
            first = pool.map(make_tile, [(z, x, y, False) for (x, y) in sorted(need)], chunksize=16)
        state = {}
        q = deque()
        for (zz, x, y, data, edge, hc) in first:
            if edge:
                for (dx, dy), v in zip(((0, -1), (1, 0), (0, 1), (-1, 0)), edge):
                    state.setdefault((x + dx, y + dy), v)
                    q.append((x + dx, y + dy))
        coastal = {(x, y) for (zz, x, y, d, e, hc) in first if hc is True}
        # 幅優先：海岸線の無いタイルは隣と同じ陸・海
        seen = set()
        while q:
            t = q.popleft()
            if t in seen or t in coastal:
                continue
            seen.add(t)
            if not (gx0 - 1 <= t[0] <= gx1 + 1 and gy0 - 1 <= t[1] <= gy1 + 1):
                continue
            for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                n = (t[0] + dx, t[1] + dy)
                if n not in coastal and n not in state:
                    state[n] = state[t]
                    q.append(n)
        unknown_land = 0
        jobs2 = []
        for (zz, x, y, data, edge, hc) in first:
            if hc is True:
                if data:
                    results[zxy_to_tileid(z, x, y)] = data
            else:
                land = state.get((x, y))
                if land is None:
                    land = True  # 海岸線から届かない所（内陸の飛び地）は陸
                    unknown_land += 1
                jobs2.append((z, x, y, land))
        # 地物の無い陸のタイル（全面が陸）
        for (x, y), v in state.items():
            if v and (x, y) not in need and (x, y) not in coastal and gx0 <= x <= gx1 and gy0 <= y <= gy1:
                jobs2.append((z, x, y, True))
        with Pool(jobs, initializer=worker_init, initargs=(str(db_path),)) as pool:
            for (zz, x, y, data, edge, hc) in pool.imap_unordered(make_tile, jobs2, chunksize=16):
                if data:
                    results[zxy_to_tileid(z, x, y)] = data
        zstats[z] = {'broken_coast': sum(1 for r in first if r[5] == 'broken'), 'tiles': sum(1 for k in results if k >= zxy_to_tileid(z, 0, 0) and k < zxy_to_tileid(z + 1, 0, 0)), 'coastal': len(coastal), 'land_by_neighbour': sum(1 for v in state.values() if v), 'unknown_as_land': unknown_land}
        print(f'z{z}: {zstats[z]}  {time.time() - t0:.0f}秒', flush=True)
    path = TILES / f'{out_name}.pmtiles'
    with open(path, 'wb') as f:
        w = Writer(f)
        for tid in sorted(results):
            w.write_tile(tid, results[tid])
        header = {'tile_type': TileType.MVT, 'tile_compression': Compression.GZIP, 'min_zoom': minzoom, 'max_zoom': maxzoom,
                  'min_lon_e7': int(bbox[0] * 1e7), 'min_lat_e7': int(bbox[1] * 1e7), 'max_lon_e7': int(bbox[2] * 1e7), 'max_lat_e7': int(bbox[3] * 1e7),
                  'center_zoom': 10, 'center_lon_e7': int((bbox[0] + bbox[2]) / 2 * 1e7), 'center_lat_e7': int((bbox[1] + bbox[3]) / 2 * 1e7)}
        meta = {'name': out_name, 'attribution': '© OpenStreetMap contributors', 'license': 'ODbL 1.0',
                'vector_layers': [{'id': n, 'description': d} for n, lb, g, d in L.LAYERS]}
        w.finalize(header, meta)
    write_index(db, out_name, path, bbox, minzoom, maxzoom, zstats, counts, stats)
    print(f'{path} {path.stat().st_size:,} バイト・タイル {len(results):,}', flush=True)


def write_index(db, out_name, path, bbox, minzoom, maxzoom, zstats, counts, stats):
    from shapely import wkb as swkb
    master = {}
    mf = ROOT / 'data-master' / 'MANIFEST.json'
    if mf.exists():
        master = json.loads(mf.read_text())
    regions = []
    for osm, kind, props, g in db.execute("SELECT osm,kind,props,geom FROM f WHERE layer='boundary' AND kind IN ('admin4','admin7','admin8')"):
        p = json.loads(props)
        geom = swkb.loads(g)
        c = geom.representative_point()
        regions.append({'id': osm, 'level': int(kind[5:]), 'name': p.get('name'), 'name_en': p.get('name:en'),
                        'bbox': [round(v, 5) for v in geom.bounds], 'center': [round(c.x, 5), round(c.y, 5)], 'area_km2': round(geom.area * 111 * 91, 1)})
    regions.sort(key=lambda r: (r['level'], r['name'] or ''))
    (TILES / 'regions.json').write_text(json.dumps({'source': '© OpenStreetMap contributors (ODbL)', 'regions': regions}, ensure_ascii=False))
    (TILES / 'layers.json').write_text(json.dumps([{'id': n, 'label': lb, 'geometry': g, 'description': d} for n, lb, g, d in L.LAYERS], ensure_ascii=False, indent=1))
    idx = {'archive': path.name, 'bytes': path.stat().st_size, 'format': 'PMTiles v3 / MVT (gzip) / Web Mercator', 'extent': EXTENT, 'buffer': BUFFER,
           'minzoom': minzoom, 'maxzoom': maxzoom, 'bounds': [round(v, 5) for v in bbox], 'zooms': zstats, 'features_by_layer': counts, 'extract_stats': stats,
           'regions': len(regions), 'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
           'master': {k: master.get(k) for k in ('file', 'bytes', 'md5', 'sha256', 'url', 'fetched_at')} if master else None,
           'attribution': '© OpenStreetMap contributors', 'license': 'ODbL 1.0',
           'not_in_osm': ['海底地形', '水深', '魚の生息', '潮汐', '釣りの可否（規制は現地・管理者の情報で確認）']}
    (TILES / ('index.json' if out_name == 'kanto' else f'{out_name}.index.json')).write_text(json.dumps(idx, ensure_ascii=False, indent=1))


def main():
    global TILES
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['extract', 'tiles', 'all', 'tags'])
    ap.add_argument('ids', nargs='*')
    ap.add_argument('--pbf', default=str(ROOT / 'data-master' / 'kanto-261008.osm.pbf'))
    ap.add_argument('--db', default=str(BUILD / 'features.sqlite'))
    ap.add_argument('--name', default='kanto')
    ap.add_argument('--minzoom', type=int, default=4)
    ap.add_argument('--maxzoom', type=int, default=14)
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--out', default=str(TILES), help='出力先（既定 data/tiles）')
    a = ap.parse_args()
    TILES = Path(a.out)
    db = Path(a.db)
    if a.cmd in ('extract', 'all'):
        if not Path(a.pbf).exists():
            sys.exit(f'マスターの PBF がありません：{a.pbf}（tools/kanto/fetch_master.py で取得）')
        extract(Path(a.pbf), db)
    if a.cmd in ('tiles', 'all'):
        build_tiles(db, a.name, a.minzoom, a.maxzoom, a.jobs)
    if a.cmd == 'tags':
        con = sqlite3.connect(db)
        for i in a.ids:
            for layer, tags in con.execute('SELECT layer,tags FROM f WHERE osm=?', (i,)):
                print(i, layer, tags)


if __name__ == '__main__':
    main()
