-- 二重送信の防止（アプリ化要件定義.md F1-3）
-- クライアントが作ったリクエストIDを保存し、同じIDの再送は新しい行を作らずに
-- 既存の結果セッションを返す。通信が途中で切れて再送された場合に、同じ人の回答が
-- 2行になるのを防ぐ。

alter table responses add column client_request_id text;

-- NULL は重複を許すので、部分インデックスにする。
create unique index idx_responses_client_request
  on responses(client_request_id)
  where client_request_id is not null;
