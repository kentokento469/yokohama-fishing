#!/usr/bin/env python3
"""パイプラインのテスト用の小さな PBF を作る（架空のデータ。実在の地図ではない）。
  python3 tools/kanto/make_test_pbf.py tests/fixtures/kanto-test.osm.pbf
平塚付近の座標に、海岸線（陸が左）・島・河口に注ぐ川・道路（橋で交差、交点なし）・建物・砂浜・防波堤・港・湖・行政界・地名・駅・駐車場を置く。
"""
import sys
import osmium
from osmium.osm.mutable import Node, Way, Relation

import os
out = sys.argv[1] if len(sys.argv) > 1 else 'kanto-test.osm.pbf'
if os.path.exists(out):
    os.remove(out)
nodes, ways, rels = [], [], []
nid = [1]


def N(lon, lat, tags=None):
    i = nid[0]
    nid[0] += 1
    nodes.append(Node(id=i, location=osmium.osm.Location(lon, lat), tags=tags or {}, version=1))
    return i


def W(i, refs, tags):
    ways.append(Way(id=i, nodes=refs, tags=tags, version=1))


# 海岸線：西→東（陸＝北が左）。2本のウェイを共有ノードでつなぐ
c = [N(139.30, 35.300), N(139.33, 35.305), N(139.35, 35.310)]
c2 = [c[-1], N(139.37, 35.312), N(139.40, 35.315)]
W(1, c, {'natural': 'coastline'})
W(2, c2, {'natural': 'coastline'})
# 島（反時計回り＝陸が左）
isl = [N(139.340, 35.280), N(139.345, 35.280), N(139.345, 35.284), N(139.340, 35.284)]
W(3, isl + [isl[0]], {'natural': 'coastline', 'place': 'islet', 'name': 'テスト島'})
# 川：内陸から海岸線の近くまで
r = [N(139.352, 35.340), N(139.351, 35.325), N(139.3502, 35.3102)]
W(4, r, {'waterway': 'river', 'name': 'テスト川'})
# 道路：幹線と、橋で越える道（交点にノードなし）、歩道
a = [N(139.30, 35.330), N(139.40, 35.332)]
W(5, a, {'highway': 'primary', 'name': 'テスト国道', 'ref': '999'})
b = [N(139.36, 35.320), N(139.36, 35.345)]
W(6, b, {'highway': 'residential', 'bridge': 'yes', 'layer': '1'})
f = [N(139.33, 35.312), N(139.34, 35.320)]
W(7, f, {'highway': 'footway'})
W(8, [N(139.31, 35.340), N(139.39, 35.341)], {'highway': 'motorway', 'oneway': 'yes'})
W(9, [N(139.30, 35.336), N(139.40, 35.337)], {'railway': 'rail', 'name': 'テスト線'})
# 建物（4階）・砂浜・防波堤・港・湖・駐車場
bd = [N(139.341, 35.322), N(139.342, 35.322), N(139.342, 35.3228), N(139.341, 35.3228)]
W(10, bd + [bd[0]], {'building': 'yes', 'building:levels': '4'})
bc = [N(139.31, 35.3035), N(139.33, 35.3085), N(139.33, 35.3075), N(139.31, 35.3025)]
W(11, bc + [bc[0]], {'natural': 'beach'})
W(12, [N(139.37, 35.312), N(139.371, 35.305)], {'man_made': 'breakwater'})
hb = [N(139.365, 35.311), N(139.38, 35.3125), N(139.38, 35.318), N(139.365, 35.318)]
W(13, hb + [hb[0]], {'landuse': 'harbour', 'name': 'テスト港'})
lk = [N(139.32, 35.350), N(139.325, 35.350), N(139.325, 35.354), N(139.32, 35.354)]
W(14, lk + [lk[0]], {'natural': 'water', 'water': 'lake'})
pk = [N(139.345, 35.325), N(139.346, 35.325), N(139.346, 35.3255), N(139.345, 35.3255)]
W(15, pk + [pk[0]], {'amenity': 'parking', 'capacity': '40'})
# 行政界（リレーション）
ad = [N(139.30, 35.30), N(139.40, 35.30), N(139.40, 35.36), N(139.30, 35.36)]
W(16, ad + [ad[0]], {})
rels.append(Relation(id=1, members=[('w', 16, 'outer')], tags={'type': 'boundary', 'boundary': 'administrative', 'admin_level': '7', 'name': 'テスト市', 'name:en': 'Test City'}, version=1))
N(139.35, 35.333, {'place': 'town', 'name': 'テスト町'})
N(139.355, 35.3365, {'railway': 'station', 'name': 'テスト駅'})
N(139.36, 35.314, {'leisure': 'fishing', 'name': 'テスト釣り場'})

w = osmium.SimpleWriter(out)
for n in nodes:
    w.add_node(n)
for x in ways:
    w.add_way(x)
for x in rels:
    w.add_relation(x)
w.close()
print(out, len(nodes), 'nodes', len(ways), 'ways', len(rels), 'relations')
