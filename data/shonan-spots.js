/* 湘南エリア（鎌倉市〜大磯町）の釣りスポットと規制エリア。
   ・名称・種類・魚種・釣り方・注意・区分は、ユーザーが用意した資料（公式資料のリンク付き）をそのまま写したもの。
   ・位置（latlon）は記憶にもとづくおおよその値で、実測ではない（dataConfidence.position = 'approx'）。地図上の配置にだけ使う。
   ・水深・流れ・根掛かり・波当たりなどゲームで使う数値は「ゲーム用の推定値」として game にまとめ、実測値としては扱わない。
   ・出現確率は持たない（targetSpecies は代表的な候補。釣れやすさはゲーム側で魚の重みとして別に決める）。
   ・現実の規制は変わるので、ゲーム内でも「現地の最新表示を優先」と表示する。

   accessStatus（ゲームでの扱い）
     official    … 公式開放区域（営業時間・禁止事項あり）→ 釣りできる
     general     … 一般海岸・現地確認 → 釣りできる（注意を表示）
     check       … 立入可能区域のみ・現地確認 → 釣りできる（注意を強めに表示）
     unverified  … 開放状況・釣り可能範囲が未確認 → ゲームでは釣りできない
     protected   … 現地規制・自然保護の確認が必要 → ゲームでは釣りできない
   type: beach（砂浜）/ river（河口）/ iso（磯）/ port（漁港）/ breakwater（堤防） */
