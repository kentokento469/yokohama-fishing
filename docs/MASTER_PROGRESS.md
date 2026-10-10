# MASTER_PROGRESS（関東全域3D化・ゲーム全面進化）

セッション開始時はまずここを読む。構造は docs/ARCHITECTURE.md（`node tools/inventory.mjs` で更新）、細かい経緯は docs/progress.md。

## 状態
| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 現状分析・保全・作業管理 | DONE |
| 1 | 関東全域の実地理データ取得 | ACTIVE |
| 2 | 関東全域の本格3D地形化 | DONE（共通エンジン kanto.js：横浜・湘南の外は国土地理院の標高・ベクトルタイルから近景を直接生成、横浜の丘も同じ標高。遠景は far pass。Worker で読み込み。実機での負荷確認は未） |
| 3 | 街並み・自然・海面の高品質化 | TODO |
| 4 | NPCと街の生活感 | TODO |
| 5 | カメラ操作の改善 | TODO |
| 6 | 釣りの3D表現とUI刷新 | TODO |
| 7 | 魚の写真と3Dモデル | TODO |
| 8 | 釣具・装備システムの高度化 | TODO |
| 9 | 魚拓・釣果コレクション | TODO |
| 10 | 生き餌・泳がせ釣り | TODO |
| 11 | 市場・魚売却・ゲーム経済 | TODO |

### 追加指示：Procedural Tokyo 方式の3D改修（A〜J。こちらを先に進め、終わったら Phase 6 以降へ戻る）
| Phase | 内容 | 状態 |
|---|---|---|
| A | 上方向の描画不具合 | DONE |
| B | Procedural Tokyo の方式の調査・導入（タイル化・Worker・地形と道路） | DONE（要点は docs/PROCEDURAL_TOKYO_NOTES.md。タイルの読み込みは Worker、道路は地形に沿わせる（関東・横浜の丘）） |
| C | 建物（PLATEAU の高さ・形、窓・屋上・看板などの自動ディテール） | DONE（横浜：実測の高さ84%、窓・枠・店先・看板帯・夜の部屋明かり・ガラスの空の映り込み・パラペット・三角屋根・屋上設備・ベランダ。LOD2 の形・テクスチャは未） |
| D | 道路・街の設備・交通・NPC | ACTIVE（車道と歩道・横断歩道・停止線・信号・電柱と電線・街路樹・自販機 済。交通は実在の道） |
| E | 海岸・港湾（岸壁・係船柱・テトラ・砂浜・磯・水面） | ACTIVE（岸壁の縁石・係船柱・防波堤とテトラ（地図の120本）・漁港の漁船 済。海づり施設・海面シェーダーは以前から。残り：砂浜の起伏・流木・崖・護岸の階段） |
| F | 空・照明・天候 | ACTIVE（夜の窓明かり・街灯の光と足元の明かり 済） |
| G | 関東全域への適用 | DONE（ワールドマップ「関東」→駅から電車で散策。地形・建物・道路・橋・高架・鉄道・駅・水域。釣り場はなし） |
| H | iPhone 最適化 | TODO |
| I | 実際の景観との比較 | TODO |
| J | 既存ゲームとの統合確認 | TODO |

Phase A の原因と修正（2026-10-10）：①カメラは常にプレイヤーの頭を注視し pitch が 0.05〜1.2（見下ろしのみ）→ pitch を −1.40〜1.2 にし、0.05 未満では視線だけ上へ向ける（約80°まで）。②空の球（半径1200m）が描画距離（軽量800m）より外で切られていた → 空の頂点を遠い面の手前に押し込み、描画距離に関係なく描く。③カメラの最低の高さを地面（丘）基準に。設定タブに回転の速さ。確認：tools/smoke/scenarios/lookup*.mjs（ランドマークタワーを足元から見上げ、軽量画質の空）。

## 現在
- 現在のPhase：1
- 作業ブランチ：claude/index-html-review-refactor-o95pul（指定ブランチ。保全点はコミット fcc7599、遊べる旧版 legacy/2026-10-pre-visual/）
- 最後の正常動作確認：npm test 142件合格・npm run smoke 6/6 OK（Phase 0 完了時）
- 現在のエラー：なし

## 最優先修正：横浜・湘南の機能統一（2026-10-11）
湘南も国土地理院データの実在の地図（data/world/shonan-*）にし、WORLD を地域共通（world.js の combine）に。結果・未完了は docs/REGION_PARITY.md。確認は tools/smoke/scenarios/parity.mjs（横浜と湘南で同じ操作）。

