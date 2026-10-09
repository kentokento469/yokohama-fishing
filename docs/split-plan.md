# ファイル分割の計画（Vite + ES Modules）

## 方針

- **見た目と挙動は変えずに分ける**。分割と機能変更を同じコミットに混ぜない。
- 1ステップごとに「起動 → 釣り1回 → バス移動 → セーブ・ロード」を確認してからコミットする。
- three.js は npm の `three@0.149.0` に固定する（CDN をやめる）。バージョンを上げるのは分割が終わってから別作業で行う（r150 以降は色空間や光の強さの既定値が変わり、見た目が変わるため）。
- 公開は GitHub Pages を想定し、`vite.config.js` に `base: './'` を設定する。

## 目標の構成

```
index.html            … HTML の骨組みだけ（HUD・シート・タイトルのマークアップ）
src/
  main.js             … 起動（start）・メインループ（update / render / frame）
  style.css           … いまの <style> をそのまま移す
  core/
    util.js           … $, clamp, lerp, rnd, mulberry, hash
    state.js          … S（セーブデータ）, fresh, save, load, SAVE_KEY
    time.js           … hourF, gameDate, moonAge, tideInfo, tideAt, tmul, seasonTxt, fmtTime, advance, keyLerp
  data/
    map.js            … SC, LAND, DAIKOKU, ISLE, RECTS, INDUSTRY, PARKS, ROAD, RAIL, ROADS2, YAMASHITA, BEACH, TETRA_LINES, AREAS
    fish.js           … FISH, FISH_IDS, TM_LABEL, BAIT, RODS
    places.js         … SPOTS, SIGHTS, STATIONS
    sky.js            … SKYTOP, SKYHOR, SEA, SUN, HEMI, SUNC, DARK（時間帯の色のキー）
  world/
    geo.js            … pip, isLand, isWater, rectAt, segDist, lineDist, nearCoast, inTetra
    collision.js      … addCol, colAt, walk, groundY
    textures.js       … canvasTex と各テクスチャ, worldUV, winMats, EMISSIVE
    terrain.js        … 海・陸・道路の帯・桟橋・テトラ
    streets.js        … 街灯・電柱と電線・街路樹・バス停（byTile / fitInstances を使う）
    landmarks.js      … 名所の3Dモデル, LANDMARK_KEEP
    chunks.js         … zoneAt, okSpot, buildChunk, updChunks
  render/
    renderer.js       … renderer, scene, camera, 光, resize, MOBILE, 共通ヘルパー（box, lam, flatMat など）
    sky.js            … 空のシェーダー, updSky
    camera.js         … placeCam, snapCam, yawFor, angLerp
  actors/
    human.js          … makeHuman, animHuman
    player.js         … プレイヤー（ME, P）
    traffic.js        … 歩行者と車, updTraffic
  fishing/
    fishing.js        … F, 状態機械（idle→aim→fly→wait→bite→fight）, candidates, pickFish
    rod.js            … 竿・糸・ウキ・ジグ, updRod, poseFishing
    nabura.js         … updateNabura
    fx.js             … 波紋・しぶき・鳥, updFX
  ui/
    input.js          … スティック・キーボード・ドラッグ
    hud.js            … updUI, updClock, toast, updMoney, 目印スプライト
    sheet.js          … メニュー（移動・図鑑・スタンプ・釣具店・遊び方）, travel
    result.js         … 釣果カード・名所カード
    map2d.js          … drawMap2D, ミニマップ, 移動タブの地図
    fishArt.js        … drawFish, drawFishCanvas
```

## 進め方（1ステップ＝1コミット）

1. **Vite の土台**：`package.json`（vite, three@0.149.0）を作り、script の中身を丸ごと `src/main.js` へ、CSS を `src/style.css` へ移す。`window.THREE` の代わりに `import * as THREE from 'three'`。この時点で動作は今と同じ。
2. **データを切り出す**：`data/*.js`。依存のない定数だけなので安全。
3. **純粋な関数を切り出す**：`core/util.js`, `core/time.js`, `world/geo.js`。
4. **状態の持ち方を整える**：`S = fresh()` のような「変数ごと差し替え」は、ES Modules では import 先から再代入できない。`state.S` のように1つのオブジェクトに入れるか、`Object.assign(S, fresh())` に変える。`F`, `N`, `nearSpot`, `yaw` なども同じ扱い。
5. **3D の土台と世界**：`render/renderer.js` → `world/textures.js` → `terrain` / `streets` / `landmarks` / `chunks`。
6. **人・交通・釣り・演出**：`actors/*`, `fishing/*`。
7. **UI**：`ui/*`。HTML の onclick 割り当ては各モジュールの `init()` で行う。
8. **仕上げ**：ESLint（no-undef で取りこぼしを検出）、Playwright のスモークテスト（起動・釣り1回・メニューでエラーが出ないこと）、GitHub Actions で Pages へデプロイ。

## 注意点

- 循環参照に気をつける。例：`updUI` は F と nearSpot を読み、釣りロジックは toast を呼ぶ。UI → 釣りの一方向に揃え、釣り側から UI へは小さなイベント（コールバック）で知らせる。
- `localStorage` のキー `hama-tsuri-v2` とセーブの形は変えない（既存のセーブを壊さないため）。
- 分割の途中も `npm run build` の出力（`dist/`）をスマホで開いて確認できるようにする。
