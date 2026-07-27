# -*- coding: utf-8 -*-
"""guide-3day-spec.md §8のガワ ＋ ガイド文面24本.md から apps-script/GuideContent.gs を生成する。
mdが正。文言を変えたら再実行して .gs を作り直す（またはシートを直接編集する）。
実行: リポジトリのどこからでも `python3 apps-script/gen_guide_content.py`"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "guide-3day-spec.md"
HON  = ROOT / "ガイド文面24本.md"
OUT  = ROOT / "apps-script" / "GuideContent.gs"

spec = open(SPEC, encoding="utf-8").read()
hon  = open(HON,  encoding="utf-8").read()

# ---------- §8 ガワ（fenced block を太字見出しで取り出す） ----------
def gawa_block(title):
    m = re.search(r"\*\*" + re.escape(title) + r"\*\*\n\n```\n(.*?)\n```", spec, re.S)
    assert m, f"ガワブロックが見つからない: {title}"
    return m.group(1).strip()

COMMON = [
    (1, "opening",   gawa_block("冒頭（自己開示＋T-up＋目的の設定）")),
    (1, "education", gawa_block("教育ブロック（商品群の必要性・1回目）")),
    (1, "closing",   gawa_block("末尾（予告）")),
    (2, "opening",   gawa_block("冒頭（前日の道具への言及＋相手がしてほしい質問）")),
    (2, "education", gawa_block("教育ブロック（もったいない＋変われない理由＝必要性・2回目）")),
    (3, "opening",   gawa_block("冒頭（目的の再確認）")),
    (3, "education", gawa_block("教育ブロック（変化ストーリー＋開いたループ＝必要性・3回目）")),
]

# Day3 末尾CTA（β期・差し替え式）：§8の仕様（先行案内の予告＋アンケート2問＋署名）を配信文面化。
# M4切替は「ガイド文面」シートのこの行を差し替えるだけ（§9）。
CTA_BETA = """最後に、一つだけお願いがあります。

いま、あなたの
「いま引っかかっている関係」を
一緒に読み解く体験セッションを
準備しています。

下のアンケートにお答えいただいた方に、
案内ができ次第、先行してお知らせします
（一般のご案内より早くお届けします）。

▼ 3日間のアンケート（2問・約1分）
→〔アンケートURL〕

① 3日間で、
いちばん刺さった日はどれでしたか？
（Day1／Day2／Day3）

② あなたの
「いま引っかかっている関係」を
一緒に読み解く体験セッション
（無料・30〜45分）があったら、
受けてみたいですか？
（ぜひ受けたい／内容次第で受けたい／
今はいい）

＋任意の感想もいただけると嬉しいです。
メール欄は必須です
（先行案内の照合に使います）。

