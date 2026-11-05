"""11/18 の縦長（Instagram・Threads 4:5 と ストーリーズ 9:16）を、横長と同じドット絵とドット文字で描く。

横長（banner_1118.py）の部品（書体・ウィンドウ・宝箱・▶▼）を使い、配置だけ縦向きに組み直す。
SNS では日時が無いと伝わらないので、横長で外した日時と開催の詳細を左のウィンドウに入れる。
ストーリーズは上下およそ 250px が操作部分に隠れるので、4:5 と同じ配置を DY だけ下へずらす。

  python3 pixel-banner/banner_1118_portrait.py
"""
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import banner_1118 as base  # noqa: E402

C = base.C
rgb = base.rgb
glyph_cells = base.glyph_cells
HERE = os.path.dirname(os.path.abspath(__file__))
U = 15  # 背景のドットの大きさ


class Layer(base.Layer):
    def __init__(self, w, h, out):
        self.w, self.h, self.out = w, h, out
        self.im = Image.new("RGBA", (w, h))
        self.d = ImageDraw.Draw(self.im)

    def save(self, name, pad=0):
        x0, y0, x1, y1 = self.im.getbbox()
        crop = self.im.crop((x0, y0, x1, y1))
        crop.save(f"{self.out}/{name}.png", optimize=True)
        return dict(name=name, left=x0, top=y0, width=x1 - x0, height=y1 - y0)


def width(text, s):
    return (max(x for x, _ in glyph_cells(text)) + 1) * s


