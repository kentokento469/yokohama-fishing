// data/geo/src の GeoJSON（EPSG:4326）を検査して、ゲームが読み込む data/geo/geo-data.js を作る。
//   node tools/import_geo.mjs
// 入力：GSHHS の海岸線・陸地（提供ZIP）、manifest.json、あれば fetch_osm_geojson.py が出した *_osm.geojson。
// 出力：geo-data.js（window.HamaGeoData。緯度経度のまま。ゲーム座標への変換は geo.js）と VALIDATION.md（検査結果）。
import fs from 'fs';import path from 'path';import {createRequire} from 'module';
const require=createRequire(import.meta.url);const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const MD=require(path.join(root,'mapdata.js'));const GEO=require(path.join(root,'geo.js'));
const src=path.join(root,'data/geo/src');const manifest=JSON.parse(fs.readFileSync(path.join(src,'manifest.json'),'utf8'));
const files={};const rep=[`# 地図データの検査結果（tools/import_geo.mjs が自動生成）`,'',`範囲（manifest）：経度 ${manifest.bbox_wsen[0]}〜${manifest.bbox_wsen[2]}、緯度 ${manifest.bbox_wsen[1]}〜${manifest.bbox_wsen[3]}、CRS ${manifest.crs}`,''];
let bad=0;
for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.geojson')).sort()){
  const fc=JSON.parse(fs.readFileSync(path.join(src,f),'utf8'));const v=MD.validate(fc,{bbox:manifest.bbox_wsen});
  const osm=/_osm\.geojson$/.test(f);const layer=osm?MD.OSM_FILE_LAYER[f.replace(/_osm\.geojson$/,'')]||null:null;
  rep.push(`## ${f}`,`- 判定：${v.ok?'OK':'エラー'}・地物 ${v.features}・頂点 ${v.vertices}・種類 ${JSON.stringify(v.types)}`,`- 辺の長さ（実距離）：中央値 ${v.segment.median}m・最大 ${v.segment.max}m`+(osm?`・レイヤー ${layer||'（対応なし・読み込まない）'}`:''));
  for(const e of v.err.slice(0,10))rep.push(`- エラー：${e}`);for(const w of v.warn.slice(0,10))rep.push(`- 注意：${w}`);if(v.warn.length>10)rep.push(`- 注意 ほか${v.warn.length-10}件`);rep.push('');
  if(!v.ok){bad++;continue;}if(osm&&!layer)continue;
  files[f]={layer,meta:fc.metadata||null,features:fc.features};}
const out=`/* 自動生成：tools/import_geo.mjs。直接編集しない。元データ：data/geo/src。
   GSHHS/GSHHG（Wessel & Smith, LGPL）：海岸線・陸地の概形（中解像度・粗い）。OpenStreetMap 由来のファイルがあれば © OpenStreetMap contributors（ODbL）。
   出典と注意：data/geo/LICENSE_AND_SOURCES.md */
(function(root){const D=${JSON.stringify({manifest,files})};if(typeof module!=='undefined'&&module.exports)module.exports=D;else root.HamaGeoData=D;})(typeof self!=='undefined'?self:this);
`;
fs.writeFileSync(path.join(root,'data/geo/geo-data.js'),out);fs.writeFileSync(path.join(root,'data/geo/VALIDATION.md'),rep.join('\n')+'\n');
console.log(`読み込み ${Object.keys(files).length} ファイル${bad?`・エラー ${bad}`:''} → data/geo/geo-data.js（検査結果 data/geo/VALIDATION.md）`);
if(bad)process.exit(1);
