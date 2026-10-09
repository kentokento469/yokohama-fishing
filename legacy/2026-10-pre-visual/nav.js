/* 横浜みなと釣り旅 — 道路網の組み立て（OSM がないときの代わり）・道のマス目・推定駐車場・行き方の計画。描画に依存しない。
   ・OSM のデータ（data/osm/*.js）があればそれを使う。ないときは、ゲームの地図にある幹線道路（おおよそ）と、
     そこから各釣り場への「取り付け道路」（陸の上を最短でたどった仮の道）で道路網を作る。これらは実在の道ではない（approx:true）。
   ・推定駐車場（est:true）は、実在の駐車場の情報がないときに置くゲーム用の駐車スペース。位置・台数・料金は推定。 */
(function(root){
'use strict';
let OC=null,RT=null;
if(typeof module!=='undefined'&&module.exports){OC=require('./osm-convert.js');RT=require('./routing.js');}else{OC=root.HamaOSMConvert;RT=root.HamaRouting;}

/* 取り付け道路：(x,y) から幹線（trunk の線）までを、陸の上だけ通るマス目の幅優先探索でつなぐ。
   land(x,y) は通れる陸（橋・桟橋を含む）なら true。戻り値は点列（target → 幹線上の点）。見つからなければ null */
function segDist(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let t=l?((px-a[0])*dx+(py-a[1])*dy)/l:0;t=t<0?0:t>1?1:t;const x=a[0]+dx*t,y=a[1]+dy*t;return{d:Math.hypot(px-x,py-y),x,y};}
function nearestOn(lines,x,y){let best=null;for(const L of lines)for(let i=0;i<L.length-1;i++){const r=segDist(x,y,L[i],L[i+1]);if(!best||r.d<best.d)best=r;}return best;}
function accessPath(x,y,trunks,land,opt){opt=opt||{};const cell=opt.cell||8,R=opt.radius||1600,reach=opt.reach||6;
  // 目標が水の上（釣り場の印は岸壁の際）なら、近くの陸から始める
  if(!land(x,y)){let f=null;for(let r=2;r<=60&&!f;r+=2)for(let a=0;a<6.28;a+=.26){const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(land(px,py)){f=[px,py];break;}}if(!f)return null;x=f[0];y=f[1];}
  const lines=trunks.map(t=>t.pts);const n0=nearestOn(lines,x,y);if(!n0)return null;if(n0.d<reach)return[[x,y],[n0.x,n0.y]];
  const ox=x-R,oy=y-R,W=Math.ceil(2*R/cell);const id=(i,j)=>j*W+i;const prev=new Int32Array(W*W).fill(-2);
  const LC=new Int8Array(W*W),land0=land;land=(px,py)=>{const i=Math.floor((px-ox)/cell),j=Math.floor((py-oy)/cell);if(i<0||j<0||i>=W||j>=W)return land0(px,py);const k=j*W+i;if(!LC[k])LC[k]=land0(ox+(i+.5)*cell,oy+(j+.5)*cell)?1:2;return LC[k]===1;};
  const i0=Math.floor((x-ox)/cell),j0=Math.floor((y-oy)/cell);const q=[id(i0,j0)];prev[q[0]]=-1;let goal=-1;
  for(let h=0;h<q.length&&goal<0;h++){const c=q[h],i=c%W,j=(c/W)|0;
    for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=W||b>=W)continue;const k=id(a,b);if(prev[k]!==-2)continue;
      const cx=ox+(a+.5)*cell,cy=oy+(b+.5)*cell;if(!land(cx,cy)){prev[k]=-3;continue;}
      // 斜めは角の両側が陸のときだけ（海を斜めに横切らない）
      if(di&&dj&&(!land(ox+(i+di+.5)*cell,oy+(j+.5)*cell)||!land(ox+(i+.5)*cell,oy+(j+dj+.5)*cell)))continue;
      prev[k]=c;if(opt.near?opt.near(cx,cy):nearestOn(lines,cx,cy).d<cell){goal=k;break;}q.push(k);}}
  if(goal<0)return null;
  const path=[];for(let c=goal;c>=0;c=prev[c]){const i=c%W,j=(c/W)|0;path.push([ox+(i+.5)*cell,oy+(j+.5)*cell]);}path.reverse();path[0]=[x,y];
  const end=nearestOn(lines,path[path.length-1][0],path[path.length-1][1]);path.push([end.x,end.y]);
  return simplify(path,land0);}
