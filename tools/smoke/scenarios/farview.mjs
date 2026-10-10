// 遠景：茅ヶ崎の海岸から西（箱根・富士山の方向）、横浜・山下公園付近から南西
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(500);
  const shot=async(name,x,y,yaw,pitch,min)=>{await page.evaluate(([x,y,yaw,pitch,min])=>{const D=__D;Object.assign(D.S,{x,y,min});D.updChunks(true);D.setYaw(yaw);D.setPitch(pitch);D.snapCam();},[x,y,yaw,pitch,min]);
    for(let k=0;k<14;k++){await page.evaluate(()=>{let t=performance.now()/1000;for(let i=0;i<3;i++){t+=.4;__D.update(.05,t);__D.render(.4,t);}});await page.waitForTimeout(500);}await page.screenshot({path:`${SP}/${name}.png`});};
  const[cx,cy]=await page.evaluate(()=>window.HamaGeo.toGame(35.318,139.405,window.HamaGeo.SHONAN));
  await shot('far_chigasaki',cx,cy+150,Math.PI/2-.25,-.12,10*60);
  await shot('far_yokohama',10480,-2950,2.3,-.1,10*60);
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
