// 関東の近景（横浜・湘南の外）：横須賀中央・箱根湯本へワールドマップの「散策に行く」と同じ処理で移動し、地面の高さ・陸・チャンクを確認して撮る
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(500);
  const go=async(name,lat,lon,yaw,pitch)=>{const r=await page.evaluate(async([lat,lon])=>{const D=__D;D.S.money=1e6;D.S.min=10*60;const[x,y]=window.HamaGeo.toGame(lat,lon);await D.kantoGo(x,y);
      return{rg:D.regionAt(D.S.x,D.S.y),land:D.isLand(D.S.x,D.S.y),gy:+D.groundY(D.S.x,D.S.y).toFixed(1),moved:Math.round(Math.hypot(D.S.x-x,D.S.y-y))};},[lat,lon]);
    await page.evaluate(([yaw,pitch])=>{__D.setYaw(yaw);__D.setPitch(pitch);__D.snapCam();},[yaw,pitch]);
    for(let k=0;k<16;k++){await page.evaluate(()=>{let t=performance.now()/1000;for(let i=0;i<3;i++){t+=.4;__D.update(.05,t);__D.render(.4,t);}});await page.waitForTimeout(500);}
    r.chunks=await page.evaluate(()=>{let n=0,p=0;for(const g of __D.chunks.values()){n++;if(g.userData.pending)p++;}return n+'/'+p+'pending';});
    await page.screenshot({path:`${SP}/${name}.png`});console.log(name,JSON.stringify(r));};
  await go('kanto_yokosuka',35.2785,139.6705,0,.25);
  await go('kanto_hakone',35.2325,139.1055,Math.PI/2,-.05);
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
