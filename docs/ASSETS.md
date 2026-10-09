# 素材とライセンスの一覧

ゲームで使う素材の出どころ。新しく足すときは、この表に1行追加する（出典・ライセンス・改変内容を書く）。
NC（非営利のみ）・ND（改変禁止）・ライセンス不明の素材は使わない。実在の車・メーカーのロゴや商標は使わない。

| 素材 | 出どころ | ライセンス | 場所・改変 |
|---|---|---|---|
| three.js r149 | jsDelivr（npm three@0.149.0） | MIT | index.html から読み込み（改変なし） |
| 3Dモデル（人・建物・桟橋・海づり施設・車・竿） | このゲームのコードで作った形 | このリポジトリ | index.html（手続き的に生成） |
| テクスチャ（窓・路面・桟橋の床・海の波の法線） | このゲームのコードで作った画像 | このリポジトリ | canvas で生成（`seaWaveTex`・桟橋の床など） |
| 効果音・環境音 | Web Audio API で合成 | このリポジトリ | sound.js（音ファイルなし） |
| 海岸線・陸地（横浜〜大磯） | GSHHS（ユーザー提供の加工データ） | LGPL | data/geo/src。詳細は data/geo/LICENSE_AND_SOURCES.md |
| OSM（道路・建物など） | OpenStreetMap | ODbL 1.0（© OpenStreetMap contributors） | 未取得。取り込むと data/osm・data/tiles。表示に出典を出す |
| 標高（湘南） | 国土地理院 標高タイル（dem_png、z14＝10mメッシュ） | 国土地理院コンテンツ利用規約（CC BY 4.0 互換） | 取得済み。元の格子は data-build/terrain（git外）、ゲーム用は data/terrain/shonan-game.js（40m間引き・ゲーム座標・標高20m以上を立体）。出典は設定タブに表示 |
| 建物の3D（予定） | PLATEAU（国土交通省） | CC BY 4.0 | 未取得。出典表記が必要 |
| 魚の写真 | Wikimedia Commons（画像ごとに確認） | CC0・PD・CC BY・CC BY-SA のみ | 5種採用（data/fish/img、1280px→WebP/AVIF）。残りは取得中。tools/fish/fetch_images.py。各画像の作者・ライセンス・改変は data/fish/images.js と図鑑に表示 |
| 釣具カタログ | ユーザー提供（架空） | このリポジトリ | data/equipment_catalog_400.json |
| 釣り場・規制エリア（湘南） | ユーザー提供の資料 | このリポジトリ | data/shonan-spots.js（位置はおおよそ） |
| 魚種のデータ | 一般的な資料にもとづくおおよそ＋ゲーム用の推定 | このリポジトリ | data/fish/species.json |

外部の PBR テクスチャ・GLB（Poly Haven などの CC0）は、作業環境から取得できないため未使用。取り込むときは
`assets/` に置き、この表に出典 URL・ライセンス・改変内容（縮小・圧縮形式）を書く。
