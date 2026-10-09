/* 標高（国土地理院の標高タイル dem_png / dem5a_png）の読み込みと、緯度経度での高さの取り出し（window.HamaTerrain）。
   ・データは tools/terrain/fetch_dem.py で data/terrain/<名前>.json（manifest）と .bin（Int16、0.1m単位）に書き出す。
   ・データが無い場所は null を返す（高さを作らない）。横浜は手描きの地図（緯度経度と対応しない）なので使わない。
   ・標高タイル：RGB → x=R*65536+G*256+B。x<2^23 なら x*0.01m、x=2^23 は無効、それ以上は (x-2^24)*0.01m。 */
(function(root){
const NA=1<<23;
function decodePx(r,g,b){const x=r*65536+g*256+b;if(x===NA)return null;return(x<NA?x:x-(1<<24))*.01;}
// RGBA の配列（ImageData.data）→ Float32Array（無効は NaN）
function decodeTile(rgba,n){const out=new Float32Array(n);for(let i=0;i<n;i++){const h=decodePx(rgba[i*4],rgba[i*4+1],rgba[i*4+2]);out[i]=h==null?NaN:h;}return out;}
const lon2x=(lon,z)=>(lon+180)/360*Math.pow(2,z);
const lat2y=(lat,z)=>{const r=lat*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z);};
// 格子（manifest: {z, x0, y0, w, h, px:256, scale:.1, nodata:-32768}）。data は Int16Array（w*px × h*px）
function grid(manifest,data){
  const m=manifest,W=m.w*m.px,H=m.h*m.px,sc=m.scale||.1,nd=m.nodata==null?-32768:m.nodata;
  const at=(i,j)=>{if(i<0||j<0||i>=W||j>=H)return NaN;const v=data[j*W+i];return v===nd?NaN:v*sc;};
  return{manifest:m,
    heightAt(lat,lon){const fx=(lon2x(lon,m.z)-m.x0)*m.px-.5,fy=(lat2y(lat,m.z)-m.y0)*m.px-.5;
      const i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;
      const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
      if([a,b,c,d].some(Number.isNaN)){const n=at(Math.round(fx),Math.round(fy));return Number.isNaN(n)?null:n;}
      return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;},
    covers(lat,lon){const tx=lon2x(lon,m.z)-m.x0,ty=lat2y(lat,m.z)-m.y0;return tx>=0&&ty>=0&&tx<m.w&&ty<m.h;}};
}
// ゲーム座標の格子（tools/terrain/build_game_grid.mjs の出力。data は base64 の Int16）。
// offAt：地面からの高さ＝標高から base を引いた分（0 未満と無効は 0）。海沿いの平地は今の地面のまま、丘だけを立体にする。
function b64ToI16(b){if(typeof Buffer!=='undefined'){const u=Buffer.from(b,'base64');return new Int16Array(u.buffer.slice(u.byteOffset,u.byteOffset+u.length));}
  const s=atob(b),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new Int16Array(u.buffer);}
function gameGrid(D){if(!D)return null;const a=D.data instanceof Int16Array?D.data:b64ToI16(D.data),nx=D.nx,ny=D.ny,dx=D.dx,sc=D.scale||.1,nd=D.nodata,base=D.base||0;
  const off=new Float32Array(nx*ny);for(let k=0;k<off.length;k++){const v=a[k];off[k]=v===nd?0:Math.max(0,v*sc-base);}
  const elev=k=>a[k]===nd?null:a[k]*sc;
  function offAt(x,y){const fx=(x-D.x0)/dx,fy=(y-D.y0)/dx;if(fx<0||fy<0||fx>=nx-1||fy>=ny-1)return 0;
    const i=fx|0,j=fy|0,u=fx-i,v=fy-j,k=j*nx+i;return off[k]*(1-u)*(1-v)+off[k+1]*u*(1-v)+off[k+nx]*(1-u)*v+off[k+nx+1]*u*v;}
  function elevAt(x,y){const i=Math.round((x-D.x0)/dx),j=Math.round((y-D.y0)/dx);if(i<0||j<0||i>=nx||j>=ny)return null;return elev(j*nx+i);}
  return{meta:D,nx,ny,dx,x0:D.x0,y0:D.y0,off,offAt,elevAt};}
const grids=[];
function add(g){grids.push(g);return g;}
function heightAt(lat,lon){for(const g of grids)if(g.covers(lat,lon)){const h=g.heightAt(lat,lon);if(h!=null)return h;}return null;}
// ブラウザ：data/terrain/index.json に並んだエリアを読み込む（無ければ何もしない）
async function load(base){base=base||'data/terrain/';
  let idx;try{const r=await fetch(base+'index.json');if(!r.ok)return 0;idx=await r.json();}catch(e){return 0;}
  let n=0;for(const name of idx.areas||[]){try{const m=await(await fetch(base+name+'.json')).json();const buf=await(await fetch(base+name+'.bin')).arrayBuffer();add(grid(m,new Int16Array(buf)));n++;}catch(e){console.warn('[標高] 読み込み失敗',name,e);}}
  return n;}
const API={gameGrid,decodePx,decodeTile,lon2x,lat2y,grid,add,heightAt,load,get count(){return grids.length;},NA};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HamaTerrain=API;
})(typeof self!=='undefined'?self:this);
