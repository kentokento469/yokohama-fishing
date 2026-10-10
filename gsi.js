/* 国土地理院タイルのストリーミング読み込み（window.HamaGSI）。関東全域を同じ仕組みで扱う共通の土台。
   ・標高：dem5a_png（z15、約5m。航空レーザ測量の範囲）→ 無ければ dem_png（z14、約10m）。広域は dem_png の低いズーム（遠景用）。
   ・ベクトル：optimal_bvmap-v1（z16。建物・道路・鉄道・水域・海岸線・注記）。
   ・同時に読む数を制限し、メモリ（LRU）とブラウザの Cache Storage（再ダウンロード防止）に保存。404（データなし）は覚えて聞き直さない。
   ・出典：国土地理院（国土地理院コンテンツ利用規約、CC BY 4.0 互換）。Node ではテスト用に fetch・PNG 復号を差し替えられる。 */
(function(root){
'use strict';
const BASE='https://cyberjapandata.gsi.go.jp/xyz/';
const SRC={dem5a:{path:'dem5a_png',z:15,png:true,res:5},dem10:{path:'dem_png',z:14,png:true,res:10},vec:{path:'optimal_bvmap-v1',z:16,png:false}};
const NA=1<<23;
const lon2tx=(lon,z)=>(lon+180)/360*Math.pow(2,z);
const lat2ty=(lat,z)=>{const r=lat*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z);};
const tx2lon=(x,z)=>x/Math.pow(2,z)*360-180;
const ty2lat=(y,z)=>{const n=Math.PI-2*Math.PI*y/Math.pow(2,z);return 180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n)));};
// 標高 PNG の RGBA → Float32（無効は NaN）
function demFromRGBA(px,n){const out=new Float32Array(n);for(let i=0;i<n;i++){const x=px[4*i]*65536+px[4*i+1]*256+px[4*i+2];out[i]=x===NA?NaN:(x<NA?x:x-16777216)*.01;}return out;}
function create(opt){opt=opt||{};const fetchFn=opt.fetch||(typeof fetch!=='undefined'?fetch.bind(root):null);const base=opt.base||BASE;
  const maxConc=opt.concurrency||6,lruMax=opt.lru||400;let active=0;const queue=[];
  const mem=new Map(),pending=new Map(),missing=new Set(),failed=new Set();/* failed：通信の失敗（次に聞かれたら読み直す） */const stats={req:0,hit:0,miss404:0,err:0,bytes:0};
  const cacheP=(typeof caches!=='undefined'&&opt.persist!==false)?caches.open('hama-gsi-v1').catch(()=>null):Promise.resolve(null);
  function lruSet(k,v){mem.set(k,v);if(mem.size>lruMax){const f=mem.keys().next().value;mem.delete(f);}}
  function slot(){return new Promise(res=>{if(active<maxConc){active++;res();}else queue.push(res);});}
  function done(){active--;if(queue.length){active++;queue.shift()();}}
  async function raw(url){const c=await cacheP;if(c){try{const r=await c.match(url);if(r){stats.hit++;return new Uint8Array(await r.arrayBuffer());}}catch(e){}}
    await slot();try{stats.req++;const r=await fetchFn(url);if(r.status===404){stats.miss404++;return null;}if(!r.ok)throw new Error('HTTP '+r.status);
      const buf=await r.arrayBuffer();stats.bytes+=buf.byteLength;if(c){try{c.put(url,new Response(buf.slice(0)));}catch(e){}}return new Uint8Array(buf);}
    finally{done();}}
  async function decodePng(u8){if(opt.decodePng)return opt.decodePng(u8);
    const bmp=await createImageBitmap(new Blob([u8],{type:'image/png'}));const w=bmp.width,h=bmp.height;const cv=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
    const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(bmp,0,0);return{w,h,data:cx.getImageData(0,0,w,h).data};}
  async function gunzipMaybe(u8){if(u8.length>2&&u8[0]===0x1f&&u8[1]===0x8b){if(opt.gunzip)return opt.gunzip(u8);const ds=new DecompressionStream('gzip');return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());}return u8;}
  // 1枚のタイル（種類 kind、z/x/y）。標高は {w,h,h:Float32Array}、ベクトルは decodeMVT の結果
  function tile(kind,z,x,y){const s=SRC[kind];const key=kind+'/'+z+'/'+x+'/'+y;if(mem.has(key)){const v=mem.get(key);mem.delete(key);mem.set(key,v);return Promise.resolve(v);}
    if(missing.has(key))return Promise.resolve(null);if(pending.has(key))return pending.get(key);
    const url=base+s.path+'/'+z+'/'+x+'/'+y+(s.png?'.png':'.pbf');
    const p=raw(url).then(async u8=>{if(!u8){missing.add(key);return null;}let v;
      if(s.png){const im=await decodePng(u8);v={w:im.w,h:im.h,z,x,y,kind,hgt:demFromRGBA(im.data,im.w*im.h)};}
      else{const T=opt.tiles||root.HamaTiles||(typeof require==='function'?require('./tiles.js'):null);v=T.decodeMVT(await gunzipMaybe(u8));v.z=z;v.x=x;v.y=y;}
      failed.delete(key);lruSet(key,v);return v;}).catch(e=>{stats.err++;failed.add(key);return null;}).finally(()=>pending.delete(key));
    pending.set(key,p);return p;}
  // 標高：その地点のタイル（5m を優先、無ければ 10m、低いズームの dem_png は遠景用）
  async function demTileAt(lat,lon,zLow){if(zLow!=null){const z=zLow;return tile('dem10',z,Math.floor(lon2tx(lon,z)),Math.floor(lat2ty(lat,z)));}
    const z5=SRC.dem5a.z;const t5=await tile('dem5a',z5,Math.floor(lon2tx(lon,z5)),Math.floor(lat2ty(lat,z5)));if(t5&&t5.hgt.some(v=>!isNaN(v)))return t5;
    const z=SRC.dem10.z;return tile('dem10',z,Math.floor(lon2tx(lon,z)),Math.floor(lat2ty(lat,z)));}
  // 読み込み済みのタイルから高さ（双一次補間。海・データなしは null）
  function sample(t,lat,lon){if(!t)return null;const fx=(lon2tx(lon,t.z)-t.x)*t.w-.5,fy=(lat2ty(lat,t.z)-t.y)*t.h-.5;const i=Math.max(0,Math.min(t.w-2,Math.floor(fx))),j=Math.max(0,Math.min(t.h-2,Math.floor(fy)));
    const u=Math.max(0,Math.min(1,fx-i)),v=Math.max(0,Math.min(1,fy-j));const H=t.hgt,W=t.w;const a=H[j*W+i],b=H[j*W+i+1],c=H[(j+1)*W+i],d=H[(j+1)*W+i+1];
    if(isNaN(a)||isNaN(b)||isNaN(c)||isNaN(d)){const n=H[Math.round(Math.max(0,Math.min(t.h-1,fy)))*W+Math.round(Math.max(0,Math.min(W-1,fx)))];return isNaN(n)?null:n;}
    return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
  function cachedDem(lat,lon){for(const kind of['dem5a','dem10']){const z=SRC[kind].z;const key=kind+'/'+z+'/'+Math.floor(lon2tx(lon,z))+'/'+Math.floor(lat2ty(lat,z));const t=mem.get(key);if(t){const h=sample(t,lat,lon);if(h!=null||kind==='dem10')return{h,res:SRC[kind].res};}}return null;}
  return{tile,demTileAt,sample,cachedDem,stats,missing,failed,SRC,mem};}
