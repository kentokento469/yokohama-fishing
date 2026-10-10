/* 横浜みなと釣り旅 — 効果音と環境音。音のファイルは使わず、すべて Web Audio API でその場で合成する（権利の心配がなく、ページも重くならない）。
   スマホは画面を一度タップするまで音を出せないので、「はじめから／つづきから」などの操作で init() を呼ぶ。
   消音の設定は localStorage（キー hama-tsuri-sound）に保存する。 */
(function(root){
'use strict';
const KEY='hama-tsuri-sound';
const SND={ctx:null,master:null,on:true,amb:{},reelPh:0,reelRate:0,dragLv:0};
try{SND.on=localStorage.getItem(KEY)!=='0';}catch(e){}
let noiseBuf=null;

function init(){if(SND.ctx){if(SND.ctx.state==='suspended')SND.ctx.resume();return;}
  const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return;
  const ctx=new AC();SND.ctx=ctx;SND.master=ctx.createGain();SND.master.gain.value=SND.on?.8:0;SND.master.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  // 環境音のループ：波・街のざわめき・雨・ドラグ
  SND.amb.sea=loopNoise([['lowpass',520,.7]],0,true);
  SND.amb.city=loopNoise([['lowpass',170,.5]],0);
  SND.amb.rain=loopNoise([['highpass',1400,.5],['lowpass',7000,.5]],0);
  SND.amb.drag=loopNoise([['bandpass',2600,6]],0);}
function loopNoise(filters,level,swell){const ctx=SND.ctx,src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true;let node=src;
  for(const[type,f,q]of filters){const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;node.connect(b);node=b;}
  const g=ctx.createGain();g.gain.value=level;node.connect(g);
  if(swell){// 波：ゆっくり寄せては返すように音量を揺らす
    const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=.13;lg.gain.value=.5;const base=ctx.createGain();base.gain.value=1;
    lfo.connect(lg);lg.connect(base.gain);g.connect(base);base.connect(SND.master);lfo.start();}
  else g.connect(SND.master);
  src.start();return g;}
function setLevel(g,v,t){if(!g||!SND.ctx)return;g.gain.setTargetAtTime(v,SND.ctx.currentTime,t||.4);}

/* 短い音の部品 */
function burst(o){const ctx=SND.ctx;if(!ctx||!SND.on)return;const t=ctx.currentTime+(o.delay||0);const src=ctx.createBufferSource();src.buffer=noiseBuf;
  const f=ctx.createBiquadFilter();f.type=o.type||'bandpass';f.frequency.setValueAtTime(o.f0||1000,t);if(o.f1)f.frequency.exponentialRampToValueAtTime(o.f1,t+o.dur);f.Q.value=o.q||1;
  const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.vol||.3,t+(o.att||.005));g.gain.exponentialRampToValueAtTime(.0005,t+o.dur);
  src.connect(f);f.connect(g);g.connect(SND.master);src.start(t,Math.random()*1.5);src.stop(t+o.dur+.05);}
function tone(o){const ctx=SND.ctx;if(!ctx||!SND.on)return;const t=ctx.currentTime+(o.delay||0);const osc=ctx.createOscillator();osc.type=o.wave||'sine';
  osc.frequency.setValueAtTime(o.f0,t);if(o.f1)osc.frequency.exponentialRampToValueAtTime(o.f1,t+o.dur);
  const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.vol||.2,t+(o.att||.005));g.gain.exponentialRampToValueAtTime(.0005,t+o.dur);
  osc.connect(g);g.connect(SND.master);osc.start(t);osc.stop(t+o.dur+.05);}

