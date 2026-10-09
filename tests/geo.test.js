// 共通の座標システム（geo.js）と地図データ（mapdata.js）、提供された GSHHS データの検査
const test=require('node:test');const assert=require('node:assert/strict');
const G=require('../geo.js'),MD=require('../mapdata.js'),SH=require('../shonan.js'),D=require('../data/geo/geo-data.js');
test('緯度経度⇔ゲーム座標の往復誤差が1cm未満（実距離）',()=>{
  for(const[la,lo]of[[35.3135,139.3598],[35.299,139.48],[35.345,139.56],[35.25,139.26],[35.4,139.63]]){const[x,y]=G.toGame(la,lo);const[a,b]=G.toLatLon(x,y);assert.ok(G.haversine(la,lo,a,b)<.01);}
  const[x,y]=G.toGame(35.3135,139.3598),[a,b]=G.toLatLon(x+.5,y-.5),[c,d]=G.toGame(a,b);assert.ok(Math.abs(c-x-.5)<1e-6&&Math.abs(d-y+.5)<1e-6);});
test('原点は固定、向きは既存どおり（東=+x・北=−y）、shonan.js と同じ値',()=>{
  assert.deepEqual(G.toGame(35.345,139.56),[2400,8300]);const[x0,y0]=G.toGame(35.3,139.4),[x1]=G.toGame(35.3,139.41),[,y1]=G.toGame(35.31,139.4);
  assert.ok(x1>x0&&y1<y0);assert.deepEqual(SH.toGame(35.3,139.4),[x0,y0]);});
test('ゲームの距離×3＝実際の距離（湘南の範囲で誤差0.5%以内）',()=>{
  for(const[[a,b],[c,d]]of[[[35.30,139.30],[35.30,139.55]],[[35.25,139.4],[35.34,139.4]],[[35.29,139.29],[35.33,139.55]]]){const p=G.toGame(a,b),q=G.toGame(c,d);
    const real=G.haversine(a,b,c,d),game=Math.hypot(p[0]-q[0],p[1]-q[1])*G.SC;assert.ok(Math.abs(game/real-1)<.005,`${game} vs ${real}`);}});
test('地図の表示：world⇔screen の往復、拡大しても指の位置の地点は動かない、回転あり',()=>{
  const v=G.view(100,200,.5,320,400,.7);const[px,py]=G.worldToScreen(v,130,170);const[x,y]=G.screenToWorld(v,px,py);assert.ok(Math.abs(x-130)<1e-9&&Math.abs(y-170)<1e-9);
  const w=G.view(0,0,.2,300,300);const before=G.screenToWorld(w,50,80);G.zoomAt(w,50,80,1.7);const after=G.screenToWorld(w,50,80);assert.ok(Math.hypot(before[0]-after[0],before[1]-after[1])<1e-9);
  const sb=G.scaleBar({z:.1},100);assert.ok(sb.px<=100&&/m|km/.test(sb.label));});
test('提供データ（GSHHS）は正しい GeoJSON で、範囲内・多角形は閉じている',()=>{
  const bb=D.manifest.coverage_bbox_wsen||D.manifest.bbox_wsen;assert.equal(D.manifest.crs,'EPSG:4326');assert.equal(D.areas.length,6);assert.ok(D.areas.every(a=>a.administrative===false));
  for(const[f,o]of Object.entries(D.files)){const v=MD.validate({type:'FeatureCollection',features:o.features},{bbox:bb});assert.ok(v.ok,f+v.err);assert.equal(v.warn.length,0,f+v.warn);}});
const M=MD.create();for(const[f,o]of Object.entries(D.files))MD.addGeoJSON(M,{features:o.features},{name:f});
test('地図データ：GSHHS の海岸線・陸地は実在、道路・建物・駐車場などは未取得（空）のまま',()=>{
  const st=Object.fromEntries(M.summary().map(l=>[l.id,l.status]));assert.equal(st.coastline,'real');assert.equal(st.land,'real');
  for(const k of['roads','buildings','parking','bicycle_parking','beaches','rivers','structures','fishing_spots'])assert.equal(st[k],'missing',k);
  assert.ok(M.layers.coastline.features.every(f=>f.src==='gshhs'&&f.ll&&f.pts.length===f.ll.length));});
test('平塚周辺：手描きの海岸線と GSHHS の海岸線のずれは平均1km未満（同じ海岸を表している）',()=>{
  const gc=M.layers.coastline.features.map(f=>f.pts);const hira=SH.COAST.filter(p=>{const lo=G.toLatLon(p[0],p[1])[1];return lo>=139.33&&lo<=139.38;});
  const o=MD.lineOffset(hira,gc);assert.ok(o.n>=5&&o.mean<1000,JSON.stringify(o));});
test('釣り場と平塚の開始地点は陸（手描きの地形）にあり、海岸線から離れすぎていない',()=>{
  for(const g of SH.GSPOTS.filter(g=>g.area==='hiratsuka'))assert.ok(SH.lineDist(SH.COAST,g.x,g.y)<120||SH.structAt(g.x,g.y),g.id);
  const bp=SH.GSPOTS.find(g=>g.id==='beachpark');assert.ok(SH.isLand(bp.x,bp.y-40));});
test('OSM GeoJSON（fetch_osm_geojson.py の形）を後から読み込める：道路は node id 付きで経路用に変換',()=>{
  const M2=MD.create();const fc={features:[{type:'Feature',id:'osm-way-1',properties:{source:'OpenStreetMap',tags:{highway:'residential'},osm_node_ids:[1,2]},geometry:{type:'LineString',coordinates:[[139.35,35.32],[139.351,35.32]]}},
    {type:'Feature',id:'osm-way-2',properties:{source:'OpenStreetMap',tags:{highway:'footway'},osm_node_ids:[2,3]},geometry:{type:'LineString',coordinates:[[139.351,35.32],[139.351,35.321]]}}]};
  MD.addGeoJSON(M2,fc,{layer:'roads'});assert.equal(M2.status('roads'),'real');const r=MD.roadsForGraph(M2);assert.equal(r.length,2);assert.deepEqual(r[0].nodes,[1,2]);assert.equal(r[1].car,false);});
