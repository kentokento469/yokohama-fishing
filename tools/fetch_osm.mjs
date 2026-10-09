#!/usr/bin/env node
/* OpenStreetMap のデータを取り込む（Overpass API）。起動のたびにダウンロードしないよう、結果を data/osm/ に保存する。
   使い方：
     node tools/fetch_osm.mjs hiratsuka            … 平塚を取得して変換（data/osm/hiratsuka.raw.json と hiratsuka.js）
     node tools/fetch_osm.mjs all                  … areas.json の全地域
     node tools/fetch_osm.mjs hiratsuka --from-file 自分で取得したOverpassのJSON  … ダウンロードせず、手元のファイルを変換するだけ
     node tools/fetch_osm.mjs hiratsuka --convert-only  … 保存済みの raw.json を変換し直す
   ・小さい範囲ごとに Overpass API へ1回ずつ問い合わせる（地図タイルは使わない。公開タイルサーバーから大量に取得しない）。
   ・データは ODbL。ゲーム内に「© OpenStreetMap contributors」を表示し、派生データ（変換後のファイル）も ODbL で扱う。
   ・環境変数 OVERPASS_URL で問い合わせ先を変えられる（既定 https://overpass-api.de/api/interpreter）。 */
import fs from 'node:fs';import path from 'node:path';import{execFileSync}from'node:child_process';import{createRequire}from'node:module';
const require=createRequire(import.meta.url);const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const CONV=require(path.join(root,'osm-convert.js'));const SH=require(path.join(root,'shonan.js'));
const cfg=JSON.parse(fs.readFileSync(path.join(root,'data/osm/areas.json'),'utf8'));
const URL_=process.env.OVERPASS_URL||'https://overpass-api.de/api/interpreter';
const args=process.argv.slice(2);const target=args[0];
if(!target){console.error('地域名を指定してください：'+cfg.order.join(' / ')+' / all');process.exit(1);}
const fromFile=args.includes('--from-file')?args[args.indexOf('--from-file')+1]:null,convertOnly=args.includes('--convert-only');
function query([s,w,n,e]){const b=`${s},${w},${n},${e}`;return `[out:json][timeout:120];
(
  way["natural"="coastline"](${b});
  way["highway"](${b});
  way["waterway"~"river|stream|canal|riverbank"](${b});
  way["natural"~"water|beach|bare_rock|rock|reef|cliff|wood|scrub"](${b});
  way["building"](${b});
  way["leisure"~"park|garden|marina"](${b});
  way["landuse"~"grass|forest|harbour"](${b});
  way["man_made"~"pier|breakwater|groyne"](${b});
  way["amenity"~"parking|bicycle_parking|fuel"](${b});
  node["amenity"~"parking|bicycle_parking|fuel"](${b});
  node["shop"~"fishing|outdoor|convenience|bicycle"](${b});
  way["access"~"no|private"](${b});
);
out geom;`;}
function download(q){// Node の fetch はプロキシ設定を使わないことがあるので curl を使う
  return execFileSync('curl',['-sS','--fail','-m','180','-A','yokohama-fishing-game/1.0 (personal hobby project)','--data-urlencode','data@-',URL_],{input:q,maxBuffer:512*1024*1024}).toString();}
function convert(area,raw){const a=cfg.areas[area];const[s,w,n,e]=a.bbox;const p0=SH.toGame(n,w),p1=SH.toGame(s,e);
  const bboxGame={x0:Math.min(p0[0],p1[0]),x1:Math.max(p0[0],p1[0]),y0:Math.min(p0[1],p1[1]),y1:Math.max(p0[1],p1[1])};
  const R=CONV.convert(raw,(la,lo)=>SH.toGame(la,lo).map(v=>Math.round(v*10)/10),{area,bbox:a.bbox,bboxGame,generated:new Date().toISOString()});
  R.meta.osm_base=raw.osm3s&&raw.osm3s.timestamp_osm_base||null;R.meta.bboxGame=bboxGame;
  const out=`/* 自動生成：tools/fetch_osm.mjs（${a.name}）。直接編集しない。\n   データ：© OpenStreetMap contributors（ODbL 1.0, https://www.openstreetmap.org/copyright）。このファイルも ODbL の派生データとして扱う。\n   est 層はゲーム用の推定値で、実在の施設の情報ではない。 */\n(function(root){const D=${JSON.stringify(R)};if(typeof module!=='undefined'&&module.exports)module.exports=D;else{root.HamaOSM=root.HamaOSM||{};root.HamaOSM[${JSON.stringify(area)}]=D;}})(typeof self!=='undefined'?self:this);\n`;
  fs.writeFileSync(path.join(root,`data/osm/${area}.js`),out);
  console.log(`${a.name}: 道路${R.roads.length} 海岸線${R.coast.length}（陸${R.land.length}） 川${R.rivers.length} 建物${R.buildings.length} 駐車場${R.parking.length} 駐輪場${R.bikeParking.length} 規制${R.restricted.length} → data/osm/${area}.js`);}
for(const area of target==='all'?cfg.order:[target]){if(!cfg.areas[area]){console.error('未登録の地域：'+area);process.exit(1);}
  const rawPath=path.join(root,`data/osm/${area}.raw.json`);let raw;
  if(fromFile)raw=JSON.parse(fs.readFileSync(fromFile,'utf8'));
  else if(convertOnly)raw=JSON.parse(fs.readFileSync(rawPath,'utf8'));
  else{console.log(`${cfg.areas[area].name} を取得中…`);try{raw=JSON.parse(download(query(cfg.areas[area].bbox)));}catch(e){console.error(`取得に失敗しました（${e.message.split('\n')[0]}）。ネットワークの許可（overpass-api.de）を確認するか、--from-file で手元のファイルを変換してください。ゲームは近似の地図のまま起動します。`);process.exit(2);}
    fs.writeFileSync(rawPath,JSON.stringify(raw));}
  convert(area,raw);}
