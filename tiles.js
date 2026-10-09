/* 横浜みなと釣り旅 — 関東の実在地図タイル（PMTiles v3 / MVT）の読み込み。外部ライブラリなし。Node でもブラウザでも動く。
   ・PMTiles：1つのファイルに z/x/y のタイルを詰めた形式。必要なタイルだけを Range 読み込みする（ファイル全体は読まない）。
   ・MVT：Mapbox Vector Tile（座標はタイル内の 0〜4096。y は下向き）。
   ・読み込み：同じタイルの重複読み込みを防ぎ（読み込み中は同じ Promise を返す）、最近使ったタイルをキャッシュする（LRU）。
   使い方：const ts=HamaTiles.open(url); await ts.ready; const t=await ts.tile(z,x,y); t.layers.roads → [{type,props,geom}]
          HamaTiles.tilesForBBox(bbox,z)、tileToLonLat(z,x,y,px,py)、zoomFor(mpp,lat) */
(function(root){
'use strict';
const isNode=typeof module!=='undefined'&&module.exports&&typeof window==='undefined';

/* ===== 解凍 ===== */
async function gunzip(u8){
  if(isNode){return new Uint8Array(require('zlib').gunzipSync(Buffer.from(u8)));}
  const ds=new DecompressionStream('gzip');const s=new Blob([u8]).stream().pipeThrough(ds);return new Uint8Array(await new Response(s).arrayBuffer());}
const decomp=(u8,c)=>c===2?gunzip(u8):c===1||c===0?Promise.resolve(u8):Promise.reject(new Error('未対応の圧縮 '+c));

/* ===== 読み込み元 ===== */
function fetchSource(url){return{url,async get(off,len){const r=await fetch(url,{headers:{Range:`bytes=${off}-${off+len-1}`}});if(!r.ok&&r.status!==206)throw new Error(`HTTP ${r.status} ${url}`);
  const b=new Uint8Array(await r.arrayBuffer());// Range に対応しないサーバーは全体を返す
  return r.status===200&&b.length>len?b.subarray(off,off+len):b;}};}
function fileSource(path){const fs=require('fs');const fd=fs.openSync(path,'r');return{url:path,async get(off,len){const b=Buffer.alloc(len);fs.readSync(fd,b,0,len,off);return new Uint8Array(b);}};}

/* ===== PMTiles v3 ===== */
function u64(dv,o){return dv.getUint32(o,true)+dv.getUint32(o+4,true)*4294967296;}
function header(u8){const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);const magic=String.fromCharCode(...u8.subarray(0,7));if(magic!=='PMTiles'||u8[7]!==3)throw new Error('PMTiles v3 ではない');
  return{rootOff:u64(dv,8),rootLen:u64(dv,16),metaOff:u64(dv,24),metaLen:u64(dv,32),leafOff:u64(dv,40),leafLen:u64(dv,48),dataOff:u64(dv,56),dataLen:u64(dv,64),
    addressed:u64(dv,72),entries:u64(dv,80),contents:u64(dv,88),clustered:u8[96],internalComp:u8[97],tileComp:u8[98],tileType:u8[99],minZoom:u8[100],maxZoom:u8[101],
    bounds:[dv.getInt32(102,true)/1e7,dv.getInt32(106,true)/1e7,dv.getInt32(110,true)/1e7,dv.getInt32(114,true)/1e7],centerZoom:u8[118],center:[dv.getInt32(119,true)/1e7,dv.getInt32(123,true)/1e7]};}
function varint(b,p){let v=0,s=1,x;do{x=b[p.i++];v+=(x&127)*s;s*=128;}while(x&128);return v;}
function directory(u8){const p={i:0};const n=varint(u8,p);const e=new Array(n);let id=0;
  for(let i=0;i<n;i++){id+=varint(u8,p);e[i]={id,run:0,len:0,off:0};}for(const x of e)x.run=varint(u8,p);for(const x of e)x.len=varint(u8,p);
  for(let i=0;i<n;i++){const v=varint(u8,p);e[i].off=v===0&&i>0?e[i-1].off+e[i-1].len:v-1;}return e;}
function findEntry(e,id){let lo=0,hi=e.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(e[m].id<id)lo=m+1;else if(e[m].id>id)hi=m-1;else return e[m];}
  if(hi>=0){const x=e[hi];if(x.run===0)return x;if(id-x.id<x.run)return x;}return null;}
