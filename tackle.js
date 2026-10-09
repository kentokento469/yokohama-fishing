/* 横浜みなと釣り旅 — 釣具（ルアー・メタルジグ）の所持・装備・購入・適合（描画に依存しない。ブラウザでも Node でも動く）
   データは data/tackle-data.js（カタログ由来の架空の商品200件）。セーブには所持数 S.tk = {id: 個数} と装備中 S.eq を持つ。 */
(function(root){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

const STYLE_LABEL={
  floating_minnow:'フローティングミノー',sinking_minnow:'シンキングミノー',shad:'シャッド',vibration:'バイブレーション',
  popper:'ポッパー',pencil:'ペンシル',crankbait:'クランク',spinner:'スピナー',soft_shad:'ワーム（ジグヘッド）',egi:'エギ',
  shore_standard:'ジグ・標準',shore_slim:'ジグ・スリム',slow_fall:'ジグ・スローフォール',long_cast:'ジグ・遠投',
  center_balance:'ジグ・センターバランス',rear_balance:'ジグ・リアバランス',front_balance:'ジグ・フロントバランス',
  leaf_flutter:'ジグ・リーフ',deep_speed:'ジグ・ディープ高速',micro_jig:'ジグ・マイクロ'};
const BUOY_LABEL={floating:'フローティング',sinking:'シンキング',suspending:'サスペンド'};

/* 今の竿4本（index.html の RODS と同じ順）が投げられるルアーの重さ（g） */
const ROD_FIT=[[1,20],[3,30],[7,45],[20,100]];
function rodFit(item,rod){const[lo,hi]=ROD_FIT[clamp(rod|0,0,ROD_FIT.length-1)];return item.weightG>hi?'heavy':item.weightG<lo?'light':'ok';}
const FIT_LABEL={ok:'適正',heavy:'重量オーバー',light:'軽すぎ（飛距離が落ちる）'};

/* 飛距離（m）：投げやすさ（castEfficiency）と重さで決まり、竿が良いほど伸びる。軽すぎると落ち、重量オーバーは投げられない */
function castMax(item,rod){const fit=rodFit(item,rod);if(fit==='heavy')return 0;
  const base=clamp(16+item.castEfficiency*.42+Math.sqrt(item.weightG)*3.4,12,95);
  return base*(1+.08*rod)*(fit==='light'?.7:1);}

/* プレイヤーのレベル：図鑑に登録した魚2種ごとに1上がる（カタログの購入レベル unlockedAtLevel に使う） */
function level(dexCount){return 1+Math.floor((dexCount|0)/2);}

function owned(S,id){return(S.tk&&S.tk[id])|0;}
/* 購入。qty 個まとめて買える。足りなければ理由を返し、何も変えない */
function buy(S,item,qty,lv){qty=Math.max(1,qty|0);const cost=item.priceYen*qty;
  if(lv<item.unlockedAtLevel)return{ok:false,reason:`Lv${item.unlockedAtLevel}から買えます`};
  if(S.money<cost)return{ok:false,reason:'お金が足りません'};
  S.money-=cost;S.tk=S.tk||{};S.tk[item.id]=owned(S,item.id)+qty;return{ok:true,cost};}
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
  if(q)list=list.filter(t=>(t.name+' '+(STYLE_LABEL[t.style]||'')+' '+t.targetSpecies.join(' ')+' '+t.color+' '+t.description).toLowerCase().includes(q));
  const key={price:t=>t.priceYen,weight:t=>t.weightG,cast:t=>-t.castEfficiency,level:t=>t.unlockedAtLevel*1e5+t.priceYen}[(opt.sort||'level').replace('-','')]||(t=>t.unlockedAtLevel);
  const sign=(opt.sort||'').startsWith('-')?-1:1;
  return list.slice().sort((a,b)=>sign*(key(a)-key(b))||a.id.localeCompare(b.id));}

const API={STYLE_LABEL,BUOY_LABEL,ROD_FIT,FIT_LABEL,rodFit,castMax,level,owned,buy,lose,migrate,search};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaTackle=API;
})(typeof self!=='undefined'?self:this);
