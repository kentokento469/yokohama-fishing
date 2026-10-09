// OSM の変換と経路探索（osm-convert.js・routing.js）の動作テスト。データは tests/fixtures/osm-sample.json（架空のテスト用。実在の地図ではない）。
const test=require('node:test');const assert=require('node:assert/strict');
const C=require('../osm-convert.js');const RT=require('../routing.js');const SH=require('../shonan.js');
const raw=require('./fixtures/osm-sample.json');
const proj=(la,lo)=>SH.toGame(la,lo);const p0=proj(35.321,139.349),p1=proj(35.309,139.362);
const bboxGame={x0:Math.min(p0[0],p1[0]),x1:Math.max(p0[0],p1[0]),y0:Math.min(p0[1],p1[1]),y1:Math.max(p0[1],p1[1])};
const R=C.convert(raw,proj,{area:'sample',bboxGame});

test('テスト用サンプルは架空データだと明記されている',()=>{assert.match(raw._note,/架空/);});
test('道路・建物・駐車場・駐輪場・川・防波堤・規制を取り出す',()=>{
  assert.equal(R.roads.length,5);assert.equal(R.buildings.length,1);assert.equal(R.buildings[0].levels,3);assert.equal(R.parking.length,2);assert.equal(R.bikeParking.length,1);
  assert.equal(R.rivers.length,1);assert.equal(R.piers.length,1);assert.ok(R.piers[0].restricted);assert.equal(R.restricted.length,1);
  assert.match(R.meta.attribution,/OpenStreetMap/);});
test('道路の種類ごとの通行可否：遊歩道は車不可、自転車道は車不可・自転車可、一方通行',()=>{
  const by=k=>R.roads.find(r=>r.kind===k);assert.equal(by('footway').car,false);assert.equal(by('footway').foot,true);assert.equal(by('footway').surface,'sand');
  assert.equal(by('cycleway').car,false);assert.equal(by('cycleway').bike,true);assert.equal(R.roads.find(r=>r.oneway===1).kind,'residential');
  assert.equal(C.access('motorway',{}).foot,false);assert.equal(C.access('residential',{access:'private'}).car,false);});
test('OSMにない属性はゲーム用の推定値として別の層に入る（実在の情報と混ぜない）',()=>{
  const known=R.parking.find(p=>p.capacity===40),unk=R.parking.find(p=>p.capacity==null);assert.ok(known&&unk);
  const est=R.est.parking.find(e=>e.id===unk.id);assert.ok(est&&est.capacity>0&&est.feePerHour>0);assert.equal(R.parking.find(p=>p.id===unk.id).capacity,null,'osm層は空のまま');});
test('海岸線を取得範囲の枠で閉じて、陸（北側）の多角形にする',()=>{assert.equal(R.land.length,1);
  const pip=(p,x,y)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;};
  const north=proj(35.317,139.355),south=proj(35.3105,139.355);assert.ok(pip(R.land[0],...north),'道路のあたりは陸');assert.ok(!pip(R.land[0],...south),'海岸線の南は海');});
test('道路ネットワーク：交差点でつながり、徒歩・自転車・車で通れる道が違う',()=>{const G=RT.index(C.buildGraph(R.roads));
  const at=(dx,dy)=>RT.nearestNode(G,...proj(35.320-dy*.001,139.350+dx*.001)).i;
  const beach=at(10,7.8),west=at(0,5);
  assert.ok(RT.route(G,west,beach,'walk'),'歩いて浜へ行ける');assert.equal(RT.route(G,west,beach,'car'),null,'車は遊歩道に入れない');
  const nw=at(0,0),sw=at(5,0);assert.ok(RT.route(G,nw,sw,'car'),'一方通行の向きには行ける');
  const back=RT.route(G,sw,nw,'car');assert.ok(!back||back.nodes.length>2,'逆向きは一方通行を通らず遠回り');
  const bike=RT.route(G,west,nw,'bike');assert.ok(bike&&bike.nodes.length===2,'自転車は自転車道を通れる');
  const car=RT.route(G,west,nw,'car');assert.ok(!car||car.len>bike.len,'車は自転車道を通れない');});
test('経路の時間：車は自転車より、自転車は徒歩より速い',()=>{const G=RT.index(C.buildGraph(R.roads));const a=RT.nearestNode(G,...proj(35.315,139.350)).i,b=RT.nearestNode(G,...proj(35.315,139.360)).i;
  const w=RT.route(G,a,b,'walk'),k=RT.route(G,a,b,'bike'),c=RT.route(G,a,b,'car');assert.ok(c.time<k.time&&k.time<w.time);assert.ok(Math.abs(w.len-c.len)<1e-6,'同じ道なら距離は同じ');});
test('近似の道路（ノードIDなし）も交差点でつながる',()=>{const G=RT.index(C.buildGraph([{pts:[[0,0],[100,0]],kind:'primary',car:true,bike:true,foot:true},{pts:[[50,-50],[50,50]],kind:'residential',car:true,bike:true,foot:true},{pts:[[100,4],[100,80]],kind:'service',car:true,bike:true,foot:true}]));
  const a=RT.nearestNode(G,0,0).i,b=RT.nearestNode(G,50,50).i,c=RT.nearestNode(G,100,80).i;const r=RT.route(G,a,b,'car');assert.ok(r&&Math.abs(r.len-100)<1);assert.ok(RT.route(G,a,c,'car'),'T字路（4m以内）もつながる');});
