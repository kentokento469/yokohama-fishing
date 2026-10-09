/* 横浜みなと釣り旅 — 地図データの管理（3Dフィールドと2Dの地図画面が同じデータを見る）
   レイヤー：海岸線・陸地・道路・建物・河川・砂浜・駐車場・駐輪場・海岸の構造物・釣り場・プレイヤー現在地。
   地物ごとに出どころ（src）を持ち、実在データ（real）とゲーム用（おおよそ・推定）をはっきり分ける。
     src: 'gshhs'（GSHHS/GSHHG の海岸線・陸地の概形。実在だが粗い）／'osm'（OpenStreetMap）
          'game_approx'（ゲーム用に手で描いたおおよその形）／'game_est'（ゲーム用の推定。実在の施設ではない）／'user'（ユーザー提供の資料）
   データがないレイヤーは空のまま（status:'missing'）。実在の道路・施設を作り足さない。
   座標：地物は緯度経度（ll）とゲーム座標（pts）の両方を持つ。変換は geo.js。 */
(function(root){
'use strict';
const GEO=root&&root.HamaGeo||(typeof require==='function'?require('./geo.js'):null);
const OC=root&&root.HamaOSMConvert||(typeof require==='function'?require('./osm-convert.js'):null);
const LAYERS=[
  ['coastline','海岸線','line'],['land','陸地','area'],['roads','道路','line'],['buildings','建物','area'],['rivers','河川・水域','line'],
  ['beaches','砂浜','area'],['parking','駐車場','point'],['bicycle_parking','駐輪場','point'],['structures','海岸の構造物（堤防・桟橋）','line'],
  ['fishing_spots','釣り場','point'],['player','プレイヤー現在地','point']];
const SRC_LABEL={gshhs:'GSHHS（実在・概形）',osm:'OpenStreetMap（実在）',game_approx:'ゲーム用のおおよそ',game_est:'ゲーム用の推定',user:'提供資料（位置はおおよそ）'};
const REAL_SRC=new Set(['gshhs','osm']);
// fetch_osm.py が出す *_osm.geojson のファイル名（レイヤー名）→ ここでのレイヤー
const OSM_FILE_LAYER={roads:'roads',buildings:'buildings',beaches:'beaches',waterways:'rivers',water:'rivers',parking:'parking',bicycle_parking:'bicycle_parking',coastal_structures:'structures',osm_coastline:'coastline'};

function create(region){const R=region||GEO.SHONAN;const L={};for(const[id,label,kind]of LAYERS)L[id]={id,label,kind,features:[]};
  const M={region:R,layers:L,sources:[],log:[],
    add(layer,f){const l=L[layer];if(!l)throw new Error('unknown layer '+layer);f.layer=layer;f.real=REAL_SRC.has(f.src);if(!f.pts&&f.ll)f.pts=f.ll.map(([la,lo])=>GEO.toGame(la,lo,R));if(!f.ll&&f.pts)f.ll=f.pts.map(([x,y])=>GEO.toLatLon(x,y,R));
      if(f.pts&&f.pts.length&&!f.bbox)f.bbox=bboxOf(f.pts);l.features.push(f);return f;},
    status(layer){const fs=L[layer].features;if(fs.some(f=>f.real))return'real';if(fs.length)return fs.some(f=>f.src==='game_est')&&!fs.some(f=>f.src!=='game_est')?'estimate':'approx';return'missing';},
    summary(){return LAYERS.map(([id,label])=>{const fs=L[id].features;const by={};for(const f of fs)by[f.src]=(by[f.src]||0)+1;return{id,label,status:M.status(id),count:fs.length,bySrc:by};});},
    real(layer){return L[layer].features.filter(f=>f.real);},
    query(layer,b){return L[layer].features.filter(f=>!f.bbox||!(f.bbox.x1<b.x0||f.bbox.x0>b.x1||f.bbox.y1<b.y0||f.bbox.y0>b.y1));}};
  return M;}
function bboxOf(pts){let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;for(const[x,y]of pts){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return{x0,y0,x1,y1};}

/* GeoJSON（EPSG:4326）の FeatureCollection を読み込む。geom は Point/LineString/Polygon/Multi*。
   Polygon は外周だけ使う（穴は今のところ使わない）。layer を決められない地物は数えて捨てる */
function addGeoJSON(M,fc,opt){opt=opt||{};let n=0,skip=0;
  for(const ft of fc.features||[]){const g=ft.geometry;if(!g){skip++;continue;}const props=ft.properties||{};
    const layer=opt.layer||layerOfProps(props);if(!layer||!M.layers[layer]){skip++;continue;}
    const parts=g.type==='Point'?[[g.coordinates]]:g.type==='LineString'?[g.coordinates]:g.type==='Polygon'?[g.coordinates[0]]:g.type==='MultiLineString'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.map(p=>p[0]):g.type==='MultiPoint'?g.coordinates.map(c=>[c]):[];
    parts.forEach((cs,i)=>{const ll=cs.map(c=>[c[1],c[0]]);const f={id:(ft.id||props.osm_id||'f'+n)+(parts.length>1?'#'+i:''),src:opt.src||srcOfProps(props),ll,kind:g.type.replace('Multi',''),props,name:props.name||(props.tags&&props.tags.name)||null};
      if(layer==='roads'&&props.tags){const t=props.tags,k=OC&&OC.access(t.highway,t);if(k){Object.assign(f,{road:{kind:t.highway,car:k.car,bike:k.bike,foot:k.foot,oneway:OC.oneway(t),surface:OC.surfaceOf(t),bridge:t.bridge==='yes',layer:+(t.layer||0),nodes:props.osm_node_ids||null,w:(OC.ROAD_KIND[t.highway]||{}).w||4}});}}
      M.add(layer,f);n++;});}
  M.log.push(`${opt.name||'GeoJSON'}: ${n}件を読み込み${skip?`・${skip}件はレイヤー不明で除外`:''}`);return{n,skip};}
function srcOfProps(p){const s=String(p.source||'');if(/GSHHS/i.test(s))return'gshhs';if(/OpenStreetMap|OSM/i.test(s))return'osm';return'user';}
function layerOfProps(p){if(p.category==='coastline')return'coastline';if(p.category==='land')return'land';const t=p.tags||{};
  if(t.highway)return'roads';if(t.natural==='coastline')return'coastline';if(t.natural==='beach')return'beaches';if(t.waterway||t.natural==='water')return'rivers';
  if(t.amenity==='parking')return'parking';if(t.amenity==='bicycle_parking')return'bicycle_parking';if(/^(pier|breakwater|groyne|embankment)$/.test(t.man_made||''))return'structures';if(t.building)return'buildings';return null;}

/* 道路レイヤー（OSM）を routing 用の形に。node id があるものは id でだけつなぐ（橋・立体交差を誤ってつながない） */
function roadsForGraph(M){return M.layers.roads.features.filter(f=>f.road&&f.real).map(f=>Object.assign({id:f.id,pts:f.pts,name:f.name,approx:false},f.road,{nodes:f.road.nodes&&f.road.nodes.length===f.pts.length?f.road.nodes:null}));}

/* 線どうしのずれ（実際のメートル）：a の各頂点から b の線までの距離の統計 */
function lineOffset(a,b){const ds=[];for(const p of a){let d=1e18;for(const L of b)for(let i=0;i<L.length-1;i++){const q=L[i],r=L[i+1],dx=r[0]-q[0],dy=r[1]-q[1],l=dx*dx+dy*dy;let t=l?((p[0]-q[0])*dx+(p[1]-q[1])*dy)/l:0;t=t<0?0:t>1?1:t;d=Math.min(d,Math.hypot(p[0]-q[0]-dx*t,p[1]-q[1]-dy*t));}ds.push(d*GEO.SC);}
  ds.sort((x,y)=>x-y);const avg=ds.reduce((s,v)=>s+v,0)/(ds.length||1);return{n:ds.length,mean:avg,median:ds[ds.length>>1]||0,max:ds[ds.length-1]||0};}

/* 読み込んだ GeoJSON の検査（import_geo.mjs とテストで使う） */
function validate(fc,opt){opt=opt||{};const err=[],warn=[];const bb=opt.bbox;// [w,s,e,n]
  if(!fc||fc.type!=='FeatureCollection')err.push('FeatureCollection ではない');const feats=fc&&fc.features||[];const types={};let verts=0,segLen=[];
  feats.forEach((f,i)=>{const g=f.geometry;if(!g){err.push(`#${i}: geometry がない`);return;}types[g.type]=(types[g.type]||0)+1;
    const rings=g.type==='Point'?[[g.coordinates]]:g.type==='LineString'?[g.coordinates]:g.type==='Polygon'?g.coordinates:g.type==='MultiLineString'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():[];
    if(!rings.length)err.push(`#${i}: 未対応の geometry ${g.type}`);
    for(const r of rings){for(const c of r){verts++;if(!Array.isArray(c)||!isFinite(c[0])||!isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>90){err.push(`#${i}: 座標が不正 ${JSON.stringify(c)}`);return;}
        if(bb&&(c[0]<bb[0]-1e-6||c[0]>bb[2]+1e-6||c[1]<bb[1]-1e-6||c[1]>bb[3]+1e-6))warn.push(`#${i}: 範囲外の点 ${c}`);}
      for(let k=0;k<r.length-1;k++)segLen.push(GEO.haversine(r[k][1],r[k][0],r[k+1][1],r[k+1][0]));
      if(/Polygon/.test(g.type)){const a=r[0],b=r[r.length-1];if(a[0]!==b[0]||a[1]!==b[1])err.push(`#${i}: 多角形が閉じていない`);const x=selfCross(r);if(x)warn.push(`#${i}: 多角形の辺が${x}か所で交差`);}}});
  segLen.sort((a,b)=>a-b);
  return{ok:!err.length,err,warn,features:feats.length,types,vertices:verts,segment:{median:Math.round(segLen[segLen.length>>1]||0),max:Math.round(segLen[segLen.length-1]||0)}};}
function selfCross(r){let n=0;const s=r.length-1;for(let i=0;i<s;i++)for(let j=i+2;j<s;j++){if(i===0&&j===s-1)continue;if(cross(r[i],r[i+1],r[j],r[j+1]))n++;}return n;}
function cross(p,p2,q,q2){const d=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const d1=d(q,q2,p),d2=d(q,q2,p2),d3=d(p,p2,q),d4=d(p,p2,q2);return d1*d2<0&&d3*d4<0;}

const API={LAYERS,SRC_LABEL,OSM_FILE_LAYER,create,addGeoJSON,roadsForGraph,lineOffset,validate,bboxOf};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaMapData=API;
})(typeof self!=='undefined'?self:this);
