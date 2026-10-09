/* 横浜みなと釣り旅 — 水中の物理と環境（描画に依存しない。ブラウザでも Node でも動く）
   単位：距離・深さ m、時間 秒、速度 m/s、重さ g。深さは水面から下向きを正とする。
   段階1：釣り場の水深・底質、仕掛け／ルアーの深度と沈下、魚の泳層との一致度。
   段階2：ロッド操作（巻き速度・ジャーク・トゥイッチ・フリーフォール・テンションフォール）とルアーの縦横の動き。
   段階3：ルアーの種類ごとの動き（浮く・止まる・リップで潜る・水面・ジグのフォール姿勢）と、カタログの性能値の反映。
   段階6：天気・水温・濁り・潮流（ドリフト）・海底の地形（砂地・泥底・岩・海藻帯・かけ上がり）。 */
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
const LURE_BAITS=['lure','egi','worm'];
const isLureBait=b=>LURE_BAITS.includes(b);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ===== カタログのルアー・ジグ（data/tackle-data.js）から動きの性質を作る =====
   move: sink=重さで沈む / lip=リップで潜る（止めると浮く・止まる・沈む） / top=水面
   dive: リップ付きが巻いて到達する深さ、rise: 止めたときの浮上速度、flutter: フォール中のヒラヒラ（0〜1） */
const LURE_CLASS={egi:'egi',soft_shad:'worm'};
function baitClassOf(item){return item.cat==='jig'?'lure':LURE_CLASS[item.style]||'lure';}
function rigFromItem(it){const w=it.weightG,light=clamp(1-w/60,0,1);
  const r={n:it.name,item:it,kind:'sink',move:'sink',type:it.style,weightG:w,sizeCm:it.lengthMm/10,buoyancy:it.buoyancy,actionType:it.actionType,
    sinkRate:it.sinkRateMps||0,tau:.3+.35*light,optMin:it.optimalRetrieveMinMps,optMax:it.optimalRetrieveMaxMps,
    rangeMin:it.minEffectiveDepthM,rangeMax:it.maxEffectiveDepthM,lift:.3,loadSink:.45,jerkUp:5,jerkPull:.8,twitchUp:1.8,twitchPull:.25,flutter:0,dive:null,rise:0};
  if(it.cat==='jig'){r.flutter=(it.fallFlutter||50)/100;r.jerkUp=3+(it.jerkResponse||50)/100*5;r.lift=.15+.25*light;r.loadSink=.4;return r;}
  switch(it.style){
    case'floating_minnow':case'crankbait':case'shad':case'sinking_minnow':
      r.move='lip';r.dive=it.maxEffectiveDepthM;r.rise=it.buoyancy==='floating'?.22:0;r.jerkUp=-.9;r.twitchUp=-.4;r.jerkPull=.6;r.twitchPull=.2;break;
    case'popper':case'pencil':r.move='top';r.jerkPull=.5;r.twitchPull=.2;break;
    case'vibration':r.lift=.45;r.jerkUp=4.5;break;
    case'spinner':r.lift=.8;r.jerkUp=3;break;
    case'soft_shad':r.lift=.35;r.jerkUp=4;r.twitchUp=1.5;break;
    case'egi':r.lift=.5;r.loadSink=.6;r.jerkUp=7;r.jerkPull=.7;r.twitchUp=2;break;}
  return r;}

/* ===== 釣り場ごとの水深と底質（ゲーム上の目安） =====
   d0: 足元の水深、dMax: 沖の水深、slope: 足元から沖の水深になるまでの距離（かけ上がりの幅）、bottom: 底質 */
