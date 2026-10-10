/* 魚の持ち帰りと買取（window.HamaMarket）。地域共通。three.js・DOM に依存しない（Node のテストで動く）。
   ・釣った魚は持ち物（S.catch）へ。クーラー（氷）があれば鮮度が長持ち、無ければバケツ（5kg まで・傷みが早い）。
   ・買取所（ゲーム上の設定）で売る。値段＝基準単価（円/kg）×重さ×大きさ×鮮度×その日の相場×店の種類。
   ・買取所の位置は実在の市場・漁港の住所（国土地理院の住所検索）の近く。実際にそこで一般の人が魚を売れるわけではない（ゲームの設定）。
   ・相場・鮮度・店の掛け率はゲーム用の目安で、実際の市況ではない。 */
(function(root){
'use strict';
// 買取所：kind＝market（卸売市場の買取窓口：高いが朝だけ）、coop（漁協の直売所：昼まで）、shop（鮮魚店：昼〜夕方・安め）
const PLACES=[
  {id:'yokohama_central',n:'横浜中央卸売市場 近くの買取所',lat:35.466843,lon:139.634705,kind:'market',src:'住所「横浜市神奈川区山内町1」'},
  {id:'shiba',n:'柴漁港 近くの買取所',lat:35.345669,lon:139.638672,kind:'coop',src:'住所「横浜市金沢区柴町」'},
  {id:'koshigoe',n:'腰越漁港 近くの買取所',lat:35.30822,lon:139.494537,kind:'coop',src:'住所「鎌倉市腰越二丁目」'},
  {id:'katase',n:'片瀬漁港 近くの鮮魚店',lat:35.308735,lon:139.486557,kind:'shop',src:'住所「藤沢市片瀬海岸一丁目」'},
  {id:'chigasaki',n:'茅ヶ崎漁港 近くの買取所',lat:35.320377,lon:139.398636,kind:'coop',src:'住所「茅ヶ崎市中海岸四丁目」'},
  {id:'hiratsuka',n:'平塚漁港 近くの買取所',lat:35.316624,lon:139.364761,kind:'coop',src:'住所「平塚市千石河岸」'},
  {id:'oiso',n:'大磯港 近くの鮮魚店',lat:35.306,lon:139.3125,kind:'shop',src:'大磯港の位置（おおよそ）'}];
const KIND={market:{mult:1,open:[5*60,12*60],label:'卸売市場の買取窓口（朝5時〜12時）'},coop:{mult:.85,open:[6*60,15*60],label:'漁協の直売所（6時〜15時）'},shop:{mult:.7,open:[9*60,19*60],label:'鮮魚店（9時〜19時）'}};
const BUCKET_KG=5;// クーラーが無いとき（バケツ）
const TAU={ice:30,none:4};// 鮮度が 1/e になる時間（h）
const SPOIL_H=48;
function hash(a,b){let h=(a*374761393+b*668265263)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296;}
function strHash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h;}
// 鮮度（0〜1）：釣ってからの時間と、氷の有無（クーラーに入れた時間を区別せず、持ち物にあるかで判断）
function freshness(item,absMin,iced){const h=Math.max(0,(absMin-item.t)/60);if(h>=SPOIL_H)return 0;return Math.exp(-h/(iced?TAU.ice:TAU.none));}
// その日の相場（0.8〜1.25）：日と魚種ごとの乱数。旬は量が多く少し安い
function dayFactor(fishId,day,inSeason){const r=hash(day|0,strHash(fishId));return(.8+.45*r)*(inSeason?.92:1.08);}
function isOpen(place,minOfDay){const o=KIND[place.kind].open;return minOfDay>=o[0]&&minOfDay<o[1];}
// 1匹の値段。info＝{kg:円/kg, L:[最小,最大]cm, inSeason}
function priceOf(item,info,ctx){const fr=freshness(item,ctx.absMin,ctx.iced);if(fr<=0||!info||!info.kg)return{yen:0,fresh:fr,spoiled:fr<=0};
  const size=info.L?.85+.3*Math.max(0,Math.min(1,(item.L-info.L[0])/Math.max(1,info.L[1]-info.L[0]))):1;
  const fm=.25+.75*fr,df=dayFactor(item.id,ctx.day,info.inSeason),km=ctx.place?KIND[ctx.place.kind].mult:1;
  const yen=Math.max(10,Math.round(info.kg*item.kg*size*fm*df*km/10)*10);return{yen,fresh:fr,size,day:df,kind:km};}
// 入れられるか（重さ）
function capacity(cooler,caps){return cooler?(caps[cooler]||8):BUCKET_KG;}
function load(S){return(S.catch||[]).reduce((a,c)=>a+(c.kg||0),0);}
// 持ち物へ。入らなければ false
function add(S,item,caps){S.catch=S.catch||[];const cap=capacity(S.veh&&S.veh.cooler,caps);if(load(S)+item.kg>cap+1e-9)return false;S.catch.push(item);return true;}
// 売る（idx を省くと全部）。売れない（傷んだ）魚は処分。戻り値：{yen,sold,spoiled}
function sell(S,place,ctx,infoOf,idx){const out={yen:0,sold:0,spoiled:0};const keep=[];(S.catch||[]).forEach((c,i)=>{if(idx!=null&&!idx.includes(i)){keep.push(c);return;}
    const p=priceOf(c,infoOf(c.id),Object.assign({},ctx,{place}));if(p.spoiled){out.spoiled++;return;}if(c.legacy){keep.push(c);return;}out.yen+=p.yen;out.sold++;});
  S.catch=keep;S.money=(S.money||0)+out.yen;return out;}
// 古いセーブ：以前は釣った時点で買取済み。クーラーの重さ（S.veh.fishKg）は売れない「持ち帰りの魚（売却済み）」として残す
function migrate(S){if(S.catch)return S;S.catch=[];const kg=S.veh&&S.veh.fishKg;if(kg>0)S.catch.push({id:'_legacy',kg:+kg.toFixed(2),L:0,t:0,legacy:true});return S;}
function placesIn(toGame){return PLACES.map(p=>{const[x,y]=toGame(p.lat,p.lon);return Object.assign({x,y},p);});}
const API={PLACES,KIND,BUCKET_KG,TAU,SPOIL_H,freshness,dayFactor,isOpen,priceOf,capacity,load,add,sell,migrate,placesIn};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaMarket=API;
})(typeof self!=='undefined'?self:this);
