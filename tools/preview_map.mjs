// 確認用の地図プレビュー（SVG）：手描きのゲーム地形・GSHHS（実在・粗い）・釣り場・おおよその国道を重ねる。
//   node tools/preview_map.mjs → docs/map-preview-shonan.svg, docs/map-preview-hiratsuka.svg
import fs from 'fs';import path from 'path';import {createRequire} from 'module';
const require=createRequire(import.meta.url);const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const G=require(path.join(root,'geo.js')),MD=require(path.join(root,'mapdata.js')),SH=require(path.join(root,'shonan.js')),D=require(path.join(root,'data/geo/geo-data.js'));
const M=MD.create();for(const[f,o]of Object.entries(D.files))MD.addGeoJSON(M,{features:o.features},{name:f});
function svg(name,b,W,title){const v=G.fit(b,W,Math.round(W*(b.y1-b.y0)/(b.x1-b.x0)),0),H=v.h;const P=pts=>pts.map(p=>G.worldToScreen(v,p[0],p[1]).map(n=>n.toFixed(1)).join(',')).join(' ');
  const o=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H+60}" font-family="sans-serif">`,`<rect width="${W}" height="${H}" fill="#9cc7da"/>`];
  for(const f of M.real('land'))o.push(`<polygon points="${P(f.pts)}" fill="#cfd8c4" stroke="none"/>`);
  o.push(`<polygon points="${P(SH.LAND)}" fill="#e8e1c8" fill-opacity=".9"/>`,`<polygon points="${P(SH.ENOSHIMA)}" fill="#e8e1c8"/>`);
  for(const r of SH.RIVERS)o.push(`<polyline points="${P(r.pts)}" fill="none" stroke="#5aa3c4" stroke-width="${Math.max(2,r.half*2*v.z)}"/>`);
  o.push(`<polyline points="${P(SH.R134)}" fill="none" stroke="#fff" stroke-width="2.5"/>`,`<polyline points="${P(SH.COAST)}" fill="none" stroke="#8a6d2b" stroke-width="2"/>`);
  for(const r of SH.STRUCTS)o.push(`<rect x="${G.worldToScreen(v,r.x,r.y)[0]}" y="${G.worldToScreen(v,r.x,r.y)[1]}" width="${Math.max(1.5,r.w*v.z)}" height="${Math.max(1.5,r.h*v.z)}" fill="#666"/>`);
  for(const f of M.real('coastline'))o.push(`<polyline points="${P(f.pts)}" fill="none" stroke="#7a3fb0" stroke-width="2.5" stroke-dasharray="7 4"/>`);
  for(const g of SH.GSPOTS){const[x,y]=G.worldToScreen(v,g.x,g.y);if(x<0||y<0||x>W||y>H)continue;o.push(`<circle cx="${x}" cy="${y}" r="4" fill="#1b7d82" stroke="#fff"/>`);if(name==='hiratsuka')o.push(`<text x="${x+6}" y="${y+4}" font-size="11" fill="#13263b">${g.name}</text>`);}
  // 経緯度の目盛り
  for(let lo=Math.ceil(G.toLatLon(b.x0,0)[1]*100)/100;lo<G.toLatLon(b.x1,0)[1];lo+=name==='hiratsuka'?.01:.05){const[x]=G.worldToScreen(v,...G.toGame(35.3,lo));o.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#000" stroke-opacity=".12"/><text x="${x+2}" y="${H-4}" font-size="10" fill="#333">${lo.toFixed(2)}°E</text>`);}
  const sb=G.scaleBar(v,120);o.push(`<rect x="10" y="10" width="${sb.px}" height="4" fill="#13263b"/><text x="10" y="28" font-size="11">${sb.label}（実際の距離）</text>`);
  o.push(`<text x="10" y="${H+18}" font-size="12" font-weight="bold">${title}</text>`,`<text x="10" y="${H+36}" font-size="11"><tspan fill="#8a6d2b">━ ゲームの海岸線（手描き・おおよそ）</tspan>　<tspan fill="#7a3fb0">┅ GSHHS/GSHHG の海岸線（実在・中解像度の概形）</tspan>　<tspan fill="#555">白線：国道134号（おおよそ）</tspan></text>`,
    `<text x="10" y="${H+52}" font-size="10" fill="#555">濃い緑灰：GSHHS の陸地（ゲーム範囲外は遠景に使用）。道路・建物・駐車場の実データは未取得。GSHHS/GSHHG: Wessel &amp; Smith (LGPL)</text></svg>`);
  fs.writeFileSync(path.join(root,`docs/map-preview-${name}.svg`),o.join('\n'));}
const B=G.SHONAN.bounds;svg('shonan',{x0:B.x0-900,x1:B.x1+700,y0:B.y0-100,y1:B.y0+2400},1400,'湘南（大磯〜鎌倉）：ゲーム地形と GSHHS の比較');
const[a,b]=[G.toGame(35.325,139.335),G.toGame(35.305,139.385)];svg('hiratsuka',{x0:a[0],x1:b[0],y0:a[1],y1:b[1]},1000,'平塚周辺（花水川〜相模川）');
console.log('docs/map-preview-shonan.svg, docs/map-preview-hiratsuka.svg');
