// 港・海岸：本牧ふ頭の岸壁（縁石・係船柱）、本牧海づり施設、湘南の漁港（漁船）
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(500);
  const shot=async(name,x,y,yaw,pitch,min)=>{await page.evaluate(([x,y,yaw,pitch,min])=>{const D=__D;Object.assign(D.S,{x,y,min});D.updChunks(true);D.setYaw(yaw);D.setPitch(pitch);D.snapCam();},[x,y,yaw,pitch,min]);
    for(let k=0;k<7;k++){await page.evaluate(()=>{let t=performance.now()/1000;for(let i=0;i<3;i++){t+=.05;__D.update(.05,t);__D.render(.05,t);}});await page.waitForTimeout(300);}await page.screenshot({path:`${SP}/${name}.png`});};
  const q=await page.evaluate(()=>{const W=window.HamaWorld.create(window.HamaWorldData.yokohama);const c=W.nearestCoast(13300,-1600,300);return c?[c.x-c.nx*3,c.y-c.ny*3,Math.atan2(-c.nx,-c.ny)]:null;});
  if(q)await shot('h_quay',q[0],q[1],q[2],.35,10*60);
  await shot('h_honmoku',13990,-1030,2.6,.3,15*60);
  const p=await page.evaluate(()=>{const g=window.HamaShonan.GSPOTS.find(s=>s.type==='port');return[g.x,g.y];});
  await shot('h_port',p[0],p[1],0,.45,9*60);
  console.log(await page.evaluate(()=>document.getElementById('bootErr')?.textContent||'no error'));
};