def background(W, H, dy):
    """dy は 4:5 の配置からのずらし（px）。U の倍数にする。"""
    GW, GH = W // U, H // U
    oy = dy // U
    cells = {}

    def px(x, y, c):
        if 0 <= x < GW and 0 <= y < GH:
            cells[(x, y)] = C[c]

    def rect(x0, y0, w, h, c):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                px(x, y, c)

    # 空（上から少しずつ明るく、境目は市松）
    bands = [(0, "sky0"), (int(GH * 0.25), "sky1"), (int(GH * 0.45), "sky2"), (int(GH * 0.62), "sky3")]
    for i, (y0, c) in enumerate(bands):
        y1 = bands[i + 1][0] if i + 1 < len(bands) else GH
        rect(0, y0, GW, y1 - y0, c)
        if i > 0:
            for x in range(0, GW, 2):
                px(x, y0, bands[i - 1][1])
    # 星
    import random
    rnd = random.Random(1118)
    # 名乗り（ウィンドウの無い文字）の後ろには星を置かない
    no_star = (0, (555 + dy) // U - 1, 820 // U + 1, (712 + dy) // U + 1)
    for i in range(int(GW * GH / 90)):
        x, y = rnd.randrange(GW), rnd.randrange(int(GH * 0.75))
        if no_star[0] <= x <= no_star[2] and no_star[1] <= y <= no_star[3]:
            continue
        px(x, y, "star2" if i % 3 == 0 else "star")
    # 遠くの丘
    import math
    for x in range(GW):
        top = int(oy + 62 + 1.5 * math.sin(x / 5.0) + math.sin(x / 2.3))
        rect(x, top, 1, GH - top, "far")

    # 地面：左は平ら、右へ段々に上がる
    TER = [(0, 71), (54, 68), (59, 64), (64, 60)]

    def gtop(x):
        t = TER[0][1]
        for x0, y0 in TER:
            if x >= x0:
                t = y0
        return t + oy

    for x in range(GW):
        t = gtop(x)
        rect(x, t, 1, GH - t, "near")
        px(x, t, "edge")
    for x0, _ in TER[1:]:
        for y in range(gtop(x0), gtop(x0 - 1)):
            px(x0, y, "edge")
    for i in range(GW * 2):
        x = (i * 37) % GW
        y = gtop(x) + 2 + (i * 13) % max(1, GH - gtop(x) - 3)
        if cells.get((x, y)) == C["near"]:
            px(x, y, "tex")

    # 月（4:5 では見出しの下の空き、ストーリーズでは上の空）
    moon = ["..MMM", ".MM..", "MM...", "MM...", "MM...", ".MM..", "..MMM"]
    mx, my = (58, 49 + oy) if dy == 0 else (60, 6)
    for ddy, line in enumerate(moon):
        for ddx, ch in enumerate(line):
            if ch == "M":
                px(mx + ddx, my + ddy, "moon")

    # 会社のビル
    bx, by = 39, 54 + oy
    rect(bx, by, 8, 71 + oy - by, "bld")
    rect(bx, by, 1, 71 + oy - by, "bld_d")
    rect(bx, by - 1, 8, 1, "roof")
    for row in range(4):
        for col in range(2):
            on = (row * 2 + col) % 3 != 1
            rect(bx + 2 + col * 3, by + 2 + row * 3, 2, 2, "win" if on else "win_off")
    rect(bx + 3, 68 + oy, 2, 3, "win_off")

    # 道とステージの点
    pts = []
    x, y = 47, 70 + oy
    for x0, y0 in TER[1:]:
        while x < x0:
            pts.append((x, y)); x += 1
        while y > y0 + oy - 1:
            pts.append((x, y)); y -= 1
    while x < 66:
        pts.append((x, y)); x += 1
    for i, p in enumerate(pts):
        if i % 2 == 0:
            px(p[0], p[1], "dot")
    for (nx, k) in [(56, "now"), (61, "nxt")]:
        ny = gtop(nx) - 1
        rect(nx - 1, ny - 1, 3, 2, k)

    # 旗と自分の店
    rect(65, 48 + oy, 1, 12, "pole")
    px(65, 47 + oy, "star2")
    rect(66, 48 + oy, 4, 2, "flag"); rect(66, 50 + oy, 2, 1, "flag")
    rect(67, 57 + oy, 5, 3, "wall")
    rect(66, 56 + oy, 7, 1, "roof2"); rect(67, 55 + oy, 5, 1, "roof2"); rect(68, 54 + oy, 3, 1, "roof2")
    px(68, 58 + oy, "win")
    rect(70, 58 + oy, 1, 2, "door")

    # 主人公
    hero = ["..HHH..", ".HHHHH.", ".HHSSS.", "..SSS..", ".WWTWW.", "WWWTWPP", "SWWGWPP",
            ".WWWWW.", ".NNNNN.", ".NN.NN.", ".NN.NN.", ".BB.BB."]
    key = dict(H="hair", S="skin", W="shirt", T="strap", G="badge", N="pants", B="shoe", P="pc")
    hx, hy = 47, 59 + oy
    for ddy, line in enumerate(hero):
        for ddx, ch in enumerate(line):
            if ch in key:
                px(hx + ddx, hy + ddy, key[ch])

    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    for (x, y), c in cells.items():
        d.rectangle([x * U, y * U, x * U + U - 1, y * U + U - 1], fill=rgb(c))
    return im


def build(name, W, H, dy):
    out = os.path.join(HERE, "out", "2026-11-18", name)
    os.makedirs(out, exist_ok=True)
    placed = []
    bg = background(W, H, dy)
    bg.save(f"{out}/bg.png", optimize=True)
    placed.append(dict(name="bg", left=0, top=0, width=W, height=H))
    LX, RX = 40, W - 40

    # メッセージウィンドウ：呼びかけ → キャッチ → ▼
    L = Layer(W, H, out)
    y0, y1 = 40 + dy, 306 + dy
    L.window(LX, y0, RX, y1, C["ink"], C["white"], u=6)
    L.text("「時間がないから」で先送りにしてきた人へ", LX + 36, y0 + 36, 2.5, C["grey"])
    L.text("通用するか、確かめることを", LX + 44, y0 + 98, 4.25, C["white"])
    L.text("ためらってしまう。", LX + 44, y0 + 98 + 82, 4.25, C["white"])
    base.tri_down(L, RX - 78, y1 - 58, 4, C["yellow"])
    placed.append(L.save("message"))

    # 見出し
    L = Layer(W, H, out)
    hy = 330 + dy
    band0, band1 = 420 + dy, 530 + dy
    L.rect(0, band0, W, band1, C["red"])
    L.rect(0, band0, W, band0 + 6, C["darkred"])
    L.rect(0, band1 - 6, W, band1, C["darkred"])
    L.text("自分の強みを、", LX + 10, hy, 5, C["yellow"], shadow=C["ink"])
    L.text("会社以外で稼ぐ力に変える", (W - width("会社以外で稼ぐ力に変える", 5)) / 2, band0 + (110 - 80) / 2, 5,
           C["white"], shadow=C["darkred"])
    placed.append(L.save("headline"))

    # 添え書き（黄の帯）と名乗り（▶）
    L = Layer(W, H, out)
    s = 2.25
    tw = width("短時間副業のプロが教える", s)
    L.rect(LX, 555 + dy, LX + tw + 40, 555 + dy + 52, C["yellow"])
    L.text("短時間副業のプロが教える", LX + 20, 555 + dy + (52 - 15 * s) / 2, s, C["ink"])
    base.tri_right(L, LX + 6, 626 + dy, 4, C["yellow"])
    L.text("会社員のまま始める、", LX + 40, 622 + dy, 2.5, C["white"], shadow=C["ink"])
    L.text("週末起業セミナー（ワークショップ付き）", LX + 40, 622 + dy + 50, 2.5, C["white"], shadow=C["ink"])
    placed.append(L.save("kicker"))

    # 日時のウィンドウ
    L = Layer(W, H, out)
    wx0, wy0, wx1, wy1 = LX, 740 + dy, 560, 1072 + dy
    L.window(wx0, wy0, wx1, wy1, C["ink"], C["white"], u=6)
    ix = wx0 + 40
    L.text("2026.11.18(水)", ix, wy0 + 40, 3.75, C["yellow"])
    L.text("21:00〜22:00", ix, wy0 + 40 + 72, 3.75, C["white"])
    L.text("参加無料・定員10名", ix, wy0 + 40 + 72 + 76, 2.5, C["yellow"])
    L.text("オンラインセミナー（Zoom）", ix, wy0 + 40 + 72 + 76 + 50, 2, C["white"])
    L.text("顔出し・発言なしOK", ix, wy0 + 40 + 72 + 76 + 50 + 40, 2, C["white"])
    placed.append(L.save("date"))

    # 豪華プレゼント3点
    L = Layer(W, H, out)
    px0, py0, px1, py1 = LX, 1086 + dy, RX, 1330 + dy
    L.window(px0, py0, px1, py1, C["red"], C["yellow"], u=6)
    base.chest(L, px0 + 52, py0 + (py1 - py0 - 12 * 10) // 2, 10)
    cx = px0 + 52 + 160 + 48
    L.text("最後まで参加で", cx, py0 + 28, 2, C["white"])
    L.text("豪華プレゼント3点", cx, py0 + 28 + 36, 3.5, C["cream"], shadow=C["darkred"])
    for i, t in enumerate(["① 強み発掘AIプロンプト", "② 声かけ文面AIプロンプト", "③ 時短副業ワークシート"]):
        L.text(t, cx, py0 + 28 + 36 + 62 + i * 34, 2, C["white"])
    placed.append(L.save("present"))

    json.dump(placed, open(f"{out}/placed.json", "w"), ensure_ascii=False, indent=1)
    comp = bg.copy()
    for p in placed[1:]:
        comp.alpha_composite(Image.open(f"{out}/{p['name']}.png"), (p["left"], p["top"]))
    comp.convert("RGB").save(f"{out}/preview.png", optimize=True)
    return placed


if __name__ == "__main__":
    for p in build("feed_4x5", 1080, 1350, 0):
        print("4:5", p)
    for p in build("story_9x16", 1080, 1920, 285):
        print("9:16", p)