〔送信者名・連絡先（要確定）〕"""

# フッター（§8・特定電子メール法対応）
FOOTER = """診断の深掘り申込をいただいた方に
お送りしています。
送信者：〔氏名または名称・連絡先（要確定）〕
このガイドの配信を停止する
→〔配信停止URL〕"""

COMMON.append((3, "cta", CTA_BETA))
COMMON.append((0, "footer", FOOTER))

# ---------- 24本（md → プレーンテキスト） ----------
def md_to_plain(md):
    out = []
    for line in md.split("\n"):
        line = line.rstrip()
        if line.startswith("> "):
            line = line[2:]
        elif line == ">":
            line = ""
        if line.startswith("- "):
            line = "◎ " + line[2:]
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)  # 太字は装飾なしに（【】は本文が明示指定した箇所のみ）
        out.append(line)
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# ---------- 配信用の整形（スマホ前提：1行20文字・リストは1件ずつ離す） ----------
WRAP_WIDTH = 20
BREAK_AFTER = "、。！？）」』】〕"   # この文字の直後は強い切れ目
NO_START    = "、。！？」』）】〕｝〉・ー：；，．ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ々"
NO_END      = "「『（【〔｛〈"        # 行末に置かない
HIRAGANA    = re.compile(r"[ぁ-ん]")
KATAKANA    = re.compile(r"[ァ-ヴー]")
UNBREAKABLE = re.compile(r"〔[^〕]*〕|https?://\S+")  # プレースホルダとURLは分断しない

PARTICLES = "をはがにでとものかねよへ"  # 1文字の助詞

def hira_run(s, i):
    """s[i-1] を末尾とするひらがなの連続長"""
    n = 0
    while i - 1 - n >= 0 and HIRAGANA.match(s[i - 1 - n]):
        n += 1
    return n

def find_break(s, lo, hi):
    """lo〜hi の範囲で自然な切れ目を右から探す。見つからなければ -1。
    句読点・閉じ括弧の直後か、助詞から漢字・カタカナへ移る境目を文節の切れ目とみなす。"""
    for i in range(hi, lo - 1, -1):
        if s[i] in PARTICLES:
            continue  # 助詞は前の語にくっつくので、行頭に置かない
        if s[i - 1] in BREAK_AFTER:
            return i
        if s[i - 1] in "おご":
            continue  # 「お送りします」のような接頭辞を切り離さない
        if HIRAGANA.match(s[i - 1]) and not HIRAGANA.match(s[i]) and s[i] not in NO_START:
            # 漢字＋送り仮名1文字＋漢字は「引っ張る」「言い切る」のような複合語。切らない
            if s[i - 1] in PARTICLES or hira_run(s, i) >= 2:
                return i
    return -1

def wrap_line(s, width=WRAP_WIDTH):
    """1行を width 文字以内に折る。既存の改行は尊重し、この関数は1行だけを見る。"""
    out = []
    while len(s) > width:
        hi = min(width, len(s) - 3)  # 余りが2文字以下の孤立行にならないようにする
        lo = max(int(width * 0.4), 1)
        cut = find_break(s, lo, hi) if hi >= lo else -1
        if cut <= 0:  # 自然な切れ目がないので詰めて切る。禁則とカタカナ語の分断だけ避ける
            cut = max(hi, 1)
            for _ in range(4):
                if cut > 1 and (s[cut] in NO_START or s[cut - 1] in NO_END or
                                (KATAKANA.match(s[cut]) and KATAKANA.match(s[cut - 1]))):
                    cut -= 1
                else:
                    break
        for m in UNBREAKABLE.finditer(s):  # 〔〕やURLの内側で切らない
            if m.start() < cut < m.end():
                cut = m.start() if m.start() > 0 else m.end()
                break
        if cut <= 0:
            cut = min(width, len(s))
        out.append(s[:cut].rstrip())
        s = s[cut:].lstrip()
    out.append(s)
    return out

def format_for_mail(text):
    lines = []
    for line in text.split("\n"):
        if line.startswith("◎ ") and lines and lines[-1] != "":
            lines.append("")  # リストは1件ずつ空行で離す（折り返すと塊が潰れるため）
        lines.extend(wrap_line(line))
    return "\n".join(lines)

NAMES = {"OBL":"突撃隊長","OBS":"正論ハンマー","OKL":"お祭り隊長","OKS":"自由人コメンテーター",
         "GBL":"沈黙の大黒柱","GBS":"縁の下の職人","GKL":"根回しの仕掛け人","GKS":"がんばり屋の調整役"}
SUBJECT = {1:"読み解きガイド Day1｜自然体でいられる環境",
           2:"読み解きガイド Day2｜あなたの「裏モード」",
           3:"読み解きガイド Day3｜あの人との関係を解く"}

TYPES_ROWS = []
secs = re.split(r"^## \d+\.【(.+?)のあなたへ】(\w+)\s*$", hon, flags=re.M)[1:]
assert len(secs) == 24, f"セクション分割 {len(secs)}"
for i in range(0, 24, 3):
    name, code, body = secs[i], secs[i+1], secs[i+2]
    assert NAMES[code] == name, f"{code} と {name} の不一致"
    days = re.split(r"^### Day (\d)　.+$", body, flags=re.M)
    # days[0]=キャッチ引用, 以降 (番号, 本文) の繰り返し
    for j in range(1, len(days), 2):
        d = int(days[j])
        raw = days[j+1].split("\n---")[0]
        TYPES_ROWS.append({"code": code, "day": d,
                           "subject": f"【{name}のあなたへ】{SUBJECT[d]}",
                           "body": md_to_plain(raw)})
assert len(TYPES_ROWS) == 24

# ---------- 検証 ----------
for r in TYPES_ROWS:
    assert "**" not in r["body"] and "###" not in r["body"], f"md残存: {r['code']} D{r['day']}"
    assert not re.search(r"[—–―]", r["body"]), f"ダッシュ: {r['code']} D{r['day']}"
    if r["day"] == 1: assert "ふと顔を出した瞬間です" in r["body"]
    if r["day"] == 3: assert "〔診断URL〕" in r["body"]
for d, b, t in COMMON:
    assert not re.search(r"[—–―]", t), f"ダッシュ: common {d} {b}"

# ---------- 配信用に整形（検証はプレーンな状態で済ませてから折り返す） ----------
COMMON = [(d, b, format_for_mail(t)) for d, b, t in COMMON]
for r in TYPES_ROWS:
    r["body"] = format_for_mail(r["body"])
for d, b, t in COMMON:
    for line in t.split("\n"):
        assert len(line) <= WRAP_WIDTH or UNBREAKABLE.search(line), f"20字超: common {d} {b} / {line}"
for r in TYPES_ROWS:
    for line in r["body"].split("\n"):
        assert len(line) <= WRAP_WIDTH or UNBREAKABLE.search(line), f"20字超: {r['code']} D{r['day']} / {line}"

# ---------- .gs 出力 ----------
def js(s): return json.dumps(s, ensure_ascii=False)

lines = []
lines.append("/**")
lines.append(" * ガイド文面のシード（自動生成。手で編集しない）")
lines.append(" * 生成元: guide-3day-spec.md §8（ガワ） + ガイド文面24本.md（タイプ別本文）")
lines.append(" * 再生成: apps-script/gen_guide_content.py（両mdを直したら再実行）")
lines.append(" * 運用中の文言修正は「ガイド文面」シートを直接編集すればよい（コード変更・再デプロイ不要）。")
lines.append(" */")
lines.append("")
lines.append("// 共通ガワ：day=0 は全日共通（footer）。組み立て順は Guide.gs の GUIDE_LAYOUT を参照。")
lines.append("var GUIDE_COMMON = [")
for d, b, t in COMMON:
    lines.append(f"  {{day: {d}, block: {js(b)}, body: {js(t)}}},")
lines.append("];")
lines.append("")
lines.append("// タイプ別本文 24本（8タイプ × Day1〜3）")
lines.append("var GUIDE_TYPES = [")
for r in TYPES_ROWS:
    lines.append(f"  {{code: {js(r['code'])}, day: {r['day']}, subject: {js(r['subject'])}, body: {js(r['body'])}}},")
lines.append("];")
lines.append("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines))
print(f"生成OK: {OUT}")
print(f"  共通ガワ {len(COMMON)} ブロック / タイプ別 {len(TYPES_ROWS)} 本")
import os
print(f"  サイズ: {os.path.getsize(OUT)/1024:.1f} KB")
