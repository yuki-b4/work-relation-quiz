-- ナチュール診断 初期スキーマ
-- 正：アプリ化要件定義.md F1-2（エンティティ）
--
-- SQLite（D1）の都合で PostgreSQL 版から変えた点：
--   ・timestamptz  → TEXT（ISO8601・UTC。'2026-09-03T05:12:34.000Z' の形で入れる）
--   ・uuid         → TEXT
--   ・text[]       → TEXT（JSON配列の文字列）
--   ・boolean      → INTEGER（0/1）
-- 列を足す・消す・並べ替えたときは、必ず新しい migration ファイルを足す（このファイルは編集しない）。

PRAGMA foreign_keys = ON;

-- ───────────────────────────────────────────
-- 紹介者マスタ（F2-6）
-- 現行スプレッドシートの「紹介者マスタ」タブの移行先。
-- ───────────────────────────────────────────
CREATE TABLE referrers (
  code        TEXT PRIMARY KEY,              -- 例 'TKtp46k'（イニシャル＋ランダム英数字5文字）
  name        TEXT NOT NULL,
  note        TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

-- ───────────────────────────────────────────
-- 回答（1診断＝1行）
-- ───────────────────────────────────────────
CREATE TABLE responses (
  id                   TEXT PRIMARY KEY,     -- uuid v4。サーバ採番（F3-2）
  created_at           TEXT NOT NULL,
  completed_at         TEXT,

  -- 設問セットのバージョン。設問を改訂したら上げる。移行データは 'legacy'（7.3）
  question_set_version TEXT NOT NULL,

  -- mode / segment は移行データの互換用。新規は 'general' 固定（確認事項9＝b・F3-3）
  mode                 TEXT NOT NULL DEFAULT 'general',
  segment              TEXT NOT NULL DEFAULT 'general',

  -- ?ref= は画面の分岐には使わず、記録のためだけに残す（F3-3）
  ref_code             TEXT,                 -- 生の ?ref= 値。未登録コードもそのまま残す
  referrer_code        TEXT REFERENCES referrers(code) ON DELETE SET NULL,

  frame                TEXT,                 -- 回答アンカー。現行は '自然体' 固定（F3-2）

  -- 判定結果
  type_code            TEXT NOT NULL,        -- OBL / OBS / OKL / OKS / GBL / GBS / GKL / GKS
  type_name            TEXT NOT NULL,
  axis_h               TEXT NOT NULL,        -- 'O' | 'G'
  axis_c               TEXT NOT NULL,        -- 'B' | 'K'
  axis_w               TEXT NOT NULL,        -- 'L' | 'S'
  axis_counts          TEXT,                 -- JSON。各軸の左右カウント。境界事例の分析用

  -- 5軸スコア（0〜1）
  radar_safety         REAL,
  radar_trust          REAL,
  radar_bound          REAL,
  radar_conflict       REAL,
  radar_connect        REAL,

  -- 流入
  entry_url            TEXT,
  referrer_url         TEXT,
  src                  TEXT,                 -- ?src= （X共有は 'x'。F5-3）
  utm_source           TEXT,
  utm_medium           TEXT,
  utm_campaign         TEXT,

  -- 端末（生IPは保存しない。ソルト付きハッシュのみ。6.2）
  device_type          TEXT,
  os                   TEXT,
  browser              TEXT,
  user_agent           TEXT,
  ip_hash              TEXT,

  -- 行動の記録
  shared_at            TEXT,                 -- X共有ボタンの初回クリック（F5-5）
  share_count          INTEGER NOT NULL DEFAULT 0,
  guide_opened_at      TEXT,
  guide_max_chapter    INTEGER,              -- 0=序章 1=第一章 2=第二章 3=終章
  guide_completed_at   TEXT,                 -- 終章に到達した時刻

  -- 運用欄（Admin編集。旧スプレッドシートの手入力列の置き換え。F1-1）
  admin_status         TEXT,
  admin_note           TEXT,

  deleted_at           TEXT                  -- 削除依頼への対応（6.2）
);

CREATE INDEX idx_responses_created_at ON responses(created_at DESC);
CREATE INDEX idx_responses_type_code  ON responses(type_code);
CREATE INDEX idx_responses_ref_code   ON responses(ref_code);
CREATE INDEX idx_responses_src        ON responses(src);

-- ───────────────────────────────────────────
-- 設問別回答（1診断＝24行）
-- 現行スプレッドシートは9問しか残していない。15問のリッカート生値もここに入れる（課題4）
-- ───────────────────────────────────────────
CREATE TABLE response_answers (
  response_id  TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  order_no     INTEGER NOT NULL,             -- 1〜24（出題順）
  question_key TEXT NOT NULL,                -- 設問の識別子。設問文はバージョン側で引く
  kind         TEXT NOT NULL,                -- 'bin'（二択） | 'lik'（4件法）
  axis         TEXT NOT NULL,                -- h/c/w または safety/trust/bound/conflict/connect
  value        TEXT NOT NULL,                -- binは極（O/G/B/K/L/S）、likは '1'〜'4'
  answered_at  TEXT,                         -- 設問ごとの所要時間の分析用（任意）
  PRIMARY KEY (response_id, order_no)
);

-- ───────────────────────────────────────────
-- 検証アンケート（確認事項9＝b で新規収集は廃止）
-- 既存データの移行先としてのみ作る。Adminでは過去の回答を参照できる。
-- ───────────────────────────────────────────
CREATE TABLE feedback_surveys (
  response_id TEXT PRIMARY KEY REFERENCES responses(id) ON DELETE CASCADE,
  me          TEXT,
  others      TEXT,
  others_who  TEXT,
  share       TEXT,
  share_who   TEXT,
  dig         TEXT,
  miss        TEXT,
  created_at  TEXT NOT NULL
);

-- ───────────────────────────────────────────
-- 商談前ヒアリング（ガイド終章。すべて任意。F4-5）
-- ───────────────────────────────────────────
CREATE TABLE hearings (
  response_id TEXT PRIMARY KEY REFERENCES responses(id) ON DELETE CASCADE,
  now_text    TEXT,                          -- いま人間関係で悩んでいること
  future_text TEXT,                          -- 解消されたらどんな毎日を送れそうか
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ───────────────────────────────────────────
-- 結果閲覧セッション（F4-2）
-- 3つの鍵の一致で結果を出す：この行（サーバ）＋ id（HttpOnly Cookie）＋ tab_token（sessionStorage）
-- ───────────────────────────────────────────
CREATE TABLE result_sessions (
  id            TEXT PRIMARY KEY,            -- Cookie に載せる。推測不能なランダム値
  tab_token     TEXT NOT NULL,               -- sessionStorage 側の照合値。Cookieとは別の値にする
  response_id   TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  issued_at     TEXT NOT NULL,
  expires_at    TEXT NOT NULL,               -- 発行から2時間（F4-1）
  last_seen_at  TEXT NOT NULL,               -- 最終操作。ここから30分で失効（F4-1）
  closed_at     TEXT,
  closed_reason TEXT,                        -- 'user_close' | 'retake' | 'expired'
  ua_hash       TEXT,
  ip_hash       TEXT
);

CREATE INDEX idx_result_sessions_response ON result_sessions(response_id);
CREATE INDEX idx_result_sessions_expires  ON result_sessions(expires_at);

-- ───────────────────────────────────────────
-- 申込フォームへの到達（F4-5）
-- id が到達ID。/apply/{typeCode}?v={id} としてURLに載るので、必ず推測不能なランダム値にする。
-- 連番だと他人の回答に自分の申込を紐づけられる。
-- ───────────────────────────────────────────
CREATE TABLE apply_visits (
  id          TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  visited_at  TEXT NOT NULL,
  cta         TEXT NOT NULL                  -- 'epilogue-1' | 'epilogue-2'
);

CREATE INDEX idx_apply_visits_response ON apply_visits(response_id, visited_at DESC);

-- ───────────────────────────────────────────
-- 体験セッション申込（F4-5）
-- response_id はクライアントから受け取らず、apply_visit_id からサーバ側で解決して保存する。
-- ───────────────────────────────────────────
CREATE TABLE session_applications (
  id              TEXT PRIMARY KEY,
  created_at      TEXT NOT NULL,
  apply_visit_id  TEXT REFERENCES apply_visits(id) ON DELETE SET NULL,
  response_id     TEXT REFERENCES responses(id)    ON DELETE SET NULL,
  type_code       TEXT,                      -- URL（/apply/{typeCode}）から確定。設問としては聞かない
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  concern         TEXT,                      -- いま気になっていること（任意）
  preferred_slots TEXT,                      -- JSON配列。希望の時間帯（任意・複数）
  question        TEXT,                      -- ご質問・伝えておきたいこと（任意）
  source          TEXT NOT NULL DEFAULT 'in-app',   -- 'in-app' | 'google-form-import'
  status          TEXT NOT NULL DEFAULT '未対応',   -- 未対応/日程調整中/実施済/成約/辞退
  held_at         TEXT,
  admin_note      TEXT,
  deleted_at      TEXT
);

CREATE INDEX idx_session_apps_created  ON session_applications(created_at DESC);
CREATE INDEX idx_session_apps_response ON session_applications(response_id);
CREATE INDEX idx_session_apps_visit    ON session_applications(apply_visit_id);
CREATE INDEX idx_session_apps_status   ON session_applications(status);

-- ───────────────────────────────────────────
-- 法人リード（法人LPの商談フォーム）
-- 現行の「法人リード」シートの移行先。issues は「、」連結でなくJSON配列で持つ（7.1）
-- ───────────────────────────────────────────
CREATE TABLE corp_leads (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  email      TEXT NOT NULL,
  issues     TEXT,                           -- JSON配列
  detail     TEXT,
  ref_code   TEXT,
  page       TEXT,                           -- 流入ページ
  status     TEXT NOT NULL DEFAULT '未対応',
  admin_note TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_corp_leads_created ON corp_leads(created_at DESC);

-- ───────────────────────────────────────────
-- 管理ユーザー（F2-1）
-- 確認事項8で1名運用・権限分離なしと確定したため role は持たない。
-- ───────────────────────────────────────────
CREATE TABLE admin_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  failed_count  INTEGER NOT NULL DEFAULT 0,  -- 5回失敗でロック（F2-1）
  locked_until  TEXT,
  disabled_at   TEXT
);

-- Admin のログインセッション
CREATE TABLE admin_sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,                -- 無操作30分でタイムアウト（F2-1）
  revoked_at   TEXT
);

-- ───────────────────────────────────────────
-- 監査ログ（F2-1）
-- 1名運用でも、個人情報の閲覧・エクスポート・削除は記録として残す。
-- ───────────────────────────────────────────
CREATE TABLE admin_audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  at          TEXT NOT NULL,
  action      TEXT NOT NULL,                 -- 'view_pii' | 'export' | 'update' | 'delete' | 'login' ...
  target_type TEXT,
  target_id   TEXT,
  ip_hash     TEXT,
  detail      TEXT                           -- JSON
);

CREATE INDEX idx_audit_at ON admin_audit_logs(at DESC);