/* 段階6で追加：bottoms = 足元からの距離ごとの底質 [[から(m), 底質]...]、turb = ふだんの濁り（0〜1）、cur = 潮の流れやすさ（大潮の最強時の流速 m/s） */
const SPOT_ENV={
  suehiro:{d0:4,dMax:8,slope:25,bottom:'mud',bottoms:[[0,'rock'],[3,'mud'],[30,'mud']],turb:.5,cur:.18},
  daikoku:{d0:10,dMax:14,slope:35,bottom:'mud',bottoms:[[0,'rock'],[5,'mud'],[25,'sand']],turb:.35,cur:.3},
  honmoku:{d0:12,dMax:17,slope:40,bottom:'sand',bottoms:[[0,'rock'],[5,'weed'],[14,'sand'],[45,'mud']],turb:.25,cur:.35},
  isogo:{d0:6,dMax:10,slope:35,bottom:'mud',bottoms:[[0,'rock'],[4,'mud'],[28,'sand']],turb:.4,cur:.25},
  sugita:{d0:3,dMax:6,slope:30,bottom:'mud',bottoms:[[0,'rock'],[6,'weed'],[16,'mud']],turb:.45,cur:.15},
  kanazawa:{d0:1.5,dMax:5,slope:60,bottom:'sand',bottoms:[[0,'sand'],[22,'weed'],[38,'sand']],turb:.2,cur:.2}
};
const DEFAULT_ENV={d0:5,dMax:8,slope:30,bottom:'mud'};
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
// dist: 釣り座からの距離、tetra: テトラ帯の上か
function waterDepth(spotId,dist,tetra){const e=SPOT_ENV[spotId]||DEFAULT_ENV;
  const d=e.d0+(e.dMax-e.d0)*smooth(dist/e.slope);return tetra?Math.max(1,d*.75):d;}
function bottomType(spotId,tetra){return tetra?'rock':(SPOT_ENV[spotId]||DEFAULT_ENV).bottom;}
// 距離ごとの底質。テトラ帯は岩
function bottomAt(spotId,dist,tetra){if(tetra)return'rock';const e=SPOT_ENV[spotId]||DEFAULT_ENV;if(!e.bottoms)return e.bottom;let b=e.bottoms[0][1];for(const[d,t]of e.bottoms)if(dist>=d)b=t;return b;}
// かけ上がり（足元から沖へ水深が急に変わる帯）にいるか
function onSlope(spotId,dist){const e=SPOT_ENV[spotId]||DEFAULT_ENV;return dist>e.slope*.15&&dist<e.slope*.85;}
/* cond: {current: 左右方向の潮の流れ m/s（正負で向き）} */
function envAt(spotId,dist,tetra,cond){cond=cond||{};return{waterDepth:waterDepth(spotId,dist,tetra),bottomType:bottomAt(spotId,dist,tetra),depthAt:d=>waterDepth(spotId,d,tetra),
  bottomAt:d=>bottomAt(spotId,d,tetra),current:cond.current||0,currentAlong:cond.currentAlong||0,snagMul:cond.snagMul||1};}

/* ===== 天気・水温・濁り・潮流・明るさ（段階6） ===== */
const WEATHER_LABEL={sunny:'晴れ',cloudy:'くもり',rain:'雨',windy:'強風'};
const hash2=(a,b)=>{let h=a*374761393+b*668265263;h=(h^(h>>13))*1274126177;return((h^(h>>16))>>>0)/4294967296;};
// 1日ごとの天気（日付から決まるので、同じ日は何度見ても同じ）。梅雨と秋雨は雨が多く、冬と春は風が強い日が多い
function weatherOf(day,month){const r=hash2(day,7),rain=[0,.12,.14,.2,.2,.22,.42,.25,.18,.32,.25,.15,.12][month],wind=[0,.2,.22,.25,.2,.12,.08,.06,.1,.1,.1,.15,.18][month];
  const kind=r<rain?'rain':r<rain+wind?'windy':r<rain+wind+.3?'cloudy':'sunny';
  const w=hash2(day,11),pr=hash2(day-1,7)<[0,.12,.14,.2,.2,.22,.42,.25,.18,.32,.25,.15,.12][month];
  return{kind,label:WEATHER_LABEL[kind],wind:kind==='windy'?7+w*5:1+w*4,rainPrev:pr};}
// 東京湾（横浜沿岸）の月ごとの表層水温の目安（℃）
const SST=[0,12,10.5,11.5,14,17.5,20.5,24,27,26,22.5,18.5,15];
function waterTemp(month,dayOfMonth,hour,w){const m2=dayOfMonth<15?(month+10)%12+1:month%12+1,k=Math.abs(dayOfMonth-15)/30;
  let t=SST[month]*(1-k)+SST[m2]*k+.4*Math.sin((hour-9)/24*6.283);if(w&&w.kind==='rain')t-=.6;return Math.round(t*10)/10;}
