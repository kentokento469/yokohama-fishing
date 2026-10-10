// ファイトUI（390×844）：HUD は上部（中央を空ける）・他の表示と重ならない・危険で赤と「今すぐ離せ」・緩みで青・カメラに竿と人が入る・2本目の指で途切れない
export default async (page, SP) => {
  await page.setViewportSize({width:390,height:844});await page.click('#newBtn');
  const step=(n)=>page.evaluate((n)=>{let t=performance.now()/1000;for(let i=0;i<n;i++){t+=.05;__D.update(.05,t);}return {st:__D.F.st};},n);
  await page.evaluate(()=>{const D=__D,T=window.HamaTackleData;const it=T.find(t=>t.style==='shore_standard'&&t.weightG===20)||T.find(t=>t.cat==='jig');D.S.tk[it.id]=50;D.S.eq=it.id;D.S.bait=window.HamaSim.baitClassOf(it);});
  let s;for(let k=0;k<15;k++){await page.evaluate(()=>{const D=__D;Object.assign(D.S,{x:13963.4,y:-972.4,min:7*60,day:3});D.F.st='idle';D.updChunks(false);D.snapCam();D.mainDown();});await step(14);await page.evaluate(()=>__D.mainUp());await step(19);
    for(let i=0;i<60;i++){await page.evaluate(()=>{const D=__D;if(D.F.st==='wait'&&!D.F.reelHold){D.S.spd=.8;D.mainDown();}});s=await step(10);if(s.st!=='wait')break;}
    if(s.st==='bite'){await page.evaluate(()=>{__D.mainUp();__D.mainDown();});await step(1);await page.evaluate(()=>__D.mainUp());s=await step(2);}
    if(s.st==='fight')break;await page.evaluate(()=>{__D.F.st='idle';__D.mainUp();});}
  await step(30);
  const r=await page.evaluate(()=>{const D=__D,H=innerHeight,rc=id=>document.getElementById(id).getBoundingClientRect();const f=rc('fight'),cl=rc('clock'),tr=rc('trRow'),mb=rc('mainBtn');
    const o={st:D.F.st,top:f.top<H*.25,bottom:f.bottom<H*.3,noOverlap:f.top>=cl.bottom-1&&f.top>=tr.bottom-1,miniHidden:getComputedStyle(document.getElementById('mini')).display==='none'};
    // 危険：テンションを限界の98%に
    D.F.hold=true;D.F.ten=D.F.lineKg*.98;D.updUI();o.danger=document.getElementById('fight').classList.contains('s-danger')&&document.getElementById('cue').textContent.startsWith('今すぐ離せ')&&document.getElementById('mainBtn').classList.contains('dg');
    // 緩み
    D.F.hold=false;D.F.ten=.05;D.F.fg.slack=1.2;D.updUI();o.slack=document.getElementById('fight').classList.contains('s-slack')&&document.getElementById('cue').textContent.startsWith('糸が緩んでいる');
    const cu=rc('cue');o.cueTop=cu.top<H*.35;o.btnNoText=!/[ぁ-んァ-ン一-龥]/.test(document.getElementById('mainTxt').textContent);
    // カメラ：人と竿が近くに写る（3〜8m）
    o.camD=+Math.hypot(D.camera.position.x-D.S.x,D.camera.position.z-D.S.y).toFixed(1);return o;});
  // マルチタッチ：押している指とは別の指を離しても巻き続ける
  const mt=await page.evaluate(()=>{const D=__D,b=document.getElementById('mainBtn');const ev=(type,id)=>b.dispatchEvent(new PointerEvent(type,{pointerId:id,bubbles:true,clientX:300,clientY:760}));
    D.F.fg.slack=0;ev('pointerdown',1);const h1=!!D.F.hold;ev('pointerdown',2);ev('pointerup',2);const h2=!!D.F.hold;ev('pointerup',1);const h3=!!D.F.hold;return{h1,h2,h3};});
  console.log('fightui',JSON.stringify(Object.assign(r,mt)));
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
