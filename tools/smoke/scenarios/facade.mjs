// 外壁の見た目：みなとみらい（昼・夜）、山手の住宅地（三角屋根）、関内（店先）
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(500);
  const shot=async(name,x,y,yaw,pitch,min)=>{await page.evaluate(([x,y,yaw,pitch,min])=>{const D=__D;Object.assign(D.S,{x,y,min});D.updChunks(true);D.setYaw(yaw);D.setPitch(pitch);D.snapCam();},[x,y,yaw,pitch,min]);
    for(let k=0;k<7;k++){await page.evaluate(()=>{let t=performance.now()/1000;for(let i=0;i<3;i++){t+=.05;__D.update(.05,t);__D.render(.05,t);}});await page.waitForTimeout(300);}await page.screenshot({path:`${SP}/${name}.png`});};
  await shot('f_mm_day',9020,-3700,2.6,-.35,13*60);
  await shot('f_mm_night',9020,-3700,2.6,-.35,20*60);
  await shot('f_yamate',10500,-1880,1.2,.35,10*60);
  await shot('f_kannai',9260,-2800,0.3,-.05,15*60);
  console.log(await page.evaluate(()=>document.getElementById('bootErr')?.textContent||'no error'));
};
