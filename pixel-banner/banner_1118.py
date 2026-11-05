"""11/18 横長バナー（3780×1890）をドット絵とドット文字で描く。

背景（夜の攻略マップ）と、文字のまとまりごとの PNG（透過）を out/2026-11-18/ に書き出し、重ねたプレビューも作る。
文字は DotGothic16（SIL Open Font License 1.1）を 16px で2値に描き、1ドット右に太らせてから拡大する。
書体は初回に Google Fonts のリポジトリから .fonts/ に取ってくる（.fonts/ はコミットしない）。

  python3 pixel-banner/banner_1118.py
"""
import json
import os
import urllib.request

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "2026-11-18")
FONT = os.path.join(HERE, ".fonts", "DotGothic16-Regular.ttf")
FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/dotgothic16/DotGothic16-Regular.ttf"
if not os.path.exists(FONT):
    os.makedirs(os.path.dirname(FONT), exist_ok=True)
    urllib.request.urlretrieve(FONT_URL, FONT)

W, H = 3780, 1890
U = 30                      # 背景のドットの大きさ（126×63 マス）
GW, GH = W // U, H // U

font = ImageFont.truetype(FONT, 16)

C = dict(
    sky0="#091120", sky1="#0c1729", sky2="#102038", sky3="#162b48",
    star="#ffffff", star2="#ffe27a", moon="#ffe27a",
    far="#142a45", near="#1d3b5e", edge="#2f6190", tex="#22456b",
    bld="#3b5577", bld_d="#2a3e5a", win="#ffc93c", win_off="#1a2a40", roof="#22334b",
    dot="#c9d3de", now="#d0021b", nxt="#6b7f99",
    pole="#c9d3de", flag="#d0021b", wall="#e8e2d0", roof2="#d0021b", door="#7a5230",
    hair="#2b1d14", skin="#f1c7a0", shirt="#ffffff", strap="#24344d", badge="#5ad1ff",
    pants="#24344d", shoe="#0b0f17", pc="#9fb3c8",
    ink="#050b14", white="#ffffff", yellow="#ffc93c", red="#d0021b", cream="#ffe27a",
    grey="#c9d3de", darkred="#6e0010",
)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


