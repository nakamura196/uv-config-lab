# uv-config-lab

Universal Viewer の**ダウンロード設定だけを変えたビューアを並べて比べる**ための、静的な検証ページです。

> **公開ページ:** https://nakamura196.github.io/uv-config-lab/

「IIIF ポータルでフルサイズのダウンロードが 500 になる」「ときどき
`Your log-in attempt did not appear to be successful.` と出る」という問い合わせの
切り分けで作りました。設定を実際に差し替えて、画面で確かめられるようにしてあります。

## 何が分かるか

| 確かめたいこと | どこで |
|---|---|
| 現行設定ではダウンロードの選択肢が**フルサイズ 1 つ**しかない | `index.html` の左右比較 |
| 2 つの設定を戻すと**選択肢が 3 つ**になる | 同上（`fixed` を選ぶ） |
| `maxImageWidth` を既定の 5000 に戻しても**フルサイズは消えない** | 同上（`portal-maxwidth-5000` を選ぶ） |
| UV を 4.4.4 に上げても**何も変わらない** | 同上（バージョン切替） |
| 画像サーバに**変換結果のキャッシュが無い** | `probe.html`「同じ URL を 3 回」 |
| サーバが `maxWidth` を宣言していない（＝ UV の安全弁が効かない）| `probe.html` の info.json 欄 |

## 実測した結果

headless Chrome でダウンロードのダイアログを実際に開いて、選択肢を数えたものです
（2026-09-12、UV 4.0.25 / 4.4.4 の両方で同じ結果）。

| config | ダウンロードの選択肢 |
|---|---|
| `portal` | **1 つ** — 全体画像 7514 x 6132px (jpg) |
| `portal-maxwidth-5000` | **1 つ** — 全体画像 7514 x 6132px (jpg) ← 5000 に戻しても消えない |
| `fixed` | **3 つ** — 現在の表示 / 全体画像 7514 x 6132px / 全体画像 2000 x 1632px |
| `uv-default` | **3 つ** — 現在の表示 / 全体画像 7514 x 6132px / 全体画像 1000 x 816px |

UV を 4.4.4 に上げても結果は 1 文字も変わりません。**ビューアの古さはこの件の原因ではありません。**

## 設定の差分

`configs/*.json` の 4 つが、`modules.downloadDialogue.options` だけを変えています。
`configs/_base.json` は 4 つ共通の土台で、ダウンロード画面の日本語ラベルだけを入れてあります。

UV は渡された設定を**既定の設定に深くマージ**するので、差分だけ書けば足ります
（`BaseContentHandler.configure` → `merge(config, yourConfig)`）。

| キー | portal | portal-maxwidth-5000 | fixed | uv-default |
|---|---|---|---|---|
| `downloadCurrentViewEnabled` | false | false | **true** | true |
| `downloadWholeImageLowResEnabled` | false | false | **true** | true |
| `downloadWholeImageHighResEnabled` | true | true | true | true |
| `confinedImageSize` | 1000 | 1000 | **2000** | 1000 |
| `maxImageWidth` | 100000 | **5000** | 100000 | 5000 |

`portal` は本番ポータルの `uv-config.json` の該当箇所をそのまま写したものです。

## maxImageWidth は、このサーバでは参照されない

`DownloadDialogue.js` の判定はこうなっています。

```js
case DownloadOption.WHOLE_IMAGE_HIGH_RES:
  if (!downloadWholeImageHighResEnabled) { return false; }
  var maxDimensions = canvas.getMaxDimensions();
  if (maxDimensions) {
    if (maxDimensions.width <= maxImageWidth) { return true; }
    else { return false; }
  }
  return true;      // ← maxDimensions が null ならここに落ちる
```

`getMaxDimensions()` が返すのは画像の寸法ではなく、`info.json` の `profile` が
うたう `maxWidth` / `maxHeight`、つまり「サーバが出せると言っている上限」です
（manifesto.js `Canvas.getMaxDimensions`）。

IIIF Image API 2.1 は上限の宣言方法を `maxWidth` / `maxHeight` / `maxArea` の
3 つ認めていますが、**UV が読むのは `maxWidth` だけ**です。Cantaloupe は `maxArea`
でうたうため、`getMaxDimensions()` は `null` を返し、`maxImageWidth` との比較は
一度も行われません。`portal-maxwidth-5000` は、これを画面で確かめるための設定です。

## 使い方

```
git clone https://github.com/nakamura196/uv-config-lab.git
cd uv-config-lab
zsh serve-https.zsh          # https://localhost:8443/
```

ビルドはありません。HTML と JSON だけです。

### なぜ https で配信するのか

**既定のマニフェストを出しているポータルは、`Referer` が `http://` で始まる要求を
403 で返します**（2026-09-12 実測。`https://` なら通る）。

```
Referer: http://localhost:8731/    → 403
Referer: https://localhost:8731/   → 200
Referer: https://example.com/      → 200
Referer: http://example.com/       → 403
```

そのため `python3 -m http.server`（http）で開くと、ブラウザが送る `Referer` も
http になり、UV が「Unable to load manifest」で止まります。`serve-https.zsh` は
自己署名の証明書を作って https で配信するので、これを回避できます。
自己署名なのでブラウザが警告を出します。「詳細」→「アクセスする」で進んでください。

GitHub Pages は https なので、この問題は起きません。
画像サーバ（`iiif.dl...`）側にはこの制限はありません。

### 別のマニフェストで試す

画面上部の入力欄に IIIF マニフェストの URL を貼るか、クエリで渡します。

```
index.html?manifest=<マニフェストURL>&pos=3&uv=4.0.25
viewer.html?config=fixed&manifest=<マニフェストURL>&pos=3&uv=4.4.4
probe.html?manifest=<マニフェストURL>
```

Presentation API 2 / 3 のどちらでも読めます。
**マニフェストと画像サーバの両方に CORS 許可（`Access-Control-Allow-Origin`）が要ります。**
無いサーバは、このページからは測れません。

`config` と `uv` は許可リストで縛っていて、任意の URL は読み込めません。

## ファイル

```
index.html          左右に並べて比べるページ
viewer.html         UV のラッパー。?config= ?manifest= ?pos= ?uv= を取る
probe.html          画像サーバの所要時間とキャッシュの有無を測るページ
configs/_base.json  4種に共通の土台（日本語ラベルのみ）
configs/*.json      設定の差分 4 種
serve-https.zsh     ローカルを https で配信する（上記の Referer 対策）
.nojekyll           GitHub Pages の Jekyll 処理を止める（無いと _base.json が 404 になる）
```

`viewer.html` は本番ポータルのラッパー（`libraries/uv/uv.html`）をなぞっています。
`?pos=N` を `canvasIndex = N - 1` として渡し、コマが変わったら `postMessage` で
親に返すところまで同じです。

## 注意

- **`probe.html` は本番サーバに実際の負荷をかけます。** フルサイズの生成は 1 枚で数秒の
  CPU を使います。並列テストは 4 本までにしてあります
- UV は jsDelivr から**バージョンを固定して**読み込んでいます。`@latest` は使いません
  （ビューア側の更新で突然壊れるため）

## ライセンス

MIT
