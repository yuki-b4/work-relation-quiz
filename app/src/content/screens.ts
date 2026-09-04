// 自動生成。直接編集しない。
// 生成元：prototype.html（文面の正）
// 再生成：cd app && node tools/extract-content.mjs
// イントロ・フレーム・設問の素のHTML

/**
 * prototype.html の該当節をそのまま写したもの。埋める値が無いので、このまま出す。
 * 文面を変えるときは prototype.html を直して `npm run content` で再生成する。
 */
export const INTRO_MARKUP = "  <section class=\"screen active\" id=\"intro\">\n    <h1 class=\"hero\">あなたの自然体がわかる診断</h1>\n    <p class=\"lead\">力を抜いたときの「自然体のあなた」の関わり方を、8つのタイプで映し出します。</p>\n\n    <ol class=\"steps\">\n      <li class=\"step\">\n        <span class=\"step-no\">1</span>\n        <div class=\"step-body\">\n          <p class=\"step-t\">24問に答える（無料）</p>\n          <p class=\"step-d\">約2分、登録は不要。力を抜いた「普段のあなた」で答えます。</p>\n        </div>\n      </li>\n      <li class=\"step\">\n        <span class=\"step-no\">2</span>\n        <div class=\"step-body\">\n          <p class=\"step-t\">自分のタイプを知る</p>\n          <p class=\"step-d\">本音・衝突・重心の3軸の組み合わせで、8つのタイプに映し出します。</p>\n        </div>\n      </li>\n      <li class=\"step\">\n        <span class=\"step-no\">3</span>\n        <div class=\"step-body\">\n          <p class=\"step-t\">自分の取り扱い説明書を受け取る</p>\n          <p class=\"step-d\">自分の強みとつい出るクセ、コミュニケーションの傾向がわかります。</p>\n        </div>\n      </li>\n    </ol>\n\n    <button class=\"btn btn-wide\" id=\"startBtn\">診断を始める</button>\n  </section>";
export const FRAME_MARKUP = "  <section class=\"screen\" id=\"frame\">\n    <div class=\"eyebrow\">はじめに</div>\n    <h2 class=\"hero\" style=\"font-size:clamp(22px,5vw,30px)\">特定の場面ではなく、「普段のあなた」で答えてください。</h2>\n    <p class=\"frame-why\">人は、相手や場面によって振る舞いを変えます。この診断で映すのは、職場やプライベートといった特定の場面の顔ではなく、力を抜いたときの「自然体のあなた」です。特定の誰かや状況を思い浮かべず、いつもの自分ならどう感じるか、で答えてください。</p>\n    <button class=\"btn btn-wide\" id=\"frameStart\">自然体の自分で診断を始める</button>\n    <p class=\"frame-note\" id=\"frameNote\"></p>\n  </section>";
export const QUIZ_MARKUP = "  <section class=\"screen\" id=\"quiz\">\n    <div class=\"qtop\">\n      <span class=\"qpct\" id=\"qpct\">0%</span>\n      <div class=\"bar\"><i id=\"barfill\"></i></div>\n      <span class=\"qcount\" id=\"qcount\">1 / 24</span>\n    </div>\n    <p class=\"qframe\" id=\"qframe\"></p>\n    <p class=\"qtext\" id=\"qtext\"></p>\n    <div class=\"choices\" id=\"choices\"></div>\n    <button class=\"qback\" id=\"backBtn\" hidden>← ひとつ戻る</button>\n    <p class=\"qhint\" id=\"qhint\">どちらがより自分に近いかで直感的に。迷ったら第一印象で大丈夫です。</p>\n  </section>";
