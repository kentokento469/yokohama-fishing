export default async (page, SP) => {
  await page.evaluate(()=>localStorage.setItem('hama-tsuri-gfx','low'));await page.reload();await page.waitForTimeout(1200);
  await page.click('#newBtn');await page.waitForTimeout(500);
  await page.evaluate(()=>{const D=__D;Object.assign(D.S,{x:8975,y:-3770,min:12*60});D.updChunks(true);D.setYaw(Math.atan2(8975-8892,-3770+3859));D.setPitch(-1.3);D.snapCam();});
  for(let k=0;k<6;k++){await page.evaluate(()=>{let t=performance.now()/1000;for(let i=0;i<3;i++){t+=.05;__D.update(.05,t);__D.render(.05,t);}});await page.waitForTimeout(300);}
  await page.screenshot({path:`${SP}/lookup_low.png`});
  // 画面上部の色（空なら青っぽい・黒なら欠け）
  console.log(JSON.stringify(await page.evaluate(()=>{const c=document.createElement('canvas');const g=__D.renderer.domElement;c.width=g.width;c.height=g.height;const x=c.getContext('2d');__D.render(.05,performance.now()/1000);x.drawImage(g,0,0);const p=x.getImageData(g.width/2,10,1,1).data;return{far:__D.camera.far,top:[...p]};})));
};
