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
  const top=SIM.presentWeights({kind:'float',depth:1,waterDepth:12},cand),bot=SIM.presentWeights({kind:'float',depth:12,waterDepth:12},cand);
  const share=(p,id)=>p.out.find(o=>o[0]===id)[1]/p.sum;
  assert.ok(share(top,'iwashi')>.9);assert.ok(share(bot,'kasago')>.8);});

/* ===== 段階2：ロッド操作 ===== */
const env10={waterDepth:10,bottomType:'sand'};
const lureAt=(depth,bait='lure',dist=40)=>{const L=SIM.makeLure(bait,{waterDepth:30,bottomType:'sand'},{dist,tipH:4});L.depth=depth;return L;};
const runC=(L,sec,dt,ctrl)=>{for(let t=0;t<sec-1e-9;t+=dt)SIM.stepLure(L,dt,ctrl);return L;};

test('ただ巻き：速く巻くほどルアーは浅いところを通る',()=>{
  const slow=runC(lureAt(8),6,1/60,{hold:true,reel:.5}),fast=runC(lureAt(8),6,1/60,{hold:true,reel:2});
  assert.ok(fast.depth<slow.depth-1,`slow ${slow.depth} fast ${fast.depth}`);
  assert.ok(fast.dist<slow.dist,'速く巻くほど手前に寄る');});

test('巻くとルアーが手前に寄り、足元まで来ると回収できる',()=>{
  const L=runC(lureAt(3,'lure',20),60,1/60,{hold:true,reel:1.2});assert.ok(L.home,`dist ${L.dist}`);});

test('ジャーク：0.5秒で0.8m以上跳ね上がり、トゥイッチは小さい',()=>{
  const a=lureAt(8),b=lureAt(8);SIM.jerk(a);SIM.twitch(b);runC(a,.5,1/60,{hold:false});runC(b,.5,1/60,{hold:false});
  const fallOnly=runC(lureAt(8),.5,1/60,{hold:false});
  assert.ok(fallOnly.depth-a.depth>.8,`jerk ${a.depth} vs fall ${fallOnly.depth}`);
  assert.ok(a.depth<b.depth,'ジャークの方が大きく上がる');
  assert.equal(a.lastAction,'jerk');});

test('テンションフォールはフリーフォールよりゆっくり沈み、手前に寄る',()=>{
  const free=runC(lureAt(2),3,1/60,{hold:false}),ten=runC(lureAt(2),3,1/60,{hold:true,reel:0});
  assert.ok(ten.depth<free.depth);assert.ok(ten.dist<free.dist);assert.equal(free.dist,40);});

test('巻くのを止めると沈み、着底したら巻くと底を離れる',()=>{
  const L=SIM.makeLure('lure',env10,{dist:30,tipH:4});runC(L,10,1/60,{hold:false});assert.ok(L.onBottom);
  runC(L,1.5,1/60,{hold:true,reel:1.5});assert.ok(!L.onBottom&&L.depth<10);});

test('巻きながらでもフレームレートが違ってもほぼ同じ動き',()=>{
  const a=runC(lureAt(6),5,1/120,{hold:true,reel:1}),b=runC(lureAt(6),5,1/20,{hold:true,reel:1});
  assert.ok(Math.abs(a.depth-b.depth)<.1&&Math.abs(a.dist-b.dist)<.1,`${a.depth},${a.dist} vs ${b.depth},${b.dist}`);});

test('ルアーは水面より上に出ない',()=>{const L=runC(lureAt(.5),5,1/60,{hold:true,reel:2.5});assert.ok(L.depth>=0);});

test('青物は速い巻きに、イカはしゃくった後のフォールに反応しやすい',()=>{
  const fast=runC(lureAt(3),1,1/60,{hold:true,reel:2}),slow=runC(lureAt(3),1,1/60,{hold:true,reel:.3});
  assert.ok(SIM.actionAppeal('saba',fast)>SIM.actionAppeal('saba',slow)*1.3);
  const eFall=lureAt(5,'egi');SIM.jerk(eFall);runC(eFall,1.2,1/60,{hold:false});
  const eReel=runC(lureAt(5,'egi'),1.2,1/60,{hold:true,reel:1});
  assert.ok(SIM.actionAppeal('aoriika',eFall)>SIM.actionAppeal('aoriika',eReel)*4);});

test('岩の底を引きずると、止めているより根掛かりしやすい',()=>{
  const L=SIM.makeLure('lure',{waterDepth:5,bottomType:'rock'},{dist:30});runC(L,6,1/60,{hold:false});const rest=SIM.snagRate(L);
  L.reel=.5;assert.ok(SIM.snagRate(L)>rest);});
