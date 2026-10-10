// 横浜と湘南で同じ操作をして、共通機能の差が無いか（歩く・釣り場・投げて巻く→アタリ・釣具の購入・地面・NPC・駅と移動・地図・セーブ）
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(400);
  const step=n=>page.evaluate(n=>{let t=performance.now()/1000;for(let i=0;i<n;i++){t+=.05;__D.update(.05,t);}return{st:__D.F.st,fish:__D.F.fish};},n);
  for(const[rg,id]of[['yokohama','honmoku'],['shonan','shinko_south'],['shonan','katase_west']]){
    const base=await page.evaluate(([id])=>{const D=__D,sp=D.SPOTS.find(s=>s.id===id);Object.assign(D.S,{x:sp.x,y:sp.y,min:7*60,day:3,money:5000});D.F.st='idle';D.updChunks(true);D.snapCam();
      const T=window.HamaTackleData,it=T.find(t=>t.style==='shore_standard'&&t.weightG===20)||T.find(t=>t.cat==='jig');const lv=1;const b=window.HamaTackle.buy(D.S,it,3,99);D.S.eq=it.id;D.S.bait=window.HamaSim.baitClassOf(it);
      return{walk:D.walk(sp.x,sp.y),region:D.regionAtF(sp.x,sp.y),surface:D.surfaceAt(sp.x,sp.y),buy:!!(b&&b.ok),money:D.S.money};},[id]);
    await step(30);const near=await page.evaluate(()=>__D.nearSpot&&__D.nearSpot.id);
    const r={};for(let k=0;k<5;k++){await page.evaluate(([id])=>{const D=__D,sp=D.SPOTS.find(s=>s.id===id);Object.assign(D.S,{x:sp.x,y:sp.y,min:7*60,day:3});D.setYaw(-Math.PI/2-D.waterDir(sp.x,sp.y,sp.dir));D.F.st='idle';D.updChunks(false);D.mainDown();},[id]);await step(14);await page.evaluate(()=>__D.mainUp());await step(19);
      let s;for(let i=0;i<60;i++){await page.evaluate(()=>{const D=__D;if(D.F.st==='wait'&&!D.F.reelHold){D.S.spd=.8;D.mainDown();}});s=await step(10);if(s.st!=='wait')break;}
      const key=s.st==='bite'||s.st==='fight'?'bite':s.st;r[key]=(r[key]||0)+1;await page.evaluate(()=>{__D.F.st='idle';__D.mainUp();});}
    await step(60);
    const after=await page.evaluate(([id])=>{const D=__D,sp=D.SPOTS.find(s=>s.id===id);D.S.x=sp.x;D.S.y=sp.y;const[st,d]=D.nearestStation();let npc=0;for(const c of D.CARS)if(c.on)npc++;for(const p of D.PEDS)if(p.on)npc++;
      let mini=true;try{D.drawMini();}catch(e){mini=String(e);}let wm=true;try{D.openWorld();D.closeWorld();}catch(e){wm=String(e);}
      const i=D.STATIONS.indexOf(st),to=D.routesFrom(st)[0];let tr=false;if(to){D.S.x=st.x;D.S.y=st.y;D.S.money=99999;D.travel(to.i);tr=D.walk(D.S.x,D.S.y)&&D.regionAtF(D.S.x,D.S.y)===st.region;}
      D.save();const L=D.load();return{station:st&&st.n,stD:Math.round(d),travel:tr,npc,mini,wm,saved:!!L&&Math.abs(L.x-D.S.x)<.01};},[id]);
    console.log('parity_'+rg+'_'+id,JSON.stringify(Object.assign(base,{near},r,after)));}
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
