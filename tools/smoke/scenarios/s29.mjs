// 車で来て駐車→歩いて釣り場へ→サビキで釣る。乗ったままは釣れない
export default async (page, SP) => {
  await page.click('#hiraBtn');await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const D=__D,V=window.HamaVehicles,out={};D.S.money=5e6;D.S.min=9*60;D.buyVeh(V.byId('car_compact'));D.closeSheet();
    const o=D.S.veh.owned[0];const pk=D.S.veh.parked[o.uid];D.S.x=pk.x;D.S.y=pk.y;D.updChunks(true);D.mount(o);
    const g=window.HamaShonan.GSPOTS.find(s=>s.id==='shinko_south');
    // 乗ったまま釣り場の印の近くでは「投げる」が出ない
    out.lot=pk.lotId;D.dismount();out.parked=!D.RIDE&&!!D.S.veh.parked[o.uid];
    // 歩く
    D.setDest({x:g.x,y:g.y,name:'t',spot:'shinko_south'});const pl=D.plans(D.S.veh.dest)[0];const pts=pl.legs.flatMap(l=>l.pts);out.plan=Math.round(pl.len);let k=0,t=1,stuck=0;
    for(let i=0;i<30000&&k<pts.length;i++){const[tx,ty]=pts[k];const dx=tx-D.S.x,dy=ty-D.S.y;if(Math.hypot(dx,dy)<2){k++;continue;}if(k===pts.length-1&&D.spotAt(D.S.x,D.S.y)&&Math.hypot(dx,dy)<12)break;const x0=D.S.x,y0=D.S.y;D.setYaw(Math.atan2(-dx,-dy));D.setJoy(0,-.5);D.update(.05,t+=.05);if(Math.hypot(D.S.x-x0,D.S.y-y0)<.01){stuck++;if(stuck>40){out.stuckAt=[k,Math.round(D.S.x),Math.round(D.S.y)];break;}}else stuck=0;}D.setJoy(0,0);
    out.walkedTo=D.nearSpot&&D.nearSpot.id;out.colAtStuck=out.stuckAt?[!!D.walk(out.stuckAt[1],out.stuckAt[2]),JSON.stringify(D.colAt(out.stuckAt[1],out.stuckAt[2]+2,1)),window.HamaShonan.isLand(out.stuckAt[1],out.stuckAt[2]+3),JSON.stringify(window.HamaShonan.structAt(out.stuckAt[1],out.stuckAt[2]+3))]:null;out.dist=Math.hypot(g.x-D.S.x,g.y-D.S.y).toFixed(1);return out;});
  console.log(JSON.stringify(r));
  const step=(n)=>page.evaluate((n)=>{let t=performance.now()/1000;for(let i=0;i<n;i++){t+=.05;__D.update(.05,t);}return {st:__D.F.st,fish:__D.F.fish};},n);
  const res={};for(let k=0;k<6;k++){await page.evaluate(()=>{__D.S.bait='sabiki';__D.S.min=9*60;__D.F.st='idle';__D.setYaw(Math.PI);__D.mainDown();});await step(14);await page.evaluate(()=>__D.mainUp());await step(19);
    let s;for(let i=0;i<40;i++){s=await step(10);if(s.st!=='wait')break;}res[s.st==='bite'?s.fish:s.st]=(res[s.st==='bite'?s.fish:s.st]||0)+1;await page.evaluate(()=>{__D.F.st='idle';__D.mainUp();});}
  console.log('sabiki',JSON.stringify(res));
  // 乗ったままでは釣りボタンが出ない
  const q=await page.evaluate(()=>{const D=__D;const o=D.S.veh.owned[0];D.S.veh.parked[o.uid].x=D.S.x;D.S.veh.parked[o.uid].y=D.S.y;D.mount(o);let t=1;D.update(.05,t);return{riding:!!D.RIDE,nearSpot:D.nearSpot,btn:document.getElementById('mainBtn').hidden};});console.log('riding at spot',JSON.stringify(q));
};
