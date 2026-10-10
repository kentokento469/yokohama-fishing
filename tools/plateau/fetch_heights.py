#!/usr/bin/env python3
"""PLATEAU（国土交通省 3D都市モデル）の CityGML から建物の実測の高さ（bldg:measuredHeight）と位置を取り出す。
  python3 tools/plateau/fetch_heights.py yokohama
ZIP（G空間情報センターの公開バケット）を Range で部分取得し、範囲（data-build/gsi/<名前>.bbox）に掛かる1km区画の bldg ファイルだけ読む。
出力：data-build/plateau/<名前>-heights.json（[経度, 緯度, 高さm] の一覧。建物の床の形の重心）。途中から再開できる。
出典：「3D都市モデル（Project PLATEAU）横浜市（2020年度）」国土交通省（CC BY 4.0）を加工して作成。
"""
import json, math, re, sys, zipfile, io
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from remotezip import RemoteZip
ROOT = Path(__file__).resolve().parents[2]
SRC = {'yokohama': 'https://gsic-opendata.s3.ap-northeast-1.amazonaws.com/national-gov/mlit/city-bureau/3d-city-model/2020/plateau-14100-yokohama-city-2020/14100_yokohama-shi_2020_citygml_5_op.zip'}
NS = {'bldg': 'http://www.opengis.net/citygml/building/2.0', 'gml': 'http://www.opengis.net/gml'}


def mesh_bbox(code):  # 3次メッシュ（8桁）→ (lat0, lon0, lat1, lon1)
    p, u, q, v, r, w = int(code[0:2]), int(code[2:4]), int(code[4]), int(code[5]), int(code[6]), int(code[7])
    lat = p / 1.5 + q / 12 + r / 120
    lon = u + 100 + v / 8 + w / 80
    return lat, lon, lat + 1 / 120, lon + 1 / 80


def parse(data):
    out = []
    for ev, el in ET.iterparse(io.BytesIO(data), events=('end',)):
        if el.tag != '{%s}Building' % NS['bldg']:
            continue
        h = el.find('bldg:measuredHeight', NS)
        if h is None or not h.text:
            el.clear()
            continue
        pos = None
        for path in ('bldg:lod0FootPrint', 'bldg:lod0RoofEdge', 'bldg:lod1Solid'):
            e = el.find(path, NS)
            if e is not None:
                pl = e.find('.//gml:posList', NS)
                if pl is not None:
                    pos = [float(v) for v in pl.text.split()]
                    break
        if pos:
            lats, lons = pos[0::3], pos[1::3]
            out.append([round(sum(lons) / len(lons), 7), round(sum(lats) / len(lats), 7), round(float(h.text), 1)])
        el.clear()
    return out


def main():
    name = sys.argv[1]
    lat0, lon0, lat1, lon1 = [float(v) for v in (ROOT / 'data-build' / 'gsi' / f'{name}.bbox').read_text().split(',')]
    cache = ROOT / 'data-build' / 'plateau' / name
    cache.mkdir(parents=True, exist_ok=True)
    with RemoteZip(SRC[name]) as z:
        files = [i.filename for i in z.infolist() if '/udx/bldg/' in i.filename and i.filename.endswith('.gml')]
    sel = []
    for f in files:
        code = re.search(r'/(\d{8})_bldg', f).group(1)
        a0, o0, a1, o1 = mesh_bbox(code)
        if a1 >= lat0 and a0 <= lat1 and o1 >= lon0 and o0 <= lon1:
            sel.append(f)
    print(name, 'bldg files', len(files), 'in bbox', len(sel), flush=True)

    def one(f):
        dst = cache / (Path(f).stem + '.json')
        if dst.exists():
            return len(json.loads(dst.read_text()))
        with RemoteZip(SRC[name]) as z:
            data = z.read(f)
        rows = parse(data)
        dst.write_text(json.dumps(rows))
        return len(rows)
    n = 0
    with ThreadPoolExecutor(4) as ex:
        for i, c in enumerate(ex.map(one, sel)):
            n += c
            if i % 50 == 0:
                print(i, n, flush=True)
    allrows = []
    for f in sel:
        allrows += json.loads((cache / (Path(f).stem + '.json')).read_text())
    (ROOT / 'data-build' / 'plateau' / f'{name}-heights.json').write_text(json.dumps(allrows))
    print('buildings with height', len(allrows))


if __name__ == '__main__':
    main()
