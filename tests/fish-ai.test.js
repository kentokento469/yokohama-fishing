// 魚のAI（fish-ai.js）の動作テスト。乱数は種を固定して再現できるようにしている。実行：node --test tests/*.test.js
const test=require('node:test');const assert=require('node:assert/strict');
const SIM=require('../fishing-sim.js');const AI=require('../fish-ai.js');const TACKLE=require('../data/tackle-data.js');
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const item=st=>TACKLE.find(t=>t.style===st&&t.weightG>=8&&t.weightG<=30)||TACKLE.find(t=>t.style===st);
const DEPTH=12,depthAt=()=>DEPTH;

/* 1投を再現する。ctrl(t,L) が毎ステップ {hold,reel} を返し、必要ならジャーク等を行う */
function cast({id,style='shore_standard',seed=1,ctrl,secs=40,activity=1,light=1,fishAt}){
  const rng=mulberry(seed);const it=item(style);
  const L=SIM.makeLure(SIM.baitClassOf(it),{waterDepth:DEPTH,bottomType:'sand',depthAt},{dist:30,tipH:4,item:it});
  const s=AI.createSchool({cand:[[id,10]],activity,maxDist:30,depthAt,rng,sizeOf:()=>25,count:fishAt?1:4});
  if(fishAt)Object.assign(s.fish[0],fishAt);
  const out={bite:0,short:0,refuse:0,giveup:0,chase:0,events:[]};const dt=1/30;
  for(let t=0;t<secs;t+=dt){const c=ctrl(t,L)||{};SIM.stepLure(L,dt,c);if(L.home)break;
    for(const e of AI.stepSchool(s,L,dt,{light})){out[e.type]=(out[e.type]||0)+1;out.events.push(e);if(e.type==='bite'||e.type==='short')return out;}}
  return out;}
const many=(n,f)=>{const r={bite:0,short:0,any:0,refuse:0,giveup:0,chase:0};for(let i=1;i<=n;i++){const o=f(i);for(const k in r)r[k]+=o[k]||0;if(o.bite||o.short)r.any++;}return r;};

test('魚種ごとの性質：根魚は視界が狭く底から離れない、青物は速い',()=>{
  const k=AI.speciesParams('kasago'),s=AI.speciesParams('saba'),a=AI.speciesParams('aoriika');
  assert.ok(k.vision<s.vision&&k.burst<s.burst&&k.maxRise>0);assert.ok(a.fallOnly);});

test('視界の外のルアーには気づかない（遠い・深さが大きく違う）',()=>{
  // ルアーは水面近くを巻かれ、底のカサゴからは11m以上上：気づかない
  const r=cast({id:'kasago',seed:3,secs:8,ctrl:()=>({hold:true,reel:2}),fishAt:{x:30,y:0,z:11.8}});
  assert.equal(r.chase,0);assert.equal(r.bite+r.short,0);});

test('近くで魅力的に動かすと、気づいて寄り、追尾する',()=>{
  const r=many(20,i=>cast({id:'saba',seed:i,secs:15,ctrl:()=>({hold:true,reel:1.4}),fishAt:{x:24,y:0,z:1.5}}));
  assert.ok(r.chase>=12,`chase ${r.chase}/20`);});

test('魚の最高速より速く巻き続けると、追尾だけで見失う',()=>{
  // 中層のメジナ（最高速2.2m/s）の近くをゆっくり通して追わせてから、2.5m/sに上げる
  const r=many(20,i=>cast({id:'mejina',style:'floating_minnow',seed:i,secs:16,ctrl:(t,L)=>({hold:true,reel:t<6?.5:2.5}),fishAt:{x:28,y:0,z:.8,caution:.2,act:.5}}));
  assert.ok(r.giveup>0,`giveup ${r.giveup}`);});

test('アオリイカは巻き続けると抱かず、しゃくってフォールさせると抱く',()=>{
  const reel=many(30,i=>cast({id:'aoriika',style:'egi',seed:i,secs:25,ctrl:()=>({hold:true,reel:.8}),fishAt:{x:28,y:0,z:4}}));
  const jf=many(30,i=>cast({id:'aoriika',style:'egi',seed:i,secs:25,ctrl:(t,L)=>{if(t>3&&Math.floor(t*30)%(30*4)===0)SIM.jerk(L);return{hold:false};},fishAt:{x:28,y:0,z:4}}));
  assert.ok(jf.any>reel.any*2+2,`jerk-fall ${jf.any} vs reel ${reel.any}`);});

test('不自然な速さ（適正巻き速度の大幅超え）は見切られやすい',()=>{
  const it=item('floating_minnow');
  const nat=many(40,i=>cast({id:'seabass',style:'floating_minnow',seed:i,secs:20,ctrl:()=>({hold:true,reel:(it.optimalRetrieveMinMps+it.optimalRetrieveMaxMps)/2}),fishAt:{x:26,y:0,z:1}}));
  const un=many(40,i=>cast({id:'seabass',style:'floating_minnow',seed:i,secs:20,ctrl:()=>({hold:true,reel:Math.min(2.5,it.optimalRetrieveMaxMps*1.9)}),fishAt:{x:26,y:0,z:1,caution:.8}}));
  assert.ok(nat.any>un.any,`natural ${nat.any} vs unnatural ${un.any}`);});

test('必ず食うわけではない：追尾のうち見切り・見失い・ショートバイトも起こる',()=>{
  const r=many(60,i=>cast({id:'seabass',style:'floating_minnow',seed:i,secs:30,ctrl:(t,L)=>{if(Math.floor(t*30)%60===0)SIM.twitch(L);return{hold:true,reel:.8};},fishAt:{x:26,y:0,z:1}}));
  assert.ok(r.refuse>0,`refuse ${r.refuse}`);assert.ok(r.short>0,`short ${r.short}`);assert.ok(r.bite>0,`bite ${r.bite}`);});

test('活性が高いほど食いやすく、夜（暗い）だと気づかれにくい',()=>{
  const ctrl=(t,L)=>{if(Math.floor(t*30)%75===0)SIM.jerk(L);return{hold:true,reel:1.2};};
  const hi=many(40,i=>cast({id:'saba',seed:i,secs:20,activity:1.8,ctrl})),lo=many(40,i=>cast({id:'saba',seed:i,secs:20,activity:.3,ctrl}));
  assert.ok(hi.any>lo.any,`hi ${hi.any} lo ${lo.any}`);
  const day=many(40,i=>cast({id:'saba',seed:i,secs:20,ctrl,light:1})),night=many(40,i=>cast({id:'saba',seed:i,secs:20,ctrl,light:0}));
  assert.ok(day.chase>=night.chase,`day ${day.chase} night ${night.chase}`);});

test('ルアーが足元まで来ると、追ってきた魚は見切りやすい',()=>{
  const r=many(30,i=>cast({id:'seabass',style:'floating_minnow',seed:i,secs:40,ctrl:()=>({hold:true,reel:.7}),fishAt:{x:8,y:0,z:1,act:.4}}));
  const near=r.refuse;assert.ok(near>0,`refuse near feet ${near}`);});