// Node 用：8bit RGB/RGBA の PNG を zlib で復号（テスト・ツール用。ブラウザは canvas を使う）
function nodeDecodePng(u8){const zlib=require('zlib');const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);let o=8,w=0,h=0,ct=0;const idat=[];
  while(o<u8.length){const len=dv.getUint32(o);const type=String.fromCharCode(u8[o+4],u8[o+5],u8[o+6],u8[o+7]);const d=u8.subarray(o+8,o+8+len);
    if(type==='IHDR'){w=dv.getUint32(o+8);h=dv.getUint32(o+12);ct=u8[o+17];}else if(type==='IDAT')idat.push(Buffer.from(d));else if(type==='IEND')break;o+=12+len;}
  const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),out=new Uint8Array(w*h*4),stride=w*bpp;let prev=new Uint8Array(stride);
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)],line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),cur=new Uint8Array(stride);
    for(let i=0;i<stride;i++){const a=i>=bpp?cur[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=line[i];
      if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}cur[i]=v&255;}
    for(let x=0;x<w;x++){out[4*(y*w+x)]=cur[x*bpp];out[4*(y*w+x)+1]=cur[x*bpp+1];out[4*(y*w+x)+2]=cur[x*bpp+2];out[4*(y*w+x)+3]=255;}prev=cur;}
  return{w,h,data:out};}
const API={create,SRC,lon2tx,lat2ty,tx2lon,ty2lat,demFromRGBA,nodeDecodePng,BASE};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaGSI=API;
})(typeof self!=='undefined'?self:this);
