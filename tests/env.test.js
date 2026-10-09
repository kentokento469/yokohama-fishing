// 環境（段階6：天気・水温・濁り・潮流・地形）の動作テスト。実行：node --test tests/*.test.js
const test=require('node:test');const assert=require('node:assert/strict');
const SIM=require('../fishing-sim.js');const AI=require('../fish-ai.js');
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

test('天気：同じ日は同じ天気、梅雨（6月）は1月より雨が多い',()=>{
  assert.deepEqual(SIM.weatherOf(20000,6),SIM.weatherOf(20000,6));
  const rainy=m=>{let n=0;for(let d=0;d<3000;d++)if(SIM.weatherOf(d,m).kind==='rain')n++;return n;};assert.ok(rainy(6)>rainy(1)*2);});

test('水温：夏は冬より高く、月の変わり目でも急に飛ばない',()=>{
  assert.ok(SIM.waterTemp(8,15,12,{kind:'sunny'})>SIM.waterTemp(2,15,12,{kind:'sunny'})+10);
  const a=SIM.waterTemp(9,30,12,{kind:'sunny'}),b=SIM.waterTemp(10,1,12,{kind:'sunny'});assert.ok(Math.abs(a-b)<.5,`${a} ${b}`);
  assert.ok(SIM.waterTemp(7,15,12,{kind:'rain'})<SIM.waterTemp(7,15,12,{kind:'sunny'}));});

test('濁り：雨の日と雨の翌日は濁る',()=>{
  const s={kind:'sunny',wind:2},r={kind:'rain',wind:2},n={kind:'sunny',wind:2,rainPrev:true};
  assert.ok(SIM.turbidity('honmoku',r)>SIM.turbidity('honmoku',s)+.2);assert.ok(SIM.turbidity('honmoku',n)>SIM.turbidity('honmoku',s));});

test('潮流：潮止まりは流れず、上げと下げで向きが逆、大潮ほど速い',()=>{
  assert.equal(SIM.currentAt('honmoku',{s:0,amp:1},{kind:'sunny'}),0);
  assert.ok(SIM.currentAt('honmoku',{s:1,amp:1},{kind:'sunny'})>0&&SIM.currentAt('honmoku',{s:-1,amp:1},{kind:'sunny'})<0);
  assert.ok(SIM.currentAt('honmoku',{s:1,amp:1},{kind:'sunny'})>SIM.currentAt('honmoku',{s:1,amp:.45},{kind:'sunny'}));});

test('明るさと水中の見通し：雨・夜・濁りで下がる',()=>{
  assert.ok(SIM.lightOf(0,{kind:'rain'})<SIM.lightOf(0,{kind:'sunny'}));assert.ok(SIM.lightOf(1,{kind:'sunny'})<SIM.lightOf(0,{kind:'sunny'}));
  assert.ok(SIM.underwaterVis(1,.8)<SIM.underwaterVis(1,.2));});

test('適水温：範囲内は1、外れるほど下がる',()=>{assert.equal(SIM.tempFactor('aoriika',22),1);assert.ok(SIM.tempFactor('aoriika',12)<.3);assert.ok(SIM.tempFactor('mebaru',12)>SIM.tempFactor('aoriika',12));});

test('地形：距離ごとの底質（本牧：足元は岩、海藻帯、砂地）とテトラ',()=>{
  assert.equal(SIM.bottomAt('honmoku',2,false),'rock');assert.equal(SIM.bottomAt('honmoku',8,false),'weed');assert.equal(SIM.bottomAt('honmoku',25,false),'sand');
  assert.equal(SIM.bottomAt('kanazawa',25,true),'rock');
  assert.ok(SIM.bottomFactor('kasago','rock')>SIM.bottomFactor('kasago','sand'));assert.ok(SIM.bottomFactor('kisu','sand')>SIM.bottomFactor('kisu','rock'));});

test('潮流のドリフト：糸を緩めると横に流され、巻いているとあまり流されない。流れがあると沈むのが遅い',()=>{
  const env=c=>SIM.envAt('honmoku',40,false,{current:c});const run=(L,sec,ctrl)=>{for(let t=0;t<sec;t+=1/60)SIM.stepLure(L,1/60,ctrl);return L;};
  const free=run(SIM.makeLure('lure',env(.3),{dist:40}),5,{hold:false}),reel=run(SIM.makeLure('lure',env(.3),{dist:40}),5,{hold:true,reel:1.5});
  assert.ok(Math.abs(SIM.lateral(free))>1.2,`free ${SIM.lateral(free)}`);assert.ok(Math.abs(SIM.lateral(reel))<Math.abs(SIM.lateral(free))*.4);
  const still=run(SIM.makeLure('lure',env(0),{dist:40}),3,{hold:false});const flow=run(SIM.makeLure('lure',env(.3),{dist:40}),3,{hold:false});assert.ok(flow.depth<still.depth);
  assert.equal(SIM.lureState(free),'drift');});

test('海藻帯の底に触れると海藻が掛かることがあり、掛かると魚は食わない',()=>{
  const L=SIM.makeLure('lure',SIM.envAt('honmoku',8,false),{dist:8});for(let t=0;t<15;t+=1/60)SIM.stepLure(L,1/60,{hold:false});
  assert.equal(L.bottomType,'weed');assert.ok(L.onBottom&&SIM.weedRate(L)>0);
  const a=SIM.actionAppeal('kasago',L);L.weeded=true;assert.ok(SIM.actionAppeal('kasago',L)<a*.2);assert.equal(SIM.weedRate(L),0);});

test('底の魚は好きな底質の上に現れやすい（AI）',()=>{let onRock=0,n=0;
  for(let s=1;s<=40;s++){const sch=AI.createSchool({cand:[['kasago',10]],activity:1,maxDist:40,depthAt:d=>SIM.waterDepth('honmoku',d,false),bottomAt:d=>SIM.bottomAt('honmoku',d,false),rng:mulberry(s),count:3});
    for(const f of sch.fish){n++;const b=SIM.bottomAt('honmoku',f.x,false);if(b==='rock'||b==='weed')onRock++;}}
  // 本牧で岩・海藻は0〜14mだけ（範囲の約3割）。好みで寄るので半分以上になる
  assert.ok(onRock/n>.5,`${onRock}/${n}`);});

test('曇り・雨・濁りは魚の警戒心を下げる',()=>{assert.ok(SIM.cautionMul({kind:'rain'},.7)<SIM.cautionMul({kind:'sunny'},.2));});
