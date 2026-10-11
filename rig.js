/* 釣り具とプレイヤーの手の位置関係（window.HamaRig）。three.js・DOM に依存しない（Node のテストで動く）。座標は [x,y,z] の配列（y が上）。
   考え方：①竿は体の前の「構えの位置」に置く（腕の向きから竿を決めない）→ ②竿を握る手はリールシート、リールを回す手はハンドルのノブへ、
   腕を2本の骨（上腕・前腕）の IK で届かせる。骨の長さは変えず、届かない時は届く所まで（腕を伸ばしきる）。
   ・gearDims(rod, reel)：竿の長さ・リールの種類から、グリップ（尻手）・リールシートの位置、リールの足の向き（スピニングは下、ベイトは上）、ハンドルの腕の長さ
   ・handSides(reel, pref)：ハンドルの左右（設定 'L'/'R'、自動ならスピニングは左ハンドル＝右手で竿、ベイトは右ハンドル＝左手で竿）
   ・rodFrame(d, up)：竿の向き d から、竿に固定した座標（右・上・先）を作る。リールが竿のまわりで回ってしまわないように
   ・twoBone(S, T, L1, L2, pole)：肩 S から手 T へ、上腕 L1・前腕 L2 のときのひじの位置（pole の側に曲がる）と、実際に届く手の位置 */
(function(root){
'use strict';
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.sqrt(dot(a,a)),norm=a=>{const l=len(a)||1;return mul(a,1/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// 竿とリールの寸法（m）。竿の長さで尻手（リールシートより後ろ）の長さが変わる。リールの大きさは重さから
function gearDims(rod,reel){const L=clamp(rod&&rod.lengthM||2.7,1.5,4.6);const bait=!!(reel&&(reel.reelType==='baitcast'||reel.reelType==='conventional'));
  const w=reel&&reel.reelWeightG||220,s=clamp(Math.cbrt(w/220),.75,1.5);
  return{L,butt:clamp(L*.11,.2,.48),// リールシートから尻までの長さ
    seatT:0,bait,reelScale:s,stem:(bait?.028:.05)*s,// リールの足（竿からリール本体の中心まで）
    handleSide:(bait?.045:.052)*s,handleArm:(bait?.04:.05)*s,// ハンドルの軸の横の距離・腕の長さ
    footDir:bait?1:-1};}// 本体が竿の上（ベイト）か下（スピニング）か
// ハンドルの左右と、竿を握る手（'R' 右手・'L' 左手）
function handSides(reel,pref){const bait=!!(reel&&(reel.reelType==='baitcast'||reel.reelType==='conventional'));const h=pref==='L'||pref==='R'?pref:bait?'R':'L';return{handle:h,rodHand:h==='L'?'R':'L',crankHand:h};}
// 竿に固定した座標：fwd（竿先の向き）、up（竿に直角で上向き）、right（竿先を向いて右）
function rodFrame(d,up){const f=norm(d);let u=sub(up||[0,1,0],mul(f,dot(up||[0,1,0],f)));if(len(u)<1e-4)u=sub([0,0,1],mul(f,f[2]));u=norm(u);return{fwd:f,up:u,right:norm(cross(f,u))};}
// リール本体の中心とハンドルの軸の中心・ノブの位置（ハンドルの角度 th）
function reelPoints(seat,fr,dim,side,th){const body=add(seat,mul(fr.up,dim.footDir*dim.stem));const sgn=side==='R'?1:-1;const hub=add(body,mul(fr.right,sgn*dim.handleSide));
  // ハンドルは竿を含む面の中で回る（軸は竿の横向き）
  const radial=add(mul(fr.up,Math.cos(th)*(dim.footDir>0?1:-1)),mul(fr.fwd,Math.sin(th)));const knob=add(hub,mul(radial,dim.handleArm));return{body,hub,knob};}
// 2本の骨の IK：ひじの位置。手が届かない時は伸ばしきった所、近すぎる時は最小の曲げで
function twoBone(S,T,L1,L2,pole){let v=sub(T,S),d=len(v);const dmax=(L1+L2)*.999,dmin=Math.abs(L1-L2)+1e-3;const reach=d<=dmax;d=clamp(d,dmin,dmax);const n=norm(v);const hand=add(S,mul(n,d));
  // ひじは肩と手を結ぶ線から pole の側に
  let p=sub(pole,S);p=sub(p,mul(n,dot(p,n)));if(len(p)<1e-5)p=Math.abs(n[1])<.9?[0,-1,0]:[1,0,0],p=sub(p,mul(n,dot(p,n)));p=norm(p);
  const a=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-a*a));const elbow=add(add(S,mul(n,a)),mul(p,h));return{elbow,hand,reach};}
const API={gearDims,handSides,rodFrame,reelPoints,twoBone,v:{add,sub,mul,dot,len,norm,cross}};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaRig=API;
})(typeof self!=='undefined'?self:this);
