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
