// 見上げ：ランドマークタワーの足元から見上げる（Phase A の確認）。画質 標準・軽量で撮る
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(500);
  const shot=async(name,fn)=>{await page.evaluate(fn);for(let k=0;k<6;k++){await page.evaluate(()=>{let t=performance.now()/1000;for(let i=0;i<3;i++){t+=.05;__D.update(.05,t);__D.render(.05,t);}});await page.waitForTimeout(300);}await page.screenshot({path:`${SP}/${name}.png`});};
  // タワー（8892,-3859）の南東 120m から北西を見上げる
  const set=(p,q)=>`(()=>{const D=__D;Object.assign(D.S,{x:8975,y:-3770,min:12*60});D.updChunks(true);D.setYaw(Math.atan2(8975-8892,-3770+3859));D.setPitch(${p});D.snapCam();${q||''}})()`;
  await shot('lookup_std',set(-1.15));
  await shot('lookup_mid',set(-.5));
  await page.evaluate(()=>{document.querySelector('#menuBtn')&&0;});
  console.log(JSON.stringify(await page.evaluate(()=>{const c=__D.camera;const d=new THREE.Vector3();c.getWorldDirection(d);return{err:document.getElementById('bootErr')?.textContent||'no error',elev:Math.round(Math.asin(d.y)*180/Math.PI),y:+c.position.y.toFixed(1),far:c.far};})));
};