// z/x/y → タイルID（ヒルベルト曲線）
function zxyToId(z,x,y){if(z>26)throw new Error('z too large');let acc=0;for(let t=0;t<z;t++)acc+=4**t;const n=2**z;let d=0,rx,ry;
  for(let s=n/2;s>=1;s/=2){rx=(x&s)>0?1:0;ry=(y&s)>0?1:0;d+=s*s*((3*rx)^ry);if(ry===0){if(rx===1){x=s-1-x;y=s-1-y;}[x,y]=[y,x];}}return acc+d;}

/* ===== MVT ===== */
function readPbf(u8){let i=0;const L=u8.length;
  const vint=()=>{let v=0,s=1,b;do{b=u8[i++];v+=(b&127)*s;s*=128;}while(b&128);return v;};
  return{get done(){return i>=L;},tag(){const t=vint();return[Math.floor(t/8),t&7];},vint,
    svint(){const v=vint();return v%2?-(v+1)/2:v/2;},bytes(){const n=vint();const b=u8.subarray(i,i+n);i+=n;return b;},
    f32(){const v=new DataView(u8.buffer,u8.byteOffset+i,4).getFloat32(0,true);i+=4;return v;},f64(){const v=new DataView(u8.buffer,u8.byteOffset+i,8).getFloat64(0,true);i+=8;return v;},
    skip(w){if(w===0)vint();else if(w===1)i+=8;else if(w===2){const n=vint();i+=n;}else if(w===5)i+=4;}};}
const td=typeof TextDecoder!=='undefined'?new TextDecoder():null;
const str=b=>td?td.decode(b):Buffer.from(b).toString('utf8');
function value(b){const r=readPbf(b);let v=null;while(!r.done){const[f,w]=r.tag();if(f===1)v=str(r.bytes());else if(f===2)v=r.f32();else if(f===3)v=r.f64();else if(f===4||f===5)v=r.vint();else if(f===6)v=r.svint();else if(f===7)v=!!r.vint();else r.skip(w);}return v;}
function packed(b){const r=readPbf(b),a=[];while(!r.done)a.push(r.vint());return a;}
function geometry(cmds,type){const parts=[];let x=0,y=0,cur=null,i=0;
  while(i<cmds.length){const c=cmds[i++],id=c&7,n=c>>3;
    for(let k=0;k<n;k++){if(id===1||id===2){const dx=cmds[i++],dy=cmds[i++];x+=dx%2?-(dx+1)/2:dx/2;y+=dy%2?-(dy+1)/2:dy/2;
        if(id===1){cur=[[x,y]];parts.push(cur);}else cur.push([x,y]);}else if(id===7&&cur)cur.push(cur[0].slice());}}
  if(type!==3)return parts;
  // 面：外周（符号付き面積が正＝y下向きで時計回り）ごとに穴をまとめる
  const polys=[];for(const r of parts){let a=0;for(let j=0;j<r.length-1;j++)a+=r[j][0]*r[j+1][1]-r[j+1][0]*r[j][1];if(a>0||!polys.length)polys.push([r]);else polys[polys.length-1].push(r);}return polys;}
function decodeMVT(u8){const out={};const r=readPbf(u8);
  while(!r.done){const[f,w]=r.tag();if(f!==3){r.skip(w);continue;}const lr=readPbf(r.bytes());let name='',ext=4096;const keys=[],vals=[],feats=[];
    while(!lr.done){const[g,ww]=lr.tag();if(g===1)name=str(lr.bytes());else if(g===3)keys.push(str(lr.bytes()));else if(g===4)vals.push(value(lr.bytes()));else if(g===5)ext=lr.vint();else if(g===2)feats.push(lr.bytes());else lr.skip(ww);}
    out[name]={extent:ext,features:feats.map(fb=>{const fr=readPbf(fb);let tags=[],type=0,geom=[],id=null;
      while(!fr.done){const[h,www]=fr.tag();if(h===1)id=fr.vint();else if(h===2)tags=packed(fr.bytes());else if(h===3)type=fr.vint();else if(h===4)geom=packed(fr.bytes());else fr.skip(www);}
      const props={};for(let k=0;k<tags.length;k+=2)props[keys[tags[k]]]=vals[tags[k+1]];return{id,type,props,geom:geometry(geom,type)};})};}
  return out;}

