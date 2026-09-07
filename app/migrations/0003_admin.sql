-- Admin（アプリ化要件定義.md F2）で足りなくなった列と索引。
-- 0001 は編集せず、変更はこのファイルで足す。

-- ───────── ログインセッション ─────────
-- CSRF トークンはセッションごとに1本持つ（6.1：SameSite＋Originチェック＋トークンの三重）。
-- 既存行が無い前提だが、SQLite の ALTER TABLE ADD COLUMN は NOT NULL に既定値を要求するので
-- NULL 許容で足し、書き込み側で必ず入れる。
alter table admin_sessions add column csrf_token text;

-- どこから入ったログインかを残す（身に覚えのないログインの照合用。F2-1）。
-- 生IPは保存しない（6.2）。
alter table admin_sessions add column ip_hash text;
alter table admin_sessions add column ua_hash text;

create index idx_admin_sessions_user ON admin_sessions(user_id);
create index idx_admin_sessions_seen ON admin_sessions(last_seen_at);

-- ───────── 一覧の絞り込み・並べ替え用 ─────────
create index idx_responses_admin_status ON responses(admin_status);
create index idx_responses_referrer     ON responses(referrer_code);
create index idx_session_apps_email     ON session_applications(email);
create index idx_corp_leads_status      ON corp_leads(status);

-- 監査ログを対象で引けるようにする（ある回答の閲覧履歴をたどる）。
create index idx_audit_target ON admin_audit_logs(target_type, target_id, at DESC);
