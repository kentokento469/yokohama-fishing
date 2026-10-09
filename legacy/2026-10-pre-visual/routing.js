/* 横浜みなと釣り旅 — 道路ネットワークの経路探索（A*）。描画に依存しない。Node でもブラウザでも動く。
   graph は osm-convert.js の buildGraph の形：{nodes:[{x,y,adj:[{to,e,dir}]}], edges:[{a,b,len,kind,car,bike,foot,oneway,surface}]}
   mode: walk / bike / car。通れない道は使わない。車は一方通行を守る。
   時間は「距離 ÷ その道でのその手段の速さ」。速さは opt.speed（m/s。乗り物の性能）と道の種類・路面で決まる。 */
(function(root){
'use strict';
const OK={walk:e=>e.foot,bike:e=>e.bike||e.foot,car:e=>e.car};
// 自転車で歩道しかない所は押して歩く（徒歩の速さ）
const KIND_CAP={motorway:22,trunk:17,primary:14,secondary:11,tertiary:11,unclassified:8,residential:8,living_street:4,service:5,track:4};
function edgeSpeed(e,mode,opt){const base=opt&&opt.speed||{walk:1.3,bike:4.5,car:11}[mode];
  if(mode==='walk')return base*(e.surface==='sand'?.7:1);
  if(mode==='bike'){if(!e.bike)return 1.2;const tm=opt&&opt.terrain||{};return base*(tm[e.surface]==null?1:tm[e.surface]);}
  return Math.min(base,KIND_CAP[e.kind]||8);}
function passable(e,mode,dir){if(!OK[mode](e))return false;if(mode==='car'&&e.oneway&&e.oneway!==dir)return false;return true;}

/* 近いノード・近い道を速く探すための格子 */
function index(graph,cell){cell=cell||50;const g=new Map(),ge=new Map();const k=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
  graph.nodes.forEach((n,i)=>{const key=k(n.x,n.y);let a=g.get(key);if(!a){a=[];g.set(key,a);}a.push(i);});
  graph.edges.forEach(e=>{const A=graph.nodes[e.a],B=graph.nodes[e.b];const x0=Math.min(A.x,B.x),x1=Math.max(A.x,B.x),y0=Math.min(A.y,B.y),y1=Math.max(A.y,B.y);
    for(let gx=Math.floor(x0/cell);gx<=Math.floor(x1/cell);gx++)for(let gy=Math.floor(y0/cell);gy<=Math.floor(y1/cell);gy++){const key=gx+','+gy;let a=ge.get(key);if(!a){a=[];ge.set(key,a);}a.push(e);}});
  graph._ix={cell,g,ge};return graph;}
function nearestNode(graph,x,y,mode,maxR){const ix=graph._ix||index(graph)._ix;const c=ix.cell;let best=-1,bd=1e18;
  for(let r=0;r<=Math.ceil((maxR||2000)/c);r++){for(let gx=Math.floor(x/c)-r;gx<=Math.floor(x/c)+r;gx++)for(let gy=Math.floor(y/c)-r;gy<=Math.floor(y/c)+r;gy++){
      if(Math.max(Math.abs(gx-Math.floor(x/c)),Math.abs(gy-Math.floor(y/c)))!==r)continue;const a=ix.g.get(gx+','+gy);if(!a)continue;
      for(const i of a){const n=graph.nodes[i];if(mode&&!n.adj.some(q=>OK[mode](q.e)))continue;const d=(n.x-x)**2+(n.y-y)**2;if(d<bd){bd=d;best=i;}}}
    if(best>=0&&Math.sqrt(bd)<r*c)break;}
  return best<0?null:{i:best,d:Math.sqrt(bd)};}
// (x,y) から一番近い道（mode で通れる道）までの距離と、その道
function nearestEdge(graph,x,y,mode){const ix=graph._ix||index(graph)._ix;const c=ix.cell;let best=null,bd=1e18;
  for(let gx=Math.floor(x/c)-1;gx<=Math.floor(x/c)+1;gx++)for(let gy=Math.floor(y/c)-1;gy<=Math.floor(y/c)+1;gy++){const a=ix.ge.get(gx+','+gy);if(!a)continue;
    for(const e of a){if(mode&&!OK[mode](e))continue;const A=graph.nodes[e.a],B=graph.nodes[e.b];const dx=B.x-A.x,dy=B.y-A.y,l=dx*dx+dy*dy;let t=l?((x-A.x)*dx+(y-A.y)*dy)/l:0;t=t<0?0:t>1?1:t;
      const d=Math.hypot(x-(A.x+dx*t),y-(A.y+dy*t));if(d<bd){bd=d;best={e,t,d,x:A.x+dx*t,y:A.y+dy*t};}}}
  return best;}

/* A*：s から t へ。戻り値 {nodes, pts, len, time} または null（つながっていない） */
function route(graph,s,t,mode,opt){if(s==null||t==null)return null;const N=graph.nodes,vmax={walk:1.3,bike:8,car:22}[mode]||10;
  const g=new Map([[s,0]]),f=[[h(s),s]],came=new Map(),lenTo=new Map([[s,0]]),done=new Set();
  function h(i){return Math.hypot(N[i].x-N[t].x,N[i].y-N[t].y)/Math.max(vmax,opt&&opt.speed||0);}
  while(f.length){let bi=0;for(let i=1;i<f.length;i++)if(f[i][0]<f[bi][0])bi=i;const[,u]=f.splice(bi,1)[0];if(done.has(u))continue;done.add(u);
    if(u===t){const path=[t];let c=t;while(came.has(c)){c=came.get(c);path.push(c);}path.reverse();return{nodes:path,pts:path.map(i=>[N[i].x,N[i].y]),len:lenTo.get(t),time:g.get(t),mode};}
    for(const q of N[u].adj){if(!passable(q.e,mode,q.dir))continue;const cost=q.e.len/edgeSpeed(q.e,mode,opt);const ng=g.get(u)+cost;
      if(!g.has(q.to)||ng<g.get(q.to)){g.set(q.to,ng);lenTo.set(q.to,lenTo.get(u)+q.e.len);came.set(q.to,u);f.push([ng+h(q.to),q.to]);}}}
  return null;}
/* 座標どうし：近いノードまで歩く距離も足す */
function routeXY(graph,x0,y0,x1,y1,mode,opt){const a=nearestNode(graph,x0,y0,mode),b=nearestNode(graph,x1,y1,mode);if(!a||!b)return null;
  const r=route(graph,a.i,b.i,mode,opt);if(!r)return null;const walk=(a.d+b.d);r.access=walk;r.time+=walk/1.3;r.len+=walk;r.pts=[[x0,y0],...r.pts,[x1,y1]];return r;}

const API={OK,edgeSpeed,passable,index,nearestNode,nearestEdge,route,routeXY};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaRouting=API;
})(typeof self!=='undefined'?self:this);
