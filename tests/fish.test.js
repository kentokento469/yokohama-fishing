// 魚種マスター（data/fish/species.json）と画像の出典、ファイトの型
const test=require('node:test');const assert=require('node:assert/strict');
const D=require('../data/fish/species.json');const IMG=require('../data/fish/images.js');const FG=require('../fight.js');const SIM=require('../fishing-sim.js');
const S=D.species;
test('100種以上・id は重複なし・既存36種のidを保つ',()=>{assert.ok(S.length>=100);assert.equal(new Set(S.map(s=>s.id)).size,S.length);
  for(const id of['aji','saba','seabass','kurodai','hirame','madako','aoriika','kasago','inada','warasa'])assert.ok(S.find(s=>s.id===id&&s.existing),id);});
test('依頼の魚種がそろっている',()=>{const ja=new Set(S.map(s=>s.ja));
  for(const n of['マアジ','マサバ','ゴマサバ','マイワシ','カタクチイワシ','コノシロ','ブリ','カンパチ','ヒラマサ','サワラ','タチウオ','カツオ','ヒラソウダ','ヒラスズキ','クロダイ','キビレ','マダイ','チダイ','ヘダイ','メジナ','クロメジナ','イシダイ','イシガキダイ',
    'カサゴ','メバル','クロソイ','ムラソイ','アイナメ','キジハタ','アカハタ','オオモンハタ','マハタ','クエ','ヒラメ','マゴチ','シロギス','ホウボウ','カワハギ','ウマヅラハギ','シログチ','ニベ','マアナゴ',
    'アユ','ヤマメ','イワナ','ニジマス','ウグイ','オイカワ','カワムツ','コイ','ギンブナ','ナマズ','ニホンウナギ','オオクチバス','アオリイカ','コウイカ','スルメイカ','マダコ'])assert.ok(ja.has(n),n);
  assert.ok(ja.has('シーバス'));});// スズキは既存の表示名「シーバス」
test('各魚種の個別データ（学名・生息・水深・季節・時間・潮・水温・釣り方・サイズ・重さ・速さ・警戒心・引き・ファイト・レア度）',()=>{
  for(const s of S){assert.ok(s.sci&&s.ja,s.id);assert.ok(Object.values(s.hab).some(v=>v>0),s.id);assert.ok(s.depth.length===2&&s.depth[1]>=s.depth[0],s.id);
    assert.ok(s.months.peak.some(Boolean),s.id);assert.ok(s.time&&s.tide,s.id);assert.ok(s.methods.length,s.id);assert.ok(s.size.min>0&&s.size.max>=s.size.min&&s.size.record>0,s.id);
    assert.ok(s.a>0&&s.speed>0&&s.wary>=0&&s.wary<=1&&s.power>0,s.id);assert.ok(FG.STYLE[s.fight],s.id+' fight');assert.ok(['common','uncommon','rare','very_rare','legendary'].includes(s.rarity),s.id);}});
test('イカ・タコ・エビは魚類と別の分類',()=>{for(const id of['aoriika','sumiika','madako','surumeika','iidako'])assert.equal(S.find(s=>s.id===id).cls,'cephalopod');assert.equal(S.find(s=>s.id==='tenagaebi').cls,'crustacean');});
test('珍しい魚は珍しい：クエは幻、カツオ・マハタはとても珍しい。淡水の魚は海の釣り場では釣れない',()=>{const g=id=>S.find(s=>s.id===id);
  assert.equal(g('kue').rarity,'legendary');assert.equal(g('katsuo').rarity,'very_rare');assert.equal(g('mahata').rarity,'very_rare');
  for(const id of['ayu','yamame','iwana','wakasagi'])assert.equal(g(id).catchable,false,id);});
test('重さ：体長から（g=a×cm³）がふつうの範囲（30cmのマアジ約300g、60cmのマダイ約3.7kg）',()=>{const w=(id,cm)=>{const s=S.find(q=>q.id===id);return s.a*cm**3;};
  assert.ok(Math.abs(w('aji',30)-297)<80);assert.ok(w('madai',60)>2500&&w('madai',60)<5000);});
test('写真の出典：画像がある魚種はすべて作者・ライセンス・元の場所・改変内容を持つ。NC・NDは使わない',()=>{for(const[id,m]of Object.entries(IMG)){assert.ok(m.artist&&m.license&&m.modified&&m.full&&m.thumb,id);assert.ok(!/\b(NC|ND)\b/i.test(m.license),id);}});
test('ファイトの型で引き方が変わる（走る青物は突っ込みが多い、重く粘るは引き続ける）',()=>{const run=(st)=>{let r=0;const rng=(()=>{let x=1;return()=>((x=x*16807%2147483647)/2147483647);})();
  const f=FG.createFight({P:2,d0:30,lineKg:8,liftKg:6,drag:3,style:st,id:'x',rng});for(let i=0;i<400;i++){FG.stepFight(f,.05,{hold:false});r+=f.surge;}return r;};assert.ok(run('run')>run('heavy'));});
