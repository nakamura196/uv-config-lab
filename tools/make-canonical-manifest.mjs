// マニフェストの service @id を、画像サーバが info.json で名乗っている @id に揃えたコピーを作る。
//
// なぜ:
//   公開サイトのマニフェストは  /iiif/<a>/<b>/<c>.tif        （読みやすいスラッシュ形式）
//   info.json の @id は        /iiif/2/<a%2Fb%2Fc.tif>      （Cantaloupe の正規形）
//   と食い違っている。UV はダウンロード URL を作るとき、選択肢によって
//   「マニフェストの base」と「info.json の識別子」を混ぜるため、識別子が二重になり 404 になる。
//   両者を揃えると直るかどうかを、この写しで確かめる。
//
// 使い方: node tools/make-canonical-manifest.mjs <manifest-url> <出力パス>

const [, , SRC, OUT] = process.argv;
if (!SRC || !OUT) { console.error("usage: node make-canonical-manifest.mjs <manifest-url> <out.json>"); process.exit(1); }

const fs = await import("node:fs/promises");
const m = await (await fetch(SRC)).json();

const cache = new Map();
async function canonicalId(serviceId) {
  if (cache.has(serviceId)) return cache.get(serviceId);
  const info = await (await fetch(serviceId + "/info.json")).json();
  const id = info["@id"] || info.id;
  cache.set(serviceId, id);
  return id;
}

let changed = 0;
const canvases = m.sequences ? m.sequences[0].canvases : (m.items || []);
for (const c of canvases) {
  const images = c.images || (c.items ? c.items[0].items : []);
  for (const img of images) {
    const res = img.resource || img.body;
    if (!res) continue;
    const svc = Array.isArray(res.service) ? res.service[0] : res.service;
    if (!svc) continue;
    const old = svc["@id"] || svc.id;
    const now = await canonicalId(old);
    if (old === now) continue;
    if (svc["@id"]) svc["@id"] = now; else svc.id = now;
    // 画像そのものの @id も、同じ base に付け替える
    const resId = res["@id"] || res.id;
    if (resId && resId.startsWith(old)) {
      const tail = resId.slice(old.length);
      if (res["@id"]) res["@id"] = now + tail; else res.id = now + tail;
    }
    changed++;
  }
}

m.label = (m.label || "") + "（service @id を info.json に合わせた写し）";
await fs.writeFile(OUT, JSON.stringify(m, null, 1));
console.log(`書き出しました: ${OUT}  / 付け替えた canvas: ${changed}`);
