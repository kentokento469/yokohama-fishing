const test=require('node:test');const assert=require('node:assert');
const V=require('../vehicles.js');
const S0=m=>V.migrate({money:m==null?1e7:m});
// 一定の入力で t 秒走ったときの距離
function run(o,surface,t,S,extra){const st={v:0,h:0};let d=0;for(let i=0;i<t*10;i++){const r=V.ride(o,st,{throttle:1,steer:0},Object.assign({surface},extra),.1,S);d+=r.dist;}return{d,v:st.v};}

test('5種の自転車・6種の車がそろい、価格と速さが仕様どおり',()=>{
  assert.strictEqual(V.BIKES.length,5);assert.strictEqual(V.CARS.length,6);
  const b=Object.fromEntries(V.BIKES.map(x=>[x.name,[x.price,x.kmh]]));
  assert.deepStrictEqual(b['シティサイクル'],[18000,15]);assert.deepStrictEqual(b['ロードバイク'],[120000,28]);assert.deepStrictEqual(b['電動アシスト自転車'],[135000,20]);
  assert.deepStrictEqual(V.CARS.map(c=>c.loadKg),[100,250,150,300,350,500]);
});
test('お金が足りないと買えない／買うと持ち物に入る',()=>{
  const S=S0(10000);assert.strictEqual(V.buy(S,V.byId('bike_city')).ok,false);assert.strictEqual(S.money,10000);
  S.money=20000;const r=V.buy(S,V.byId('bike_city'));assert.ok(r.ok);assert.strictEqual(S.money,2000);assert.strictEqual(S.veh.owned.length,1);
});
test('自転車の種類で性能が違う：舗装路はロード、砂浜はMTBが速い',()=>{
  const S=S0();const road=V.buy(S,V.byId('bike_road')).o,mtb=V.buy(S,V.byId('bike_mtb')).o,city=V.buy(S,V.byId('bike_city')).o;
  const p=k=>run(k,'paved',20,S).v,s=k=>run(k,'sand',20,S).v;
  assert.ok(p(road)>p(mtb)&&p(mtb)>p(city));assert.ok(s(mtb)>s(road)*3);
});
test('岩場・階段は乗ったまま進めない',()=>{
  const S=S0();const o=V.buy(S,V.byId('bike_mtb')).o;const st={v:3,h:0};
  const r=V.ride(o,st,{throttle:1},{surface:'rock'},.1,S);assert.ok(r.blocked);assert.strictEqual(r.dist,0);assert.strictEqual(st.v,0);
  assert.ok(V.ride(o,{v:0,h:0},{throttle:1},{surface:'steps'},.1,S).blocked);
});
test('坂は電動アシストが強い',()=>{
  const S=S0();const e=V.buy(S,V.byId('bike_ebike')).o,c=V.buy(S,V.byId('bike_city')).o;
  const ratio=o=>run(o,'paved',20,S,{slope:1}).v/run(o,'paved',20,S).v;assert.ok(ratio(e)>ratio(c)+.2);
});
test('電動アシストは電池が減り、切れると遅くなる。充電できる',()=>{
  const S=S0();const o=V.buy(S,V.byId('bike_ebike')).o;const v1=run(o,'paved',10,S).v;
  o.batt=0;S.veh.stamina=100;const v0=run(o,'paved',10,S).v;assert.ok(v0<v1*.8);
  const r=V.refuel(S,o);assert.ok(r.ok);assert.strictEqual(o.batt,100);
});
test('車は走ると燃料が減り、燃料0では動かない。給油で満タン',()=>{
  const S=S0();const o=V.buy(S,V.byId('car_kei')).o;const f0=o.fuel;const r=run(o,'paved',60,S);
  assert.ok(r.d>500);const realKm=r.d*V.SC/1000;assert.ok(Math.abs((f0-o.fuel)-realKm/20)<1e-6);
  o.fuel=0;assert.strictEqual(V.canRide(S,o,1).ok,false);assert.strictEqual(run(o,'paved',5,S).d,0);
  const m=S.money,c=V.refuelCost(o);assert.ok(V.refuel(S,o).ok);assert.strictEqual(o.fuel,30);assert.strictEqual(S.money,m-c);
});
test('車は道の制限速度を超えない',()=>{const S=S0();const o=V.buy(S,V.byId('car_suv')).o;assert.ok(run(o,'paved',60,S,{limit:8}).v<=8+1e-9);});
test('積載とクーラー：大型クーラーは自転車に積めない、重すぎると乗れない',()=>{
  const S=S0();const b=V.buy(S,V.byId('bike_road')).o,c=V.buy(S,V.byId('car_kei')).o;
  assert.strictEqual(V.canRide(S,b,6).ok,false);assert.ok(V.canRide(S,b,3).ok);
  assert.ok(V.buyCooler(S,V.COOLERS[1]).ok);assert.strictEqual(V.buyCooler(S,V.COOLERS[1]).ok,false);
  assert.strictEqual(V.canRide(S,b,1).ok,false);assert.ok(V.canRide(S,c,20).ok);
  const tk={r:{rodWeightG:150},l:{reelWeightG:250},j:{weightG:40}};S.rodId='r';S.reelId='l';S.eq='j';S.tk={j:5};
  assert.strictEqual(V.carriedKg(S,id=>tk[id]),14+.6);
});
test('修理：耐久が減ると費用がかかり、直すと最大に戻る',()=>{
  const S=S0();const o=V.buy(S,V.byId('car_compact')).o;V.crash(o,12);assert.ok(o.dur<110);
  const c=V.repairCost(o);assert.ok(c>0);assert.ok(V.repair(S,o).ok);assert.strictEqual(o.dur,110);assert.strictEqual(V.repair(S,o).ok,false);
});
test('車は駐車場にだけ停められる。自転車はどこでも。位置が記録される',()=>{
  const S=S0();const c=V.buy(S,V.byId('car_kei')).o,b=V.buy(S,V.byId('bike_city')).o;S.veh.using=c.uid;
  assert.strictEqual(V.park(S,c,10,20,null).ok,false);assert.ok(V.park(S,c,10,20,{id:'p1'},'shonan').ok);
  assert.deepStrictEqual([S.veh.parked[c.uid].x,S.veh.parked[c.uid].lotId],[10,'p1']);assert.strictEqual(S.veh.using,null);
  assert.ok(V.park(S,b,5,5,null).ok);V.unpark(S,c);assert.strictEqual(S.veh.using,c.uid);assert.ok(!S.veh.parked[c.uid]);
  assert.strictEqual(V.parkingFee({feePerHour:300},2.2),900);assert.strictEqual(V.parkingFee({},3),0);
});
test('セーブの往復と古いセーブの移行',()=>{
  const old={money:5};V.migrate(old);assert.deepStrictEqual(old.veh,V.fresh());
  const S=S0();V.buy(S,V.byId('bike_mtb'));V.park(S,S.veh.owned[0],1,2,null);const T=V.migrate(JSON.parse(JSON.stringify(S)));
  assert.deepStrictEqual(T.veh,S.veh);const part={money:1,veh:{owned:[]}};V.migrate(part);assert.strictEqual(part.veh.stamina,100);
});
