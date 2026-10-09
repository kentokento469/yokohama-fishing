/* 横浜みなと釣り旅 — OpenStreetMap のデータをゲームの地図レイヤーと道路ネットワークに変換する（描画に依存しない。Node でもブラウザでも動く）
   入力：Overpass API の JSON（`[out:json]` と `out geom;` で取得したもの）
   出力：{meta, coast, land, water, rivers, roads, buildings, parks, beaches, rocks, piers, parking, bikeParking, fuel, shops, restricted, est}
     ・OSM にある情報だけを「osm」層に入れる。足りない属性（駐車場の料金・台数・建物の高さなど）はゲーム用の推定値として est 層に分けて入れる。
     ・座標は project(lat, lon) → [x, y]（ゲームの m）で変換する。
   ライセンス：OpenStreetMap のデータは ODbL。ゲーム内と配布物に「© OpenStreetMap contributors」を表示すること。 */
(function(root){
'use strict';
const ATTRIBUTION='© OpenStreetMap contributors（ODbL）';

/* ===== 道路の種類と、徒歩・自転車・車の通行可否、幅（m） ===== */
const ROAD_KIND={
  motorway:{car:1,bike:0,foot:0,w:14,v:80},trunk:{car:1,bike:1,foot:1,w:12,v:60},primary:{car:1,bike:1,foot:1,w:11,v:50},secondary:{car:1,bike:1,foot:1,w:9,v:40},
  tertiary:{car:1,bike:1,foot:1,w:8,v:40},unclassified:{car:1,bike:1,foot:1,w:6,v:30},residential:{car:1,bike:1,foot:1,w:6,v:30},living_street:{car:1,bike:1,foot:1,w:5,v:15},
  service:{car:1,bike:1,foot:1,w:5,v:20},motorway_link:{car:1,bike:0,foot:0,w:8,v:50},trunk_link:{car:1,bike:1,foot:1,w:7,v:40},primary_link:{car:1,bike:1,foot:1,w:7,v:40},
  secondary_link:{car:1,bike:1,foot:1,w:7,v:30},tertiary_link:{car:1,bike:1,foot:1,w:6,v:30},track:{car:0,bike:1,foot:1,w:3,v:10},
  cycleway:{car:0,bike:1,foot:1,w:3,v:20},footway:{car:0,bike:0,foot:1,w:2.5,v:5},pedestrian:{car:0,bike:0,foot:1,w:6,v:5},path:{car:0,bike:1,foot:1,w:2,v:8},
  steps:{car:0,bike:0,foot:1,w:2,v:3},bridleway:{car:0,bike:1,foot:1,w:3,v:8}};
const NO=v=>v==='no'||v==='private';
const YES=v=>v==='yes'||v==='designated'||v==='permissive';
function access(kind,t){const k=ROAD_KIND[kind];if(!k)return null;let car=!!k.car,bike=!!k.bike,foot=!!k.foot;
  if(NO(t.access)){car=bike=foot=false;}
  if(NO(t.motor_vehicle)||NO(t.motorcar)||NO(t.vehicle))car=false;if(NO(t.bicycle)||NO(t.vehicle))bike=false;if(NO(t.foot))foot=false;
  if(YES(t.bicycle))bike=true;if(YES(t.foot))foot=true;if(YES(t.motor_vehicle)||YES(t.motorcar))car=true;
  return{car,bike,foot};}
function surfaceOf(t){const s=t.surface||'';if(/sand/.test(s))return'sand';if(/gravel|unpaved|dirt|ground|compacted|earth|grass|pebble/.test(s))return'gravel';
  if(t.highway==='track'||t.highway==='path')return s?'paved':'gravel';return'paved';}
function oneway(t){const o=t.oneway;return o==='yes'||o==='1'||o==='true'?1:o==='-1'?-1:0;}

/* ===== 幾何 ===== */
function wayPts(w,project){return(w.geometry||[]).map(g=>project(g.lat,g.lon));}
function closed(w){return w.nodes&&w.nodes.length>3&&w.nodes[0]===w.nodes[w.nodes.length-1];}
function centroid(pts){let x=0,y=0;for(const p of pts){x+=p[0];y+=p[1];}return[x/pts.length,y/pts.length];}
function area(pts){let a=0;for(let i=0,j=pts.length-1;i<pts.length;j=i++)a+=(pts[j][0]+pts[i][0])*(pts[j][1]-pts[i][1]);return a/2;}

/* 海岸線（natural=coastline。進む向きの左が陸）をつないで、取得範囲の枠で閉じて陸の多角形にする。
   閉じた海岸線（島）はそのまま陸。つなげなかった切れ端は coast（線）としてだけ残す */
function coastToLand(lines,bbox){
  const chains=[];const ends=new Map();const key=p=>p[0].toFixed(1)+','+p[1].toFixed(1);
  for(const l of lines){chains.push(l.slice());}
  // 端点が一致する線をつなぐ
  let merged=true;while(merged){merged=false;
    for(let i=0;i<chains.length&&!merged;i++)for(let j=0;j<chains.length&&!merged;j++){if(i===j)continue;const a=chains[i],b=chains[j];
      if(key(a[a.length-1])===key(b[0])){chains[i]=a.concat(b.slice(1));chains.splice(j,1);merged=true;}}}
  const polys=[],open=[];
  for(const c of chains){if(key(c[0])===key(c[c.length-1])&&c.length>3)polys.push(c);else open.push(c);}
  if(bbox){const{x0,y0,x1,y1}=bbox,W=x1-x0,H=y1-y0,L=2*(W+H);
    // 枠の周を、右下の角から「右辺を上→上辺を左→左辺を下→下辺を右」の順に測る。北が上の地図で陸が線の左になる向き
    const per=([x,y])=>{const d=[Math.abs(x-x1),Math.abs(y-y0),Math.abs(x-x0),Math.abs(y-y1)];const s=d.indexOf(Math.min(...d));
      return s===0?y1-y:s===1?H+(x1-x):s===2?H+W+(y-y0):2*H+W+(x-x0);};
    const corners=[[H,[x1,y0]],[H+W,[x0,y0]],[2*H+W,[x0,y1]],[L,[x1,y1]]];
    for(const c of open){const pe=per(c[c.length-1]);let ps=per(c[0]);if(ps<=pe)ps+=L;const out=c.slice();
      for(let lap=0;lap<2;lap++)for(const[cv,pt]of corners){const v=cv+lap*L;if(v>pe&&v<ps)out.push(pt);}
      out.push(c[0]);polys.push(out);}}
  return{polys,open};}

/* ===== 変換 ===== */
function convert(json,project,opt){opt=opt||{};const els=json.elements||[];const R={meta:{source:'OpenStreetMap',attribution:ATTRIBUTION,generated:opt.generated||null,area:opt.area||null,bbox:opt.bbox||null,count:els.length},
  coast:[],land:[],water:[],rivers:[],roads:[],buildings:[],parks:[],beaches:[],rocks:[],piers:[],parking:[],bikeParking:[],fuel:[],shops:[],restricted:[],est:{parking:[],buildings:[]}};
  const coastLines=[];
  for(const e of els){const t=e.tags||{};
    if(e.type==='node'){const p=project(e.lat,e.lon);
      if(t.amenity==='parking')addParking(R,e.id,p,t,null);else if(t.amenity==='bicycle_parking')R.bikeParking.push({id:e.id,x:p[0],y:p[1],capacity:t.capacity?+t.capacity:null,src:'osm'});
      else if(t.amenity==='fuel')R.fuel.push({id:e.id,x:p[0],y:p[1],name:t.name||null});else if(t.shop)R.shops.push({id:e.id,x:p[0],y:p[1],shop:t.shop,name:t.name||null});
      continue;}
    if(e.type!=='way'||!e.geometry)continue;const pts=wayPts(e,project);if(pts.length<2)continue;
    if(t.natural==='coastline'){coastLines.push(pts);R.coast.push(pts);continue;}
    if(t.highway&&ROAD_KIND[t.highway]&&!(t.area==='yes')){const k=ROAD_KIND[t.highway],a=access(t.highway,t);
      R.roads.push({id:e.id,nodes:e.nodes||null,pts,kind:t.highway,name:t.name||null,car:a.car,bike:a.bike,foot:a.foot,oneway:oneway(t),surface:surfaceOf(t),bridge:t.bridge==='yes',
        w:t.width?parseFloat(t.width)||k.w:k.w,lanes:t.lanes?+t.lanes:null});continue;}
    if(t.waterway==='river'||t.waterway==='stream'||t.waterway==='canal'){R.rivers.push({id:e.id,pts,kind:t.waterway,name:t.name||null,w:t.width?parseFloat(t.width):t.waterway==='river'?30:5,wEst:!t.width});continue;}
    if(t.building&&closed(e)){const lv=t['building:levels']?+t['building:levels']:null,h=t.height?parseFloat(t.height):null;const b={id:e.id,pts,levels:lv,height:h};
      R.buildings.push(b);if(!lv&&!h)R.est.buildings.push({id:e.id,levels:2,why:'階数・高さの情報なし（ゲーム用に2階建てと推定）'});continue;}
    if(closed(e)&&(t.natural==='water'||t.waterway==='riverbank'||t.water)){R.water.push({id:e.id,pts});continue;}
    if(closed(e)&&(t.leisure==='park'||t.landuse==='grass'||t.natural==='wood'||t.natural==='scrub'||t.landuse==='forest'||t.leisure==='garden')){R.parks.push({id:e.id,pts,kind:t.leisure||t.landuse||t.natural});continue;}
    if(t.natural==='beach'&&closed(e)){R.beaches.push({id:e.id,pts});continue;}
    if(t.natural==='bare_rock'||t.natural==='rock'||t.natural==='reef'||t.natural==='cliff'){R.rocks.push({id:e.id,pts,closed:closed(e),kind:t.natural});continue;}
    if(t.man_made==='pier'||t.man_made==='breakwater'||t.man_made==='groyne'){const restricted=NO(t.access)||NO(t.foot);R.piers.push({id:e.id,pts,closed:closed(e),kind:t.man_made,name:t.name||null,restricted});
      if(restricted)R.restricted.push({id:e.id,pts,why:`access=${t.access||t.foot}`,name:t.name||null});continue;}
    if(t.amenity==='parking'){addParking(R,e.id,centroid(pts),t,closed(e)?pts:null);continue;}
    if(t.amenity==='bicycle_parking'){const c=centroid(pts);R.bikeParking.push({id:e.id,x:c[0],y:c[1],capacity:t.capacity?+t.capacity:null,src:'osm'});continue;}
    if(t.amenity==='fuel'){const c=centroid(pts);R.fuel.push({id:e.id,x:c[0],y:c[1],name:t.name||null});continue;}
    if((t.landuse==='harbour'||t.harbour||t.leisure==='marina'||t.landuse==='military')&&closed(e)){if(NO(t.access)||t.landuse==='military')R.restricted.push({id:e.id,pts,why:t.landuse||t.leisure||'harbour',name:t.name||null});continue;}
    if(NO(t.access)&&closed(e)){R.restricted.push({id:e.id,pts,why:`access=${t.access}`,name:t.name||null});continue;}}
  const cl=coastToLand(coastLines,opt.bboxGame||null);R.land=cl.polys;
  return R;}
function addParking(R,id,p,t,poly){const P={id,x:p[0],y:p[1],poly,name:t.name||null,capacity:t.capacity?+t.capacity:null,fee:t.fee||null,charge:t.charge||null,hours:t.opening_hours||null,access:t.access||null,src:'osm'};
  R.parking.push(P);
  // OSM にない属性はゲーム用の推定値として別に持つ（実在の施設の情報ではない）
  const est={id};if(P.capacity==null)est.capacity=poly?Math.max(5,Math.round(Math.abs(area(poly))/25)):20;if(!P.fee&&!P.charge)est.feePerHour=300;if(!P.hours)est.hours='24h（推定）';
  if(Object.keys(est).length>1)R.est.parking.push(est);}

/* ===== 道路ネットワーク =====
   OSM のノードID（way.nodes）でつながりを作る。ID がない線（ゲームの近似道路など）は、端点と交差点で自動的につなぐ */
function buildGraph(roads){const nodes=[],edges=[],idx=new Map();
  const nodeFor=(key,x,y)=>{let n=idx.get(key);if(n==null){n=nodes.length;nodes.push({x,y,adj:[]});idx.set(key,n);}return n;};
  const add=(a,b,r)=>{const A=nodes[a],B=nodes[b],len=Math.hypot(A.x-B.x,A.y-B.y);if(len<=0)return;const e={a,b,len,kind:r.kind,car:r.car,bike:r.bike,foot:r.foot,oneway:r.oneway||0,surface:r.surface||'paved',name:r.name||null};
    edges.push(e);A.adj.push({to:b,e,dir:1});B.adj.push({to:a,e,dir:-1});};
  const pend=[];
  for(const r of roads){if(r.nodes&&r.nodes.length===r.pts.length){for(let i=0;i<r.pts.length-1;i++)add(nodeFor('o'+r.nodes[i],...r.pts[i]),nodeFor('o'+r.nodes[i+1],...r.pts[i+1]),r);}else pend.push(r);}
  if(pend.length){// 近似道路：線分の交差点で分割し、5m以内の点はまとめる
    const segs=[];pend.forEach((r,ri)=>{for(let i=0;i<r.pts.length-1;i++)segs.push({r,a:r.pts[i],b:r.pts[i+1],cuts:[0,1]});});
    for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const t=segX(segs[i].a,segs[i].b,segs[j].a,segs[j].b);if(t){segs[i].cuts.push(t[0]);segs[j].cuts.push(t[1]);}}
    const snap=(x,y)=>Math.round(x/5)+','+Math.round(y/5);
    // 端点が他の線分の近く（8m以内）にあればそこで接続（T字路）
    // 端点どうしが8m以内なら同じ点にまとめる
    const ends=[];for(const s of segs){ends.push([s,0]);ends.push([s,1]);}
    for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){const[s1,e1]=ends[i],[s2,e2]=ends[j];if(s1===s2)continue;const p=e1?s1.b:s1.a,q=e2?s2.b:s2.a;if(p!==q&&Math.hypot(p[0]-q[0],p[1]-q[1])<8){if(e2)s2.b=p;else s2.a=p;}}
    for(const s of segs)for(const end of[0,1]){const p=end?s.b:s.a;for(const o of segs){if(o===s)continue;const t=projT(p,o.a,o.b);if(t>0&&t<1){const q=[o.a[0]+(o.b[0]-o.a[0])*t,o.a[1]+(o.b[1]-o.a[1])*t];if(Math.hypot(q[0]-p[0],q[1]-p[1])<8){o.cuts.push(t);if(end)s.b=q;else s.a=q;}}}}
    for(const s of segs){const cs=[...new Set(s.cuts.map(c=>Math.round(c*1e6)/1e6))].sort((a,b)=>a-b);
      for(let k=0;k<cs.length-1;k++){const p=lerp2(s.a,s.b,cs[k]),q=lerp2(s.a,s.b,cs[k+1]);add(nodeFor(snap(...p),...p),nodeFor(snap(...q),...q),s.r);}}}
  return{nodes,edges};}
function lerp2(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function projT(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;return l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;}
function segX(p,p2,q,q2){const r=[p2[0]-p[0],p2[1]-p[1]],s=[q2[0]-q[0],q2[1]-q[1]],d=r[0]*s[1]-r[1]*s[0];if(Math.abs(d)<1e-9)return null;
  const t=((q[0]-p[0])*s[1]-(q[1]-p[1])*s[0])/d,u=((q[0]-p[0])*r[1]-(q[1]-p[1])*r[0])/d;return t>1e-6&&t<1-1e-6&&u>1e-6&&u<1-1e-6?[t,u]:null;}

const API={ATTRIBUTION,ROAD_KIND,access,surfaceOf,oneway,coastToLand,convert,buildGraph,area,centroid};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaOSMConvert=API;
})(typeof self!=='undefined'?self:this);