# ---------------------------------------------------------------- 背景
def background():
    cells = {}

    def px(x, y, c):
        if 0 <= x < GW and 0 <= y < GH:
            cells[(x, y)] = C[c]

    def rect(x0, y0, w, h, c):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                px(x, y, c)

    # 空：上から少しずつ明るく。境目は市松でぼかす
    bands = [(0, "sky0"), (12, "sky1"), (22, "sky2"), (30, "sky3")]
    for i, (y0, c) in enumerate(bands):
        y1 = bands[i + 1][0] if i + 1 < len(bands) else GH
        rect(0, y0, GW, y1 - y0, c)
        if i > 0:
            prev = bands[i - 1][1]
            for x in range(GW):
                if x % 2 == 0:
                    px(x, y0, prev)
    # 星
    stars = [(3, 2), (9, 6), (16, 1), (24, 4), (33, 2), (41, 7), (47, 3), (55, 1), (61, 5), (66, 9),
             (72, 3), (79, 7), (84, 2), (101, 4), (107, 9), (113, 2), (121, 6), (124, 12), (97, 13), (69, 15)]
    for i, (x, y) in enumerate(stars):
        px(x, y, "star2" if i % 3 == 0 else "star")
    for (x, y) in [(60, 4), (76, 12), (110, 15)]:
        for dx, dy in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)]:
            px(x + dx, y + dy, "star2")
    # 月（三日月）
    moon = ["...MMM..", "..MM....", ".MM.....", "MM......", "MM......", "MM......", ".MM.....", "..MM....", "...MMM.."]
    for dy, line in enumerate(moon):
        for dx, ch in enumerate(line):
            if ch == "M":
                px(90 + dx, 3 + dy, "moon")
    # 月の内側を少し太らせる
    for dy, line in enumerate(moon):
        for dx, ch in enumerate(line):
            if ch == "M" and 2 <= dy <= 6:
                px(90 + dx + 1, 3 + dy, "moon")

    # 遠くの丘（なだらかに波打つ）
    import math
    for x in range(GW):
        top = int(35 + 2.2 * math.sin(x / 7.0) + 1.3 * math.sin(x / 3.1))
        rect(x, top, 1, GH - top, "far")

    # 手前の地面：左は平ら、右へ段々に上がる
    TER = [(0, 40), (92, 35), (101, 30), (109, 25), (117, 20)]

    def gtop(x):
        t = TER[0][1]
        for x0, y0 in TER:
            if x >= x0:
                t = y0
        return t

    for x in range(GW):
        t = gtop(x)
        rect(x, t, 1, GH - t, "near")
        px(x, t, "edge")
    for x0, _ in TER[1:]:
        for y in range(gtop(x0), gtop(x0 - 1)):
            px(x0, y, "edge")
    # 地面の模様（まばらに）
    for i in range(GW):
        x = (i * 37) % GW
        y = gtop(x) + 2 + (i * 13) % 18
        if y < GH and cells.get((x, y)) == C["near"]:
            px(x, y, "tex")
            px(x + 1, y, "tex")

    # 会社のビル
    bx, by, bw = 72, 14, 12
    rect(bx, by, bw, 40 - by, "bld")
    rect(bx, by, 2, 40 - by, "bld_d")
    rect(bx, by - 1, bw, 1, "roof")
    rect(bx + 4, by - 3, 3, 2, "roof")
    for row in range(6):
        for col in range(3):
            on = (row * 3 + col) % 4 != 1
            rect(bx + 3 + col * 3, by + 2 + row * 4, 2, 2, "win" if on else "win_off")
    rect(bx + 5, 37, 3, 3, "win_off")

    # 道（点線）とステージの点
    pts = []
    x, y = 85, 39
    for x0, y0 in TER[1:]:
        while x < x0:
            pts.append((x, y)); x += 1
        while y > y0 - 1:
            pts.append((x, y)); y -= 1
    while x < 118:
        pts.append((x, y)); x += 1
    for i, p in enumerate(pts):
        if i % 2 == 0:
            px(p[0], p[1], "dot")
    for (nx, k) in [(96, "now"), (104, "nxt"), (112, "nxt")]:
        ny = gtop(nx) - 1
        rect(nx - 1, ny - 1, 3, 2, k)

    # ゴール：旗と自分の店
    rect(118, 6, 1, 14, "pole")
    px(118, 5, "star2")
    rect(119, 6, 5, 2, "flag"); rect(119, 8, 4, 1, "flag"); rect(119, 9, 2, 1, "flag")
    rect(120, 15, 6, 5, "wall")
    for i in range(4):
        rect(119 + i, 14 - i, 8 - 2 * i, 1, "roof2")
    rect(121, 16, 2, 2, "win")
    rect(124, 17, 1, 3, "door")

    # 主人公（ビルを出たところ。右を向き、社員証を下げ、ノートパソコンを抱える）
    hero = ["..HHH..", ".HHHHH.", ".HHSSS.", "..SSS..", ".WWTWW.", "WWWTWPP", "SWWGWPP",
            ".WWWWW.", ".NNNNN.", ".NN.NN.", ".NN.NN.", ".BB.BB."]
    key = dict(H="hair", S="skin", W="shirt", T="strap", G="badge", N="pants", B="shoe", P="pc")
    hx, hy = 85, 28
    for dy, line in enumerate(hero):
        for dx, ch in enumerate(line):
            if ch in key:
                px(hx + dx, hy + dy, key[ch])

    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    for (x, y), c in cells.items():
        d.rectangle([x * U, y * U, x * U + U - 1, y * U + U - 1], fill=rgb(c))
    return im


