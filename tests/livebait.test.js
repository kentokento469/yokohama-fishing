const test=require('node:test'),assert=require('node:assert');
const B=require('../livebait.js');
test('生き餌にできる魚と大きさ・容器が要る',()=>{const S=B.migrate({});assert.ok(!B.add(S,'aji',15,0).ok,'容器が無い');S.liveGear.live_bucket=1;assert.ok(B.add(S,'aji',15,0).ok);assert.ok(!B.add(S,'aji',30,0).ok,'大きすぎ');assert.ok(!B.add(S,'madai',10,0).ok,'生き餌にしない魚');});
test('容量まで',()=>{const S=B.migrate({liveGear:{live_bucket:1}});for(let i=0;i<3;i++)assert.ok(B.add(S,'iwashi',12,0).ok);assert.ok(!B.add(S,'iwashi',12,0).ok);});
test('元気：ポンプ無しは数時間で死ぬ、ポンプありは長持ち、水温が高いと早い',()=>{const a=B.migrate({liveGear:{live_bucket:1}});B.add(a,'aji',15,0);B.tick(a,3,20);assert.strictEqual(a.live.length,0);
  const b=B.migrate({liveGear:{live_bucket:1,air_pump:1}});B.add(b,'aji',15,0);B.tick(b,3,20);assert.ok(b.live[0].vit>.8);assert.ok(B.decayPerHour(b,27)>B.decayPerHour(b,20));});
test('投げると1匹使い、回収で弱って戻る',()=>{const S=B.migrate({liveGear:{live_bucket:1,air_pump:1}});B.add(S,'aji',15,0);const b=B.take(S);assert.ok(b&&S.live.length===0);B.giveBack(S,b);assert.strictEqual(S.live.length,1);assert.ok(S.live[0].vit<1);});
test('相性：アジの泳がせはヒラメ・アオリイカに強く、対象外の魚は小さい',()=>{const aji={id:'aji',vit:1};assert.ok(B.weight('aoriika',aji)>1.3);assert.ok(B.weight('hirame',aji)>1.3);assert.ok(B.weight('kisu',aji)<.1);assert.ok(B.weight('hirame',{id:'aji',vit:.2})<B.weight('hirame',aji));});
test('釣り場の決まり',()=>{assert.ok(B.canUse({}));assert.ok(!B.canUse({noLive:true}));});
