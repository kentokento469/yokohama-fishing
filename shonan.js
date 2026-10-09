/* 横浜みなと釣り旅 — 湘南エリアの釣り場ルールと地理（描画に依存しない。ブラウザでも Node でも動く）
   データ：data/shonan-spots.js（window.HamaShonanData）。
   ・緯度経度（おおよそ）→ ゲームの座標：等倍（実際のメートル。geo.js）で、横浜マップの南側（y=8300〜）に置く。
   ・釣り場の種類ごとのゲーム用推定値（水深・底質・濁り・流れ・波当たり）。実測ではない。
   ・釣りできるかの判定：開放区分、利用時間、夏の遊泳区域、高波、禁止された釣り方、規制エリア。 */
(function(root){
'use strict';
const DATA=root&&root.HamaShonanData||(typeof require==='function'?require('./data/shonan-spots.js'):null);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ===== 位置：緯度経度 → ゲーム座標（m、距離は約1/3） ===== */
// 変換は共通の座標システム geo.js（原点・向き・縮尺はそこで固定）
const GEO=root&&root.HamaGeo||(typeof require==='function'?require('./geo.js'):null);
const R0=GEO.SHONAN,SC=R0.sc,M_LON=R0.mLon,M_LAT=R0.mLat;
function toGame(lat,lon){return GEO.toGame(lat,lon,R0);}
const BOUNDS=R0.bounds;
function inShonan(x,y){return x>=BOUNDS.x0&&x<=BOUNDS.x1&&y>=BOUNDS.y0-100&&y<=BOUNDS.y1;}

/* 海岸線（西→東、おおよその緯度経度）。陸は北側 */
const COAST_LL=[[35.2935,139.2850],[35.2960,139.2950],[35.2985,139.3050],[35.3000,139.3120],[35.3010,139.3160],[35.3005,139.3190],[35.2992,139.3215],[35.3010,139.3240],
  [35.3030,139.3280],[35.3060,139.3360],[35.3090,139.3430],[35.3110,139.3490],[35.3130,139.3550],[35.3150,139.3620],[35.3165,139.3660],[35.3175,139.3700],[35.3172,139.3800],
  [35.3150,139.3950],[35.3155,139.4010],[35.3162,139.4050],[35.3180,139.4100],[35.3192,139.4140],[35.3213,139.4230],[35.3225,139.4300],[35.3220,139.4450],[35.3180,139.4600],
  [35.3162,139.4660],[35.3118,139.4750],[35.3085,139.4790],[35.3072,139.4810],[35.3075,139.4840],[35.3085,139.4872],[35.3080,139.4900],[35.3060,139.4920],[35.3060,139.5000],
  [35.3045,139.5080],[35.3025,139.5170],[35.3010,139.5220],[35.2992,139.5240],[35.3020,139.5270],[35.3072,139.5310],[35.3090,139.5360],[35.3095,139.5400],[35.3075,139.5480],
  [35.3040,139.5530],[35.2995,139.5560],[35.2975,139.5600]];
const COAST=COAST_LL.map(([a,o])=>toGame(a,o));
// 陸：海岸線と北の境界で囲む
const LAND=[...COAST,[COAST[COAST.length-1][0],BOUNDS.y0],[COAST[0][0],BOUNDS.y0]];
// 江の島（おおよそ）と弁天橋
const ENOSHIMA=[[35.3020,139.4745],[35.3022,139.4790],[35.3015,139.4835],[35.3000,139.4860],[35.2982,139.4850],[35.2970,139.4810],[35.2968,139.4760],[35.2985,139.4735],[35.3005,139.4735]].map(([a,o])=>toGame(a,o));
const BENTEN=[toGame(35.3070,139.4812),toGame(35.3020,139.4812)];
// 川（河口から内陸へ。w は実際の川幅のおおよそ（m））
const RIVERS=[
  {n:'滑川',w:15,ll:[[35.3080,139.5478],[35.3130,139.5490],[35.3200,139.5520]]},
  {n:'境川',w:40,ll:[[35.3075,139.4808],[35.3150,139.4815],[35.3300,139.4830],[35.3450,139.4850]]},
  {n:'引地川',w:30,ll:[[35.3185,139.4598],[35.3260,139.4610],[35.3450,139.4630]]},
  {n:'相模川',w:300,ll:[[35.3178,139.3700],[35.3260,139.3690],[35.3350,139.3680],[35.3450,139.3670]]},
  {n:'花水川',w:50,ll:[[35.3035,139.3285],[35.3110,139.3300],[35.3250,139.3320],[35.3450,139.3340]]}
].map(r=>Object.assign({},r,{pts:r.ll.map(([a,o])=>toGame(a,o)),half:Math.max(4,r.w/SC/2)}));
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=clamp(t,0,1);return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));}
function lineDist(pts,x,y){let d=1e9;for(let i=0;i<pts.length-1;i++)d=Math.min(d,segDist(x,y,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]));return d;}
function pip(p,x,y){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}
function inRiver(x,y){for(const r of RIVERS)if(lineDist(r.pts,x,y)<r.half)return r;return null;}
function isLand(x,y){if(!inShonan(x,y))return false;if(pip(ENOSHIMA,x,y))return true;return pip(LAND,x,y)&&!inRiver(x,y);}