// 濁り（0〜1）：場所ごとのふだんの濁り＋雨（前日の雨も残る）＋強風
function turbidity(spotId,w){const e=SPOT_ENV[spotId]||DEFAULT_ENV;return clamp((e.turb||.35)+(w.kind==='rain'?.3:0)+(w.rainPrev?.2:0)+(w.wind>6?.1:0),0,1);}
// 潮流：潮が動いている（上げ・下げの途中）ほど速く、大潮ほど速い。上げ潮と下げ潮で向きが逆。tide: {s: 潮位の変化（-1〜1）, amp: 潮の大きさ}
function currentAt(spotId,tide,w){const e=SPOT_ENV[spotId]||DEFAULT_ENV;return(e.cur||.2)*tide.s*tide.amp+(w&&w.kind==='windy'?.04*Math.sign(tide.s||1):0);}
// 明るさ（0〜1）：昼夜（dark: 0=昼〜1=夜）と天気。水中で魚が見える距離は濁りでさらに縮む
function lightOf(dark,w){return(1-dark*.65)*({sunny:1,cloudy:.78,rain:.6,windy:.9}[w.kind]||1);}
function underwaterVis(light,turb){return light*(1-.6*turb);}

/* 魚ごとの適水温（℃）。外れるほど活性が落ちる（3℃で約1/3） */
const TEMP_PREF={kataku:[14,25],iwashi:[14,24],konoshiro:[12,27],sappa:[16,27],aji:[16,26],saba:[15,24],sayori:[10,20],kamasu:[17,26],inada:[16,25],warasa:[16,24],
  seabass:[12,26],tachiuo:[18,27],haze:[17,28],kisu:[18,28],ishimochi:[14,26],makogarei:[8,17],hirame:[12,22],magochi:[18,28],kasago:[10,24],murasoi:[12,24],
  mebaru:[8,18],ainame:[8,18],kurodai:[12,28],kibire:[14,30],mejina:[13,24],umitanago:[9,18],kawahagi:[15,26],bora:[12,28],anago:[14,25],gonzui:[18,28],kusafugu:[14,27],
  soushi:[20,28],akaei:[18,28],sumiika:[13,22],aoriika:[18,27],madako:[16,26]};
function tempFactor(id,T){const p=TEMP_PREF[id];if(!p)return 1;const out=T<p[0]?p[0]-T:T>p[1]?T-p[1]:0;return Math.max(.15,Math.exp(-out/2.7));}
/* 魚ごとの好む底質（底の魚だけ）。合っていれば多く、合わなければ少ない */
const BOTTOM_PREF={kibire:['sand','mud'],kasago:['rock','weed'],murasoi:['rock'],mebaru:['rock','weed'],ainame:['rock','weed'],kurodai:['rock','weed'],mejina:['rock','weed'],kawahagi:['rock','weed'],
  umitanago:['weed','rock'],hirame:['sand'],magochi:['sand'],kisu:['sand'],haze:['mud','sand'],makogarei:['mud','sand'],anago:['mud'],ishimochi:['mud','sand'],akaei:['mud','sand'],
  madako:['rock','sand'],sumiika:['sand','weed'],aoriika:['weed'],gonzui:['rock','weed']};
function bottomFactor(id,b){const p=BOTTOM_PREF[id];if(!p)return 1;return p[0]===b?1.5:p.includes(b)?1.15:.55;}
/* 天気・濁り・潮の動きによる魚の出やすさ（魚種の重みに掛ける）。曇りや雨、濁りは警戒心を下げ、シーバスやクロダイが動きやすい */
function weatherFactor(id,w,turb,cur){let a=1;const sb=id==='seabass'||id==='kurodai';
  if(w.kind==='rain'||w.kind==='cloudy')a*=sb?1.35:1;if(w.kind==='sunny'&&turb<.3)a*=sb?.8:1;
  if(sb)a*=1+Math.min(.6,Math.abs(cur)*2);return a;}
function cautionMul(w,turb){return clamp((w.kind==='sunny'?1.1:w.kind==='rain'?.82:.92)*(1.1-.35*turb),.6,1.2);}

/* ===== 仕掛け・ルアーの状態と動き =====
   深さ depth は水面から下向き、dist は釣り人（竿先の真下）からの水平距離。
   opt: {dist: 着水点までの距離, tipH: 水面から竿先までの高さ}
   env.depthAt(dist) があれば、ルアーが手前に寄るにつれて水深も変わる */
