# OpenStreetMap データ（湘南：鎌倉〜大磯）

- 取得：`node tools/fetch_osm.mjs hiratsuka`（平塚）、`node tools/fetch_osm.mjs all`（全地域）。範囲は `areas.json`。
- 手元で取得した Overpass の JSON を変換するだけ：`node tools/fetch_osm.mjs hiratsuka --from-file ファイル`
- 出力：`<地域>.raw.json`（取得したそのまま）と `<地域>.js`（ゲーム用に変換したもの。`window.HamaOSM[地域]`）。
- ゲームは `<地域>.js` があれば読み込み、なければ従来の近似の地図（`shonan.js`）で起動する。

## ライセンス
- データは © OpenStreetMap contributors、ODbL 1.0（https://www.openstreetmap.org/copyright）。
- ゲーム画面と配布物に帰属表示を出す。変換後のファイルも ODbL の派生データとして扱う。
- 地図タイルは使わない（公開タイルサーバーからの大量取得・オフライン保存はしない）。

## 実在情報と推定値の区別
- `osm` の各層は OSM にあった情報だけ。
- `est` 層（駐車場の料金・台数・利用時間、建物の階数など）はゲーム用の推定値で、実在の施設の情報ではない。

## 現状
- 2026-10 時点の作業環境ではネットワークの制限で Overpass API に接続できず、実データは未取得。
- `tests/fixtures/osm-sample.json` は変換と経路探索のテスト用の**架空データ**で、実在の地図ではない。
