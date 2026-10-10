// 完了条件の通し確認：平塚スタート→歩く→自転車→車→燃料→駐車→ルート→セーブ→釣り
export default async (page, SP) => {
  await page.click('#hiraBtn');await page.waitForTimeout(800);
  const step=async(n,jx,jy)=>page.evaluate(([n,jx,jy])=>{const D=__D;D.setJoy(jx,jy);let t=1;for(let i=0;i<n;i++){D.update(.05,t+=.05);}D.setJoy(0,0);return{x:D.S.x,y:D.S.y};},[n,jx,jy]);
  const log=o=>console.log(JSON.stringify(o));
  let a=await page.evaluate(()=>({x:__D.S.x,y:__D.S.y,sh:window.HamaShonan.inShonan(__D.S.x,__D.S.y),surf:__D.surfaceAt(__D.S.x,__D.S.y)}));log({start:a});
  let b=await step(40,0,-1);log({walked:Math.hypot(b.x-a.x,b.y-a.y).toFixed(1)});
  // 自転車
  const r=await page.evaluate(()=>{const D=__D;D.S.money=5e6;const out={};
    for(const id of['bike_road','bike_mtb']){D.buyVeh(window.HamaVehicles.byId(id));}
    const o=D.S.veh.owned[0];const pk=D.S.veh.parked[o.uid];out.parked=!!pk;D.mount(o);out.riding=D.RIDE&&D.RIDE.sp.name;return out;});log({bike:r});
  await page.evaluate(()=>{__D.closeSheet();});
  await page.waitForTimeout(300);await page.screenshot({path:SP+'/v_bike.png'});
  // 舗装路と砂浜で速さを比べる（road / mtb）
  const sp=await page.evaluate(()=>{const D=__D,V=window.HamaVehicles,out={};for(const o of D.S.veh.owned){const res={};for(const s of['paved','sand']){const st={v:0,h:0};for(let i=0;i<200;i++)V.ride(o,st,{throttle:1},{surface:s},.05,D.S);res[s]=+st.v.toFixed(2);}out[V.specOf(o).name]=res;}D.S.veh.stamina=100;return out;});log({speeds:sp});
  a=await page.evaluate(()=>({x:__D.S.x,y:__D.S.y}));b=await step(60,0,-1);log({rode:Math.hypot(b.x-a.x,b.y-a.y).toFixed(1),surf:await page.evaluate(()=>__D.surfaceAt(__D.S.x,__D.S.y))});
  log({dismount:await page.evaluate(()=>{const D=__D;D.RIDE.st.v=0;D.dismount();return{riding:!!D.RIDE,parked:Object.keys(D.S.veh.parked).length};})});
  // 車
  const c=await page.evaluate(()=>{const D=__D,V=window.HamaVehicles;D.buyVeh(V.byId('car_kei'));const o=D.S.veh.owned.find(q=>q.id==='car_kei');const pk=D.S.veh.parked[o.uid];return{lot:pk.lotId,dist:Math.hypot(pk.x-D.S.x,pk.y-D.S.y).toFixed(0),route:D.NAVR&&D.NAVR.legs.length};});log({car:c});
  const d=await page.evaluate(()=>{const D=__D;const o=D.S.veh.owned.find(q=>q.id==='car_kei');const pk=D.S.veh.parked[o.uid];D.S.x=pk.x;D.S.y=pk.y;D.updChunks(true);D.mount(o);const f0=o.fuel;
    // 道路に向けて走る：一番近い車道の点の方へ向きを合わせる
    const ne=window.HamaRouting.nearestEdge(D.NET.G,D.S.x,D.S.y,'car');const A=D.NET.G.nodes[ne.e.a],B=D.NET.G.nodes[ne.e.b];D.RIDE.st.h=Math.atan2(B.x-A.x,B.y-A.y);D.setYaw(D.RIDE.st.h+Math.PI);
    const x0=D.S.x,y0=D.S.y;let t=1;D.setJoy(0,-1);for(let i=0;i<400;i++)D.update(.05,t+=.05);D.setJoy(0,0);
    return{f0,f1:o.fuel,moved:Math.hypot(D.S.x-x0,D.S.y-y0).toFixed(0),onRoad:!!D.NET.M.at(D.S.x,D.S.y),v:D.RIDE.st.v.toFixed(1)};});log({drive:d});
  await page.screenshot({path:SP+'/v_car.png'});
  // 道の外へ：海の方（南）へ向けても出られない
  const e=await page.evaluate(()=>{const D=__D;let bad=0;D.RIDE.st.h=0;let t=1;D.setJoy(0,-1);for(let i=0;i<300;i++){D.update(.05,t+=.05);if(!D.carOk(D.S.x,D.S.y))bad++;}D.setJoy(0,0);return{bad,onRoad:!!D.NET.M.at(D.S.x,D.S.y)};});log({offroad:e});
  // ルート：釣り場へ
  const f=await page.evaluate(()=>{const D=__D;const sp=window.HamaShonan.GSPOTS.find(g=>g.id==='shinko_east');D.setDest({x:sp.x,y:sp.y,name:sp.name,spot:'shinko_east'});return D.plans(D.S.veh.dest).map(p=>({m:p.mode,fail:p.fail,min:p.time&&Math.round(p.time/60),len:p.len&&Math.round(p.len),lot:p.lot&&p.lot.name}));});log({plans:f});
  await page.evaluate(()=>{__D.openMenu();__D.setTab('map','nav');__D.renderTab();});await page.waitForTimeout(300);await page.screenshot({path:SP+'/v_nav.png'});
  await page.evaluate(()=>{__D.setTab('veh');__D.renderTab();});await page.waitForTimeout(200);await page.screenshot({path:SP+'/v_veh.png'});
  await page.evaluate(()=>{__D.closeSheet();});
  // セーブ・ロード
  const g=await page.evaluate(()=>{const D=__D;D.save();const before={x:D.S.x,y:D.S.y,veh:JSON.stringify(D.S.veh)};D.start(true);return{same:before.veh===JSON.stringify(D.S.veh),pos:Math.hypot(before.x-D.S.x,before.y-D.S.y)<.01,riding:D.RIDE&&D.RIDE.sp.name};});log({saveload:g});
};
