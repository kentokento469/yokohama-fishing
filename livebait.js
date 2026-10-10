/* 生き餌・泳がせ釣り（window.HamaLiveBait）。three.js・DOM に依存しない。
   ・釣った小魚（アジ・イワシなど、小さいもの）を生き餌として活かしておく（S.live＝[{id,cm,t,vit}]）。活かしバケツが要る、エアポンプで長持ち。
   ・元気（vit 0〜1）は時間・水温・入れすぎで落ち、0 になると死ぬ（取り除く）。
   ・泳がせ（餌の種類 'live'）で投げると1匹使う。アタリが無く回収したら弱って戻る。大きな魚（ヒラメ・青物・シーバス・アオリイカなど）が来やすい。
   ・餌と対象魚の相性（アジ→ヒラメ・アオリイカ・ブリ類、イワシ→シーバス・ブリ類 など）と元気でアタリの重みが変わる。
   ・釣り場の決まりで生き餌が使えない所を作れる（canUse(spot)：spot.noLive）。数値はゲーム用の目安。 */
(function(root){
'use strict';
// 生き餌にできる小魚と、生き餌にできる大きさの上限（cm）
const BAITFISH={aji:20,iwashi:20,kataku:13,konoshiro:18,sappa:18,saba:22,sayori:25,haze:15,ugui:15,oikawa:14,motsugo:9};
// 活かしの道具：バケツ（容量・匹）と、エアポンプ
const GEAR={live_bucket:{n:'活かしバケツ（8L）',cap:3,price:1800,kg:1.2},live_tank:{n:'活かしクーラー（20L・仕切り付き）',cap:8,price:6800,kg:3.5},air_pump:{n:'エアポンプ（電池式）',price:1500,kg:.3}};
// 狙える魚と、餌ごとの相性（1＝ふつう）
const TARGET={hirame:{aji:1.4,iwashi:1.2,kataku:1.1},magochi:{haze:1.4,aji:1.1,kataku:1.1},seabass:{iwashi:1.4,konoshiro:1.3,sappa:1.2,aji:1},inada:{iwashi:1.4,aji:1.2,kataku:1.2},warasa:{iwashi:1.3,aji:1.3,saba:1.1},buri:{aji:1.4,saba:1.3,iwashi:1.2},
  aoriika:{aji:1.5},kasago:{haze:1.2,aji:.9},mahata:{aji:1.2,saba:1.1},tachiuo:{iwashi:1.3,kataku:1.3},kanpachi:{aji:1.4,iwashi:1.2},hiramasa:{aji:1.3,saba:1.2},sawara:{iwashi:1.3,kataku:1.2},namazu:{motsugo:1.3,ugui:1.2},largemouth:{motsugo:1.3,ugui:1.1}};
const canBait=(id,cm)=>BAITFISH[id]!=null&&cm<=BAITFISH[id];
function capacity(S){const o=S.liveGear||{};return o.live_tank?GEAR.live_tank.cap:o.live_bucket?GEAR.live_bucket.cap:0;}
function add(S,id,cm,absMin){if(!canBait(id,cm))return{ok:false,reason:'生き餌にできるのは小さなアジ・イワシなど'};const cap=capacity(S);if(!cap)return{ok:false,reason:'活かしバケツが要る（釣具店）'};
  S.live=S.live||[];if(S.live.length>=cap)return{ok:false,reason:`活かしの容器がいっぱい（${cap}匹）`};S.live.push({id,cm:+cm.toFixed(1),t:absMin,vit:1});return{ok:true};}
// 元気の減り方（1時間あたり）：ポンプなし0.45・あり0.05、水温が高いと早い、入れすぎも早い
function decayPerHour(S,waterT){const pump=!!(S.liveGear&&S.liveGear.air_pump);let r=pump?.05:.45;if(waterT>24)r*=1.6;else if(waterT<12)r*=.8;const cap=capacity(S)||1,n=(S.live||[]).length;if(n>cap*.75)r*=1.3;return r;}
function tick(S,hours,waterT){if(!S.live||!S.live.length||hours<=0)return 0;const r=decayPerHour(S,waterT);let dead=0;for(const b of S.live)b.vit=Math.max(0,b.vit-r*hours);const before=S.live.length;S.live=S.live.filter(b=>b.vit>0);dead=before-S.live.length;return dead;}
// 投げる：一番元気な1匹を使う
function take(S){if(!S.live||!S.live.length)return null;let k=0;S.live.forEach((b,i)=>{if(b.vit>S.live[k].vit)k=i;});return S.live.splice(k,1)[0];}
// アタリが無く回収：弱って戻る（容器に空きがあれば）
function giveBack(S,b){if(!b)return;b.vit=Math.max(0,b.vit-.15);if(b.vit>0&&(S.live=S.live||[]).length<capacity(S))S.live.push(b);}
// 対象魚の重みの倍率（その餌・元気で）。対象でない魚は小さく
function weight(fishId,bait){const t=TARGET[fishId];if(!t)return .05;const m=t[bait.id]||.9;return m*(.4+.6*bait.vit);}
function canUse(spot){return!(spot&&spot.noLive);}
function migrate(S){if(!S.live)S.live=[];if(!S.liveGear)S.liveGear={};return S;}
const API={BAITFISH,GEAR,TARGET,canBait,capacity,add,decayPerHour,tick,take,giveBack,weight,canUse,migrate};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaLiveBait=API;
})(typeof self!=='undefined'?self:this);
