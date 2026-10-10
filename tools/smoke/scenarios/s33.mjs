export default async (page, SP) => {
  await page.click('#hiraBtn');await page.waitForTimeout(500);await page.screenshot({path:SP+'/w_hud.png'});
  await page.keyboard.press('KeyM');await page.waitForTimeout(300);
  console.log('open',await page.evaluate(()=>!document.getElementById('wmap').hidden));await page.screenshot({path:SP+'/w_1.png'});
  await page.click('[data-wr="shonan"]');await page.waitForTimeout(200);await page.screenshot({path:SP+'/w_shonan.png'});
  await page.click('[data-wr="yokohama"]');await page.waitForTimeout(200);await page.screenshot({path:SP+'/w_yoko.png'});
  // 現在地へ・拡大して釣り場をタップ
  await page.click('#wmMe');for(let i=0;i<3;i++)await page.click('#wmIn');await page.waitForTimeout(100);
  const pt=await page.evaluate(()=>{const g=window.HamaShonan.GSPOTS.find(q=>q.id==='beachpark');const v=__D.WMv();return window.HamaGeo.worldToScreen(v,g.x,g.y);});
  await page.touchscreen.tap(pt[0],pt[1]);await page.waitForTimeout(200);
  console.log('info',await page.evaluate(()=>document.getElementById('wmInfo').innerText.replace(/\n/g,' / ')));
  await page.click('#wmGo');await page.waitForTimeout(200);await page.screenshot({path:SP+'/w_route.png'});
  // 3D の位置と地図の位置が一致：プレイヤーの位置が地図の中心（現在地ボタン）
  const m=await page.evaluate(()=>{const v=__D.WMv();v.cx=__D.S.x;v.cy=__D.S.y;const p=window.HamaGeo.worldToScreen(v,__D.S.x,__D.S.y);return[p[0]-innerWidth/2,p[1]-innerHeight/2];});console.log('player screen offset',m);
  await page.keyboard.press('Escape');console.log('closed',await page.evaluate(()=>document.getElementById('wmap').hidden));
  // 閉じている間は時間が進む、開いている間は止まる
  const t=await page.evaluate(()=>{__D.openWorld();const a=__D.S.min;let t=1;for(let i=0;i<20;i++)__D.update(.05,t+=.05);const b=__D.S.min;__D.closeWorld();return b-a;});console.log('time while open',t);
};
