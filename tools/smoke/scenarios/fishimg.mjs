// 魚の写真：全魚種の画像（サムネイル・大きい画像・AVIF）がブラウザで実際に表示できるか、釣果・図鑑・売却画面に出るか、読めない時に代わりの図になるか
export default async (page, SP) => {
  await page.setViewportSize({width:390,height:844});await page.click('#newBtn');await page.waitForTimeout(300);
  const r=await page.evaluate(async()=>{const D=__D,F=D.FIMG,ids=Object.keys(F);const load=src=>new Promise(res=>{const i=new Image();i.onload=()=>res(i.naturalWidth>0);i.onerror=()=>res(false);i.src=src;});
    let ok=0;const bad=[];for(const id of ids){const a=await load(F[id].thumb),b=await load(F[id].full),c=F[id].avif?await load(F[id].avif):true;if(a&&b&&c)ok++;else bad.push(id);}
    // 釣果の画面
    document.getElementById('resImg').innerHTML=D.fishPic('hirame','full');await new Promise(r=>setTimeout(r,500));const im=document.querySelector('#resImg img');const res=!!(im&&im.complete&&im.naturalWidth>0);document.getElementById('resImg').innerHTML='';
    // 売却画面のサムネイル
    const S=D.S;S.veh.cooler='cooler_l';S.catch=[];D.MKT.add(S,{id:'buri',L:80,kg:6,t:(S.day||0)*1440+S.min},{cooler_l:30});D.openPhone('market','sell');await new Promise(r=>setTimeout(r,400));const th=document.querySelector('#phBody .th img');const sell=!!(th&&th.naturalWidth>0);D.closePhone();
    // 読めない画像 → 代わりの図
    const box=document.createElement('div');box.className='resImg';document.body.appendChild(box);box.innerHTML=D.fishPic('aji','full').replace(/src="[^"]+"/,'src="data/fish/img/__none__.webp"').replace(/<source[^>]*>/,'');await new Promise(r=>setTimeout(r,400));const fb=!!box.querySelector('canvas.fishPh');box.remove();
    return{total:ids.length,ok,bad,res,sell,fallback:fb};});
  console.log('fishimg',JSON.stringify(r));
  console.log(await page.evaluate(()=>[document.getElementById('bootErr')?.textContent||'no error']));
};
