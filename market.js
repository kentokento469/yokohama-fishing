/* 魚の持ち帰りと買取（window.HamaMarket）。地域共通。three.js・DOM に依存しない（Node のテストで動く）。
   ・釣った魚は持ち物（S.catch）へ。クーラー（氷）があれば鮮度が長持ち、無ければバケツ（5kg まで・傷みが早い）。
   ・売る場所（すべてゲーム上の架空の買取所。実在の店・市場が魚を買い取るわけではない）：
       market 大規模魚市場（朝だけ。魚種ごとの需要・供給・季節・地域・曜日・その日の売れ行きで大きく上下＝高値を探す面白さ）
       coop 漁港の直売所／shop 鮮魚店／tackle 釣具店の買取コーナー／npc 移動買取トラック（駐車場・港・海岸沿いに時間帯ごとに出る）
       app スマホの「魚市場」アプリ（どこでも即時。その日の地域別市場相場の8割）
   ・値段＝基準単価（円/kg）×重さ×大きさ×鮮度×その日の地域別市場相場×売る場所の掛け率（大規模魚市場は需要で変動）。
   ・相場・鮮度・掛け率はゲーム用の目安で、実際の市況ではない。
   ・二重売却を防ぐため、魚は通し番号（u）で売る。売った魚はその場で持ち物から消え、同じ番号は二度と売れない。お気に入り（fav）は売らない。 */