// 見通しのよい所は直線にまとめる（途中が全部陸のときだけ）
function clearLine(a,b,land){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let k=1;k<n;k++){const t=k/n;if(!land(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))return false;}return true;}
function simplify(p,land){const out=[p[0]];let i=0;while(i<p.length-1){let j=p.length-1;while(j>i+1&&!clearLine(p[i],p[j],land))j--;out.push(p[j]);i=j;}return out;}
function plen(p){let s=0;for(let i=0;i<p.length-1;i++)s+=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]);return s;}
function pointAlong(p,d){for(let i=0;i<p.length-1;i++){const l=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]);if(d<=l){const t=l?d/l:0;return[p[i][0]+(p[i+1][0]-p[i][0])*t,p[i][1]+(p[i+1][1]-p[i][1])*t];}d-=l;}return p[p.length-1].slice();}

/* 代わりの道路網：trunks=[{pts,kind,w,name}], targets=[{id,x,y,car(車で近くまで行けるか),name}]
   戻り値 {roads, lots, approx:true, missing:[{id,why}]} */
function fallback(trunks,targets,land,opt){const roads=[],lots=[],missing=[];let n=0;opt=Object.assign({},opt);
  // 幹線に近いマスの判定は格子で（毎回線分との距離を測ると遅い）
  if(!opt.near){const cl=opt.cell||8,tr=raster(trunks.map(t=>({pts:t.pts,w:cl*2})),cl/2);opt.near=(x,y)=>!!tr.at(x,y);}
  for(const t of trunks)roads.push({id:'fb'+(n++),pts:t.pts,kind:t.kind||'primary',car:1,bike:1,foot:1,oneway:0,surface:'paved',w:t.w||10,name:t.name||null,approx:true});
  // opt.strict（陸の縁から離れた所だけ）で探し、見つからなければ land（縁も含む）で探す
  for(const g of targets){const p=(opt.strict&&accessPath(g.x,g.y,trunks,opt.strict,opt))||accessPath(g.x,g.y,trunks,land,opt);if(!p){missing.push({id:g.id,why:'幹線道路まで陸でつながる道が見つからない'});continue;}
    const L=plen(p);const car=g.car!==false;
    roads.push({id:'ac_'+g.id,pts:p.slice().reverse(),kind:car?'service':'path',car:car?1:0,bike:1,foot:1,oneway:0,surface:'paved',w:car?7:3,name:(g.name||g.id)+'への道（仮）',approx:true,to:g.id});
    // 推定駐車場：車で行ける所は釣り場の手前（約25m）、行けない所は幹線との交わる所
    const at=car?pointAlong(p,Math.min(25,L*.5)):p[p.length-1];
    lots.push({id:'estlot_'+g.id,x:at[0],y:at[1],r:9,name:(g.name||g.id)+' 近くの駐車スペース（推定）',capacity:20,feePerHour:300,hours:'24時間（推定）',full:false,est:true,src:'est',why:'実在の駐車場の情報がない。位置・台数・料金はゲーム用の推定',for:g.id});}
  return{roads,lots,approx:true,missing};}

