# ナチュール診断 アプリ本体

`prototype.html`（GitHub Pages の静的ページ）を置き換えるアプリケーション。
要件の正は、リポジトリ直下の **`アプリ化要件定義.md`**。実装はそこに従う。

- 構成：Cloudflare Workers ＋ D1（アプリ化要件定義.md 8.2）
- フレームワーク：Hono
- 現状：**Phase 0（環境構築）まで。** ルートの受け口とDBスキーマだけがある

## 作業の分担

Cloudflare の認証が要る操作は**ブラウザが必要**なので、手元のPCで行う。コードを書くのはどこでもよい。

| やること | どこで |
|:--|:--|
| コードを書く、`npm run check` を通す | どこでも（クラウドのセッションを含む） |
| `wrangler login`、D1の作成、`wrangler deploy`、`wrangler secret put` | **手元のPC** |

**APIトークンや `.dev.vars` の中身を、チャットやIssueに貼らないこと。** `database_id` は識別子であって秘密ではないので、共有して構わない（このファイルにもコミットする）。

## セットアップ（手元のPCで1回だけ）

前提：Node.js 20 以上、Cloudflare アカウント。ドメインを Cloudflare Registrar で取得済みなら、そのアカウントをそのまま使う。

### 1. Cloudflare にログインして D1 を作る（リポジトリは不要）

`wrangler login` はアカウント単位の認証、`d1 create` はアカウントにDBを1つ作るだけなので、
**どちらもリポジトリの外で動く**。Node.js さえ入っていれば、どのディレクトリからでもよい。

```
npx wrangler login
npx wrangler d1 create nature-shindan
```

`npx` が wrangler をその場で取ってくるので、インストールも不要。
`d1 create` の出力に `database_id` が出るので控える（次の手順で使う）。

### 2. リポジトリを取ってきて、依存を入れる

ローカルでアプリを動かす場合に必要。**`app/` はまだ `main` に入っていない**（PR #33 で入る）ので、
作業ブランチを指定してクローンする。

```
git clone -b claude/diagnostic-app-requirements-2v7aq7 https://github.com/yuki-b4/work-relation-quiz.git
cd work-relation-quiz/app
npm install
```

すでにクローン済みなら、ブランチを切り替える。

```
git fetch origin
git checkout claude/diagnostic-app-requirements-2v7aq7
```

PR #33 がマージされたあとは、`main` に `app/` が入るのでブランチの指定は不要になる。

### 3. ログインの確認と、ブラウザが使えない場合

`npx wrangler login` を実行するとブラウザが開き、Cloudflare のログインと権限の確認画面が出る。
**「Allow」を押す**と、認証情報が手元に保存される（`~/.wrangler/` 配下。以後このコマンドは不要）。
ブラウザが自動で開かない場合は、ターミナルに表示されるURLを手で開く。

確認：

```
npx wrangler whoami
```

メールアドレスとアカウントIDが表示されれば成功。

> **ブラウザが使えない環境（サーバー、CI）の場合**は、`wrangler login` の代わりに Cloudflare ダッシュボードの
> 「マイプロフィール → APIトークン」で **Workers Scripts:Edit / D1:Edit / Workers Routes:Edit** の権限を持つトークンを作り、
> `CLOUDFLARE_API_TOKEN` 環境変数に入れる。トークンはリポジトリにコミットしない。

### 4. `database_id` を wrangler.toml に貼る

手順1の `d1 create` の出力に、次のような行が出ている。

```
[[d1_databases]]
binding = "DB"
database_name = "nature-shindan"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

この **`database_id` を `wrangler.toml` の `[[d1_databases]]` に貼る**（`database_id = ""` になっている箇所）。
プレビュー用も作る場合は `npx wrangler d1 create nature-shindan-preview` を実行し、`[env.preview]` 側に貼る。

### 3. スキーマを流す

```
npm run db:migrate:local    # ローカル（.wrangler 配下のSQLite）
npm run db:migrate:remote   # 本番のD1
```

### 5. ローカル開発用の秘密値

```
cp .dev.vars.example .dev.vars
```

`IP_HASH_SALT` を長いランダム文字列に変える（生IPは保存せず、このソルト付きハッシュだけを持つ）。
本番へは `npx wrangler secret put IP_HASH_SALT` で入れる。`.dev.vars` はコミットしない。

### 6. 起動して確認

```
npm run dev
```

`http://localhost:8787/api/health` が `{"ok":true,"tables":12,...}` を返せばセットアップ完了。

## 診断の文面と採点ロジック

文面の正は **`prototype.html`**（と `ガイド文面24本.md`）のままで、アプリはそこから機械的に写している。

```
npm run content       # prototype.html → src/content/*.ts を再生成
npm run parity        # 採点ロジックが prototype.html と一致するか検証
npm run test:session  # 結果セッションの判定（F4）
npm run test:markup   # 結果カードのクラス名・id が prototype.html と一致するか
npm run check         # 上の4つ ＋ 型チェック

npm run dev           # 別ターミナルで起動してから
npm run test:e2e      # 回答送信とワンタイム結果表示の疎通試験
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
