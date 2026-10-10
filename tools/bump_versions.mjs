// index.html が読み込む同じフォルダの .js の ?v= を、ファイルの中身のハッシュ（8桁）にそろえる。
// 中身を変えたら必ず変わるので、スマホのブラウザが古いファイルを使い続けない（node tools/bump_versions.mjs）。--check は直さずに確かめるだけ
import fs from 'fs';import path from 'path';import crypto from 'crypto';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const P=path.join(ROOT,'index.html');
export function expected(html){const out=[];html.replace(/src="([\w./-]+\.js)\?v=([\w]+)"/g,(m,f,v)=>{const fp=path.join(ROOT,f);if(fs.existsSync(fp))out.push({f,v,want:crypto.createHash('sha1').update(fs.readFileSync(fp)).digest('hex').slice(0,8)});return m;});return out;}
if(process.argv[1]&&process.argv[1].endsWith('bump_versions.mjs')){let html=fs.readFileSync(P,'utf8');const L=expected(html),bad=L.filter(x=>x.v!==x.want);
  if(process.argv.includes('--check')){for(const b of bad)console.log('古い版:',b.f,b.v,'→',b.want);process.exit(bad.length?1:0);}
  for(const b of bad)html=html.replace(`src="${b.f}?v=${b.v}"`,`src="${b.f}?v=${b.want}"`);fs.writeFileSync(P,html);console.log(`更新 ${bad.length} 件 / ${L.length} 件`);}