/* 道のマス目：(x,y) が道の上か、その道を車・自転車で通れるか。cell は 4m */
function raster(roads,cell){cell=cell||4;const M=new Map();
  for(const r of roads){const hw=(r.w||6)/2;for(let i=0;i<r.pts.length-1;i++){const a=r.pts[i],b=r.pts[i+1];
      const x0=Math.floor((Math.min(a[0],b[0])-hw)/cell),x1=Math.floor((Math.max(a[0],b[0])+hw)/cell),y0=Math.floor((Math.min(a[1],b[1])-hw)/cell),y1=Math.floor((Math.max(a[1],b[1])+hw)/cell);
      for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){if(segDist((gx+.5)*cell,(gy+.5)*cell,a,b).d>hw+cell*.5)continue;const k=gx+','+gy;const o=M.get(k);
        if(!o)M.set(k,{car:!!r.car,bike:!!r.bike,foot:!!r.foot,kind:r.kind,surface:r.surface||'paved'});else{o.car=o.car||!!r.car;o.bike=o.bike||!!r.bike;o.foot=o.foot||!!r.foot;if(r.car)o.kind=r.kind;}}}}
  return{cell,at(x,y){return M.get(Math.floor(x/cell)+','+Math.floor(y/cell))||null;},size:M.size};}

function lotAt(lots,x,y){for(const l of lots)if(Math.hypot(l.x-x,l.y-y)<(l.r||9))return l;return null;}
function nearestLot(lots,x,y,filter){let b=null,bd=1e18;for(const l of lots){if(filter&&!filter(l))continue;const d=Math.hypot(l.x-x,l.y-y);if(d<bd){bd=d;b=l;}}return b?{lot:b,d:bd}:null;}

/* 行き方の計画：from→to。mode=walk/bike/car。
   car：近くの駐車場まで車、そこから歩く。bike：道で近くまで行き、残りは歩く（岩場などは押して入れない）。
   戻り値 {mode, legs:[{mode,pts,len,time}], len, time, lot?} または {mode, fail:理由} */
function plan(graph,lots,from,to,mode,opt){opt=opt||{};const W=1.3;
  const walkLeg=(a,b)=>{const r=RT.routeXY(graph,a[0],a[1],b[0],b[1],'walk',{speed:W});const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
    // 道を通るより直線が短いとき（すぐ近く）は直線
    if(!r||r.len>d*2.2)return{mode:'walk',pts:[a,b],len:d,time:d/W,straight:true};return{mode:'walk',pts:r.pts,len:r.len,time:r.time};};
  if(mode==='walk'){const l=walkLeg(from,to);return{mode,legs:[l],len:l.len,time:l.time};}
  if(mode==='bike'){const r=RT.routeXY(graph,from[0],from[1],to[0],to[1],'bike',{speed:opt.speed,terrain:opt.terrain});if(!r)return{mode,fail:'自転車で通れる道がつながっていない'};
    const legs=[{mode:'bike',pts:r.pts.slice(0,-1),len:r.len-r.access,time:r.time-r.access/W}];const tail=r.pts[r.pts.length-2];const w=walkLeg(tail,to);legs.push(w);
    return{mode,legs,len:legs[0].len+w.len,time:legs[0].time+w.time};}
  // car
  const nl=nearestLot(lots,to[0],to[1],l=>!l.full);if(!nl)return{mode,fail:'近くに駐車場がない'};
  const s=RT.nearestNode(graph,from[0],from[1],'car'),t=RT.nearestNode(graph,nl.lot.x,nl.lot.y,'car');if(!s||!t)return{mode,fail:'車で通れる道がない'};
  const r=RT.route(graph,s.i,t.i,'car',{speed:opt.speed});if(!r)return{mode,fail:'車で通れる道がつながっていない'};
  const N=graph.nodes;const carPts=[from,...r.pts,[nl.lot.x,nl.lot.y]];const extra=s.d+t.d;
  const carLeg={mode:'car',pts:carPts,len:r.len+extra,time:r.time+extra/5};const w=walkLeg([nl.lot.x,nl.lot.y],to);
  return{mode,legs:[carLeg,w],len:carLeg.len+w.len,time:carLeg.time+w.time,lot:nl.lot};}

const API={segDist,nearestOn,accessPath,simplify,plen,pointAlong,fallback,raster,lotAt,nearestLot,plan};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaNav=API;
})(typeof self!=='undefined'?self:this);
