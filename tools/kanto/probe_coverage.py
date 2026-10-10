#!/usr/bin/env python3
"""関東の国土地理院データの有無を調べて記録する（z12 の格子ごとに中心の1枚だけ見る。HEAD 相当の軽い取得）。
  python3 tools/kanto/probe_coverage.py            # 関東7都県の範囲
  python3 tools/kanto/probe_coverage.py --islands  # 伊豆諸島（東京都島しょ部の一部）
出力：data/kanto/coverage.json（格子ごとの有無：1=5m標高 2=10m標高 4=ベクトル）と docs/DATA_COVERAGE.md の表。途中から再開できる（data-build/kanto/probe.json）。
"""
import json, math, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
B = 'https://cyberjapandata.gsi.go.jp/xyz/'
UA = 'yokohama-fishing-game/1.0 (https://github.com/kentokento469/yokohama-fishing)'
AREAS = {'kanto': (34.85, 138.40, 37.20, 140.90), 'islands': (32.40, 139.10, 34.85, 140.00)}
# 都県のおおよその範囲（表の集計用。境界は正確でない）
PREF = {'神奈川': (35.12, 138.91, 35.68, 139.80), '東京（本土）': (35.50, 138.94, 35.90, 139.93), '千葉': (34.89, 139.73, 36.11, 140.88),
        '埼玉': (35.75, 138.71, 36.29, 139.91), '茨城': (35.73, 139.68, 36.97, 140.86), '栃木': (36.19, 139.32, 37.16, 140.30), '群馬': (35.98, 138.39, 37.06, 139.67),
        '伊豆諸島': (32.40, 139.10, 34.85, 140.00)}


def tile(lat, lon, z):
    n = 2 ** z
    r = math.radians(lat)
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)


def exists(url):
    for t in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Range': 'bytes=0-0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status in (200, 206)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            time.sleep(2 * (t + 1))
        except Exception:
            time.sleep(2 * (t + 1))
    return None


def probe(cell):
    x, y = cell  # z12
    v = 0
    if exists(f'{B}dem5a_png/15/{x * 8 + 4}/{y * 8 + 4}.png'):
        v |= 1
    if exists(f'{B}dem_png/14/{x * 4 + 2}/{y * 4 + 2}.png'):
        v |= 2
    if exists(f'{B}optimal_bvmap-v1/16/{x * 16 + 8}/{y * 16 + 8}.pbf'):
        v |= 4
    return cell, v


def main():
    name = 'islands' if '--islands' in sys.argv else 'kanto'
    lat0, lon0, lat1, lon1 = AREAS[name]
    x0, y0 = tile(lat1, lon0, 12)
    x1, y1 = tile(lat0, lon1, 12)
    cache = ROOT / 'data-build' / 'kanto' / f'probe-{name}.json'
    cache.parent.mkdir(parents=True, exist_ok=True)
    got = json.loads(cache.read_text()) if cache.exists() else {}
    todo = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if f'{x},{y}' not in got]
    print(name, 'cells', (x1 - x0 + 1) * (y1 - y0 + 1), 'todo', len(todo), flush=True)
    with ThreadPoolExecutor(6) as ex:
        for i, (cell, v) in enumerate(ex.map(probe, todo)):
            got[f'{cell[0]},{cell[1]}'] = v
            if i % 200 == 0:
                cache.write_text(json.dumps(got))
                print(i, flush=True)
    cache.write_text(json.dumps(got))
    out = ROOT / 'data' / 'kanto' / 'coverage.json'
    cov = json.loads(out.read_text()) if out.exists() else {}
    w, h = x1 - x0 + 1, y1 - y0 + 1
    cov[name] = {'z': 12, 'x0': x0, 'y0': y0, 'w': w, 'h': h, 'bits': '1=5m標高 2=10m標高 4=ベクトル（格子の中心の1枚で判定）',
                 'cells': ''.join(str(got.get(f'{x},{y}', 0)) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)), 'probed': time.strftime('%Y-%m-%d')}
    out.write_text(json.dumps(cov, ensure_ascii=False))
    # 表：都県ごと（範囲内の格子のうち陸＝10m標高のある格子に対する割合）
    rows = []
    for nm, (a0, o0, a1, o1) in PREF.items():
        c = {'all': 0, 'land': 0, 'd5': 0, 'vec': 0}
        for key, v in got.items():
            x, y = map(int, key.split(','))
            lon = (x + .5) / 4096 * 360 - 180
            lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + .5) / 4096))))
            if not (a0 <= lat <= a1 and o0 <= lon <= o1):
                continue
            c['all'] += 1
            if v & 2:
                c['land'] += 1
                c['d5'] += 1 if v & 1 else 0
                c['vec'] += 1 if v & 4 else 0
        if c['all']:
            L = max(1, c['land'])
            rows.append(f"| {nm} | {c['all']} | {c['land']} | {100 * c['d5'] // L}% | {100 * c['vec'] // L}% |")
    md = ROOT / 'docs' / 'DATA_COVERAGE.md'
    old = md.read_text() if md.exists() else '# 関東の実地理データの取得状況（自動生成：tools/kanto/probe_coverage.py）\n'
    sec = f'\n## {name}（{time.strftime("%Y-%m-%d")}、z12 格子 {w}×{h}）\n| 範囲 | 格子 | 陸（10m標高あり） | 5m標高 | ベクトル |\n|---|---|---|---|---|\n' + '\n'.join(rows) + '\n'
    import re
    old = re.sub(rf'\n## {name}（.*?(?=\n## |\Z)', '', old, flags=re.S)
    md.write_text(old.rstrip() + '\n' + sec)
    print('done', name)


if __name__ == '__main__':
    main()