const IMPULSE_TAU=.22;
function makeLure(bait,env,opt){opt=opt||{};const r=opt.item?rigFromItem(opt.item):RIGS[bait]||Object.assign({move:'sink'},RIGS.isome);if(!r.move)r.move='sink';
  return{bait,kind:r.kind,rig:r,depth:0,vy:0,vh:0,iv:0,ih:0,side:0,vs:0,onBottom:false,touched:false,bottomT:0,t:0,
    dist:opt.dist||20,tipH:opt.tipH||4,home:false,sinceAction:99,lastAction:null,mode:'fall',reel:0,events:[],touchT:99,walkDir:1,
    sinkRate:r.sinkRate||0,tau:r.tau||.5,tana:r.tana||0,depthAt:env.depthAt||null,waterDepth:env.waterDepth,bottomType:env.bottomType,
    bottomAt:env.bottomAt||null,cur:env.current||0,curA:env.currentAlong||0,snagMul:env.snagMul||1,dside:0,drifting:false,weeded:false};}
// ロッド操作：ジャーク（大きくしゃくる）とトゥイッチ（小さく鋭く）
function jerk(L){if(L.kind!=='sink'||L.home)return;const r=L.rig;L.iv-=r.move==='top'?0:r.jerkUp;L.ih+=r.jerkPull/IMPULSE_TAU;
  if(r.move==='top'){L.walkDir=-L.walkDir;L.vs+=L.walkDir*2.2;L.events.push({type:r.type==='popper'?'pop':'splash',power:1});}else L.vs+=(Math.random()<.5?-1:1)*(r.move==='lip'?2.4:1.6);
  if(r.jerkUp>0)L.onBottom=false;L.sinceAction=0;L.lastAction='jerk';}
function twitch(L){if(L.kind!=='sink'||L.home)return;const r=L.rig;L.iv-=r.move==='top'?0:r.twitchUp;L.ih+=r.twitchPull/IMPULSE_TAU;
  if(r.move==='top'){L.walkDir=-L.walkDir;L.vs+=L.walkDir*1.5;L.events.push({type:r.type==='popper'?'pop':'walk',power:.6});}else L.vs+=(Math.random()<.5?-1:1)*(r.move==='lip'?1.8:1.1);
  if(r.twitchUp>0)L.onBottom=false;L.sinceAction=0;L.lastAction='twitch';}
/* dt 秒だけ進める。ctrl: {hold: 押しているか, reel: 巻き速度 m/s}
   押していない＝糸を緩めたフリーフォール、押して速度0＝糸を張ったテンションフォール、押して速度あり＝巻き。
   速度は目標値へ指数関数で近づけ、1ステップ内は目標一定として厳密に積分する（フレームレートにほぼ依存しない） */
