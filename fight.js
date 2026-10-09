/* 横浜みなと釣り旅 — フッキングとファイト（段階5）。描画にもDOMにも依存しない。ブラウザでも Node でも動く。
   操作の手応えは従来どおり「長押しで巻く／テンションが赤（糸の強さの近く）になったら離す」。その上に次を足す。
   - ドラグ：巻いている間にテンションがドラグ設定を超えると、スプールが滑って糸が出る（魚に走られる）。
     締めすぎると糸の強さまで張って切れやすく、緩すぎると糸を出され、寄せるのに時間がかかる。
   - ドラグの滑らかさ（dragPrecision）が低いと、滑り出しが遅れてテンションが跳ねる。
   - ロッド：パワーと張りが「寄せる力」、しなやかさが突っ込みの衝撃をやわらげる。リール：巻き取り量が寄せる速さ。
   - 針の掛かり（q）が浅いと外れやすい。ジャンプ（エラ洗い）で緩むと外れる。口の弱い魚は強引に巻くと口切れ。
   単位：テンション・ドラグ・糸の強さは kg 相当、距離は m、時間は秒。 */
(function(root){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ===== 調整値 ===== */
const FT={reelBase:5.5,slipRate:1.8,slackLimit:2.8,hookoutBase:.03,jumpRate:.1,netKg:1.2,netStam:.4,stickSlip:2};

/* 魚の口と動き */
const SOFT_MOUTH=['kataku','iwashi','konoshiro','sappa','aji','saba','sayori','umitanago'];
const HARD_MOUTH=['kurodai','hirame','magochi','mejina','kawahagi','tachiuo'];
const JUMPERS=['seabass','bora','sayori','tachiuo'];

/* ===== フッキング =====
   o: {t: アタリから合わせまでの秒, window: 合わせられる時間, short: ショートバイトか, id: 魚種, fishCm, lureCm,
       slack: 糸がたるんでいたか（フリーフォール中など）, hookMul: ロッドの合わせの強さ, egi: エギ（カンナ）か}
   戻り値 {ok, q}：q は針の掛かりの深さ（0〜1）。完璧なタイミングだけを求めず、窓の中ほどなら十分に掛かる */
function hookSet(o,rng){rng=rng||Math.random;const x=clamp(o.t/Math.max(.1,o.window),0,1.2);
  const timing=x<.08?.55:x<=.65?1:clamp(1-(x-.65)*1.1,.3,1);
  const mouth=o.egi?1.05:HARD_MOUTH.includes(o.id)?.82:1;
  let size=1;if(o.lureCm&&o.fishCm){if(o.lureCm<o.fishCm*.12)size=.85;else if(o.lureCm>o.fishCm*.8)size=.8;}
  const slack=o.slack?.82:1,rod=o.hookMul||1;
  const p=clamp((o.short?.32:.92)*timing*mouth*size*slack*rod,.05,.97);
  const q=clamp(timing*mouth*size*slack*rod*(o.short?.6:1),.1,1);
  return{ok:rng()<p,q,p,timing};}

/* ===== ファイト =====
   o: {P: 魚の引きの強さ, d0: 魚までの距離, lineKg, liftKg（ロッド）, reelK（リールの巻き速さ係数）, flex（0〜100）,
       dragPrec（0〜100）, drag（kg）, capacityM, q（針の掛かり）, id, wkg（重さkg）, needNet（タモが要る足場か）, rng} */
function createFight(o){return{P:o.P,d0:o.d0,dist:o.d0,ten:.3,stam:1,surge:0,slack:0,t:0,ph:(o.rng||Math.random)()*6,
  lineKg:o.lineKg,liftKg:o.liftKg,reelK:o.reelK||1,flex:o.flex==null?60:o.flex,dragPrec:o.dragPrec==null?60:o.dragPrec,drag:o.drag,
  capacityM:o.capacityM||150,q:o.q==null?1:o.q,id:o.id,wkg:o.wkg||.2,needNet:!!o.needNet,rng:o.rng||Math.random,
  soft:SOFT_MOUTH.includes(o.id),jumper:JUMPERS.includes(o.id),slipping:false,lineOut:0,jumpT:99};}

/* 1ステップ進める。ctrl: {hold: 巻いているか, inTetra: 魚がテトラ帯にいるか, rock: 根に潜る魚か}
   戻り値は {type} の配列：break（糸切れ）/ spooled（糸が出切った）/ hookout（針外れ）/ mouth（口切れ）/
   snag（テトラに潜られた）/ jump / net_fail（タモ入れ失敗）/ landed（釣り上げ） */
function stepFight(f,dt,ctrl){const ev=[],rng=f.rng;f.t+=dt;f.jumpT+=dt;const hold=!!(ctrl&&ctrl.hold);
  // 魚の引き：体力が残っているほど強く、ときどき突っ込む（ロッドがしなやかなほど衝撃はやわらぐ）
  if(rng()<dt*.45)f.surge=Math.max(f.surge,f.P*(.45+rng()*.5));f.surge*=Math.pow(.25,dt);
  const shock=1.25-f.flex/200;
  const pull=f.P*(.2+.8*f.stam)*(.8+.2*Math.sin(f.t*2.7+f.ph))+f.surge*shock;
  f.slipping=false;
  if(hold){const tg=pull*1.25+.35;f.ten+=(tg-f.ten)*Math.min(1,dt*2.6);
    // ドラグ：設定を超えた分だけスプールが滑って糸が出る。滑らかさが低いと滑り出しが遅れ、テンションが残る・跳ねる
    if(f.ten>f.drag){const ex=f.ten-f.drag;f.slipping=true;const lag=.6*(1-f.dragPrec/120);
      const out=ex*FT.slipRate*dt;f.dist+=out;f.lineOut+=out;f.ten=f.drag+ex*lag;
      if(rng()<dt*FT.stickSlip*(1-f.dragPrec/100))f.ten+=f.drag*.35;
      f.stam=Math.max(0,f.stam-dt*.9*ex/(1+f.P*.3));}
    else f.dist-=FT.reelBase*f.reelK*Math.max(.15,1-pull/(f.liftKg*1.15))*dt;
    f.stam=Math.max(0,f.stam-dt*.5/(1+f.P*.4));f.slack=0;}
  else{const tg=pull*.35;f.ten+=(tg-f.ten)*Math.min(1,dt*3.5);f.dist=Math.min(f.d0+10+f.lineOut,f.dist+pull*.7*dt*(.4+.6*f.stam));f.stam=Math.min(1,f.stam+dt*.05);f.slack+=dt;}
  // 結果の判定
  if(f.ten>f.lineKg){ev.push({type:'break'});return ev;}
  if(f.dist>f.capacityM*.95){ev.push({type:'spooled'});return ev;}
  if(f.slack>FT.slackLimit){ev.push({type:'hookout',why:'slack'});return ev;}
  if(rng()<1-Math.exp(-dt*FT.hookoutBase*(1-f.q)*(hold?1:2))){ev.push({type:'hookout',why:'shallow'});return ev;}
  if(f.soft){const lim=.8+f.wkg*2;if(f.ten>lim&&rng()<1-Math.exp(-dt*(f.ten-lim)*.6)){ev.push({type:'mouth'});return ev;}}
  if(f.jumper&&f.dist>3&&f.stam>.25&&f.jumpT>3&&rng()<dt*FT.jumpRate*f.stam){f.jumpT=0;ev.push({type:'jump'});
    const p=hold?.12*(1-f.q)+.03:.45*(1-f.q)+.15;if(rng()<p){ev.push({type:'hookout',why:'jump'});return ev;}}
  if(ctrl&&ctrl.rock&&ctrl.inTetra&&rng()<dt*(hold&&!f.slipping?.02:.22)){ev.push({type:'snag'});return ev;}
  if(f.dist<=0){if(f.needNet&&f.wkg>=FT.netKg&&f.stam>FT.netStam){f.dist=4;ev.push({type:'net_fail'});}else ev.push({type:'landed'});}
  return ev;}

const API={FT,SOFT_MOUTH,HARD_MOUTH,JUMPERS,hookSet,createFight,stepFight};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaFight=API;
})(typeof self!=='undefined'?self:this);
