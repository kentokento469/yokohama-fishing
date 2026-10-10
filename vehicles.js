/* 横浜みなと釣り旅 — 自転車と自動車（描画に依存しない。Node でもブラウザでも動く）
   ・車種のデータ（価格・速さ・加速・旋回・耐久・積載・地形への強さ・坂・体力・電池・燃費・タンク）は下の BIKES / CARS で変えられる。
   ・価格・性能・積載量はゲーム用の仮設定。実在の製品・法定速度・実車の最大積載量とは関係ない。車名は架空。
   ・燃料・電池・体力・耐久の減りは「実際の距離（ゲームの距離×SC）」で計算する。2026-10 から横浜も湘南も等倍（SC=1）。
   セーブ：S.veh = {owned:[{uid,id,fuel,batt,dur}], using:uid|null, parked:{uid:{x,y,lotId}}, stamina, dest} */
(function(root){
'use strict';
const SC=1,clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* 地形（路面）：paved 舗装路 / gravel 砂利・未舗装 / sand 砂浜 / grass 芝・公園 / rock 岩場（乗ったままは進めない） / steps 階段（同じく不可） */
const BIKES=[
  {id:'bike_city',kind:'bike',name:'シティサイクル',price:18000,kmh:15,accel:.9,turn:2.4,durMax:100,loadKg:15,terrain:{paved:1,gravel:.75,sand:.3,grass:.6},slope:.55,staminaPerKm:4,repairPerPt:60,note:'前かごと荷台つき。普段使いに'},
  {id:'bike_cross',kind:'bike',name:'クロスバイク',price:55000,kmh:22,accel:1.2,turn:2.5,durMax:100,loadKg:8,terrain:{paved:1,gravel:.7,sand:.25,grass:.55},slope:.7,staminaPerKm:3.3,repairPerPt:120,note:'軽くて速い。積める荷物は少なめ'},
  {id:'bike_road',kind:'bike',name:'ロードバイク',price:120000,kmh:28,accel:1.4,turn:2.1,durMax:90,loadKg:5,terrain:{paved:1,gravel:.45,sand:.12,grass:.3},slope:.8,staminaPerKm:3,repairPerPt:250,note:'舗装路はいちばん速いが、砂利や砂浜はとても苦手'},
  {id:'bike_mtb',kind:'bike',name:'マウンテンバイク',price:85000,kmh:19,accel:1.1,turn:2.7,durMax:130,loadKg:10,terrain:{paved:.95,gravel:.95,sand:.55,grass:.85},slope:.75,staminaPerKm:3.6,repairPerPt:150,note:'未舗装路や砂浜に強い'},
  {id:'bike_ebike',kind:'bike',name:'電動アシスト自転車',price:135000,kmh:20,accel:1.3,turn:2.3,durMax:110,loadKg:25,terrain:{paved:1,gravel:.8,sand:.35,grass:.65},slope:.95,staminaPerKm:1.2,repairPerPt:180,batteryKm:50,chargeYen:30,note:'坂と荷物に強い。電池が切れると重い'}];
const CARS=[
  {id:'car_kei',kind:'car',name:'ミナト K1（軽自動車）',price:650000,kmh:100,accel:2.2,turn:1.6,durMax:100,loadKg:100,kmPerL:20,tankL:30,repairPerPt:2500,note:'小回りがきき、燃費がよい'},
  {id:'car_keivan',kind:'car',name:'ミナト Kバン（軽バン）',price:850000,kmh:95,accel:1.9,turn:1.5,durMax:110,loadKg:250,kmPerL:16,tankL:34,repairPerPt:2800,note:'荷室が広く、釣具をたくさん積める'},
  {id:'car_compact',kind:'car',name:'ハマ コンパクト',price:1400000,kmh:110,accel:2.6,turn:1.5,durMax:110,loadKg:150,kmPerL:18,tankL:40,repairPerPt:3500,note:'加速がよく、街乗りも遠出もこなす'},
  {id:'car_suv',kind:'car',name:'ショウナン SUV',price:2500000,kmh:120,accel:2.8,turn:1.3,durMax:140,loadKg:300,kmPerL:12,tankL:55,repairPerPt:5000,note:'頑丈で荷物も積める'},
  {id:'car_minivan',kind:'car',name:'ショウナン ミニバン',price:2800000,kmh:115,accel:2.4,turn:1.25,durMax:130,loadKg:350,kmPerL:11,tankL:60,repairPerPt:5200,note:'広い車内。車中泊の拡張を予定'},
  {id:'car_pickup',kind:'car',name:'ベイ ピックアップ',price:3500000,kmh:110,accel:2.5,turn:1.15,durMax:160,loadKg:500,kmPerL:9,tankL:75,repairPerPt:6000,note:'荷台に大型クーラーも楽々'}];
const ALL=[...BIKES,...CARS];const byId=id=>ALL.find(v=>v.id===id);
// クーラーボックス（釣った魚を運ぶ。重さ＝本体＋中身の目安）
const COOLERS=[{id:'cooler_s',name:'小型クーラー（12L）',price:3500,kg:4,bikeOk:true},{id:'cooler_l',name:'大型クーラー（45L）',price:12000,kg:14,bikeOk:false}];
const FUEL_YEN=175;// 1Lあたり（ゲーム用の目安）
const BLOCKED=['rock','steps'];

function fresh(){return{owned:[],using:null,parked:{},stamina:100,dest:null,cooler:null,coolers:[],nextUid:1};}
function migrate(S){if(!S.veh)S.veh=fresh();const v=S.veh;for(const k of Object.keys(fresh()))if(v[k]===undefined)v[k]=fresh()[k];return S;}
function owned(S,uid){return S.veh.owned.find(o=>o.uid===uid)||null;}
function specOf(o){return o&&byId(o.id);}
function buy(S,spec){if(S.money<spec.price)return{ok:false,reason:'お金が足りません'};S.money-=spec.price;migrate(S);
  const o={uid:S.veh.nextUid++,id:spec.id,dur:spec.durMax,fuel:spec.tankL||0,batt:spec.batteryKm?100:0};S.veh.owned.push(o);return{ok:true,o};}
function buyCooler(S,c){migrate(S);if(S.money<c.price)return{ok:false,reason:'お金が足りません'};if(S.veh.coolers.includes(c.id))return{ok:false,reason:'もう持っています'};S.money-=c.price;S.veh.coolers.push(c.id);if(!S.veh.cooler)S.veh.cooler=c.id;return{ok:true};}

/* 持ち歩く装備の重さ（kg）：装備中のロッド・リール、装備中のルアーの束、持っているクーラー */
function carriedKg(S,tackleById){let g=0;const t=id=>tackleById(id);
  const rod=S.rodId&&t(S.rodId),reel=S.reelId&&t(S.reelId),lure=S.eq&&t(S.eq);if(rod)g+=rod.rodWeightG||0;if(reel)g+=reel.reelWeightG||0;
  if(lure&&S.tk&&S.tk[S.eq])g+=(lure.weightG||0)*S.tk[S.eq];g/=1000;const c=S.veh&&S.veh.cooler&&COOLERS.find(q=>q.id===S.veh.cooler);if(c)g+=c.kg;return Math.round(g*100)/100;}
// 乗れるか（積載・耐久・燃料）
function canRide(S,o,kg){const sp=specOf(o);if(!sp)return{ok:false,reason:'乗り物がない'};
  if(kg>sp.loadKg)return{ok:false,reason:`積載オーバー（${kg.toFixed(1)}kg / ${sp.loadKg}kg）`};
  if(sp.kind==='bike'&&S.veh.cooler){const c=COOLERS.find(q=>q.id===S.veh.cooler);if(c&&!c.bikeOk)return{ok:false,reason:`${c.name}は自転車に積めない`};}
  if(o.dur<=0)return{ok:false,reason:'壊れている。修理が必要'};if(sp.kind==='car'&&o.fuel<=0)return{ok:false,reason:'燃料がない。給油が必要'};return{ok:true};}

/* 走る：state={v（速さm/s）, h（向き rad。x=sin, z=cos のゲームの向き）}、input={throttle(-1〜1), steer(-1〜1)}、
   env={surface, limit（その道での上限 m/s）, slope（上り0〜1）, offRoad（車が道の外に出ようとしている）}
   戻り値 {dist（ゲームのm）, blocked} */
function ride(o,state,input,env,dt,S){const sp=specOf(o);env=env||{};const sc=env.sc||SC;
  if(BLOCKED.includes(env.surface)){state.v=0;return{dist:0,blocked:'乗ったままでは進めない（岩場・階段）'};}
  let vmax=sp.kmh/3.6;
  if(sp.kind==='bike'){vmax*=sp.terrain[env.surface]==null?1:sp.terrain[env.surface];
    let assist=1;if(sp.batteryKm&&o.batt<=0)assist=.65;// 電池切れは重い
    const st=S&&S.veh?S.veh.stamina:100;if(st<=0)vmax*=.45;else if(st<20)vmax*=.75;
    vmax*=assist*(1-(env.slope||0)*(1-sp.slope));if(o.dur<=0)vmax*=.3;}
  else{if(env.limit)vmax=Math.min(vmax,env.limit);if(o.fuel<=0)vmax=0;if(o.dur<=0)vmax*=.3;}
  const th=clamp(input.throttle||0,-1,1),tg=th>=0?vmax*th:-vmax*.3*(-th);
  const a=tg>state.v?sp.accel:sp.accel*(sp.kind==='car'?2.5:3);state.v+=clamp(tg-state.v,-a*dt,a*dt);
  // 旋回：速さがあるほど曲がれる（止まっていると曲がれないのは車だけ）
  const turnK=sp.kind==='car'?clamp(Math.abs(state.v)/4,0,1):1;state.h+=(input.steer||0)*sp.turn*turnK*dt*(state.v<0?-1:1);
  const dist=Math.abs(state.v)*dt;consume(o,sp,dist,S,sc);return{dist,blocked:null};}
// 走った分だけ燃料・電池・体力・耐久が減る（実際の距離 = ゲームの距離 × sc。横浜3・湘南1）
function consume(o,sp,dist,S,sc){const km=dist*(sc||SC)/1000;if(km<=0)return;
  if(sp.kind==='car')o.fuel=Math.max(0,o.fuel-km/sp.kmPerL);
  if(sp.batteryKm)o.batt=Math.max(0,o.batt-km/sp.batteryKm*100);
  if(sp.kind==='bike'&&S&&S.veh){const k=sp.batteryKm&&o.batt<=0?3:sp.staminaPerKm;S.veh.stamina=Math.max(0,S.veh.stamina-km*k);}
  o.dur=Math.max(0,o.dur-km*(sp.kind==='car'?.02:.05));}
// ぶつかったとき（速さに応じて耐久が減る）
function crash(o,v){const sp=specOf(o);const d=Math.max(0,Math.abs(v)-2)*(sp.kind==='car'?1.5:.8);o.dur=Math.max(0,o.dur-d);return d;}
function restStamina(S,dtMin){S.veh.stamina=Math.min(100,S.veh.stamina+dtMin*2);}

// 端数（0.5L・0.5ポイント未満）は数えない
function refuelCost(o){const sp=specOf(o);return sp.kind==='car'?(sp.tankL-o.fuel<.5?0:Math.ceil((sp.tankL-o.fuel)*FUEL_YEN/10)*10):sp.batteryKm?(o.batt<99.5?sp.chargeYen:0):0;}
function refuel(S,o){const sp=specOf(o),c=refuelCost(o);if(c<=0)return{ok:false,reason:sp.kind==='car'?'満タンです':'電池は満タンです'};if(S.money<c)return{ok:false,reason:'お金が足りません'};
  S.money-=c;if(sp.kind==='car')o.fuel=sp.tankL;else o.batt=100;return{ok:true,cost:c};}
function repairCost(o){const sp=specOf(o);const d=sp.durMax-o.dur;return d<.5?0:Math.ceil(d*sp.repairPerPt/10)*10;}
function repair(S,o){const c=repairCost(o);if(c<=0)return{ok:false,reason:'修理の必要はありません'};if(S.money<c)return{ok:false,reason:'お金が足りません'};S.money-=c;o.dur=specOf(o).durMax;return{ok:true,cost:c};}

/* 駐車・駐輪：車は駐車場の中だけ。自転車はどこでも（駐輪場なら盗難・撤去の心配なし、という扱いは今後の拡張） */
function park(S,o,x,y,lot,region){const sp=specOf(o);if(sp.kind==='car'&&!lot)return{ok:false,reason:'車は駐車場に停める'};
  S.veh.parked[o.uid]={x,y,region:region||null,lotId:lot?lot.id:null,since:null};if(S.veh.using===o.uid)S.veh.using=null;return{ok:true};}
function unpark(S,o){delete S.veh.parked[o.uid];S.veh.using=o.uid;}
// 駐車料金（時間）：lot.feePerHour は OSM の値があればそれ、なければゲーム用の推定値
function parkingFee(lot,hours){if(!lot)return 0;const f=lot.feePerHour==null?0:lot.feePerHour;return Math.ceil(Math.max(0,hours))*f;}

const API={SC,BIKES,CARS,ALL,COOLERS,FUEL_YEN,BLOCKED,byId,fresh,migrate,owned,specOf,buy,buyCooler,carriedKg,canRide,ride,consume,crash,restStamina,refuelCost,refuel,repairCost,repair,park,unpark,parkingFee};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaVehicles=API;
})(typeof self!=='undefined'?self:this);