/* 防波堤・岸壁・突堤（おおよそ。南北か東西の向きだけで表す）。fish: 釣り場として立てる構造物か */
const STRUCTS=[
  {n:'片瀬漁港 西プロムナード',a:[35.3082,139.4794],b:[35.3044,139.4794],w:9,fish:true},
  {n:'腰越漁港 防波堤',a:[35.3076,139.4906],b:[35.3063,139.4906],w:8},
  {n:'平塚新港 東岸壁',a:[35.3158,139.3632],b:[35.3134,139.3632],w:12,fish:true},
  {n:'平塚新港 南岸壁',a:[35.3136,139.3598],b:[35.3136,139.3636],w:12,fish:true},
  {n:'大磯港 西防波堤',a:[35.3006,139.3186],b:[35.2988,139.3186],w:9,fish:true},
  {n:'大磯港 東防波堤',a:[35.2998,139.3226],b:[35.2982,139.3226],w:9},
  {n:'茅ヶ崎ヘッドランド',a:[35.3190,139.4140],b:[35.3170,139.4140],w:9},
  {n:'茅ヶ崎ヘッドランド（T字）',a:[35.3169,139.4122],b:[35.3169,139.4158],w:9},
  {n:'江の島 弁天橋',a:[35.3086,139.4814],b:[35.3017,139.4814],w:18,bridge:true}
].map(o=>{const A=toGame(o.a[0],o.a[1]),B=toGame(o.b[0],o.b[1]),gw=Math.max(4,o.w/SC*1.4);
  const x0=Math.min(A[0],B[0]),x1=Math.max(A[0],B[0]),y0=Math.min(A[1],B[1]),y1=Math.max(A[1],B[1]);
  const vert=x1-x0<y1-y0;return Object.assign({},o,{x:vert?x0-gw/2:x0,y:vert?y0:y0-gw/2,w:vert?gw:x1-x0,h:vert?y1-y0:gw});});
// 川に架かる橋：国道134号が渡る所（湘南大橋など）と、境川の河口近く（江の島へ渡る道）
for(const r of RIVERS){const[la,lo]=r.ll[0];const lat=la+.0018,half=(r.w/2+25)/M_LON;
  for(const L of r.n==='境川'?[lat,la+.0012]:[lat]){const A=toGame(L,lo-half),B=toGame(L,lo+half),gw=Math.max(6,14/SC*1.4);STRUCTS.push({n:r.n+'の橋',bridge:true,x:A[0],y:A[1]-gw/2,w:B[0]-A[0],h:gw});}}
function structAt(x,y){for(const r of STRUCTS)if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return r;return null;}

/* 道と線路（おおよそ）：国道134号は海岸沿い、JR東海道線と江ノ電 */
const R134=COAST_LL.filter((_,i)=>i%2===0).map(([a,o])=>toGame(a+.0016,o));
const JR=[[35.3090,139.2850],[35.3093,139.3120],[35.3280,139.3490],[35.3305,139.4070],[35.3370,139.4460],[35.3385,139.4870],[35.3400,139.5200],[35.3190,139.5500]].map(([a,o])=>toGame(a,o));
const ENODEN=[[35.3190,139.5500],[35.3130,139.5360],[35.3060,139.5260],[35.3070,139.5100],[35.3075,139.5000],[35.3090,139.4920],[35.3110,139.4870],[35.3385,139.4870]].map(([a,o])=>toGame(a,o));
const ROADS=[R134];

