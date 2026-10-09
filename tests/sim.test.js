// 水中の物理（fishing-sim.js）の動作テスト。実行：node --test tests/
const test=require('node:test');const assert=require('node:assert/strict');
const SIM=require('../fishing-sim.js');

const run=(L,sec,dt)=>{for(let t=0;t<sec-1e-9;t+=dt)SIM.stepLure(L,dt);return L;};

test('水深は沖ほど深く、足元と沖の値の間に収まる',()=>{
  for(const id of Object.keys(SIM.SPOT_ENV)){const e=SIM.SPOT_ENV[id];let prev=-1;
    for(let d=0;d<=100;d+=5){const w=SIM.waterDepth(id,d,false);assert.ok(w>=e.d0-1e-9&&w<=e.dMax+1e-9);assert.ok(w>=prev);prev=w;}}});

test('テトラ帯は浅めで底質は岩',()=>{
  assert.ok(SIM.waterDepth('suehiro',10,true)<SIM.waterDepth('suehiro',10,false));
  assert.equal(SIM.bottomType('suehiro',true),'rock');});

test('メタルジグは水深10mの底に約7秒で着き、底より深くならない',()=>{
  const L=SIM.makeLure('lure',{waterDepth:10,bottomType:'sand'});
  run(L,5,1/60);assert.ok(!L.onBottom&&L.depth>5&&L.depth<10,`5秒後 ${L.depth}`);
  run(L,4,1/60);assert.ok(L.onBottom);assert.equal(L.depth,10);});

test('エギはメタルジグよりゆっくり沈む',()=>{
  const j=run(SIM.makeLure('lure',{waterDepth:30,bottomType:'sand'}),3,1/60),e=run(SIM.makeLure('egi',{waterDepth:30,bottomType:'sand'}),3,1/60);
  assert.ok(e.depth<j.depth/3,`jig ${j.depth} egi ${e.depth}`);});

test('サビキはウキでタナ（3m）を保ち、浅い場所では底より上に留まる',()=>{
  const a=run(SIM.makeLure('sabiki',{waterDepth:12,bottomType:'mud'}),10,1/60);assert.ok(Math.abs(a.depth-3)<.05);
  const b=run(SIM.makeLure('sabiki',{waterDepth:2,bottomType:'mud'}),10,1/60);assert.ok(b.depth<2&&!b.onBottom);});

test('フレームレートが違っても沈み方はほぼ同じ',()=>{
  const env={waterDepth:40,bottomType:'mud'};
  const a=run(SIM.makeLure('lure',env),4,1/120),b=run(SIM.makeLure('lure',env),4,1/15);
  assert.ok(Math.abs(a.depth-b.depth)<.02,`${a.depth} vs ${b.depth}`);});

test('水深10mでルアーが3mにあるとき、底の魚へのアピールは弱く、上層の魚には強い',()=>{
  assert.ok(SIM.rangeMatch('kasago',3,10)<.2);
  assert.equal(SIM.rangeMatch('kasago',9.6,10),1);
  assert.equal(SIM.rangeMatch('iwashi',3,10),1);
  assert.ok(SIM.rangeMatch('iwashi',9.8,10)<.3);});

test('底で止めたままだとアタリが減り、岩の底では根掛かりが起きうる',()=>{
  const cand=[['kasago',10],['aji',10]];
  const L=SIM.makeLure('lure',{waterDepth:6,bottomType:'rock'});run(L,6,1/60);assert.ok(L.onBottom);
  const r0=SIM.lureBiteRate(L,.2,cand);run(L,20,1/60);const r1=SIM.lureBiteRate(L,.2,cand);
  assert.ok(r1<r0*.3);assert.ok(SIM.snagRate(L)>0);
  const F=SIM.makeLure('lure',{waterDepth:6,bottomType:'rock'});run(F,1,1/60);assert.equal(SIM.snagRate(F),0);});

test('深度に応じて釣れる魚の割合が変わる',()=>{
  const cand=[['kasago',10],['iwashi',10]];
  const top=SIM.presentWeights({depth:1,waterDepth:12},cand),bot=SIM.presentWeights({depth:12,waterDepth:12},cand);
  const share=(p,id)=>p.out.find(o=>o[0]===id)[1]/p.sum;
  assert.ok(share(top,'iwashi')>.9);assert.ok(share(bot,'kasago')>.8);});
