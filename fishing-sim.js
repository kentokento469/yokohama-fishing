/* 横浜みなと釣り旅 — 水中の物理と環境（描画に依存しない。ブラウザでも Node でも動く）
   単位：距離・深さ m、時間 秒、速度 m/s、重さ g。深さは水面から下向きを正とする。
   段階1：釣り場の水深・底質、仕掛け／ルアーの深度と沈下、魚の泳層との一致度。
   段階2：ロッド操作（巻き速度・ジャーク・トゥイッチ・フリーフォール・テンションフォール）とルアーの縦横の動き。 */
(function(root){
'use strict';

/* ===== 仕掛け・ルアーの性質（数値はここで調整する） =====
   kind: float=ウキでタナを保つ / sink=沈んで底まで行く
   sinkRate: 沈下の終端速度、tau: 終端速度に近づく時定数（水の抵抗が大きいほど小さい）
   lift: 巻いたときの浮き上がりやすさ（巻き速度1m/sあたりの上昇速度）、loadSink: 糸を張ったときの沈下の割合
   jerkUp/jerkPull: ジャーク1回で跳ね上がる速さ(m/s)と手前に寄る距離(m)、twitch*: トゥイッチの同じ値 */
const RIGS={
  sabiki:{n:'サビキ',kind:'float',tana:3,tau:.6},
  isome:{n:'青イソメ（天秤・オモリ15号）',kind:'sink',weight:56,sinkRate:1.6,tau:.35},
  lure:{n:'メタルジグ',kind:'sink',type:'metaljig',weight:30,size:9,buoyancy:'sinking',sinkRate:1.5,tau:.4,
    maxDiveDepth:null,retrieveSpeedRange:[.3,2.5],actionType:'jig',dragCoefficient:.6,color:'silver',
    lift:.3,loadSink:.4,jerkUp:6,jerkPull:.9,twitchUp:2,twitchPull:.3},
  egi:{n:'エギ3.5号',kind:'sink',type:'egi',weight:20,size:10.5,buoyancy:'sinking',sinkRate:.32,tau:.5,
    maxDiveDepth:null,retrieveSpeedRange:[.2,1.2],actionType:'egi',dragCoefficient:1.1,color:'orange',
    lift:.5,loadSink:.6,jerkUp:7,jerkPull:.7,twitchUp:2,twitchPull:.25}
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
function envAt(spotId,dist,tetra){return{waterDepth:waterDepth(spotId,dist,tetra),bottomType:bottomType(spotId,tetra),depthAt:d=>waterDepth(spotId,d,tetra)};}

/* ===== 仕掛け・ルアーの状態と動き =====
   深さ depth は水面から下向き、dist は釣り人（竿先の真下）からの水平距離。
   opt: {dist: 着水点までの距離, tipH: 水面から竿先までの高さ}
   env.depthAt(dist) があれば、ルアーが手前に寄るにつれて水深も変わる */
const IMPULSE_TAU=.22;
function makeLure(bait,env,opt){const r=RIGS[bait]||RIGS.isome;opt=opt||{};
  return{bait,kind:r.kind,rig:r,depth:0,vy:0,vh:0,iv:0,ih:0,side:0,vs:0,onBottom:false,touched:false,bottomT:0,t:0,
    dist:opt.dist||20,tipH:opt.tipH||4,home:false,sinceAction:99,lastAction:null,mode:'fall',reel:0,
    sinkRate:r.sinkRate||0,tau:r.tau||.5,tana:r.tana||0,depthAt:env.depthAt||null,waterDepth:env.waterDepth,bottomType:env.bottomType};}
// ロッド操作：ジャーク（大きくしゃくる）とトゥイッチ（小さく鋭く）
function jerk(L){if(L.kind!=='sink'||L.home)return;const r=L.rig;L.iv-=r.jerkUp;L.ih+=r.jerkPull/IMPULSE_TAU;L.vs+=(Math.random()<.5?-1:1)*1.6;L.onBottom=false;L.sinceAction=0;L.lastAction='jerk';}
function twitch(L){if(L.kind!=='sink'||L.home)return;const r=L.rig;L.iv-=r.twitchUp;L.ih+=r.twitchPull/IMPULSE_TAU;L.vs+=(Math.random()<.5?-1:1)*1.1;L.onBottom=false;L.sinceAction=0;L.lastAction='twitch';}
/* dt 秒だけ進める。ctrl: {hold: 押しているか, reel: 巻き速度 m/s}
   押していない＝糸を緩めたフリーフォール、押して速度0＝糸を張ったテンションフォール、押して速度あり＝巻き。
   速度は目標値へ指数関数で近づけ、1ステップ内は目標一定として厳密に積分する（フレームレートにほぼ依存しない） */
function stepLure(L,dt,ctrl){if(dt<=0)return L;L.t+=dt;L.sinceAction+=dt;
  if(L.depthAt)L.waterDepth=L.depthAt(L.dist);const D=L.waterDepth;
  if(L.kind==='float'){const tg=Math.min(L.tana,Math.max(.3,D-.3));const k=Math.exp(-dt/L.tau);L.depth=tg+(L.depth-tg)*k;L.vy=0;return L;}
  const r=L.rig,hold=!!(ctrl&&ctrl.hold),reel=hold?Math.max(0,ctrl.reel||0):0;L.reel=reel;
  // 竿先へ向かう糸の向き（ux: 手前向き成分、uy: 上向き成分）
  const len=Math.hypot(L.dist,L.depth+L.tipH)||1,ux=L.dist/len,uy=(L.depth+L.tipH)/len;
  let vyT,vhT;
  if(hold&&reel>0){vyT=L.sinkRate*(r.loadSink||.6)-reel*(uy+(r.lift||0));vhT=reel*ux;L.mode='retrieve';}
  else if(hold){vyT=L.sinkRate*(r.loadSink||.6);vhT=Math.max(0,vyT)*.6*ux;L.mode='tfall';}
  else{vyT=L.sinkRate;vhT=0;L.mode='fall';}
  if(L.sinceAction<.6)L.mode=L.lastAction;
  // ジャーク・トゥイッチの勢い（すぐ減衰する）
  const ki=Math.exp(-dt/IMPULSE_TAU);const ivAvg=L.iv*IMPULSE_TAU*(1-ki)/dt,ihAvg=L.ih*IMPULSE_TAU*(1-ki)/dt;L.iv*=ki;L.ih*=ki;
  if(L.onBottom){if(vyT+ivAvg<-.05)L.onBottom=false;else{L.depth=D;L.vy=0;L.vh=0;if(!hold||reel<.05)L.bottomT+=dt;L.dist=Math.max(0,L.dist-(vhT*.5)*dt);if(L.mode==='retrieve')L.mode='bottom';if(L.mode==='fall'||L.mode==='tfall')L.mode='bottom';sideStep(L,dt);homeCheck(L);return L;}}
  const k=Math.exp(-dt/L.tau);
  L.depth+=vyT*dt+(L.vy-vyT)*L.tau*(1-k)+ivAvg*dt;L.vy=vyT+(L.vy-vyT)*k;
  L.dist-=vhT*dt+(L.vh-vhT)*L.tau*(1-k)+ihAvg*dt;L.vh=vhT+(L.vh-vhT)*k;
  if(L.dist<0)L.dist=0;
  if(L.depth<=0){L.depth=0;if(L.vy<0)L.vy=0;}
  if(L.depth>=D){L.depth=D;L.vy=0;L.onBottom=true;L.touched=true;L.bottomT=0;L.mode='bottom';}
  sideStep(L,dt);homeCheck(L);return L;}
// 左右のブレ（ダート）。見た目と魚へのアピール用
function sideStep(L,dt){const k=Math.exp(-dt/.35);L.side+=L.vs*.35*(1-k);L.vs*=k;L.side*=Math.exp(-dt/2.5);}
// 足元まで巻き寄せたら回収できる
function homeCheck(L){if(L.dist<=1.5&&L.depth<3)L.home=true;}
function lureState(L){return L.kind==='float'?'tana':L.onBottom?'bottom':L.mode;}
// 1秒あたりの実際の移動の速さ（縦横の合成）
function lureSpeed(L){return Math.hypot(L.vy+L.iv,L.vh+L.ih);}

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

/* ===== ルアーの動きへの反応（段階4の魚AIで置き換え・拡張する） =====
   blue: 青物・回遊魚（速い動きとジャークに反応）、squid: イカ（しゃくった後のフォールに抱く）、
   bottom: 底の魚（底付近をゆっくり通ると反応）、general: それ以外 */
const BLUE=['kataku','iwashi','konoshiro','sappa','aji','saba','sayori','kamasu','inada','warasa','tachiuo'];
const SQUID=['sumiika','aoriika'];
function styleOf(id){if(BLUE.includes(id))return'blue';if(SQUID.includes(id))return'squid';const l=LAYER[id];return l==='bottom'||l==='lower'?'bottom':'general';}
function actionAppeal(id,L){if(L.kind==='float')return 1;const st=styleOf(id);const spd=L.vh+L.ih;
  const falling=!L.onBottom&&L.vy>.05;const react=falling&&L.sinceAction<2.5;const nearBottom=L.waterDepth-L.depth<1.5;
  switch(st){
    case'blue':{let a=.45+.75*Math.min(1,spd/1.5);if(L.sinceAction<1.5)a*=1.6;return a;}
    case'squid':return spd>.35?.25:react?2.6:falling?1.1:L.onBottom?.5:.7;
    case'bottom':{let a=nearBottom?(spd>1.2?.5:1.15):1;if(react)a*=1.3;return a;}
    default:{let a=.8+.3*Math.min(1,spd);if(react)a*=1.5;return a;}}}

/* ===== ルアーのアタリの起こりやすさ（1秒あたり） =====
   base: 釣り場・時間・潮から決まる基本の頻度、cand: [[id,重み],...]
   深さ（泳層との一致）× 動き（actionAppeal）で決まる。底で止めたままにすると時間とともに見向きされなくなる */
const TUNE={lureRateScale:1.4,restRate:.35,restDecay:12,snagRockPerSec:.05,snagDragMul:1.6,minBiteTime:1};
function presentWeights(L,cand){const out=[];let sum=0;for(const[id,w]of cand){const m=rangeMatch(id,L.depth,L.waterDepth)*actionAppeal(id,L);const v=w*m;out.push([id,v]);sum+=v;}return{out,sum};}
function lureBiteRate(L,base,cand){let sumW=0;for(const[,w]of cand)sumW+=w;if(sumW<=0)return 0;
  const p=presentWeights(L,cand);let r=base*TUNE.lureRateScale*p.sum/sumW;
  if(L.onBottom&&L.reel<.05)r*=TUNE.restRate*Math.exp(-L.bottomT/TUNE.restDecay);
  return r;}
// 根掛かり：岩の底に触れている間だけ。引きずると掛かりやすい
function snagRate(L){if(!(L.onBottom&&L.bottomType==='rock'))return 0;return TUNE.snagRockPerSec*(L.reel>.05?TUNE.snagDragMul:1);}

const API={RIGS,SPOT_ENV,LAYER,TUNE,isLureBait,waterDepth,bottomType,envAt,makeLure,stepLure,jerk,twitch,lureState,lureSpeed,styleOf,actionAppeal,layerRange,rangeMatch,presentWeights,lureBiteRate,snagRate};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaSim=API;
})(typeof self!=='undefined'?self:this);
