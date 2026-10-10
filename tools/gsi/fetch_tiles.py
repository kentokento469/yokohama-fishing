#!/usr/bin/env python3
"""国土地理院ベクトルタイル（optimal_bvmap-v1、z16）を範囲で取得して data-build/gsi/ にためる（途中から再開できる）。
  python3 tools/gsi/fetch_tiles.py yokohama 35.33,139.60,35.52,139.71
出典：国土地理院ベクトルタイル（国土地理院コンテンツ利用規約、CC BY 4.0 互換）。
"""
import math, sys, time, urllib.request, urllib.error
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
URL = 'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/{z}/{x}/{y}.pbf'
UA = 'yokohama-fishing-game/1.0 (https://github.com/kentokento469/yokohama-fishing)'


def tile(lat, lon, z):
    n = 2 ** z
    r = math.radians(lat)
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)


def tiles(bbox, z=16):
    lat0, lon0, lat1, lon1 = bbox
    x0, y0 = tile(max(lat0, lat1), min(lon0, lon1), z)
    x1, y1 = tile(min(lat0, lat1), max(lon0, lon1), z)
    return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def main():
    name, bbox = sys.argv[1], [float(v) for v in sys.argv[2].split(',')]
    z = 16
    out = ROOT / 'data-build' / 'gsi' / f'{z}'
    ts = tiles(bbox, z)
    got = miss = 0
    for i, (x, y) in enumerate(ts):
        f = out / str(x) / f'{y}.pbf'
        if f.exists():
            continue
        f.parent.mkdir(parents=True, exist_ok=True)
        for t in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(URL.format(z=z, x=x, y=y), headers={'User-Agent': UA}), timeout=60) as r:
                    f.write_bytes(r.read())
                got += 1
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:  # 海の上などデータなし
                    f.write_bytes(b'')
                    miss += 1
                    break
                time.sleep(3 * (t + 1))
            except Exception:
                time.sleep(3 * (t + 1))
        time.sleep(.12)
        if i % 100 == 0:
            print(f'{i}/{len(ts)}', flush=True)
    (ROOT / 'data-build' / 'gsi' / f'{name}.bbox').write_text(','.join(map(str, bbox)))
    print(f'{name}: {len(ts)} タイル（新規 {got}・データなし {miss}）')


if __name__ == '__main__':
    main()
