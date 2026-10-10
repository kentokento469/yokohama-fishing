/* 横浜みなと釣り旅 — 実在の地図（等倍）の読み込みと問い合わせ（window.HamaWorld）。three.js・DOM に依存しない（Node の require でも動く）。
   データ：data/world/<名前>-base.js（tools/gsi/build_world.py。国土地理院ベクトルタイルを加工して作成）。座標は geo.js と同じゲーム座標（m）。
   ・isLand(x,y)：陸か（海・川・運河は陸でない）。格子ごとに「全部陸／全部水／境目」を覚えて速くする。
   ・coastDist / nearestCoast：いちばん近い水際（陸と水の境目）。
   ・roadsIn(x0,y0,x1,y1)：その範囲を通る道路。roadAt(x,y)：道路の上か（車が通れるか・道の種類・幅）。区画ごとに必要なときだけ作る。
   ・names：地名・駅名・施設名。bridges：水の上を渡る道路（歩ける橋）。
   ・建物：loadCell(i,j) で 440m 四方ごとに読み込む（ブラウザは fetch、Node はファイル）。h は PLATEAU の実測の高さ（m、0＝不明）。 */
(function(root){
'use strict';
const CELL=100;// 陸の判定の格子（m）
const RCELL=220;// 道路の索引の区画（m）＝チャンクと同じ
const CTG_NAME=['市区町村道等','国道','都道府県道','高速自動車国道等','その他'];
function undelta(a,unit){const n=a.length,out=new Float64Array(n);let x=0,y=0;for(let i=0;i<n;i+=2){x+=a[i];y+=a[i+1];out[i]=x*unit;out[i+1]=y*unit;}return out;}
function create(D,opt){opt=opt||{};const unit=D.unit||.1;const W={name:D.name,meta:D,bbox:D.bbox};
  const[bx0,by0,bx1,by1]=D.bbox;W.inBox=(x,y)=>x>=bx0&&x<=bx1&&y>=by0&&y<=by1;
  /* ===== 陸 ===== */
  const rings=[];for(const poly of D.land)for(const r of poly)rings.push(undelta(r,unit));W.rings=rings;
  W.land=D.land.map(poly=>poly.map(r=>{const a=undelta(r,unit),pts=[];for(let i=0;i<a.length;i+=2)pts.push([a[i],a[i+1]]);return pts;}));
  // 辺を格子に登録（境目のマス）。辺 = [ax,ay,bx,by]
  const nx=Math.ceil((bx1-bx0)/CELL)+1,ny=Math.ceil((by1-by0)/CELL)+1;const grid=new Array(nx*ny);const rowEdges=new Array(ny);
  for(const r of rings){const n=r.length/2;for(let k=0;k<n;k++){const ax=r[2*k],ay=r[2*k+1],bxx=r[2*((k+1)%n)],byy=r[2*((k+1)%n)+1];if(ax===bxx&&ay===byy)continue;const e=[ax,ay,bxx,byy];
    const i0=Math.max(0,Math.floor((Math.min(ax,bxx)-bx0)/CELL)),i1=Math.min(nx-1,Math.floor((Math.max(ax,bxx)-bx0)/CELL)),j0=Math.max(0,Math.floor((Math.min(ay,byy)-by0)/CELL)),j1=Math.min(ny-1,Math.floor((Math.max(ay,byy)-by0)/CELL));
    for(let j=j0;j<=j1;j++){(rowEdges[j]||(rowEdges[j]=[])).push(e);for(let i=i0;i<=i1;i++){const c=j*nx+i;(grid[c]||(grid[c]=[])).push(e);}}}}
  // 点の左右の交差数（その行の辺だけで数える）
  function rayIn(x,y){const j=Math.floor((y-by0)/CELL);const es=rowEdges[j];if(!es)return false;let c=false;for(const e of es){const ay=e[1],byy=e[3];if((ay>y)!==(byy>y)){const xi=e[0]+(y-ay)/(byy-ay)*(e[2]-e[0]);if(x<xi)c=!c;}}return c;}
  const state=new Int8Array(nx*ny);// 0 未判定・1 全部陸・2 全部水・3 境目
  W.isLand=(x,y)=>{if(!W.inBox(x,y))return false;const i=Math.floor((x-bx0)/CELL),j=Math.floor((y-by0)/CELL),c=j*nx+i;let s=state[c];
    if(!s){s=grid[c]?3:(rayIn(bx0+(i+.5)*CELL,by0+(j+.5)*CELL)?1:2);state[c]=s;}return s===1?true:s===2?false:rayIn(x,y);};
  // 近くの辺（半径 R 以内）
  function edgesNear(x,y,R){const out=[];const i0=Math.max(0,Math.floor((x-R-bx0)/CELL)),i1=Math.min(nx-1,Math.floor((x+R-bx0)/CELL)),j0=Math.max(0,Math.floor((y-R-by0)/CELL)),j1=Math.min(ny-1,Math.floor((y+R-by0)/CELL));
    const seen=new Set();for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=grid[j*nx+i];if(a)for(const e of a)if(!seen.has(e)){seen.add(e);out.push(e);}}return out;}
  W.edgesNear=edgesNear;
  // 水際（範囲の四角の縁は水際ではない）
  const onBox=e=>(Math.abs(e[0]-e[2])<1e-6&&(Math.abs(e[0]-bx0)<.5||Math.abs(e[0]-bx1)<.5))||(Math.abs(e[1]-e[3])<1e-6&&(Math.abs(e[1]-by0)<.5||Math.abs(e[1]-by1)<.5));
  W.nearestCoast=(x,y,R)=>{let best=null,bd=R||200;for(const e of edgesNear(x,y,bd)){if(onBox(e))continue;const dx=e[2]-e[0],dy=e[3]-e[1],l=dx*dx+dy*dy;let t=l?((x-e[0])*dx+(y-e[1])*dy)/l:0;t=t<0?0:t>1?1:t;
      const px=e[0]+dx*t,py=e[1]+dy*t,d=Math.hypot(x-px,y-py);if(d<bd){bd=d;const L=Math.sqrt(l)||1;best={x:px,y:py,d,tx:dx/L,ty:dy/L};}}
    if(best){// 海側への向き（法線の向きは陸の判定で決める）
      let nxx=-best.ty,nyy=best.tx;if(W.isLand(best.x+nxx*1.5,best.y+nyy*1.5)&&!W.isLand(best.x-nxx*1.5,best.y-nyy*1.5)){nxx=-nxx;nyy=-nyy;}best.nx=nxx;best.ny=nyy;}
    return best;};
  W.coastDist=(x,y,R)=>{const c=W.nearestCoast(x,y,R);return c?c.d:Infinity;};
  /* ===== 道路・鉄道 ===== */
  W.roads=D.roads.map(r=>{const a=undelta(r[5],unit);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<a.length;i+=2){if(a[i]<x0)x0=a[i];if(a[i]>x1)x1=a[i];if(a[i+1]<y0)y0=a[i+1];if(a[i+1]>y1)y1=a[i+1];}
    const w=r[2]>0?r[2]:3,ctg=r[1],mw=!!r[4];return{code:r[0],ctg,ctgName:CTG_NAME[ctg],w,lv:r[3],mw,a,x0,y0,x1,y1,car:!mw&&w>=3,kind:mw?'motorway':ctg===1?'primary':ctg===2||w>=13?'secondary':w>=5.5?'residential':'service'};});
  W.rails=D.rails.map(r=>{const a=undelta(r[5],unit);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<a.length;i+=2){if(a[i]<x0)x0=a[i];if(a[i]>x1)x1=a[i];if(a[i+1]<y0)y0=a[i+1];if(a[i+1]>y1)y1=a[i+1];}
    return{code:r[0],op:r[1],state:r[2],station:!!r[3],lv:r[4],a,x0,y0,x1,y1,above:r[2]===0||r[2]===1};});
  const rIdx=new Map(),lIdx=new Map();
  const reg=(M,o)=>{for(let i=Math.floor(o.x0/RCELL);i<=Math.floor(o.x1/RCELL);i++)for(let j=Math.floor(o.y0/RCELL);j<=Math.floor(o.y1/RCELL);j++){const k=i+','+j;let a=M.get(k);if(!a){a=[];M.set(k,a);}a.push(o);}};
  for(const r of W.roads)reg(rIdx,r);for(const r of W.rails)reg(lIdx,r);
  const inRect=(M,x0,y0,x1,y1)=>{const s=new Set();for(let i=Math.floor(x0/RCELL);i<=Math.floor(x1/RCELL);i++)for(let j=Math.floor(y0/RCELL);j<=Math.floor(y1/RCELL);j++){const a=M.get(i+','+j);if(a)for(const o of a)if(o.x1>=x0&&o.x0<=x1&&o.y1>=y0&&o.y0<=y1)s.add(o);}return[...s];};
  W.roadsIn=(x0,y0,x1,y1)=>inRect(rIdx,x0,y0,x1,y1);W.railsIn=(x0,y0,x1,y1)=>inRect(lIdx,x0,y0,x1,y1);
  // 点と道路の中心線の距離
  const segD=(x,y,ax,ay,bxx,byy)=>{const dx=bxx-ax,dy=byy-ay,l=dx*dx+dy*dy;let t=l?((x-ax)*dx+(y-ay)*dy)/l:0;t=t<0?0:t>1?1:t;return Math.hypot(x-ax-dx*t,y-ay-dy*t);};
  W.nearestRoad=(x,y,R,filter)=>{R=R||100;let best=null,bd=R;for(const r of W.roadsIn(x-R,y-R,x+R,y+R)){if(filter&&!filter(r))continue;const a=r.a;for(let i=0;i<a.length-2;i+=2){const dx=a[i+2]-a[i],dy=a[i+3]-a[i+1],l=dx*dx+dy*dy;let t=l?((x-a[i])*dx+(y-a[i+1])*dy)/l:0;t=t<0?0:t>1?1:t;
    const px=a[i]+dx*t,py=a[i+1]+dy*t,d=Math.hypot(x-px,y-py);if(d<bd){bd=d;best={road:r,x:px,y:py,d};}}}return best;};
  // 道路の上か：区画ごとに 2m のマス目を作って覚える（車が通れるか・種類・幅）。自動車専用道路・高架は地上の道に含めない
  const RC=2,rcache=new Map();
  function rasterCell(i,j){const k=i+','+j;let m=rcache.get(k);if(m)return m;const n=RCELL/RC;m=new Array(n*n).fill(null);const X0=i*RCELL,Y0=j*RCELL;
    for(const r of W.roadsIn(X0-20,Y0-20,X0+RCELL+20,Y0+RCELL+20)){if(r.mw||r.lv>0)continue;const hw=r.w/2+.5,a=r.a;
      for(let s=0;s<a.length-2;s+=2){const ax=a[s],ay=a[s+1],bxx=a[s+2],byy=a[s+3];const gx0=Math.max(0,Math.floor((Math.min(ax,bxx)-hw-X0)/RC)),gx1=Math.min(n-1,Math.floor((Math.max(ax,bxx)+hw-X0)/RC)),gy0=Math.max(0,Math.floor((Math.min(ay,byy)-hw-Y0)/RC)),gy1=Math.min(n-1,Math.floor((Math.max(ay,byy)+hw-Y0)/RC));
        for(let gy=gy0;gy<=gy1;gy++)for(let gx=gx0;gx<=gx1;gx++){const c=gy*n+gx,o=m[c];if(o&&o.w>=r.w)continue;if(segD(X0+(gx+.5)*RC,Y0+(gy+.5)*RC,ax,ay,bxx,byy)<=hw)m[c]={car:r.car,kind:r.kind,w:r.w,name:r.ctgName};}}}
    rcache.set(k,m);if(rcache.size>400){const f=rcache.keys().next().value;rcache.delete(f);}return m;}
  W.roadAt=(x,y)=>{if(!W.inBox(x,y))return null;const i=Math.floor(x/RCELL),j=Math.floor(y/RCELL),m=rasterCell(i,j),n=RCELL/RC;const gx=Math.floor((x-i*RCELL)/RC),gy=Math.floor((y-j*RCELL)/RC);return m[gy*n+gx];};
  // 水の上を渡る地上の道路の区間（歩ける橋）。[ax,ay,bx,by,幅]
  W.bridges=[];for(const r of W.roads){if(r.mw||r.lv>1)continue;const a=r.a;for(let s=0;s<a.length-2;s+=2){const mx=(a[s]+a[s+2])/2,my=(a[s+1]+a[s+3])/2;if(!W.isLand(mx,my)&&W.inBox(mx,my))W.bridges.push([a[s],a[s+1],a[s+2],a[s+3],Math.max(4,r.w)]);}}
  const bIdx=new Map();for(const b of W.bridges)reg(bIdx,{x0:Math.min(b[0],b[2])-b[4],x1:Math.max(b[0],b[2])+b[4],y0:Math.min(b[1],b[3])-b[4],y1:Math.max(b[1],b[3])+b[4],b});
  W.bridgeAt=(x,y)=>{const a=bIdx.get(Math.floor(x/RCELL)+','+Math.floor(y/RCELL));if(!a)return null;for(const o of a){const b=o.b;if(segD(x,y,b[0],b[1],b[2],b[3])<=b[4]/2)return b;}return null;};
  // 経路探索用の道路（osm-convert.js の buildGraph にそのまま渡せる形）。範囲を指定すると、その中を通る道だけ。
  // 交差点は同じ点（0.6m以内）でつなぐ。道の端が別の道の途中に接している所（T字路・タイルの境目）は tools/gsi/build_world.py でつないである（snap=true でここでもつなぐ）
  W.graphRoads=(x0,y0,x1,y1,snap)=>{const rs=(x0==null?W.roads:W.roadsIn(x0,y0,x1,y1)).filter(r=>r.code!==2704);
    const lines=rs.map(r=>{const pts=[];for(let k=0;k<r.a.length;k+=2)pts.push([r.a[k],r.a[k+1]]);return{r,pts};});
    // 線分の索引（10m）
    const G=10,sidx=new Map();const sk=(i,j)=>i*200003+j;
    if(snap)lines.forEach((l,li)=>{for(let k=0;k<l.pts.length-1;k++){const[ax,ay]=l.pts[k],[bx,by]=l.pts[k+1];for(let i=Math.floor(Math.min(ax,bx)/G);i<=Math.floor(Math.max(ax,bx)/G);i++)for(let j=Math.floor(Math.min(ay,by)/G);j<=Math.floor(Math.max(ay,by)/G);j++){const key=sk(i,j);let a=sidx.get(key);if(!a){a=[];sidx.set(key,a);}a.push([li,k]);}}});
    const ins=new Map();// li -> [[k,t,x,y]]（データ作成時に済ませてあるので、ふだんは省く）
    if(snap)for(let li=0;li<lines.length;li++){const l=lines[li];for(const end of[0,l.pts.length-1]){const[px,py]=l.pts[end];let best=null,bd=2.5;
      for(let i=Math.floor((px-2.5)/G);i<=Math.floor((px+2.5)/G);i++)for(let j=Math.floor((py-2.5)/G);j<=Math.floor((py+2.5)/G);j++){const a=sidx.get(sk(i,j));if(!a)continue;
        for(const[lj,k]of a){if(lj===li)continue;const[ax,ay]=lines[lj].pts[k],[bx,by]=lines[lj].pts[k+1];const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;let t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=t<0?0:t>1?1:t;const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(px-qx,py-qy);if(d<bd){bd=d;best=[lj,k,t,qx,qy];}}}
      if(best){const[lj,k,t,qx,qy]=best;l.pts[end]=[qx,qy];if(t>1e-3&&t<1-1e-3){let a=ins.get(lj);if(!a){a=[];ins.set(lj,a);}a.push([k,t,qx,qy]);}}}}
    for(const[lj,a]of ins){const l=lines[lj];a.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);const out=[];let ai=0;for(let k=0;k<l.pts.length;k++){out.push(l.pts[k]);while(ai<a.length&&a[ai][0]===k){out.push([a[ai][2],a[ai][3]]);ai++;}}l.pts=out;}
    // 点の番号（0.6m以内は同じ点）
    const grid=new Map();let nid=0;const nodeId=(x,y)=>{const gx=Math.round(x)+60000,gy=Math.round(y)+60000;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const a=grid.get((gx+dx)*200003+gy+dy);if(a)for(const n of a)if(Math.abs(n.x-x)<.6&&Math.abs(n.y-y)<.6)return n.id;}
      const n={x,y,id:nid++};const k=gx*200003+gy;let a=grid.get(k);if(!a){a=[];grid.set(k,a);}a.push(n);return n.id;};
    return lines.map(({r,pts})=>({pts,nodes:pts.map(p=>nodeId(p[0],p[1])),w:r.w,kind:r.kind,car:r.car&&!r.mw&&r.lv===0||r.mw,bike:!r.mw,foot:!r.mw,name:r.ctgName,real:'gsi'}));};
  /* ===== 名前・構造物 ===== */
  W.names=D.names.map(n=>({text:n[0],code:n[1],x:n[2],y:n[3]}));
  W.findName=(re,code)=>W.names.filter(n=>(code==null||n.code===code)&&(typeof re==='string'?n.text===re:re.test(n.text)));
  W.breakwaters=(D.breakwaters||[]).map(b=>({code:b[0],a:undelta(b[1],unit)}));
  W.structs=(D.structs||[]).map(b=>({code:b[0],a:undelta(b[1],unit)}));
  /* ===== 建物（440m 四方ごと） ===== */
  const BT=440,bcache=new Map(),pending=new Map();const base=opt.base||('data/world/'+D.name+'-bld/');
  W.BT=BT;W.cellOf=(x,y)=>[Math.floor(x/BT),Math.floor(y/BT)];
  function parse(buf,i,j){const dv=new DataView(buf instanceof ArrayBuffer?buf:buf.buffer,buf.byteOffset||0,buf.byteLength);const out=[];let o=0;const ox=i*BT,oy=j*BT;
    while(o+8<=dv.byteLength){const c=dv.getUint16(o,true),n=dv.getUint16(o+2,true),hm=dv.getUint16(o+4,true)/10;o+=8;const p=new Float32Array(2*n);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      for(let k=0;k<n;k++){const x=ox+dv.getInt16(o,true)/10,y=oy+dv.getInt16(o+2,true)/10;o+=4;p[2*k]=x;p[2*k+1]=y;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
      out.push({code:c,p,x0,y0,x1,y1,h:hm||0});}return out;}
  W.cell=(i,j)=>bcache.get(i+','+j)||null;
  W.loadCell=(i,j)=>{const k=i+','+j;if(bcache.has(k))return Promise.resolve(bcache.get(k));if(pending.has(k))return pending.get(k);
    let pr;if(opt.readFile){pr=Promise.resolve().then(()=>{let b=null;try{b=opt.readFile(base+i+'_'+j+'.bin');}catch(e){}const v=b?parse(b,i,j):[];bcache.set(k,v);return v;});}
    else pr=fetch(base+i+'_'+j+'.bin').then(r=>r.ok?r.arrayBuffer():null).then(b=>{const v=b?parse(b,i,j):[];bcache.set(k,v);pending.delete(k);return v;}).catch(()=>{pending.delete(k);bcache.set(k,[]);return[];});
    pending.set(k,pr);return pr;};
  W.dropCell=(i,j)=>bcache.delete(i+','+j);
  return W;}
