// 手と釣り具：竿を握る手はリールシート、回す手はノブに実際に触れているか（手の模型の位置で測る）。
// 待機・巻く（ハンドルが回っても離れない）・投げた後・ファイト・竿の長さ違い・ベイトリール・ハンドルの左右
export default async (page, SP) => {
  await page.setViewportSize({width:390,height:844});await page.click('#newBtn');
  const step=(n)=>page.evaluate((n)=>{let t=performance.now()/1000;for(let i=0;i<n;i++){t+=.05;__D.update(.05,t);}return __D.F.st;},n);
  const meas=()=>page.evaluate(()=>{const D=__D;const t=performance.now()/1000;D.poseFishing(t);D.updRod(t);D.updRod(t+.016);const A=D.ARM,RS=D.RS;if(!A||!RS.rodTarget)return null;const v=new D.P.position.constructor();D.P.updateMatrixWorld(true);
    const rh=D.RIG?null:null;const sd=window.HamaRig.handSides(D.TBYID.get(D.S.reelId),D.S.handle);
    A[sd.rodHand].hand.getWorldPosition(v);const eR=v.distanceTo(RS.rodTarget);let eC=null,eK=null;if(RS.crankTarget){A[sd.crankHand].hand.getWorldPosition(v);eC=v.distanceTo(RS.crankTarget);eK=v.distanceTo(RS.knob);}
    return{st:D.F.st,rod:+eR.toFixed(3),crank:eC==null?null:+eC.toFixed(3),knob:eK==null?null:+eK.toFixed(3),rodHand:sd.rodHand};});
  const out={};
  await page.evaluate(()=>{const D=__D,T=window.HamaTackleData;const it=T.find(t=>t.style==='shore_standard'&&t.weightG===20);D.S.tk[it.id]=50;D.S.eq=it.id;D.S.bait=window.HamaSim.baitClassOf(it);Object.assign(D.S,{x:13963.4,y:-972.4,min:7*60,day:3});D.F.st='idle';D.updChunks(false);D.snapCam();});
  await step(10);out.idle=await meas();
  // 投げて巻く（ハンドルが回る間ずっと）
  await page.evaluate(()=>__D.mainDown());await step(14);out.aim=await meas();await page.evaluate(()=>__D.mainUp());await step(6);out.fly=await meas();await step(16);out.afterCast=await meas();
  let worst=0;for(let i=0;i<12;i++){await page.evaluate(()=>{const D=__D;if(D.F.st==='wait'&&!D.F.reelHold){D.S.spd=1;D.mainDown();}});await step(3);const m=await meas();if(m&&m.crank!=null&&m.st==='wait')worst=Math.max(worst,m.crank);out.reelSamples=(out.reelSamples||[]).concat(m?[m.crank]:[]);}
  out.reelWorst=+worst.toFixed(3);out.reelTurned=await page.evaluate(()=>Math.abs(__D.reel.userData.handle.rotation.x)>.5);
  // ファイト：掛けるまで投げ直し、巻いている間の手の位置
  let st='';for(let k=0;k<15&&st!=='fight';k++){await page.evaluate(()=>{const D=__D;D.F.st='idle';D.mainUp();Object.assign(D.S,{x:13963.4,y:-972.4,min:7*60,day:3});D.snapCam();D.mainDown();});await step(14);await page.evaluate(()=>__D.mainUp());await step(19);
    for(let i=0;i<60;i++){await page.evaluate(()=>{const D=__D;if(D.F.st==='wait'&&!D.F.reelHold){D.S.spd=.8;D.mainDown();}});st=await step(10);if(st!=='wait')break;}
    if(st==='bite'){await page.evaluate(()=>{__D.mainUp();__D.mainDown();});await step(1);await page.evaluate(()=>__D.mainUp());st=await step(2);}}
  let fw=0,fr=0,fn=0;if(st==='fight'){await page.evaluate(()=>__D.mainDown());for(let i=0;i<10;i++){await step(2);const m=await meas();if(m&&m.st==='fight'){fn++;fw=Math.max(fw,m.crank);fr=Math.max(fr,m.rod);}}}
  out.fight={n:fn,rodWorst:+fr.toFixed(3),crankWorst:+fw.toFixed(3)};
  await page.evaluate(()=>{__D.F.st='idle';__D.mainUp();});await step(4);
  // 竿の長さ違い・ベイト・右ハンドル
  const rods=await page.evaluate(()=>{const T=window.HamaTackleData;const r=T.filter(t=>t.cat==='rod').sort((a,b)=>a.lengthM-b.lengthM);const bait=T.find(t=>t.cat==='reel'&&t.reelType==='baitcast');const spin=T.find(t=>t.cat==='reel'&&t.reelType==='spinning');return{short:r[0].id,long:r[r.length-1].id,bait:bait&&bait.id,spin:spin.id};});
  for(const[k,cfg]of[['shortRod',{rodId:rods.short}],['longRod',{rodId:rods.long}],['baitReel',{reelId:rods.bait}],['rightHandle',{reelId:rods.spin,handle:'R'}]]){await page.evaluate(c=>{Object.assign(__D.S,c);},cfg);await step(12);out[k]=await meas();}
  console.log('rig',JSON.stringify(out));
  await page.evaluate(()=>{__D.S.handle=undefined;});
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
