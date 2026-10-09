/* 横浜みなと釣り旅 — 共通の座標システム（3Dフィールド・ミニマップ・地図画面・全画面ワールドマップで共有する）
   ・ゲーム座標：単位メートル。x が東、y が南（3D では y → z）。高さは実寸。
   ・湘南：緯度経度（EPSG:4326）から、固定の原点（北緯35.345°・東経139.56° → ゲーム座標 (2400, 8300)）を基準に、
     正距円筒図法（この緯度での1度あたりの長さで換算）で変換する。等倍（sc=1、実際のメートル）。関東の実在地図も同じ変換。相互変換できる。
   ・横浜：手描きの地図（元の座標×3、距離は約1/3）で、緯度経度との対応（ジオリファレンス）はまだない。
   ・地図の表示（拡大・移動）は view = {cx, cy, z（1mあたりの画面ピクセル）, w, h, rot} で表し、どの画面も同じ関数で変換する。 */
(function(root){
'use strict';
const SC=3;// 横浜（手描き）の縮め方。湘南は等倍
// 湘南の原点と1度あたりのメートル（北緯35.3°付近。WGS84 楕円体での値に近い）
const SHONAN={id:'shonan',name:'湘南（鎌倉〜大磯）',lat0:35.345,lon0:139.56,x0:2400,y0:8300,mLon:90826,mLat:110950,sc:1,
  bounds:{x0:-22800,x1:3300,y0:8300,y1:15500},georef:true};
const YOKOHAMA={id:'yokohama',name:'横浜',sc:SC,bounds:{x0:0,x1:4800,y0:0,y1:7800},georef:false};
const REGIONS={shonan:SHONAN,yokohama:YOKOHAMA};

function toGame(lat,lon,R){R=R||SHONAN;return[R.x0+(lon-R.lon0)*R.mLon/R.sc,R.y0+(R.lat0-lat)*R.mLat/R.sc];}
function toLatLon(x,y,R){R=R||SHONAN;return[R.lat0-(y-R.y0)*R.sc/R.mLat,R.lon0+(x-R.x0)*R.sc/R.mLon];}
// GeoJSON の座標（[経度, 緯度]）
const fromLonLat=(c,R)=>toGame(c[1],c[0],R);
// 実際の距離（メートル、ハバーサイン）と、ゲームの距離から換算した実際の距離
function haversine(lat1,lon1,lat2,lon2){const r=6371008.8,t=Math.PI/180,a=Math.sin((lat2-lat1)*t/2)**2+Math.cos(lat1*t)*Math.cos(lat2*t)*Math.sin((lon2-lon1)*t/2)**2;return 2*r*Math.asin(Math.sqrt(a));}
// ゲームの距離 → 実際の距離（地域の縮め方による）
const realMeters=(gameMeters,R)=>gameMeters*((R||SHONAN).sc);
function regionAt(x,y){const b=SHONAN.bounds;if(x>=b.x0&&x<=b.x1&&y>=b.y0-100&&y<=b.y1)return SHONAN;return YOKOHAMA;}

/* 地図の表示：world(x,y) ⇔ screen(px,py)。rot はミニマップのように画面を回すとき（ラジアン） */
function view(cx,cy,z,w,h,rot){return{cx,cy,z,w,h,rot:rot||0};}
function worldToScreen(v,x,y){let dx=(x-v.cx)*v.z,dy=(y-v.cy)*v.z;if(v.rot){const c=Math.cos(v.rot),s=Math.sin(v.rot);[dx,dy]=[dx*c-dy*s,dx*s+dy*c];}return[v.w/2+dx,v.h/2+dy];}
function screenToWorld(v,px,py){let dx=px-v.w/2,dy=py-v.h/2;if(v.rot){const c=Math.cos(-v.rot),s=Math.sin(-v.rot);[dx,dy]=[dx*c-dy*s,dx*s+dy*c];}return[v.cx+dx/v.z,v.cy+dy/v.z];}
// 指の位置を止めたまま拡大縮小
function zoomAt(v,px,py,k,zmin,zmax){const[wx,wy]=screenToWorld(v,px,py);v.z=Math.min(zmax||4,Math.max(zmin||.01,v.z*k));const[nx,ny]=screenToWorld(v,px,py);v.cx+=wx-nx;v.cy+=wy-ny;return v;}
// 範囲が収まる表示
function fit(b,w,h,pad){pad=pad||0;const z=Math.min((w-2*pad)/Math.max(1,b.x1-b.x0),(h-2*pad)/Math.max(1,b.y1-b.y0));return view((b.x0+b.x1)/2,(b.y0+b.y1)/2,z,w,h);}
// canvas の setTransform 用（回転なし）
function canvasMatrix(v,dpr){dpr=dpr||1;return[dpr*v.z,0,0,dpr*v.z,dpr*(v.w/2-v.cx*v.z),dpr*(v.h/2-v.cy*v.z)];}
// 縮尺バー：画面で maxPx 以内に収まる、きりのよい実際の距離
function scaleBar(v,maxPx,sc){const realPerPx=(sc||1)/v.z;const want=realPerPx*(maxPx||100);const p=10**Math.floor(Math.log10(want));const n=[5,2,1].map(k=>k*p).find(m=>m<=want)||p;return{realM:n,px:n/realPerPx,label:n>=1000?`${n/1000}km`:`${n}m`};}

const API={SC,SHONAN,YOKOHAMA,REGIONS,toGame,toLatLon,fromLonLat,haversine,realMeters,regionAt,view,worldToScreen,screenToWorld,zoomAt,fit,canvasMatrix,scaleBar};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaGeo=API;
})(typeof self!=='undefined'?self:this);
