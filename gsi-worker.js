/* 国土地理院タイルの取得・解凍・解読を別スレッドで（gsi.js の create({worker:'gsi-worker.js'}) から使う）。
   メイン側は結果を受け取るだけなので、歩いている間のカクつきが減る（受け渡しはブラウザの複製で、解読よりずっと軽い）。
   この中では gsi.js の同じ処理（同時数制限・Cache Storage・404 の記録）をそのまま使う。 */
importScripts('tiles.js?v=202610101400','gsi.js?v=202610111000');
const G=self.HamaGSI.create({concurrency:6,lru:16});// 結果はメイン側で覚えるので、ここは少しだけ
self.onmessage=async e=>{const{id,kind,z,x,y}=e.data;
  try{const t=await G.tile(kind,z,x,y);const key=kind+'/'+z+'/'+x+'/'+y;
    if(!t){self.postMessage({id,miss:G.missing.has(key),fail:!G.missing.has(key)});return;}
    self.postMessage({id,t});}
  catch(err){self.postMessage({id,fail:true,err:String(err)});}};
