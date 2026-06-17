# CLAUDE.md

## プロジェクト概要

職場の人間関係タイプ診断アプリ。9問の質問から、職場での関わり方を8タイプで診断する。

- `prototype.html` — 検証用のプロトタイプ（スタンドアロンのHTML/CSS/JS）。`?ref=`/`?mode=lead` で紹介者向け（深掘り診断の申込）に切替
- `index.html` / `.nojekyll` — GitHub Pages 公開用。`index.html` はクエリ（`?ref=` 等）を引き継いで `prototype.html` へリダイレクト
- `apps-script/` — 診断結果・検証フィードバック・紹介者リード（メール/自由記述）をGoogleスプレッドシート（回答ログ）に記録する Google Apps Script Web App とセットアップ手順

## データソース

このプロジェクトは以下のGoogleスプレッドシートをソースとして作成されている。

- https://docs.google.com/spreadsheets/d/1ve8KILi6TJ1uc4w7L3wmLQyJXLZAWr4EyYRAcD9zlas/edit

### ルール：スプレッドシート参照時のシート指定

- ユーザーがこのスプレッドシートを参照する際は、**必ずシート指定（複数可）があるはず**である。
- もしユーザーの指示に**シート指定がない場合は、作業を進める前に必ず指摘し、どのシートを参照すべきか確認する**こと。
- シート指定がないまま推測でシートを選んで作業を進めてはいけない。
