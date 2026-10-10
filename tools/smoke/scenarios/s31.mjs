// 横浜（本牧）でルアーを装備して投げ、巻く：アタリ・根掛かりの数（回帰確認）
export default async (page, SP) => {
  await page.click('#newBtn');
  const step=(n)=>page.evaluate((n)=>{let t=performance.now()/1000;for(let i=0;i<n;i++){t+=.05;__D.update(.05,t);}return {st:__D.F.st,fish:__D.F.fish};},n);
  await page.evaluate(()=>{const D=__D,T=window.HamaTackleData;const it=T.find(t=>t.style==='shore_standard'&&t.weightG===20)||T.find(t=>t.cat==='jig');D.S.tk[it.id]=50;D.S.eq=it.id;D.S.bait=window.HamaSim.baitClassOf(it);});
  const r={};for(let k=0;k<10;k++){await page.evaluate(()=>{const D=__D;const sp=D.spotAt?null:null;Object.assign(D.S,{x:13963.4,y:-972.4,min:7*60,day:3});D.F.st='idle';D.updChunks(false);D.mainDown();});await step(14);await page.evaluate(()=>__D.mainUp());await step(19);
    let s;for(let i=0;i<60;i++){await page.evaluate(()=>{const D=__D;if(D.F.st==='wait'&&!D.F.reelHold){D.S.spd=.8;D.mainDown();}});s=await step(10);if(s.st!=='wait')break;}
    const key=s.st==='bite'||s.st==='fight'?'bite:'+s.fish:s.st;r[key]=(r[key]||0)+1;await page.evaluate(()=>{__D.F.st='idle';__D.mainUp();});}
  console.log('lure honmoku',JSON.stringify(r),await page.evaluate(()=>__D.nearSpot&&__D.nearSpot.id));
};