/* ===== 複数の地域をまとめる（横浜・湘南・今後の地域）。点の問い合わせはその点を含む地域へ、範囲の問い合わせは全地域を合わせる ===== */
function combine(worlds){worlds=worlds.filter(Boolean);if(worlds.length===1&&!worlds[0].worlds){const w=worlds[0];w.worlds=[w];w.at=(x,y)=>w.inBox(x,y)?w:null;w.onBoxEdge=e=>onBoxOf(w,e);w.nearBox=(x,y,h)=>nearB(w,x,y,h);return w;}
  const at=(x,y)=>{for(const w of worlds)if(w.inBox(x,y))return w;return null;};
  const bb=[Math.min(...worlds.map(w=>w.bbox[0])),Math.min(...worlds.map(w=>w.bbox[1])),Math.max(...worlds.map(w=>w.bbox[2])),Math.max(...worlds.map(w=>w.bbox[3]))];
  const hit=(w,x0,y0,x1,y1)=>x1>=w.bbox[0]&&x0<=w.bbox[2]&&y1>=w.bbox[1]&&y0<=w.bbox[3];
  const cat=(f,x0,y0,x1,y1)=>{const out=[];for(const w of worlds)if(hit(w,x0,y0,x1,y1))for(const o of f(w))out.push(o);return out;};
  const C={name:worlds.map(w=>w.name).join('+'),worlds,bbox:bb,at,BT:worlds[0].BT,
    inBox:(x,y)=>!!at(x,y),isLand:(x,y)=>{const w=at(x,y);return!!w&&w.isLand(x,y);},
    edgesNear:(x,y,R)=>cat(w=>w.edgesNear(x,y,R),x-R,y-R,x+R,y+R),
    nearestCoast:(x,y,R)=>{let best=null;for(const w of worlds){if(!hit(w,x-(R||200),y-(R||200),x+(R||200),y+(R||200)))continue;const c=w.nearestCoast(x,y,R);if(c&&(!best||c.d<best.d))best=c;}return best;},
    coastDist:(x,y,R)=>{const c=C.nearestCoast(x,y,R);return c?c.d:Infinity;},
    roadsIn:(x0,y0,x1,y1)=>cat(w=>w.roadsIn(x0,y0,x1,y1),x0,y0,x1,y1),railsIn:(x0,y0,x1,y1)=>cat(w=>w.railsIn(x0,y0,x1,y1),x0,y0,x1,y1),
    nearestRoad:(x,y,R,f)=>{let best=null;for(const w of worlds){const r=w.nearestRoad(x,y,R,f);if(r&&(!best||r.d<best.d))best=r;}return best;},
    roadAt:(x,y)=>{const w=at(x,y);return w?w.roadAt(x,y):null;},bridgeAt:(x,y)=>{const w=at(x,y);return w?w.bridgeAt(x,y):null;},
    // 経路用の道路網は1つの地域の中だけ（点の番号が地域ごとなので混ぜない）。範囲の中心の地域
    graphRoads:(x0,y0,x1,y1,snap)=>{const w=x0==null?worlds[0]:at((x0+x1)/2,(y0+y1)/2)||worlds.find(q=>hit(q,x0,y0,x1,y1));return w?w.graphRoads(x0,y0,x1,y1,snap):[];},
    cellOf:(x,y)=>[Math.floor(x/worlds[0].BT),Math.floor(y/worlds[0].BT)],
    cell:(i,j)=>{const w=at((i+.5)*C.BT,(j+.5)*C.BT)||worlds.find(q=>hit(q,i*C.BT,j*C.BT,(i+1)*C.BT,(j+1)*C.BT));return w?w.cell(i,j):[];},
    loadCell:(i,j)=>{const w=at((i+.5)*C.BT,(j+.5)*C.BT)||worlds.find(q=>hit(q,i*C.BT,j*C.BT,(i+1)*C.BT,(j+1)*C.BT));return w?w.loadCell(i,j):Promise.resolve([]);},
    dropCell:(i,j)=>{for(const w of worlds)w.dropCell(i,j);},
    onBoxEdge:e=>worlds.some(w=>onBoxOf(w,e)),nearBox:(x,y,h)=>worlds.some(w=>nearB(w,x,y,h))};
  for(const k of['rings','land','roads','rails','bridges','names','breakwaters','structs'])C[k]=[].concat(...worlds.map(w=>w[k]||[]));
  C.findName=(re,code)=>C.names.filter(n=>(code==null||n.code===code)&&(typeof re==='string'?n.text===re:re.test(n.text)));
  return C;}
// 範囲の四角の縁（陸の多角形を範囲で切った辺。水際ではない）か
function onBoxOf(w,e){const[bx0,by0,bx1,by1]=w.bbox;return(Math.abs(e[0]-e[2])<1e-6&&(Math.abs(e[0]-bx0)<.5||Math.abs(e[0]-bx1)<.5))||(Math.abs(e[1]-e[3])<1e-6&&(Math.abs(e[1]-by0)<.5||Math.abs(e[1]-by1)<.5));}
function nearB(w,x,y,h){const[bx0,by0,bx1,by1]=w.bbox;return x>bx0-h&&x<bx1+h&&y>by0-h&&y<by1+h;}
const API={create,combine,CELL,RCELL,CTG_NAME,undelta};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaWorld=API;
})(typeof self!=='undefined'?self:this);
