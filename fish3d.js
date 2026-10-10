/* 魚の3Dモデル（window.HamaFish3D）。魚種データの見た目（look：体型 shape・体高 aspect・背と腹の色・模様 pattern）から、
   胴体（輪切りを並べた形）・ひれ（背・尻・胸・腹・尾）・目・模様の絵（背→腹の色の移り変わり、斑点・線・横帯・縦縞・まだら・波・うろこ）を作る。
   形は「その魚種の体型の特徴」を表す簡略モデル（写真や実物の3Dスキャンではない）。大きさは体長 L（m）に合わせる。
   泳ぎ・暴れ：頂点シェーダーで体をくねらせる（尾ほど大きく）。setSwim(振幅, 速さ) で変える。
   体型：fish（ふつう）・needle（サヨリ・ダツ）・ribbon（タチウオ）・eel（アナゴ・ウツボ・ウナギ）・flat（ヒラメ・カレイ）・ray（エイ）・squid（イカ）・octo（タコ） */
(function(root){
'use strict';
const T=root.THREE||(typeof require==='function'?require('three'):null);
const U={uTime:{value:0}};
function hash(i){let h=(i*374761393)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296;}
// 模様の絵（u＝体の長さ方向 0尾→1頭、v＝周り 0腹→0.5背→1腹）
function skin(look,seed){const W=256,H=128;let cv;if(typeof OffscreenCanvas!=='undefined')cv=new OffscreenCanvas(W,H);else if(typeof document!=='undefined'){cv=document.createElement('canvas');cv.width=W;cv.height=H;}else return null;
  const c=cv.getContext('2d');const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,look.belly);g.addColorStop(.3,look.belly);g.addColorStop(.42,look.back);g.addColorStop(.58,look.back);g.addColorStop(.7,look.belly);g.addColorStop(1,look.belly);c.fillStyle=g;c.fillRect(0,0,W,H);
  const R=k=>hash(seed*97+k);c.fillStyle='rgba(0,0,0,.28)';const P=look.pattern||'plain';let k=0;
  const top=(y)=>H*(.5+(y-.5)*.9);
  if(P==='dots'||P==='dots2'){for(let i=0;i<70;i++){const x=R(k++)*W,y=top(.3+R(k++)*.4),r=1+R(k++)*(P==='dots2'?3.5:2);c.beginPath();c.arc(x,y,r,0,7);c.fill();}}
  else if(P==='mottle'){for(let i=0;i<46;i++){const x=R(k++)*W,y=top(.25+R(k++)*.5),r=4+R(k++)*10;c.globalAlpha=.35;c.beginPath();c.ellipse(x,y,r*1.4,r,0,0,7);c.fill();}c.globalAlpha=1;}
  else if(P==='bars'){for(let i=1;i<7;i++){const x=W*(.12+i*.13);c.fillRect(x-5,H*.28,10,H*.44);}}
  else if(P==='stripe'||P==='stripe2'){const n=P==='stripe2'?2:3;for(let i=0;i<n;i++){const y=H*(.36+i*.1);c.fillRect(0,y,W,3);}}
  else if(P==='line'){c.fillStyle='rgba(0,0,0,.35)';c.fillRect(W*.05,H*.47,W*.85,2);c.fillRect(W*.05,H*.53,W*.85,2);}
  else if(P==='wave'){c.strokeStyle='rgba(0,0,0,.4)';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();const x=W*(.1+i*.06);for(let y=H*.4;y<H*.6;y+=3)c.lineTo(x+Math.sin(y*.3+i)*4,y);c.stroke();}}
  else if(P==='scribble'){c.strokeStyle='rgba(0,0,0,.3)';c.lineWidth=1.5;for(let i=0;i<18;i++){c.beginPath();let x=R(k++)*W,y=top(.3+R(k++)*.4);c.moveTo(x,y);for(let j=0;j<5;j++){x+=(R(k++)-.5)*20;y+=(R(k++)-.5)*10;c.lineTo(x,y);}c.stroke();}}
  // うろこ：細かい菱形の明暗
  c.globalAlpha=.07;c.strokeStyle='#ffffff';for(let x=0;x<W;x+=6)for(let y=0;y<H;y+=5){c.beginPath();c.moveTo(x,y);c.lineTo(x+3,y+2.5);c.lineTo(x,y+5);c.stroke();}c.globalAlpha=1;
  const tx=new T.CanvasTexture(cv);tx.anisotropy=2;return tx;}
