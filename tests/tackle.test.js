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

const rod=(style,lv=1)=>TACKLE.find(t=>t.cat==='rod'&&t.style===style&&t.unlockedAtLevel===lv);
const reel=(style,lv=1)=>TACKLE.find(t=>t.cat==='reel'&&t.style===style&&t.unlockedAtLevel===lv);

test('ロッドの適合重量：重量オーバーは投げられず、軽すぎは飛距離が落ちる',()=>{
  const sb=rod('seabass');const heavy=TACKLE.find(t=>t.weightG>sb.maxLureWeightG&&t.cat==='jig');
  assert.equal(TK.rodFit(heavy,sb),'heavy');assert.equal(TK.castMax(heavy,sb),0);
  const ok=TACKLE.find(t=>t.cat==='jig'&&t.weightG>=sb.minLureWeightG*2&&t.weightG<=sb.maxLureWeightG*.6);assert.equal(TK.rodFit(ok,sb),'ok');
  const tiny=TACKLE.find(t=>t.weightG<sb.minLureWeightG);assert.equal(TK.rodFit(tiny,sb),'light');
  assert.ok(TK.castMax(ok,sb)>TK.castMax(tiny,sb));});

test('飛距離：長いロッドほど飛び、ショアジギングロッドは重いジグを遠くへ',()=>{
  const j40=TACKLE.find(t=>t.cat==='jig'&&t.weightG===40);
  assert.ok(TK.castMax(j40,rod('shore_jig'))>TK.castMax(j40,rod('seabass')),'ショアジギングの方が飛ぶ');
  assert.equal(TK.castMax(j40,rod('ajing')),0,'アジングロッドで40gは投げられない');});

test('ロッドとリールの種類が違うと使えない',()=>{
  assert.ok(TK.reelMatch(rod('seabass'),reel('spinning_light')));
  assert.equal(TK.reelMatch(rod('offshore_jig'),reel('spinning_light')),false);
  assert.ok(TK.reelMatch(rod('offshore_jig'),reel('conventional')));});

test('リール：ハンドル1回転の巻き取り量が多いほど速く巻け、太い糸ほど強い',()=>{
  const lt=reel('spinning_light'),hv=reel('spinning_heavy');
  assert.ok(TK.reelMaxSpeed(hv)>TK.reelMaxSpeed(lt));assert.ok(TK.lineKg(hv)>TK.lineKg(lt));});

test('竿とリールは1本ずつしか買えない。装備の切り替え',()=>{
  const S={money:1e6,tk:{}};const r=rod('surf');assert.ok(TK.buy(S,r,3,1).ok);assert.equal(TK.owned(S,r.id),1);
  assert.equal(TK.buy(S,r,1,1).ok,false);TK.equip(S,r);assert.equal(S.rodId,r.id);assert.ok(TK.isEquipped(S,r));});

test('最初の竿とリール、古いセーブの竿の置き換え',()=>{
  const st=TK.starter(TACKLE);assert.ok(st.rod&&st.reel&&TK.reelMatch(st.rod,st.reel));
  for(let k=0;k<4;k++){const S={rod:k,tk:{}};TK.migrateGear(S,TACKLE);const rr=TACKLE.find(t=>t.id===S.rodId),rl=TACKLE.find(t=>t.id===S.reelId);
    assert.ok(rr&&rl&&TK.reelMatch(rr,rl),`old rod ${k}`);assert.equal(TK.owned(S,st.rod.id),1);}
  const S3={rod:3,tk:{}};TK.migrateGear(S3,TACKLE);assert.equal(TACKLE.find(t=>t.id===S3.rodId).style,'shore_jig');});

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