(function(root){
'use strict';
const SRC={
  hiratsuka:'https://www.city.hiratsuka.kanagawa.jp/nosui/page-c_00573.html',
  oiso:'https://www.town.oiso.kanagawa.jp/sangyo/doro/1359443393477.html',
  oisoRule:'https://www.town.oiso.kanagawa.jp/material/files/group/22/yuuhodou.pdf',
  koshigoe:'https://www.city.kamakura.kanagawa.jp/nousui/kosigoe/koshigoegyoko.html',
  chigasaki:'https://www.city.chigasaki.kanagawa.jp/faq/1000012/1000571/1014985.html'};
const BEACH_NOTE='一般海岸。釣りの可否・区域は現地の表示を確認';
// s(id, name, municipality, area, type, bottom, species, methods, latlon, more)
function s(id,name,municipality,area,type,bottomType,targetSpecies,fishingMethods,latlon,more){
  return Object.assign({id,name,municipality,area,type,bottomType,targetSpecies,fishingMethods,latlon,
    seasonalSpecies:null,accessStatus:'general',accessHours:null,prohibitedMethods:[],hazards:[],notes:'',
    dataConfidence:{name:'provided',position:'approx',species:'representative',game:'estimate'},sourceUrls:[]},more||{});}

const SPOTS=[
  // ===== 1. 鎌倉 =====
  s('zaimokuza','材木座海岸','鎌倉市','kamakura','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3040,139.5530],
    {hazards:['遊泳者','マリンスポーツ','漁業活動'],notes:'遠浅のサーフ。河口や砂地を探る。'+BEACH_NOTE,swimArea:true}),
  s('namerigawa','滑川河口','鎌倉市','kamakura','river','sand_mud',['シーバス','クロダイ','キビレ','ハゼ','マゴチ'],['ルアー','ちょい投げ'],[35.3072,139.5478],
    {notes:'淡水と海水が混ざり、潮位で流れが変わる。'+BEACH_NOTE}),
  s('yuigahama','由比ヶ浜海岸','鎌倉市','kamakura','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ'],['投げ釣り','ルアー'],[35.3093,139.5410],
    {hazards:['観光客','遊泳者'],notes:'遠浅で比較的穏やかな湾内。'+BEACH_NOTE,swimArea:true}),
  s('sakanoshita','坂ノ下海岸','鎌倉市','kamakura','beach','sand_rock',['シロギス','クロダイ','メジナ','カサゴ'],['投げ釣り','ウキ釣り'],[35.3075,139.5315],
    {accessStatus:'check',notes:'砂地から岩礁帯へ移る。現地確認。'}),
  s('inamuragasaki','稲村ヶ崎','鎌倉市','kamakura','iso','rock',['クロダイ','メジナ','カサゴ','メバル'],['ウキ釣り','胴突き'],[35.3000,139.5240],
    {accessStatus:'check',hazards:['根掛かり','波の影響が大きい','落水'],notes:'岩礁。立入可能な安全区域のみ。現地確認。'}),
  s('shichirigahama','七里ヶ浜','鎌倉市','kamakura','beach','sand_rock',['シロギス','クロダイ','メジナ','ヒラメ','シーバス'],['投げ釣り','ルアー','ウキ釣り'],[35.3045,139.5080],
    {accessStatus:'check',hazards:['サーファー','潮位と波'],notes:'岩礁の点在する海岸。現地確認。'}),
  s('minegahara','峰ヶ原・鎌倉高校前海岸','鎌倉市','kamakura','beach','sand_rock',['クロダイ','メジナ','シロギス','カサゴ'],['ウキ釣り','投げ釣り'],[35.3060,139.5000],
    {accessStatus:'check',notes:'岩礁帯と砂地が混在。現地確認。'}),
  s('koshigoe_beach','腰越海岸','鎌倉市','kamakura','beach','sand',['シロギス','イシモチ','マゴチ','ヒラメ'],['投げ釣り','ルアー'],[35.3086,139.4872],
    {hazards:['漁船','遊泳者'],notes:'漁港に隣接する砂浜。'+BEACH_NOTE,swimArea:true}),
  s('koshigoe_port','腰越漁港','鎌倉市','kamakura','port','sand_mud',['アジ','イワシ','サバ','クロダイ','カサゴ'],[],[35.3078,139.4905],
    {accessStatus:'unverified',accessHours:{all:[5,17]},hazards:['漁業優先'],notes:'立入時間5:00〜17:00。釣り可能な区域・方法は管理者に確認が必要なため、ゲームでは港内を釣り場として開放しない。',sourceUrls:[SRC.koshigoe]}),
  // ===== 2. 藤沢・江の島 =====
  s('katase_east','片瀬東浜','藤沢市','fujisawa','beach','sand',['シロギス','イシモチ','マゴチ','ヒラメ'],['投げ釣り','ルアー'],[35.3074,139.4840],
    {notes:'江の島東側の砂浜。'+BEACH_NOTE,swimArea:true}),
  s('enoshima_omote','江の島表磯','藤沢市','fujisawa','iso','rock',['メジナ','クロダイ','カサゴ','カワハギ','アオリイカ'],['ウキ釣り','胴突き','エギング'],[35.2985,139.4858],
    {accessStatus:'check',hazards:['波の影響','落水'],notes:'岩礁で水深の変化がある。立入可能区域のみ。現地確認。'}),
  s('enoshima_ura','江の島裏磯','藤沢市','fujisawa','iso','rock',['メジナ','クロダイ','カサゴ','カワハギ','アオリイカ','回遊魚'],['ウキ釣り','エギング','ルアー'],[35.2972,139.4770],
    {accessStatus:'check',hazards:['高波','落水'],notes:'外洋に面した岩礁。立入可能区域のみ。現地確認。'}),
  s('enoshima_bank','江の島湘南大堤防','藤沢市','fujisawa','breakwater','sand_rock',['アジ','サバ','イワシ','カマス','クロダイ','メジナ'],['サビキ','ウキ釣り','ルアー'],[35.3010,139.4760],
    {accessStatus:'unverified',notes:'回遊魚・潮通しのよい堤防。開放状況・釣り可能範囲が未確認のため、ゲームでは釣り場として開放しない（閉鎖区域・テトラ・ヨットハーバーは除外）。'}),
  s('katase_port','片瀬漁港・西プロムナード','藤沢市','fujisawa','breakwater','sand_mud',['シロギス','ハゼ','イワシ','サバ','クロダイ'],['ちょい投げ','サビキ','ウキ釣り'],[35.3048,139.4793],
    {accessStatus:'official',notes:'指定海釣りゾーンのみ（東側・港内側・先端の禁止区域は除外）。比較的浅い砂泥底。'}),
  s('sakaigawa','境川河口','藤沢市','fujisawa','river','sand_mud',['シーバス','クロダイ','キビレ','ハゼ','マゴチ'],['ルアー','ちょい投げ'],[35.3080,139.4808],
    {accessStatus:'check',notes:'汽水で、水流と潮位が変わる。釣り可能な河口岸辺のみ。現地確認。'}),
  s('katase_west','片瀬西浜','藤沢市','fujisawa','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ'],['投げ釣り','ルアー'],[35.3110,139.4750],
    {hazards:['遊泳者','サーファー'],notes:'広い砂浜。'+BEACH_NOTE,swimArea:true}),
  s('hikichigawa','引地川河口','藤沢市','fujisawa','river','sand',['シーバス','クロダイ','キビレ','ヒラメ','マゴチ','ハゼ'],['ルアー','ちょい投げ'],[35.3178,139.4598],
    {accessStatus:'check',notes:'潮位と河川の流量で流れが変わる。現地確認。'}),
  s('kugenuma','鵠沼海岸','藤沢市','fujisawa','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3160,139.4660],
    {hazards:['サーファーが非常に多い'],notes:'砂底で波打ち際の地形が変わる。'+BEACH_NOTE,swimArea:true}),
  s('tsujido','辻堂海岸','藤沢市','fujisawa','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3218,139.4450],
    {hazards:['離岸流'],notes:'広い砂浜。離岸流と砂州。'+BEACH_NOTE,swimArea:true}),
  // ===== 3. 茅ヶ崎 =====
  s('shiomidai','汐見台海岸','茅ヶ崎市','chigasaki','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ'],['投げ釣り','ルアー'],[35.3225,139.4300],{notes:'砂底で砂州ができる。'+BEACH_NOTE}),
  s('hamasuka','浜須賀・菱沼海岸','茅ヶ崎市','chigasaki','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ'],['投げ釣り','ルアー'],[35.3213,139.4230],{notes:'連続するサーフで地形が変わる。'+BEACH_NOTE}),
  s('headland','茅ヶ崎ヘッドランド周辺','茅ヶ崎市','chigasaki','beach','sand_rock',['クロダイ','カサゴ','シーバス','ヒラメ','マゴチ'],['ルアー','ウキ釣り','投げ釣り'],[35.3196,139.4148],
    {accessStatus:'check',hazards:['離岸流','滑りやすい構造物'],notes:'砂地と岩礁性の地形、流れのヨレ。安全な釣り可能地点のみ（T字の部分は除外）。現地確認。'}),
  s('chigasaki_east','茅ヶ崎東海岸サーフ','茅ヶ崎市','chigasaki','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ'],['投げ釣り','ルアー'],[35.3180,139.4100],{notes:'海底地形が変わる砂浜。'+BEACH_NOTE}),
  s('southern','サザンビーチちがさき','茅ヶ崎市','chigasaki','beach','sand',['シロギス','イシモチ','マゴチ','ヒラメ'],['投げ釣り','ルアー'],[35.3160,139.4050],
    {hazards:['夏季遊泳区域','観光客'],notes:'比較的穏やかな砂浜。'+BEACH_NOTE,swimArea:true}),
  s('chigasaki_west','茅ヶ崎西浜','茅ヶ崎市','chigasaki','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3148,139.3950],{notes:'砂地。河口方面へ地形が変わる。'+BEACH_NOTE}),
  s('yanagishima','柳島海岸','茅ヶ崎市','chigasaki','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3165,139.3800],{notes:'相模川河口に近いサーフ。'+BEACH_NOTE}),
  s('sagami_e','相模川河口・茅ヶ崎側','茅ヶ崎市','chigasaki','river','sand',['シーバス','クロダイ','キビレ','ヒラメ','マゴチ'],['ルアー','投げ釣り'],[35.3178,139.3745],
    {accessStatus:'check',hazards:['船舶航路','増水','強い流れ'],notes:'大河川の汽水。強い流れと濁り。安全な河口岸辺のみ。現地確認。'}),
  // ===== 4. 平塚 =====
  s('sagami_w','相模川河口・平塚側','平塚市','hiratsuka','river','sand',['シーバス','クロダイ','キビレ','ハゼ','ヒラメ','マゴチ'],['ルアー','ちょい投げ'],[35.3180,139.3665],
    {accessStatus:'check',hazards:['航路','立入規制'],notes:'河口流・砂州・潮の影響。安全な岸辺のみ。現地確認。'}),
  s('shinko_east','平塚新港・東岸壁','平塚市','hiratsuka','port','sand_mud',['アジ','サバ','イワシ','クロダイ','シロギス'],['サビキ','ウキ釣り','ちょい投げ'],[35.3160,139.3630],
    {accessStatus:'official',accessHours:{all:[7,17]},hazards:['漁船優先','荒天時閉鎖'],notes:'岸壁・船道・砂泥底。',sourceUrls:[SRC.hiratsuka]}),
  s('shinko_south','平塚新港・南岸壁','平塚市','hiratsuka','port','sand_mud',['アジ','イワシ','サバ','クロダイ','カサゴ'],['サビキ','ウキ釣り','胴突き'],[35.3138,139.3612],
    {accessStatus:'official',accessHours:{all:[7,17]},hazards:['漁業活動優先','荒天時閉鎖'],notes:'岸壁と人工構造物。',sourceUrls:[SRC.hiratsuka]}),
  s('beachpark','平塚海岸・ビーチパーク前','平塚市','hiratsuka','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3128,139.3550],{notes:'外洋のサーフ。砂州と波打ち際。'+BEACH_NOTE,swimArea:true}),
  s('sodegahama','袖ヶ浜','平塚市','hiratsuka','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ'],['投げ釣り','ルアー'],[35.3110,139.3490],{notes:'砂底で波打ち際の地形が変わる。'+BEACH_NOTE}),
  s('ryujogaoka','龍城ヶ丘海岸','平塚市','hiratsuka','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3090,139.3430],{hazards:['一部根掛かり'],notes:'砂地。一部に根掛かりの可能性。'+BEACH_NOTE}),
  s('nijigahama','虹ヶ浜','平塚市','hiratsuka','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3062,139.3360],{notes:'広い砂浜。砂州と波。'+BEACH_NOTE}),
  s('hanamizugawa','花水川河口','平塚市','hiratsuka','river','sand',['シーバス','クロダイ','キビレ','ヒラメ','マゴチ'],['ルアー','投げ釣り'],[35.3032,139.3285],{accessStatus:'check',notes:'河川水と海水が混ざり、砂州がある。現地確認。'}),
  // ===== 5. 大磯 =====
  s('kitahama','大磯北浜海岸','大磯町','oiso','beach','sand',['シロギス','イシモチ','ヒラメ','マゴチ','シーバス'],['投げ釣り','ルアー'],[35.3010,139.3160],
    {hazards:['夏季海水浴エリア'],notes:'サーフ。砂地で波の影響。'+BEACH_NOTE,swimArea:true}),
  s('oiso_west','大磯港・西防波堤内側','大磯町','oiso','breakwater','rock',['ウミタナゴ','メジナ','クロダイ','カサゴ','アジ'],['ウキ釣り','脈釣り','胴突き'],[35.2995,139.3188],
    {accessStatus:'official',accessHours:{byMonth:{2:[8.5,17],3:[8.5,17],4:[8.5,17],9:[8.5,17],5:[8.5,18],6:[8.5,18],7:[8.5,18],8:[8.5,18],10:[8.5,16],11:[8.5,16],12:[8.5,16],1:[8.5,16]}},
     prohibitedMethods:['投げ釣り','ルアー','コマセ','掛針'],footOnly:true,
     notes:'港内側・岸壁・捨て石。足元のウキ釣り・脈釣り・胴突きのみ（東防波堤・漁業区域・テトラは除外）。',sourceUrls:[SRC.oiso,SRC.oisoRule]}),
  s('terugasaki','照ヶ崎海岸','大磯町','oiso','iso','rock',['メジナ','クロダイ','カサゴ'],[],[35.2990,139.3215],
    {accessStatus:'protected',notes:'礫浜と岩礁。アオバトの飛来地。現地の規制・自然保護の確認が必要なため、ゲームでは釣り場として開放しない。'}),
  s('oiso_nishikoiso','大磯海岸西側・西小磯方面','大磯町','oiso','beach','sand_gravel',['シロギス','イシモチ','ヒラメ','マゴチ','クロダイ'],['投げ釣り','ルアー'],[35.2965,139.2985],{notes:'砂利と砂が混ざり、地形が変わる。'+BEACH_NOTE})
];

/* 釣り禁止・制限エリア（独立した規制データ）。r は半径（m、ゲーム上の近似の範囲）。season は遊泳区域のように時期が限られるもの */
const RESTRICTED=[
  {id:'A',name:'茅ヶ崎漁港',status:'原則立入禁止',latlon:[35.3150,139.4010],r:120,sourceUrls:[SRC.chigasaki]},
  {id:'B',name:'大磯港 東防波堤',status:'立入禁止',latlon:[35.2985,139.3225],r:90,sourceUrls:[SRC.oiso]},
  {id:'C',name:'大磯港 漁業区域',status:'釣り禁止',latlon:[35.3002,139.3205],r:70,sourceUrls:[SRC.oiso]},
  {id:'D',name:'平塚新港の閉鎖区域・防波堤・消波ブロック',status:'立入禁止',latlon:[35.3122,139.3640],r:110,sourceUrls:[SRC.hiratsuka]},
  {id:'E',name:'片瀬漁港（指定海釣りゾーン以外）',status:'釣り禁止区域を含む',latlon:[35.3055,139.4808],r:70},
  {id:'F',name:'江の島ヨットハーバー・漁港管理区域',status:'釣り禁止区域を含む',latlon:[35.3022,139.4838],r:150},
  {id:'G',name:'各海岸の夏季遊泳区域',status:'開設時間中の釣りは区域別に制限確認',season:{months:[7,8],hours:[9,17]},appliesTo:'swimArea'}];

const SHONAN={SPOTS,RESTRICTED,SRC,NOTICE:'釣り場の情報はゲーム用の目安です。規制は変わるため、現地の最新の表示と管理者の案内を優先してください。'};
if(typeof module!=='undefined'&&module.exports)module.exports=SHONAN;else root.HamaShonanData=SHONAN;
})(typeof self!=='undefined'?self:this);