// 体をくねらせる材質（x＝長さ方向。尾＝0、頭＝L）
function swimMat(params,L,amp){const m=new T.MeshPhongMaterial(params);const P={uAmp:{value:amp},uFreq:{value:7},uL:{value:L}};m.userData.P=P;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U,P);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime,uAmp,uFreq,uL;').replace('#include <begin_vertex>',
    '#include <begin_vertex>\nfloat sw=1.-clamp(position.x/uL,0.,1.);transformed.z+=sin(uTime*uFreq-position.x/uL*5.)*uAmp*uL*sw*sw;');};
  m.customProgramCacheKey=()=>'fishswim';return m;}
// 輪切りを並べた胴体。prof(u)＝高さの割合、wr＝幅/高さ
function bodyGeo(L,H,prof,wr,N,M){const pos=[],uv=[],idx=[];for(let i=0;i<=N;i++){const u=i/N,h=Math.max(.002,prof(u))*H;for(let j=0;j<=M;j++){const a=j/M*Math.PI*2;pos.push(u*L,-Math.cos(a)*h/2,Math.sin(a)*h/2*wr(u));uv.push(u,j/M);}}
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*(M+1)+j,b=a+M+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
// ひれ：点の並び（x,y）を厚みのない面に
function finGeo(pts){const s=new T.Shape();s.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))s.lineTo(p[0],p[1]);return new T.ShapeGeometry(s);}
const PROF={
  fish:u=>u<.12?.16+u*1.4:u<.62?.33+.67*Math.sin((u-.12)/.5*Math.PI/2):Math.max(.05,Math.cos((u-.62)/.38*Math.PI/2)**.8),
  needle:u=>u<.1?.25:u<.85?.9-.2*Math.abs(u-.5):Math.max(.05,(1-u)/.15*.8),
  ribbon:u=>u<.05?.1:Math.min(1,u*1.3)*(u>.92?(1-u)/.08:1),
  eel:u=>u<.05?.5:u>.94?Math.max(.1,(1-u)/.06):1,
  flat:u=>u<.12?.25:u<.7?.7+.3*Math.sin((u-.12)/.58*Math.PI):Math.max(.1,Math.cos((u-.7)/.3*Math.PI/2))};
