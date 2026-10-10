# MASTER_PROGRESS（関東全域3D化・ゲーム全面進化）

セッション開始時はまずここを読む。構造は docs/ARCHITECTURE.md（`node tools/inventory.mjs` で更新）、細かい経緯は docs/progress.md。

## 状態
| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 現状分析・保全・作業管理 | DONE |
| 1 | 関東全域の実地理データ取得 | TODO |
| 2 | 関東全域の本格3D地形化 | TODO |
| 3 | 街並み・自然・海面の高品質化 | TODO |
| 4 | NPCと街の生活感 | TODO |
| 5 | カメラ操作の改善 | TODO |
| 6 | 釣りの3D表現とUI刷新 | TODO |
| 7 | 魚の写真と3Dモデル | TODO |
| 8 | 釣具・装備システムの高度化 | TODO |
| 9 | 魚拓・釣果コレクション | TODO |
| 10 | 生き餌・泳がせ釣り | TODO |
| 11 | 市場・魚売却・ゲーム経済 | TODO |

## 現在
- 現在のPhase：1
- 作業ブランチ：claude/index-html-review-refactor-o95pul（指定ブランチ。保全点はコミット fcc7599、遊べる旧版 legacy/2026-10-pre-visual/）
- 最後の正常動作確認：npm test 142件合格・npm run smoke 6/6 OK（Phase 0 完了時）
- 現在のエラー：なし

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

## 次にやること
Phase 1：関東全域のデータ取得基盤（国土地理院タイルのストリーミング読み込み＋キャッシュ、取得範囲の記録、OSM 用 GitHub Actions、PLATEAU の経路調査）。

## 最新コミット
（各Phase完了時に更新）