/* 駅（電車）とバス停（おおよその位置）。line: jr / enoden / odakyu / bus */
const STATIONS=[
  ['鎌倉駅',35.3190,139.5500,'jr'],['長谷駅',35.3125,139.5360,'enoden'],['稲村ヶ崎駅',35.3062,139.5250,'enoden'],['七里ヶ浜駅',35.3068,139.5110,'enoden'],
  ['鎌倉高校前駅',35.3073,139.5005,'enoden'],['腰越駅',35.3092,139.4920],['江ノ島駅',35.3115,139.4875,'enoden'],['片瀬江ノ島駅',35.3100,139.4796,'odakyu'],
  ['鵠沼海岸駅',35.3215,139.4675,'odakyu'],['藤沢駅',35.3385,139.4870,'jr'],['辻堂駅',35.3370,139.4460,'jr'],['茅ヶ崎駅',35.3305,139.4070,'jr'],
  ['茅ヶ崎漁港前（バス）',35.3180,139.4040,'bus'],['柳島（バス）',35.3200,139.3800,'bus'],['平塚駅',35.3280,139.3490,'jr'],['平塚新港（バス）',35.3190,139.3620,'bus'],
  ['大磯駅',35.3093,139.3120,'jr'],['大磯港（バス）',35.3025,139.3190,'bus']
].map(([n,a,o,line])=>{const[x,y]=toGame(a,o);return{n,x,y,region:'shonan',line:line||'enoden',jr:line==='jr'};});

/* 名所（スタンプ） */
const SIGHTS=[
  ['tsurugaoka','鶴岡八幡宮',35.3260,139.5560,60,'源頼朝ゆかりの鎌倉の象徴。若宮大路の先、大石段の上に朱塗りの本宮が建つ。'],
  ['daibutsu','鎌倉大仏（高徳院）',35.3168,139.5357,45,'高さ約11mの青銅の阿弥陀如来坐像。建物は失われ、露坐の大仏として親しまれている。'],
  ['seacandle','江の島シーキャンドル',35.2995,139.4795,40,'江の島の頂上に立つ展望灯台。相模湾と富士山、伊豆の島々まで見渡せる。'],
  ['inamura','稲村ヶ崎',35.3005,139.5232,40,'鎌倉の西の岬。夕日と富士山の名所で、新田義貞の伝説が残る。'],
  ['eboshi','烏帽子岩（姥島）',35.3070,139.4060,60,'茅ヶ崎沖に浮かぶ烏帽子の形をした岩。茅ヶ崎の海の象徴。'],
  ['terugasaki','照ヶ崎（アオバトの飛来地）',35.2995,139.3218,45,'初夏から秋、丹沢の山からアオバトが海水を飲みに飛来する岩礁。']
].map(([id,n,a,o,r,d])=>{const[x,y]=toGame(a,o);return{id,n,x,y,r,d,region:'shonan'};});

/* ===== 種類ごとのゲーム用推定値（実測ではない） =====
   depthProfile: d0=足元の水深, dMax=沖, slope=水深が変わる幅。structureProfile: 距離ごとの底質。
   waveExposure: 波の当たりやすさ、currentStrength: 潮の流れやすさ、riverFlow: 川の流れ（河口のみ）、snagRisk: 根掛かりのしやすさ */
const TYPE_LABEL={beach:'砂浜',river:'河口',iso:'磯',port:'漁港',breakwater:'堤防'};
const AREA_LABEL={kamakura:'鎌倉',fujisawa:'藤沢・江の島',chigasaki:'茅ヶ崎',hiratsuka:'平塚',oiso:'大磯'};
const STATUS_LABEL={official:'公式開放区域',general:'一般海岸・現地確認',check:'立入可能区域のみ・現地確認',unverified:'開放状況が未確認（ゲームでは釣り不可）',protected:'規制・自然保護の確認が必要（ゲームでは釣り不可）'};
const TYPE_GAME={
  beach:{d0:.5,dMax:5,slope:80,turb:.35,cur:.12,waveExposure:1,snagRisk:.1},
  river:{d0:.8,dMax:3.5,slope:40,turb:.5,cur:.2,riverFlow:.25,waveExposure:.5,snagRisk:.2},
  iso:{d0:2,dMax:9,slope:25,turb:.2,cur:.3,waveExposure:1.2,snagRisk:.7},
  port:{d0:3.5,dMax:6,slope:30,turb:.35,cur:.08,waveExposure:.3,snagRisk:.3},
  breakwater:{d0:4,dMax:8,slope:30,turb:.25,cur:.22,waveExposure:.6,snagRisk:.4}};
const BOTTOM_PROFILE={sand:[[0,'sand']],sand_mud:[[0,'sand'],[12,'mud']],mud:[[0,'mud']],rock:[[0,'rock'],[12,'weed'],[28,'sand']],
  sand_rock:[[0,'sand'],[10,'rock'],[22,'sand'],[40,'rock']],sand_gravel:[[0,'sand']]};
