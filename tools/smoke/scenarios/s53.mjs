export default async (page, SP) => {
  // 古いセーブ（手描きの横浜・mapv 2）：本牧海づり施設の近く、車を大黒に停めている
  await page.evaluate(()=>{const s={money:9999,rod:0,bait:'sabiki',isome:10,lure:0,egi:0,tk:{},eq:null,dex:{},stamps:{},base:Date.now(),day:3,min:600,x:4300,y:3756,tip:{},mapv:2,
    veh:{owned:[{uid:1,id:'car_compact',fuel:30,dur:100}],parked:{1:{x:4000,y:2430,region:'yokohama'}},dest:{x:4372,y:3756,name:'本牧'},cool:null}};localStorage.setItem('hama-tsuri-v2',JSON.stringify(s));});
  await page.reload();await page.waitForTimeout(1500);
  await page.click('#contBtn');await page.waitForTimeout(1500);
  console.log(JSON.stringify(await page.evaluate(()=>{const D=__D;return{err:document.getElementById('bootErr')?.textContent||'no error',x:Math.round(D.S.x),y:Math.round(D.S.y),mapv:D.S.mapv,walk:D.walk(D.S.x,D.S.y),parked:D.S.veh.parked,dest:D.S.veh.dest};})));
  // バスで横浜駅へ
  const r=await page.evaluate(()=>{const D=__D;const cur=D.nearestStation()[0];const rs=D.routesFrom(cur);return{cur:cur.n,dests:rs.map(o=>o.s.n)};});console.log(JSON.stringify(r));
};