function stepLure(L,dt,ctrl){if(dt<=0)return L;L.t+=dt;L.sinceAction+=dt;
  if(L.depthAt)L.waterDepth=L.depthAt(L.dist);if(L.bottomAt)L.bottomType=L.bottomAt(L.dist);const D=L.waterDepth;
  if(L.kind==='float'){const tg=Math.min(L.tana,Math.max(.3,D-.3));const k=Math.exp(-dt/L.tau);L.depth=tg+(L.depth-tg)*k;L.vy=0;return L;}
  const r=L.rig,hold=!!(ctrl&&ctrl.hold),reel=hold?Math.max(0,ctrl.reel||0):0;L.reel=reel;
  // 竿先へ向かう糸の向き（ux: 手前向き成分、uy: 上向き成分）
  const len=Math.hypot(L.dist,L.depth+L.tipH)||1,ux=L.dist/len,uy=(L.depth+L.tipH)/len;
  let vyT,vhT;
  if(r.move==='top'){vyT=0;vhT=hold?reel*ux:0;L.mode=hold&&reel>0?'retrieve':'float';}
  else if(r.move==='lip'){
    // リップ付き：巻くと速さに応じた深さまで潜る。止めると浮く（フローティング）・その場で止まる（サスペンド）・沈む（シンキング）
    if(hold&&reel>0){const tg=r.dive*clamp(reel/Math.max(.2,(r.optMin+r.optMax)/2),0,1.15);vyT=clamp((tg-L.depth)*1.6,-1.2,1.2);if(L.depth>tg&&L.sinkRate>0)vyT=Math.max(vyT,-.4);vhT=reel*ux;L.mode='retrieve';}
    else{vyT=r.rise>0?-r.rise:L.sinkRate;vhT=0;L.mode=r.rise>0?'rise':L.sinkRate>0?'fall':'suspend';}}
  else if(hold&&reel>0){vyT=L.sinkRate*(r.loadSink||.6)-reel*(uy+(r.lift||0));vhT=reel*ux;L.mode='retrieve';}
  else if(hold){vyT=L.sinkRate*(r.loadSink||.6);vhT=Math.max(0,vyT)*.6*ux;L.mode='tfall';}
  else{vyT=L.sinkRate;vhT=0;L.mode='fall';}
  /* 潮流（段階6）：糸を張って巻いていないほど、ルアーは流れに乗って横へ流される（ドリフト）。
     糸が流れに押されてふくらむので、沈むのも少し遅くなる。底にあるときはほとんど流されない */
  const cur=L.cur||0;L.drifting=false;
  // 沖向き・岸向きの流れ（河口の川の流れは沖へ、砂浜の寄せ波は岸へ）も、糸を緩めているほどルアーを運ぶ
  if(L.curA&&!L.home){const free=hold&&reel>0?Math.max(0,1-reel/.8)*.4:1;L.dist=Math.max(0,L.dist+L.curA*free*(L.onBottom?.1:1)*dt);}
  if(cur&&r.move!=='top'||cur&&!hold){const free=hold&&reel>0?Math.max(0,1-reel/.8)*.4:1;const ds=cur*free*(L.onBottom?.15:1)*dt;L.dside=clamp(L.dside+ds,-20,20);
    if(!hold&&!L.onBottom&&Math.abs(cur)>.1){L.drifting=true;}
    if((L.mode==='fall'||L.mode==='tfall')&&vyT>0)vyT*=1-Math.min(.35,Math.abs(cur)*.8);}
  // ジグのフォール：ヒラヒラ（flutter）が強いほど左右に揺れながら落ちる
  if(r.flutter&&!L.onBottom&&L.mode==='fall'&&L.depth>.3)L.vs+=Math.sin(L.t*7)*r.flutter*3*dt;
  if(L.sinceAction<.6)L.mode=L.lastAction;
  // ジャーク・トゥイッチの勢い（すぐ減衰する）
  const ki=Math.exp(-dt/IMPULSE_TAU);const ivAvg=L.iv*IMPULSE_TAU*(1-ki)/dt,ihAvg=L.ih*IMPULSE_TAU*(1-ki)/dt;L.iv*=ki;L.ih*=ki;
  if(L.onBottom){if(vyT+ivAvg<-.05)L.onBottom=false;else{L.depth=D;L.vy=0;L.vh=0;if(!hold||reel<.05)L.bottomT+=dt;L.dist=Math.max(0,L.dist-(vhT*.5)*dt);if(L.mode==='retrieve')L.mode='bottom';if(L.mode==='fall'||L.mode==='tfall')L.mode='bottom';sideStep(L,dt);homeCheck(L);return L;}}
  const k=Math.exp(-dt/L.tau);
  L.depth+=vyT*dt+(L.vy-vyT)*L.tau*(1-k)+ivAvg*dt;L.vy=vyT+(L.vy-vyT)*k;
  L.dist-=vhT*dt+(L.vh-vhT)*L.tau*(1-k)+ihAvg*dt;L.vh=vhT+(L.vh-vhT)*k;
  if(L.dist<0)L.dist=0;
  if(L.depth<=0){L.depth=0;if(L.vy<0)L.vy=0;}
  if(r.move==='top'){L.depth=0;L.vy=0;}
  L.touchT+=dt;
  if(L.depth>=D){L.depth=D;L.vy=0;L.onBottom=true;L.touched=true;L.bottomT=0;L.mode='bottom';L.touchT=0;L.events.push({type:'bottom',power:1,bottom:L.bottomType});}
  sideStep(L,dt);homeCheck(L);return L;}
// 左右のブレ（ダート）。見た目と魚へのアピール用
function sideStep(L,dt){const k=Math.exp(-dt/.35);L.side+=L.vs*.35*(1-k);L.vs*=k;L.side*=Math.exp(-dt/2.5);}
// 足元まで巻き寄せたら回収できる
function homeCheck(L){if(L.dist<=1.5&&L.depth<3)L.home=true;}
function lureState(L){return L.kind==='float'?'tana':L.onBottom?'bottom':L.drifting&&(L.mode==='fall'||L.mode==='rise'||L.mode==='suspend'||L.mode==='float')?'drift':L.mode;}
// 左右の位置（ダートのブレ＋潮で流された分）
function lateral(L){return(L.side||0)+(L.dside||0);}
// 1秒あたりの実際の移動の速さ（縦横の合成）
function lureSpeed(L){return Math.hypot(L.vy+L.iv,L.vh+L.ih);}

