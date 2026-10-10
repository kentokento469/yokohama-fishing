# 構造一覧（自動生成：node tools/inventory.mjs。直接編集しない）

## 読み込み順（index.html）
- https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js
- fishing-sim.js
- fish-ai.js
- data/tackle-data.js
- tackle.js
- fight.js
- sound.js
- data/fish/species.js
- data/fish/images.js
- geo.js
- world.js
- data/world/yokohama-base.js
- data/yokohama-places.js
- data/shonan-spots.js
- shonan.js
- terrain.js
- data/terrain/shonan-game.js
- osm-convert.js
- mapdata.js
- data/geo/geo-data.js
- tiles.js
- gsi.js
- kanto.js
- routing.js
- nav.js
- vehicles.js
- data/osm/index.js

## モジュール
| ファイル | 大きさ | 公開名 | 説明 |
|---|---|---|---|
| fight.js | 5KB | HamaFight | 横浜みなと釣り旅 — フッキングとファイト（段階5）。描画にもDOMにも依存しない。ブラウザでも Node でも動く。 |
| fish-ai.js | 12KB | HamaSim | 横浜みなと釣り旅 — 魚のAI（段階4）。描画にもDOMにも依存しない。ブラウザでも Node でも動く。 |
| fishing-sim.js | 19KB | HamaSim | 横浜みなと釣り旅 — 水中の物理と環境（描画に依存しない。ブラウザでも Node でも動く） |
| geo.js | 3KB | HamaGeo | 横浜みなと釣り旅 — 共通の座標システム（3Dフィールド・ミニマップ・地図画面・全画面ワールドマップで共有する） |
| gsi.js | 7KB | HamaTiles | 国土地理院タイルのストリーミング読み込み（window.HamaGSI）。関東全域を同じ仕組みで扱う共通の土台。 |
| kanto.js | 8KB | HamaGSI | 関東全域の近景データ（window.HamaKanto）。横浜・湘南の事前変換データの外側を、国土地理院タイルから直接つくる共通エンジン。 |
| mapdata.js | 8KB | HamaGeo | 横浜みなと釣り旅 — 地図データの管理（3Dフィールドと2Dの地図画面が同じデータを見る） |
| nav.js | 8KB | HamaOSMConvert | 横浜みなと釣り旅 — 道路網の組み立て（OSM がないときの代わり）・道のマス目・推定駐車場・行き方の計画。描画に依存しない。 |
| osm-convert.js | 11KB | HamaOSMConvert | 横浜みなと釣り旅 — OpenStreetMap のデータをゲームの地図レイヤーと道路ネットワークに変換する（描画に依存しない。Node でもブラウザでも動く） |
| routing.js | 4KB | HamaRouting | 横浜みなと釣り旅 — 道路ネットワークの経路探索（A*）。描画に依存しない。Node でもブラウザでも動く。 |
| shonan.js | 13KB | HamaShonanData | 横浜みなと釣り旅 — 湘南エリアの釣り場ルールと地理（描画に依存しない。ブラウザでも Node でも動く） |
| sound.js | 6KB | HamaSound | 横浜みなと釣り旅 — 効果音と環境音。音のファイルは使わず、すべて Web Audio API でその場で合成する（権利の心配がなく、ページも重くならない）。 |
| tackle.js | 6KB | HamaTackle | 横浜みなと釣り旅 — 釣具（ロッド・リール・ルアー・メタルジグ）の所持・装備・購入・適合（描画に依存しない。ブラウザでも Node でも動く） |
| terrain.js | 4KB | HamaTerrain | 標高（国土地理院の標高タイル dem_png / dem5a_png）の読み込みと、緯度経度での高さの取り出し（window.HamaTerrain）。 |
| tiles.js | 9KB | HamaTiles | 横浜みなと釣り旅 — 関東の実在地図タイル（PMTiles v3 / MVT）の読み込み。外部ライブラリなし。Node でもブラウザでも動く。 |
| vehicles.js | 8KB | HamaVehicles | 横浜みなと釣り旅 — 自転車と自動車（描画に依存しない。Node でもブラウザでも動く） |
| world.js | 12KB | HamaWorld | 横浜みなと釣り旅 — 実在の地図（等倍）の読み込みと問い合わせ（window.HamaWorld）。three.js・DOM に依存しない（Node の require でも動く） |

