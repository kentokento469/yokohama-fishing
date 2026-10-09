// 標高の格子（data-build/terrain/<名前>.bin、緯度経度のタイル）→ ゲーム座標の間引いた格子（data/terrain/<名前>-game.js）
//   node tools/terrain/build_game_grid.mjs shonan [--dx 40]
// ・湘南（等倍）の範囲で dx m ごとに標高（0.1m 単位の Int16、無効 -32768）を取り出す。海（ゲームの陸の外）と江の島（手作りの丘）は無効。
// ・出典：国土地理院 標高タイル（加工して作成）。
import fs from 'fs';import path from 'path';import {createRequire} from 'module';
const require=createRequire(import.meta.url);const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const GEO=require(path.join(root,'geo.js'));const SH=require(path.join(root,'shonan.js'));const TR=require(path.join(root,'terrain.js'));
const name=process.argv[2]||'shonan';const dx=+(process.argv[process.argv.indexOf('--dx')+1]||0)||40;
const m=JSON.parse(fs.readFileSync(path.join(root,'data-build/terrain',name+'.json'),'utf8'));
const buf=fs.readFileSync(path.join(root,'data-build/terrain',name+'.bin'));
const g=TR.grid(m,new Int16Array(buf.buffer,buf.byteOffset,buf.length/2));
const B=GEO.SHONAN.bounds,x0=B.x0,y0=B.y0,nx=Math.ceil((B.x1-B.x0)/dx)+1,ny=Math.ceil((B.y1-B.y0)/dx)+1;
const out=new Int16Array(nx*ny).fill(-32768);let land=0,max=-1e9;
const pip=(p,x,y)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[xi,yi]=p[i],[xj,yj]=p[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;};
for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=x0+i*dx,y=y0+j*dx;
  if(!SH.isLand(x,y)||pip(SH.ENOSHIMA,x,y))continue;const[lat,lon]=GEO.toLatLon(x,y,GEO.SHONAN);const h=g.heightAt(lat,lon);
  out[j*nx+i]=h==null?0:Math.max(-3000,Math.min(30000,Math.round(h*10)));land++;if(h!=null&&h>max)max=h;}
const meta={region:'shonan',x0,y0,dx,nx,ny,scale:.1,nodata:-32768,base:20,source:m.source,license:m.license,attribution:m.attribution,
  note:'ゲーム座標（等倍）で dx m ごとの標高。海と江の島は無効。ゲームでは base m より上だけを立体にする（海沿いの平地は地面の高さ）'};
const b64=Buffer.from(out.buffer).toString('base64');
fs.mkdirSync(path.join(root,'data/terrain'),{recursive:true});
fs.writeFileSync(path.join(root,'data/terrain',name+'-game.js'),`/* 自動生成：tools/terrain/build_game_grid.mjs（${m.attribution}）。直接編集しない */\n(function(root){const D=${JSON.stringify(Object.assign(meta,{data:b64}))};if(typeof module!=='undefined'&&module.exports)module.exports=D;else(root.HamaTerrainData=root.HamaTerrainData||{})[D.region]=D;})(typeof self!=='undefined'?self:this);\n`);
console.log(`${name}: ${nx}×${ny}（${dx}m）陸 ${land} 点、最高 ${max.toFixed(1)}m、${(b64.length/1024).toFixed(0)}KB`);