# ---------------------------------------------------------------- 文字
def _raw_cells(text):
    w = int(font.getlength(text)) + 4
    im = Image.new("1", (w, 32), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = "1"
    d.text((0, 0), text, font=font, fill=1)
    return {(x, y) for y in range(32) for x in range(w) if im.getpixel((x, y))}


# 全角の字面の上端（どの行も同じ基準で並べるため）
TOP = min(y for _, y in _raw_cells("漢あ「（国"))


def glyph_cells(text, bold=True):
    pts = {(x, y - TOP) for (x, y) in _raw_cells(text)}
    if bold:
        pts |= {(x + 1, y) for (x, y) in pts}
    return pts


def dilate(pts, r=1):
    out = set()
    for (x, y) in pts:
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                out.add((x + dx, y + dy))
    return out


class Layer:
    """透過のキャンバスにドットで描き、最後に描いた範囲で切り抜く。"""

    def __init__(self):
        self.im = Image.new("RGBA", (W, H))
        self.d = ImageDraw.Draw(self.im)

    def cells(self, pts, ox, oy, s, color):
        for (x, y) in pts:
            x0 = ox + x * s
            y0 = oy + y * s
            self.d.rectangle([round(x0), round(y0), round(x0 + s) - 1, round(y0 + s) - 1], fill=rgb(color))

    def text(self, text, ox, oy, s, color, outline=None, shadow=None, bold=True):
        """ox, oy は文字の16pxの枠の左上（outline の分は外にはみ出す）。"""
        pts = glyph_cells(text, bold)
        if shadow:
            self.cells({(x + 1, y + 1) for (x, y) in pts}, ox, oy, s, shadow)
        if outline:
            self.cells(dilate(pts), ox, oy, s, outline)
        self.cells(pts, ox, oy, s, color)
        xs = [x for x, _ in pts]
        return (max(xs) + 1) * s  # 幅（px）

    def rect(self, x0, y0, x1, y1, color):
        self.d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=rgb(color))

    def window(self, x0, y0, x1, y1, fill, border, u=8, t=3, notch=2):
        """RPG のウィンドウ。角は u 単位で段々に欠く。枠の太さは t×u。"""
        # 外形（角を段々に欠いた形）を塗り、内側を fill で塗る
        def stepped(xa, ya, xb, yb, color, n):
            for i in range(n + 1):
                inset = (n - i) * u
                self.rect(xa + inset, ya + i * u, xb - inset, ya + (i + 1) * u, color)
                self.rect(xa + inset, yb - (i + 1) * u, xb - inset, yb - i * u, color)
            self.rect(xa, ya + (n + 1) * u, xb, yb - (n + 1) * u, color)
        stepped(x0, y0, x1, y1, border, notch)
        stepped(x0 + t * u, y0 + t * u, x1 - t * u, y1 - t * u, fill, max(notch - 1, 0))

    def save(self, name, pad=0):
        bbox = self.im.getbbox()
        x0, y0, x1, y1 = bbox
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
        crop = self.im.crop((x0, y0, x1, y1))
        crop.save(f"{OUT}/{name}.png", optimize=True)
        return dict(name=name, left=x0, top=y0, width=x1 - x0, height=y1 - y0)


