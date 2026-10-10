// 魚市場アプリ：どこでも売れる（相場の8割）・確認画面・二重売却しない・お気に入りは売らない・比較・地図の買取所・移動買取・3Dの小屋
export default async (page, SP) => {
  await page.click('#newBtn');await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const D=__D,S=D.S,M=D.MKT;const sp=D.SPOTS.find(s=>s.id==='suehiro');Object.assign(S,{x:sp.x,y:sp.y,min:14*60,money:1000});D.updChunks(true);
    S.veh.cooler='cooler_l';S.catch=[];for(const[id,L,kg]of[['aji',22,.15],['saba',32,.4],['seabass',55,1.6]])M.add(S,{id,L,kg,t:D.S.min?0:0},{cooler_l:30});
    for(const c of S.catch)c.t=Math.max(0,(S.day||0)*1440+S.min-30);
    const counts={};for(const p of D.sellPoints())counts[p.region]=(counts[p.region]||0)+1;
    // アプリで（近くに買取所が無い所）：お気に入りを1匹、まとめて売る→確認→2回押しても1回分
    D.openPhone('market','cmp');const cmpRows=document.querySelectorAll('#phBody .cmpT tr').length;document.querySelector('[data-pt="sell"]').click();const fav=S.catch[2].u;document.querySelector(`[data-fav="${fav}"]`).click();
    document.getElementById('phAll').click();const conf=!!document.getElementById('phOk');const quoted=D.PH.confirm&&D.PH.confirm.q.yen;const m0=S.money;
    const ok=document.getElementById('phOk');ok.click();ok.click();D.phDoSell&&D.phDoSell();const gain=S.money-m0;const left=S.catch.length;
    // 比較タブ・売り場タブ
    document.querySelector('[data-pt="pts"]').click();const pts=document.querySelectorAll('#phBody [data-go]').length;
    document.querySelector('[data-pt="rec"]').click();const rec=document.getElementById('phBody').textContent.includes('売った魚');D.closePhone();
    // 移動買取（8時）
    S.min=8*60;const npc=D.npcNow().length;
    // 近くの小屋が見える
    const m=D.MARKETS.find(q=>q.region==='yokohama'&&q.kind==='tackle')||D.MARKETS[0];S.x=m.x+10;S.y=m.y;D.update(.05,100);D.update(.05,101);const vis=!!(m.g&&m.g.visible);
    return{counts,conf,quoted,gain,once:gain===quoted,left,favKept:S.catch.some(c=>c.u===fav),cmpRows,pts,rec,npc,vis,mStats:S.mStats&&S.mStats.n};});
  console.log('p11',JSON.stringify(r));
  // 全画面マップに買取所が描かれる（オレンジ）
  const px=await page.evaluate(()=>{const D=__D;D.S.min=8*60;D.openWorld();const m=D.MARKETS.find(q=>q.region==='yokohama');const v=D.WMv();v.cx=m.x;v.cy=m.y;v.z=.3;D.openWorld&&0;document.getElementById('wmIn').click();const cv=document.getElementById('wmCv'),c=cv.getContext('2d');const d=c.getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>170&&d[i+1]>70&&d[i+1]<150&&d[i+2]<80)n++;D.closeWorld();return n;});
  console.log('p11map',JSON.stringify({orange:px}));
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
