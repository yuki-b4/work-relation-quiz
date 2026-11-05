# ドット絵の告知バナー

セミナー告知のバナーを、ドット絵とドット文字で描くスクリプトと、その書き出し。
Canva の MCP では書体を選べず、この環境から Canva へ直接アップロードもできないので、手元で原寸の PNG に描いてからブランチに置き、
`raw.githubusercontent.com` の URL を Canva に取り込ませている（リポジトリは公開）。

## 11/18（副業テーマ・技術職向け）

- スクリプト：`banner_1118.py`（`python3 pixel-banner/banner_1118.py`）
- 書き出し：`out/2026-11-18/`
  - `bg.png`：背景（夜の攻略マップ。3780×1890、1ドット 30px）
  - `label.png`・`message.png`・`headline.png`・`kicker.png`・`present.png`：文字のまとまりごとの透過 PNG
  - `placed.json`：それぞれを Canva に置く位置と大きさ（px）
  - `preview.png`：重ねた仕上がり
- 縦長（4:5・9:16）：`banner_1118_portrait.py`（`python3 pixel-banner/banner_1118_portrait.py`）。横長の部品を使い、配置だけ縦向きに組み直す。SNS では日時が要るので、日時と開催の詳細を左のウィンドウに入れ、右に小さな攻略マップを置く。ストーリーズは 4:5 と同じ配置を 285px 下へずらす（上下およそ 250px が操作部分に隠れるため）
  - 書き出し：`out/2026-11-18/feed_4x5/`・`out/2026-11-18/story_9x16/`（背景・`message`・`headline`・`kicker`・`date`・`present` と `placed.json`・`preview.png`）
- Canva のデザインでは、背景と文字のまとまりを別々の画像として置いている（Canva の中で位置は動かせるが、**文字は画像なので Canva では書き換えられない**）
- 文言を変えるときは、スクリプトの `build()` の文字列を直して書き出し直し、push してから Canva の画像を差し替える
- 文言と見た目の決めごとの正は `セミナーLP文面/2026-11-18_peatix.md`

## 書体

DotGothic16（SIL Open Font License 1.1。https://github.com/fontworks-fonts/DotGothic16 ）。
初回の実行時に `.fonts/` へ取ってくる（`.fonts/` はコミットしない）。画像に描いて使う分には、ライセンス上の表記は要らない。
