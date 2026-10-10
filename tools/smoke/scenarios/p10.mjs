// 段階9・10：魚拓に残す（コレクション）・小魚を生き餌にして泳がせ（大きな魚が候補に、回収で弱って戻る）・3Dの魚
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const D=__D,S=D.S,sp=D.SPOTS.find(s=>s.id==='honmoku');Object.assign(S,{x:sp.x,y:sp.y,min:8*60});D.updChunks(true);
    // 魚拓
    D.setPending({id:'aji',sz:15,kg:.05,price:40,rec:{time:'8:00',spot:sp.name,bait:'サビキ'},gyo:false});document.getElementById('resGyo').click();
    const gy=(S.gyotaku||[]).length,best=!!(S.gyotaku&&S.gyotaku[0].best);D.setTab('gyo');D.openMenu();const cv=document.querySelectorAll('#sheet canvas').length;D.closeSheet();
    // 生き餌：容器なし→不可、買って→可
    const noGear=(document.getElementById('resLive').click(),(S.live||[]).length);S.liveGear={live_bucket:1,air_pump:1};document.getElementById('resLive').click();const live=S.live.length;
    // 泳がせの候補
    D.F.spot=sp;D.F.ox=S.x;D.F.oy=S.y;const a=D.waterDir(S.x,S.y);D.F.tx=S.x+Math.cos(a)*30;D.F.ty=S.y+Math.sin(a)*30;
    S.bait='live';D.F.liveB={id:'aji',vit:1};const c=D.candidates();const ids=c.out.filter(o=>o[1]>0).map(o=>o[0]);
    // 回収で戻る
    D.F.st='wait';D.reelIn('回収');const back=S.live.length;
    return{gy,best,cv,noGear,live,liveCand:ids.length>0&&ids.every(id=>D.LB.TARGET[id]),ids:ids.slice(0,5),back,fish3d:!!window.HamaFish3D};});
  console.log('p10',JSON.stringify(r));
  // 糸（段階8）：道糸を買って巻く・リーダーで擦れに強く・針のパックで10本・釣具店の糸の詳細
  const l=await page.evaluate(()=>{const D=__D,S=D.S;S.money=1e5;const k0=D.lineKgNow(true);D.setTab('shop');D.openMenu();
    const cats=[...document.querySelectorAll('#sheet [data-cat]')].map(b=>b.dataset.cat);document.querySelector('#sheet [data-cat="leader"]').click();
    document.querySelector('#shopList [data-it="ld_fluoro_5"]').click();const det=!!document.querySelector('#shopList .det dl');document.querySelector('#shopList [data-buy1="ld_fluoro_5"]').click();
    const ld=S.leaderId,k1=D.lineKgNow(true);document.querySelector('#sheet [data-cat="hook"]').click();document.querySelector('#shopList [data-it]').click();document.querySelector('#shopList [data-buy1]').click();D.closeSheet();
    return{cats:cats.includes('line')&&cats.includes('hook'),det,leader:!!ld,rough:k1>k0,hooks:S.tk[S.hookId]};});
  console.log('p8',JSON.stringify(l));
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
