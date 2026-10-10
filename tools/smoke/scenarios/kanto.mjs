// 関東の近景（横浜・湘南の外）：横浜駅から電車で横須賀中央・箱根湯本へ（行き先に近い駅に着く）。地面の高さ・陸・チャンクを確認して撮る。駅から離れていると乗れない
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(500);
  console.log('kanto_nostation',await page.evaluate(async()=>{const D=__D;D.S.money=1e6;const m0=D.S.money;const[x,y]=window.HamaGeo.toGame(35.2785,139.6705);D.S.x+=300;await D.kantoGo(x,y);return JSON.stringify({rg:D.regionAt(D.S.x,D.S.y),paid:m0-D.S.money});}));
  await page.evaluate(()=>{const D=__D,s=D.STATIONS.find(q=>q.n==='横浜駅');D.S.x=s.x;D.S.y=s.y;D.updChunks(true);});
  const go=async(name,lat,lon,yaw,pitch)=>{const r=await page.evaluate(async([lat,lon])=>{const D=__D;D.S.money=1e6;D.S.min=10*60;const[x,y]=window.HamaGeo.toGame(lat,lon);await D.kantoGo(x,y);
      const st=D.KANTO.stationsNear(D.S.x,D.S.y,1500)[0];return{rg:D.regionAt(D.S.x,D.S.y),land:D.isLand(D.S.x,D.S.y),gy:+D.groundY(D.S.x,D.S.y).toFixed(1),st:st?st.n:null,std:st?Math.round(st.d):null};},[lat,lon]);
    await page.evaluate(([yaw,pitch])=>{__D.setYaw(yaw);__D.setPitch(pitch);__D.snapCam();},[yaw,pitch]);
    for(let k=0;k<16;k++){await page.evaluate(()=>{let t=performance.now()/1000;for(let i=0;i<3;i++){t+=.4;__D.update(.05,t);__D.render(.4,t);}});await page.waitForTimeout(500);}
    r.chunks=await page.evaluate(()=>{let n=0,p=0;for(const g of __D.chunks.values()){n++;if(g.userData.pending)p++;}return n+'/'+p+'pending';});
    await page.screenshot({path:`${SP}/${name}.png`});console.log(name,JSON.stringify(r));};
  await go('kanto_yokosuka',35.2785,139.6705,0,.25);
  await go('kanto_hakone',35.2325,139.1055,Math.PI/2,-.05);
  // 橋：六郷橋（多摩川）の水の上の区間を歩けて、高さが床に合う
  const br=await page.evaluate(async()=>{const D=__D;const[x,y]=window.HamaGeo.toGame(35.5405,139.7010);D.S.x=x;D.S.y=y;await D.KANTO.load(x-600,y-600,x+600,y+600);D.updChunks(true);let ex=null;for(const a of D.KBR.values())for(const s of a)if(!ex||Math.hypot(s[0]-x,s[1]-y)<Math.hypot(ex[0]-x,ex[1]-y))ex=s;if(!ex)return{none:1};
    const mx=(ex[0]+ex[2])/2,mz=(ex[1]+ex[3])/2;return{walk:D.walk(mx,mz),water:!D.isLand(mx,mz),dy:+Math.abs(D.groundY(mx,mz)-(ex[5]+ex[6])/2-.16).toFixed(2)};});
  console.log('kanto_bridge',JSON.stringify(br));
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
