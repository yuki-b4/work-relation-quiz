---
paths:
  - "app/src/views/**"
  - "app/tools/**"
---

# この環境で画面を撮るとき（Playwright）

2026-09-26 のセミナーLPで、撮り方の誤りから誤診したり、作業が止まったりした点をまとめたもの。

## 立ち上げと後片付け

- 開発サーバー：`cd app && npx wrangler dev --env="" --port 8787` をバックグラウンドで起動し、
  `curl` が 200 を返すまで待つ
- **止めるときは `for p in $(pgrep -f "node_modules/.bin/wrangle[r]"); do kill $p; done`。**
  `pkill -f wrangler` はそのコマンドを実行している自分のシェルにも当たって、シェルごと落ちる
- `npm run test:seo` は開発サーバーに問い合わせる。**サーバーを立ててから流す**（立てずに流すと `ECONNREFUSED`）

## スクリプト

- **撮影スクリプトは `app/` の中に置いて実行する**（一時ファイルなら `app/.shot.mjs` に置き、終わったら消す）。
  スクラッチパッドに置いたまま実行すると、ESM が `playwright-core` を見つけられず `ERR_MODULE_NOT_FOUND` になる
- Chromium は `/opt/pw-browsers` 配下にある。`playwright install` はしない
- フォント（Google Fonts）はプロキシ経由で取る：
  `chromium.launch({ executablePath, args: ['--no-sandbox'], proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } })`、
  `newContext({ ignoreHTTPSErrors: true, deviceScaleFactor: 2 })`

## フォントを読み込ませてから撮る

- **`document.fonts.load()` にはページの本文全体（`document.body.innerText`）を渡す。**
  Noto Sans JP は字の範囲ごとに分割されていて、渡した字の分しか読み込まれない
- 読み込みは失敗することがある。try/catch で包み、数回やり直す（途中で `reload` を挟む）
- **読み込まれる前に撮ると、代わりのフォント（WenQuanYi Zen Hei）で描かれる。** このフォントは縦書きの字幅を
  持たないので、縦書きの漢字が重なって見える。一度「Noto Sans JP が悪い」と誤診した。
  どのフォントで描いたかは CDP の `CSS.getPlatformFontsForNode` で確かめられる

## 撮るもの

- 幅：スマホ 320px・375px、PC 1280px（`deviceScaleFactor: 2`）
- 全体を1枚で撮ると長すぎて送れない。**直した要素だけを `locator.screenshot()` で切り出す**か、高さ1,600pxごとに分けて撮る
- 改行の確認は、要素の行の位置を数えると早い（`Range.getClientRects()` の top を重複なしで数える）
- 固定ヘッダーが要素の切り出しに重なって写ることがある。表示の不具合ではないので、気になるときは撮る前に隠す