(function(root){
'use strict';
// 固定の買取所（架空）。位置は実在の市場・漁港の住所（国土地理院の住所検索）の近く。名前はゲーム上の架空の屋号
const PLACES=[
  {id:'yokohama_central',n:'浜の大市場 横浜',lat:35.466843,lon:139.634705,kind:'market',src:'住所「横浜市神奈川区山内町1」'},
  {id:'shiba',n:'柴の浜 買取所',lat:35.345669,lon:139.638672,kind:'coop',src:'住所「横浜市金沢区柴町」'},
  {id:'koshigoe',n:'腰越 浜の買取所',lat:35.30822,lon:139.494537,kind:'coop',src:'住所「鎌倉市腰越二丁目」'},
  {id:'katase',n:'片瀬 海鮮屋',lat:35.308735,lon:139.486557,kind:'shop',src:'住所「藤沢市片瀬海岸一丁目」'},
  {id:'chigasaki',n:'茅ヶ崎 浜の買取所',lat:35.320377,lon:139.398636,kind:'coop',src:'住所「茅ヶ崎市中海岸四丁目」'},
  {id:'hiratsuka',n:'浜の大市場 平塚',lat:35.316624,lon:139.364761,kind:'market',src:'住所「平塚市千石河岸」'},
  {id:'oiso',n:'大磯 海鮮屋',lat:35.306,lon:139.3125,kind:'shop',src:'大磯港の位置（おおよそ）'},
  // 横浜・湘南の外の関東（散策エリア）
  {id:'misaki',n:'浜の大市場 三崎',lat:35.141403,lon:139.615479,kind:'market',src:'住所「三浦市三崎五丁目」'},
  {id:'odawara',n:'浜の大市場 小田原',lat:35.241154,lon:139.148407,kind:'market',src:'住所「小田原市早川一丁目」'},
  {id:'kotsubo',n:'小坪 浜の買取所',lat:35.298454,lon:139.554626,kind:'coop',src:'住所「逗子市小坪五丁目」'},
  {id:'hayama',n:'葉山 浜の買取所',lat:35.276577,lon:139.593552,kind:'coop',src:'住所「葉山町堀内」'},
  {id:'sajima',n:'佐島 浜の買取所',lat:35.224052,lon:139.61676,kind:'coop',src:'住所「横須賀市佐島」'},
  {id:'nagai',n:'長井 浜の買取所',lat:35.203728,lon:139.62706,kind:'coop',src:'住所「横須賀市長井一丁目」'},
  {id:'matsuwa',n:'松輪 浜の買取所',lat:35.146427,lon:139.674133,kind:'coop',src:'住所「三浦市南下浦町松輪」'},
  {id:'kurihama',n:'久里浜 海鮮屋',lat:35.220375,lon:139.711975,kind:'shop',src:'住所「横須賀市久里浜八丁目」'},
  {id:'manazuru',n:'真鶴 浜の買取所',lat:35.151665,lon:139.141769,kind:'coop',src:'住所「真鶴町真鶴」'},
  {id:'hakone',n:'箱根湯本 海鮮屋',lat:35.232288,lon:139.105194,kind:'shop',src:'住所「箱根町湯本」'}];
// 売る場所の種類：掛け率（market は需要で変動するので基準1）・営業時間（分）
const KIND={market:{mult:1,open:[5*60,12*60],label:'大規模魚市場（5時〜12時・魚種ごとに相場が大きく動く）',short:'大市場'},
  coop:{mult:.9,open:[6*60,15*60],label:'漁港の直売所（6時〜15時）',short:'漁港'},
  shop:{mult:.86,open:[9*60,19*60],label:'鮮魚店（9時〜19時）',short:'鮮魚店'},
  tackle:{mult:.84,open:[7*60,20*60],label:'釣具店の買取コーナー（7時〜20時）',short:'釣具店'},
  npc:{mult:.9,open:[0,24*60],label:'移動買取トラック（3時間ごとに場所が変わる）',short:'移動買取'},
  app:{mult:.8,open:[0,24*60],label:'スマホの魚市場アプリ（いつでも・地域の相場の8割）',short:'アプリ'}};
const APP_RATE=.8;
const REGION_LABEL={yokohama:'横浜',shonan:'湘南',kanto:'関東（その他）'};
const BUCKET_KG=5;// クーラーが無いとき（バケツ）
const TAU={ice:30,none:4};// 鮮度が 1/e になる時間（h）
const SPOIL_H=48;
function hash(a,b){let h=(a*374761393+b*668265263)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296;}
function strHash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h;}
// 鮮度（0〜1）：釣ってからの時間と、氷の有無
function freshness(item,absMin,iced){const h=Math.max(0,(absMin-item.t)/60);if(h>=SPOIL_H)return 0;return Math.exp(-h/(iced?TAU.ice:TAU.none));}
// その日の相場（0.8〜1.25）：日と魚種ごとの乱数。旬は量が多く少し安い
function dayFactor(fishId,day,inSeason){const r=hash(day|0,strHash(fishId));return(.8+.45*r)*(inSeason?.92:1.08);}
// 地域ごとの差（0.9〜1.12）：その日・その地域・その魚種
function regionFactor(region,fishId,day){return .9+.22*hash((day|0)+7919,strHash((region||'yokohama')+':'+fishId));}
// 大規模魚市場の需要（0.88〜1.5 くらい）：市場・魚種・日の需要、週末、旬でない魚は品薄で高い、その日にその市場へ売った量で下がる
function demand(place,fishId,day,inSeason,soldKg){const d=.88+.5*hash((day|0)+104729,strHash(place.id+':'+fishId));const wk=((day|0)%7)>=5?1.06:1;const sc=inSeason?1:1.08;
  const sat=Math.max(.7,1-.04*(soldKg||0));return d*wk*sc*sat;}
function isOpen(place,minOfDay){const o=KIND[place.kind].open;return minOfDay>=o[0]&&minOfDay<o[1];}
function regionOf(place,ctx){return place&&place.region||ctx&&ctx.region||'yokohama';}
// その場所の掛け率（大規模魚市場は需要、移動買取は車ごとの差）
function placeMult(place,id,ctx,info){if(!place)return 1;const k=KIND[place.kind]||KIND.shop;if(place.kind==='market')return demand(place,id,ctx.day,info&&info.inSeason,soldKgOf(ctx.S,place.id,id,ctx.day));
  if(place.kind==='npc')return k.mult*(place.mult||1);return k.mult;}
// 1匹の値段。info＝{kg:円/kg, L:[最小,最大]cm, inSeason}、ctx＝{absMin, day, iced, place, region, S}
function priceOf(item,info,ctx){const fr=freshness(item,ctx.absMin,ctx.iced);if(fr<=0||!info||!info.kg)return{yen:0,fresh:fr,spoiled:fr<=0};
  const size=info.L?.85+.3*Math.max(0,Math.min(1,(item.L-info.L[0])/Math.max(1,info.L[1]-info.L[0]))):1;
  const fm=.25+.75*fr,df=dayFactor(item.id,ctx.day,info.inSeason),rg=regionFactor(regionOf(ctx.place,ctx),item.id,ctx.day),km=placeMult(ctx.place,item.id,ctx,info);
  const yen=Math.max(10,Math.round(info.kg*item.kg*size*fm*df*rg*km/10)*10);return{yen,fresh:fr,size,day:df,region:rg,kind:km};}
// 相場（円/kg・大きさと鮮度を除く）：比較画面用
function ratePerKg(id,info,place,ctx){if(!info||!info.kg)return 0;return Math.round(info.kg*dayFactor(id,ctx.day,info.inSeason)*regionFactor(regionOf(place,ctx),id,ctx.day)*placeMult(place,id,ctx,info));}
// スマホのアプリ（その地域の相場の8割）
function appPlace(region){return{id:'app_'+(region||'yokohama'),n:'魚市場アプリ',kind:'app',region:region||'yokohama'};}
// 入れられるか（重さ）
function capacity(cooler,caps){return cooler?(caps[cooler]||8):BUCKET_KG;}
function load(S){return(S.catch||[]).reduce((a,c)=>a+(c.kg||0),0);}
function uidOf(S){S.catchN=(S.catchN|0)+1;return S.catchN;}
// 持ち物へ。入らなければ false
function add(S,item,caps){S.catch=S.catch||[];const cap=capacity(S.veh&&S.veh.cooler,caps);if(load(S)+item.kg>cap+1e-9)return false;if(item.u==null)item.u=uidOf(S);S.catch.push(item);return true;}
// お気に入り（売らない）
function setFav(S,u,on){const c=(S.catch||[]).find(q=>q.u===u);if(!c)return false;if(on)c.fav=true;else delete c.fav;return true;}
// その日に、その市場へ売った量（kg）。大規模魚市場の値下がりに使う
function soldKgOf(S,placeId,id,day){const m=S&&S.mSold;if(!m||m.day!==(day|0))return 0;return m.k[placeId+':'+id]||0;}
// 売る候補：uids を省くとお気に入り以外の全部。お気に入り・以前の買取済みは入らない
function pick(S,uids){const set=uids?new Set(uids):null;return(S.catch||[]).filter(c=>!c.legacy&&!c.fav&&(!set||set.has(c.u)));}
// 見積もり（確認画面用）：実際には売らない
function quote(S,place,ctx,infoOf,uids){ctx=Object.assign({},ctx,{place,S});const out={yen:0,n:0,spoiled:0,lines:[],open:isOpen(place,ctx.minOfDay==null?720:ctx.minOfDay)};
  for(const c of pick(S,uids)){const p=priceOf(c,infoOf(c.id),ctx);out.lines.push({u:c.u,id:c.id,kg:c.kg,L:c.L,yen:p.yen,spoiled:!!p.spoiled,fresh:p.fresh});if(p.spoiled)out.spoiled++;else{out.yen+=p.yen;out.n++;}}return out;}
// 売る（uids を省くとお気に入り以外の全部）。営業時間外は売らない。傷んだ魚は処分。所持金・持ち物・実績を一度に更新する。
// 戻り値：{ok, yen, sold, spoiled, reason}。同じ uids で二度呼んでも、2回目は何も売れない
function sell(S,place,ctx,infoOf,uids){const out={ok:true,yen:0,sold:0,spoiled:0,items:[]};
  if(ctx.minOfDay!=null&&!isOpen(place,ctx.minOfDay))return Object.assign(out,{ok:false,reason:'営業時間外'});
  const c2=Object.assign({},ctx,{place,S}),targets=new Set(pick(S,uids));
  const day=ctx.day|0;if(!S.mSold||S.mSold.day!==day)S.mSold={day,k:{}};
  // 値段は売る前の相場でまとめて決め（見積もりと同じ額）、そのあと売れ行きを記録する
  const priced=new Map();for(const c of targets)priced.set(c,priceOf(c,infoOf(c.id),c2));
  const keep=[];for(const c of S.catch||[]){if(!targets.has(c)){keep.push(c);continue;}const p=priced.get(c);
    if(p.spoiled){out.spoiled++;continue;}out.yen+=p.yen;out.sold++;out.items.push({id:c.id,kg:c.kg,L:c.L,yen:p.yen});}
  for(const it of out.items){const k=place.id+':'+it.id;S.mSold.k[k]=+((S.mSold.k[k]||0)+it.kg).toFixed(3);}
  S.catch=keep;S.money=(S.money||0)+out.yen;
  // 実績
  const st=S.mStats=S.mStats||{n:0,yen:0,best:null,kinds:{}};st.n+=out.sold;st.yen+=out.yen;for(const it of out.items){if(!st.best||it.yen>st.best.yen)st.best={id:it.id,yen:it.yen,L:it.L,place:place.n};}
  if(out.sold)st.kinds[place.kind]=(st.kinds[place.kind]||0)+out.sold;return out;}
// 地域ごとの比較：その魚種について、各売り場の相場（円/kg）と営業中か。places は index.html の買取所の一覧
function compare(ids,places,ctx,infoOf){const out=[];for(const id of ids){const info=infoOf(id);if(!info||!info.kg)continue;const rows=[];
    for(const p of places){const c=Object.assign({},ctx,{S:ctx.S});rows.push({place:p,rate:ratePerKg(id,info,p,c),open:ctx.minOfDay==null||isOpen(p,ctx.minOfDay)});}
    for(const rg of Object.keys(REGION_LABEL)){const a=appPlace(rg);rows.push({place:a,rate:ratePerKg(id,info,a,ctx),open:true});}
    rows.sort((a,b)=>b.rate-a.rate);out.push({id,rows});}return out;}
// 移動買取トラック：6時〜21時、3時間ごとに場所が変わる。候補（駐車場・港・海岸沿いの車道）から日と時間帯で決める
function npcBuyers(day,minOfDay,cands,n){if(minOfDay<6*60||minOfDay>=21*60||!cands||!cands.length)return[];const blk=Math.floor((minOfDay-6*60)/180);n=Math.min(n||8,cands.length);
  const used=new Set(),out=[];for(let i=0;out.length<n&&i<n*6;i++){const k=Math.floor(hash((day|0)*5+blk,i+31)*cands.length);if(used.has(k))continue;used.add(k);const c=cands[k];
    out.push({id:`npc_${day|0}_${blk}_${k}`,n:'移動買取トラック',kind:'npc',x:c.x,y:c.y,region:c.region,mult:+(.95+.17*hash((day|0)+blk,k)).toFixed(3),near:c.label||'',until:6*60+(blk+1)*180});}return out;}
// 古いセーブ：以前は釣った時点で買取済み。クーラーの重さ（S.veh.fishKg）は売れない「持ち帰りの魚（売却済み）」として残す。通し番号のない魚に番号を振る
function migrate(S){if(!S.catch){S.catch=[];const kg=S.veh&&S.veh.fishKg;if(kg>0)S.catch.push({id:'_legacy',kg:+kg.toFixed(2),L:0,t:0,legacy:true});}
  for(const c of S.catch)if(c.u==null)c.u=uidOf(S);const own=S.veh&&S.veh.owned;if(own)for(const o of own)for(const c of o.catch||[])if(c.u==null)c.u=uidOf(S);return S;}
function placesIn(toGame){return PLACES.map(p=>{const[x,y]=toGame(p.lat,p.lon);return Object.assign({x,y},p);});}
const API={PLACES,KIND,APP_RATE,REGION_LABEL,BUCKET_KG,TAU,SPOIL_H,freshness,dayFactor,regionFactor,demand,isOpen,priceOf,ratePerKg,appPlace,capacity,load,add,setFav,quote,sell,compare,npcBuyers,migrate,placesIn};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaMarket=API;
})(typeof self!=='undefined'?self:this);