/* 効果音。opt.size / opt.strength で大きさを変える */
const FX={
  cast:o=>burst({f0:2400,f1:500,dur:.38,q:1.2,vol:.22,att:.03}),
  splash:o=>{const s=o&&o.size!=null?o.size:1;burst({type:'lowpass',f0:1600,f1:280,dur:.25+.25*s,vol:.18+.22*s,att:.004});tone({f0:110,f1:55,dur:.18,vol:.12*s});},
  jerk:o=>burst({f0:1800,f1:900,dur:.13,q:2,vol:.12}),
  twitch:o=>burst({f0:2200,f1:1400,dur:.07,q:2,vol:.07}),
  pop:o=>{burst({f0:700,f1:300,dur:.1,q:3,vol:.3});tone({f0:320,f1:110,dur:.09,vol:.12});},
  walk:o=>burst({type:'lowpass',f0:1200,f1:500,dur:.09,vol:.08}),
  bottom:o=>{tone({f0:150,f1:90,dur:.07,vol:.1});burst({type:'lowpass',f0:600,dur:.06,vol:.05});},
  bite:o=>{const s=o&&o.strength!=null?o.strength:1;tone({f0:1300,f1:900,dur:.035,vol:.12+.1*s});burst({f0:3000,dur:.03,q:4,vol:.1*s});if(s>.6)tone({f0:1100,f1:800,dur:.035,vol:.1*s,delay:.09});},
  short:o=>tone({f0:1500,f1:1200,dur:.025,vol:.08}),
  hook:o=>{burst({f0:1400,f1:600,dur:.16,q:1.5,vol:.18});tone({f0:200,f1:120,dur:.12,vol:.1});},
  snap:o=>{burst({type:'highpass',f0:3500,dur:.05,vol:.35});tone({f0:2400,f1:400,dur:.12,vol:.12,wave:'triangle'});},
  catch:o=>{[660,880,1320].forEach((f,i)=>tone({f0:f,dur:.18,vol:.12,delay:i*.09,wave:'triangle'}));},
  coin:o=>{tone({f0:1320,dur:.07,vol:.1,wave:'square'});tone({f0:1760,dur:.14,vol:.09,wave:'square',delay:.07});},
  miss:o=>tone({f0:400,f1:250,dur:.2,vol:.08,wave:'triangle'}),
  step:o=>burst({type:'lowpass',f0:o&&o.run?520:380,dur:.05,vol:o&&o.run?.06:.035}),
  gull:o=>{const f=1250+Math.random()*350;tone({f0:f,f1:f*.62,dur:.28,vol:.05,wave:'triangle'});tone({f0:f*1.04,f1:f*.66,dur:.24,vol:.04,wave:'triangle',delay:.33});},
  tap:o=>tone({f0:900,dur:.03,vol:.04}),
  // 竿のきしみ（テンションの危険域）
  creak:o=>{tone({f0:180,f1:140,dur:.22,vol:.07,wave:'sawtooth'});burst({type:'bandpass',f0:900,f1:600,dur:.2,q:6,vol:.06});}};
function play(name,opt){if(!SND.ctx||!SND.on)return;const f=FX[name];if(f)try{f(opt||{});}catch(e){}}

/* 環境音の大きさ。o: {sea, city, rain}（0〜1） */
function ambient(o){if(!SND.ctx)return;setLevel(SND.amb.sea,.22*(o.sea||0),1);setLevel(SND.amb.city,.35*(o.city||0),1);setLevel(SND.amb.rain,.12*(o.rain||0),1.5);}
/* リールを巻く音（カリカリ）：rate は1秒あたりのクリック数。ドラグの「ジーッ」：level は 0〜1 */
function reel(rate){SND.reelRate=rate;}
function drag(level){if(!SND.ctx)return;const v=Math.max(0,Math.min(1,level));if(Math.abs(v-SND.dragLv)>.02){SND.dragLv=v;setLevel(SND.amb.drag,.28*v,.04);}}
function update(dt){if(!SND.ctx||!SND.on)return;if(SND.reelRate>0){SND.reelPh+=dt*SND.reelRate;while(SND.reelPh>=1){SND.reelPh-=1;burst({type:'highpass',f0:4200,dur:.012,vol:.05});}}}
function setOn(v){SND.on=!!v;try{localStorage.setItem(KEY,SND.on?'1':'0');}catch(e){}if(SND.master)SND.master.gain.setTargetAtTime(SND.on?.8:0,SND.ctx.currentTime,.05);}

const API={init,play,ambient,reel,drag,update,setOn,get on(){return SND.on;},FX};
root.HamaSound=API;
})(typeof self!=='undefined'?self:this);
