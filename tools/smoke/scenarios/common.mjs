// 地域共通の操作：ジャンプ・段差（防波堤）・持ち帰り→買取所で売る、を横浜と湘南で
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(400);
  const step=n=>page.evaluate(n=>{let t=performance.now()/1000;let mx=-1e9;for(let i=0;i<n;i++){t+=.05;__D.update(.05,t);mx=Math.max(mx,__D.PY);}return mx;},n);
  for(const[rg,id,mid]of[['yokohama','honmoku','yokohama_central'],['shonan','shinko_south','hiratsuka']]){
    // ジャンプ：その場で跳んで戻る
    await page.evaluate(([id])=>{const D=__D,sp=D.SPOTS.find(s=>s.id===id);Object.assign(D.S,{x:sp.x,y:sp.y,min:7*60});D.F.st='idle';D.updChunks(true);},[id]);await step(10);
    const y0=await page.evaluate(()=>__D.PY);await page.evaluate(()=>__D.doJump());const top=await step(20);const y1=await page.evaluate(()=>__D.PY),air=await page.evaluate(()=>__D.AIR);
    // 持ち帰り→買取所で売る
    const r=await page.evaluate(([mid])=>{const D=__D,m=D.MARKETS.find(q=>q.id===mid);const m0=D.S.money;D.setPending({id:'aji',sz:24,kg:.25,price:300});D.keep(true);const n1=(D.S.catch||[]).length;
      D.S.x=m.x+4;D.S.y=m.y+4;D.S.min=7*60;D.openPhone('market','sell');const btn=document.getElementById('phAll');const near=!!D.nearMarket(25);if(btn)btn.click();const ok=document.getElementById('phOk');if(ok)ok.click();D.closePhone();
      return{kept:n1,near,sellBtn:!!btn,sold:(D.S.catch||[]).length===0,gain:D.S.money-m0,region:m.region};},[mid]);
    console.log('common_'+rg,JSON.stringify(Object.assign({jump:+(top-y0).toFixed(2),landed:Math.abs(y1-y0)<.05&&!air},r)));}
  // 段差：足元より0.45m までは歩いて上れ、それより高いと上れない（ジャンプ中で足元が上がれば上れる）
  const st=await page.evaluate(()=>{const D=__D,x=D.S.x,y=D.S.y,g=D.groundY?D.groundY(x,y):2;D.PY=g-.6;const low=D.canGo(x+.3,y);D.PY=g-.3;const ok=D.canGo(x+.3,y);D.PY=g;return{tooHigh:!low,stepOk:ok};});
  console.log('common_step',JSON.stringify(st));
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
