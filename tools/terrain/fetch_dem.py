#!/usr/bin/env python3
"""国土地理院の標高タイル（dem5a_png → 無ければ dem_png）を取得して、ゲーム用の格子にまとめる。
  python3 tools/terrain/fetch_dem.py honmoku 35.395,139.655,35.425,139.69 [--z 15]
  python3 tools/terrain/fetch_dem.py honmoku BBOX --from-dir DIR   # 手元の PNG（DIR/<z>/<x>/<y>.png）から作る
出力：data/terrain/<名前>.json（manifest・出典）と <名前>.bin（Int16、0.1m 単位、無効は -32768）、data/terrain/index.json に追記。
出典表記：「国土地理院 標高タイル」を加工して作成（国土地理院コンテンツ利用規約、CC BY 4.0 互換）。
注意：横浜の 3D は手描きの地図（約1/3、緯度経度と一致しない）なので、この格子は今は湘南（等倍）と将来の等倍エリアだけで使う。
"""
import argparse, io, json, math, sys, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'terrain'
URLS = ['https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/{z}/{x}/{y}.png', 'https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png']
NA = 1 << 23


def tile(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    r = math.radians(lat)
    y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
    return int(x), int(y)


def decode(png_bytes):
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    out = []
    d = im.tobytes()
    for k in range(0, len(d), 3):
        r, g, b = d[k], d[k + 1], d[k + 2]
        x = r * 65536 + g * 256 + b
        out.append(None if x == NA else (x if x < NA else x - (1 << 24)) * 0.01)
    return out, im.width


def fetch(z, x, y, from_dir):
    if from_dir:
        p = Path(from_dir) / str(z) / str(x) / f'{y}.png'
        return p.read_bytes() if p.exists() else None
    for u in URLS:
        try:
            with urllib.request.urlopen(urllib.request.Request(u.format(z=z, x=x, y=y), headers={'User-Agent': 'yokohama-fishing-game/1.0'}), timeout=60) as r:
                return r.read()
        except Exception as e:
            print('取得失敗', u.format(z=z, x=x, y=y), e, file=sys.stderr)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name')
    ap.add_argument('bbox', help='lat0,lon0,lat1,lon1')
    ap.add_argument('--z', type=int, default=15)
    ap.add_argument('--from-dir')
    a = ap.parse_args()
    lat0, lon0, lat1, lon1 = map(float, a.bbox.split(','))
    x0, y0 = tile(max(lat0, lat1), min(lon0, lon1), a.z)
    x1, y1 = tile(min(lat0, lat1), max(lon0, lon1), a.z)
    w, h, px = x1 - x0 + 1, y1 - y0 + 1, 256
    if w * h > 400:
        sys.exit(f'タイルが多すぎる（{w*h}）。範囲を狭めるか z を下げる')
    import array
    grid = array.array('h', [-32768]) * (w * px * h * px)
    got = 0
    for ty in range(h):
        for tx in range(w):
            b = fetch(a.z, x0 + tx, y0 + ty, a.from_dir)
            if not b:
                continue
            vals, n = decode(b)
            for j in range(n):
                for i in range(n):
                    v = vals[j * n + i]
                    if v is not None:
                        grid[(ty * px + j) * w * px + tx * px + i] = max(-32767, min(32767, round(v * 10)))
            got += 1
    if not got:
        sys.exit('標高タイルを1枚も取得できなかった（ネットワークの制限、または範囲外）')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{a.name}.bin').write_bytes(grid.tobytes())
    m = {'z': a.z, 'x0': x0, 'y0': y0, 'w': w, 'h': h, 'px': px, 'scale': 0.1, 'nodata': -32768, 'bbox': [lat0, lon0, lat1, lon1],
         'tiles': got, 'source': '国土地理院 標高タイル（dem5a_png / dem_png）', 'license': '国土地理院コンテンツ利用規約（CC BY 4.0 互換）',
         'attribution': '「国土地理院 標高タイル」を加工して作成'}
    (OUT / f'{a.name}.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
    idx_f = OUT / 'index.json'
    idx = json.loads(idx_f.read_text()) if idx_f.exists() else {'areas': []}
    if a.name not in idx['areas']:
        idx['areas'].append(a.name)
    idx_f.write_text(json.dumps(idx, ensure_ascii=False, indent=1))
    print(f'{a.name}: タイル {got}/{w*h}、{w*px}×{h*px} 格子 → data/terrain/')


if __name__ == '__main__':
    main()
