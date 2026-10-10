/* 魚拓（window.HamaGyotaku）。釣った魚の記録（魚種・体長・重さ・日時・場所・竿・リール・ルアー/餌・自己記録か）から、
   和紙に墨で写したような魚拓の絵を作る。形は fish3d.js と同じ体型の輪郭（体型 shape・体高 aspect）。記録は魚を売っても残る（S.gyotaku）。
   ・record(S, info)：記録を足す（自己記録なら best:true）。・draw(canvas, rec, look)：絵を描く。・list(S)：一覧（新しい順）。 */
(function(root){
'use strict';
function hash(i){let h=(i*374761393)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296;}
const MAX=300;// 記録の上限（古いものから消す。自己記録は残す）
function record(S,info){S.gyotaku=S.gyotaku||[];const best=!S.gyotaku.some(g=>g.id===info.id&&g.cm>=info.cm);if(best)for(const g of S.gyotaku)if(g.id===info.id)g.best=false;
  const rec=Object.assign({n:(S.gyotakuN=(S.gyotakuN||0)+1),best},info);S.gyotaku.push(rec);
  if(S.gyotaku.length>MAX){const i=S.gyotaku.findIndex(g=>!g.best);if(i>=0)S.gyotaku.splice(i,1);}return rec;}
function list(S){return(S.gyotaku||[]).slice().reverse();}
// 体の輪郭（上下の縁）：fish3d.js の PROF と同じ考え方（u：0尾→1頭）
const PROF={fish:u=>u<.12?.16+u*1.4:u<.62?.33+.67*Math.sin((u-.12)/.5*Math.PI/2):Math.max(.05,Math.cos((u-.62)/.38*Math.PI/2)**.8),
  needle:u=>u<.1?.25:u<.85?.9-.2*Math.abs(u-.5):Math.max(.05,(1-u)/.15*.8),ribbon:u=>u<.05?.1:Math.min(1,u*1.3)*(u>.92?(1-u)/.08:1),
  eel:u=>u<.05?.5:u>.94?Math.max(.1,(1-u)/.06):1,flat:u=>u<.12?.25:u<.7?.7+.3*Math.sin((u-.12)/.58*Math.PI):Math.max(.1,Math.cos((u-.7)/.3*Math.PI/2))};
function draw(cv,rec,look){const c=cv.getContext('2d'),W=cv.width,H=cv.height;look=look||{shape:'fish',aspect:.3};
  // 和紙：生成りの地に繊維
  c.fillStyle='#f3ecdc';c.fillRect(0,0,W,H);c.strokeStyle='rgba(150,130,100,.12)';c.lineWidth=1;for(let i=0;i<260;i++){const x=hash(i)*W,y=hash(i+999)*H,l=10+hash(i+77)*40,a=hash(i+5)*6.28;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.cos(a)*l*.5+5,y+Math.sin(a)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);c.stroke();}
  // 魚の形（横向き、頭は右）
  const sh=look.shape||'fish',asp=Math.max(.06,Math.min(.75,look.aspect||.3)),flat=sh==='flat',prof=PROF[sh]||PROF.fish;
  const L=W*.78,x0=W*.1,yc=H*.47,Hh=Math.min(H*.62,L*(flat?asp*1.1:asp));
  const ink=c.createLinearGradient(0,yc-Hh/2,0,yc+Hh/2);ink.addColorStop(0,'rgba(20,18,16,.92)');ink.addColorStop(.5,'rgba(30,27,24,.78)');ink.addColorStop(1,'rgba(20,18,16,.9)');
  const outline=()=>{c.beginPath();const N=60;for(let i=0;i<=N;i++){const u=i/N;c.lineTo(x0+u*L,yc-prof(u)*Hh/2);}for(let i=N;i>=0;i--){const u=i/N;c.lineTo(x0+u*L,yc+prof(u)*Hh/2*(flat?1:.92));}c.closePath();};
  if(sh!=='squid'&&sh!=='octo'&&sh!=='ray'){c.fillStyle=ink;outline();c.fill();
    // ひれ（尾・背・尻・胸）
    c.fillStyle='rgba(25,22,20,.75)';const fin=pts=>{c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))c.lineTo(p[0],p[1]);c.closePath();c.fill();};
    if(sh!=='eel'&&sh!=='ribbon'){fin([[x0+L*.04,yc],[x0-L*.1,yc-Hh*.55],[x0-L*.04,yc],[x0-L*.1,yc+Hh*.55]]);}
    if(!flat&&sh!=='eel'){fin([[x0+L*.3,yc-Hh*.42],[x0+L*.4,yc-Hh*.78],[x0+L*.62,yc-Hh*.55],[x0+L*.66,yc-Hh*.4]]);fin([[x0+L*.18,yc+Hh*.3],[x0+L*.24,yc+Hh*.56],[x0+L*.38,yc+Hh*.38]]);}
    // うろこ・鰭条の白抜き（墨のかすれ）
    c.strokeStyle='rgba(243,236,220,.35)';c.lineWidth=1;for(let i=0;i<220;i++){const u=.1+hash(i+31)*.8,v=(hash(i+71)-.5)*prof(u)*Hh*.85;const x=x0+u*L,y=yc+v;c.beginPath();c.arc(x,y,2+hash(i)*2,Math.PI*.2,Math.PI*.8);c.stroke();}
    // 目（白く残す）
    c.fillStyle='#f3ecdc';c.beginPath();c.arc(x0+L*.9,yc-Hh*.08,Math.max(3,Hh*.06),0,7);c.fill();}
  else{// イカ・タコ・エイ：簡単な形
    c.fillStyle=ink;c.beginPath();if(sh==='octo'){c.ellipse(x0+L*.78,yc,L*.18,Hh*.45,0,0,7);c.fill();for(let i=0;i<8;i++){c.beginPath();c.moveTo(x0+L*.62,yc+(i-3.5)*Hh*.08);c.quadraticCurveTo(x0+L*.3,yc+(i-3.5)*Hh*.2,x0+L*.02,yc+(i-3.5)*Hh*.12+Math.sin(i)*10);c.lineWidth=6-i*.3;c.strokeStyle='rgba(25,22,20,.8)';c.stroke();}}
    else if(sh==='squid'){c.moveTo(x0+L*.38,yc-Hh*.3);c.lineTo(x0+L,yc);c.lineTo(x0+L*.38,yc+Hh*.3);c.closePath();c.fill();for(let i=0;i<10;i++){c.beginPath();c.moveTo(x0+L*.38,yc+(i-4.5)*Hh*.05);c.lineTo(x0+L*(i<2?-.1:.08),yc+(i-4.5)*Hh*.09);c.lineWidth=3;c.strokeStyle='rgba(25,22,20,.8)';c.stroke();}}
    else{c.ellipse(x0+L*.6,yc,L*.3,Hh*.5,0,0,7);c.fill();c.fillRect(x0,yc-2,L*.3,4);}}
  // 文字（縦書き風に右側）と落款
  c.fillStyle='#1d1a17';const font=(n)=>`700 ${n}px "Zen Kaku Gothic New","Hiragino Mincho ProN","Noto Serif JP",serif`;c.font=font(Math.round(H*.075));c.textAlign='right';
  c.fillText(rec.name||'',W-14,H*.12);c.font=font(Math.round(H*.05));c.fillText(`${rec.cm}cm　${rec.kg>=1?rec.kg.toFixed(2)+'kg':Math.round(rec.kg*1000)+'g'}`,W-14,H*.2);
  c.textAlign='left';c.font=font(Math.round(H*.038));const lines=[rec.date||'',rec.place||'',[rec.rod,rec.reel].filter(Boolean).join('・'),rec.bait||''].filter(Boolean);lines.forEach((t,i)=>c.fillText(t,14,H*.82+i*H*.05));
  // 落款（朱）
  const sx=W-H*.16,sy=H*.82,ss=H*.12;c.fillStyle=rec.best?'#c3241d':'rgba(195,36,29,.75)';c.fillRect(sx,sy,ss,ss);c.fillStyle='#f3ecdc';c.font=font(Math.round(ss*.42));c.textAlign='center';c.fillText(rec.best?'記録':'釣',sx+ss/2,sy+ss*.62);}
const API={record,list,draw,PROF,MAX};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaGyotaku=API;
})(typeof self!=='undefined'?self:this);
