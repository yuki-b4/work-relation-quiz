# Canva を操作するとき（Canva MCP）

2026-09-26 のセミナー告知バナーの作業で分かった、Canva MCP の癖をまとめたもの。
どのバナーがどの告知に使われているかは `セミナーLP文面.md` の「告知物の一覧」。

## 文字

- **`add_text` で足した文字は、書体を選べず Canva の標準の書体になる**（`format_text` でも書体は変えられない）。
  バナーの太い書体を保ちたいときは、**既存の文字要素を `replace_text` で書き換えて使い回す**。
  新しく足すのは、ラベルなど標準の書体で困らないものだけにする
- **標準の書体には「〜」が無い**（豆腐になる）。標準の書体の文字では「~」を使う。
  既存の太い書体（`YAFdJiHXlcI`）には「〜」がある
- 文字の大きさ（`font_size`）は整数しか渡せない

## 編集の流れ

- `read-design` を `open_transaction: true` で開き、`edit-design` で直し、**サムネイルで仕上がりを確かめてから** `commit` する
- 1回の `edit-design` にまとめて操作を渡せる。位置や大きさを決めてから、まとめて流すと速い
- **MCP の接続が切れると、開いていた編集は無効になる。** 「transaction が無い」と言われたら `read-design` で開き直し、
  直す前の状態から操作をやり直す
- 保存（`commit`）は取り消せない。ユーザーが内容を決めた変更だけを保存する

## サイズ違いを作る

- `resize-design` は新しいデザインを作るが、**配置は組み直さない**（元の配置が縮小されて真ん中に置かれるだけ）。
  文字・枠・背景を1つずつ `resize_element` と `position_element` で置き直す
- イラストのように複数の図形でできているものは、**`group_elements` でまとめてから** `resize_element`
  （`preserve_aspect_ratio: true`）で拡大し、`position_element` で動かす
- 作ったら `update_title` で用途が分かる名前にする（`resize-design` は元と同じ名前のまま作る）

## 画像の書き出し

- `export-design` は書き出せるが、**この環境からはその URL（`export-download.canva.com`）を取れない**（ネットワーク設定で遮断）。
  リポジトリに画像を置くときは、ユーザーに書き出してもらいチャットで受け取る
- WebP で届いたら `pip install pillow` で PNG に変換する（PyPI は通る）。OG画像は 1200 幅にそろえる