## 外部データの経路（2026-10-10 確認）
| 取得先 | 状態 | 使い方 |
|---|---|---|
| 国土地理院 ベクトルタイル optimal_bvmap-v1（建物・道路・鉄道・水域・海岸線・注記） | ○ CORS * | 横浜は事前変換（tools/gsi）。関東全域はブラウザから直接ストリーミング（Phase 1-2） |
| 国土地理院 標高タイル dem5a_png(z15,5m)/dem_png(z14,10m) | ○ CORS * | 湘南は事前変換。関東全域はストリーミング |
| 国土地理院 住所検索 msearch | ○ | 位置の確認 |
| G空間情報センター CKAN（PLATEAU の目録） | ○ | PLATEAU の取得経路を調べる |
| assets.cms.plateau.reearth.io | 403 | 使えない |
| Geofabrik・Overpass（OSM） | × 接続不可 | GitHub Actions で取得する経路を用意（Phase 1） |
| Wikimedia Commons | ○（回数制限が厳しい） | 写真 41種採用済み |
| iNaturalist API | ○ | 写真の別経路（Phase 7） |

## 既存機能（壊さないもの）
釣り（テンション・キャスト・巻き・合わせ・ファイト）、時間・季節・潮、釣り禁止区域、徒歩・バス（待ち時間）、電車、自転車・車、釣具店（400件）、図鑑（126種）、スタンプ、セーブ hama-tsuri-v2（移行 mapv 2/3）。

## Phase 1 の途中経過
- gsi.js（HamaGSI）：国土地理院の標高（5m→10m）・ベクトルタイルをブラウザで直接読む土台（同時数制限・LRU・Cache Storage・404記録）。tests/gsi.test.js（実物タイル4枚の fixtures）。
- 取得状況：tools/kanto/probe_coverage.py → data/kanto/coverage.json・docs/DATA_COVERAGE.md（関東7都県の陸：5m標高94〜100%、ベクトル100%。伊豆諸島も記録）。
- PLATEAU：G空間情報センターの公開バケット（gsic-opendata S3、Range 可）から CityGML を部分取得。tools/plateau/fetch_heights.py yokohama → data-build/plateau/yokohama-heights.json（実測の高さつき 320,331棟、496ファイル）。未：GSI の建物への結合（build_world.py）。
- OSM：Geofabrik/Overpass は接続不可。GitHub Actions 経路は未作成。
- 追加指示（Procedural Tokyo 方式の3D改修 Phase A〜J）を受けて、Phase A（上方向の描画不具合）を最優先で着手。

## Phase 2/G の途中経過（2026-10-10）
- kanto.js（HamaKanto）：10m 格子の地面（dem5a→dem10、海は −4）。三角形補間で 3D の地面・歩く高さ・道路が同じ面。建物 BldA・道路 RdCL・鉄道 RailCL・水域 WA をタイル枠で切ってゲーム座標に。tests/kanto.test.js。
- index.html：regionAt に 'kanto'、isLand/walk/groundY を関東対応、buildKantoChunk（地面の色は高さ・傾き・水からの目安。道路・鉄道は地形に沿わせる。建物は地面の最低点から・高さは種類と面積の推定。山の木）。関東では近景の描画距離をチャンクの範囲までにし、その先は遠景の地形。交通は出さない。移動タブに「横浜駅・平塚へ戻る」（運賃・時間は目安）。
- 橋（道路コード末尾3）：両岸の高さを結び、水の上の区間は歩ける（欄干・橋桁）。高速道路の高架は柱つき（地面＋7m〜）。トンネル（末尾4）は描かない。川・湖の水面は岸の最低点より0.8m下。
- 横浜の丘：標高8mより上だけ盛り上げ（岸壁・浜・釣り場は平らのまま）。丘のチャンクは地形メッシュ＋建物・道路・電柱・街灯・信号などを丘の高さに。名所の模型も持ち上げる。車と歩行者も地面の高さ。標高タイルが読めない時は平ら（gsi.js の failed）。
- 横浜の高架（首都高・鉄道）も丘の高さに合わせて傾ける。
- 関東の駅：注記コード422の駅名を、600m 以内の線路の「駅部分」に寄せた位置。電車は駅にいる時だけ（行き先に近い駅に着く・待ち時間あり）、駅が遠ければ最寄り駅までバス。駅名標（3D）とミニマップの駅。
- Worker：gsi-worker.js でタイルの取得・解凍・解読（ベクトル・標高 PNG）を別スレッドに。失敗したタイル・動かない環境はメインで読み直す。#noworker で無効。
- Phase 2/G の残り：なし（調整は実機確認しながら）。

## 次にやること
Phase 1：関東全域のデータ取得基盤（国土地理院タイルのストリーミング読み込み＋キャッシュ、取得範囲の記録、OSM 用 GitHub Actions、PLATEAU の経路調査）。

## 最新コミット
（各Phase完了時に更新）