function gameParams(sp){const t=TYPE_GAME[sp.type]||TYPE_GAME.beach;let bottoms=BOTTOM_PROFILE[sp.bottomType]||[[0,'sand']];
  if(sp.type==='port'||sp.type==='breakwater')bottoms=[[0,'rock'],[4,sp.bottomType==='rock'?'rock':'mud'],[20,'sand']];
  return Object.assign({},t,{bottom:bottoms[0][1],bottoms});}

/* ===== 魚：資料の魚種名 → ゲームの魚ID。重みはゲーム用（出現確率ではない） ===== */
const NAME2ID={'シロギス':['kisu'],'イシモチ':['ishimochi'],'ヒラメ':['hirame'],'マゴチ':['magochi'],'シーバス':['seabass'],'クロダイ':['kurodai'],'キビレ':['kibire'],
  'ハゼ':['haze'],'メジナ':['mejina'],'カサゴ':['kasago'],'メバル':['mebaru'],'アジ':['aji'],'イワシ':['iwashi','kataku'],'サバ':['saba'],'カワハギ':['kawahagi'],
  'アオリイカ':['aoriika'],'カマス':['kamasu'],'ウミタナゴ':['umitanago'],'回遊魚':['inada','warasa','saba']};
function fishWeights(sp){const w={};for(const nm of sp.targetSpecies)for(const id of NAME2ID[nm]||[])w[id]=(w[id]||0)+10;
  // 釣りをしていれば掛かる外道（ゲーム用）
  if(sp.type==='beach'||sp.type==='port'||sp.type==='river')w.kusafugu=(w.kusafugu||0)+3;
  if(sp.type==='iso'||sp.type==='breakwater')w.bora=(w.bora||0)+2;
  return w;}

/* ===== 釣り方 ↔ 仕掛け（ゲームの bait 分類） ===== */
const METHOD_BAIT={'投げ釣り':['isome'],'ちょい投げ':['isome'],'ルアー':['lure','worm'],'ウキ釣り':['isome'],'サビキ':['sabiki'],'胴突き':['isome'],'脈釣り':['isome'],'エギング':['egi']};
const PROHIBIT_BAIT={'ルアー':['lure','worm','egi'],'コマセ':['sabiki'],'投げ釣り':[],'掛針':[]};
// その釣り場で、その仕掛けの適性（資料の釣り方に入っていれば1、入っていなければ0.5。禁止なら0）
function methodFit(sp,bait){if(prohibitedBy(sp,bait))return 0;for(const m of sp.fishingMethods)if((METHOD_BAIT[m]||[]).includes(bait))return 1;return .5;}
function prohibitedBy(sp,bait){for(const m of sp.prohibitedMethods||[])if((PROHIBIT_BAIT[m]||[]).includes(bait))return m;return null;}

/* ===== 波・川の流れ（ゲーム用推定） ===== */
// 波の高さ（m）：風と波当たりで決まる
function waveHeight(w,exposure){return Math.round((.3+.12*(w.wind||2))*(exposure==null?1:exposure)*10)/10;}
// 川の流れ（m/s、沖向き）：雨の日と翌日は増水
function riverFlow(sp,w){const t=TYPE_GAME[sp.type];if(!t||!t.riverFlow)return 0;return t.riverFlow*(1+(w.kind==='rain'?1.5:0)+(w.rainPrev?.8:0));}
function riverTurb(sp,w){return sp.type==='river'?(w.kind==='rain'?.3:0)+(w.rainPrev?.15:0):0;}

/* ===== 利用時間 ===== */
function hoursOf(sp,month){const h=sp.accessHours;if(!h)return null;return h.byMonth?h.byMonth[month]||null:h.all||null;}
function fmtH(v){const h=Math.floor(v),m=Math.round((v-h)*60);return h+':'+String(m).padStart(2,'0');}

/* ===== 釣りできるか =====
   ctx: {month, hour, wave（その釣り場の波の高さ）, bait（仕掛けの分類）}
   戻り値 {ok, reason（できない理由）, warn（できるが注意すること）} */
