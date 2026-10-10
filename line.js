/* 糸（道糸 PE・ナイロン・フロロ）・リーダー・針（window.HamaLine）。描画にも DOM にも依存しない。ブラウザでも Node でも動く。
   商品は架空のブランド名で、種類×号数×長さから自動で作る（catalog。種類や号数を足せば100件以上に増やせる）。IDは種類と号数から決まるので変わらない。
   強さ・伸び・比重・擦れ・見えやすさ・太さはゲーム用の目安（実在の製品の値ではない）。
   ・道糸：リールに巻く。強さ（号数×種類ごとの係数）、伸び（ナイロン＞フロロ＞PE。伸びると合わせが遠くで効きにくいが衝撃に強い）、
     比重（フロロは沈む）、擦れ（磯・テトラで切れやすさ。PEは弱い）、見えやすさ（魚の警戒）、太さ（細いほど飛ぶ）。
   ・リーダー：道糸の先に結ぶ（フロロ・ナイロン）。魚に近いので見えやすさ・擦れはリーダーで決まる。結び目で少し弱くなる。1本ずつ使い、糸が切れると失う。
   ・針：エサ釣り（イソメ・サビキ以外の針・泳がせ）で、魚の大きさとの合い具合で掛かりが変わる。小さい針で大物は伸びる（maxKg）。
   セーブ：S.lineId（巻いてある道糸。null は昔からの「リールに付いているPE」）、S.leaderId、S.hookId。所持は S.tk（釣具と同じ）。 */
