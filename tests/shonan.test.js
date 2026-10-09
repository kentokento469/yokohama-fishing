// 湘南エリアの釣り場データとルール（data/shonan-spots.js・shonan.js）の動作テスト。実行：node --test tests/*.test.js
const test=require('node:test');const assert=require('node:assert/strict');
const D=require('../data/shonan-spots.js');const SH=require('../shonan.js');
const sp=id=>SH.GSPOTS.find(s=>s.id===id);
const FIELDS=['id','name','municipality','area','type','bottomType','targetSpecies','fishingMethods','seasonalSpecies','accessStatus','accessHours','prohibitedMethods','hazards','notes','dataConfidence','sourceUrls'];

test('39か所・IDの重複なし・データモデルの項目がそろっている',()=>{
  assert.equal(D.SPOTS.length,39);assert.equal(new Set(D.SPOTS.map(s=>s.id)).size,39);
  for(const s of D.SPOTS){for(const f of FIELDS)assert.ok(f in s,`${s.id} に ${f} がない`);assert.ok(['beach','river','iso','port','breakwater'].includes(s.type));
    assert.equal(s.dataConfidence.position,'approx','位置は実測ではない');assert.equal(s.dataConfidence.game,'estimate','ゲーム用の数値は推定');}});

test('5地域・5種類がそろい、地理の並び（東の鎌倉→西の大磯）を保つ',()=>{
  assert.deepEqual([...new Set(D.SPOTS.map(s=>s.area))],['kamakura','fujisawa','chigasaki','hiratsuka','oiso']);
  const x=id=>sp(id).x;assert.ok(x('zaimokuza')>x('enoshima_ura')&&x('enoshima_ura')>x('southern')&&x('southern')>x('shinko_east')&&x('shinko_east')>x('kitahama'));});

test('魚種名はすべてゲームの魚に対応する',()=>{for(const s of D.SPOTS)for(const n of s.targetSpecies)assert.ok(SH.NAME2ID[n],`${s.id}: ${n}`);});

test('未確認・自然保護の場所は釣りできない（腰越漁港・湘南大堤防・照ヶ崎）',()=>{
  for(const id of['koshigoe_port','enoshima_bank','terugasaki']){const r=SH.canFish(sp(id),{month:10,hour:10,wave:.5});assert.equal(r.ok,false,id);assert.ok(r.reason);}});

test('平塚新港は7:00〜17:00、大磯港西防波堤は月ごとの時間',()=>{
  assert.equal(SH.canFish(sp('shinko_east'),{month:10,hour:6.5,wave:.5}).ok,false);assert.ok(SH.canFish(sp('shinko_east'),{month:10,hour:7.5,wave:.5}).ok);
  assert.equal(SH.canFish(sp('shinko_east'),{month:10,hour:17,wave:.5}).ok,false);
  const o=sp('oiso_west');assert.ok(SH.canFish(o,{month:6,hour:17.5,wave:.5,bait:'isome'}).ok,'5〜8月は18時まで');
  assert.equal(SH.canFish(o,{month:11,hour:16.5,wave:.5,bait:'isome'}).ok,false,'10〜1月は16時まで');
  assert.equal(SH.canFish(o,{month:3,hour:8,wave:.5,bait:'isome'}).ok,false,'8:30から');});

test('大磯港西防波堤ではルアー・コマセ（サビキ）が禁止',()=>{const o=sp('oiso_west');
  for(const b of['lure','worm','egi','sabiki'])assert.equal(SH.canFish(o,{month:10,hour:10,wave:.5,bait:b}).ok,false,b);
  assert.ok(SH.canFish(o,{month:10,hour:10,wave:.5,bait:'isome'}).ok);assert.equal(SH.methodFit(o,'lure'),0);});

test('夏（7・8月）の遊泳区域は9〜17時は釣りできず、早朝と夕方はできる',()=>{const y=sp('yuigahama');
  assert.equal(SH.canFish(y,{month:8,hour:12,wave:.5}).ok,false);assert.ok(SH.canFish(y,{month:8,hour:6,wave:.5}).ok);assert.ok(SH.canFish(y,{month:10,hour:12,wave:.5}).ok);
  assert.ok(SH.canFish(sp('shiomidai'),{month:8,hour:12,wave:.5}).ok,'遊泳区域でない海岸は関係ない');});

test('磯は高波だと立てない。一般海岸は注意を表示する',()=>{
  assert.equal(SH.canFish(sp('enoshima_ura'),{month:10,hour:10,wave:1.8}).ok,false);
  const r=SH.canFish(sp('enoshima_ura'),{month:10,hour:10,wave:1.1});assert.ok(r.ok&&/波/.test(r.warn));
  assert.match(SH.canFish(sp('tsujido'),{month:10,hour:10,wave:.5}).warn,/現地確認/);});

test('規制エリアの中は判定できる（茅ヶ崎漁港など）',()=>{const A=SH.GRESTRICTED.find(r=>r.id==='A');assert.equal(SH.restrictedAt(A.x,A.y).id,'A');
  assert.equal(SH.restrictedAt(sp('tsujido').x,sp('tsujido').y),null);
  for(const s of SH.GSPOTS.filter(s=>s.accessStatus!=='unverified'&&s.accessStatus!=='protected')){const r=SH.restrictedAt(s.x,s.y);assert.equal(r,null,`${s.id} が規制エリア ${r&&r.name} の中`);}});

test('釣り場は海岸の近く（陸・防波堤の上か、そのすぐそば）にある',()=>{for(const s of SH.GSPOTS){let near=false;for(let a=0;a<6.28;a+=.4)for(const r of[0,6,15,25]){const x=s.x+Math.cos(a)*r,y=s.y+Math.sin(a)*r;if(SH.isLand(x,y)||SH.structAt(x,y))near=true;}assert.ok(near,s.id);}});

test('波・川の流れ・濁り（ゲーム用）',()=>{const w={kind:'windy',wind:10},c={kind:'sunny',wind:2};
  assert.ok(SH.waveHeight(w,1.2)>SH.waveHeight(c,1.2)+1);assert.ok(SH.riverFlow(sp('sagami_e'),{kind:'rain',wind:2})>SH.riverFlow(sp('sagami_e'),c));
  assert.equal(SH.riverFlow(sp('tsujido'),c),0);assert.ok(SH.riverTurb(sp('sagami_e'),{kind:'rain'})>0);});