function build(look,opt){opt=opt||{};const L=opt.L||.3,seed=opt.seed||1;const shape=look.shape||'fish',asp=look.aspect||.25;const G=new T.Group();G.userData.L=L;
  const tex=skin(look,seed);const back=new T.Color(look.back),belly=new T.Color(look.belly);
  const mat=swimMat({color:0xffffff,map:tex,specular:0x9aa8b0,shininess:shape==='squid'||shape==='octo'?20:70},L,shape==='eel'||shape==='needle'||shape==='ribbon'?.09:.05);
  const finMat=swimMat({color:back.clone().multiplyScalar(.85),side:T.DoubleSide,transparent:true,opacity:.82,shininess:20},L,.05);const mats=[mat,finMat];
  const add=(geo,m)=>{const me=new T.Mesh(geo,m);me.castShadow=true;G.add(me);return me;};
  const eye=(x,y,z,r)=>{const e=new T.Mesh(new T.SphereGeometry(r,10,8),new T.MeshPhongMaterial({color:0x0b0b0b,shininess:120,specular:0xffffff}));e.position.set(x,y,z);G.add(e);const w=new T.Mesh(new T.SphereGeometry(r*1.35,10,8),new T.MeshPhongMaterial({color:0xd8d2b0}));w.position.set(x,y,z*.98);w.scale.set(1,1,.4);G.add(w);};
  if(shape==='squid'){const H=asp*L;const mantle=add(bodyGeo(L*.62,H,u=>u<.08?.7+u*3.5:Math.max(.04,1-(u-.08)/.92*.96),()=>1,18,14),mat);mantle.position.x=L*.38;// 胴（外套膜）は先がとがる
      const fn=add(finGeo([[L*.72,0],[L*.92,H*.75],[L*1,0],[L*.92,-H*.75]]),finMat);fn.rotation.x=Math.PI/2;// 先端のひれ
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2,len=L*(i<2?.55:.32);const arm=add(new T.CylinderGeometry(.004*L*10,.002*L*5,len,6).rotateZ(Math.PI/2).translate(-len/2,0,0),mat);arm.position.set(L*.38,Math.cos(a)*H*.18,Math.sin(a)*H*.18);arm.rotation.y=(hash(i+seed)-.5)*.3;}
      eye(L*.4,H*.2,H*.38,H*.12);}
  else if(shape==='octo'){const H=asp*L;const head=add(new T.SphereGeometry(H*.55,16,12),mat);head.scale.set(1.3,1,1);head.position.x=L*.75;
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2,pts=[];for(let k=0;k<=10;k++){const t=k/10;pts.push(new T.Vector3(L*.6-t*L*.6,Math.cos(a)*H*.4*(1+t*.6)-t*H*.2,Math.sin(a)*H*.4*(1+t*.6)+Math.sin(t*6+i)*H*.08));}
        add(new T.TubeGeometry(new T.CatmullRomCurve3(pts),12,H*.07,6),mat);}
      eye(L*.8,H*.35,H*.42,H*.07);}
  else if(shape==='ray'){const W=L*.55;const disc=add(new T.SphereGeometry(1,20,10),mat);disc.scale.set(W*.7,L*.06,W);disc.position.x=L*.6;
      add(new T.CylinderGeometry(L*.004,L*.012,L*.55,6).rotateZ(Math.PI/2).translate(L*.27,0,0),mat);eye(L*.85,L*.05,W*.15,L*.02);}
  else{const flat=shape==='flat';const prof=PROF[shape]||PROF.fish;
    const H=flat?L*asp:L*asp,wr=flat?(()=>.18):shape==='ribbon'?(()=>.25):shape==='eel'?(()=>.85):shape==='needle'?(()=>.8):(u=>.42+.1*Math.sin(u*Math.PI));
    const body=add(bodyGeo(L,H,prof,wr,26,16),mat);if(flat)body.rotation.x=Math.PI/2;// ヒラメ・カレイは横に寝た平たい体
    const fin=(pts,rx)=>{const m=add(finGeo(pts),finMat);if(rx)m.rotation.x=rx;if(flat)m.rotation.x+=Math.PI/2;return m;};
    if(shape==='eel'){fin([[0,0],[L*.15,H*.6],[L*.7,H*.5],[L*.7,0]]);fin([[0,0],[L*.15,-H*.6],[L*.5,-H*.5],[L*.5,0]]);}
    else if(shape==='ribbon'){fin([[L*.05,H*.3],[L*.9,H*.75],[L*.9,H*.45]]);}
    else{// 尾びれ（二又）・背びれ・尻びれ・胸びれ・腹びれ
      const t=H*(flat?.7:shape==='needle'?.9:1.05);fin([[L*.04,0],[-L*.1,t*.55],[-L*.05,0],[-L*.1,-t*.55]]);
      if(flat){fin([[L*.1,H*.48],[L*.85,H*.52],[L*.85,H*.4],[L*.1,H*.36]]);fin([[L*.1,-H*.48],[L*.8,-H*.52],[L*.8,-H*.4],[L*.1,-H*.36]]);}
      else{fin([[L*.3,H*.44],[L*.4,H*.78],[L*.62,H*.55],[L*.66,H*.42]]);fin([[L*.18,-H*.3],[L*.24,-H*.55],[L*.38,-H*.38]]);
        const pc=new T.Mesh(finGeo([[0,0],[-L*.12,H*.12],[-L*.1,-H*.1]]),finMat);pc.position.set(L*.74,-H*.1,H*.22);pc.rotation.y=-.5;G.add(pc);
        const pv=new T.Mesh(finGeo([[0,0],[-L*.08,-H*.12],[-L*.03,-H*.02]]),finMat);pv.position.set(L*.6,-H*.36,0);G.add(pv);}}
    if(flat)eye(L*.88,H*.13,H*.1,H*.06);else{const ez=H*(shape==='needle'?.32:.17);eye(L*.9,H*.08,ez,H*.075);eye(L*.9,H*.08,-ez,H*.075);}}
  G.userData.mats=mats;G.userData.setSwim=(amp,freq)=>{for(const m of mats){m.userData.P.uAmp.value=amp;if(freq)m.userData.P.uFreq.value=freq;}};
  G.userData.dispose=()=>{G.traverse(o=>{if(o.isMesh){o.geometry.dispose();}});if(tex)tex.dispose();for(const m of mats)m.dispose();};
  return G;}
function update(t){U.uTime.value=t;}
const API={build,update,PROF,skin};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaFish3D=API;
})(typeof self!=='undefined'?self:this);
