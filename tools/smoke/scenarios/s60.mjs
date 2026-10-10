export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(500);
  const out=await page.evaluate(async()=>{const D=__D;const res=[];for(const sp of D.SPOTS.filter(s=>s.region==='yokohama')){Object.assign(D.S,{x:sp.x,y:sp.y,min:9*60,day:3});D.F.st='idle';D.updChunks(true);let t=1;for(let i=0;i<4;i++){t+=.05;D.update(.05,t);}
    const sa=D.spotAt?D.spotAt(sp.x,sp.y):null;res.push([sp.id,Math.round(sp.x),Math.round(sp.y),D.walk(sp.x,sp.y),D.nearSpot&&D.nearSpot.id,sa&&sa.id]);}return res;});
  console.log(JSON.stringify(out));
};