## index.html の節（309KB）
- L179 デザイン v2（2026-10）：HUD は半透明のガラス、メニューは紙。厚い影をやめ、細い線と柔らかい影に統一
- L396 魚（東京湾・横浜で釣れる35種）
- L439 魚種のマスター（data/fish/species.json → species.js）
- L497 湘南エリア（鎌倉〜大磯）：shonan.js・data/shonan-spots.js から取り込む。横浜マップの南（y=8300〜）に置き
- L506 状態
- L528 時間・潮・季節
- L555 入力
- L584 3D基盤
- L677 テクスチャ（窓・壁は世界座標で貼るので、建物の大きさに関係なく窓の大きさが一定）
- L722 海と陸
- L878 道沿いのもの：電柱と電線、街灯、街路樹、バス停、自販機
- L916 防波堤（国土地理院の防波堤の線）：コンクリートの堤（幅4m・海面から3m）と外側のテトラポッド。湘南の漁港には小さな漁船（数・位置はおおよそ
- L925 名所・ランドマーク（実寸に近い大きさ。位置は data/yokohama-places.js と国土地理院の建物の形から）
- L988 湘南の名所（簡単な形。実寸に近い高さ）
- L1019 街並みのチャンク生成（近くだけ作り、遠くは消す）
- L1316 人（関節つきの人型。身長およそ1.73m）
- L1392 竿・糸・ウキ
- L1416 目印
- L1429 釣りロジック（距離はメートル）
- L1508 環境（段階6）：天気・水温・濁り・潮流は fishing-sim.js で計算し、ここでは今日・今の値をまとめる
- L1618 結果・名所
- L1623 魚図鑑：全魚種（data/fish/species.json）。釣った魚と未釣獲を区別し、写真（あれば）・特徴・生息・釣獲記録を出す
- L1657 釣果の表示：写真（data/fish/images.js にある魚種）または仮の図、名前・学名・体長・重さ・場所・日時・仕掛け・自己ベスト。
- L1687 UI
- L1749 シート
- L1816 釣具店：竿・エサ／ルアー／メタルジグ／持ち物
- L1903 2D地図
- L1965 魚の絵
- L2013 カメラ（建物にめり込まないよう距離を詰める）
- L2030 竿・糸（しなり）と釣りのポーズ
- L2103 ナブラ・鳥山・波紋
- L2118 時間帯の見た目
- L2142 乗り物・道路網・行き方（vehicles.js / nav.js / routing.js / osm-convert.js）
- L2346 全画面ワールドマップ（Mキー・右上の「地図」・ミニマップをタップ）
- L2397 設定：画質・FPS表示・旧バージョン
- L2419 関東の実在地図（OpenStreetMap のタイル。tools/kanto で作る）
- L2609 メインループ
- L2671 開始

## データ
- data/: equipment_catalog_400.json, fish, geo, kanto, osm, shonan-spots.js, tackle-data.js, terrain, tiles, world, yokohama-places.js
- data/fish/: images.js, img, species.js, species.json
- data/world/: yokohama-base.js, yokohama-bld
- data/terrain/: shonan-game.js
- data/geo/: LICENSE_AND_SOURCES.md, VALIDATION.md, coverage_map.png, geo-data.js, src
- data/osm/: README.md, areas.json, index.js
- data/tiles/: layers.json, test

## テスト
- npm test（tests/*.test.js）、npm run smoke（tools/smoke：ヘッドレス Chromium で主な遊び方）
- セーブ：localStorage hama-tsuri-v2。移行 migrateMap（mapv 2 湘南等倍、mapv 3 横浜等倍）、TK.migrate / migrateGear、VH.migrate
