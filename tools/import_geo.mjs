// data/geo/src の GeoJSON（EPSG:4326）を検査して、ゲームが読み込む data/geo/geo-data.js を作る。
//   node tools/import_geo.mjs
// 入力（提供パックの配置）：
//   manifest.json、overview/*.geojson（全域の海岸線・陸地。地図レイヤーに読み込む）、
//   areas/*.geojson（エリア別の切り出し。overview と重複するので検査だけ）、area_coverage_rectangles.geojson（取り込み範囲。行政界ではない）、
//   osm/*.geojson（tools/import_osm_geojson.py の出力。エリア別 <area>_<layer> は重複なので読まない）、*_osm.geojson（fetch_osm_geojson.py の出力）
// 出力：geo-data.js（window.HamaGeoData。緯度経度のまま）と VALIDATION.md
import fs from 'fs';import path from 'path';import {createRequire} from 'module';
const require=createRequire(import.meta.url);const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const MD=require(path.join(root,'mapdata.js'));
const src=path.join(root,'data/geo/src');const manifest=JSON.parse(fs.readFileSync(path.join(src,'manifest.json'),'utf8'));
const bbox=manifest.coverage_bbox_wsen||manifest.bbox_wsen;
const list=d=>fs.existsSync(path.join(src,d))?fs.readdirSync(path.join(src,d)).filter(f=>f.endsWith('.geojson')).sort().map(f=>path.join(d,f)):[];
const files={},areas=[];const rep=['# 地図データの検査結果（tools/import_geo.mjs が自動生成）','',`範囲（manifest）：経度 ${bbox[0]}〜${bbox[2]}、緯度 ${bbox[1]}〜${bbox[3]}、CRS ${manifest.crs}`,''];
let bad=0;const AREA_KEYS=Object.keys(manifest.areas||{});
function check(rel){const fc=JSON.parse(fs.readFileSync(path.join(src,rel),'utf8'));const v=MD.validate(fc,{bbox});
  rep.push(`## ${rel}`,`- 判定：${v.ok?'OK':'エラー'}・地物 ${v.features}・頂点 ${v.vertices}・種類 ${JSON.stringify(v.types)}・辺の長さ 中央値 ${v.segment.median}m／最大 ${v.segment.max}m`);
  for(const e of v.err.slice(0,8))rep.push(`- エラー：${e}`);for(const w of v.warn.slice(0,8))rep.push(`- 注意：${w}`);if(v.warn.length>8)rep.push(`- 注意 ほか${v.warn.length-8}件`);rep.push('');if(!v.ok)bad++;return v.ok?fc:null;}
for(const rel of list('overview')){const fc=check(rel);if(fc)files[rel]={layer:null,meta:fc.metadata||null,features:fc.features};}
for(const rel of list('areas'))check(rel);
if(fs.existsSync(path.join(src,'area_coverage_rectangles.geojson'))){const fc=check('area_coverage_rectangles.geojson');
  if(fc)for(const f of fc.features){const p=f.properties||{};const c=f.geometry.coordinates[0];areas.push({id:p.slug,name:p.name_ja,bbox:[Math.min(...c.map(q=>q[0])),Math.min(...c.map(q=>q[1])),Math.max(...c.map(q=>q[0])),Math.max(...c.map(q=>q[1]))],administrative:false});}}
for(const rel of[...list('osm'),...list('.').filter(f=>/_osm\.geojson$/.test(f))]){const base=path.basename(rel,'.geojson').replace(/_osm$/,'');
  if(rel.startsWith('osm')&&AREA_KEYS.some(a=>base.startsWith(a+'_')))continue;const layer=MD.OSM_FILE_LAYER[base]||null;const fc=check(rel);rep[rep.length-2]+=`・レイヤー ${layer||'（対応なし・読み込まない）'}`;
  if(fc&&layer)files[rel]={layer,meta:fc.metadata||null,features:fc.features};}
const out=`/* 自動生成：tools/import_geo.mjs。直接編集しない。元データ：data/geo/src。
   GSHHG/GSHHS（Wessel & Smith、NOAA/University of Hawaii、LGPL）：海岸線・陸地の概形（中解像度・粗い）。OpenStreetMap 由来のファイルがあれば © OpenStreetMap contributors（ODbL）。
   出典と注意：data/geo/LICENSE_AND_SOURCES.md。エリアの四角形は取り込み範囲で、行政界ではない。 */
(function(root){const D=${JSON.stringify({manifest,areas,files})};if(typeof module!=='undefined'&&module.exports)module.exports=D;else root.HamaGeoData=D;})(typeof self!=='undefined'?self:this);
`;
fs.writeFileSync(path.join(root,'data/geo/geo-data.js'),out);fs.writeFileSync(path.join(root,'data/geo/VALIDATION.md'),rep.join('\n')+'\n');
console.log(`地図レイヤーに読み込み ${Object.keys(files).length} ファイル・エリア ${areas.length}${bad?`・エラー ${bad}`:''} → data/geo/geo-data.js（検査結果 data/geo/VALIDATION.md）`);
if(bad)process.exit(1);
