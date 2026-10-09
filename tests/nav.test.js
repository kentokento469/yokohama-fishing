// nav.js：代わりの道路網（取り付け道路・推定駐車場）、道のマス目、行き方の計画。地形は架空の単純な形。
const test=require('node:test');const assert=require('node:assert/strict');
const NV=require('../nav.js');const C=require('../osm-convert.js');const RT=require('../routing.js');
// 陸：y<500 の帯。ただし x 300〜360・y 200〜500 は入り江（海）。幹線は y=100 の東西の道
const land=(x,y)=>y<500&&y>-200&&x>-200&&x<1200&&!(x>300&&x<360&&y>200);
const trunks=[{pts:[[0,100],[1000,100]],kind:'primary',w:12,name:'幹線'}];
const targets=[{id:'a',x:330,y:190,car:true,name:'入り江の奥'},{id:'b',x:700,y:480,car:false,name:'浜'},{id:'sea',x:330,y:800}];
const FB=NV.fallback(trunks,targets,land);
test('取り付け道路は陸だけを通り、幹線につながる。海の中の目標は理由つきで外す',()=>{
  const ac=FB.roads.filter(r=>r.id.startsWith('ac_'));assert.equal(ac.length,2);
  for(const r of ac){for(let i=0;i<r.pts.length-1;i++){const[a,b]=[r.pts[i],r.pts[i+1]];for(let t=0;t<=1;t+=.02)assert.ok(land(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)||Math.abs(a[1]+(b[1]-a[1])*t-100)<1);}
    assert.ok(Math.abs(r.pts[0][1]-100)<1);assert.ok(r.approx);}
  assert.deepEqual(FB.missing.map(m=>m.id),['sea']);
});
test('推定駐車場：車で行ける所は手前、行けない所（浜）は幹線ぞい。推定であることを持つ',()=>{
  const la=FB.lots.find(l=>l.for==='a'),lb=FB.lots.find(l=>l.for==='b');assert.ok(la.est&&la.why);
  assert.ok(Math.hypot(la.x-330,la.y-190)<=30);assert.ok(Math.abs(lb.y-100)<1);
  assert.equal(FB.roads.find(r=>r.id==='ac_b').car,0);
});
const G=C.buildGraph(FB.roads);RT.index(G);const M=NV.raster(FB.roads);
test('道のマス目：幹線の上は車OK、浜への道は車NG・自転車OK、道の外はnull',()=>{
  assert.ok(M.at(500,100).car);assert.equal(M.at(500,300),null);
  const p=FB.roads.find(r=>r.id==='ac_b').pts;const mid=NV.pointAlong(p,NV.plen(p)*.6);const c=M.at(mid[0],mid[1]);assert.ok(c&&!c.car&&c.bike);
});
test('行き方：車は駐車場まで行って歩く。徒歩・自転車・車で時間が違う',()=>{
  const from=[20,100],to=[330,190];const w=NV.plan(G,FB.lots,from,to,'walk'),b=NV.plan(G,FB.lots,from,to,'bike',{speed:5}),c=NV.plan(G,FB.lots,from,to,'car',{speed:15});
  assert.ok(!c.fail&&c.legs[0].mode==='car'&&c.legs[1].mode==='walk'&&c.lot.for==='a');assert.ok(c.time<b.time&&b.time<w.time);
  const cb=NV.plan(G,FB.lots,from,[700,480],'car',{speed:15});assert.equal(cb.lot.for,'b');assert.ok(cb.legs[1].len>300);
});