def tri_right(L, ox, oy, s, color):
    rows = ["X....", "XX...", "XXX..", "XXXX.", "XXXXX", "XXXX.", "XXX..", "XX...", "X...."]
    L.cells({(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "X"}, ox, oy, s, color)


def tri_down(L, ox, oy, s, color):
    rows = ["XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X...."]
    L.cells({(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "X"}, ox, oy, s, color)


def chest(L, ox, oy, s):
    rows = ["..KKKKKKKKKKKK..", ".KLLLLLLLLLLLLK.", "KLLLLLLLLLLLLLLK", "KYYYYYYYYYYYYYYK",
            "KLLLLLLYYLLLLLLK", "KKKKKKKYYKKKKKKK", "KWWWWWYKKYWWWWWK", "KWWWWWYYYYWWWWWK",
            "KYYYYYYYYYYYYYYK", "KWWWWWWWWWWWWWWK", "KWWWWWWWWWWWWWWK", "KKKKKKKKKKKKKKKK"]
    pal = dict(K="#3a2410", L="#b0743a", W="#8a5a2b", Y="#ffc93c")
    for ch, col in pal.items():
        L.cells({(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == ch}, ox, oy, s, col)


def build():
    os.makedirs(OUT, exist_ok=True)
    placed = []
    bg = background()
    bg.save(f"{OUT}/bg.png", optimize=True)
    placed.append(dict(name="bg", left=0, top=0, width=W, height=H))

    LX = 150            # 左の段の左端
    RX = 2050           # 左の段の右端

    # 添え書き（黄の帯に黒のドット文字）
    L = Layer()
    s = 4.5
    tw = (max(x for x, _ in glyph_cells("短時間副業のプロが教える")) + 1) * s
    L.rect(LX, 120, LX + tw + 72, 120 + 112, C["yellow"])
    L.text("短時間副業のプロが教える", LX + 36, 120 + (112 - 15 * s) / 2, s, C["ink"])
    placed.append(L.save("label"))

    # メッセージウィンドウ：呼びかけ → キャッチ → ▼
    L = Layer()
    wy0, wy1 = 280, 870
    L.window(LX, wy0, RX, wy1, C["ink"], C["white"])
    L.text("「時間がないから」で先送りにしてきた人へ", LX + 56, wy0 + 66, 5, C["grey"])
    L.text("通用するか、確かめることを", LX + 64, wy0 + 196, 8, C["white"])
    L.text("ためらってしまう。", LX + 64, wy0 + 196 + 160, 8, C["white"])
    tri_down(L, RX - 150, wy1 - 112, 9, C["yellow"])
    placed.append(L.save("message"))

    # 見出し：1行目は黄、2行目は赤帯の上に黄。黒のふちと影
    L = Layer()
    hy = 950
    band_y0, band_y1 = 1130, 1330
    L.rect(0, band_y0, RX + 20, band_y1, C["red"])
    L.rect(0, band_y0, RX + 20, band_y0 + 10, C["darkred"])
    L.rect(0, band_y1 - 10, RX + 20, band_y1, C["darkred"])
    L.text("自分の強みを、", LX + 10, hy, 9, C["yellow"], shadow=C["ink"])
    L.text("会社以外で稼ぐ力に変える", LX + 10, band_y0 + (200 - 16 * 9) / 2, 9, C["white"], shadow=C["darkred"])
    placed.append(L.save("headline"))

    # 名乗り：コマンドのウィンドウに ▶ と2行
    L = Layer()
    my0, my1 = 1400, 1770
    L.window(LX, my0, RX, my1, C["ink"], C["white"])
    tri_right(L, LX + 60, my0 + 72, 10, C["yellow"])
    L.text("会社員のまま始める、", LX + 150, my0 + 70, 5.5, C["white"])
    L.text("週末起業セミナー（ワークショップ付き）", LX + 150, my0 + 70 + 130, 5.5, C["white"])
    placed.append(L.save("kicker"))

    # 豪華プレゼント：赤のウィンドウに黄の枠、宝箱
    L = Layer()
    px0, py0, px1, py1 = 2190, 1240, 3650, 1770
    L.window(px0, py0, px1, py1, C["red"], C["yellow"])
    chest(L, px0 + 90, py0 + (py1 - py0 - 12 * 16) // 2, 16)
    cx = px0 + 90 + 16 * 16 + 80
    L.text("最後まで参加で", cx, py0 + 52, 4, C["white"])
    L.text("豪華プレゼント", cx, py0 + 132, 8, C["cream"], shadow=C["darkred"])
    for i, t in enumerate(["① 強み発掘AIプロンプト", "② 声かけ文面AIプロンプト", "③ 時短副業ワークシート"]):
        L.text(t, cx, py0 + 290 + i * 72, 4, C["white"])
    placed.append(L.save("present"))

    json.dump(placed, open(f"{OUT}/placed.json", "w"), ensure_ascii=False, indent=1)

    # 重ねたプレビュー
    comp = bg.copy()
    for p in placed[1:]:
        im = Image.open(f"{OUT}/{p['name']}.png")
        comp.alpha_composite(im, (p["left"], p["top"]))
    comp.convert("RGB").save(f"{OUT}/preview.png", optimize=True)
    return placed


if __name__ == "__main__":
    for p in build():
        print(p)
