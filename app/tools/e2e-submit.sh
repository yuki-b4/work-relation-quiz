#!/usr/bin/env bash
set -u
# 回答送信（POST /api/responses）の疎通試験。
#
#   npm run dev            # 別のターミナルで起動しておく
#   bash tools/e2e-submit.sh
#
# アプリ化要件定義.md F1-3（サーバ採番・検証・二重送信の防止）の確認。

B=http://127.0.0.1:8787
C() { curl -s --noproxy '*' --max-time 8 "$@"; }
ok=0; ng=0
t() { if [ "$2" = "$3" ]; then ok=$((ok+1)); else ng=$((ng+1)); echo "  NG: $1 → 期待 '$3' / 実際 '$2'"; fi }

# 冪等キーは毎回作る。固定にすると、同じDBへ2回目を流したとき1件目から
# duplicate:true が返り、まっさらなDBでしか通らない試験になる。
REQ="req-e2e-$(date +%s)-$$"

# 正常な24問（前9問=極、後15問=1〜4）
BODY='{"requestId":"'"$REQ"'","answers":["O","B","L","O","B","L","O","B","L",4,4,4,4,4,3,3,3,3,3,2,2,2,2,2],"frame":"自然体","ref":"TKtp46k","src":"x","entryUrl":"https://natur-indicator.com/?src=x"}'

echo "=== 1. 正常な回答を送る ==="
H=$(C -D- -o /tmp/b1.json -X POST "$B/api/responses" -H 'Content-Type: application/json' -d "$BODY")
cat /tmp/b1.json; echo
t "HTTPステータス" "$(printf '%s' "$H" | head -1 | awk '{print $2}')" "200"
t "Set-Cookie に HttpOnly" "$(printf '%s' "$H" | grep -ci 'set-cookie:.*HttpOnly')" "1"
t "Set-Cookie に Max-Age が無い" "$(printf '%s' "$H" | grep -ci 'set-cookie:.*Max-Age')" "0"
t "tabToken が返る" "$(python3 -c "import json;print('yes' if json.load(open('/tmp/b1.json')).get('tabToken') else 'no')")" "yes"
t "duplicate は false" "$(python3 -c "import json;print(json.load(open('/tmp/b1.json'))['duplicate'])")" "False"

echo "=== 2. 同じ requestId で再送（二重送信） ==="
C -o /tmp/b2.json -X POST "$B/api/responses" -H 'Content-Type: application/json' -d "$BODY" >/dev/null
t "duplicate は true" "$(python3 -c "import json;print(json.load(open('/tmp/b2.json'))['duplicate'])")" "True"
t "同じ tabToken が返る" "$(python3 -c "
import json;a=json.load(open('/tmp/b1.json'));b=json.load(open('/tmp/b2.json'));print('same' if a['tabToken']==b['tabToken'] else 'diff')")" "same"

echo "=== 3. 不正な回答は弾く ==="
t "設問数が足りない" "$(C -o /dev/null -w '%{http_code}' -X POST "$B/api/responses" -H 'Content-Type: application/json' -d '{"answers":["O","B","L"]}')" "400"
t "リッカートが範囲外" "$(C -o /dev/null -w '%{http_code}' -X POST "$B/api/responses" -H 'Content-Type: application/json' -d '{"answers":["O","B","L","O","B","L","O","B","L",9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]}')" "400"
t "JSONが壊れている" "$(C -o /dev/null -w '%{http_code}' -X POST "$B/api/responses" -H 'Content-Type: application/json' -d 'not-json')" "400"

echo
echo "通過 $ok / 失敗 $ng"
[ "$ng" = "0" ] || exit 1