/* ===== 魚の泳層 =====
   top: 水面直下、upper: 上層、mid: 中層、lower: 下層〜底、bottom: 底べったり */
const LAYER={
  kataku:'upper',iwashi:'upper',konoshiro:'upper',sappa:'upper',aji:'mid',saba:'upper',sayori:'top',kamasu:'mid',
  inada:'upper',warasa:'mid',seabass:'mid',tachiuo:'mid',haze:'bottom',kisu:'bottom',ishimochi:'bottom',makogarei:'bottom',
  hirame:'lower',magochi:'bottom',kasago:'bottom',murasoi:'bottom',mebaru:'mid',ainame:'bottom',kurodai:'lower',kibire:'lower',mejina:'mid',
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
/* カタログの性能値による補正（どれも「確率を0にしない」係数）
   - 適正巻き速度（optimalRetrieve）の中ならナチュラル、外れると不自然で見切られやすい
   - 対象魚タグ（targetSpecies）は得意な魚に少し効く
   - サイズ：小魚は小さいルアー、大型魚は大きめのルアーを好む
   - フォール中のヒラヒラ（ジグの fallFlutter）、波動・フラッシュ（actionIntensity）、水面の音（ポッパー・ペンシル） */
const TAG_FISH={'ブリ':['inada','warasa'],'シーバス':['seabass'],'ヒラメ':['hirame','magochi'],'アジ':['aji'],'メバル':['mebaru'],'カサゴ':['kasago','murasoi','ainame'],'アオリイカ':['aoriika','sumiika'],'カマス':['kamasu']};
const SMALL_FISH=['kataku','iwashi','sappa','konoshiro','aji','mebaru','kasago','murasoi','sayori','haze','kisu','umitanago'];
const BIG_FISH=['seabass','inada','warasa','hirame','magochi','tachiuo','aoriika','kurodai'];
function gearAppeal(id,L){const r=L.rig;if(!r||!r.item)return 1;const it=r.item;let a=1;
  if(L.mode==='retrieve'){const v=L.reel;a*=v>=r.optMin&&v<=r.optMax?1.15:v<r.optMin*.6||v>r.optMax*1.5?.55:.8;}
  if(it.targetSpecies.some(t=>(TAG_FISH[t]||[]).includes(id)))a*=1.3;
  const cm=r.sizeCm;if(SMALL_FISH.includes(id))a*=cm<=7?1.2:cm>12?.6:1;else if(BIG_FISH.includes(id))a*=cm>=9?1.15:cm<5?.7:1;
  if(r.flutter&&L.mode==='fall'&&!L.onBottom)a*=1+.6*r.flutter;
  if(it.actionIntensity&&L.mode==='retrieve')a*=1+it.actionIntensity/300;
  if(r.move==='top'&&L.sinceAction<2)a*=styleOf(id)==='blue'||id==='seabass'?1.6:1.1;
  return a;}
function actionAppeal(id,L){if(L.kind==='float')return 1;let a=motionAppeal(id,L)*gearAppeal(id,L);
  // 海藻が付いたルアーは見向きされない。流れに乗せたドリフトはシーバスに効く
  if(L.weeded)a*=.1;if(L.drifting&&id==='seabass')a*=1.4;return a;}
function motionAppeal(id,L){const st=styleOf(id);const spd=L.vh+L.ih;
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
// 海藻帯の底に触れると海藻が掛かる（ルアーは失わないが、回収するまで魚は食わない）
function weedRate(L){return L.onBottom&&L.bottomType==='weed'&&!L.weeded?(L.reel>.05?.12:.05):0;}
function snagRate(L){if(!(L.onBottom&&L.bottomType==='rock'))return 0;return TUNE.snagRockPerSec*(L.reel>.05?TUNE.snagDragMul:1)*(L.snagMul||1);}

const API={bottomAt,onSlope,WEATHER_LABEL,weatherOf,SST,waterTemp,turbidity,currentAt,lightOf,underwaterVis,TEMP_PREF,tempFactor,BOTTOM_PREF,bottomFactor,weatherFactor,cautionMul,lateral,weedRate,rigFromItem,baitClassOf,gearAppeal,RIGS,SPOT_ENV,LAYER,TUNE,isLureBait,waterDepth,bottomType,envAt,makeLure,stepLure,jerk,twitch,lureState,lureSpeed,styleOf,actionAppeal,layerRange,rangeMatch,presentWeights,lureBiteRate,snagRate};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaSim=API;
})(typeof self!=='undefined'?self:this);
