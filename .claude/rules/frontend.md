---
paths:
  - "app/src/views/**"
  - "app/tools/**"
  - "prototype.html"
  - "docs/**/*.html"
---

# 画面（HTML・CSS）を作る・直すとき

2026-09-26 のセミナーLP（`app/src/views/seminar-page.ts`）で本番で崩れた点・検査が素通りした点をまとめたもの。
症状と原因の詳しい記録は `アプリ化実装状況.md` §6「ハマった箇所」が正。

## 日本語の改行

- **iPhone のブラウザは Chrome も含めて WebKit。** Chrome だけで効く指定に頼らない
  - `word-break: auto-phrase` は使わない（iPhone では効かず、語の途中で折れる）
  - `text-wrap: pretty` は使わない（WebKit では段落全体の折り方が変わり、崩れが広がる）
  - **検査環境の Chromium では再現しない。** Chromium で撮るときに `*{word-break:normal}` を足すと、iPhone に近い崩れ方を見られる
- 語の途中で折らせたくないところは、**切れ目を文字として持たせる**：抽出ツールが BudouX で `<wbr>` を入れ、
  CSS は `word-break: keep-all; overflow-wrap: anywhere` でその位置でだけ折る（`app/tools/extract-seminars.mjs` の `phraseHtml`）
  - 段落や項目の**頭には `<wbr>` を入れない**（`<p>※` のような目印の検出が崩れる）
- 折り方はどこも同じにしない：
  - 見出し・短い行（キャッチ・h1・節の見出し）は文節の切れ目で折る。改行位置の指定があれば md の `|` で持たせる
  - 表や Q&A のように幅が狭く行が短く続く節は、スマホでは**幅いっぱいまで詰める**（ブラウザの既定）。
    文節で折ると右に空きが目立つ。セミナーLPでは見出しの末尾の `{fill}` で切り替える
- 見出しの1行は **iPhone SE（320px）で1行に収まる長さ**にする（セミナーLPの h1 で10字まで）

## 画像

- **ページ内の `<img>` はサイト内の相対パス**（`/seminar/{slug}/hero.jpg?v=…`）。
  本番の絶対URLにすると、手元とステージングで新しい画像が表示されない
- **絶対URLにするのは og:image と構造化データだけ**（SNS と検索エンジンは絶対URLでないと拾わない）
- og:image の寸法と説明は実物に合わせて渡す（`layout.ts` の `ogImageMeta`）。ずれると SNS で切り抜きがずれる

## 検査（`app/tools/*-check.mjs`）

- **生成物の HTML には `<wbr>` が混ざる前提で**正規表現を書く。文字列の有無を見るときは `<wbr>` を外してから比べる
- **検査が「対象0件のまま黙って通る」形にしない。** 期待する件数を文面の正（md）から数えて、生成物の件数と突き合わせる
  （`<wbr>` のせいで `<p>※` が0件になり、注意書きの検査が何も見ずに通っていた）
- 出力する CSS からはコメントを除く（コメント中の語が、禁止語の検査に引っかかった）
- 生成物の画像を import するコードを node で直接読む検査には `--import ./tools/asset-loader.mjs` を付ける
- 抽出ツールが書き出す**テンプレート文字列の中にバッククォートを書かない**（注釈でも。そこで文字列が閉じる）
- 生成物（`app/src/content/*.ts`）は直接編集しない。正を直して `npm run content`

## 画面を変えたら

- スマホ（**320px と 375px**）と PC（1280px）で撮って見る。**横にはみ出していないか**
  （`document.documentElement.scrollWidth > innerWidth`）も確かめる。撮り方は `.claude/rules/screenshots.md`
- 撮った画像は、見出し・直した節など要点を切り出してユーザーに送る
