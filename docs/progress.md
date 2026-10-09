# 進捗メモ（短く保つ。設計決定と現状だけ）

## 座標・地図（2026-10）
- 共通座標 `geo.js`（HamaGeo）：湘南は原点 北緯35.345°/東経139.56° → (2400,8300)、x東・y南、距離1/3（SC=3）、正距円筒。toGame⇔toLatLon。地図表示は view{cx,cy,z,w,h,rot}＋worldToScreen/screenToWorld/zoomAt/fit/scaleBar。横浜は未ジオリファレンス。
- 地図データ `mapdata.js`（HamaMapData）：11レイヤー。地物は src（gshhs/osm=実在、game_approx/game_est/user）を持つ。データなしは空（missing）。
- 提供ZIP（GSHHS中解像度）：湘南部分は8点の粗い海岸線と陸の概形のみ。道路・建物・駐車場は未取得。→ 既存の手描き海岸線（47点）は置き換えず、参考レイヤー＋ゲーム範囲外の遠景に使う。
- OSM：作業環境から取得不可。`tools/fetch_osm.mjs`（Overpass JSON）か、ZIP付属 `fetch_osm.py` の `*_osm.geojson` を data/geo/src に置けば取り込める設計。

## 乗り物・ルート
- vehicles.js / nav.js / routing.js 済。道路はおおよそ（approx）、駐車場は推定（est）。

## Phase 2（地理データ統合）済
- GSHHS 取り込み・検査済（海岸線3本・陸1、湘南部分は8点、辺の中央値2.3km）。手描き海岸線とのずれ：平塚 平均約340m、全体 約510m、江の島付近 約760m（江の島は GSHHS に無い）。
- 3D：GSHHS の陸のうちゲーム範囲外（大磯の西・鎌倉の東）を遠景（歩けない）に。#geodebug で GSHHS 海岸線を3Dに赤線表示。
- 地図画面：GSHHS 海岸線の重ね表示（切替）と「地図データの状況」。
- 平塚の手描き海岸線は西ほど南へ傾いている（GSHHS はほぼ東西）。正否は実データ（OSM等）待ち。
- 次：全画面ワールドマップ（Mキー。geo.js の view と MAPD を使う）。

## 全エリアのデータパック（横浜〜大磯）取込済
- 中身は前回と同じ GSHHS 中解像度（範囲が横浜まで拡大：海岸線13本・陸4、エリア別12ファイル、取り込み範囲の四角6＝行政界ではない）。道路・建物・駐車場などは未収録。
- data/geo/src に overview/areas/area_coverage_rectangles/manifest。地図レイヤーには overview だけ読む（areas は検査のみ・重複のため）。
- OSM の追加は tools/import_osm_geojson.py（BBBike の GeoJSON/ZIP。要 shapely）→ data/geo/src/osm/*.geojson → import_geo.mjs。node id がない道路は同じ座標の頂点でだけつなぐ。
- 横浜の手描き地図は緯度経度に一律では合わない（名所8点で相似変換すると縮尺 平均1/2.33・残差0.4〜1.6km）。GSHHS は湘南の範囲（y≥8300）だけに重ねる。横浜の再構築は実データ（OSM・建物）が来てから geo.js の投影で。
- 全画面ワールドマップ 済：M キー／右上「地図」／ミニマップをタップ。メニューは N キー。開いている間は時間停止。ピンチ・ドラッグ・ホイール・＋−・現在地・横浜／湘南・レイヤー切替・釣り場タップで情報と「ここへ行く」（ルート表示）。drawMapBody を地図画面と共有。
- 建物データは後日ユーザーが渡す予定。

## 関東全域 OSM（2026-10）
- 取得：download.geofabrik.de はプロキシで 403（環境の許可待ち）。マスター未取得。
- パイプライン済（tools/kanto）：取得＋公式MD5→ data-master（不変）、抽出→ data-build/features.sqlite（全タグ）、タイル→ data/tiles/kanto.pmtiles（z4〜14、LOD、64px余白、陸は海岸線をタイルごとに閉じ＋隣から受け継ぎ）、索引 index/regions/layers.json。河口は川の端点が海岸線50m以内。
- 試験：架空の tests/fixtures/kanto-test.osm.pbf → data/tiles/test/（#tilestest）。tests/tiles.test.js 8件。
- ゲーム：tiles.js、ワールドマップ「関東」（ズーム選択・親タイル代替・地域検索・タップ情報）。
- 未対応：3Dフィールドへの実在タイル描画（湘南は距離1/3なので建物・道路の幅が1/3になる。縮尺の決定が必要）。kanto.pmtiles の配信先（100MB超で git 不可）。
