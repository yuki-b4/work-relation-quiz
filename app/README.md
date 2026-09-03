# ナチュール診断 アプリ本体

`prototype.html`（GitHub Pages の静的ページ）を置き換えるアプリケーション。
要件の正は、リポジトリ直下の **`アプリ化要件定義.md`**。実装はそこに従う。

- 構成：Cloudflare Workers ＋ D1（アプリ化要件定義.md 8.2）
- フレームワーク：Hono
- 現状：**Phase 0（環境構築）まで。** ルートの受け口とDBスキーマだけがある

## セットアップ

前提：Node.js 20 以上、Cloudflare アカウント。

### 1. 依存を入れる

```
cd app
npm install
```

### 2. D1 データベースを作る

```
npx wrangler login
npm run db:create
```

出力される `database_id` を **`wrangler.toml` の `[[d1_databases]]` の `database_id`** に貼る。
プレビュー用も作る場合は同じ手順で `nature-shindan-preview` を作り、`[env.preview]` 側に貼る。

### 3. スキーマを流す

```
npm run db:migrate:local    # ローカル（.wrangler 配下のSQLite）
npm run db:migrate:remote   # 本番のD1
```

### 4. ローカル開発用の秘密値

```
cp .dev.vars.example .dev.vars
```

`IP_HASH_SALT` を長いランダム文字列に変える（生IPは保存せず、このソルト付きハッシュだけを持つ）。
本番へは `npx wrangler secret put IP_HASH_SALT` で入れる。`.dev.vars` はコミットしない。

### 5. 起動して確認

```
npm run dev
```

`http://localhost:8787/api/health` が `{"ok":true,"tables":12,...}` を返せばセットアップ完了。

## 診断の文面と採点ロジック

文面の正は **`prototype.html`**（と `ガイド文面24本.md`）のままで、アプリはそこから機械的に写している。

```
npm run content   # prototype.html → src/content/*.ts を再生成
npm run parity    # 採点ロジックが prototype.html と一致するか検証
npm run check     # 上の2つ ＋ 型チェック
```

- `src/content/*.ts` は**自動生成なので直接編集しない**。文面を変えるときは `prototype.html` を直してから `npm run content`
- `src/lib/scoring.ts` は `prototype.html` の `tally()` / `radarScores()` / `finish()` の移植。
  `npm run parity` が、元の関数のソースを `prototype.html` から抜き出してそのまま実行し、結果を突き合わせる。
  9問の二択は **512通りを総当たり**、5軸は端の値とランダム5000通りで照合する
- 採点を触ったら必ず `npm run parity` を通す。ここが崩れると F3-1（現行踏襲）が静かに壊れる

## デプロイ

```
npm run deploy
```

独自ドメインを取得したら、`wrangler.toml` の `routes` のコメントを外してドメインを書く。

## ディレクトリ

```
app/
  wrangler.toml        Workers と D1 の設定
  migrations/          D1 のスキーマ。既存ファイルは編集せず、変更は新しい番号のファイルで足す
  src/index.ts         ルーティング
```

## 実装するときの注意（要件からの抜粋）

| 箇所 | 守ること | 出典 |
|:--|:--|:--|
| 回答の受け口 | 回答IDはサーバ採番。タイプ判定と5軸スコアはサーバ側で再計算し、クライアントの申告値を信用しない | F3-2 |
| 結果の認可 | サーバの `result_sessions` ＋ HttpOnly セッションCookie ＋ sessionStorage の**3点一致**。`/result` のURLにIDを含めない | F4-2・F4-3 |
| Cookie | 結果セッションのCookieに `Max-Age` と `Expires` を**付けない**（ブラウザを閉じると消える） | F4-2 |
| 閉じた検知 | `pagehide` / `visibilitychange` で通知する方式は**採らない**（モバイルで誤爆する）。sessionStorage が消えていることを正とする | F4-2 |
| 申込フォーム | タイプ別の共通ページ。**診断結果の本文を表示しない**（タイプ名だけは可）。honeypot ＋ レート制限は必須 | F4-5 |
| 到達ID | `apply_visits.id` は推測不能なランダム値。`response_id` はクライアントから受け取らず、到達IDからサーバ側で解決する | F4-5 |
| noindex | `/result` `/guide` `/apply` `/admin` `/api` に `X-Robots-Tag` と `no-store`。Admin は robots.txt に頼らない | F6-3 |
| ボット | 弾くのは学習クローラだけ。検索エンジンとSNSのOGP取得（Twitterbot 等）は必ず通す | F8 |
| 設問の改訂 | 変えたら `QUESTION_SET_VERSION` を上げる。過去データの解釈を壊さない | 6.5 |
