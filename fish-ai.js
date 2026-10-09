/* 横浜みなと釣り旅 — 魚のAI（段階4）。描画にもDOMにも依存しない。ブラウザでも Node でも動く。
   ルアー釣り（lure / egi / worm）のとき、着水点のまわりに魚の個体を何匹か置き、1匹ずつ次の状態を進める。
     cruise（通常遊泳）→ notice（ルアー発見）→ approach（接近）→ chase（追尾）→ bite（バイト）/ short（ショートバイト）
                                                          ↘ refuse（見切り）→ wary（警戒）/ flee（逃走） ↘ giveup（追いつけず見失う）
   座標：x = 釣り人からの水平距離（ルアーの dist と同じ）、y = 左右、z = 深さ（下向き正）。単位は m, 秒, m/s。
   確率は使うが、距離・深さの差・速さ・操作の種類・活性・警戒心で決まる「起こりやすさ（1秒あたり）」から引く。 */
(function(root){
'use strict';
const SIM=root&&root.HamaSim||(typeof require==='function'?require('./fishing-sim.js'):null);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ===== 魚種ごとの性質（数値はここで調整する） =====
   vision: ルアーに気づく距離、swim: ふだんの泳ぐ速さ、burst: 追うときの最高速、pref: 好むルアーの速さ、
   caution: 警戒心（0〜1）、maxRise: 底から何mまで浮いて追うか（底の魚）、trig: 食いのきっかけへの反応の強さ、
   fallOnly: フォール中・止めたときにしか抱かない（イカ）、school: 群れで回る */
const BASE={
  blue:{vision:9,swim:.7,burst:3.2,pref:1.4,caution:.3,school:true,trig:{jerk:1.8,twitch:1.3,fast:1.5,fall:1.1,stop:.8,bottom:.6}},
  bottom:{vision:4,swim:.25,burst:1.8,pref:.35,caution:.45,maxRise:2.5,trig:{jerk:1,twitch:1.3,fast:.4,fall:1.6,stop:1.2,bottom:1.6}},
  general:{vision:5,swim:.4,burst:2.2,pref:.7,caution:.55,trig:{jerk:1,twitch:1.4,fast:.7,fall:1.3,stop:1.2,bottom:1}},
  squid:{vision:5,swim:.35,burst:1.6,pref:0,caution:.4,fallOnly:true,trig:{jerk:.6,twitch:.8,fast:.2,fall:2.6,stop:1.6,bottom:.6}}};
const OVR={
  seabass:{base:'general',vision:7,swim:.6,burst:3,pref:.9,caution:.55,trig:{jerk:1.3,twitch:1.6,fast:.9,fall:1.2,stop:1.4,bottom:.8}},
  hirame:{base:'bottom',vision:6,burst:2.8,pref:.8,maxRise:5,trig:{jerk:1.3,twitch:1.2,fast:.9,fall:1.4,stop:1.1,bottom:1.2}},
  magochi:{base:'bottom',vision:5,burst:2.4,pref:.6,maxRise:3},
  tachiuo:{base:'blue',vision:6,pref:.8,trig:{jerk:1.5,twitch:1.3,fast:1,fall:1.6,stop:1.1,bottom:.5}},
  madako:{base:'bottom',vision:2.5,swim:.1,burst:.6,pref:.1,maxRise:1,trig:{jerk:.5,twitch:.8,fast:.2,fall:1,stop:1.3,bottom:2.6}},
  kurodai:{caution:.75},mebaru:{base:'general',vision:4,pref:.4,caution:.4},inada:{burst:3.6},warasa:{burst:3.8,caution:.4}};
function speciesParams(id){const st=SIM.styleOf(id),o=OVR[id]||{},b=BASE[o.base||st]||BASE.general;
  return Object.assign({},b,o,{trig:Object.assign({},b.trig,o.trig||{})});}

/* ===== 調整値 ===== */
const AI={
  interestGain:1.1,interestDecay:.35,noticeTime:.5,strikeBase:.55,refuseBase:.12,unnaturalMul:3,
  chaseTooLong:6,feetDist:3,giveupTime:1.4,waryTime:15,shortBase:.12,respawnEvery:6,vertVision:1.6,
  lateralLine:.7,spreadY:6,minCount:3,aware:3,drift:.35};

function pickWeighted(list,rng){let s=0;for(const[,w]of list)s+=w;let r=rng()*s;for(const[id,w]of list){r-=w;if(r<=0)return id;}return list[list.length-1][0];}

/* 群れ（その1投のまわりにいる魚）を作る。opt:
   cand [[id,重み]...]（釣り場・季節・時間で決まる）、activity（潮・時間の活性 0.3〜2）、maxDist（着水点の距離）、
   depthAt(x)、rng、sizeOf(id,rng)→cm、nabura（ナブラに投げたか）、count（匹数。省略時は重みの合計から） */
function createSchool(opt){const rng=opt.rng||Math.random;const s={fish:[],t:0,rng,opt,respawnT:AI.respawnEvery,prev:null,prevSpeed:0,stopT:99,nextId:1};
  let sum=0;for(const[,w]of opt.cand)sum+=w;s.target=sum<=0?0:opt.count||Math.round(clamp(sum/8,AI.minCount,8))+(opt.nabura?4:0);
  for(let i=0;i<s.target;i++)spawn(s,true);return s;}
function spawn(s,initial){const o=s.opt,rng=s.rng;if(!o.cand.length)return null;const id=pickWeighted(o.cand,rng);const p=speciesParams(id);
  const lx=s.lureX!=null?s.lureX:o.maxDist;const px=()=>initial?2+rng()*(o.maxDist+8):clamp(lx+(rng()-.5)*16,2,o.maxDist+10);
  // 底の魚は好きな底質（岩・砂・泥・海藻）の上にいやすい（段階6）
  let x=px();if(o.bottomAt&&SIM.BOTTOM_PREF[id])for(let k=0;k<4&&SIM.bottomFactor(id,o.bottomAt(x))<1;k++)x=px();const D=o.depthAt(x);const[a,b]=SIM.layerRange(SIM.LAYER[id]||'mid',D);
  let z=a+(b-a)*rng();if(o.nabura&&p.school&&rng()<.7){z=Math.min(z,3);}
  const f={n:s.nextId++,id,p,x,y:(rng()-.5)*2*AI.spreadY,z,hx:x,state:'cruise',interest:0,tState:0,lostT:0,fastT:0,wary:0,
    act:clamp((o.activity||1)*(.6+.8*rng())*(o.nabura&&p.school?1.8:1),.1,2.5),caution:clamp(p.caution*(.75+.5*rng())*(o.cautionMul||1),0,1),
    size:o.sizeOf?o.sizeOf(id,rng):20,heading:rng()*6.283};
  s.fish.push(f);return f;}

/* ルアーの動きから「きっかけ」を読む。jerk/twitch=しゃくった直後、fall=沈んでいる、stop=急に止めた、bottom=着底、fast=速い */
function lureCues(s,L,dt){const v=SIM.lureSpeed(L);const c={speed:v,jerk:L.sinceAction<.6&&L.lastAction==='jerk',twitch:L.sinceAction<.6&&L.lastAction==='twitch',
  fall:!L.onBottom&&L.vy>.08&&L.rig.move!=='top',bottom:L.touchT<1.2,fast:v>1.5,stop:false};
  if(s.prevSpeed>.45&&v<.2)s.stopT=0;else s.stopT+=dt;c.stop=s.stopT<.8;s.prevSpeed=v;
  // 不自然さ：適正巻き速度から大きく外れる、止めたまま長い
  const r=L.rig;let un=0;if(L.mode==='retrieve'&&r&&r.optMax){if(L.reel>r.optMax*1.5)un=1;else if(L.reel<r.optMin*.5)un=.5;}
  if(L.onBottom&&L.bottomT>8)un=Math.max(un,.6);c.unnatural=un;return c;}
function trigMul(p,c){let m=1;for(const k of['jerk','twitch','fall','stop','bottom','fast'])if(c[k])m=Math.max(m,p.trig[k]||1);return m;}

/* 1ステップ進める。L はルアー（fishing-sim の状態）、env: {light: 0〜1（夜は暗い）}。戻り値はイベントの配列 */
function stepSchool(s,L,dt,env){const ev=[],rng=s.rng,o=s.opt;s.t+=dt;if(dt<=0||!L)return ev;env=env||{};
  // 目で見える距離は明るさと濁り（vis）、側線は濁っていても届く
  const light=env.vis!=null?env.vis:env.light==null?1:env.light;const c=lureCues(s,L,dt);
  const it=L.rig&&L.rig.item;const loud=it?(it.noiseLevel||0)/200+(it.actionIntensity||0)/300:0;
  const lx=L.dist,ly=SIM.lateral?SIM.lateral(L):L.side||0,lz=L.depth;s.lureX=lx;
  for(const f of s.fish){if(f.gone)continue;const p=f.p;f.tState+=dt;
    const dx=lx-f.x,dy=ly-f.y,dz=lz-f.z;const dist=Math.hypot(dx,dy,dz*AI.vertVision);
    // 気づく距離：目（明るさで変わる）＋ 側線（動いているルアーの波動。暗くても効く）
    const moving=c.speed>.2||c.fall;const range=Math.max(p.vision*(.45+.55*light),moving?p.vision*AI.lateralLine:0)*(1+loud)*(p.fallOnly&&c.fall?1.3:1);const sees=dist<range&&!L.home;
    const D=o.depthAt(f.x);const zMin=p.maxRise?Math.max(0,D-p.maxRise):0;
    let appeal=SIM.actionAppeal(f.id,L);if(L.onBottom&&L.reel<.05)appeal*=Math.exp(-L.bottomT/12);
    if(f.wary>0){f.wary-=dt;f.interest=Math.min(f.interest,0);}
    switch(f.state){
      case'cruise':{// ふらふら泳ぐ。見えて魅力があれば興味が溜まる
        f.heading+=(rng()-.5)*dt*1.5;f.x+=Math.cos(f.heading)*p.swim*.4*dt;f.y+=Math.sin(f.heading)*p.swim*.4*dt;
        // 波動や光をうっすら感じる範囲（視界の数倍）なら、ルアーのいる方へ水平に寄っていく（深さは自分の泳層のまま）
        const hd=Math.hypot(dx,dy);if(f.wary<=0&&hd>1&&hd<p.vision*AI.aware&&!L.home){const k=p.swim*AI.drift*dt/hd;f.x+=dx*k;f.y+=dy*k;}
        f.x=clamp(f.x,1,o.maxDist+15);f.y=clamp(f.y,-AI.spreadY*1.5,AI.spreadY*1.5);
        if(sees&&f.wary<=0){f.interest+=dt*AI.interestGain*(appeal*f.act-f.caution*.6)*(1-dist/range*.5);if(f.interest>=1){f.state='notice';f.tState=0;}}
        else f.interest=Math.max(0,f.interest-dt*AI.interestDecay);break;}
      case'notice':if(f.tState>AI.noticeTime){f.state='approach';f.tState=0;}break;
      case'approach':{const sp=p.swim*(1+f.act);moveToward(f,lx,ly,lz,sp,dt,zMin);
        if(!sees){f.lostT+=dt;if(f.lostT>2){f.state='cruise';f.interest=.3;f.lostT=0;}}else f.lostT=0;
        if(dist<2){f.state='chase';f.tState=0;f.fastT=0;ev.push({type:'chase',fish:f,shallow:lz<1.3});}break;}
      case'chase':{// 追尾：ルアーの少し後ろにつく。速すぎれば見失い、食うか見切るかを判断する
        const v=c.speed;moveToward(f,lx+.8,ly,lz,Math.min(p.burst,v+1),dt,zMin);
        if(v>p.burst*1.05)f.fastT+=dt;else f.fastT=Math.max(0,f.fastT-dt);
        if(f.fastT>AI.giveupTime){f.state='cruise';f.interest=.2;ev.push({type:'giveup',fish:f});break;}
        if(lz<zMin-.5&&p.maxRise){f.state='cruise';f.interest=.4;ev.push({type:'giveup',fish:f});break;}
        // 食う起こりやすさ：活性 × きっかけ × 好む速さとの近さ × ルアーの魅力
        const speedFit=.4+.6*Math.exp(-Math.pow((v-p.pref)/(.5+p.pref),2));
        let strike=AI.strikeBase*f.act*trigMul(p,c)*speedFit*Math.min(1.6,appeal);
        if(p.fallOnly&&!(c.fall||c.stop||v<.25))strike*=.05;
        // 見切る起こりやすさ：警戒心 × 不自然さ、長く追いすぎ、足元まで来た
        let refuse=AI.refuseBase*f.caution*(1+AI.unnaturalMul*c.unnatural)+(f.tState>AI.chaseTooLong?.25:0)+(lx<AI.feetDist?1.2:0);
        if(rng()<1-Math.exp(-strike*dt)){const lc=L.rig&&L.rig.sizeCm||8;
          const pShort=clamp(AI.shortBase+f.caution*.25+(lc>f.size*.7?.25:0)-(f.act-1)*.1,.03,.85);
          const kind=rng()<pShort?'short':'bite';f.state='done';f.gone=true;
          ev.push({type:kind,fish:f,id:f.id,size:f.size,strength:clamp(.4+f.act*.3+(kind==='bite'?.3:0)+(c.fall?.1:0),.2,1.3),cue:Object.keys(p.trig).find(k=>c[k])||'retrieve'});break;}
        if(rng()<1-Math.exp(-refuse*dt)){f.interest=-1;f.caution=Math.min(1,f.caution+.1);ev.push({type:'refuse',fish:f,near:lx<AI.feetDist+2,shallow:lz<1.3});
          if(c.unnatural>.5&&f.caution>.6){f.state='flee';f.tState=0;}else{f.state='wary';f.wary=AI.waryTime;f.tState=0;}}
        break;}
      case'wary':f.x+=(f.x>lx?1:-1)*p.swim*dt*.5;if(f.wary<=0){f.state='cruise';f.wary=0;}break;
      case'flee':f.x+=p.burst*dt;f.z=Math.min(D,f.z+dt);if(f.tState>2){f.gone=true;ev.push({type:'flee',fish:f});}break;}
  }
  // いなくなった魚の代わりに、しばらくすると別の魚が回ってくる
  s.fish=s.fish.filter(f=>!f.gone);s.respawnT-=dt;if(s.respawnT<=0){s.respawnT=AI.respawnEvery;if(s.fish.length<s.target)spawn(s,false);}
  return ev;}
function moveToward(f,x,y,z,sp,dt,zMin){const dx=x-f.x,dy=y-f.y,dz=z-f.z,d=Math.hypot(dx,dy,dz)||1,k=Math.min(1,sp*dt/d);
  f.x+=dx*k;f.y+=dy*k;f.z=Math.max(zMin,f.z+dz*k);}

const API={BASE,OVR,AI,speciesParams,createSchool,stepSchool,lureCues};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaFishAI=API;
})(typeof self!=='undefined'?self:this);
