#!/usr/bin/env bash
set -u
# 結果画面のワンタイム表示（F4）の疎通試験。
#
#   npm run dev            # 別のターミナルで起動しておく
#   bash tools/e2e-result.sh
#
# 3つの鍵（サーバの行 / HttpOnly Cookie / sessionStorage の照合値）が
# 揃ったときだけ結果が出ることを、実物のHTTPで確かめる。

B=http://127.0.0.1:8787
J=/tmp/nr
mkdir -p $J
C() { curl -s --noproxy '*' --max-time 8 "$@"; }
ok=0; ng=0
t() { if [ "$2" = "$3" ]; then ok=$((ok+1)); else ng=$((ng+1)); echo "  NG: $1 → 期待 '$3' / 実際 '$2'"; fi }

ANS='["O","B","L","O","B","L","O","B","L",4,4,4,4,4,3,3,3,3,3,2,2,2,2,2]'

echo "=== 診断を1件受ける ==="
C -c $J/cookie.txt -o $J/submit.json -X POST "$B/api/responses" \
  -H 'Content-Type: application/json' -d "{\"answers\":$ANS}" >/dev/null
TAB=$(python3 -c "import json;print(json.load(open('$J/submit.json'))['tabToken'])")
t "tabToken が返る" "$([ -n "$TAB" ] && echo yes || echo no)" "yes"

echo "=== 1. 3つ揃えば結果が出る ==="
t "GET /result（Cookieあり）" "$(C -b $J/cookie.txt -o /dev/null -w '%{http_code}' "$B/result")" "200"
C -b $J/cookie.txt -o $J/view.json -w '%{http_code}' -X POST "$B/api/result/view" \
  -H 'Content-Type: application/json' -d "{\"tabToken\":\"$TAB\"}" > $J/code.txt
t "POST /api/result/view" "$(cat $J/code.txt)" "200"
t "タイプ名が入っている" "$(python3 -c "
import json;h=json.load(open('$J/view.json')).get('html','');print('yes' if '突撃隊長' in h else 'no')")" "yes"
t "軸の帯が8本（3軸＋5軸）" "$(python3 -c "
import json;h=json.load(open('$J/view.json')).get('html','');print(h.count('class=\"axis-row\"'))")" "8"
t "トリセツが4枚" "$(python3 -c "
import json;h=json.load(open('$J/view.json')).get('html','');print(h.count('class=\"ts-card\"'))")" "4"
t "他タイプの文面が混ざっていない" "$(python3 -c "
import json;h=json.load(open('$J/view.json')).get('html','');print('yes' if '正論ハンマー' not in h and 'お祭り隊長' not in h else 'no')")" "yes"

echo "=== 2. タブ照合値が違う・無いと出ない（別タブ／タブを閉じた後） ==="
t "照合値が違う" "$(C -b $J/cookie.txt -o /dev/null -w '%{http_code}' -X POST "$B/api/result/view" -H 'Content-Type: application/json' -d '{"tabToken":"wrong-token"}')" "410"
t "照合値が無い" "$(C -b $J/cookie.txt -o /dev/null -w '%{http_code}' -X POST "$B/api/result/view" -H 'Content-Type: application/json' -d '{}')" "410"

echo "=== 3. Cookieが無いと出ない（別デバイス／URLを受け取った他人） ==="
t "Cookieなしで GET /result" "$(C -o /dev/null -w '%{http_code}' "$B/result")" "410"
t "Cookieなしで view" "$(C -o /dev/null -w '%{http_code}' -X POST "$B/api/result/view" -H 'Content-Type: application/json' -d "{\"tabToken\":\"$TAB\"}")" "410"

echo "=== 4. 閉じたら、3つ揃っていても出ない ==="
C -b $J/cookie.txt -o /dev/null -X POST "$B/api/result/close" -H 'Content-Type: application/json' -d '{"reason":"user_close"}' >/dev/null
t "閉じた後の view" "$(C -b $J/cookie.txt -o /dev/null -w '%{http_code}' -X POST "$B/api/result/view" -H 'Content-Type: application/json' -d "{\"tabToken\":\"$TAB\"}")" "410"
t "閉じた後の GET /result" "$(C -b $J/cookie.txt -o /dev/null -w '%{http_code}' "$B/result")" "410"

echo "=== 5. 案内画面 ==="
t "/result/closed は410" "$(C -o /dev/null -w '%{http_code}' "$B/result/closed")" "410"
t "案内文が出る" "$(C "$B/result/closed" | grep -c 'すでに閉じられています')" "1"

echo
echo "通過 $ok / 失敗 $ng"
[ "$ng" = "0" ] || exit 1