/* ===== タイルの計算 ===== */
const lon2tx=(lon,z)=>(lon+180)/360*2**z;
const lat2ty=(lat,z)=>{const r=lat*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z;};
const tx2lon=(x,z)=>x/2**z*360-180;
const ty2lat=(y,z)=>{const n=Math.PI*(1-2*y/2**z);return Math.atan(Math.sinh(n))*180/Math.PI;};
function tileBounds(z,x,y){return[tx2lon(x,z),ty2lat(y+1,z),tx2lon(x+1,z),ty2lat(y,z)];}// [w,s,e,n]
function tileToLonLat(z,x,y,px,py,ext){ext=ext||4096;return[tx2lon(x+px/ext,z),ty2lat(y+py/ext,z)];}
function tilesForBBox(b,z,max){const n=2**z;const x0=Math.max(0,Math.floor(lon2tx(b[0],z))),x1=Math.min(n-1,Math.floor(lon2tx(b[2],z))),y0=Math.max(0,Math.floor(lat2ty(b[3],z))),y1=Math.min(n-1,Math.floor(lat2ty(b[1],z)));
  const out=[];for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)out.push([z,x,y]);if(max&&out.length>max)return null;return out;}
// 1ピクセルあたりの実距離（m）から、ちょうどよいズーム（タイル1px≒画面1px）
function zoomFor(mpp,lat,tilePx){const z=Math.log2(156543.034*Math.cos(lat*Math.PI/180)/mpp*(256/(tilePx||256)));return z;}

/* ===== タイルの読み込みとキャッシュ ===== */
function open(src,opt){opt=opt||{};const S=typeof src==='string'?(isNode&&!/^https?:/.test(src)?fileSource(src):fetchSource(src)):src;
  const cache=new Map(),inflight=new Map(),dirCache=new Map();const max=opt.cacheTiles||256;let H=null;const stats={fetched:0,cached:0,bytes:0,missing:0,dedup:0};
  const ts={url:S.url,stats,header:null,metadata:null,cache};
  ts.ready=(async()=>{const h=await S.get(0,16384);H=header(h);ts.header=H;
    const root=await decomp(H.rootOff+H.rootLen<=h.length?h.subarray(H.rootOff,H.rootOff+H.rootLen):await S.get(H.rootOff,H.rootLen),H.internalComp);dirCache.set('root',directory(root));
    if(H.metaLen){try{ts.metadata=JSON.parse(str(await decomp(await S.get(H.metaOff,H.metaLen),H.internalComp)));}catch(e){ts.metadata=null;}}return ts;})();
  async function locate(id){let dir=dirCache.get('root');for(let depth=0;depth<4;depth++){const e=findEntry(dir,id);if(!e)return null;if(e.run>0)return{off:H.dataOff+e.off,len:e.len};
      const k='L'+e.off;let d=dirCache.get(k);if(!d){d=directory(await decomp(await S.get(H.leafOff+e.off,e.len),H.internalComp));dirCache.set(k,d);}dir=d;}return null;}
  // 戻り値：{z,x,y,layers} / null（タイルなし＝海や範囲外）。z が maxZoom を超えたら親のタイル（over）を返す
  ts.tile=async(z,x,y)=>{await ts.ready;let oz=z,ox=x,oy=y;if(z>H.maxZoom){const d=z-H.maxZoom;oz=H.maxZoom;ox=x>>d;oy=y>>d;}const key=oz+'/'+ox+'/'+oy;
    if(cache.has(key)){stats.cached++;const v=cache.get(key);cache.delete(key);cache.set(key,v);return v;}
    if(inflight.has(key)){stats.dedup++;return inflight.get(key);}
    const p=(async()=>{const loc=await locate(zxyToId(oz,ox,oy));let v=null;if(!loc)stats.missing++;else{const raw=await S.get(loc.off,loc.len);stats.fetched++;stats.bytes+=raw.length;v={z:oz,x:ox,y:oy,layers:decodeMVT(await decomp(raw,H.tileComp))};}
      cache.set(key,v);inflight.delete(key);while(cache.size>max)cache.delete(cache.keys().next().value);return v;})();
    p.catch(()=>inflight.delete(key));inflight.set(key,p);return p;};
  ts.peek=(z,x,y)=>{if(H&&z>H.maxZoom){const d=z-H.maxZoom;z=H.maxZoom;x>>=d;y>>=d;}const k=z+'/'+x+'/'+y;return cache.has(k)?cache.get(k):undefined;};
  return ts;}

const API={open,header,directory,findEntry,zxyToId,decodeMVT,tileBounds,tileToLonLat,tilesForBBox,zoomFor,lon2tx,lat2ty,tx2lon,ty2lat,fetchSource,fileSource};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaTiles=API;
})(typeof self!=='undefined'?self:this);
