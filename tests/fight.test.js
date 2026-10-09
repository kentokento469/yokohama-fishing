// フッキングとファイト（fight.js）の動作テスト。実行：node --test tests/*.test.js
const test=require('node:test');const assert=require('node:assert/strict');
const FG=require('../fight.js');
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* 1回のファイトを再現する。player：テンションが糸の強さの85%を超えたら0.4秒離す（「赤くなったら離す」）。careless：ずっと巻く */
const base={P:2.4,d0:35,lineKg:6.5,liftKg:5,reelK:1,flex:60,dragPrec:60,drag:2,capacityM:150,q:1,id:'seabass',wkg:1.5};
function fight(o,seed,policy='player',secs=120){const rng=mulberry(seed);const f=FG.createFight(Object.assign({},base,o,{rng}));let off=0;const dt=1/30;
  for(let t=0;t<secs;t+=dt){let hold=true;if(policy==='player'){if(off>0){off-=dt;hold=false;}else if(f.ten>f.lineKg*.85){off=.4;hold=false;}}
    for(const e of FG.stepFight(f,dt,{hold}))if(e.type!=='jump'&&e.type!=='net_fail')return{type:e.type,t,lineOut:f.lineOut};}
  return{type:'timeout',t:secs,lineOut:f.lineOut};}
const stats=(n,o,policy)=>{const r={};let tt=0,lo=0;for(let i=1;i<=n;i++){const x=fight(o,i,policy);r[x.type]=(r[x.type]||0)+1;if(x.type==='landed')tt+=x.t;lo+=x.lineOut;}r.avgT=tt/Math.max(1,r.landed||0);r.lineOut=lo/n;return r;};

test('ドラグを糸の強さ以上に締めて巻き続けると切れやすく、適正なら切れにくい',()=>{
  const tight=stats(40,{drag:7,P:5.5},'careless'),fit=stats(40,{drag:2,P:5.5},'careless');
  assert.ok((tight.break||0)>=(fit.break||0)+5,`tight ${tight.break} fit ${fit.break}`);});

test('ドラグが緩いと糸を出され、寄せるのに時間がかかる',()=>{
  const loose=stats(40,{drag:.8},'player'),fit=stats(40,{drag:2.2},'player');
  assert.ok(loose.lineOut>fit.lineOut*2,`line out loose ${loose.lineOut} fit ${fit.lineOut}`);
  assert.ok(!loose.landed||!fit.landed||loose.avgT>fit.avgT,`time loose ${loose.avgT} fit ${fit.avgT}`);});

test('赤くなったら離す操作で、締めたドラグでも切れにくくなる',()=>{
  const care=stats(40,{drag:7,P:5.5},'careless'),play=stats(40,{drag:7,P:5.5},'player');assert.ok((play.break||0)<(care.break||0));});

test('巻き取りの速いリールほど早く寄る',()=>{
  const slow=stats(30,{reelK:.6,P:1},'player'),fast=stats(30,{reelK:1.4,P:1},'player');assert.ok(fast.avgT<slow.avgT,`fast ${fast.avgT} slow ${slow.avgT}`);});

test('ドラグが滑らかでないと、同じ設定でもテンションが跳ねて切れやすい',()=>{
  const rough=stats(60,{drag:4.6,dragPrec:15,P:5.5},'careless'),smooth=stats(60,{drag:4.6,dragPrec:95,P:5.5},'careless');
  assert.ok((rough.break||0)>(smooth.break||0),`rough ${rough.break} smooth ${smooth.break}`);});

test('離しすぎると針が外れる',()=>{const f=FG.createFight(Object.assign({},base,{rng:mulberry(1)}));let r;for(let t=0;t<5&&!r;t+=1/30)r=FG.stepFight(f,1/30,{hold:false}).find(e=>e.type==='hookout');assert.ok(r);});

test('糸巻き量が少ないと、走られて糸が出切る',()=>{const r=stats(20,{capacityM:40,drag:.5,P:3},'careless');assert.ok((r.spooled||0)>0);});

test('元気な大物は足元でタモに入らない（タモが要る足場）',()=>{const f=FG.createFight(Object.assign({},base,{d0:.1,needNet:true,wkg:2,rng:mulberry(2)}));const ev=FG.stepFight(f,1/30,{hold:true});assert.ok(ev.some(e=>e.type==='net_fail'));assert.ok(f.dist>0);});

test('フッキング：窓の中ほどが一番掛かりやすく、早すぎ・遅すぎは掛かりにくい。ショートバイトは掛かりにくい',()=>{
  const p=t=>FG.hookSet({t,window:1,id:'seabass'}).p;assert.ok(p(.3)>p(.02));assert.ok(p(.3)>p(1));
  assert.ok(FG.hookSet({t:.3,window:1,id:'seabass',short:true}).p<p(.3)*.5);
  assert.ok(FG.hookSet({t:.3,window:1,id:'seabass',hookMul:1.1}).p>FG.hookSet({t:.3,window:1,id:'seabass',hookMul:.9}).p,'合わせの強いロッド');
  assert.ok(FG.hookSet({t:.3,window:1,id:'kurodai'}).p<p(.3),'クロダイは口が硬い');
  assert.ok(FG.hookSet({t:.3,window:1,id:'seabass',slack:true}).p<p(.3),'糸がたるんでいると掛かりにくい');});

test('針の掛かりが浅いほどバレやすい',()=>{const a=stats(40,{q:.2,drag:2.2}),b=stats(40,{q:1,drag:2.2});assert.ok((a.hookout||0)>(b.hookout||0));});

test('口の弱い魚を強引に巻くと口切れする',()=>{const r=stats(30,{id:'aji',P:.9,wkg:.2,drag:6},'careless');assert.ok((r.mouth||0)>0);});
