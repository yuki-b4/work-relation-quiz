# ナチュール診断 アプリ本体

`prototype.html`（GitHub Pages の静的ページ）を置き換えるアプリケーション。
要件の正は、リポジトリ直下の **`アプリ化要件定義.md`**。実装はそこに従う。

- 構成：Cloudflare Workers ＋ D1（アプリ化要件定義.md 8.2）
- フレームワーク：Hono
- 現状：**Phase 2（Admin とデータ移行）まで。** 診断から申込まで通しで動き、Admin から運用できる

## 作業の分担

Cloudflare の認証が要る操作は**ブラウザが必要**なので、手元のPCで行う。コードを書くのはどこでもよい。

| やること | どこで |
|:--|:--|
| コードを書く、`npm run check` を通す | どこでも（クラウドのセッションを含む） |
| `wrangler login`、D1の作成、`wrangler deploy`、`wrangler secret put` | **手元のPC** |

**APIトークンや `.dev.vars` の中身を、チャットやIssueに貼らないこと。** `database_id` は識別子であって秘密ではないので、共有して構わない（このファイルにもコミットする）。

## セットアップ（手元のPCで1回だけ）

前提：**Node.js 22 以上**、Cloudflare アカウント。ドメインを Cloudflare Registrar で取得済みなら、そのアカウントをそのまま使う。

> **Node は 22 以上でないと wrangler が動かない。** wrangler 4 系が `node >=22.0.0` を要求していて、
> 20 系だと `Wrangler requires at least Node.js v22.0.0` で止まる。まず確認する。
>
> ```
> node -v
> ```
>
> `v22`（または `v24`）で始まっていなければ、先に Node を入れ替える。手順は下の「Node を入れ替える」。

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

ローカルでアプリを動かす場合に必要。

```
git clone https://github.com/yuki-b4/work-relation-quiz.git
cd work-relation-quiz/app
npm install
```

### 2-1. ログインの確認と、ブラウザが使えない場合

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

### 3. `database_id` を wrangler.toml に貼る

手順1の `d1 create` の出力に、次のような行が出ている。

```
[[d1_databases]]
binding = "DB"
database_name = "nature-shindan"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

この **`database_id` を `wrangler.toml` の `[[d1_databases]]` に貼る**（`database_id = ""` になっている箇所）。
プレビュー用も作る場合は `npx wrangler d1 create nature-shindan-preview` を実行し、`[env.preview]` 側に貼る。

### 4. スキーマを流す

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

`ADMIN_BOOTSTRAP_EMAIL` と `ADMIN_BOOTSTRAP_PASSWORD` は Admin の初期アカウントを作るためのもの
（次の「Admin」を参照）。パスワードは12文字以上にする。

### 6. 起動して確認

```
npm run dev
```

`http://localhost:8787/api/health` が `{"ok":true,"tables":15,...}` を返せばセットアップ完了。

## Node を入れ替える

`Wrangler requires at least Node.js v22.0.0` が出たときの手当て。
**Node 20 のサポートは2026年4月で終わっている**ので、下げるのではなく上げる。

### macOS / Linux（nvm を使う。おすすめ）

複数のバージョンを行き来できるので、ほかの作業への影響が出ない。

```
# nvm が未導入なら1回だけ
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# ターミナルを開き直してから
nvm install 22
nvm use 22
nvm alias default 22      # 次から開くターミナルでも 22 になる
```

### Windows

```
winget install OpenJS.NodeJS.LTS
```