(function(root){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// 種類：1号あたりの強さ（kg）、伸び、比重（水に沈むほど大きい）、擦れに強い、見えやすさ、1号の太さ（mm）
const TYPES={
  pe:{n:'PE',kgPerGo:6.5,stretch:.04,sink:-.15,abr:.35,vis:.8,mm:.165},
  nylon:{n:'ナイロン',kgPerGo:1.8,stretch:.25,sink:.05,abr:.6,vis:.45,mm:.165},
  fluoro:{n:'フロロカーボン',kgPerGo:1.8,stretch:.15,sink:.35,abr:.9,vis:.15,mm:.165}};
const BRANDS=['潮騒','みなとライン','凪工房','白波','浜風'];
const LINE_SPEC=[['pe',[.4,.6,.8,1,1.2,1.5,2,3],[150,200]],['nylon',[1.5,2,2.5,3,4,5],[150]],['fluoro',[2,3,4],[100]]];
const LEADER_SPEC=[['fluoro',[1.5,2,3,4,5,6,8]],['nylon',[3,5,8]]];
// 針：型（名前・合う魚の大きさ cm・号数で大きく・伸びる重さ kg）
const HOOKS={sode:{n:'袖針',cm:[8,22],kg:1.5},maruseigo:{n:'丸セイゴ',cm:[12,40],kg:3},chinu:{n:'チヌ針',cm:[20,50],kg:4},iseama:{n:'伊勢尼',cm:[25,70],kg:7},oyogase:{n:'泳がせ孫針',cm:[35,100],kg:10}};
const HOOK_SIZES={sode:[3,5,7],maruseigo:[10,13,16],chinu:[1,3,5],iseama:[8,11,14],oyogase:[1,2,3]};
const goTxt=g=>String(g).replace(/^0\./,'0.');
const idGo=g=>String(g).replace('.','_');
function diameter(type,go){return+(TYPES[type].mm*Math.sqrt(go)).toFixed(3);}
// 道糸の値段：種類・号数・長さから（ゲームの値段）
function linePrice(type,go,m){const b=type==='pe'?2400:type==='fluoro'?1800:900;return Math.round((b+go*(type==='pe'?600:250))*(m/150)/10)*10;}
function catalog(){const out=[];let bi=0;
  for(const[type,gos,lens]of LINE_SPEC)for(const go of gos)for(const m of lens){const T=TYPES[type],br=BRANDS[(bi++)%BRANDS.length];
    out.push({id:`ln_${type}_${idGo(go)}_${m}`,cat:'line',type,go,lengthM:m,name:`${br} ${T.n} ${goTxt(go)}号 ${m}m`,kg:+(go*T.kgPerGo).toFixed(1),dMm:diameter(type,go),
      stretch:T.stretch,sink:T.sink,abr:T.abr,vis:T.vis,priceYen:linePrice(type,go,m),unlockedAtLevel:go>=3?3:go>=1.5?2:1,
      features:[type==='pe'?'細くて強く、よく飛ぶ・感度が良い':type==='nylon'?'よく伸びて衝撃に強い・扱いやすい':'沈みやすく、擦れに強い・見えにくい'],tradeoff:type==='pe'?'擦れに弱く、魚から見えやすい（リーダーを結ぶと良い）':type==='nylon'?'伸びるので遠くで合わせが効きにくい':'硬めで太く、PEより飛ばない',
      description:`${T.n}の道糸。強さ約${(go*T.kgPerGo).toFixed(1)}kg・太さ${diameter(type,go)}mm（目安）`});}
  for(const[type,gos]of LEADER_SPEC)for(const go of gos){const T=TYPES[type],br=BRANDS[(bi++)%BRANDS.length];
    out.push({id:`ld_${type}_${idGo(go)}`,cat:'leader',type,go,name:`${br} ${T.n}リーダー ${goTxt(go)}号（10本分）`,pack:10,kg:+(go*T.kgPerGo).toFixed(1),dMm:diameter(type,go),
      abr:T.abr,vis:T.vis,stretch:T.stretch,features:['魚に近い所の糸を見えにくく・擦れに強くする'],tradeoff:'結び目で強さが1割落ちる。糸が切れると1本失う',priceYen:Math.round((600+go*120)/10)*10,unlockedAtLevel:go>=6?3:1,description:`道糸の先に結ぶ${T.n}。魚から見えにくく、擦れに${T.abr>.7?'強い':'ふつう'}（目安）`});}
  for(const st in HOOKS){const H=HOOKS[st],sz=HOOK_SIZES[st];sz.forEach((s,i)=>{const k=sz.length>1?i/(sz.length-1):.5,lo=H.cm[0]+(H.cm[1]-H.cm[0])*k*.6,hi=lo+(H.cm[1]-H.cm[0])*.45;
    out.push({id:`hk_${st}_${s}`,cat:'hook',style:st,size:s,name:`${BRANDS[(bi++)%BRANDS.length]} ${H.n} ${s}号（10本）`,pack:10,fitCm:[Math.round(lo),Math.round(hi)],maxKg:+(H.kg*(.8+k*.5)).toFixed(1),features:['合う大きさの魚によく掛かる'],tradeoff:'小さすぎる魚は掛かりにくく、重すぎる魚では伸びる。根掛かり・糸切れで1本失う',
      priceYen:Math.round((300+H.kg*40+i*40)/10)*10,unlockedAtLevel:st==='oyogase'||st==='iseama'?2:1,description:`エサ釣り・泳がせの針。合う魚の大きさ ${Math.round(lo)}〜${Math.round(hi)}cm（目安）`});});}
  return out;}
const CAT=catalog(),BYID=new Map(CAT.map(t=>[t.id,t]));
// 道糸：巻いてあるもの。なければリール付属のPE（昔からの強さ：PE号数×6.5kg）
function mainLine(S,reel){const it=S&&S.lineId&&BYID.get(S.lineId);if(it)return it;const go=reel&&reel.capacityPeRating||1;
  return{id:null,cat:'line',type:'pe',go,name:`付属のPE ${go}号`,kg:Math.max(2,go*6.5),dMm:diameter('pe',go),stretch:TYPES.pe.stretch,sink:TYPES.pe.sink,abr:TYPES.pe.abr,vis:TYPES.pe.vis,stock:true};}
function leaderOf(S){const it=S&&S.leaderId&&BYID.get(S.leaderId);return it&&S.tk&&S.tk[it.id]>0?it:null;}
function hookOf(S){const it=S&&S.hookId&&BYID.get(S.hookId);return it&&S.tk&&S.tk[it.id]>0?it:null;}
// 仕掛け全体の強さ（kg）：道糸とリーダーの弱い方。リーダーがあると結び目で9割。rough（磯・テトラ・岩）では擦れに弱い糸が切れやすい
function strength(S,reel,rough){const m=mainLine(S,reel),ld=leaderOf(S);let kg=ld?Math.min(m.kg,ld.kg)*.9:m.kg;
  if(rough){const a=ld?ld.abr:m.abr;kg*=.7+.3*a;}return Math.max(1,+kg.toFixed(2));}
// 魚から見える糸（リーダーがあればリーダー）：警戒心の強い魚ほど食いが落ちる（0.65〜1）
function biteMul(S,reel,wary){const m=mainLine(S,reel),ld=leaderOf(S),vis=ld?ld.vis:m.vis;return clamp(1-(wary||0)*vis*.45,.65,1);}
// 飛距離の倍率：細いほど飛ぶ（1号相当の太さ0.165mm で1）
function castMul(S,reel){const m=mainLine(S,reel);return clamp(1.04-(m.dMm-.165)*.9,.82,1.1);}
// 合わせの効き：伸びる糸ほど遠くで掛かりにくい（距離 m）
function hookMul(S,reel,dist){const m=mainLine(S,reel);return clamp(1-m.stretch*Math.max(0,dist-15)/60,.8,1);}
// 沈みやすさ（エサ・ルアーの沈下の倍率）
function sinkMul(S,reel){const m=mainLine(S,reel);return 1+m.sink*.25;}
// 針と魚の合い具合（掛かりの倍率）と、伸びる重さ。針が無ければ「ふつうの針」
function hookFit(h,fishCm){if(!h)return 1;const[a,b]=h.fitCm;if(fishCm<a)return clamp(1-(a-fishCm)/a*1.6,.3,1);if(fishCm>b)return clamp(1-(fishCm-b)/b*.8,.55,1);return 1.08;}
function hookKg(h){return h?h.maxKg:Infinity;}
function equip(S,it){if(it.cat==='line')S.lineId=it.id;else if(it.cat==='leader')S.leaderId=it.id;else if(it.cat==='hook')S.hookId=it.id;}
function isEquipped(S,it){return it.cat==='line'?S.lineId===it.id:it.cat==='leader'?S.leaderId===it.id:it.cat==='hook'?S.hookId===it.id:false;}
// 糸が切れた・根掛かり：リーダーと針を1本ずつ失う（無くなれば外す）
function loseRig(S,bait){const lost=[];for(const k of['leaderId','hookId']){const id=S[k];if(!id||!S.tk||!S.tk[id])continue;if(k==='hookId'&&!(bait==='isome'||bait==='live'))continue;
    S.tk[id]--;lost.push(BYID.get(id).name.replace(/（.*）/,''));if(!S.tk[id]){delete S.tk[id];S[k]=null;}}return lost;}
function migrate(S){if(S.lineId===undefined)S.lineId=null;if(S.leaderId===undefined)S.leaderId=null;if(S.hookId===undefined)S.hookId=null;return S;}
const API={TYPES,HOOKS,CAT,BYID,catalog,diameter,mainLine,leaderOf,hookOf,strength,biteMul,castMul,hookMul,sinkMul,hookFit,hookKg,equip,isEquipped,loseRig,migrate};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaLine=API;
})(typeof self!=='undefined'?self:this);
