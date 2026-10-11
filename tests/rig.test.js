const test=require('node:test'),assert=require('node:assert');
const R=require('../rig.js'),{len,sub,dot,norm}=R.v;
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
test('2本の骨のIK：骨の長さを保ち、届く所なら手は目標に、ひじは pole の側',()=>{const S=[0,1.4,0],L1=.29,L2=.29;
  for(const T of[[.3,1.1,.3],[-.2,1.0,.35],[.1,1.3,.2],[0,.9,.1]]){const r=R.twoBone(S,T,L1,L2,[0,.6,-.2]);assert.ok(near(len(sub(r.elbow,S)),L1,1e-6));assert.ok(near(len(sub(r.hand,r.elbow)),L2,1e-6));if(r.reach)assert.ok(len(sub(r.hand,T))<1e-6);
    const n=norm(sub(T,S)),pm=sub([0,.6,-.2],S),ev=sub(r.elbow,S);const side=dot(sub(ev,R.v.mul(n,dot(ev,n))),sub(pm,R.v.mul(n,dot(pm,n))));assert.ok(side>=-1e-9,'ひじが pole の反対側');}});
test('届かない目標は伸ばしきった所まで（骨を伸ばさない）',()=>{const r=R.twoBone([0,0,0],[2,0,0],.29,.29,[0,-1,0]);assert.ok(!r.reach);assert.ok(len(r.hand)<=.58);assert.ok(near(len(r.elbow),.29));});
test('竿の座標：右・上・先が直交し、上は空の方',()=>{const fr=R.rodFrame([0,.6,.8],[0,1,0]);for(const[a,b]of[['fwd','up'],['up','right'],['right','fwd']])assert.ok(Math.abs(dot(fr[a],fr[b]))<1e-9);assert.ok(fr.up[1]>0);
  // 竿先を +z に向けた時、右は -x（右手系・y が上）
  const f2=R.rodFrame([0,0,1],[0,1,0]);assert.ok(f2.right[0]<-.99);});
test('ハンドル：自動ならスピニングは左ハンドル（右手で竿）、ベイトは右ハンドル。設定で入れ替え',()=>{assert.deepStrictEqual(R.handSides({reelType:'spinning'}),{handle:'L',rodHand:'R',crankHand:'L'});
  assert.strictEqual(R.handSides({reelType:'baitcast'}).rodHand,'L');assert.strictEqual(R.handSides({reelType:'spinning'},'R').crankHand,'R');});
test('リール：スピニングは竿の下・ベイトは上、ノブはハンドルの軸から腕の長さで1周回る',()=>{const fr=R.rodFrame([0,.5,.86],[0,1,0]);
  for(const reel of[{reelType:'spinning',reelWeightG:250},{reelType:'baitcast',reelWeightG:200}]){const dim=R.gearDims({lengthM:2.7},reel);const seat=[0,1.1,.3];
    const ps=[0,1,2,3,4,5].map(i=>R.reelPoints(seat,fr,dim,'L',i/6*6.283));const b=ps[0].body;assert.ok(dot(sub(b,seat),fr.up)*dim.footDir>0);
    for(const p of ps){assert.ok(near(len(sub(p.knob,p.hub)),dim.handleArm,1e-9));assert.ok(Math.abs(dot(sub(p.knob,p.hub),fr.right))<1e-9,'ハンドルは竿の横を軸に回る');}
    assert.ok(dot(sub(ps[0].hub,b),fr.right)<0,'左ハンドルは竿の左');}});
test('竿の寸法：長い竿ほど尻手が長い・範囲内',()=>{const a=R.gearDims({lengthM:1.8}),b=R.gearDims({lengthM:4.2});assert.ok(b.butt>a.butt);assert.ok(a.butt>=.2&&b.butt<=.48);});
