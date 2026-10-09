// 釣具の所持・購入・装備・適合（tackle.js）の動作テスト。実行：node --test tests/*.test.js
const test=require('node:test');const assert=require('node:assert/strict');
const TK=require('../tackle.js');const TACKLE=require('../data/tackle-data.js');
const byId=id=>TACKLE.find(t=>t.id===id);

test('購入：残高が減り所持数が増える。お金やレベルが足りなければ何も変わらない',()=>{
  const S={money:3000,tk:{}};const it=TACKLE.find(t=>t.unlockedAtLevel===1&&t.priceYen<1000);
  assert.ok(TK.buy(S,it,2,1).ok);assert.equal(S.money,3000-it.priceYen*2);assert.equal(TK.owned(S,it.id),2);
  const poor={money:10,tk:{}};assert.equal(TK.buy(poor,it,1,1).ok,false);assert.equal(poor.money,10);assert.equal(TK.owned(poor,it.id),0);
  const hi=TACKLE.find(t=>t.unlockedAtLevel>=10);const rich={money:1e6,tk:{}};const r=TK.buy(rich,hi,1,1);assert.equal(r.ok,false);assert.match(r.reason,/Lv/);assert.equal(rich.money,1e6);});

test('ロスト：指定数だけ減り、0になると所持から消える',()=>{
  const S={tk:{'JIG-001':2}};assert.equal(TK.lose(S,'JIG-001',1),1);assert.equal(TK.owned(S,'JIG-001'),1);TK.lose(S,'JIG-001',5);assert.equal(S.tk['JIG-001'],undefined);});

test('セーブ：JSONにして戻しても所持・装備が残る',()=>{
  const S={money:5000,tk:{},eq:null};const it=TACKLE[0];TK.buy(S,it,3,1);S.eq=it.id;const R=JSON.parse(JSON.stringify(S));
  assert.equal(TK.owned(R,it.id),3);assert.equal(R.eq,it.id);});

test('竿の適合：重量オーバーは投げられず、軽すぎは飛距離が落ちる',()=>{
  const heavy=TACKLE.find(t=>t.weightG>100);assert.equal(TK.rodFit(heavy,3),'heavy');assert.equal(TK.castMax(heavy,3),0);
  const j40=TACKLE.find(t=>t.cat==='jig'&&t.weightG===40);assert.equal(TK.rodFit(j40,0),'heavy');assert.equal(TK.rodFit(j40,2),'ok');
  const tiny=TACKLE.find(t=>t.weightG<3);assert.equal(TK.rodFit(tiny,3),'light');
  const ok=TACKLE.find(t=>t.weightG>=20&&t.weightG<=30);assert.ok(TK.castMax(ok,3)>TK.castMax(ok,1),'良い竿ほど飛ぶ');});

test('飛距離：重く投げやすいルアーほど遠くへ（同じ竿）',()=>{
  const a=TACKLE.find(t=>t.style==='long_cast'&&t.weightG<=40&&t.weightG>=30),b=TACKLE.find(t=>t.style==='popper'&&t.weightG<=8);
  assert.ok(TK.castMax(a,3)>TK.castMax(b,1));});

test('レベル：図鑑2種ごとに1上がる',()=>{assert.equal(TK.level(0),1);assert.equal(TK.level(3),2);assert.equal(TK.level(35),18);});

test('古いセーブの移行：汎用ジグ・エギの所持数がカタログ品に置き換わる',()=>{
  const S={money:0,bait:'egi',lure:3,egi:2};TK.migrate(S,TACKLE);
  const ids=Object.keys(S.tk);assert.equal(ids.length,2);assert.equal(S.lure,0);assert.equal(S.egi,0);assert.equal(byId(S.eq).style,'egi');
  const sum=Object.values(S.tk).reduce((a,b)=>a+b,0);assert.equal(sum,5);
  const N={money:0,bait:'lure',lure:0,egi:0};TK.migrate(N,TACKLE);assert.equal(N.bait,'sabiki');assert.equal(N.eq,null);
  const twice=TK.migrate(S,TACKLE);assert.equal(twice,S);});

test('検索・絞り込み・並び替え',()=>{
  const S={tk:{}};const lures=TK.search(TACKLE,S,{cat:'lure'});assert.equal(lures.length,100);
  const egi=TK.search(TACKLE,S,{cat:'lure',style:'egi'});assert.equal(egi.length,10);
  const sb=TK.search(TACKLE,S,{cat:'lure',q:'シーバス'});assert.ok(sb.length>0&&sb.every(t=>t.targetSpecies.includes('シーバス')||t.description.includes('シーバス')||t.name.includes('シーバス')));
  const cheap=TK.search(TACKLE,S,{cat:'jig',sort:'price'});assert.ok(cheap[0].priceYen<=cheap[99].priceYen);
  const exp=TK.search(TACKLE,S,{cat:'jig',sort:'-price'});assert.ok(exp[0].priceYen>=exp[99].priceYen);
  S.tk[cheap[0].id]=1;assert.equal(TK.search(TACKLE,S,{cat:'own'}).length,1);});
