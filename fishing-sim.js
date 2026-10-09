/* 横浜みなと釣り旅 — 水中の物理と環境（描画に依存しない。ブラウザでも Node でも動く）
   単位：距離・深さ m、時間 秒、速度 m/s、重さ g。深さは水面から下向きを正とする。
   段階1：釣り場の水深・底質、仕掛け／ルアーの深度と沈下、魚の泳層との一致度。 */
(function(root){
'use strict';

/* ===== 仕掛け・ルアーの性質（数値はここで調整する） =====
   kind: float=ウキでタナを保つ / sink=沈んで底まで行く
   sinkRate: 沈下の終端速度、tau: 終端速度に近づく時定数（水の抵抗が大きいほど小さい） */
const RIGS={
  sabiki:{n:'サビキ',kind:'float',tana:3,tau:.6},
  isome:{n:'青イソメ（天秤・オモリ15号）',kind:'sink',weight:56,sinkRate:1.6,tau:.35},
  lure:{n:'メタルジグ',kind:'sink',type:'metaljig',weight:30,size:9,buoyancy:'sinking',sinkRate:1.5,tau:.4,
    maxDiveDepth:null,retrieveSpeedRange:[.3,2.5],actionType:'jig',dragCoefficient:.6,color:'silver'},
  egi:{n:'エギ3.5号',kind:'sink',type:'egi',weight:20,size:10.5,buoyancy:'sinking',sinkRate:.32,tau:.5,
    maxDiveDepth:null,retrieveSpeedRange:[.2,1.2],actionType:'egi',dragCoefficient:1.1,color:'orange'}
};
const LURE_BAITS=['lure','egi'];
const isLureBait=b=>LURE_BAITS.includes(b);

/* ===== 釣り場ごとの水深と底質（ゲーム上の目安） =====
   d0: 足元の水深、dMax: 沖の水深、slope: 足元から沖の水深になるまでの距離（かけ上がりの幅）、bottom: 底質 */
const SPOT_ENV={
  suehiro:{d0:4,dMax:8,slope:25,bottom:'mud'},
  daikoku:{d0:10,dMax:14,slope:35,bottom:'mud'},
  honmoku:{d0:12,dMax:17,slope:40,bottom:'sand'},
  isogo:{d0:6,dMax:10,slope:35,bottom:'mud'},
  sugita:{d0:3,dMax:6,slope:30,bottom:'mud'},
  kanazawa:{d0:1.5,dMax:5,slope:60,bottom:'sand'}
};
const DEFAULT_ENV={d0:5,dMax:8,slope:30,bottom:'mud'};
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
// dist: 釣り座からの距離、tetra: テトラ帯の上か
function waterDepth(spotId,dist,tetra){const e=SPOT_ENV[spotId]||DEFAULT_ENV;
  const d=e.d0+(e.dMax-e.d0)*smooth(dist/e.slope);return tetra?Math.max(1,d*.75):d;}
function bottomType(spotId,tetra){return tetra?'rock':(SPOT_ENV[spotId]||DEFAULT_ENV).bottom;}
function envAt(spotId,dist,tetra){return{waterDepth:waterDepth(spotId,dist,tetra),bottomType:bottomType(spotId,tetra)};}

/* ===== 仕掛け・ルアーの状態と沈下 ===== */
function makeLure(bait,env){const r=RIGS[bait]||RIGS.isome;
  return{bait,kind:r.kind,depth:0,vy:0,onBottom:false,touched:false,bottomT:0,t:0,
    sinkRate:r.sinkRate||0,tau:r.tau||.5,tana:r.tana||0,waterDepth:env.waterDepth,bottomType:env.bottomType};}
// dt 秒だけ進める。終端速度へ指数関数で近づく運動を厳密に積分するので、フレームレートによらず同じ結果になる
function stepLure(L,dt){if(dt<=0)return L;L.t+=dt;const D=L.waterDepth;
  if(L.kind==='float'){const tg=Math.min(L.tana,Math.max(.3,D-.3));const k=Math.exp(-dt/L.tau);L.depth=tg+(L.depth-tg)*k;L.vy=0;return L;}
  if(L.onBottom){L.depth=D;L.vy=0;L.bottomT+=dt;return L;}
  const vt=L.sinkRate,k=Math.exp(-dt/L.tau),v0=L.vy;
  L.depth+=vt*dt+(v0-vt)*L.tau*(1-k);L.vy=vt+(v0-vt)*k;
  if(L.depth>=D){L.depth=D;L.vy=0;L.onBottom=true;L.touched=true;L.bottomT=0;}
  return L;}
function lureState(L){return L.kind==='float'?'tana':L.onBottom?'bottom':'fall';}

/* ===== 魚の泳層 =====
   top: 水面直下、upper: 上層、mid: 中層、lower: 下層〜底、bottom: 底べったり */
const LAYER={
  kataku:'upper',iwashi:'upper',konoshiro:'upper',sappa:'upper',aji:'mid',saba:'upper',sayori:'top',kamasu:'mid',
  inada:'upper',warasa:'mid',seabass:'mid',tachiuo:'mid',haze:'bottom',kisu:'bottom',ishimochi:'bottom',makogarei:'bottom',
  hirame:'lower',magochi:'bottom',kasago:'bottom',murasoi:'bottom',mebaru:'mid',ainame:'bottom',kurodai:'lower',mejina:'mid',
  umitanago:'mid',kawahagi:'bottom',bora:'upper',anago:'bottom',gonzui:'bottom',kusafugu:'lower',soushi:'mid',akaei:'bottom',
  sumiika:'bottom',aoriika:'mid',madako:'bottom'};
// 層の範囲 [浅い側, 深い側]（m）
function layerRange(layer,D){switch(layer){
  case'top':return[0,Math.min(1.5,D)];
  case'upper':return[0,Math.min(D,Math.max(3,D*.4))];
  case'mid':return[D*.2,D*.8];
  case'lower':return[D*.5,D];
  case'bottom':return[Math.max(0,D-1.2),D];
  default:return[0,D];}}
// ルアー深度と泳層の一致度（0〜1）。範囲内なら1、外れるほど指数的に下がる
function rangeMatch(id,depth,D){const[a,b]=layerRange(LAYER[id]||'mid',D);const out=depth<a?a-depth:depth>b?depth-b:0;
  return Math.exp(-out/(1.5+.15*D));}

/* ===== ルアーのアタリの起こりやすさ（1秒あたり） =====
   base: 釣り場・時間・潮から決まる基本の頻度、cand: [[id,重み],...]
   フォール中は魚の目を引く。底で止めたままにすると、時間とともに見向きされなくなる */
const TUNE={lureRateScale:1.4,restRate:.35,restDecay:12,snagRockPerSec:.05,minBiteTime:1};
function presentWeights(L,cand){const out=[];let sum=0;for(const[id,w]of cand){const m=rangeMatch(id,L.depth,L.waterDepth);const v=w*m;out.push([id,v]);sum+=v;}return{out,sum};}
function lureBiteRate(L,base,cand){let sumW=0;for(const[,w]of cand)sumW+=w;if(sumW<=0)return 0;
  const p=presentWeights(L,cand);let r=base*TUNE.lureRateScale*p.sum/sumW;
  if(L.onBottom)r*=TUNE.restRate*Math.exp(-L.bottomT/TUNE.restDecay);
  return r;}
function snagRate(L){return L.onBottom&&L.bottomType==='rock'?TUNE.snagRockPerSec:0;}

const API={RIGS,SPOT_ENV,LAYER,TUNE,isLureBait,waterDepth,bottomType,envAt,makeLure,stepLure,lureState,layerRange,rangeMatch,presentWeights,lureBiteRate,snagRate};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaSim=API;
})(typeof self!=='undefined'?self:this);