または https://nodejs.org/ から LTS 版のインストーラーを落として実行する。
バージョンを行き来したい場合は [nvm-windows](https://github.com/coreybutler/nvm-windows) を使う。

### 入れ替えたあと

```
node -v            # v22 以上になっていること
cd app
npm install        # 入れ直す。バージョンが変わったら一度やっておくと確実
npm run check
```

`npm install` でおかしくなったら、`node_modules` を消してから入れ直す。

```
rm -rf node_modules && npm install
```

## 診断の文面と採点ロジック

文面の正は **`prototype.html`**（と `ガイド文面24本.md`）のままで、アプリはそこから機械的に写している。

```
npm run content       # prototype.html → src/content/*.ts を再生成
npm run parity        # 採点ロジックが prototype.html と一致するか検証
npm run test:session  # 結果セッションの判定（F4）
npm run test:markup   # 結果カードのクラス名・id が prototype.html と一致するか
npm run test:auth     # Admin の認証・マスク・CSV・設問文の引き当て（F2）
npm run test:migrate  # 移行スクリプトの変換（第7章）
npm run check         # 上の6つ ＋ 型チェック。サーバは要らない

npm run dev           # 別ターミナルで起動してから
npm run test:e2e      # 回答送信とワンタイム結果表示の疎通試験（HTTP）
npm run test:flow     # 診断を最初から最後まで実ブラウザで通す試験
npm run test:guide    # 読み解きガイド全4章を実ブラウザで通す試験
npm run test:apply    # 申込フォームとX共有を実ブラウザで通す試験
npm run test:admin    # Admin をログインからCSV出力まで実ブラウザで通す試験
npm run test:seo      # 公開ページのindex/noindex・canonical・sitemap・robots
npm run test:browser  # 上のブラウザ試験5つをまとめて
```

ブラウザ試験は初回だけブラウザ本体が要る。

```
npx playwright install chromium
```

**別タブでは結果が開けないこと（F4-2）は、この試験でしか確かめられない。**
sessionStorage はタブごとなので、curl では再現できない。

- `src/content/*.ts` は**自動生成なので直接編集しない**。文面を変えるときは `prototype.html` を直してから `npm run content`
- `src/lib/scoring.ts` は `prototype.html` の `tally()` / `radarScores()` / `finish()` の移植。
  `npm run parity` が、元の関数のソースを `prototype.html` から抜き出してそのまま実行し、結果を突き合わせる。
  9問の二択は **512通りを総当たり**、5軸は端の値とランダム5000通りで照合する
- 採点を触ったら必ず `npm run parity` を通す。ここが崩れると F3-1（現行踏襲）が静かに壊れる

## Admin（F2）

`/admin` 以下。**1アカウント運用**（確認事項8）。検索には出さない（`X-Robots-Tag: noindex` と
`Cache-Control: no-store` を全ページに付けている。`robots.txt` には Admin のパスを書かない）。

| URL | 内容 |
|:--|:--|
| `/admin/responses` | 回答一覧。絞り込み・並べ替え・50件ページング・CSV |
| `/admin/responses/:id` | 回答詳細。基本情報／診断結果／設問別24問／検証アンケート／ヒアリング／ガイド到達／申込／運用欄 |
| `/admin/sessions` | 体験セッション申込。未紐づけの手動紐づけ、同じ到達IDに2件以上の警告 |
| `/admin/corp-leads` | 法人リード |
| `/admin/referrers` | 紹介者マスタ。コード発行と紹介リンク、紹介者ごとの実績 |
| `/admin/export` | CSV出力4種（UTF-8 BOM付き） |

### 初期アカウントを作る（1回だけ）

`.dev.vars`（本番は `wrangler secret put`）に入れてから `/admin/bootstrap` を開き、ボタンを押す。

```
ADMIN_BOOTSTRAP_EMAIL=you@example.com
ADMIN_BOOTSTRAP_PASSWORD=（パスワードマネージャで作った12文字以上）
```

**アカウントが1つでもあると、この画面は 404 になる。** 作れたら
`ADMIN_BOOTSTRAP_PASSWORD` は消してよい。

### ログイン通知を設定する（省略しない）

1アカウントなので、**身に覚えのないログインに気づける手段が要る**（F2-1）。次のどちらかを入れる。
どちらも未設定だと、Admin の全ページに警告が出続ける。

```
# どこか自分に届くURLへ JSON を POST する（Slack の Incoming Webhook でもよい）
npx wrangler secret put LOGIN_NOTIFY_WEBHOOK

# または Resend でメールを送る
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put LOGIN_NOTIFY_TO
npx wrangler secret put LOGIN_NOTIFY_FROM
```

### パスワードを忘れた・変えたいとき

**これが唯一の復旧手段**（F2-1 の3）。DBを直接書き換える。

```
npm run admin:password -- --email you@example.com
npm run admin:password -- --email you@example.com --password '自分で決めた長いパスワード'
```

新しいパスワードと、`admin-password.sql` が書き出される。
**パスワードを先にパスワードマネージャへ保存してから**、ファイルを流す。

```
npx wrangler d1 execute nature-shindan --remote --file=admin-password.sql
```

> **`--command` に貼ってはいけない。** ハッシュは `$` を3つ含む形
> （`pbkdf2-sha256$100000$ソルト$ハッシュ`）で、`--command "…"` のダブルクォートに入れると
> **シェルが `$` を変数として展開して値が壊れる**（`$100000` が `00000` になる、など）。
> 壊れたまま保存されてもエラーは出ず、ログイン画面には「パスワードが違います」としか出ない。
> ファイル経由か、クォート付きのヒアドキュメント（`<<'SQL'`）なら展開されない。

入ったかどうかを確かめる。この文には `$` が無いので `--command` でよい。

```
npx wrangler d1 execute nature-shindan --remote \
  --command "select substr(password_hash,1,21) as head from admin_users"
```

`pbkdf2-sha256$100000$` と出れば正しく入っている。確認できたら `rm admin-password.sql`。

5回続けて失敗するとロックがかかる（15分）。書き出されるSQLはロックも同時に解除する。

**ログインできないときは監査ログを見る。** 保存値そのものが壊れている場合、その理由が残る。

```
npx wrangler d1 execute nature-shindan --remote \
  --command "select at, action, detail from admin_audit_logs order by at desc limit 5"
```

`detail` に `"storedHash":"format"` などが入っていたら、パスワードではなく**DBの値が壊れている**。
`"storedHash":"ok"` なら、単にパスワードが違う。

## データ移行（第7章）

旧スプレッドシートと Googleフォームの中身をDBへ移す。**Phase 2 の締めくくり。**

```
# 1. スプレッドシートの各タブを CSV でダウンロードして1つのフォルダに置く
#    指標v2.csv / 法人リード.csv / 紹介者マスタ.csv / 申込フォーム.csv（名前は部分一致で拾う）

# 2. 投入せずに、件数・タイプ別分布・日付範囲だけを見る（7.2 の手順2）
npm run migrate -- --dir ./export --check

# 3. SQL を書き出して中身を見る
npm run migrate -- --dir ./export --out migrate.sql

# 4. ローカルで流して Admin で照合し、問題なければ本番へ
npx wrangler d1 execute nature-shindan --local  --file=migrate.sql
npx wrangler d1 execute nature-shindan --remote --file=migrate.sql
```

- タイムスタンプは **JST として読み**、UTCで入れる。読めない値の行は取り込まず、理由を並べる
- 移行データの `question_set_version` は `legacy`。**9問の二択だけ**が `response_answers` に入る
  （リッカート15問は移行元に無い）。Admin の詳細では「設問文は保存されていません」と出る
- すべて `INSERT OR IGNORE`。途中で失敗しても、直してそのまま流し直せる
- 移行が済んだら **Googleフォームの受付を締め切り**（確認事項3＝a）、スプレッドシートは
  読み取り専用で残す（7.2）

## 設問を変えるとき

過去の回答に**いまの設問文**が付くと、記録の意味が変わる（F2-3）。手順を守る。

1. いまの `src/content/quiz.ts` を `src/content/quiz-<いまの版>.ts` としてコピーし、
   `src/lib/question-archive.ts` の `ARCHIVE` に版名で登録する（**文面は書き写さない**）
2. `prototype.html` の設問を直して `npm run content`
3. `wrangler.toml` の `QUESTION_SET_VERSION` を上げる
4. `npm run check`（採点の照合が通ることを確かめる）

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
  src/index.ts         ルーティングと公開ページ・API
  src/routes/admin.ts  Admin の経路（F2）
  src/lib/             採点・結果セッション・Admin の認証と問い合わせ・CSV
  src/views/           サーバ側の描画。views/admin/ が管理画面
  src/content/         prototype.html からの生成物。**直接編集しない**
  tools/               再生成・試験・移行・パスワード再設定
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
| Admin の認証 | パスワードは PBKDF2-HMAC-SHA256・**100,000回**（Workers の WebCrypto の上限。超えると本番でだけ落ちる）。Cookie は SameSite=Strict。状態を変えるPOSTは Originチェック＋CSRFトークン | F2-1・6.1 |
| Admin の個人情報 | 氏名・メールは**一覧では伏せる**。全表示は詳細か明示的な操作だけ。閲覧・出力・削除は監査ログに残す | 6.2 |
| リクエスト本文 | **一度しか読めない。** 認可で読んだ本文を各処理へ渡す（読み直すと必ず失敗する） | 実装メモ |
| フォームの見た目 | `.vq-opt` を `.field` の中に置かない。`.field label{display:block}` に負けて縦積みになる | 実装メモ |
