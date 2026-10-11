// 合わせボタン：巻くボタンでは合わせない・ボタンが重ならない・早合わせの判定・空合わせ。カメラ：合わせで動かない・人が画面の真ん中にいない・視点操作を勝手に戻さない
export default async (page, SP) => {
  await page.setViewportSize({width:390,height:844});await page.click('#newBtn');
  const step=(n)=>page.evaluate((n)=>{let t=performance.now()/1000;for(let i=0;i<n;i++){t+=.05;__D.update(.05,t);__D.placeCam(.3);}return __D.F.st;},n);
  await page.evaluate(()=>{const D=__D,T=window.HamaTackleData;const it=T.find(t=>t.style==='shore_standard'&&t.weightG===20);D.S.tk[it.id]=50;D.S.eq=it.id;D.S.bait=window.HamaSim.baitClassOf(it);});
  const out={};
  // 空合わせ（アタリが無い時）
  await page.evaluate(()=>{const D=__D;Object.assign(D.S,{x:13963.4,y:-972.4,min:7*60,day:3});D.F.st='idle';D.updChunks(false);D.snapCam();});await step(6);await page.evaluate(()=>__D.mainDown());await step(14);await page.evaluate(()=>__D.mainUp());await step(20);
  out.st0=await page.evaluate(()=>__D.F.st+'|'+document.getElementById('toast').textContent);
  out.empty=await page.evaluate(()=>{const D=__D;const st=D.F.st;D.doHookset();return st==='wait'&&D.F.st==='wait'&&document.getElementById('cue').textContent.includes('空合わせ');});
  // ボタンの配置（待ちの間）
  await page.evaluate(()=>__D.updUI());
  out.layout=await page.evaluate(()=>{const a=document.getElementById('hookBtn').getBoundingClientRect(),b=document.getElementById('mainBtn').getBoundingClientRect();return{shown:a.width>0,above:a.bottom<=b.top-8,gap:Math.round(b.top-a.bottom),right:a.right>innerWidth*.6};});
  // カメラ：人は画面の真ん中ではない・視線は投げた方向
  out.cam=await page.evaluate(()=>{const D=__D,c=D.camera,p=D.P.position;const v=p.clone();v.y+=1.2;v.project(c);const dir=new p.constructor();c.getWorldDirection(dir);const fa=D.F.ang;const dot=dir.x*Math.cos(fa)+dir.z*Math.sin(fa);
    return{px:+v.x.toFixed(2),py:+v.y.toFixed(2),offCenter:Math.abs(v.x)>.15||v.y<-.2,lookForward:dot>.6,dist:+Math.hypot(c.position.x-p.x,c.position.z-p.z).toFixed(1)};});
  // 合わせ（竿を煽る）の前後でカメラが動かない
  out.sweepCam=await page.evaluate(()=>{const D=__D;for(let i=0;i<40;i++)D.placeCam(.3);const a=D.camera.position.clone();D.RS.sweepT=performance.now()/1000;let t=performance.now()/1000;for(let i=0;i<6;i++){t+=.05;D.update(.05,t);D.placeCam(.3);D.poseFishing(t);D.updRod(t);}
    return +a.distanceTo(D.camera.position).toFixed(3);});
  // アタリまで巻く。アタリで巻くボタンを押しても合わない。合わせの判定（judge）が返る
  let st='',ok=false;for(let k=0;k<15&&!ok;k++){if(st!=='wait'){await page.evaluate(()=>{const D=__D;D.F.st='idle';D.mainUp();Object.assign(D.S,{x:13963.4,y:-972.4,min:7*60,day:3});D.snapCam();D.mainDown();});await step(14);await page.evaluate(()=>__D.mainUp());await step(19);}
    for(let i=0;i<60;i++){await page.evaluate(()=>{const D=__D;if(D.F.st==='wait'&&!D.F.reelHold){D.S.spd=.8;D.mainDown();}});st=await step(10);if(st!=='wait')break;}
    if(st==='bite'){ok=true;out.bite=await page.evaluate(()=>{const D=__D;D.updUI();const hot=document.getElementById('hookBtn').classList.contains('hot');D.mainUp();D.mainDown();const still=D.F.st==='bite';D.mainUp();D.F.t=0;D.doHookset();return{hot,reelDoesNotHook:still,judge:D.F.hookJudge};});}}
  // ファイト中：ドラッグした直後は魚の方へ勝手に向かない
  out.drag=await page.evaluate(()=>{const D=__D;if(D.F.st!=='fight')return null;D.touchDrag();const y0=D.yawv;let t=performance.now()/1000;for(let i=0;i<10;i++){t+=.05;D.update(.05,t);}return Math.abs(D.yawv-y0)<1e-6;});
  // 取り込みまで：赤（危険）になったら離す、それ以外は巻く。寄ってきたらカメラは足元へ
  out.land=await page.evaluate(()=>{const D=__D;let t=performance.now()/1000,maxLand=0,i=0;const mb=document.getElementById('mainBtn');
    for(;i<3000&&D.F.st==='fight';i++){D.updUI();const dg=mb.classList.contains('dg');if(dg&&D.F.reelHold)D.mainUp();else if(!dg&&!D.F.reelHold)D.mainDown();t+=.05;D.update(.05,t);D.placeCam(.3);maxLand=Math.max(maxLand,D.FC.land);}
    D.mainUp();const res=document.getElementById('cue').textContent;return{st:D.F.st,landed:/釣り上げ成功/.test(res),camLand:maxLand>.3,secs:Math.round(i*.05)};});
  console.log('hookset',JSON.stringify(out));
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
