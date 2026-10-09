# 関東全域の OpenStreetMap データ（マスター保存とゲーム用タイル）

## 構成（元データと表示用を分ける）
| 層 | 置き場所 | 中身 | git |
|---|---|---|---|
| マスター | `data-master/kanto-261008.osm.pbf` ＋ `.md5`・`MANIFEST.json` | Geofabrik の PBF そのもの（全ノード・ウェイ・リレーション・全タグ）。**書き換えない** | 入れない（517MB） |
| 特徴ストア | `data-build/features.sqlite` | ゲーム用に分類した地物（緯度経度の WKB、**全タグ JSON**、R*Tree 索引）。マスターから作り直せる | 入れない |
| 表示用タイル | `data/tiles/kanto.pmtiles` | Web メルカトル z4〜14 のベクトルタイル（MVT・gzip）。低いズームは主要な地物だけ・簡略化（LOD） | 入れない（大きい）。配信先は下記 |
| 索引 | `data/tiles/index.json`・`regions.json`・`layers.json` | タイル索引（範囲・ズーム・件数・マスターの SHA256・出典）、地域索引（都県・市区町村）、レイヤー定義 | 入れる（小さい） |

範囲は PBF に入っている全域（東京都の島しょ部を含む）。表示の初期範囲だけ本土に寄せている（読み込み範囲を絞っても保存は減らさない）。

## 手順
```bash
pip install osmium pmtiles mapbox-vector-tile shapely numpy
python3 tools/kanto/fetch_master.py                 # 取得＋公式MD5で検証（不一致ならマスターにしない）
python3 tools/kanto/build_tiles.py all --jobs 4     # 抽出（features.sqlite）→ タイル（kanto.pmtiles）・索引
python3 tools/kanto/build_tiles.py tags w123456     # 地物の全タグを見る（属性を後から足すとき）
```
別の場所で取得した PBF は `fetch_master.py --from-file kanto-261008.osm.pbf`（同じ場所に `.md5` を置く）。

## レイヤー（`tools/kanto/layers.py`）
land（海岸線から組み立てた陸）・coastline・water・waterway・shore（砂浜・磯・桟橋・防波堤・突堤・護岸・港・マリーナ・釣り場・河口）・landuse・natural・park・roads・railway・buildings・boundary（行政界）・place・poi。
タイルに入れるのは表示に使う属性と OSM の id（`w123` など）だけ。全タグは特徴ストアとマスターにある。新しい属性が要るときは `layers.py` の `KEEP` に足してタイルを作り直す。

## タイル境界と陸地
- 地物は 64px（4096 中）の余白付きで切る。ゲームはタイルの枠で切って描くので継ぎ目で途切れない。
- 陸：OSM の海岸線（陸が進行方向の左）をタイルごとにつなぎ、タイルの枠に沿って閉じる。海岸線の無いタイルは隣のタイルから陸・海を受け継ぐ（幅優先）。海のタイルは作らない（無い＝海）。途中で切れた海岸線（範囲の端）は隣から受け継ぐ。

## ゲーム側（`tiles.js`・index.html の「関東」地図）
- PMTiles を Range 読み込み（必要なタイルだけ）。読み込み中の同じタイルは同じ Promise を返し、最近の256枚をキャッシュ。最大ズームを超えたら親のタイルを使う。
- ワールドマップの「関東」：表示の範囲と縮尺からズームを選ぶ（遠くは低詳細）。読み込み中は親タイルで代わりに描く。地域の検索（行政界）、地点のタップで緯度経度・地域・ゲームで行けるか。
- `#tilestest`：架空のテストデータ（`data/tiles/test/`、`tests/fixtures/kanto-test.osm.pbf` から作成）。`#tiles=URL`：別の配信先。

## 配信
GitHub は 100MB を超えるファイルを置けないので、`kanto.pmtiles` は Range 読み込みに対応する所（Cloudflare R2・S3・自前のサーバーなど）に置き、`#tiles=https://…/` で指定する（CORS で Range を許可）。地域ごとに分けたいときは `build_tiles.py tiles --name <地域>` を範囲別の特徴ストアで作る。

## OSM に無いもの（作らない）
海底地形・水深・魚の生息・潮汐・釣りの可否は OSM に無い。別のデータ源（海上保安庁の海底地形、気象庁の潮汐など。利用条件を確認）を、緯度経度で同じ座標システム（`geo.js`）に重ねる形で足す。

## 出典
© OpenStreetMap contributors（ODbL 1.0）。データは Geofabrik GmbH の抽出。派生データ（features.sqlite・タイル）も ODbL の派生データとして扱う。
