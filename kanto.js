/* 関東全域の近景データ（window.HamaKanto）。横浜・湘南の事前変換データの外側を、国土地理院タイルから直接つくる共通エンジン。
   ・標高：dem5a（z15、5m）を優先し、無い所は dem_png（z14、10m）。どちらにも値が無い所は海。
   ・地面：10m 格子（世界座標で固定）の高さ。格子の三角形（対角線は左上→右下）で補間するので、3D の地面・歩く高さ・道路が同じ面になる。
   ・ベクトル（optimal_bvmap-v1、z16）：建物 BldA・道路 RdCL・鉄道 RailCL・水域 WA をゲーム座標へ（タイルの枠で切る）。
   ・three.js・DOM に依存しない（Node のテストで実物タイルを使える）。出典：国土地理院。 */
(function(root){
'use strict';
const STEP=10;
const RS={'通常部':0,'橋・高架':1,'トンネル':2,'地下':3,'雪覆い':4,'運休中':5};
// 多角形を [0,E]² の枠で切る（Sutherland–Hodgman）
function clipPoly(r,E){let out=r;for(const[ax,lim,keepLess]of[[0,0,false],[0,E,true],[1,0,false],[1,E,true]]){const inp=out;out=[];if(!inp.length)break;
    const ins=p=>keepLess?p[ax]<=lim:p[ax]>=lim;
    for(let i=0;i<inp.length;i++){const a=inp[i],b=inp[(i+1)%inp.length],ia=ins(a),ib=ins(b);if(ia)out.push(a);
      if(ia!==ib){const t=(lim-a[ax])/(b[ax]-a[ax]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}}
  return out;}
// 線を枠で切る（枠の中の部分ごとに分ける）
function clipLine(l,E){const parts=[];let cur=null;const inb=p=>p[0]>=0&&p[0]<=E&&p[1]>=0&&p[1]<=E;
  for(let i=0;i<l.length-1;i++){let a=l[i],b=l[i+1];let t0=0,t1=1;const dx=b[0]-a[0],dy=b[1]-a[1];let ok=true;
    for(const[p,q]of[[-dx,a[0]],[dx,E-a[0]],[-dy,a[1]],[dy,E-a[1]]]){if(p===0){if(q<0){ok=false;break;}continue;}const r=q/p;if(p<0){if(r>t1){ok=false;break;}if(r>t0)t0=r;}else{if(r<t0){ok=false;break;}if(r<t1)t1=r;}}
    if(!ok){cur=null;continue;}const A=[a[0]+dx*t0,a[1]+dy*t0],B=[a[0]+dx*t1,a[1]+dy*t1];
    if(!cur||t0>0){cur=[A];parts.push(cur);}cur.push(B);if(t1<1)cur=null;}
  return parts.filter(p=>p.length>1);}
function pip(p,x,y){let c=false;const n=p.length/2;for(let i=0,j=n-1;i<n;j=i++){const xi=p[2*i],yi=p[2*i+1],xj=p[2*j],yj=p[2*j+1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}
function bbox(p){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let k=0;k<p.length;k+=2){x0=Math.min(x0,p[k]);x1=Math.max(x1,p[k]);y0=Math.min(y0,p[k+1]);y1=Math.max(y1,p[k+1]);}return{x0,y0,x1,y1};}

function create(opt){const G=opt.gsi,GEO=opt.geo,base=opt.ground!=null?opt.ground:2;const S=G.SRC;
  const lon2tx=opt.lon2tx||root.HamaGSI&&root.HamaGSI.lon2tx,lat2ty=opt.lat2ty||root.HamaGSI&&root.HamaGSI.lat2ty,tx2lon=opt.tx2lon||root.HamaGSI.tx2lon,ty2lat=opt.ty2lat||root.HamaGSI.ty2lat;
  const ll=(x,y)=>GEO.toLatLon(x,y);// [lat,lon]
  const key=(kind,z,lat,lon)=>kind+'/'+z+'/'+Math.floor(lon2tx(lon,z))+'/'+Math.floor(lat2ty(lat,z));
  const VZ=S.vec.z;
  // 範囲に必要なタイル（標高 5m・10m とベクトル）
  function tilesFor(X0,Y0,X1,Y1){const[la0,lo0]=ll(X0,Y1),[la1,lo1]=ll(X1,Y0);const out=[];
    for(const[kind,z]of[['dem5a',S.dem5a.z],['dem10',S.dem10.z],['vec',VZ]]){const tx0=Math.floor(lon2tx(lo0,z)),tx1=Math.floor(lon2tx(lo1,z)),ty0=Math.floor(lat2ty(la1,z)),ty1=Math.floor(lat2ty(la0,z));
      for(let x=tx0;x<=tx1;x++)for(let y=ty0;y<=ty1;y++)out.push([kind,z,x,y]);}
    return out;}
  // 読めた・データなし（404）・通信の失敗（その場は平地・海として扱い、待ち続けない）
  const have=(k,z,x,y)=>{const q=k+'/'+z+'/'+x+'/'+y;return G.mem.has(q)||G.missing.has(q)||!!(G.failed&&G.failed.has(q));};
  function ready(X0,Y0,X1,Y1){return tilesFor(X0-STEP,Y0-STEP,X1+STEP,Y1+STEP).every(t=>have(...t));}
  // 標高だけ（横浜の丘など、ベクトルは要らない所）
  const demTiles=(X0,Y0,X1,Y1)=>tilesFor(X0-STEP,Y0-STEP,X1+STEP,Y1+STEP).filter(t=>t[0]!=='vec');
  function demReady(X0,Y0,X1,Y1){return demTiles(X0,Y0,X1,Y1).every(t=>have(...t));}
  function demLoad(X0,Y0,X1,Y1){return Promise.all(demTiles(X0,Y0,X1,Y1).map(t=>G.tile(...t)));}
  function load(X0,Y0,X1,Y1){return Promise.all(tilesFor(X0-STEP,Y0-STEP,X1+STEP,Y1+STEP).map(t=>G.tile(...t)));}
  // 標高（m）。海・データなしは null。タイルが読めていなければ undefined
  function demAt(x,y){const[lat,lon]=ll(x,y);const k5=key('dem5a',S.dem5a.z,lat,lon),k10=key('dem10',S.dem10.z,lat,lon);
    const t5=G.mem.get(k5);if(t5){const h=G.sample(t5,lat,lon);if(h!=null)return h;}else if(!G.missing.has(k5))return undefined;
    const t10=G.mem.get(k10);if(t10){const h=G.sample(t10,lat,lon);return h;}return G.missing.has(k10)?null:undefined;}
  // ベクトルタイルをゲーム座標に（タイルごとに1回）
  const conv=new WeakMap();
  function vecTile(x,y){const[lat,lon]=ll(x,y);const tx=Math.floor(lon2tx(lon,VZ)),ty=Math.floor(lat2ty(lat,VZ));return G.mem.get('vec/'+VZ+'/'+tx+'/'+ty)||null;}
  function features(t){if(!t)return null;let f=conv.get(t);if(f)return f;f={blds:[],roads:[],rails:[],water:[],names:[]};
    const tf=(E)=>p=>{const g=GEO.toGame(ty2lat(t.y+p[1]/E,VZ),tx2lon(t.x+p[0]/E,VZ));return g;};
    const flat=(pts,E,close)=>{const T=tf(E),a=[];for(const p of pts){const g=T(p);a.push(g[0],g[1]);}if(close&&a.length>=4&&a[0]===a[a.length-2]&&a[1]===a[a.length-1])a.length-=2;return a;};
    const L=t.BldA;if(L)for(const ft of L.features){if(ft.type!==3)continue;for(const poly of ft.geom){const r=clipPoly(poly[0],L.extent);if(r.length<3)continue;const p=flat(r,L.extent,true);if(p.length<6)continue;f.blds.push(Object.assign({p,code:ft.props.vt_code|0},bbox(p)));}}
    const R=t.RdCL;if(R)for(const ft of R.features){if(ft.type!==2)continue;const pr=ft.props,w=Math.max(2,Math.min(40,(pr.vt_width||300)/100)),mw=pr.vt_motorway===1,lv=pr.vt_lvorder|0;
      for(const l of ft.geom)for(const c of clipLine(l,R.extent)){const a=flat(c,R.extent);const code=pr.vt_code|0;f.roads.push(Object.assign({a,w,code,mw,lv,car:!mw&&w>=3,bridge:code%10===3,tunnel:code%10===4},bbox(a)));}}
    const RL=t.RailCL;if(RL)for(const ft of RL.features){if(ft.type!==2)continue;const pr=ft.props,st=RS[pr.vt_railstate]!=null?RS[pr.vt_railstate]:0;
      for(const l of ft.geom)for(const c of clipLine(l,RL.extent)){const a=flat(c,RL.extent);f.rails.push(Object.assign({a,state:st,lv:pr.vt_lvorder|0,station:pr.vt_sngldbl==='駅部分',above:st===0||st===1},bbox(a)));}}
    const W=t.WA;if(W)for(const ft of W.features){if(ft.type!==3)continue;for(const poly of ft.geom){const r=clipPoly(poly[0],W.extent);if(r.length<3)continue;const p=flat(r,W.extent,true);
      const holes=poly.slice(1).map(h=>flat(clipPoly(h,W.extent),W.extent,true)).filter(h=>h.length>=6);f.water.push(Object.assign({p,holes},bbox(p)));}}
    // 注記：町・字（800〜849）と市区町村など（100〜299）の名前だけ（学校・施設名は除く）
    const A=t.Anno;if(A)for(const ft of A.features){const c=ft.props.vt_code|0,tx=ft.props.vt_text;if(ft.type!==1||!tx||!((c>=100&&c<300)||(c>=800&&c<850)))continue;const q=ft.geom[0]&&ft.geom[0][0];if(!q||q[0]<0||q[0]>A.extent||q[1]<0||q[1]>A.extent)continue;
      const g=tf(A.extent)(q);f.names.push({t:tx,code:c,x:g[0],y:g[1]});}
    conv.set(t,f);return f;}
  // 範囲に掛かるタイルの地物（建物は中心が範囲内のものだけ。道路・鉄道・水域は掛かるもの全部）
  function featuresIn(X0,Y0,X1,Y1){const out={blds:[],roads:[],rails:[],water:[]};const seen=new Set();
    for(const[kind,z,x,y]of tilesFor(X0,Y0,X1,Y1)){if(kind!=='vec')continue;const k='vec/'+z+'/'+x+'/'+y;if(seen.has(k))continue;seen.add(k);const f=features(G.mem.get(k));if(!f)continue;
      for(const b of f.blds){const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;if(cx>=X0&&cx<X1&&cy>=Y0&&cy<Y1)out.blds.push(b);}
      for(const n of['roads','rails','water'])for(const o of f[n])if(o.x1>=X0&&o.x0<=X1&&o.y1>=Y0&&o.y0<=Y1)out[n].push(o);}
    return out;}
  function inWater(x,y){const f=features(vecTile(x,y));if(!f)return false;for(const w of f.water){if(x<w.x0||x>w.x1||y<w.y0||y>w.y1)continue;if(pip(w.p,x,y)&&!w.holes.some(h=>pip(h,x,y)))return true;}return false;}
  // 10m 格子の点：{y, sea, water}。y はゲームの高さ（海岸の平地 ≈ base、海底 −4）
  const lat=new Map();
  function node(ix,iz){const k=(ix+60000)*200000+(iz+60000);let v=lat.get(k);if(v)return v;const x=ix*STEP,y=iz*STEP;const h=demAt(x,y);if(h===undefined)return null;
    const wt=inWater(x,y);v={y:h==null?-4:base+Math.max(0,h-2)-(wt?1.2:0),sea:h==null,water:wt||h==null,h};if(lat.size>400000)lat.clear();lat.set(k,v);return v;}
  // 補間（格子の三角形：(i,j)-(i+1,j)-(i+1,j+1) と (i,j)-(i+1,j+1)-(i,j+1)）
  function groundY(x,y){const fx=x/STEP,fz=y/STEP,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;const a=node(i,j),b=node(i+1,j),c=node(i+1,j+1),d=node(i,j+1);if(!a||!b||!c||!d)return null;
    return u>=v?a.y+(b.y-a.y)*u+(c.y-b.y)*v:a.y+(c.y-d.y)*u+(d.y-a.y)*v;}
  // 標高の格子（10m、水域の判定なし）を f(標高 or null) で補間。タイルが無ければ null
  const dlat=new Map();
  function demNode(ix,iz){const k=(ix+60000)*200000+(iz+60000);if(dlat.has(k))return dlat.get(k);const h=demAt(ix*STEP,iz*STEP);if(h===undefined)return undefined;if(dlat.size>400000)dlat.clear();dlat.set(k,h);return h;}
  function demInterp(x,y,f){const fx=x/STEP,fz=y/STEP,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;const A=demNode(i,j),B=demNode(i+1,j),C=demNode(i+1,j+1),D=demNode(i,j+1);
    if(A===undefined||B===undefined||C===undefined||D===undefined)return null;const a=f(A),b=f(B),c=f(C),d=f(D);return u>=v?a+(b-a)*u+(c-b)*v:a+(c-d)*u+(d-a)*v;}
  function isLand(x,y){const g=groundY(x,y);if(g==null||g<.4)return false;const fx=Math.round(x/STEP),fz=Math.round(y/STEP),n=node(fx,fz);if(n&&n.water)return false;return !inWater(x,y);}
  // いちばん近い地名（読み込み済みのタイルから。なければ null）
  function nameNear(x,y,r){r=r||1500;let best=null,bd=r;for(const[kind,z,tx,ty]of tilesFor(x-r,y-r,x+r,y+r)){if(kind!=='vec')continue;const f=features(G.mem.get('vec/'+z+'/'+tx+'/'+ty));if(!f)continue;
      for(const n of f.names){const d=Math.hypot(n.x-x,n.y-y)*(n.code<300?.6:1);if(d<bd){bd=d;best=n.t;}}}return best;}
  return{STEP,nameNear,demReady,demLoad,demNode,demInterp,tilesFor,ready,load,demAt,node,groundY,isLand,inWater,featuresIn,features};}
const API={create,clipPoly,clipLine,STEP};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaKanto=API;
})(typeof self!=='undefined'?self:this);
