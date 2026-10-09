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

## 湘南を等倍に（ユーザー決定「等倍でいい、移動ツールがある」）
- geo.js SHONAN.sc=1、bounds x -22800〜3300・y 8300〜15500。shonan.js は R0.sc を使う（川幅・堤防幅・規制半径が実寸）。
- index.html：砂浜帯60m・建物を置かない海岸帯190m・磯40m・江の島の丘（約520×240m、高さ約58m）・湘南のバス3km・運賃/距離の表示・ミニマップ（MAPC2 2650×750）・海の平面拡大・乗り物の消費（env.sc）。
- 横浜は1/3のまま。セーブ移行 migrateMap（mapv 2）。

## 魚種の拡張・釣果表示・図鑑（2026-10）
- 126種（新規90）。新規は「釣り場の種類ごとの多さ×レア度（common1・uncommon.45・rare.12・very_rare.035・legendary.01）×1.5」で出現。季節（!は季節外ゼロ）・時間・潮（tideFactor）・水温・底質・天気・浅すぎ（.3）。既存36種の出現は変えていない。全体の約38%が新規種。
- ファイトの型 fight.js STYLE（run/dive/shake/heavy/circle/jet/stick/twist/weak）。既存種にも型を付けた。
- 釣果カード：写真（あれば）/仮の図、学名・体長・重さ・場所・日時・仕掛け・自己ベスト・レア度、初物/大物/レアの枠と演出。記録 S.dex[id].best/first、S.log（直近50）。
- 図鑑：絞り込み（釣った/まだ/海/河口/淡水/イカ・タコ等）、詳細（特徴・生息・季節・潮・水深・底質・水温・大きさ・引き・警戒心・レア度・釣れる場所・記録・写真の出典）。
- 写真：commons.wikimedia.org・upload.wikimedia.org が 403。画像生成なし。fetch_images.py は変換部分だけ試験済み。3D表示は実モデルが無いので未実装。
- 淡水22種は釣り場（川・湖）が無いので釣れない（図鑑に「未実装」と表示）。

## グラフィック・UI 全面改善（2026-10）
- 変更前の保全：legacy/2026-10-pre-visual/（遊べるコピー）。
- UI v2：アイコンボタン、所持金はミニマップの下、ファイト・ルアー情報は上（指の下に出さない）、お知らせは下、設定タブ（画質 高/標準/軽量＝GFX_LV、FPS表示）、投げる先は弧と点だけ（文字なし）、safe area。
- 海：シェーダー（波・反射・太陽の照り返し・浅場の色・岸の白波＝岸のマスク drawShore）。軽量画質は以前の平面。
- 海づり施設（大黒・本牧・磯子＝RECTS の pier で name なし）：床・杭・梁・手すり・街灯（夜は光と足元の明かり）・東屋・管理棟（看板）。形は一般的な海づり施設の想定で、実物の寸法ではない。
- 標高：terrain.js（標高タイルの復号・格子・緯度経度で高さ）、tools/terrain/fetch_dem.py、tests/terrain.test.js。地理院は 403 で未取得。横浜は手描き（緯度経度と合わない）なので本牧に実標高は使えない（本牧ふ頭は埋立地でほぼ平ら。丘を作らない）。3Dへの反映（地面の高さ）はデータ取得後。
- 素材のライセンスは docs/ASSETS.md。
- 標高 取得済（ネット許可後）：湘南 z14（dem_png 10m）→ data-build/terrain/shonan.*（12MB、git外）→ tools/terrain/build_game_grid.mjs → data/terrain/shonan-game.js（40m、308KB）。
  ゲーム：groundY に terrOff（標高20m超の分）。丘の地形メッシュ（近景＋遠景用の複製＝描画距離外も霞んで見える）、丘に森（木はおおよそ）、丘には建物を建てない。江の島は手作りの丘のまま。横浜には使わない。
- 魚の写真（ネット許可後）：search で104種中93種に候補（data-build/fish-img/candidates.json）。upload.wikimedia.org の回数制限が厳しく、2時間で18種分しか取得できず、目で確認して5種を採用（マアジ・マハゼ・シログチ・アカカマス・スズキ。CC BY-SA 4.0/CC BY 4.0）。浮世絵・寿司・干物・目のアップ・不鮮明は不採用（BAD_WORDS に追加）。
  続き：python3 tools/fish/fetch_images.py download --k 0（未取得の種）→ 目で確認 → approved_src に置く → build --from-dir data-build/fish-img/approved_src。不採用の種は --k 1 で次の候補。