const WAVE_ISO_CLOSE=1.4,WAVE_PORT_CLOSE=2.0;
function canFish(sp,ctx){ctx=ctx||{};
  if(sp.accessStatus==='unverified')return{ok:false,reason:'開放状況・釣り可能範囲が未確認のため、ゲームでは釣りできない'};
  if(sp.accessStatus==='protected')return{ok:false,reason:'規制・自然保護の確認が必要な場所のため、ゲームでは釣りできない'};
  const hr=hoursOf(sp,ctx.month);if(hr&&(ctx.hour<hr[0]||ctx.hour>=hr[1]))return{ok:false,reason:`利用時間外（${fmtH(hr[0])}〜${fmtH(hr[1])}）`};
  const G=DATA.RESTRICTED.find(r=>r.id==='G');
  if(sp.swimArea&&G&&G.season.months.includes(ctx.month)&&ctx.hour>=G.season.hours[0]&&ctx.hour<G.season.hours[1])return{ok:false,reason:'夏の遊泳区域の開設時間中（9:00〜17:00）。区域ごとに制限があるため、ゲームでは釣りできない'};
  if(sp.type==='iso'&&ctx.wave>WAVE_ISO_CLOSE)return{ok:false,reason:`高波（約${ctx.wave}m）で危険。今日は磯に立てない`};
  if((sp.type==='port'||sp.type==='breakwater')&&sp.accessStatus==='official'&&ctx.wave>WAVE_PORT_CLOSE)return{ok:false,reason:'荒天のため閉鎖'};
  if(ctx.bait){const m=prohibitedBy(sp,ctx.bait);if(m)return{ok:false,reason:`ここでは「${m}」が禁止（${(sp.prohibitedMethods||[]).join('・')}）`};}
  const warn=sp.accessStatus==='check'?'立入可能区域のみ・現地確認':sp.accessStatus==='general'?'一般海岸・現地確認':null;
  const waveWarn=sp.type==='iso'&&ctx.wave>.9?`波が高め（約${ctx.wave}m）。足元に注意`:null;
  return{ok:true,warn:[warn,waveWarn].filter(Boolean).join('・')||null};}

/* ゲーム座標に直したスポット・規制エリア */
/* 位置はおおよそなので、ゲームでは釣り座を「いちばん近い岸辺（陸側3m）」か「その釣り場の防波堤の先端」に合わせる */
const STRUCT_SPOT={katase_port:'片瀬漁港 西プロムナード',shinko_east:'平塚新港 東岸壁',shinko_south:'平塚新港 南岸壁',oiso_west:'大磯港 西防波堤'};
function nearestShore(x,y){let best=null,bd=1e9;const polys=[COAST,ENOSHIMA.concat([ENOSHIMA[0]])];
  for(const P of polys)for(let i=0;i<P.length-1;i++){const[ax,ay]=P[i],[bx,by]=P[i+1];const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((x-ax)*dx+(y-ay)*dy)/l:0;t=clamp(t,0,1);
    const px=ax+dx*t,py=ay+dy*t,d=Math.hypot(x-px,y-py);if(d<bd){bd=d;best=[px,py];}}
  // 陸側へ3m入る（陸になる向きを探す）
  for(const r of[3,5,8])for(let a=0;a<6.28;a+=.3){const qx=best[0]+Math.cos(a)*r,qy=best[1]+Math.sin(a)*r;if(isLand(qx,qy)&&!inRiver(qx,qy))return[qx,qy];}
  return best;}
const GSPOTS=DATA.SPOTS.map(sp=>{let[x,y]=toGame(sp.latlon[0],sp.latlon[1]);const st=STRUCT_SPOT[sp.id]&&STRUCTS.find(r=>r.n===STRUCT_SPOT[sp.id]);
  if(st){const vert=st.h>st.w;x=vert?st.x+st.w/2:st.x+st.w/2;y=vert?st.y+st.h-3:st.y+st.h/2;}else[x,y]=nearestShore(x,y);
  return Object.assign({},sp,{x,y,region:'shonan'});});
const GRESTRICTED=DATA.RESTRICTED.filter(r=>r.latlon).map(r=>{const[x,y]=toGame(r.latlon[0],r.latlon[1]);return Object.assign({},r,{x,y,gr:r.r/SC});});
function restrictedAt(x,y){for(const r of GRESTRICTED)if(Math.hypot(r.x-x,r.y-y)<r.gr)return r;return null;}

const API={STRUCTS,structAt,DATA,toGame,BOUNDS,inShonan,COAST,LAND,ENOSHIMA,BENTEN,RIVERS,inRiver,isLand,R134,JR,ENODEN,ROADS,STATIONS,SIGHTS,
  TYPE_LABEL,AREA_LABEL,STATUS_LABEL,TYPE_GAME,gameParams,NAME2ID,fishWeights,METHOD_BAIT,methodFit,prohibitedBy,waveHeight,riverFlow,riverTurb,
  hoursOf,fmtH,canFish,GSPOTS,GRESTRICTED,restrictedAt,lineDist};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaShonan=API;
})(typeof self!=='undefined'?self:this);
