/* 横浜みなと釣り旅 — 釣具（ロッド・リール・ルアー・メタルジグ）の所持・装備・購入・適合（描画に依存しない。ブラウザでも Node でも動く）
   データは data/tackle-data.js（カタログ由来の架空の商品400件）。
   セーブには所持数 S.tk = {id: 個数}、装備中のルアー S.eq、ロッド S.rodId、リール S.reelId を持つ。 */
(function(root){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

const STYLE_LABEL={
  floating_minnow:'フローティングミノー',sinking_minnow:'シンキングミノー',shad:'シャッド',vibration:'バイブレーション',
  popper:'ポッパー',pencil:'ペンシル',crankbait:'クランク',spinner:'スピナー',soft_shad:'ワーム（ジグヘッド）',egi:'エギ',
  shore_standard:'ジグ・標準',shore_slim:'ジグ・スリム',slow_fall:'ジグ・スローフォール',long_cast:'ジグ・遠投',
  center_balance:'ジグ・センターバランス',rear_balance:'ジグ・リアバランス',front_balance:'ジグ・フロントバランス',
  leaf_flutter:'ジグ・リーフ',deep_speed:'ジグ・ディープ高速',micro_jig:'ジグ・マイクロ',
  ajing:'アジング',mebaring:'メバリング',trout:'トラウト',bass:'バス',seabass:'シーバス',eging:'エギング',
  shore_jig:'ショアジギング',offshore_jig:'オフショアジギング',rockfish:'ロックフィッシュ',surf:'サーフ',
  spinning_light:'ライトスピニング',spinning_general:'汎用スピニング',spinning_heavy:'大型スピニング',baitcasting:'ベイト',conventional:'両軸（オフショア）'};
const REELTYPE_LABEL={spinning:'スピニング',baitcast:'ベイト',conventional:'両軸'};
const POWER_LABEL={UL:'ウルトラライト',L:'ライト',ML:'ミディアムライト',M:'ミディアム',MH:'ミディアムヘビー',H:'ヘビー',XH:'エクストラヘビー'};
const BUOY_LABEL={floating:'フローティング',sinking:'シンキング',suspending:'サスペンド'};

/* ===== ロッドとリール =====
   ロッドの適合ルアー重量（minLureWeightG〜maxLureWeightG）を外れると、重量オーバーは投げられず、軽すぎは飛ばない。
   ロッドとリールの種類（reelType）が違うと釣りができない。 */
function rodFit(item,rod){if(!rod)return'ok';return item.weightG>rod.maxLureWeightG?'heavy':item.weightG<rod.minLureWeightG?'light':'ok';}
const FIT_LABEL={ok:'適正',heavy:'重量オーバー',light:'軽すぎ（飛距離が落ちる）'};
function reelMatch(rod,reel){return!!rod&&!!reel&&rod.reelType===reel.reelType;}
// ロッドが魚を浮かせる力（kg相当）：パワー表記と張り（backbone）から
const POWER_KG={UL:1.5,L:2.5,ML:3.5,M:5,MH:7,H:9,XH:12};
function rodLiftKg(rod){return(POWER_KG[rod.power]||5)*(.8+rod.backbone/250);}
// 糸の強さ（kg）：リールに巻いてあるPEの号数から（ゲーム上の目安：1号≒6.5kg）
function lineKg(reel){return Math.max(2,reel.capacityPeRating*6.5);}
// 巻く速さ：ハンドル1回転の巻き取り量 × 1秒に2.5回転 → ルアーを巻ける最高速（m/s）
function reelMaxSpeed(reel){return reel.retrieveCmPerTurn/100*2.5;}
/* 飛距離（m）：カタログ付属の参考式。ロッドの長さ・投げやすさ・ルアーの重さの合い具合・キャストのしやすさ */
function castMax(item,rod){if(!rod)return 0;if(rodFit(item,rod)==='heavy')return 0;
  const opt=Math.sqrt(rod.minLureWeightG*rod.maxLureWeightG),ratio=Math.max(.05,item.weightG)/Math.max(.05,opt);
  const match=Math.max(.45,1-Math.abs(Math.log(ratio))*.18),shore=rod.rodStyle==='offshore_jig'?.45:1;
  const base=23+rod.lengthM*13+item.castEfficiency*.34;const pe=rod.playerEffect||{};
  return clamp(base*match*(.75+rod.castingControl/320)*shore*(pe.castControlMultiplier||1),5,95);}
// サビキ・青イソメ（エサ釣り）の飛距離：仕掛けごとの基準 × 竿の長さ
function baitCast(base,rod){return base*(rod?.85+rod.lengthM*.08:1);}

/* 最初に持っている竿とリール、古いセーブ（竿の番号 S.rod 0〜3）の置き換え */
function firstOf(T,cat,style,lv){return T.find(t=>t.cat===cat&&t.style===style&&t.unlockedAtLevel===(lv||1));}
function starter(T){return{rod:firstOf(T,'rod','seabass'),reel:firstOf(T,'reel','spinning_light')};}
const OLD_ROD_MAP=[['seabass','spinning_light'],['rockfish','spinning_general'],['seabass','spinning_general',2],['shore_jig','spinning_heavy']];
function migrateGear(S,T){if(S.rodId&&S.reelId)return S;S.tk=S.tk||{};const st=starter(T);
  const give=t=>{if(t&&!S.tk[t.id])S.tk[t.id]=1;};give(st.rod);give(st.reel);
  const k=Math.max(0,Math.min(3,S.rod|0));const[rs,ls,lv]=OLD_ROD_MAP[k];const rod=firstOf(T,'rod',rs,lv)||st.rod,reel=firstOf(T,'reel',ls)||st.reel;
  give(rod);give(reel);S.rodId=rod.id;S.reelId=reel.id;return S;}
// 糸・リーダー・針（line.js の商品）は S.lineId / S.leaderId / S.hookId
const SLOT={rod:'rodId',reel:'reelId',line:'lineId',leader:'leaderId',hook:'hookId'};
function equip(S,item){S[SLOT[item.cat]||'eq']=item.id;}
function isEquipped(S,item){return S[SLOT[item.cat]||'eq']===item.id;}

/* プレイヤーのレベル：図鑑に登録した魚2種ごとに1上がる（カタログの購入レベル unlockedAtLevel に使う） */
function level(dexCount){return 1+Math.floor((dexCount|0)/2);}

function owned(S,id){return(S.tk&&S.tk[id])|0;}
/* 購入。qty 個まとめて買える。足りなければ理由を返し、何も変えない */
function buy(S,item,qty,lv){const gear=item.cat==='rod'||item.cat==='reel'||item.cat==='line';qty=gear?1:Math.max(1,qty|0);const cost=item.priceYen*qty;
  if(gear&&owned(S,item.id))return{ok:false,reason:'もう持っています'};
  if(lv<item.unlockedAtLevel)return{ok:false,reason:`Lv${item.unlockedAtLevel}から買えます`};
  if(S.money<cost)return{ok:false,reason:'お金が足りません'};
  S.money-=cost;S.tk=S.tk||{};S.tk[item.id]=owned(S,item.id)+qty*(item.pack||1);return{ok:true,cost};}
/* 根掛かり・糸切れで失う */
function lose(S,id,n){if(!S.tk||!S.tk[id])return 0;const k=Math.min(S.tk[id],Math.max(1,n|0));S.tk[id]-=k;if(!S.tk[id])delete S.tk[id];return k;}

/* 古いセーブ（汎用のメタルジグ S.lure 個・エギ S.egi 個）を、カタログの同等品に置き換える */
function migrate(S,TACKLE){if(S.tk)return S;S.tk={};
  const jig=TACKLE.filter(t=>t.style==='shore_standard').reduce((a,b)=>Math.abs(b.weightG-30)<Math.abs(a.weightG-30)?b:a);
  const egi=TACKLE.filter(t=>t.style==='egi'&&t.unlockedAtLevel===1)[0]||TACKLE.find(t=>t.style==='egi');
  if(S.lure>0)S.tk[jig.id]=S.lure;if(S.egi>0)S.tk[egi.id]=S.egi;
  if(S.bait==='lure'&&S.lure>0)S.eq=jig.id;else if(S.bait==='egi'&&S.egi>0)S.eq=egi.id;else if(S.bait==='lure'||S.bait==='egi')S.bait='sabiki';
  if(!S.eq)S.eq=S.tk[jig.id]?jig.id:S.tk[egi.id]?egi.id:null;
  S.lure=0;S.egi=0;return S;}

/* 一覧の絞り込みと並び替え。opt: {cat:'lure'|'jig'|'own', q:検索語, style:'', sort:'price'|'-price'|'weight'|'-weight'|'cast'|'level'} */
function search(TACKLE,S,opt){opt=opt||{};const q=(opt.q||'').trim().toLowerCase();
  let list=TACKLE.filter(t=>opt.cat==='own'?owned(S,t.id)>0:t.cat===opt.cat);
  if(opt.style)list=list.filter(t=>t.style===opt.style);
  if(q)list=list.filter(t=>(t.name+' '+(STYLE_LABEL[t.style]||'')+' '+(t.targetSpecies||[]).join(' ')+' '+(t.color||'')+' '+t.description).toLowerCase().includes(q));
  const key={price:t=>t.priceYen,weight:t=>t.weightG!=null?t.weightG:(t.rodWeightG||t.reelWeightG||0),cast:t=>-(t.castEfficiency||t.castingControl||0),drag:t=>-(t.maxDragKg||0),level:t=>t.unlockedAtLevel*1e5+t.priceYen}[(opt.sort||'level').replace('-','')]||(t=>t.unlockedAtLevel);
  const sign=(opt.sort||'').startsWith('-')?-1:1;
  return list.slice().sort((a,b)=>sign*(key(a)-key(b))||a.id.localeCompare(b.id));}

const API={STYLE_LABEL,BUOY_LABEL,REELTYPE_LABEL,POWER_LABEL,FIT_LABEL,POWER_KG,rodFit,reelMatch,rodLiftKg,lineKg,reelMaxSpeed,castMax,baitCast,starter,migrateGear,equip,isEquipped,level,owned,buy,lose,migrate,search};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaTackle=API;
})(typeof self!=='undefined'?self:this);
